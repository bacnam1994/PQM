/**
 * PQM 3.0 & V4 Platform - Repository Architecture Base Interfaces
 * Tách biệt hoàn toàn tầng lưu trữ (Persistence) ra khỏi Business Logic và UI State.
 * Cung cấp chuẩn hóa phân trang (Pagination), lọc đa tiêu chí (Filtering) và truy vấn quan hệ.
 */

export interface QueryFilter<T = any> {
  field: keyof T | string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'in';
  value: any;
}

export interface PaginationOptions<T = any> {
  pageSize?: number;
  cursor?: string | null;
  cursorId?: string | null;
  offset?: number;
  page?: number;
  orderBy?: keyof T | string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor?: string | null;
  nextCursorId?: string | null;
  prevCursor?: string | null;
  prevCursorId?: string | null;
}

export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  findPaginated(
    options?: PaginationOptions<T>,
    filters?: QueryFilter<T>[]
  ): Promise<PaginatedResult<T>>;
  count(filters?: QueryFilter<T>[]): Promise<number>;
  findByRelation(foreignKey: keyof T | string, value: any): Promise<T[]>;
  save(item: T): Promise<void>;
  update(item: T): Promise<void>;
  delete(id: string): Promise<void>;
}
