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

  async findRecent(limit: number): Promise<Batch[]> {
    if ((this.repo as any).findRecent) {
      return (this.repo as any).findRecent(limit);
    }
    const all = await this.repo.findAll();
    return all.slice(0, limit);
  }

  async findPaginated(options?: any, filters?: any): Promise<any> {
    return this.repo.findPaginated(options, filters);
  }
}

export const batchQueries = new BatchQueries();
