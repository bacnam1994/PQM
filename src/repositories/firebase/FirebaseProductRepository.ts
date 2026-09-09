/**
 * PQM 3.0 - Firebase Product Repository Implementation
 * Triển khai lưu trữ sản phẩm trên Firebase Realtime Database có hỗ trợ Offline Queue
 */

import { ref, get, set, update } from 'firebase/database';
import { db } from '../../firebase';
import { Product } from '../../types';
import { IProductRepository } from '../ProductRepository';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';
import { deleteProductService } from '../../services/databaseService';

export class FirebaseProductRepository implements IProductRepository {
  private readonly collectionPath = 'products';

  async findById(id: string): Promise<Product | null> {
    const snapshot = await get(ref(db, `${this.collectionPath}/${id}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as Product;
  }

  async findAll(): Promise<Product[]> {
    const snapshot = await get(ref(db, this.collectionPath));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    return Object.values(val) as Product[];
  }

  async findByCode(code: string): Promise<Product | null> {
    const all = await this.findAll();
    const target = code.trim().toLowerCase();
    return all.find(p => p.code?.trim().toLowerCase() === target) || null;
  }

  async searchByName(nameQuery: string): Promise<Product[]> {
    const all = await this.findAll();
    const query = nameQuery.trim().toLowerCase();
    return all.filter(p => p.name?.toLowerCase().includes(query) || p.code?.toLowerCase().includes(query));
  }

  async save(product: Product): Promise<void> {
    if (!product || !product.id) {
      throw new Error('Dữ liệu sản phẩm không hợp lệ: Thiếu ID');
    }
    const cleanItem = removeUndefined(product);
    const targetPath = `${this.collectionPath}/${product.id}`;
    
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

  async update(product: Product): Promise<void> {
    await this.save(product);
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
