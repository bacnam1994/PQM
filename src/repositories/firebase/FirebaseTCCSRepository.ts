/**
 * PQM 3.0 - Firebase TCCS Repository Implementation
 * Triển khai lưu trữ Tiêu chuẩn cơ sở (TCCS) trên Firebase Realtime Database
 */

import { ref, get, set, update, remove } from 'firebase/database';
import { db } from '../../firebase';
import { TCCS } from '../../types';
import { ITCCSRepository } from '../TCCSRepository';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

export class FirebaseTCCSRepository implements ITCCSRepository {
  private readonly collectionPath = 'tccs';

  async findById(id: string): Promise<TCCS | null> {
    const snapshot = await get(ref(db, `${this.collectionPath}/${id}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as TCCS;
  }

  async findAll(): Promise<TCCS[]> {
    const snapshot = await get(ref(db, this.collectionPath));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    return Object.values(val) as TCCS[];
  }

  async findByProductId(productId: string): Promise<TCCS[]> {
    const all = await this.findAll();
    return all.filter(t => t.productId === productId);
  }

  async findActiveByProductId(productId: string): Promise<TCCS | null> {
    const list = await this.findByProductId(productId);
    return list.find(t => t.isActive) || null;
  }

  async findByCode(code: string): Promise<TCCS | null> {
    const all = await this.findAll();
    const target = code.trim().toLowerCase();
    return all.find(t => t.code?.trim().toLowerCase() === target) || null;
  }

  async save(tccs: TCCS): Promise<void> {
    if (!tccs || !tccs.id) {
      throw new Error('Dữ liệu TCCS không hợp lệ: Thiếu ID');
    }
    const cleanItem = removeUndefined(tccs);
    const targetPath = `${this.collectionPath}/${tccs.id}`;
    
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

  async update(tccs: TCCS): Promise<void> {
    await this.save(tccs);
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
