/**
 * PQM 3.0 & V4 Platform - Firebase TCCS Repository Implementation
 * Triển khai lưu trữ Tiêu chuẩn cơ sở (TCCS) trên Firebase Realtime Database
 * Kế thừa BaseFirebaseRepository: phân trang cursor/offset, lọc server-side & đếm số lượng.
 */

import { ref, remove, update } from 'firebase/database';
import { db } from '../../firebase';
import { TCCS } from '../../types';
import { ITCCSRepository } from '../TCCSRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

export class FirebaseTCCSRepository
  extends BaseFirebaseRepository<TCCS>
  implements ITCCSRepository
{
  protected readonly collectionPath = 'tccs';

  async findByProductId(productId: string): Promise<TCCS[]> {
    return this.findByRelation('productId', productId);
  }

  async findActiveByProductId(productId: string): Promise<TCCS | null> {
    const list = await this.findByProductId(productId);
    return list.find(t => t.isActive) || null;
  }

  async findByCode(code: string): Promise<TCCS | null> {
    const target = code.trim().toLowerCase();
    const results = await this.findByRelation('code', target);
    return results[0] || null;
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID TCCS để xóa.');
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

  async batchUpdate(updates: Record<string, any>): Promise<void> {
    if (!Object.keys(updates).length) return;
    try {
      await update(ref(db), updates);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        for (const [path, data] of Object.entries(updates)) {
          await enqueueOfflineMutation({ path, operation: 'SET', data });
        }
        return;
      }
      throw e;
    }
  }
}

export const tccsRepository = new FirebaseTCCSRepository();
