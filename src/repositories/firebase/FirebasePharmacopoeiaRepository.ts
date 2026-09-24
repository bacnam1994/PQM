import { ref, update, remove } from 'firebase/database';
import { db } from '../../firebase';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { PharmacopoeiaStandard } from '../../services/pharmacopoeiaService';
import { IPharmacopoeiaRepository } from '../IPharmacopoeiaRepository';

export class FirebasePharmacopoeiaRepository
  extends BaseFirebaseRepository<PharmacopoeiaStandard>
  implements IPharmacopoeiaRepository
{
  protected readonly collectionPath = 'pharmacopoeia_standards';

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID tiêu chuẩn dược điển để xóa.');
    await remove(ref(db, `${this.collectionPath}/${id}`));
  }

  async seedDefaults(standards: PharmacopoeiaStandard[]): Promise<void> {
    const updatePayload: Record<string, any> = {};
    const now = new Date().toISOString();
    standards.forEach((item) => {
      updatePayload[`pharmacopoeia_standards/${item.id}`] = {
        ...item,
        updatedAt: now,
        updatedBy: 'SYSTEM_SEED',
      };
    });
    await update(ref(db), updatePayload);
  }
}

export const firebasePharmacopoeiaRepository = new FirebasePharmacopoeiaRepository();
