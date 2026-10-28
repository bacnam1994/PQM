import { ref, set } from 'firebase/database';
import { db } from '../../firebase';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { TestingLaboratory } from '../../types/laboratory';
import { ILaboratoryRepository } from '../ILaboratoryRepository';

export class FirebaseLaboratoryRepository
  extends BaseFirebaseRepository<TestingLaboratory>
  implements ILaboratoryRepository
{
  protected readonly collectionPath = 'testing_laboratories';

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID đơn vị kiểm nghiệm để xóa.');
    await set(ref(db, `${this.collectionPath}/${id}`), null);
  }
}

export const firebaseLaboratoryRepository = new FirebaseLaboratoryRepository();
