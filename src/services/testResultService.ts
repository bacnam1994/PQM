import { ref, query, orderByChild, equalTo, get, update } from 'firebase/database';
import { db } from '../firebase';
import { TestResult } from '../types';
import { getFromCache, saveToCache } from '../utils/offlineCache';
import { useAppStore } from '../store/useAppStore';

/**
 * Lấy toàn bộ lịch sử kiểm nghiệm của riêng 1 lô hàng từ Store, Firebase và IndexedDB
 * Bơm dữ liệu vào Global Store để các component khác tự động nhận diện
 * @param targetBatchId ID của lô hàng cần tra cứu (ID đầy đủ hoặc suffix)
 * @returns Mảng các phiếu kiểm nghiệm (TestResult[]) được sắp xếp mới nhất lên đầu
 */
export const fetchTestResultsByBatchId = async (targetBatchId: string): Promise<TestResult[]> => {
  if (!targetBatchId) return [];

  try {
    let fbResults: TestResult[] = [];
    let localResults: TestResult[] = [];

    // 1. Fetch từ Firebase
    try {
      const testResultsRef = ref(db, 'testResults');
      const batchQuery = query(testResultsRef, orderByChild('batchId'), equalTo(targetBatchId));
      const snapshot = await get(batchQuery);
      if (snapshot.exists()) {
        fbResults = Object.values(snapshot.val()) as TestResult[];
      }
    } catch (error) {
      console.warn("Lỗi khi tải PKN từ Database (thử fallback quét):", error);
      // Fallback: nếu query bị lỗi do thiếu index, thử lấy tất cả và lọc
      try {
        const allSnap = await get(ref(db, 'testResults'));
        if (allSnap.exists()) {
          const all = Object.values(allSnap.val()) as TestResult[];
          fbResults = all.filter(r => r && (r.batchId === targetBatchId || r.batchId?.endsWith(targetBatchId)));
        }
      } catch (fallbackErr) {
        console.warn("Fallback fetch all testResults failed:", fallbackErr);
      }
    }

    // 2. Fetch từ IndexedDB (dành cho các lô cũ, chưa đồng bộ hoặc từ file backup)
    try {
      const cached = await getFromCache('testResults');
      if (cached && Array.isArray(cached)) {
        localResults = cached.filter((r: any) => r && (r.batchId === targetBatchId || r.batchId?.endsWith(targetBatchId)));
      }
    } catch (error) { console.warn("Lỗi khi tải PKN từ Cache:", error); }

    // 3. Lấy từ Global Store hiện có
    const appState = useAppStore.getState();
    const storeResults = [
      ...(appState.allTestResults || []),
      ...(appState.testResults || [])
    ].filter(r => r && (r.batchId === targetBatchId || r.batchId?.endsWith(targetBatchId)));

    // 4. Gộp dữ liệu (ưu tiên DB nếu trùng ID)
    const merged = new Map<string, TestResult>();
    [...storeResults, ...localResults, ...fbResults].forEach(r => {
      if (r && r.id) merged.set(r.id, r);
    });
    const finalResults = Array.from(merged.values());

    // Bơm dữ liệu vào Global Store để các component khác (như trang Chi tiết lô) tự động nhận diện
    const mergeTestResults = appState.mergeTestResults;
    if (mergeTestResults && finalResults.length > 0) {
      mergeTestResults(finalResults);
    }
    
    return finalResults.sort((a, b) => 
      new Date(b.testDate || 0).getTime() - new Date(a.testDate || 0).getTime()
    );
  } catch (error) {
    console.error(`Lỗi tổng hợp lịch sử PKN cho lô ${targetBatchId}:`, error);
    return [];
  }
};

/**
 * Lấy một phiếu kiểm nghiệm cụ thể bằng ID đầy đủ hoặc suffix 6 ký tự cuối.
 * Dùng làm fallback cho TestResultFormPage và CoAReportPage khi mở ở tab mới hoặc store chưa được load.
 * @param idOrSuffix ID đầy đủ hoặc 6 ký tự cuối của phiếu
 * @returns TestResult hoặc null nếu không tìm thấy
 */
