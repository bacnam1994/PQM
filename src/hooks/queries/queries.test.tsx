import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProductsQuery, useProductQuery } from './useProductQueries';
import { useBatchesQuery, useBatchQuery } from './useBatchQueries';
import { useAppStore } from '../../store/useAppStore';

import { vi } from 'vitest';
import { productRepository } from '../../repositories/firebase/FirebaseProductRepository';
import { batchRepository } from '../../repositories/firebase/FirebaseBatchRepository';

describe('TanStack Query - Server State Caching Hooks', () => {
  let queryClient: QueryClient;

  const mockProducts = [
    {
      id: 'prod-1',
      code: 'SP01',
      name: 'Hoạt Huyết Nhất Nhất',
      group: 'Đông dược',
      status: 'ACTIVE',
    } as any,
  ];

  const mockBatches = [
    { id: 'batch-1', batchNo: 'L2601', productId: 'prod-1', status: 'TESTING' } as any,
  ];

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.spyOn(productRepository, 'findAll').mockResolvedValue(mockProducts);
    vi.spyOn(productRepository, 'findById').mockResolvedValue(mockProducts[0]);
    vi.spyOn(batchRepository, 'findAll').mockResolvedValue(mockBatches);
    vi.spyOn(batchRepository, 'findById').mockResolvedValue(mockBatches[0]);
  });

  it('useProductsQuery trả về danh sách sản phẩm từ query repository', async () => {
    const { result } = renderHook(() => useProductsQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBe(1);
    expect(result.current.data?.[0].code).toBe('SP01');
  });

  it('useProductQuery tìm nạp chi tiết sản phẩm theo ID', async () => {
    const { result } = renderHook(() => useProductQuery('prod-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.name).toBe('Hoạt Huyết Nhất Nhất');
  });

  it('useBatchesQuery trả về danh sách lô hàng', async () => {
    const { result } = renderHook(() => useBatchesQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBe(1);
    expect(result.current.data?.[0].batchNo).toBe('L2601');
  });

  it('useBatchQuery tìm nạp chi tiết lô hàng theo ID', async () => {
    const { result } = renderHook(() => useBatchQuery('batch-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.status).toBe('TESTING');
  });
});
