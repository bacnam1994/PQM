/**
 * PQM 3.0 & V4 Platform - Firebase Criteria Alias Repository Implementation
 * Triển khai lưu trữ Criteria Aliases trên Firebase Realtime Database
 * Kế thừa BaseFirebaseRepository: hỗ trợ tìm kiếm, quan hệ theo TCCS ID.
 */

import { ref, remove } from 'firebase/database';
import { db } from '../../firebase';
import { CriteriaAlias } from '../../types';
import { ICriteriaAliasRepository } from '../CriteriaAliasRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';

export class FirebaseCriteriaAliasRepository
  extends BaseFirebaseRepository<CriteriaAlias>
  implements ICriteriaAliasRepository
{
  protected readonly collectionPath = 'criteria_aliases';

  async findByTccsId(tccsId: string): Promise<CriteriaAlias[]> {
    return this.findByRelation('tccsId', tccsId);
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID Criteria Alias để xóa.');
    const targetPath = `${this.collectionPath}/${id}`;
    await remove(ref(db, targetPath));
  }
}

export const criteriaAliasRepository = new FirebaseCriteriaAliasRepository();
