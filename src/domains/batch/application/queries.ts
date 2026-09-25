/**
 * BATCH DOMAIN: QUERIES (READ-ONLY)
 */

import { Batch, IBatchRepository } from '../domain/types';
import { defaultBatchRepo } from '../infrastructure/repository';

export class BatchQueries {
  constructor(private repo: IBatchRepository = defaultBatchRepo) {}

  async getAll(): Promise<Batch[]> {
    return this.repo.findAll();
  }

  async getById(id: string): Promise<Batch | null> {
    return this.repo.findById(id);
  }

  async getByBatchNo(batchNo: string): Promise<Batch | null> {
    return this.repo.findByBatchNo(batchNo);
  }

  async getByProductId(productId: string): Promise<Batch[]> {
    return this.repo.findByProductId(productId);
  }

  async getByStatus(status: Batch['status']): Promise<Batch[]> {
    return this.repo.findByStatus(status);
  }
}

export const batchQueries = new BatchQueries();
