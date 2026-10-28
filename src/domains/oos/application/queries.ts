/**
 * OOS DOMAIN: READ QUERIES
 */

import { QualityDeviation } from '../../../types/deviation';
import type { IDeviationRepository } from '../../../repositories/interfaces/IDeviationRepository';
import { firebaseDeviationRepository } from '../../../repositories/firebase/FirebaseDeviationRepository';

export class OOSQueries {
  constructor(private repo: IDeviationRepository = firebaseDeviationRepository as any) {}

  /**
   * Lấy toàn bộ các hồ sơ điều tra OOS
   */
  async getAllOOS(): Promise<QualityDeviation[]> {
    const all = await this.repo.findAll();
    return all.filter((item) => item.source === 'OOS_TEST_RESULT');
  }

  /**
   * Lấy hồ sơ OOS theo ID
   */
  async getOOSById(id: string): Promise<QualityDeviation | null> {
    const dev = await this.repo.findById(id);
    if (dev && dev.source === 'OOS_TEST_RESULT') {
      return dev;
    }
    return null;
  }

  /**
   * Lấy các hồ sơ OOS gắn với một Lô sản xuất
   */
  async getOOSByBatchId(batchId: string): Promise<QualityDeviation[]> {
    const byBatch = await this.repo.findByBatchId(batchId);
    return byBatch.filter((item) => item.source === 'OOS_TEST_RESULT');
  }
}

export const oosQueries = new OOSQueries();
