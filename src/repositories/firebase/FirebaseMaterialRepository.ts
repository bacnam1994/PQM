/**
 * PQM 3.0 & V4 Platform - Firebase Raw Material Repository Implementation
 * Triển khai lưu trữ danh mục nguyên liệu trên Firebase Realtime Database
 * Kế thừa BaseFirebaseRepository: phân trang cursor/offset, lọc server-side & đếm số lượng.
 */

import { ref, remove } from 'firebase/database';
import { db } from '../../firebase';
import { RawMaterial } from '../../types';
import { IMaterialRepository } from '../MaterialRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

export class FirebaseMaterialRepository
  extends BaseFirebaseRepository<RawMaterial>
  implements IMaterialRepository
{
  protected readonly collectionPath = 'raw_materials';

  async findByCode(code: string): Promise<RawMaterial | null> {
    const target = code.trim().toLowerCase();
    const results = await this.findByRelation('code', target);
    return results[0] || null;
  }

  async findByCasNumber(casNumber: string): Promise<RawMaterial | null> {
    const target = casNumber.trim().toLowerCase();
    const results = await this.findByRelation('casNumber', target);
    return results[0] || null;
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
