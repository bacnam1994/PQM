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
    return list.find((t) => t.isActive) || null;
  }

  async findByCode(code: string): Promise<TCCS | null> {
    const target = code.trim().toLowerCase();
    const results = await this.findByRelation('code', target);
    return results[0] || null;
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID TCCS để xóa.');
    const targetPath = `${this.collectionPath}/${id}`;
    await remove(ref(db, targetPath));
  }

  async batchUpdate(updates: Record<string, any>): Promise<void> {
    if (!Object.keys(updates).length) return;
    await update(ref(db), updates);
  }
}

export const tccsRepository = new FirebaseTCCSRepository();
