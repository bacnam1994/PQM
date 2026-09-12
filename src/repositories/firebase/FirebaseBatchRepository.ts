/**
 * PQM 3.0 & V4 Platform - Firebase Batch Repository Implementation
 * Triển khai lưu trữ lô sản xuất trên Firebase Realtime Database có hỗ trợ Offline Queue
 * Kế thừa BaseFirebaseRepository: phân trang cursor/offset, lọc server-side & đếm số lượng.
 */

import { ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { Batch } from '../../types';
import { IBatchRepository } from '../BatchRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { deleteBatchService } from '../../services/databaseService';

export class FirebaseBatchRepository
  extends BaseFirebaseRepository<Batch>
  implements IBatchRepository
{
  protected readonly collectionPath = 'batches';

  async findByBatchNo(batchNo: string): Promise<Batch | null> {
    const target = batchNo.trim().toLowerCase();
    const results = await this.findByRelation('batchNo', target);
    return results[0] || null;
  }

  async findByProductId(productId: string): Promise<Batch[]> {
    return this.findByRelation('productId', productId);
  }

  async findByStatus(status: Batch['status']): Promise<Batch[]> {
    return this.findByRelation('status', status);
  }

  async updateStatus(batchId: string, status: Batch['status'], reason?: string): Promise<void> {
    if (!batchId) throw new Error('Yêu cầu ID lô sản xuất');
    const updates: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString(),
      rejectReason: status === 'REJECTED' ? reason || null : null,
    };
    const targetPath = `${this.collectionPath}/${batchId}`;
    await update(ref(db, targetPath), updates);
  }

  async updateProgress(batchId: string, progressPercent: number): Promise<void> {
    if (!batchId) throw new Error('Yêu cầu ID lô sản xuất');
    const updates = { progressPercent };
    const targetPath = `${this.collectionPath}/${batchId}`;
    await update(ref(db, targetPath), updates);
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID lô sản xuất để xóa.');
    await deleteBatchService(id);
  }
}

export const batchRepository = new FirebaseBatchRepository();
