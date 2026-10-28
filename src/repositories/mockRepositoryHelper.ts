import { vi } from 'vitest';
import { IRepository, PaginatedResult } from './types';

/**
 * Helper tạo base mock repository cho Unit Tests
 */
export function createBaseMockRepository<T>(): IRepository<T> {
  const emptyPaginated: PaginatedResult<T> = {
    items: [],
    totalCount: 0,
    pageSize: 20,
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    nextCursor: null,
    prevCursor: null
  };

  return {
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    findPaginated: vi.fn().mockResolvedValue(emptyPaginated),
    count: vi.fn().mockResolvedValue(0),
    findByRelation: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  };
}
