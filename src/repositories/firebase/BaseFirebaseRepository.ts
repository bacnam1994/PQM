/**
 * PQM 3.0 & V4 Platform - Base Firebase Repository
 * Lớp cơ sở cung cấp CRUD, phân trang, lọc, đếm số lượng và offline mutation queue.
 */

import { ref, get, set } from 'firebase/database';
import { db } from '../../firebase';
import { IRepository, PaginationOptions, QueryFilter, PaginatedResult } from '../types';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';
import { paginateDataset, applyFilters } from '../utils/paginationHelper';

export abstract class BaseFirebaseRepository<T extends { id: string }> implements IRepository<T> {
  protected abstract readonly collectionPath: string;

  async findById(id: string): Promise<T | null> {
    if (!id) return null;
    const snapshot = await get(ref(db, `${this.collectionPath}/${id}`));
    if (!snapshot.exists()) return null;
    return snapshot.val() as T;
  }

  async findAll(): Promise<T[]> {
    const snapshot = await get(ref(db, this.collectionPath));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    return Object.values(val) as T[];
  }

  async findPaginated(
    options?: PaginationOptions<T>,
    filters?: QueryFilter<T>[]
  ): Promise<PaginatedResult<T>> {
    const allItems = await this.findAll();
    return paginateDataset(allItems, options, filters);
  }

  async count(filters?: QueryFilter<T>[]): Promise<number> {
    const allItems = await this.findAll();
    const filtered = applyFilters(allItems, filters);
    return filtered.length;
  }

  async findByRelation(foreignKey: keyof T | string, value: any): Promise<T[]> {
    const allItems = await this.findAll();
    return allItems.filter(item => {
      const itemVal = (item as any)[foreignKey];
      if (typeof itemVal === 'string' && typeof value === 'string') {
        return itemVal.trim().toLowerCase() === value.trim().toLowerCase();
      }
      return itemVal === value;
    });
  }

  async save(item: T): Promise<void> {
    if (!item || !item.id) {
      throw new Error(`Dữ liệu không hợp lệ khi lưu vào ${this.collectionPath}: Thiếu ID`);
    }
    const cleanItem = this.sanitizeItem(item);
    const targetPath = `${this.collectionPath}/${item.id}`;

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

  async update(item: T): Promise<void> {
    await this.save(item);
  }

  abstract delete(id: string): Promise<void>;

  /**
   * Hook chuẩn hóa dữ liệu trước khi ghi xuống RTDB
   */
  protected sanitizeItem(item: T): any {
    return removeUndefined(item);
  }
}
