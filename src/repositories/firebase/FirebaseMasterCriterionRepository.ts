/**
 * PQM — FirebaseMasterCriterionRepository
 * Triển khai lưu trữ MasterCriterion trên Firebase Realtime Database (`master_criteria/`).
 * Kế thừa BaseFirebaseRepository: phân trang cursor/offset, lọc server-side & đếm số lượng.
 */

import { ref, remove, query as fbQuery, orderByChild, equalTo, get } from 'firebase/database';
import { db } from '../../firebase';
import { MasterCriterion, MasterCriterionCategory } from '../../types';
import { IMasterCriterionRepository } from '../MasterCriterionRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';

export class FirebaseMasterCriterionRepository
  extends BaseFirebaseRepository<MasterCriterion>
  implements IMasterCriterionRepository
{
  protected readonly collectionPath = 'master_criteria';

  async findActive(): Promise<MasterCriterion[]> {
    try {
      const q = fbQuery(ref(db, this.collectionPath), orderByChild('isActive'), equalTo(true));
      const snap = await get(q);
      if (!snap.exists()) return [];
      return Object.values(snap.val()) as MasterCriterion[];
    } catch {
      // Fallback nếu chưa đánh index Firebase
      const all = await this.findAll();
      return all.filter((c) => c.isActive);
    }
  }

  async findByCategory(category: MasterCriterionCategory): Promise<MasterCriterion[]> {
    return this.findByRelation('category', category);
  }

  async searchByName(searchQuery: string): Promise<MasterCriterion[]> {
    const all = await this.findAll();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) => c.canonicalName?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
  }

  async findByLinkedMaterial(materialId: string): Promise<MasterCriterion[]> {
    return this.findByRelation('linkedMaterialId', materialId);
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID chỉ tiêu để xóa.');
    await remove(ref(db, `${this.collectionPath}/${id}`));
  }
}

/** Singleton instance sử dụng trên toàn ứng dụng */
export const masterCriterionRepository = new FirebaseMasterCriterionRepository();
