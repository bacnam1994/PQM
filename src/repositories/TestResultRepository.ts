/**
 * PQM 3.0 - Test Result Repository Interface
 */

import { TestResult } from '../types';
import { IRepository } from './types';

export interface ITestResultRepository extends IRepository<TestResult> {
  findByBatchId(batchId: string): Promise<TestResult[]>;
  findByOverallStatus(status: 'PASS' | 'FAIL'): Promise<TestResult[]>;
  findRecent(limit: number): Promise<TestResult[]>;
}