export const fetchTestResultById = async (idOrSuffix: string): Promise<TestResult | null> => {
  if (!idOrSuffix) return null;

  // 1. Thử tìm trong Global Store trước (nhanh nhất)
  const appState = useAppStore.getState();
  const allStoreResults = [
    ...(appState.allTestResults || []),
    ...(appState.testResults || [])
  ];
  const foundInStore = allStoreResults.find(r => r && (r.id === idOrSuffix || r.id.endsWith(idOrSuffix)));
  if (foundInStore) return foundInStore;

  // 2. Thử tìm trong IndexedDB cache trước (nhanh, offline-first)
  try {
    const cached = await getFromCache('testResults');
    if (cached && Array.isArray(cached)) {
      const found = cached.find((r: any) =>
        r && (r.id === idOrSuffix || r.id.endsWith(idOrSuffix))
      );
      if (found) {
        if (appState.mergeTestResults) appState.mergeTestResults([found]);
        return found as TestResult;
      }
    }
  } catch (e) { console.warn('Cache lookup failed:', e); }

  // 3. Fallback: Fetch từ Firebase
  try {
    // 3.1 Thử fetch trực tiếp theo ID đầy đủ trước (nhanh nhất)
    const directSnap = await get(ref(db, `testResults/${idOrSuffix}`));
    if (directSnap.exists()) {
      const found = directSnap.val() as TestResult;
      const mergeTestResults = useAppStore.getState().mergeTestResults;
      if (mergeTestResults) mergeTestResults([found]);
      return found;
    }

    // 3.2 Nếu không tìm thấy hoặc idOrSuffix là suffix, fetch toàn bộ danh sách để tìm
    const snapshot = await get(ref(db, 'testResults'));
    if (snapshot.exists()) {
      const all = Object.values(snapshot.val()) as TestResult[];
      const found = all.find(r => r && (r.id === idOrSuffix || r.id.endsWith(idOrSuffix)));
      if (found) {
        // Bơm vào store để các lần sau không cần fetch lại
        const mergeTestResults = useAppStore.getState().mergeTestResults;
        if (mergeTestResults) mergeTestResults([found]);
        return found;
      }
    }
  } catch (e) { console.error('Firebase lookup failed:', e); }

  return null;
};

/**
 * Lấy TOÀN BỘ lịch sử kiểm nghiệm của một sản phẩm (bất kể giới hạn 50 phiếu trong store).
 * Dùng cho trang Chi tiết Sản phẩm (tab Lịch sử & Biến động Chất lượng).
 * Chiến lược: Lấy toàn bộ lô hàng của sản phẩm → fetch kết quả kiểm nghiệm cho từng lô.
 * @param productId ID của sản phẩm cần xem
 * @returns Mảng đầy đủ TestResult[], sắp xếp mới nhất lên đầu
 */
