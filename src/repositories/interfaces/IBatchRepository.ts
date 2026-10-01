/**
 * PQM REBUILD - BATCH REPOSITORY INTERFACE
 */

import { Batch } from '../../types';
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
}
