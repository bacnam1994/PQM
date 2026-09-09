/**
 * PQM 3.0 & V4 Platform - usePaginatedQuery Hook
 * Hook React chuẩn hóa cho truy vấn phân trang, lọc đa tiêu chí và sắp xếp qua Repository.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { IRepository, PaginationOptions, QueryFilter, PaginatedResult } from '../repositories/types';

export interface UsePaginatedQueryOptions<T> {
  repository: IRepository<T>;
  initialPageSize?: number;
  initialOrderBy?: keyof T | string;
  initialOrderDirection?: 'asc' | 'desc';
  initialFilters?: QueryFilter<T>[];
  autoFetch?: boolean;
}

export interface UsePaginatedQueryReturn<T> {
  items: T[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  isLoading: boolean;
  error: Error | null;

  goToPage: (page: number) => Promise<void>;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  setPageSize: (size: number) => Promise<void>;
  setFilters: (filters: QueryFilter<T>[]) => Promise<void>;
  setSorting: (orderBy: keyof T | string, orderDirection?: 'asc' | 'desc') => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePaginatedQuery<T extends { id?: string }>({
  repository,
  initialPageSize = 20,
  initialOrderBy = 'createdAt',
  initialOrderDirection = 'desc',
  initialFilters = [],
  autoFetch = true
}: UsePaginatedQueryOptions<T>): UsePaginatedQueryReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [filters, setFiltersState] = useState<QueryFilter<T>[]>(initialFilters);
  const [orderBy, setOrderByState] = useState<keyof T | string>(initialOrderBy);
  const [orderDirection, setOrderDirectionState] = useState<'asc' | 'desc'>(initialOrderDirection);

  // Cache theo page để back/forward tức thì
  const pageCache = useRef<Map<number, PaginatedResult<T>>>(new Map());

  const fetchPage = useCallback(
    async (pageToFetch: number, sizeToFetch: number, currentFilters: QueryFilter<T>[], currentOrder: keyof T | string, currentDir: 'asc' | 'desc') => {
      setIsLoading(true);
      setError(null);

      try {
        const options: PaginationOptions<T> = {
          page: pageToFetch,
          pageSize: sizeToFetch,
          orderBy: currentOrder,
          orderDirection: currentDir
        };

        const result = await repository.findPaginated(options, currentFilters);

        setItems(result.items);
        setTotalCount(result.totalCount);
        setCurrentPage(result.currentPage);
        setTotalPages(result.totalPages);
        setHasNextPage(result.hasNextPage);
        setHasPrevPage(result.hasPrevPage);
        setNextCursor(result.nextCursor ?? null);
        setPrevCursor(result.prevCursor ?? null);

        // Lưu vào cache
        pageCache.current.set(pageToFetch, result);
      } catch (err: any) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [repository]
  );

  const refresh = useCallback(async () => {
    pageCache.current.clear();
    await fetchPage(currentPage, pageSize, filters, orderBy, orderDirection);
  }, [fetchPage, currentPage, pageSize, filters, orderBy, orderDirection]);

  const goToPage = useCallback(
    async (page: number) => {
      if (page < 1 || (totalPages > 0 && page > totalPages)) return;
      await fetchPage(page, pageSize, filters, orderBy, orderDirection);
    },
    [fetchPage, pageSize, filters, orderBy, orderDirection, totalPages]
  );

  const nextPage = useCallback(async () => {
    if (hasNextPage) {
      await goToPage(currentPage + 1);
    }
  }, [hasNextPage, currentPage, goToPage]);

  const prevPage = useCallback(async () => {
    if (hasPrevPage) {
      await goToPage(currentPage - 1);
    }
  }, [hasPrevPage, currentPage, goToPage]);

  const setPageSize = useCallback(
    async (size: number) => {
      if (size <= 0) return;
      setPageSizeState(size);
      pageCache.current.clear();
      await fetchPage(1, size, filters, orderBy, orderDirection);
    },
    [fetchPage, filters, orderBy, orderDirection]
  );

  const setFilters = useCallback(
    async (newFilters: QueryFilter<T>[]) => {
      setFiltersState(newFilters);
      pageCache.current.clear();
      await fetchPage(1, pageSize, newFilters, orderBy, orderDirection);
    },
    [fetchPage, pageSize, orderBy, orderDirection]
  );

  const setSorting = useCallback(
    async (newOrderBy: keyof T | string, newDir: 'asc' | 'desc' = 'desc') => {
      setOrderByState(newOrderBy);
      setOrderDirectionState(newDir);
      pageCache.current.clear();
      await fetchPage(1, pageSize, filters, newOrderBy, newDir);
    },
    [fetchPage, pageSize, filters]
  );

  useEffect(() => {
    if (autoFetch) {
      fetchPage(1, pageSize, filters, orderBy, orderDirection);
    }
  }, [autoFetch]);

  return {
    items,
    totalCount,
    currentPage,
    totalPages,
    pageSize,
    hasNextPage,
    hasPrevPage,
    nextCursor,
    prevCursor,
    isLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    setFilters,
    setSorting,
    refresh
  };
}
