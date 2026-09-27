import { useEffect } from 'react';
import {
  ref,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  get,
  goOnline,
  query,
  limitToLast,
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
  LABORATORY_QUERY_KEYS,
} from '../constants/queryKeys';
import { perfTelemetry } from '../utils/perfTelemetry';
import { DEFAULT_TESTING_LABORATORIES } from '../services/laboratoryService';

export type CollectionSyncScope = 'BOUNDED_SYNC' | 'FULL_SYNC';

export interface CollectionConfig {
  key: string;
  storeName: string;
  firebasePath: string;
  queryKey: readonly any[];
  syncScope: CollectionSyncScope;
  sortFn?: (a: any, b: any) => number;
  getScopedInvalidations?: (item: any, id: string) => void;
  getInitialQuery?: (reference: any) => any;
}

const COLLECTION_CONFIGS: Record<string, CollectionConfig> = {
  products: {
    key: 'products',
    storeName: 'products',
    firebasePath: 'products',
    queryKey: PRODUCT_QUERY_KEYS.all,
    syncScope: 'FULL_SYNC',
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
    syncScope: 'BOUNDED_SYNC',
    getInitialQuery: (reference) => query(reference, limitToLast(100)),
    sortFn: (a, b) =>
      new Date(b.mfgDate || b.createdAt || 0).getTime() -
      new Date(a.mfgDate || a.createdAt || 0).getTime(),
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
    syncScope: 'FULL_SYNC',
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
    syncScope: 'FULL_SYNC',
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
    syncScope: 'FULL_SYNC',
    getScopedInvalidations: (item, id) => {
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEYS.materialDetail(id) });
    },
  },
  testResults: {
    key: 'testResults',
    storeName: 'testResults',
    firebasePath: 'testResults',
    queryKey: TEST_RESULT_QUERY_KEYS.all,
    syncScope: 'BOUNDED_SYNC',
    getInitialQuery: (reference) => query(reference, limitToLast(500)),
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
    syncScope: 'FULL_SYNC',
  },
  criteriaAliases: {
    key: 'criteriaAliases',
    storeName: 'criteriaAliases',
    firebasePath: 'criteria_aliases',
    queryKey: TCCS_QUERY_KEYS.aliases,
    syncScope: 'FULL_SYNC',
  },
  testingLaboratories: {
    key: 'testingLaboratories',
    storeName: 'testingLaboratories',
    firebasePath: 'testing_laboratories',
    queryKey: LABORATORY_QUERY_KEYS.all,
    syncScope: 'FULL_SYNC',
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
/**
 * PQM Sync Metadata: Lightweight performance & freshness tracking (Phase 4)
 * KHÔNG dùng metadata này làm business authority.
 */
export interface PqmSyncMetadata {
  version: number;
  lastSuccessfulSyncAt: string;
  collections: Record<string, { lastSyncedAt: string; count: number }>;
}

const SYNC_META_KEY = 'PQM_SYNC_META';

export const getSyncMetadata = (): PqmSyncMetadata => {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fallback an toàn */
  }
  return { version: 1, lastSuccessfulSyncAt: '', collections: {} };
};

export const updateCollectionSyncMeta = (collectionKey: string, count: number) => {
  try {
    const meta = getSyncMetadata();
    const now = new Date().toISOString();
    meta.lastSuccessfulSyncAt = now;
    meta.collections[collectionKey] = { lastSyncedAt: now, count };
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    /* silent fallback */
  }
};

const CRITICAL_COLLECTION_KEYS = [
  'products',
  'batches',
  'tccsList',
  'testingLaboratories',
] as const;
const SECONDARY_COLLECTION_KEYS = [
  'productFormulas',
  'rawMaterials',
  'testResults',
  'criteriaAliases',
  'aiLearnedMappings',
] as const;

/**
 * useFirebaseSync — Canonical Parallel Sync Engine (Phases 1 - 6)
 *
 * Tối ưu hóa hiệu năng đồng bộ dữ liệu:
 * 1. Khởi tạo: Nạp nhanh từ IndexedDB Offline Cache (Tier 1 & Tier 2) -> App Shell render tức thì
 * 2. Parallel Tiered Sync: Thay thế for..of tuần tự bằng Promise.all theo tầng (Critical trước, Secondary sau)
 * 3. Chống Duplicate Bootstrap Replay: Thu thập Set các ID đã có từ snapshot ban đầu để listener onChildAdded
 *    không thực hiện duplicate update, duplicate cache write và duplicate query invalidations
 * 4. Vòng đời Listener Ổn định (Phase 5): Phụ thuộc vào user?.uid thay vì toàn bộ object user
 * 5. Scoped Invalidation (Phase 6): Chỉ làm mới đúng query mục tiêu khi có delta thay đổi thực sự
 */
