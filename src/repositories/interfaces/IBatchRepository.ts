/**
 * PQM REBUILD - BATCH REPOSITORY INTERFACE
 */

import { Batch, BatchReleaseStage, BatchReleaseGateProgress } from '../../types';
import { IRepository } from '../types';

export interface IBatchRepository extends IRepository<Batch> {
  findByBatchNo(batchNo: string): Promise<Batch | null>;
  findByProductId(productId: string): Promise<Batch[]>;
  findByStatus(status: Batch['status']): Promise<Batch[]>;
  findTestResultsByBatchId?(batchId: string): Promise<import('../../types').TestResult[]>;
  updateStatus(
    batchId: string,
    status: Batch['status'],
    reason?: string,
    metadata?: Partial<Batch> & { expectedVersion?: number }
  ): Promise<void>;
  updateProgress(batchId: string, progressPercent: number): Promise<void>;
  updateBprReview(
    batchId: string,
    bprReviewStatus: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
    metadata?: {
      bprReviewedAt?: string;
      bprReviewedBy?: string;
      bprReviewComment?: string;
      expectedVersion?: number;
    }
  ): Promise<Batch>;
  /**
   * Cập nhật tiến trình 7 Release Gates vào Firebase (atomic transaction với OCC).
   * Bảo vệ chống stale writes (không ghi đè Lô đã RELEASED) và tăng version nhất quán.
   */
  updateReleaseProgress(
    batchId: string,
    releaseStage: BatchReleaseStage,
    releaseGateProgress: BatchReleaseGateProgress,
    options?: { expectedVersion?: number }
  ): Promise<Batch>;
}
