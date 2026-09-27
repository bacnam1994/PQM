/**
 * DEVIATION DOMAIN: READ QUERIES
 */

import { QualityDeviation, DeviationStatus } from '../../../types/deviation';
import type { IDeviationRepository } from '../../../repositories/interfaces/IDeviationRepository';
import { firebaseDeviationRepository } from '../../../repositories/firebase/FirebaseDeviationRepository';

export class DeviationQueries {
  constructor(private repo: IDeviationRepository = firebaseDeviationRepository as any) {}

  async getAll(): Promise<QualityDeviation[]> {
    return this.repo.findAll();
  }

  async getById(id: string): Promise<QualityDeviation | null> {
    return this.repo.findById(id);
  }

  async getByBatchId(batchId: string): Promise<QualityDeviation[]> {
    return this.repo.findByBatchId(batchId);
  }

  async getByStatus(status: DeviationStatus): Promise<QualityDeviation[]> {
    const all = await this.repo.findAll();
    return all.filter((dev) => dev.status === status);
  }

  async findPaginated(options?: any, filters?: any): Promise<any> {
    return (this.repo as any).findPaginated(options, filters);
  }
}

export const deviationQueries = new DeviationQueries();
