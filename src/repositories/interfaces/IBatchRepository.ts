/**
 * PQM REBUILD - BATCH REPOSITORY INTERFACE
 */

import { Batch, BatchReleaseStage, BatchReleaseGateProgress } from '../../types';
import { IRepository } from '../types';

export interface IBatchRepository extends IRepository<Batch> {
  findByBatchNo(batchNo: string): Promise<Batch | null>;
  findByProductId(productId: string): Promise<Batch[]>;
  findByStatus(status: Batch['status']): Promise<Batch[]>;
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
   * Cập nhật tiến trình 7 Release Gates vào Firebase (atomic update, không cần OCC).
   * Được gọi bởi BatchReleaseWorkflowSynchronizer sau mỗi sự kiện nghiệp vụ.
   */
  updateReleaseProgress(
    batchId: string,
    releaseStage: BatchReleaseStage,
    releaseGateProgress: BatchReleaseGateProgress
  ): Promise<void>;
}
