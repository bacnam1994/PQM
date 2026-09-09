/**
 * PQM 3.0 - Batch Repository Interface
 */

import { Batch } from '../types';
import { IRepository } from './types';

export interface IBatchRepository extends IRepository<Batch> {
  findByBatchNo(batchNo: string): Promise<Batch | null>;
  findByProductId(productId: string): Promise<Batch[]>;
  findByStatus(status: Batch['status']): Promise<Batch[]>;
  updateStatus(batchId: string, status: Batch['status'], reason?: string): Promise<void>;
  updateProgress(batchId: string, progressPercent: number): Promise<void>;
}
