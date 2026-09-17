/**
 * PQM 3.0 & V4 Platform - Base Firebase Repository
 * Lớp cơ sở cung cấp CRUD, phân trang Server-side, lọc, đếm số lượng.
 * Tối ưu hóa:
 * - findByRelation: Truy vấn trực tiếp phía Server qua orderByChild & equalTo
 * - findPaginated: Phân trang Server-side qua limitToFirst/limitToLast và startAt/endAt
 * - Chuẩn hóa Offline: Bàn giao toàn bộ việc retry và offline cache cho TanStack Query v5
 */

import {
  ref,
  get,
  set,
  query,
  orderByChild,
  equalTo,
  limitToFirst,
  limitToLast,
  startAt,
  endAt,
} from 'firebase/database';
import { db } from '../../firebase';
import { IRepository, PaginationOptions, QueryFilter, PaginatedResult } from '../types';
import { removeUndefined } from '../../utils';
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

  /**
   * Phân trang tối ưu: Kết hợp Server-side Query trên Firebase RTDB
   * Khi không có bộ lọc phức tạp hoặc có bộ lọc đơn: Chỉ lấy đúng số lượng (pageSize + 1)
   * Giúp tab trình duyệt không phải tải 10.000 bản ghi về RAM
   */
  async findPaginated(
    options?: PaginationOptions<T>,
    filters?: QueryFilter<T>[]
  ): Promise<PaginatedResult<T>> {
    const pageSize = options?.pageSize || 20;
    const currentPage = options?.page || 1;
    const orderBy = (options?.orderBy as string) || 'id';
    const direction = options?.orderDirection || 'desc';

    // Trường hợp 1: Có bộ lọc phức tạp nhiều trường đồng thời (RTDB không hỗ trợ compound query)
    // Tối ưu hóa: Tìm bộ lọc có độ chọn lọc cao nhất (selective filter với operator '==') để kéo candidate subset từ server
    if (filters && filters.length > 1) {
      const eqFilter = filters.find((f) => f.operator === '==');
      let candidateItems: T[] = [];
      if (eqFilter) {
        candidateItems = await this.findByRelation(eqFilter.field, eqFilter.value);
      } else {
        try {
          const boundedQuery = query(ref(db, this.collectionPath), limitToLast(500));
          const snap = await get(boundedQuery);
          candidateItems = snap.exists() ? (Object.values(snap.val()) as T[]) : [];
        } catch {
          candidateItems = await this.findAll();
        }
      }
      return paginateDataset(candidateItems, options, filters);
    }

    // Trường hợp 2: Lọc đơn giản 1 trường (hoặc không filter) -> Truy vấn Server-side
    try {
      let q = query(ref(db, this.collectionPath));

      if (filters && filters.length === 1 && filters[0].operator === '==') {
        q = query(
          ref(db, this.collectionPath),
          orderByChild(String(filters[0].field)),
          equalTo(filters[0].value)
        );
      } else {
        q = query(ref(db, this.collectionPath), orderByChild(orderBy));
      }

      // Giới hạn số lượng nạp từ server theo trang
      // Nếu là phân trang theo cursor
      if (options?.cursor) {
        // Bắt buộc truyền tham số thứ 2 là ID duy nhất của bản ghi (tie-breaker)
        if (direction === 'asc') {
          q = query(
            q,
            options.cursorId ? startAt(options.cursor, options.cursorId) : startAt(options.cursor),
            limitToFirst(pageSize + 1)
          );
        } else {
          q = query(
            q,
            options.cursorId ? endAt(options.cursor, options.cursorId) : endAt(options.cursor),
            limitToLast(pageSize + 1)
          );
        }
      } else {
        // Lấy số lượng giới hạn vừa đủ cho trang hiện tại
        const maxToFetch = Math.min(pageSize * currentPage + 1, 200);
        q =
          direction === 'asc'
            ? query(q, limitToFirst(maxToFetch))
            : query(q, limitToLast(maxToFetch));
      }

      const snapshot = await get(q);
      if (!snapshot.exists()) {
        return {
          items: [],
          totalCount: 0,
          pageSize,
          currentPage,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: currentPage > 1,
        };
      }

      const rawObj = snapshot.val();
      let items = Object.values(rawObj) as T[];

      // Đảo chiều nếu sắp xếp giảm dần và dùng limitToLast
      if (direction === 'desc') {
        items = items.reverse();
      }

      // Áp dụng offset / slice cho trang nếu không dùng cursor
      const startIndex = options?.cursor ? 0 : (currentPage - 1) * pageSize;
      const paginatedItems = items.slice(startIndex, startIndex + pageSize);
      const hasNext = items.length > startIndex + pageSize;

      return {
        items: paginatedItems,
        totalCount: items.length >= pageSize ? items.length : paginatedItems.length,
        pageSize,
        currentPage,
        totalPages: Math.ceil(items.length / pageSize),
        hasNextPage: hasNext,
        hasPrevPage: currentPage > 1,
        nextCursor:
          paginatedItems.length > 0
            ? (paginatedItems[paginatedItems.length - 1] as any)[orderBy]
            : null,
        nextCursorId:
          paginatedItems.length > 0 ? (paginatedItems[paginatedItems.length - 1] as any).id : null,
        prevCursor: paginatedItems.length > 0 ? (paginatedItems[0] as any)[orderBy] : null,
        prevCursorId: paginatedItems.length > 0 ? (paginatedItems[0] as any).id : null,
      };
    } catch (err) {
      console.warn(
        `[Repository] Phân trang Server-side lỗi hoặc chưa đánh chỉ mục trên ${this.collectionPath}, fallback:`,
        err
      );
      const allItems = await this.findAll();
      return paginateDataset(allItems, options, filters);
    }
  }

  async count(filters?: QueryFilter<T>[]): Promise<number> {
    if (!filters || filters.length === 0) {
      const allItems = await this.findAll();
      return allItems.length;
    }
    if (filters.length === 1 && filters[0].operator === '==') {
      const items = await this.findByRelation(filters[0].field, filters[0].value);
      return items.length;
    }
    const eqFilter = filters.find((f) => f.operator === '==');
    let candidateItems: T[] = [];
    if (eqFilter) {
      candidateItems = await this.findByRelation(eqFilter.field, eqFilter.value);
    } else {
      try {
        const snap = await get(query(ref(db, this.collectionPath), limitToLast(500)));
        candidateItems = snap.exists() ? (Object.values(snap.val()) as T[]) : [];
      } catch {
        candidateItems = await this.findAll();
      }
    }
    const filtered = applyFilters(candidateItems, filters);
    return filtered.length;
  }

  /**
   * Truy vấn quan hệ chuẩn Server-side: Sử dụng orderByChild & equalTo
   * Không tải toàn bộ mảng dữ liệu về máy khách
   */
  async findByRelation(foreignKey: keyof T | string, value: any): Promise<T[]> {
    if (value === undefined || value === null) return [];

    try {
      const q = query(
        ref(db, this.collectionPath),
        orderByChild(String(foreignKey)),
        equalTo(value)
      );
      const snapshot = await get(q);
      if (!snapshot.exists()) return [];
      const val = snapshot.val();
      return Object.values(val) as T[];
    } catch (err) {
      console.warn(
        `[Repository] findByRelation trên ${this.collectionPath}.${String(foreignKey)} fallback findAll:`,
        err
      );
      const allItems = await this.findAll();
      return allItems.filter((item) => {
        const itemVal = (item as any)[foreignKey];
        if (typeof itemVal === 'string' && typeof value === 'string') {
          return itemVal.trim().toLowerCase() === value.trim().toLowerCase();
        }
        return itemVal === value;
      });
    }
  }

  async save(item: T): Promise<void> {
    if (!item || !item.id) {
      throw new Error(`Dữ liệu không hợp lệ khi lưu vào ${this.collectionPath}: Thiếu ID`);
    }
    const cleanItem = this.sanitizeItem(item);
    const targetPath = `${this.collectionPath}/${item.id}`;
    await set(ref(db, targetPath), cleanItem);
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