export const fetchTestResultsByProductId = async (productId: string): Promise<TestResult[]> => {
  if (!productId) return [];

  try {
    // 1. Lấy danh sách lô hàng thuộc sản phẩm từ store và Firebase
    const appState = useAppStore.getState();
    let productBatches = appState.batches.filter(b => b.productId === productId);

    // Nếu store chưa có đủ dữ liệu, fetch toàn bộ lô từ Firebase và lọc
    if (productBatches.length === 0) {
      try {
        const batchQuery = query(ref(db, 'batches'), orderByChild('productId'), equalTo(productId));
        const snap = await get(batchQuery);
        if (snap.exists()) {
          productBatches = Object.values(snap.val()) as any[];
        }
      } catch (e) {
        // Fallback: Lấy từ store không filter
        console.warn('Lỗi tìm lô theo productId từ Firebase:', e);
      }
    }

    if (productBatches.length === 0) return [];

    const batchIds = productBatches.map(b => b.id);

    // 2. Tra cứu kết quả kiểm nghiệm có sẵn trong store và cache trước (không cần fetch riêng lẻ)
    const allAvailableResults = [
      ...(appState.allTestResults || []),
      ...(appState.testResults || []),
    ];

    const batchIdSet = new Set(batchIds);
    const fromStore = allAvailableResults.filter(r => r && batchIdSet.has(r.batchId));

    // Kiểm tra các lô chưa có dữ liệu kiểm nghiệm trong store
    const batchIdsInStore = new Set(fromStore.map(r => r.batchId));
    const missingBatchIds = batchIds.filter(id => !batchIdsInStore.has(id));

    // 3. Fetch các lô còn thiếu từ Firebase
    let fromFirebase: TestResult[] = [];
    if (missingBatchIds.length > 0) {
      try {
        // Nếu chỉ vài lô bị thiếu → fetch từng lô riêng lẻ
        if (missingBatchIds.length <= 5) {
          const results = await Promise.all(
            missingBatchIds.map(async bId => {
              try {
                const q = query(ref(db, 'testResults'), orderByChild('batchId'), equalTo(bId));
                const snap = await get(q);
                return snap.exists() ? (Object.values(snap.val()) as TestResult[]) : [];
              } catch (e) { return []; }
            })
          );
          fromFirebase = results.flat();
        } else {
          // Nhiều lô thiếu → quét toàn bộ testResults một lần duy nhất (hiệu quả hơn N queries)
          const snap = await get(ref(db, 'testResults'));
          if (snap.exists()) {
            const all = Object.values(snap.val()) as TestResult[];
            fromFirebase = all.filter(r => r && batchIdSet.has(r.batchId));
          }
        }
      } catch (e) {
        console.warn('Lỗi fetch testResults cho sản phẩm từ Firebase:', e);
      }
    }

    // 4. Gộp và loại trùng
    const merged = new Map<string, TestResult>();
    [...fromStore, ...fromFirebase].forEach(r => {
      if (r && r.id) merged.set(r.id, r);
    });

    const finalResults = Array.from(merged.values());

    // Bơm dữ liệu mới vào store
    if (fromFirebase.length > 0 && appState.mergeTestResults) {
      appState.mergeTestResults(finalResults);
    }

    return finalResults.sort((a, b) =>
      new Date(b.testDate || 0).getTime() - new Date(a.testDate || 0).getTime()
    );
  } catch (error) {
    console.error(`Lỗi tải toàn bộ lịch sử kiểm nghiệm cho sản phẩm ${productId}:`, error);
    return [];
  }
};

/**
 * Lấy TOÀN BỘ danh sách phiếu kiểm nghiệm từ Firebase RTDB (fallback cache & store)
 */
export const fetchAllTestResultsRaw = async (): Promise<TestResult[]> => {
  try {
    const snapshot = await get(ref(db, 'testResults'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.values(data) as TestResult[];
    }
  } catch (err) {
    console.warn('[testResultService] Không thể fetch testResults từ Firebase, thử cache:', err);
  }

  // Fallback: IndexedDB cache
  try {
    const cached = await getFromCache('testResults');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached as TestResult[];
    }
  } catch (err) {
    console.warn('[testResultService] Fallback cache testResults thất bại:', err);
  }

  // Fallback: Global store
  const state = useAppStore.getState();
  return [
    ...(state.allTestResults || []),
    ...(state.testResults || [])
  ];
};

/**
 * Đổi tên chỉ tiêu trên 100% phiếu kiểm nghiệm trong toàn bộ cơ sở dữ liệu (Atomic Multi-path Update).
 * Đảm bảo mọi phiếu cũ và mới đều được đổi tên đồng bộ.
 * 
 * @param oldName Tên chỉ tiêu cũ cần đổi
 * @param newName Tên chỉ tiêu mới
 * @param targetProductId (Tùy chọn) Chỉ áp dụng cho các lô thuộc 1 sản phẩm cụ thể
 * @returns { updatedCount: number; totalScanned: number }
 */
