/**
 * PQM 3.0 - Firebase Product Formula Repository Implementation
 * Triển khai lưu trữ Công thức sản phẩm trên Firebase Realtime Database
 */

import { ref, get, set, remove } from 'firebase/database';
import { db } from '../../firebase';
import { ProductFormula } from '../../types';
import { IFormulaRepository } from '../FormulaRepository';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

export class FirebaseFormulaRepository implements IFormulaRepository {
  private readonly collectionPath = 'product_formulas';

  async findById(id: string): Promise<ProductFormula | null> {
    const snapshot = await get(ref(db, `${this.collectionPath}/${id}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as ProductFormula;
  }

  async findAll(): Promise<ProductFormula[]> {
    const snapshot = await get(ref(db, this.collectionPath));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    return Object.values(val) as ProductFormula[];
  }

  async findByProductId(productId: string): Promise<ProductFormula | null> {
    const all = await this.findAll();
    return all.find(f => f.productId === productId) || null;
  }

  async save(formula: ProductFormula): Promise<void> {
    if (!formula || !formula.id) {
      throw new Error('Dữ liệu công thức không hợp lệ: Thiếu ID');
    }
    const cleanItem = removeUndefined(formula);
    const targetPath = `${this.collectionPath}/${formula.id}`;
    
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

  async update(formula: ProductFormula): Promise<void> {
    await this.save(formula);
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
