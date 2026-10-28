/**
 * PQM REBUILD - TEST RESULT REPOSITORY INTERFACE
 */

import { TestResult } from '../../types';
import { IRepository } from '../types';

export interface ITestResultRepository extends IRepository<TestResult> {
  findByBatchId(batchId: string): Promise<TestResult[]>;
  findByTCCSId?(tccsId: string): Promise<TestResult[]>;
  findByOverallStatus?(status: 'PASS' | 'FAIL'): Promise<TestResult[]>;
  findRecent?(limit: number): Promise<TestResult[]>;
  updateStatus?(id: string, status: TestResult['status'], reason?: string): Promise<void>;
}
