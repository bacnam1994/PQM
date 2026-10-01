/**
 * BatchReleaseWorkflowSynchronizer.ts
 * =====================================
 * Đồng bộ hóa tiến trình 7 Release Gates vào Firebase sau mỗi sự kiện nghiệp vụ.
 *
 * NGUYÊN TẮC:
 * 1. Fire-and-forget (không block main workflow path) – lỗi tính toán progress
 *    KHÔNG được phép làm hỏng luồng nghiệp vụ chính.
 * 2. Idempotent: Có thể gọi nhiều lần cùng input → cùng kết quả.
 * 3. Non-blocking: Không chặn BPR_APPROVE, BATCH_RELEASE_APPROVE, v.v.
 * 4. UI chỉ đọc canonical state từ Batch.releaseStage và Batch.releaseGateProgress;
 *    không tự tính toán lại.
 * 5. BATCH_RELEASE_APPROVE là hành động duy nhất tạo ra RELEASED state.
 *    BatchReleaseWorkflowSynchronizer chỉ tính READY_TO_RELEASE.
 *
 * Sự kiện nghiệp vụ kích hoạt sync:
 * - Kết quả kiểm nghiệm thay đổi (testResult approved/rejected)
 * - Sai lệch / OOS đóng lại
 * - CAPA hoàn thành
 * - BPR_SUBMIT, BPR_START_REVIEW, BPR_APPROVE, BPR_REJECT
 * - BATCH_DISPATCH_TESTING (bắt đầu quy trình)
 * - BATCH_RELEASE_APPROVE thành công → Synchronizer set RELEASED
 */

import { Batch, TestResult, TCCS } from '../../types';
import { QualityDeviation as Deviation } from '../../types';
import { BatchReleaseProgressService } from './BatchReleaseProgressService';
import { IBatchRepository } from '../../repositories/BatchRepository';
import { DataFreshnessState } from './batchIntegrityValidator';

export interface SyncReleaseProgressParams {
  batchId: string;
  /** Dữ liệu Lô hiện tại (tránh fetch lại nếu caller đã có) */
  batch?: Batch;
  testResults?: TestResult[];
  deviations?: Deviation[];
  boundTccs?: TCCS | null;
  tccsList?: TCCS[];
  dataFreshness?: DataFreshnessState;
  /** Nếu true: Không throw khi lỗi, chỉ log (dùng cho fire-and-forget calls) */
  silent?: boolean;
}

export class BatchReleaseWorkflowSynchronizer {
  constructor(private repo: IBatchRepository) {}

  /**
   * Tính toán và đồng bộ tiến trình 7 Release Gates vào Firebase.
   *
   * Gọi sau mọi sự kiện nghiệp vụ có thể ảnh hưởng đến Gate progression.
   * Nếu silent=true, lỗi sẽ chỉ được log, không throw (fire-and-forget mode).
   *
   * @returns Promise<void> – không trả về gì để caller không phụ thuộc vào kết quả
   */
  async syncBatchReleaseProgress(params: SyncReleaseProgressParams): Promise<void> {
    const {
      batchId,
      batch: batchParam,
      testResults = [],
      deviations = [],
      boundTccs,
      tccsList = [],
      dataFreshness = {},
      silent = false,
    } = params;

    try {
      if (!batchId) {
        throw new Error('syncBatchReleaseProgress: batchId là bắt buộc.');
      }

      // Lấy dữ liệu Lô từ repository nếu caller không cung cấp
      let batch = batchParam;
      if (!batch) {
        const fetched = await this.repo.findById(batchId);
        if (!fetched) {
          throw new Error(`syncBatchReleaseProgress: Không tìm thấy Lô ${batchId}.`);
        }
        batch = fetched;
      }

      // Tính toán progress
      const progress = BatchReleaseProgressService.resolveReleaseProgress({
        batch,
        testResults,
        deviations,
        boundTccs,
        tccsList,
        dataFreshness,
      });

      // Persist lên Firebase (atomic update, không cần OCC)
      if (typeof this.repo.updateReleaseProgress === 'function') {
        await this.repo.updateReleaseProgress(
          batchId,
          progress.releaseStage,
          progress.releaseGateProgress
        );
      }
    } catch (err) {
      if (silent) {
        // Fire-and-forget: chỉ log, không throw
        console.warn(
          `[BatchReleaseWorkflowSynchronizer] Sync failed for batch ${batchId}:`,
          err instanceof Error ? err.message : err
        );
      } else {
        throw err;
      }
    }
  }

  /**
   * Fire-and-forget wrapper: gọi syncBatchReleaseProgress với silent=true.
   * Dùng sau các workflow actions (BPR_APPROVE, dispatchTesting, v.v.)
   * để không block luồng chính khi có lỗi kết nối Firebase.
   */
  syncSilently(params: Omit<SyncReleaseProgressParams, 'silent'>): void {
    this.syncBatchReleaseProgress({ ...params, silent: true }).catch((err) => {
      // Lỗi đã được handle bên trong syncBatchReleaseProgress với silent=true,
      // catch này chỉ để phòng ngừa unhandled promise rejection
      console.error('[BatchReleaseWorkflowSynchronizer] Unhandled sync error:', err);
    });
  }
}
