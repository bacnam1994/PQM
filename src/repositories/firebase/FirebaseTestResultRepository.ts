/**
 * PQM 3.0 & V4 Platform - Firebase Test Result Repository Implementation
 * Triển khai lưu trữ kết quả kiểm nghiệm trên Firebase Realtime Database có hỗ trợ Offline Queue
 * Kế thừa BaseFirebaseRepository: phân trang cursor/offset, lọc server-side & đếm số lượng.
 */

import { TestResult } from '../../types';
import { ITestResultRepository } from '../TestResultRepository';
import { deleteTestResultService } from '../../services/databaseService';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

export class FirebaseTestResultRepository
  extends BaseFirebaseRepository<TestResult>
  implements ITestResultRepository
{
  protected readonly collectionPath = 'testResults';

  protected override sanitizeItem(testResult: TestResult): any {
    // Bóc tách thuộc tính ảo 'batch' để không lưu trùng thừa vào DB
    const { batch: _virtualBatch, ...dataToSave } = testResult;
    return removeUndefined(dataToSave);
  }

  async findByBatchId(batchId: string): Promise<TestResult[]> {
    return this.findByRelation('batchId', batchId);
  }

  async findByOverallStatus(status: 'PASS' | 'FAIL'): Promise<TestResult[]> {
    return this.findByRelation('overallStatus', status);
  }

  async findRecent(limitCount: number): Promise<TestResult[]> {
    const result = await this.findPaginated({
      pageSize: limitCount,
      orderBy: 'testDate',
      orderDirection: 'desc'
    });
    return result.items;
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID phiếu kiểm nghiệm để xóa.');
    const targetPath = `${this.collectionPath}/${id}`;

    try {
      await deleteTestResultService(id);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'REMOVE' });
        return;
      }
      throw e;
    }
  }
}

export const testResultRepository = new FirebaseTestResultRepository();
