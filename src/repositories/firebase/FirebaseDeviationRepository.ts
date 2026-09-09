/**
 * PQM 3.0 - Firebase Quality Deviation Repository Implementation
 * Triển khai lưu trữ Hồ sơ Sai lệch (Quality Deviation) trên Firebase Realtime Database
 */

import { ref, get, set, update as fbUpdate, remove } from 'firebase/database';
import { db } from '../../firebase';
import { QualityDeviation, DeviationStatus } from '../../types/deviation';
import { IDeviationRepository } from '../IDeviationRepository';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

export class FirebaseDeviationRepository implements IDeviationRepository {
  private readonly collectionPath = 'quality_deviations';

  async findById(id: string): Promise<QualityDeviation | null> {
    const snapshot = await get(ref(db, `${this.collectionPath}/${id}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as QualityDeviation;
  }

  async findAll(): Promise<QualityDeviation[]> {
    const snapshot = await get(ref(db, this.collectionPath));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    return Object.values(val) as QualityDeviation[];
  }

  async findByBatchId(batchId: string): Promise<QualityDeviation[]> {
    const all = await this.findAll();
    return all.filter(d => d.batchId === batchId);
  }

  async save(deviation: QualityDeviation): Promise<void> {
    if (!deviation || !deviation.id) {
      throw new Error('Dữ liệu sai lệch không hợp lệ: Thiếu ID');
    }
    const cleanItem = removeUndefined(deviation);
    const targetPath = `${this.collectionPath}/${deviation.id}`;

    try {
      await set(ref(db, targetPath), cleanItem);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ 
          path: targetPath, 
          operation: 'SET', 
          data: cleanItem, 
          expectedVersion: (deviation as any)?.version ?? 1 
        });
        return;
      }
      throw e;
    }
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
