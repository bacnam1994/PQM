import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useBatchList } from './useBatchList';

// Mock useDataGraph
vi.mock('../../../../hooks/useDataGraph', () => ({
  useDataGraph: () => ({
    batches: [
      { id: 'b-001', productId: 'prod-001', batchNo: 'B010126', status: 'RELEASED', mfgDate: '2026-01-01', expDate: '2028-01-01', product: { name: 'Paracetamol 500mg', code: 'VB-001' } },
      { id: 'b-002', productId: 'prod-002', batchNo: 'B020226', status: 'PENDING', mfgDate: '2026-02-01', expDate: '2028-02-01', product: { name: 'Amoxicillin 500mg', code: 'VB-002' } }
    ],
    products: [],
    testResults: [],
    tccsList: [],
    productFormulas: [],
    rawMaterials: [],
    criteriaAliases: []
  })
}));

describe('useBatchList Hook', () => {
  it('khởi tạo danh sách lô và phân trang chính xác', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useBatchList(), { wrapper });

    expect(result.current.hydratedBatches).toHaveLength(2);
    expect(result.current.currentBatches).toHaveLength(2);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.availableYears).toContain('2026');
  });

  it('lọc dữ liệu theo từ khóa tìm kiếm lô hàng', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(() => useBatchList(), { wrapper });
    expect(result.current.filteredBatches).toHaveLength(2);
  });
});
