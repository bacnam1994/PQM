import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProductsQuery, useProductQuery } from './useProductQueries';
import { useBatchesQuery, useBatchQuery } from './useBatchQueries';
import { useDeviationsQuery, useDeviationsByBatchQuery } from './useDeviationQueries';
import { useAppStore } from '../../store/useAppStore';

import { vi } from 'vitest';
import { productQueries } from '../../domains/product';
import { batchQueries } from '../../domains/batch';
import { deviationQueries } from '../../domains/deviation';
import { masterDataQueries } from '../../domains/master-data';
import { useMasterCriteriaQuery } from './useMasterCriterionQueries';

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

  const mockDeviations = [
    {
      id: 'dev-1',
      deviationNo: 'DEV-2026-001',
      title: 'Sai lệch pH dịch chiết',
      status: 'LOGGED',
      batchId: 'batch-1',
      loggedAt: '2026-09-15T08:00:00.000Z',
    } as any,
  ];

  const mockCriteria = [
    {
      id: 'crit-1',
      canonicalName: 'Độ đồng đều khối lượng',
      category: 'PHYSICAL',
      isActive: true,
    } as any,
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
    vi.spyOn(productQueries, 'getAll').mockResolvedValue(mockProducts);
    vi.spyOn(productQueries, 'getById').mockResolvedValue(mockProducts[0]);
    vi.spyOn(batchQueries, 'getAll').mockResolvedValue(mockBatches);
    vi.spyOn(batchQueries, 'getById').mockResolvedValue(mockBatches[0]);
    vi.spyOn(deviationQueries, 'getAll').mockResolvedValue(mockDeviations);
    vi.spyOn(deviationQueries, 'getByBatchId').mockResolvedValue(mockDeviations);
    vi.spyOn(masterDataQueries, 'getAllCriteria').mockResolvedValue(mockCriteria);
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

  it('useDeviationsQuery trả về danh sách hồ sơ sai lệch', async () => {
    const { result } = renderHook(() => useDeviationsQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBe(1);
    expect(result.current.data?.[0].deviationNo).toBe('DEV-2026-001');
  });

  it('useDeviationsByBatchQuery trả về sai lệch theo lô sản xuất', async () => {
    const { result } = renderHook(() => useDeviationsByBatchQuery('batch-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBe(1);
    expect(result.current.data?.[0].batchId).toBe('batch-1');
  });

  it('useMasterCriteriaQuery trả về danh sách chỉ tiêu mẫu từ MasterDataQueries', async () => {
    const { result } = renderHook(() => useMasterCriteriaQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBe(1);
    expect(result.current.data?.[0].canonicalName).toBe('Độ đồng đều khối lượng');
  });
});
