import { batchAppService } from '../../services/app/BatchAppService';
import { queryClient } from '../../lib/queryClient';
import { BATCH_QUERY_KEYS, TEST_RESULT_QUERY_KEYS } from '../../constants/queryKeys';
import { BatchSlice, StoreSlice } from './types';
import { Batch, ElectronicSignature, TestResult } from '../../types';
import { resolveCurrentIdentity } from '../utils/storeHelpers';
import { testResultRepository } from '../../repositories/firebase/FirebaseTestResultRepository';

export const createBatchSlice: StoreSlice<BatchSlice> = (set, get) => ({
  // --- INITIAL BATCH STATE ---
  batches: [],

  // --- BATCH ACTIONS ---
  addBatch: async (b: Batch) => {
    try {
      const state = get();
      const currentUser = resolveCurrentIdentity(state);
      await batchAppService.createBatch(b, currentUser, state.batches, {
        activeTCCS: state.tccsList.find((t: any) => t.id === b.tccsId),
        tccsList: state.tccsList,
        productFormula: state.productFormulas.find((f: any) => f.productId === b.productId),
        productFormulas: state.productFormulas,
      });
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
      if (b.productId) {
        queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.byProduct(b.productId) });
      }
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu lô sản xuất', message: error.message });
      throw error;
    }
  },

  updateBatch: async (b: Batch) => {
    try {
      const state = get();
      const oldBatch = state.batches.find((item: Batch) => item.id === b.id);
      const currentUser = resolveCurrentIdentity(state);
      await batchAppService.updateBatch(b, currentUser, oldBatch);
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.detail(b.id) });
      if (b.productId) {
        queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.byProduct(b.productId) });
      }
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật lô sản xuất', message: error.message });
      throw error;
    }
  },

  deleteBatch: async (id: string) => {
    try {
      const state = get();
      const batch = state.batches.find((b: Batch) => b.id === id);
      const currentUser = resolveCurrentIdentity(state);
      await batchAppService.deleteBatch(id, currentUser, batch?.batchNo);
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa lô sản xuất', message: error.message });
      throw error;
    }
  },

  updateBatchStatus: async (
    id: string,
    status: string,
    rejectReason?: string,
    signature?: ElectronicSignature
  ) => {
    try {
      const state = get();
      const currentBatch = state.batches.find((b: Batch) => b.id === id);

      // Lấy dữ liệu an toàn thông qua TanStack Query Cache (hoặc Repository)
      let batchTestResults = queryClient.getQueryData<TestResult[]>(
        TEST_RESULT_QUERY_KEYS.byBatch(id)
      );
      if (!batchTestResults || batchTestResults.length === 0) {
        // Fallback tải trực tiếp từ DB nếu cache chưa có
        batchTestResults = await testResultRepository.findByRelation('batchId', id);
      }
      if ((!batchTestResults || batchTestResults.length === 0) && state.testResults?.length) {
        batchTestResults = state.testResults.filter((r: any) => r.batchId === id);
      }

      const currentUser = resolveCurrentIdentity(state);
      await batchAppService.updateStatus(id, status as Batch['status'], currentUser, {
        reason: rejectReason,
        currentBatch,
        batchTestResults,
        signature,
      });
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.detail(id) });
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({
        type: 'ERROR',
        title: 'Lỗi trạng thái lô',
        message: error.message || 'Không thể cập nhật trạng thái lô',
      });
      throw error;
    }
  },

  updateBatchProgress: async (id: string, progressPercent: number) => {
    try {
      await batchAppService.updateProgress(id, progressPercent, get().user);
      queryClient.invalidateQueries({ queryKey: BATCH_QUERY_KEYS.detail(id) });
    } catch (e: any) {
      console.error('Lỗi cập nhật tiến độ lô', e);
    }
  },
});
