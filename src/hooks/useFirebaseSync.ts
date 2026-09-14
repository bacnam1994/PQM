import { useEffect } from 'react';
import {
  ref,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  get,
  goOnline,
} from 'firebase/database';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { getFromCache, saveToCache, saveItemToCache, deleteItemFromCache } from '../utils';
import { queryClient } from '../lib/queryClient';
import {
  PRODUCT_QUERY_KEYS,
  BATCH_QUERY_KEYS,
  TCCS_QUERY_KEYS,
  TEST_RESULT_QUERY_KEYS,
} from '../constants/queryKeys';

interface CollectionConfig {
  key: string;
  storeName: string;
  firebasePath: string;
  queryKey: readonly any[];
  sortFn?: (a: any, b: any) => number;
  getScopedInvalidations?: (item: any, id: string) => void;
}

const COLLECTION_CONFIGS: Record<string, CollectionConfig> = {
  products: {
    key: 'products',
    storeName: 'products',
    firebasePath: 'products',
    queryKey: PRODUCT_QUERY_KEYS.all,
    getScopedInvalidations: (item, id) => {
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.byProduct(id) });
      queryClient.invalidateQueries({ queryKey: TCCS_QUERY_KEYS.byProduct(id) });
    },
  },
  batches: {
    key: 'batches',
    storeName: 'batches',
    firebasePath: 'batches',
    queryKey: BATCH_QUERY_KEYS.all,
    getScopedInvalidations: (item, id) => {
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.byBatch(id) });
      if (item?.productId) {
        queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.byProduct(item.productId) });
      }
    },
  },
  tccsList: {
    key: 'tccsList',
    storeName: 'tccs',
    firebasePath: 'tccs',
    queryKey: TCCS_QUERY_KEYS.all,
    getScopedInvalidations: (item, id) => {
      queryClient.invalidateQueries({ queryKey: TCCS_QUERY_KEYS.detail(id) });
      if (item?.productId) {
        queryClient.invalidateQueries({ queryKey: TCCS_QUERY_KEYS.byProduct(item.productId) });
      }
    },
  },
  productFormulas: {
    key: 'productFormulas',
    storeName: 'productFormulas',
    firebasePath: 'product_formulas',
    queryKey: PRODUCT_QUERY_KEYS.formulas,
    getScopedInvalidations: (item, id) => {
      if (item?.productId) {
        queryClient.invalidateQueries({
          queryKey: PRODUCT_QUERY_KEYS.formulaByProduct(item.productId),
        });
      }
    },
  },
  rawMaterials: {
    key: 'rawMaterials',
    storeName: 'rawMaterials',
    firebasePath: 'raw_materials',
    queryKey: PRODUCT_QUERY_KEYS.materials,
    getScopedInvalidations: (item, id) => {
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.materialDetail(id) });
    },
  },
  testResults: {
    key: 'testResults',
    storeName: 'testResults',
    firebasePath: 'testResults',
    queryKey: TEST_RESULT_QUERY_KEYS.all,
    sortFn: (a, b) =>
      new Date(b.testDate || b.createdAt || 0).getTime() -
      new Date(a.testDate || a.createdAt || 0).getTime(),
    getScopedInvalidations: (item, id) => {
      queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.detail(id) });
      if (item?.batchId) {
        queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.byBatch(item.batchId) });
      }
    },
  },
  aiLearnedMappings: {
    key: 'aiLearnedMappings',
    storeName: 'aiLearnedMappings',
    firebasePath: 'ai_learned_mappings',
    queryKey: TCCS_QUERY_KEYS.aiMappings,
  },
  criteriaAliases: {
    key: 'criteriaAliases',
    storeName: 'criteriaAliases',
    firebasePath: 'criteria_aliases',
    queryKey: TCCS_QUERY_KEYS.aliases,
  },
};

/**
 * useFirebaseSync — Granular Sync Engine (Phase 2)
 *
 * Tối ưu hóa hiệu năng đồng bộ dữ liệu:
 * 1. Khởi tạo: Nạp nhanh từ IndexedDB Offline Cache, sau đó nạp snapshot ban đầu từ Firebase
 * 2. Lắng nghe Vi mô (Granular Delta Listeners):
 *    - onChildChanged: Chỉ cập nhật in-place record thay đổi trong TanStack Query Cache,
 *      ghi đúng 1 record vào IndexedDB (KHÔNG clear DB), chỉ invalidate scoped queries liên quan.
 *    - onChildAdded: Nạp thêm record mới mà không kéo toàn bộ 10.000 bản ghi.
 *    - onChildRemoved: Xóa đúng record mục tiêu.
 * 3. Loại bỏ hoàn toàn reload/replace toàn bộ bảng khi 1 record thay đổi.
 */
