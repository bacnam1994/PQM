/**
 * PQM REBUILD - QUALITY DEVIATION REPOSITORY INTERFACE
 */

import { QualityDeviation, DeviationStatus } from '../../types/deviation';
import { IRepository } from '../types';

export interface IDeviationRepository extends IRepository<QualityDeviation> {
  findByBatchId(batchId: string): Promise<QualityDeviation[]>;
  updateStatus(id: string, status: DeviationStatus, notes?: string): Promise<void>;
}
