/**
 * PQM 3.0 - Repository Architecture Base Interfaces
 * Tách biệt hoàn toàn tầng lưu trữ (Persistence) ra khỏi Business Logic và UI State.
 */

export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(item: T): Promise<void>;
  update(item: T): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface QueryFilter {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';
  value: any;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}
