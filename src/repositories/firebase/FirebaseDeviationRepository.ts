/**
 * PQM 3.0 & V4 Platform - Firebase Quality Deviation Repository Implementation
 * Triển khai lưu trữ Hồ sơ Sai lệch (Quality Deviation) trên Firebase Realtime Database
 * Kế thừa BaseFirebaseRepository: phân trang cursor/offset, lọc server-side & đếm số lượng.
 */

import { ref, update as fbUpdate, remove } from 'firebase/database';
import { db } from '../../firebase';
import { QualityDeviation, DeviationStatus } from '../../types/deviation';
import { IDeviationRepository } from '../IDeviationRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

export class FirebaseDeviationRepository
  extends BaseFirebaseRepository<QualityDeviation>
  implements IDeviationRepository
{
  protected readonly collectionPath = 'quality_deviations';

  async findByBatchId(batchId: string): Promise<QualityDeviation[]> {
    return this.findByRelation('batchId', batchId);
  }

  async updateStatus(id: string, status: DeviationStatus, notes?: string): Promise<void> {
    const targetPath = `${this.collectionPath}/${id}`;
    const updates: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString()
    };
    if (notes) {
      updates.closureNotes = notes;
    }
    if (status === 'CLOSED') {
      updates.closedAt = new Date().toISOString();
    }

    try {
      await fbUpdate(ref(db, targetPath), updates);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'UPDATE', data: updates });
        return;
      }
      throw e;
    }
  }

  async delete(id: string): Promise<void> {
    const targetPath = `${this.collectionPath}/${id}`;
    try {
      await remove(ref(db, targetPath));
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'REMOVE' });
        return;
      }
      throw e;
    }
  }
}

export const firebaseDeviationRepository = new FirebaseDeviationRepository();
