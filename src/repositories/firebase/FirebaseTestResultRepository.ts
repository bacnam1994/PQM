/**
 * PQM 3.0 - Firebase Test Result Repository Implementation
 * Triển khai lưu trữ kết quả kiểm nghiệm trên Firebase Realtime Database có hỗ trợ Offline Queue
 * Lưu ý: Tự động loại bỏ trường ảo 'batch' trước khi ghi để bảo toàn tính toàn vẹn dữ liệu.
 */

import { ref, get, set } from 'firebase/database';
import { db } from '../../firebase';
import { TestResult } from '../../types';
import { ITestResultRepository } from '../TestResultRepository';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';
import { deleteTestResultService } from '../../services/databaseService';

export class FirebaseTestResultRepository implements ITestResultRepository {
  private readonly collectionPath = 'testResults';

  async findById(id: string): Promise<TestResult | null> {
    const snapshot = await get(ref(db, `${this.collectionPath}/${id}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as TestResult;
  }

  async findAll(): Promise<TestResult[]> {
    const snapshot = await get(ref(db, this.collectionPath));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    return Object.values(val) as TestResult[];
  }

  async findByBatchId(batchId: string): Promise<TestResult[]> {
    const all = await this.findAll();
    return all.filter(r => r.batchId === batchId);
  }

  async findByOverallStatus(status: 'PASS' | 'FAIL'): Promise<TestResult[]> {
    const all = await this.findAll();
    return all.filter(r => r.overallStatus === status);
  }

  async findRecent(limitCount: number): Promise<TestResult[]> {
    const all = await this.findAll();
    return all
      .sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''))
      .slice(0, limitCount);
  }

  async save(testResult: TestResult): Promise<void> {
    if (!testResult || !testResult.id) {
      throw new Error('Dữ liệu phiếu kiểm nghiệm không hợp lệ: Thiếu ID');
    }
    // Bóc tách thuộc tính ảo 'batch' để không lưu trùng thừa vào DB
    const { batch: _virtualBatch, ...dataToSave } = testResult;
    const cleanItem = removeUndefined(dataToSave);
    const targetPath = `${this.collectionPath}/${testResult.id}`;

    try {
      await set(ref(db, targetPath), cleanItem);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'SET', data: cleanItem });
        return;
      }
      throw e;
    }
  }

  async update(testResult: TestResult): Promise<void> {
    await this.save(testResult);
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
