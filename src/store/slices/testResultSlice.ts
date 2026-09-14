import { testResultRepository } from '../../repositories/firebase/FirebaseTestResultRepository';
import { testResultAppService } from '../../services/app/TestResultAppService';
import { queryClient } from '../../lib/queryClient';
import { TEST_RESULT_QUERY_KEYS } from '../../constants/queryKeys';
import { TestResultSlice, StoreSlice } from './types';
import { TestResult } from '../../types';
import { resolveCurrentIdentity } from '../utils/storeHelpers';

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
      const currentUser = resolveCurrentIdentity(state);
      await testResultAppService.createTestResult(r, currentUser, { batch });
      queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.all });
      if (r.batchId) {
        queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.byBatch(r.batchId) });
      }
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
      const currentUser = resolveCurrentIdentity(state);
      await testResultAppService.updateTestResult(r, currentUser, oldResult);
      queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.detail(r.id) });
      if (r.batchId) {
        queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.byBatch(r.batchId) });
      }
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({
        type: 'ERROR',
        title: 'Lỗi cập nhật phiếu kiểm nghiệm',
        message: error.message,
      });
      throw error;
    }
  },

  deleteTestResult: async (id: string) => {
    try {
      const state = get();
      const oldResult = state.testResults.find((item: TestResult) => item.id === id);
      const currentUser = resolveCurrentIdentity(state);
      await testResultAppService.deleteTestResult(id, currentUser, oldResult);
      queryClient.invalidateQueries({ queryKey: TEST_RESULT_QUERY_KEYS.all });
      if (oldResult?.batchId) {
        queryClient.invalidateQueries({
          queryKey: TEST_RESULT_QUERY_KEYS.byBatch(oldResult.batchId),
        });
      }
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa phiếu kiểm nghiệm', message: error.message });
      throw error;
    }
  },

  loadMoreTestResults: () =>
    set((state) => ({ testResultLimit: state.testResultLimit + 50 }), false, 'loadMoreTestResults'),

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
      const list = await testResultRepository.findRecent(200);
      queryClient.setQueryData(TEST_RESULT_QUERY_KEYS.all, list);
      set(
        {
          allTestResults: list,
          _lastFetchTestResultsTime: Date.now(),
        } as any,
        false,
        'fetchAllTestResultsForDashboard'
      );
    } catch (e) {
      console.error('Lỗi tải toàn bộ dữ liệu cho Dashboard:', e);
    }
  },
});
