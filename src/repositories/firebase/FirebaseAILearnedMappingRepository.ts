/**
 * PQM 3.0 & V4 Platform - Firebase AI Learned Mapping Repository Implementation
 * Triển khai lưu trữ AI Learned Mappings trên Firebase Realtime Database
 * Kế thừa BaseFirebaseRepository: hỗ trợ tìm kiếm theo tên gốc originalName.
 */

import { ref, remove } from 'firebase/database';
import { db } from '../../firebase';
import { AILearnedMapping } from '../../types';
import { IAILearnedMappingRepository } from '../AILearnedMappingRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';

export class FirebaseAILearnedMappingRepository
  extends BaseFirebaseRepository<AILearnedMapping>
  implements IAILearnedMappingRepository
{
  protected readonly collectionPath = 'ai_learned_mappings';

  async findByOriginalName(name: string): Promise<AILearnedMapping | null> {
    const results = await this.findByRelation('originalName', name);
    return results[0] || null;
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID AI Learned Mapping để xóa.');
    const targetPath = `${this.collectionPath}/${id}`;
    await remove(ref(db, targetPath));
  }
}

export const aiLearnedMappingRepository = new FirebaseAILearnedMappingRepository();
