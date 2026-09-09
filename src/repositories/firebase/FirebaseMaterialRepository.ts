/**
 * PQM 3.0 - Firebase Raw Material Repository Implementation
 * Triển khai lưu trữ danh mục nguyên liệu trên Firebase Realtime Database
 */

import { ref, get, set, remove } from 'firebase/database';
import { db } from '../../firebase';
import { RawMaterial } from '../../types';
import { IMaterialRepository } from '../MaterialRepository';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

export class FirebaseMaterialRepository implements IMaterialRepository {
  private readonly collectionPath = 'raw_materials';

  async findById(id: string): Promise<RawMaterial | null> {
    const snapshot = await get(ref(db, `${this.collectionPath}/${id}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as RawMaterial;
  }

  async findAll(): Promise<RawMaterial[]> {
    const snapshot = await get(ref(db, this.collectionPath));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    return Object.values(val) as RawMaterial[];
  }

  async findByCode(code: string): Promise<RawMaterial | null> {
    const all = await this.findAll();
    const target = code.trim().toLowerCase();
    return all.find(m => m.code?.trim().toLowerCase() === target) || null;
  }

  async findByCasNumber(casNumber: string): Promise<RawMaterial | null> {
    const all = await this.findAll();
    const target = casNumber.trim().toLowerCase();
    return all.find(m => m.casNumber?.trim().toLowerCase() === target) || null;
  }

  async searchByNameOrAlias(query: string): Promise<RawMaterial[]> {
    const all = await this.findAll();
    const q = query.trim().toLowerCase();
    return all.filter(m => {
      const matchName = m.name?.toLowerCase().includes(q);
      const matchCode = m.code?.toLowerCase().includes(q);
      const matchAlias = (m.aliases || []).some(a => a.toLowerCase().includes(q));
      return matchName || matchCode || matchAlias;
    });
  }

  async save(material: RawMaterial): Promise<void> {
    if (!material || !material.id) {
      throw new Error('Dữ liệu nguyên liệu không hợp lệ: Thiếu ID');
    }
    const cleanItem = removeUndefined(material);
    const targetPath = `${this.collectionPath}/${material.id}`;
    
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

  async update(material: RawMaterial): Promise<void> {
    await this.save(material);
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID nguyên liệu để xóa.');
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

export const materialRepository = new FirebaseMaterialRepository();
