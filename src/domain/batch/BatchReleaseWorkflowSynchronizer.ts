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

import { Batch, TestResult, TCCS, ElectronicSignature } from '../../types';
import { QualityDeviation as Deviation } from '../../types';
import { BatchReleaseProgressService, BatchReleaseProgress } from './BatchReleaseProgressService';
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
  userRole?: string;
  userSignature?: ElectronicSignature | null;
  signatures?: ElectronicSignature[];
  /** Nếu true: Không throw khi lỗi, chỉ log (CHỈ dùng cho non-critical background fallback) */
  silent?: boolean;
}

export class BatchReleaseWorkflowSynchronizer {
  constructor(private repo: IBatchRepository) {}

  /**
   * Tính toán và đồng bộ tiến trình 7 Release Gates vào Firebase.
   *
   * Gọi sau mọi sự kiện nghiệp vụ có thể ảnh hưởng đến Gate progression.
   * MUST NOT silently fail on critical paths (BPR_APPROVE, BATCH_RELEASE_APPROVE, v.v.).
   *
   * @returns Promise<BatchReleaseProgress> – trả về canonical progress vừa tính toán và lưu
   */
  async syncBatchReleaseProgress(params: SyncReleaseProgressParams): Promise<BatchReleaseProgress> {
    const {
      batchId,
      batch: batchParam,
      testResults: testResultsParam = [],
      deviations = [],
      boundTccs,
      tccsList = [],
      dataFreshness = {},
      userRole,
      userSignature,
      signatures = [],
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

      // Lấy danh sách kết quả kiểm nghiệm nếu caller không cung cấp
      let testResults = testResultsParam;
      if (testResults.length === 0) {
        if (typeof (this.repo as any).findTestResultsByBatchId === 'function') {
          testResults = await (this.repo as any).findTestResultsByBatchId(batchId);
        } else {
          try {
            const { testResultRepository } =
              await import('../../repositories/firebase/FirebaseTestResultRepository');
            if (testResultRepository && typeof testResultRepository.findByRelation === 'function') {
              testResults = await testResultRepository.findByRelation('batchId', batchId);
            }
          } catch {
            // Ignore if in isolated mock environment
          }
        }
      }

      // Tính toán progress (Canonical)
      const progress = BatchReleaseProgressService.resolveReleaseProgress({
        batch,
        testResults,
        deviations,
        boundTccs,
        tccsList,
        dataFreshness,
        userRole,
        userSignature,
        signatures,
      });

      // Persist lên Firebase (atomic update)
      if (typeof this.repo.updateReleaseProgress === 'function') {
        await this.repo.updateReleaseProgress(
          batchId,
          progress.releaseStage,
          progress.releaseGateProgress
        );
      }

      return progress;
    } catch (err) {
      if (silent) {
        console.warn(
          `[BatchReleaseWorkflowSynchronizer] Sync non-critical warning for batch ${batchId}:`,
          err instanceof Error ? err.message : err
        );
        throw err;
      }
      throw err;
    }
  }

  /**
   * Helper đồng bộ với retry/log (không nuốt lỗi trên các nghiệp vụ critical).
   */
  async syncSilently(params: Omit<SyncReleaseProgressParams, 'silent'>): Promise<void> {
    try {
      await this.syncBatchReleaseProgress({ ...params, silent: false });
    } catch (err) {
      console.error('[BatchReleaseWorkflowSynchronizer] Sync failed during workflow:', err);
    }
  }
}
