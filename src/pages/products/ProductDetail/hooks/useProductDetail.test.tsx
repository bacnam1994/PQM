import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useProductDetail } from './useProductDetail';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'prod-001' }),
    useNavigate: () => vi.fn()
  };
});

describe('useProductDetail Hook', () => {
  beforeEach(() => {
    useAppStore.setState({
      products: [
        { id: 'prod-001', code: 'VB-001', name: 'Paracetamol 500mg', type: 'FINISHED' } as any
      ],
      batches: [
        { id: 'b-001', productId: 'prod-001', batchNo: 'B010126', status: 'RELEASED' } as any
      ],
      testResults: [
        { id: 'tr-001', batchId: 'b-001', overallStatus: 'PASS', testDate: '2026-01-01' } as any
      ],
      tccsList: [
        { id: 'tccs-001', productId: 'prod-001', tccsCode: 'TCCS 01:2026/VB', status: 'ACTIVE' } as any
      ],
      productFormulas: [
        { id: 'f-001', productId: 'prod-001', status: 'ACTIVE', ingredients: [] } as any
      ]
    });
  });

  it('hydrate đúng thông tin sản phẩm và tính toán thống kê lô, phiếu kiểm nghiệm', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>
        {children}
      </BrowserRouter>
    );

    const { result } = renderHook(() => useProductDetail(), { wrapper });

    expect(result.current.product).toBeDefined();
    expect(result.current.product?.name).toBe('Paracetamol 500mg');
    expect(result.current.productBatches).toHaveLength(1);
    expect(result.current.productResults).toHaveLength(1);
    expect(result.current.activeTCCS).toBeDefined();
    expect(result.current.productFormula).toBeDefined();
    expect(result.current.metrics.passRate).toBe(100);
  });

  it('khởi tạo tab mặc định là "info"', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BrowserRouter>
        {children}
      </BrowserRouter>
    );

    const { result } = renderHook(() => useProductDetail(), { wrapper });
    expect(result.current.activeTab).toBe('info');
  });
});