export const useFirebaseSync = () => {
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    if (!user) return; // Guard: Chỉ đồng bộ khi người dùng đã đăng nhập

    let isMounted = true;
    const unsubscribes: (() => void)[] = [];

    const handleOnline = () => {
      goOnline(db);
    };
    const handleOffline = () => useAppStore.getState().setSyncStatus('OFFLINE');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const initializeData = async () => {
      // BƯỚC 1: Tải nhanh dữ liệu từ IndexedDB Offline Cache
      try {
        const [
          cachedProducts,
          cachedBatches,
          cachedTccs,
          cachedFormulas,
          cachedMaterials,
          cachedTestResults,
          cachedAiMappings,
          cachedQualityAlerts,
          cachedCriteriaAliases,
        ] = await Promise.all([
          getFromCache('products'),
          getFromCache('batches'),
          getFromCache('tccs'),
          getFromCache('productFormulas'),
          getFromCache('rawMaterials'),
          getFromCache('testResults'),
          getFromCache('aiLearnedMappings'),
          getFromCache('qualityAlerts'),
          getFromCache('criteriaAliases'),
        ]);

        if (!isMounted) return;

        // Nạp cache IndexedDB vào TanStack Query Cache
        if (cachedProducts?.length > 0)
          queryClient.setQueryData(PRODUCT_QUERY_KEYS.all, cachedProducts);
        if (cachedBatches?.length > 0)
          queryClient.setQueryData(BATCH_QUERY_KEYS.all, cachedBatches);
        if (cachedTccs?.length > 0) queryClient.setQueryData(TCCS_QUERY_KEYS.all, cachedTccs);
        if (cachedFormulas?.length > 0)
          queryClient.setQueryData(PRODUCT_QUERY_KEYS.formulas, cachedFormulas);
        if (cachedMaterials?.length > 0)
          queryClient.setQueryData(PRODUCT_QUERY_KEYS.materials, cachedMaterials);
        if (cachedTestResults?.length > 0)
          queryClient.setQueryData(TEST_RESULT_QUERY_KEYS.all, cachedTestResults);
        if (cachedCriteriaAliases?.length > 0)
          queryClient.setQueryData(TCCS_QUERY_KEYS.aliases, cachedCriteriaAliases);
        if (cachedAiMappings?.length > 0)
          queryClient.setQueryData(TCCS_QUERY_KEYS.aiMappings, cachedAiMappings);

        const currentState = useAppStore.getState();
        useAppStore.getState().setAppState({
          products: cachedProducts?.length > 0 ? cachedProducts : currentState.products,
          batches: cachedBatches?.length > 0 ? cachedBatches : currentState.batches,
          tccsList: cachedTccs?.length > 0 ? cachedTccs : currentState.tccsList,
          productFormulas:
            cachedFormulas?.length > 0 ? cachedFormulas : currentState.productFormulas,
          rawMaterials: cachedMaterials?.length > 0 ? cachedMaterials : currentState.rawMaterials,
          testResults:
            cachedTestResults?.length > 0
              ? cachedTestResults.sort(
                  (a: any, b: any) =>
                    new Date(b.testDate).getTime() - new Date(a.testDate).getTime()
                )
              : currentState.testResults,
          aiLearnedMappings:
            cachedAiMappings?.length > 0 ? cachedAiMappings : currentState.aiLearnedMappings,
          qualityAlerts:
            cachedQualityAlerts?.length > 0 ? cachedQualityAlerts : currentState.qualityAlerts,
          criteriaAliases:
            cachedCriteriaAliases?.length > 0
              ? cachedCriteriaAliases
              : currentState.criteriaAliases,
        });
      } catch (error) {
        console.error('[SyncEngine] Lỗi nạp cache IndexedDB:', error);
      }

      if (!isMounted) return;

      // BƯỚC 2: Thiết lập Granular Delta Listeners cho từng danh mục
      const isInitialSnapshotLoaded: Record<string, boolean> = {};

      for (const config of Object.values(COLLECTION_CONFIGS)) {
        const reference = ref(db, config.firebasePath);

        // 2.1. Nạp snapshot ban đầu 1 lần (Initial Snapshot Fetch)
        try {
          const snapshot = await get(reference);
          if (snapshot.exists() && isMounted) {
            const data = snapshot.val();
            let list = data ? Object.values(data) : [];
            if (config.sortFn) {
              list = list.sort(config.sortFn);
            }

            // Đồng bộ toàn bộ danh sách ban đầu vào Query Cache & Store
            queryClient.setQueryData(config.queryKey, list);
            useAppStore.getState().setAppState({
              [config.key]: list,
              lastSync: new Date().toISOString(),
            });

            // Ghi đầy đủ vào IndexedDB (Initial load cho phép clear để xóa rác cũ nếu có)
            if (list.length > 0) {
              const saveTask = () => saveToCache(config.storeName, list, { clear: true });
              if ('requestIdleCallback' in window) {
                window.requestIdleCallback(saveTask);
              } else {
                setTimeout(saveTask, 500);
              }
            }
          }
        } catch (e) {
          console.warn(`[SyncEngine] Lỗi nạp snapshot ban đầu cho [${config.key}]:`, e);
        }

        isInitialSnapshotLoaded[config.key] = true;
        if (!isMounted) return;

        // 2.2. Lắng nghe thay đổi Vi mô: onChildChanged (Granular Update)
        const unsubChanged = onChildChanged(reference, (snapshot) => {
          if (!isMounted) return;
          const updatedEntity = snapshot.val();
          const id = snapshot.key || updatedEntity?.id;
          if (!updatedEntity || !id) return;

          // Cập nhật in-place vào TanStack Query Cache
          queryClient.setQueryData<any[]>(config.queryKey, (old = []) => {
            const index = old.findIndex((item) => item.id === id);
            if (index === -1) return [...old, updatedEntity];
            const next = [...old];
            next[index] = updatedEntity;
            if (config.sortFn) {
              next.sort(config.sortFn);
            }
            return next;
          });

          // Lưu vi mô vào IndexedDB (KHÔNG xóa bảng)
          saveItemToCache(config.storeName, updatedEntity);

          // Invalidate scoped queries liên quan
          config.getScopedInvalidations?.(updatedEntity, id);
        });
        unsubscribes.push(unsubChanged);

        // 2.3. Lắng nghe thêm mới Vi mô: onChildAdded
        const unsubAdded = onChildAdded(reference, (snapshot) => {
          if (!isMounted || !isInitialSnapshotLoaded[config.key]) return;
          const newEntity = snapshot.val();
          const id = snapshot.key || newEntity?.id;
          if (!newEntity || !id) return;

          // Thêm in-place vào TanStack Query Cache nếu chưa có
          queryClient.setQueryData<any[]>(config.queryKey, (old = []) => {
            if (old.some((item) => item.id === id)) return old;
            const next = [...old, newEntity];
            if (config.sortFn) {
              next.sort(config.sortFn);
            }
            return next;
          });

          // Lưu vi mô vào IndexedDB
          saveItemToCache(config.storeName, newEntity);

          // Invalidate scoped queries liên quan
          config.getScopedInvalidations?.(newEntity, id);
        });
        unsubscribes.push(unsubAdded);

        // 2.4. Lắng nghe xóa Vi mô: onChildRemoved
        const unsubRemoved = onChildRemoved(reference, (snapshot) => {
          if (!isMounted) return;
          const id = snapshot.key;
          if (!id) return;

          // Xóa in-place khỏi TanStack Query Cache
          queryClient.setQueryData<any[]>(config.queryKey, (old = []) =>
            old.filter((item) => item.id !== id)
          );

          // Xóa vi mô khỏi IndexedDB
          deleteItemFromCache(config.storeName, id);

          // Invalidate scoped queries liên quan
          config.getScopedInvalidations?.(null, id);
        });
        unsubscribes.push(unsubRemoved);
      }

      // BƯỚC 3: Đồng bộ Quality Alerts theo cấu trúc mới
      const alertsUnsubscribe = onValue(
        ref(db, 'quality_alerts/latest'),
        (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.val();
          if (data && data.alerts && Array.isArray(data.alerts)) {
            useAppStore.getState().setAppState({ qualityAlerts: data.alerts });
            saveToCache('qualityAlerts', data.alerts);
          } else if (Array.isArray(data)) {
            useAppStore.getState().setAppState({ qualityAlerts: data });
          } else {
            useAppStore.getState().setAppState({ qualityAlerts: [] });
          }
        },
        (error) => {
          console.error('[SyncEngine] Lỗi đọc quality_alerts:', error);
        }
      );
      unsubscribes.push(alertsUnsubscribe);
    };

    initializeData();

    // Lắng nghe trạng thái kết nối mạng của Firebase (.info/connected)
    const connectedRef = ref(db, '.info/connected');
    const unsubConnected = onValue(
      connectedRef,
      (snap) => {
        if (!isMounted) return;
        if (snap.val() === true) {
          const currentStatus = useAppStore.getState().syncStatus;
          if (currentStatus === 'ERROR' || currentStatus === 'OFFLINE')
            useAppStore.getState().setSyncStatus('IDLE');
        } else {
          useAppStore.getState().setSyncStatus('OFFLINE');
        }
      },
      (error) => {
        console.warn('[SyncEngine] Lỗi đồng bộ trạng thái kết nối Firebase:', error);
      }
    );
    unsubscribes.push(unsubConnected);

    return () => {
      isMounted = false;
      unsubscribes.forEach((fn) => fn());
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);
};
