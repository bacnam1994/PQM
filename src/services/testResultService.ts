import { ref, query, orderByChild, equalTo, get } from 'firebase/database';
import { db } from '../firebase';
import { TestResult } from '../types';
import { getFromCache } from '../utils/offlineCache';
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
        const { get: firebaseGet, ref: firebaseRef, query: firebaseQuery, orderByChild: fbOrderBy, equalTo: fbEqualTo } = await import('firebase/database');
        const { db: firebaseDb } = await import('../firebase');
        const batchQuery = firebaseQuery(firebaseRef(firebaseDb, 'batches'), fbOrderBy('productId'), fbEqualTo(productId));
        const snap = await firebaseGet(batchQuery);
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
        const { get: firebaseGet, ref: firebaseRef, query: firebaseQuery, orderByChild: fbOrderBy, equalTo: fbEqualTo } = await import('firebase/database');
        const { db: firebaseDb } = await import('../firebase');

        // Nếu chỉ vài lô bị thiếu → fetch từng lô riêng lẻ
        if (missingBatchIds.length <= 5) {
          const results = await Promise.all(
            missingBatchIds.map(async bId => {
              try {
                const q = firebaseQuery(firebaseRef(firebaseDb, 'testResults'), fbOrderBy('batchId'), fbEqualTo(bId));
                const snap = await firebaseGet(q);
                return snap.exists() ? (Object.values(snap.val()) as TestResult[]) : [];
              } catch (e) { return []; }
            })
          );
          fromFirebase = results.flat();
        } else {
          // Nhiều lô thiếu → quét toàn bộ testResults một lần duy nhất (hiệu quả hơn N queries)
          const snap = await firebaseGet(firebaseRef(firebaseDb, 'testResults'));
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