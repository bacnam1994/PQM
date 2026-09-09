/**
 * PQM 3.0 & V4 Platform - Firebase Product Formula Repository Implementation
 * Triển khai lưu trữ Công thức sản phẩm trên Firebase Realtime Database
 * Kế thừa BaseFirebaseRepository: phân trang cursor/offset, lọc server-side & đếm số lượng.
 */

import { ref, remove } from 'firebase/database';
import { db } from '../../firebase';
import { ProductFormula } from '../../types';
import { IFormulaRepository } from '../FormulaRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

export class FirebaseFormulaRepository
  extends BaseFirebaseRepository<ProductFormula>
  implements IFormulaRepository
{
  protected readonly collectionPath = 'product_formulas';

  async findByProductId(productId: string): Promise<ProductFormula | null> {
    const results = await this.findByRelation('productId', productId);
    return results[0] || null;
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID công thức để xóa.');
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

export const formulaRepository = new FirebaseFormulaRepository();
