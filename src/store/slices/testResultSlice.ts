import { ref, get as firebaseGet } from 'firebase/database';
import { db } from '../../firebase';
import { testResultAppService } from '../../services/app/TestResultAppService';
import { TestResultSlice, StoreSlice } from './types';
import { TestResult } from '../../types';

export const createTestResultSlice: StoreSlice<TestResultSlice> = (set, get) => ({
  // --- INITIAL TEST RESULT STATE ---
  testResults: [],
  allTestResults: [],
  testResultLimit: 50,

  // --- TEST RESULT ACTIONS ---
  addTestResult: async (r: TestResult) => {
    try {
      const state = get();
      const batch = state.batches.find((b: any) => b.id === r.batchId);
      await testResultAppService.createTestResult(r, state.user, { batch });
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu phiếu kiểm nghiệm', message: error.message });
      throw error;
    }
  },

  updateTestResult: async (r: TestResult) => {
    try {
      const state = get();
      const oldResult = state.testResults.find((item: TestResult) => item.id === r.id);
      await testResultAppService.updateTestResult(r, state.user, oldResult);
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật phiếu kiểm nghiệm', message: error.message });
      throw error;
    }
  },

  deleteTestResult: async (id: string) => {
    try {
      const state = get();
      const oldResult = state.testResults.find((item: TestResult) => item.id === id);
      await testResultAppService.deleteTestResult(id, state.user, oldResult);
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa phiếu kiểm nghiệm', message: error.message });
      throw error;
    }
  },

  loadMoreTestResults: () =>
    set(
      (state) => ({ testResultLimit: state.testResultLimit + 50 }),
      false,
      'loadMoreTestResults'
    ),

  mergeTestResults: (list: TestResult[]) =>
    set(
      (state) => {
        const map = new Map(state.testResults.map((item: TestResult) => [item.id, item]));
        list.forEach((item) => map.set(item.id, item));
        const merged = Array.from(map.values());
        merged.sort((a, b) => b.testDate.localeCompare(a.testDate));
        return { testResults: merged };
      },
      false,
      'mergeTestResults'
    ),

  fetchAllTestResultsForDashboard: async () => {
    try {
      const state = get();
      // Nếu đã có dữ liệu và vừa tải trong vòng 60 giây, không cần fetch lại
      if (
        state.allTestResults &&
        state.allTestResults.length > 0 &&
        (state as any)._lastFetchTestResultsTime &&
        Date.now() - (state as any)._lastFetchTestResultsTime < 60000
      ) {
        return;
      }
      const snapshot = await firebaseGet(ref(db, 'testResults'));
      if (snapshot.exists()) {
        const list = Object.values(snapshot.val()) as TestResult[];
        set(
          {
            allTestResults: list,
            _lastFetchTestResultsTime: Date.now()
          } as any,
          false,
          'fetchAllTestResultsForDashboard'
        );
      }
    } catch (e) {
      console.error('Lỗi tải toàn bộ dữ liệu cho Dashboard:', e);
    }
  }
});
