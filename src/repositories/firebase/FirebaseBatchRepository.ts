/**
 * PQM 3.0 - Firebase Batch Repository Implementation
 * Triển khai lưu trữ lô sản xuất trên Firebase Realtime Database có hỗ trợ Offline Queue
 */

import { ref, get, set, update } from 'firebase/database';
import { db } from '../../firebase';
import { Batch } from '../../types';
import { IBatchRepository } from '../BatchRepository';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';
import { deleteBatchService } from '../../services/databaseService';

export class FirebaseBatchRepository implements IBatchRepository {
  private readonly collectionPath = 'batches';

  async findById(id: string): Promise<Batch | null> {
    const snapshot = await get(ref(db, `${this.collectionPath}/${id}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as Batch;
  }

  async findAll(): Promise<Batch[]> {
    const snapshot = await get(ref(db, this.collectionPath));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    return Object.values(val) as Batch[];
  }

  async findByBatchNo(batchNo: string): Promise<Batch | null> {
    const all = await this.findAll();
    const target = batchNo.trim().toLowerCase();
    return all.find(b => b.batchNo?.trim().toLowerCase() === target) || null;
  }

  async findByProductId(productId: string): Promise<Batch[]> {
    const all = await this.findAll();
    return all.filter(b => b.productId === productId);
  }

  async findByStatus(status: Batch['status']): Promise<Batch[]> {
    const all = await this.findAll();
    return all.filter(b => b.status === status);
  }

  async save(batch: Batch): Promise<void> {
    if (!batch || !batch.id) {
      throw new Error('Dữ liệu lô sản xuất không hợp lệ: Thiếu ID');
    }
    const cleanItem = removeUndefined(batch);
    const targetPath = `${this.collectionPath}/${batch.id}`;

    try {
      await set(ref(db, targetPath), cleanItem);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ 
          path: targetPath, 
          operation: 'SET', 
          data: cleanItem, 
          expectedVersion: (batch as any)?.version ?? 1 
        });
        return;
      }
      throw e;
    }
  }

  async update(batch: Batch): Promise<void> {
    await this.save(batch);
  }

  async updateStatus(batchId: string, status: Batch['status'], reason?: string): Promise<void> {
    if (!batchId) throw new Error('Yêu cầu ID lô sản xuất');
    const updates: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString(),
      rejectReason: status === 'REJECTED' ? (reason || null) : null
    };
    const targetPath = `${this.collectionPath}/${batchId}`;

    try {
      await update(ref(db, targetPath), updates);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'UPDATE', data: updates });
        return;
      }
      throw e;
    }
  }

  async updateProgress(batchId: string, progressPercent: number): Promise<void> {
    if (!batchId) throw new Error('Yêu cầu ID lô sản xuất');
    const updates = { progressPercent };
    const targetPath = `${this.collectionPath}/${batchId}`;

    try {
      await update(ref(db, targetPath), updates);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'UPDATE', data: updates });
        return;
      }
      throw e;
    }
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID lô sản xuất để xóa.');
    const targetPath = `${this.collectionPath}/${id}`;

    try {
      await deleteBatchService(id);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'REMOVE' });
        return;
      }
      throw e;
    }
  }
}

export const batchRepository = new FirebaseBatchRepository();
