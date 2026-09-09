import { batchAppService } from '../../services/app/BatchAppService';
import { BatchSlice, StoreSlice } from './types';
import { Batch, ElectronicSignature } from '../../types';

export const createBatchSlice: StoreSlice<BatchSlice> = (set, get) => ({
  // --- INITIAL BATCH STATE ---
  batches: [],

  // --- BATCH ACTIONS ---
  addBatch: async (b: Batch) => {
    try {
      const state = get();
      await batchAppService.createBatch(b, state.user, state.batches, {
        activeTCCS: state.tccsList.find((t: any) => t.id === b.tccsId),
        tccsList: state.tccsList,
        productFormula: state.productFormulas.find((f: any) => f.productId === b.productId),
        productFormulas: state.productFormulas
      });
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
      await batchAppService.updateBatch(b, state.user, oldBatch);
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
      await batchAppService.deleteBatch(id, state.user, batch?.batchNo);
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
      const batchTestResults = state.testResults.filter((r: any) => r.batchId === id);
      await batchAppService.updateStatus(id, status as Batch['status'], state.user, {
        reason: rejectReason,
        currentBatch,
        batchTestResults,
        signature
      });
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({
        type: 'ERROR',
        title: 'Lỗi trạng thái lô',
        message: error.message || 'Không thể cập nhật trạng thái lô'
      });
      throw error;
    }
  },

  updateBatchProgress: async (id: string, progressPercent: number) => {
    try {
      await batchAppService.updateProgress(id, progressPercent, get().user);
    } catch (e: any) {
      console.error('Lỗi cập nhật tiến độ lô', e);
    }
  }
});
