/**
 * TEST RESULT DOMAIN: READ QUERIES
 */

import { TestResult } from '../../../types';
import type { ITestResultRepository } from '../../../repositories/interfaces/ITestResultRepository';
import { testResultRepository as defaultRepo } from '../../../repositories/firebase/FirebaseTestResultRepository';

export class TestResultQueries {
  constructor(private repo: ITestResultRepository = defaultRepo as any) {}

  async getAll(): Promise<TestResult[]> {
    return this.repo.findAll();
  }

  async getById(id: string): Promise<TestResult | null> {
    return this.repo.findById(id);
  }

  async getByBatchId(batchId: string): Promise<TestResult[]> {
    return this.repo.findByBatchId(batchId);
  }

  async getByTCCSId(tccsId: string): Promise<TestResult[]> {
    if (this.repo.findByTCCSId) {
      return this.repo.findByTCCSId(tccsId);
    }
    const all = await this.repo.findAll();
    return all.filter((tr) => tr.tccsId === tccsId);
  }

  async findRecent(limitCount: number = 20): Promise<TestResult[]> {
    if ((this.repo as any).findRecent) {
      return (this.repo as any).findRecent(limitCount);
    }
    const all = await this.repo.findAll();
    return all
      .sort((a, b) => new Date(b.testDate || 0).getTime() - new Date(a.testDate || 0).getTime())
      .slice(0, limitCount);
  }
}

export const testResultQueries = new TestResultQueries();
