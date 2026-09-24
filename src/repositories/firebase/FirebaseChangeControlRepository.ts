/**
 * PQM V4 Platform - Firebase Change Control Repository
 * Lưu trữ bền vững dữ liệu Yêu cầu Thay đổi trên Firebase Realtime Database (/change_requests)
 */

import { ref, remove } from 'firebase/database';
import { db } from '../../firebase';
import { ChangeRequest, ChangeStatus } from '../../types/changeControl';
import { IChangeControlRepository } from '../IChangeControlRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';

export class FirebaseChangeControlRepository
  extends BaseFirebaseRepository<ChangeRequest>
  implements IChangeControlRepository
{
  protected readonly collectionPath = 'change_requests';

  async findByStatus(status: ChangeStatus): Promise<ChangeRequest[]> {
    return this.findByRelation('status', status);
  }

  async findByProductId(productId: string): Promise<ChangeRequest[]> {
    return this.findByRelation('productId', productId);
  }

  async delete(id: string): Promise<void> {
    const targetPath = `${this.collectionPath}/${id}`;
    await remove(ref(db, targetPath));
  }
}

export const firebaseChangeControlRepository = new FirebaseChangeControlRepository();
