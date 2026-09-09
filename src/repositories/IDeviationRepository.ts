/**
 * PQM 3.0 - Quality Deviation Repository Interface
 */

import { QualityDeviation, DeviationStatus } from '../types/deviation';

export interface IDeviationRepository {
  findById(id: string): Promise<QualityDeviation | null>;
  findAll(): Promise<QualityDeviation[]>;
  findByBatchId(batchId: string): Promise<QualityDeviation[]>;
  save(deviation: QualityDeviation): Promise<void>;
  updateStatus(id: string, status: DeviationStatus, notes?: string): Promise<void>;
  delete(id: string): Promise<void>;
}
