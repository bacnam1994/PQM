/**
 * PQM 3.0 & V4 Platform - Firebase Product Repository Implementation
 * Triển khai lưu trữ sản phẩm trên Firebase Realtime Database có hỗ trợ Offline Queue
 * Kế thừa BaseFirebaseRepository: phân trang cursor/offset, lọc server-side & đếm số lượng.
 */

import { ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { Product } from '../../types';
import { IProductRepository } from '../ProductRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';
import { deleteProductService } from '../../services/databaseService';

export class FirebaseProductRepository
  extends BaseFirebaseRepository<Product>
  implements IProductRepository
{
  protected readonly collectionPath = 'products';

  async findByCode(code: string): Promise<Product | null> {
    const target = code.trim().toLowerCase();
    const results = await this.findByRelation('code', target);
    return results[0] || null;
  }

  async searchByName(nameQuery: string): Promise<Product[]> {
    const query = nameQuery.trim().toLowerCase();
    const all = await this.findAll();
    return all.filter(
      p => p.name?.toLowerCase().includes(query) || p.code?.toLowerCase().includes(query)
    );
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Yêu cầu ID sản phẩm để xóa.');
    const targetPath = `${this.collectionPath}/${id}`;
    try {
      await deleteProductService(id);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'REMOVE' });
        return;
      }
      throw e;
    }
  }

  async bulkSave(products: Product[]): Promise<void> {
    if (!products.length) return;
    const updates: Record<string, any> = {};
    products.forEach(p => {
      updates[`${this.collectionPath}/${p.id}`] = removeUndefined(p);
    });
    await update(ref(db), updates);
  }
}

export const productRepository = new FirebaseProductRepository();