export const bulkRenameCriteriaInAllTestResults = async (
  oldName: string,
  newName: string,
  targetProductId?: string
): Promise<{ updatedCount: number; totalScanned: number }> => {
  const normOld = (oldName || '').trim().toLowerCase();
  const targetName = (newName || '').trim();
  if (!normOld || !targetName || normOld === targetName.toLowerCase()) {
    return { updatedCount: 0, totalScanned: 0 };
  }

  // 1. Quét toàn bộ phiếu kiểm nghiệm từ Database
  const allResults = await fetchAllTestResultsRaw();
  if (allResults.length === 0) return { updatedCount: 0, totalScanned: 0 };

  // 2. Lấy danh sách lô để lọc theo targetProductId nếu có chỉ định phạm vi
  let validBatchIdSet: Set<string> | null = null;
  if (targetProductId) {
    const appState = useAppStore.getState();
    let allBatches = appState.batches;
    if (!allBatches || allBatches.length === 0) {
      try {
        const snap = await get(ref(db, 'batches'));
        if (snap.exists()) allBatches = Object.values(snap.val()) as any[];
      } catch (e) {
        console.warn('[bulkRename] Lỗi lấy danh sách lô:', e);
      }
    }
    const filtered = (allBatches || []).filter(b => b && b.productId === targetProductId);
    validBatchIdSet = new Set(filtered.map(b => b.id));
  }

  // 3. Tìm các phiếu có chỉ tiêu cần đổi
  const updates: Record<string, any> = {};
  const modifiedResults: TestResult[] = [];
  const now = new Date().toISOString();

  allResults.forEach(result => {
    if (!result || !result.id) return;

    // Lọc theo sản phẩm nếu có
    if (validBatchIdSet) {
      const bId = result.batchId || (result as any).batch?.id;
      if (!bId || !validBatchIdSet.has(bId)) return;
    }

    let hasChange = false;
    const newEntries = (result.results || []).map(entry => {
      if (entry && entry.criteriaName && entry.criteriaName.trim().toLowerCase() === normOld) {
        hasChange = true;
        return { ...entry, criteriaName: targetName };
      }
      return entry;
    });

    if (hasChange) {
      const updatedResult: TestResult = {
        ...result,
        results: newEntries,
        updatedAt: now
      };
      updates[`testResults/${result.id}/results`] = newEntries;
      updates[`testResults/${result.id}/updatedAt`] = now;
      modifiedResults.push(updatedResult);
    }
  });

  const updatedCount = modifiedResults.length;

  // 4. Thực hiện Atomic Multi-path Update lên Firebase
  if (updatedCount > 0) {
    await update(ref(db), updates);

    // Cập nhật State trong Store
    const appState = useAppStore.getState();
    if (appState.mergeTestResults) {
      appState.mergeTestResults(modifiedResults);
    }
    if (appState.allTestResults && appState.allTestResults.length > 0) {
      const modifiedMap = new Map(modifiedResults.map(r => [r.id, r]));
      const newAll = appState.allTestResults.map(r => modifiedMap.get(r.id) || r);
      useAppStore.setState({ allTestResults: newAll });
    }

    // Cập nhật IndexedDB Cache
    try {
      const cached = await getFromCache('testResults');
      if (cached && Array.isArray(cached)) {
        const modifiedMap = new Map(modifiedResults.map(r => [r.id, r]));
        const newCached = cached.map((r: any) => modifiedMap.get(r.id) || r);
        await saveToCache('testResults', newCached);
      }
    } catch (e) {
      console.warn('[bulkRename] Lỗi cập nhật cache IndexedDB:', e);
    }
  }

  return { updatedCount, totalScanned: allResults.length };
};
