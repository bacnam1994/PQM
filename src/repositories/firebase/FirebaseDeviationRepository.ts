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
      updatedAt: new Date().toISOString(),
    };
    if (notes) {
      updates.closureNotes = notes;
    }
    if (status === 'CLOSED') {
      updates.closedAt = new Date().toISOString();
    }

    await fbUpdate(ref(db, targetPath), updates);
  }

  async delete(id: string): Promise<void> {
    const targetPath = `${this.collectionPath}/${id}`;
    await remove(ref(db, targetPath));
  }
}

export const firebaseDeviationRepository = new FirebaseDeviationRepository();