export const useFirebaseSync = () => {
  const userId = useAppStore((state) => state.user?.uid);

  useEffect(() => {
    if (!userId) return; // Guard: Chỉ đồng bộ khi người dùng đã đăng nhập (ổn định theo uid)

    let isMounted = true;
    const unsubscribes: (() => void)[] = [];
    const bootStartTime = performance.now();

    const handleOnline = () => {
      goOnline(db);
    };
    const handleOffline = () => useAppStore.getState().setSyncStatus('OFFLINE');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Tập hợp ID đã được tải từ snapshot ban đầu cho từng collection
    // Nhằm ngăn chặn Firebase RTDB onChildAdded phát lại sự kiện cho các bản ghi đã nạp
    const knownItemIdsByCollection: Record<string, Set<string>> = {};

    const setupCollectionSync = async (config: CollectionConfig): Promise<(() => void) | null> => {
      if (!isMounted) return null;
      const collectionCleanups: (() => void)[] = [];
      const knownIds = new Set<string>();
      knownItemIdsByCollection[config.key] = knownIds;

      const reference = ref(db, config.firebasePath);
      const queryTarget = config.getInitialQuery ? config.getInitialQuery(reference) : reference;

      // 1. Snapshot ban đầu
      try {
        const snapshot = await get(queryTarget);
        if (snapshot.exists() && isMounted) {
          const data = snapshot.val();
          let list = data ? Object.values(data) : [];
          if (config.sortFn) {
            list = list.sort(config.sortFn);
          }

          // Ghi nhận ID đã có để onChildAdded bỏ qua
          list.forEach((item: any) => {
            if (item?.id) knownIds.add(String(item.id));
          });

          // Cập nhật TanStack Query Cache một lần duy nhất
          queryClient.setQueryData(config.queryKey, list);
          useAppStore.getState().setAppState({
            lastSync: new Date().toISOString(),
          });

          // Ghi vào IndexedDB ngầm (không block UI)
          if (list.length > 0) {
            const saveTask = () => saveToCache(config.storeName, list, { clear: true });
            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(saveTask);
            } else {
              setTimeout(saveTask, 300);
            }
          }

          // Cập nhật sync metadata
          updateCollectionSyncMeta(config.key, list.length);
          perfTelemetry.record('COLLECTION_SYNC', {
            collection: config.key,
            count: list.length,
            details: { syncScope: config.syncScope },
          });
        }
      } catch (e) {
        console.warn(`[SyncEngine] Lỗi nạp snapshot ban đầu cho [${config.key}]:`, e);
      }

      if (!isMounted) return null;

      // 2. Lắng nghe Vi mô: onChildChanged (Granular Update in-place)
      // BẮT BUỘC: Lắng nghe trên queryTarget (chính xác phạm vi BOUNDED_SYNC hoặc FULL_SYNC)
      const unsubChanged = onChildChanged(queryTarget, (snapshot) => {
        if (!isMounted) return;
        const updatedEntity = snapshot.val();
        const id = snapshot.key || updatedEntity?.id;
        if (!updatedEntity || !id) return;

        knownIds.add(String(id));

        queryClient.setQueryData<any[]>(config.queryKey, (old = []) => {
          const index = old.findIndex((item) => item.id === id);
          if (index === -1) {
            const next = [updatedEntity, ...old];
            if (config.sortFn) next.sort(config.sortFn);
            return next;
          }
          const next = [...old];
          next[index] = updatedEntity;

          if (config.sortFn && next.length > 1) {
            const prevBroken = index > 0 && config.sortFn(next[index - 1], next[index]) > 0;
            const nextBroken =
              index < next.length - 1 && config.sortFn(next[index], next[index + 1]) > 0;
            if (prevBroken || nextBroken) {
              next.sort(config.sortFn);
            }
          }
          return next;
        });

        // Lưu vi mô vào IndexedDB (KHÔNG xóa bảng)
        saveItemToCache(config.storeName, updatedEntity);

        // Invalidate scoped queries liên quan
        config.getScopedInvalidations?.(updatedEntity, id);
      });
      collectionCleanups.push(unsubChanged);

      // 3. Lắng nghe thêm mới Vi mô: onChildAdded
      // BẮT BUỘC: Lắng nghe trên queryTarget (chính xác phạm vi BOUNDED_SYNC hoặc FULL_SYNC)
      // CHỈ xử lý các bản ghi THỰC SỰ MỚI (chưa có trong knownIds từ snapshot ban đầu)
      const unsubAdded = onChildAdded(queryTarget, (snapshot) => {
        if (!isMounted) return;
        const newEntity = snapshot.val();
        const id = snapshot.key || newEntity?.id;
        if (!newEntity || !id) return;

        // Bỏ qua nếu bản ghi đã có từ snapshot ban đầu -> LOẠI BỎ HOÀN TOÀN DUPLICATE BOOTSTRAP REPLAY
        if (knownIds.has(String(id))) return;
        knownIds.add(String(id));

        queryClient.setQueryData<any[]>(config.queryKey, (old = []) => {
          if (old.some((item) => item.id === id)) return old;
          if (config.sortFn && old.length > 0 && config.sortFn(newEntity, old[0]) <= 0) {
            return [newEntity, ...old];
          }
          const next = [...old, newEntity];
          if (config.sortFn) {
            next.sort(config.sortFn);
          }
          return next;
        });

        saveItemToCache(config.storeName, newEntity);
        config.getScopedInvalidations?.(newEntity, id);
      });
      collectionCleanups.push(unsubAdded);

      // 4. Lắng nghe xóa Vi mô: onChildRemoved (Xóa hoặc Eviction khi rơi khỏi Bounded Window)
      // BẮT BUỘC: Lắng nghe trên queryTarget (chính xác phạm vi BOUNDED_SYNC hoặc FULL_SYNC)
      const unsubRemoved = onChildRemoved(queryTarget, (snapshot) => {
        if (!isMounted) return;
        const id = snapshot.key;
        if (!id) return;

        knownIds.delete(String(id));

        queryClient.setQueryData<any[]>(config.queryKey, (old = []) =>
          old.filter((item) => item.id !== id)
        );

        deleteItemFromCache(config.storeName, id);
        config.getScopedInvalidations?.(null, id);
      });
      collectionCleanups.push(unsubRemoved);

      return () => {
        collectionCleanups.forEach((fn) => fn());
      };
    };

    const initializeData = async () => {
      // BƯỚC 1: Tải nhanh dữ liệu từ IndexedDB Offline Cache (Local-First Render)
      try {
        const [
          cachedProducts,
          cachedBatches,
          cachedTccs,
          cachedTestingLaboratories,
          cachedQualityAlerts,
        ] = await Promise.all([
          getFromCache('products'),
          getFromCache('batches'),
          getFromCache('tccs'),
          getFromCache('testingLaboratories'),
          getFromCache('qualityAlerts'),
        ]);

        if (!isMounted) return;

        if (cachedProducts?.length > 0)
          queryClient.setQueryData(PRODUCT_QUERY_KEYS.all, cachedProducts);
        if (cachedBatches?.length > 0)
          queryClient.setQueryData(BATCH_QUERY_KEYS.all, cachedBatches);
        if (cachedTccs?.length > 0) queryClient.setQueryData(TCCS_QUERY_KEYS.all, cachedTccs);
        if (cachedTestingLaboratories?.length > 0) {
          queryClient.setQueryData(LABORATORY_QUERY_KEYS.all, cachedTestingLaboratories);
        } else {
          queryClient.setQueryData(LABORATORY_QUERY_KEYS.all, DEFAULT_TESTING_LABORATORIES);
        }

        // Đánh dấu trạng thái sẵn sàng cho tầng 1
        useAppStore.getState().setSyncStatus('SAVED');
        useAppStore.getState().setAppState({
          lastSync: new Date().toISOString(),
        });

        // Tầng 2: Dữ liệu SECONDARY nạp bất đồng bộ không block UI
        const hydrateSecondary = async () => {
          try {
            const [
              cachedFormulas,
              cachedMaterials,
              cachedTestResults,
              cachedCriteriaAliases,
              cachedAiMappings,
            ] = await Promise.all([
              getFromCache('productFormulas'),
              getFromCache('rawMaterials'),
              getFromCache('testResults'),
              getFromCache('criteriaAliases'),
              getFromCache('aiLearnedMappings'),
            ]);

            if (!isMounted) return;

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
          } catch (e) {
            console.warn('[SyncEngine] Lỗi nạp cache tầng 2:', e);
          }
        };

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => hydrateSecondary());
        } else {
          setTimeout(hydrateSecondary, 10);
        }
      } catch (error) {
        console.error('[SyncEngine] Lỗi nạp cache IndexedDB:', error);
      }

      if (!isMounted) return;

      // BƯỚC 2: REMOTE SYNC SONG SONG (Phase 2 - Parallel Initial Sync)
      // 2.1. Critical Collections chạy song song bằng Promise.all (Không block tuần tự)
      const criticalCleanups = await Promise.all(
        CRITICAL_COLLECTION_KEYS.map((key) => {
          const config = COLLECTION_CONFIGS[key];
          return config ? setupCollectionSync(config) : Promise.resolve(null);
        })
      );
      if (!isMounted) return;
      criticalCleanups.forEach((cleanup) => {
        if (cleanup) unsubscribes.push(cleanup);
      });

      // 2.2. Secondary Collections nạp nền song song (Không block App Shell / Dashboard)
      const syncSecondaryCollections = async () => {
        if (!isMounted) return;
        const secondaryCleanups = await Promise.all(
          SECONDARY_COLLECTION_KEYS.map((key) => {
            const config = COLLECTION_CONFIGS[key];
            return config ? setupCollectionSync(config) : Promise.resolve(null);
          })
        );
        if (!isMounted) return;
        secondaryCleanups.forEach((cleanup) => {
          if (cleanup) unsubscribes.push(cleanup);
        });
      };

      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => syncSecondaryCollections());
      } else {
        setTimeout(syncSecondaryCollections, 50);
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
          perfTelemetry.record('FIREBASE_CONNECT');
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
  }, [userId]);
};
