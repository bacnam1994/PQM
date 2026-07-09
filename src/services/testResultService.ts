import { ref, query, orderByChild, equalTo, get } from 'firebase/database';
import { db } from '../firebase';
import { TestResult } from '../types';
import { getFromCache } from '../utils/offlineCache';
import { useAppStore } from '../store/useAppStore';

/**
 * Lấy toàn bộ lịch sử kiểm nghiệm của riêng 1 lô hàng từ Firebase và IndexedDB
 * Bơm dữ liệu vào Global Store để các component khác tự động nhận diện
 * @param targetBatchId ID của lô hàng cần tra cứu
 * @returns Mảng các phiếu kiểm nghiệm (TestResult[]) được sắp xếp mới nhất lên đầu
 */
export const fetchTestResultsByBatchId = async (targetBatchId: string): Promise<TestResult[]> => {
  if (!targetBatchId) return [];

  try {
    let fbResults: TestResult[] = [];
    let localResults: TestResult[] = [];

    // 1. Fetch từ Firebase (dành cho dữ liệu mới, đã đồng bộ)
    try {
      const testResultsRef = ref(db, 'testResults');
      const batchQuery = query(testResultsRef, orderByChild('batchId'), equalTo(targetBatchId));
      const snapshot = await get(batchQuery);
      if (snapshot.exists()) {
        fbResults = Object.values(snapshot.val()) as TestResult[];
      }
    } catch (error) { console.warn("Lỗi khi tải PKN từ Database:", error); }

    // 2. Fetch từ IndexedDB (dành cho các lô cũ, chưa đồng bộ hoặc từ file backup)
    try {
      const cached = await getFromCache('testResults');
      if (cached && Array.isArray(cached)) {
        localResults = cached.filter((r: any) => r.batchId === targetBatchId);
      }
    } catch (error) { console.warn("Lỗi khi tải PKN từ Cache:", error); }

    // 3. Gộp dữ liệu (ưu tiên DB nếu trùng ID)
    const merged = new Map<string, TestResult>();
    [...localResults, ...fbResults].forEach(r => merged.set(r.id, r));
    const finalResults = Array.from(merged.values());

    // Bơm dữ liệu vào Global Store để các component khác (như trang Chi tiết lô) tự động nhận diện
    const mergeTestResults = useAppStore.getState().mergeTestResults;
    if (mergeTestResults && finalResults.length > 0) {
      mergeTestResults(finalResults);
    }
    
    return finalResults.sort((a, b) => 
      new Date(b.testDate).getTime() - new Date(a.testDate).getTime()
    );
  } catch (error) {
    console.error(`Lỗi tổng hợp lịch sử PKN cho lô ${targetBatchId}:`, error);
    return [];
  }
};

/**
 * Lấy một phiếu kiểm nghiệm cụ thể bằng ID đầy đủ hoặc suffix 6 ký tự cuối.
 * Dùng làm fallback cho CoAReportPage khi mở ở tab mới và store chưa được load.
 * @param idOrSuffix ID đầy đủ hoặc 6 ký tự cuối của phiếu
 * @returns TestResult hoặc null nếu không tìm thấy
 */
export const fetchTestResultById = async (idOrSuffix: string): Promise<TestResult | null> => {
  if (!idOrSuffix) return null;

  // 1. Thử tìm trong IndexedDB cache trước (nhanh, offline-first)
  try {
    const cached = await getFromCache('testResults');
    if (cached && Array.isArray(cached)) {
      const found = cached.find((r: any) =>
        r.id === idOrSuffix || r.id.endsWith(idOrSuffix)
      );
      if (found) return found as TestResult;
    }
  } catch (e) { console.warn('Cache lookup failed:', e); }

  // 2. Fallback: Fetch từ Firebase
  try {
    // 2.1 Thử fetch trực tiếp theo ID đầy đủ trước (nhanh nhất)
    const directSnap = await get(ref(db, `testResults/${idOrSuffix}`));
    if (directSnap.exists()) {
      const found = directSnap.val() as TestResult;
      const mergeTestResults = useAppStore.getState().mergeTestResults;
      if (mergeTestResults) mergeTestResults([found]);
      return found;
    }

    // 2.2 Nếu không tìm thấy và idOrSuffix có vẻ là suffix, fetch toàn bộ danh sách để tìm
    const snapshot = await get(ref(db, 'testResults'));
    if (snapshot.exists()) {
      const all = Object.values(snapshot.val()) as TestResult[];
      const found = all.find(r => r.id === idOrSuffix || r.id.endsWith(idOrSuffix));
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