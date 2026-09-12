import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProductsQuery, useProductQuery } from './useProductQueries';
import { useBatchesQuery, useBatchQuery } from './useBatchQueries';
import { useAppStore } from '../../store/useAppStore';

describe('TanStack Query - Server State Caching Hooks', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 5000,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    useAppStore.setState({
      products: [
        {
          id: 'prod-1',
          code: 'SP01',
          name: 'Hoạt Huyết Nhất Nhất',
          group: 'Đông dược',
          status: 'ACTIVE',
        } as any,
      ],
      batches: [{ id: 'batch-1', batchNo: 'L2601', productId: 'prod-1', status: 'TESTING' } as any],
    });
  });

  it('useProductsQuery trả về danh sách sản phẩm từ initial store cache', async () => {
    const { result } = renderHook(() => useProductsQuery(), { wrapper: createWrapper() });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBe(1);
    expect(result.current.data?.[0].code).toBe('SP01');
  });

  it('useProductQuery tìm nạp chi tiết sản phẩm theo ID', async () => {
    const { result } = renderHook(() => useProductQuery('prod-1'), { wrapper: createWrapper() });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.name).toBe('Hoạt Huyết Nhất Nhất');
  });

  it('useBatchesQuery trả về danh sách lô hàng', async () => {
    const { result } = renderHook(() => useBatchesQuery(), { wrapper: createWrapper() });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBe(1);
    expect(result.current.data?.[0].batchNo).toBe('L2601');
  });

  it('useBatchQuery tìm nạp chi tiết lô hàng theo ID', async () => {
    const { result } = renderHook(() => useBatchQuery('batch-1'), { wrapper: createWrapper() });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.status).toBe('TESTING');
  });
});
