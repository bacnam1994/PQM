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