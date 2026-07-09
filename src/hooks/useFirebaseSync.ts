import { useEffect } from 'react';
import { ref, onValue, query, limitToLast, orderByChild, goOnline } from 'firebase/database';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { getFromCache, saveToCache } from '../utils';

export const useFirebaseSync = () => {
  const user = useAppStore(state => state.user);
  const testResultLimit = useAppStore(state => state.testResultLimit);

  // 1. Lắng nghe dữ liệu cơ bản từ Firebase Realtime Database
  useEffect(() => {
    if (!user) return; // Guard: Chỉ đồng bộ dữ liệu khi người dùng đã đăng nhập thành công

    let isMounted = true;
    const unsubscribes: (() => void)[] = [];

    const handleOnline = () => goOnline(db);
    const handleOffline = () => useAppStore.getState().setSyncStatus('OFFLINE');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const initializeData = async () => {
      // Tải cache từ IndexedDB trước
      try {
        const [cachedProducts, cachedBatches, cachedTccs, cachedFormulas, cachedMaterials, cachedTestResults, cachedAiMappings, cachedQualityAlerts] = await Promise.all([
          getFromCache('products'), getFromCache('batches'), getFromCache('tccs'), getFromCache('productFormulas'),
          getFromCache('rawMaterials'), getFromCache('testResults'), getFromCache('aiLearnedMappings'), getFromCache('qualityAlerts')
        ]);

        if (!isMounted) return;
        const currentState = useAppStore.getState();
        useAppStore.getState().setAppState({
          products: cachedProducts.length > 0 ? cachedProducts : currentState.products,
          batches: cachedBatches.length > 0 ? cachedBatches : currentState.batches,
          tccsList: cachedTccs.length > 0 ? cachedTccs : currentState.tccsList,
          productFormulas: cachedFormulas.length > 0 ? cachedFormulas : currentState.productFormulas,
          rawMaterials: cachedMaterials.length > 0 ? cachedMaterials : currentState.rawMaterials,
          testResults: cachedTestResults.length > 0 ? cachedTestResults.sort((a: any, b: any) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()) : currentState.testResults,
          aiLearnedMappings: cachedAiMappings?.length > 0 ? cachedAiMappings : currentState.aiLearnedMappings,
          qualityAlerts: cachedQualityAlerts?.length > 0 ? cachedQualityAlerts : currentState.qualityAlerts,
        });
      } catch (error) {
        console.error("Lỗi nạp cache:", error);
      }

      if (!isMounted) return;

      // Sau khi nạp xong cache, đăng ký lắng nghe Firebase Realtime Database
      const refs = {
        products: ref(db, 'products'),
        batches: ref(db, 'batches'),
        tccsList: ref(db, 'tccs'),
        productFormulas: ref(db, 'product_formulas'),
        rawMaterials: ref(db, 'raw_materials'),
        aiLearnedMappings: ref(db, 'ai_learned_mappings'),
        qualityAlerts: ref(db, 'quality_alerts'),
      };

      Object.entries(refs).forEach(([key, reference]) => {
        const unsubscribe = onValue(reference, (snapshot) => {
          const data = snapshot.val();
          const list = data ? Object.values(data) : [];
          useAppStore.getState().setAppState({ [key]: list, lastSync: new Date().toISOString() });

          if (list.length > 0) {
            const storeName = key === 'tccsList' ? 'tccs' : (key === 'aiLearnedMappings' ? 'aiLearnedMappings' : key);
            const saveTask = () => saveToCache(storeName, list);
            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(saveTask);
            } else {
              setTimeout(saveTask, 500);
            }
          }
        }, (error) => {
          console.error(`Lỗi đồng bộ Firebase cho danh mục [${key}]:`, error);
        });
        unsubscribes.push(unsubscribe);
      });
    };

    initializeData();

    const connectedRef = ref(db, '.info/connected');
    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        const currentStatus = useAppStore.getState().syncStatus;
        if (currentStatus === 'ERROR' || currentStatus === 'OFFLINE') useAppStore.getState().setSyncStatus('IDLE');
      } else {
        useAppStore.getState().setSyncStatus('OFFLINE');
      }
    }, (error) => {
      console.warn("Lỗi đồng bộ trạng thái kết nối Firebase:", error);
    });
    unsubscribes.push(unsubConnected);

    return () => {
      isMounted = false;
      unsubscribes.forEach(fn => fn());
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  // 2. Lắng nghe dữ liệu TestResults (có phân trang)
  useEffect(() => {
    if (!user) return; // Guard: Chỉ đồng bộ khi người dùng đã đăng nhập thành công

    useAppStore.getState().setSyncStatus('SAVING');
    const qTestResults = query(ref(db, 'testResults'), orderByChild('createdAt'), limitToLast(testResultLimit));
    const unsubTestResults = onValue(qTestResults, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((child) => { list.push(child.val()); });
      useAppStore.getState().mergeTestResults(list);
      setTimeout(() => useAppStore.getState().setSyncStatus('IDLE'), 300);
    }, (error) => {
      console.error("Lỗi đồng bộ kết quả kiểm nghiệm từ Firebase:", error);
      useAppStore.getState().setSyncStatus('ERROR');
    });
    return () => unsubTestResults();
  }, [user, testResultLimit]);
};
