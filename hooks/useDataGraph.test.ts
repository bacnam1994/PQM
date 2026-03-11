import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDataGraph } from './useDataGraph';
import { useAppContext } from '../context/AppContext';
import { useTestResultContext } from '../context/TestResultContext';

// Mock dependencies
vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../context/TestResultContext', () => ({
  useTestResultContext: vi.fn(),
}));

describe('useDataGraph', () => {
  const mockState = {
    products: [
      { id: 'p1', name: 'Product 1' },
      { id: 'p2', name: 'Product 2' },
    ],
    batches: [
      { id: 'b1', productId: 'p1', tccsId: 't1' },
      { id: 'b2', productId: 'p2', tccsId: 't2' },
    ],
    tccsList: [
      { id: 't1', code: 'TCCS 01' },
      { id: 't2', code: 'TCCS 02' },
    ],
    inventoryIn: [
      { id: 'in1', batchId: 'b1', quantity: 100 },
    ],
    inventoryOut: [
      { id: 'out1', batchId: 'b1', quantity: 50 },
    ],
  };

  const mockStockMap = new Map([
    ['b1', { in: 100, out: 50, balance: 50 }],
    ['b2', { in: 0, out: 0, balance: 0 }],
  ]);

  const mockTestResults = [
    { id: 'tr1', batchId: 'b1', overallStatus: 'PASS' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppContext as any).mockReturnValue({
      state: mockState,
      stockMap: mockStockMap,
    });
    (useTestResultContext as any).mockReturnValue({
      testResults: mockTestResults,
    });
  });

  it('should hydrate batches with product, tccs, and stock', () => {
    const { result } = renderHook(() => useDataGraph());

    expect(result.current.batches).toHaveLength(2);
    
    const b1 = result.current.batches.find(b => b.id === 'b1');
    expect(b1).toBeDefined();
    expect(b1?.product).toEqual(mockState.products[0]);
    expect(b1?.tccs).toEqual(mockState.tccsList[0]);
    expect(b1?.stock).toEqual({ in: 100, out: 50, balance: 50 });

    const b2 = result.current.batches.find(b => b.id === 'b2');
    expect(b2).toBeDefined();
    expect(b2?.product).toEqual(mockState.products[1]);
    expect(b2?.tccs).toEqual(mockState.tccsList[1]);
    expect(b2?.stock).toEqual({ in: 0, out: 0, balance: 0 });
  });

  it('should hydrate test results with batch and product', () => {
    const { result } = renderHook(() => useDataGraph());

    expect(result.current.testResults).toHaveLength(1);
    const tr1 = result.current.testResults[0];
    
    expect(tr1.batch).toBeDefined();
    expect(tr1.batch?.id).toBe('b1');
    expect(tr1.product).toEqual(mockState.products[0]);
  });

  it('should hydrate inventory in with batch and product', () => {
    const { result } = renderHook(() => useDataGraph());

    expect(result.current.inventoryIn).toHaveLength(1);
    const in1 = result.current.inventoryIn[0];
    
    expect(in1.batch).toBeDefined();
    expect(in1.batch?.id).toBe('b1');
    expect(in1.product).toEqual(mockState.products[0]);
  });

  it('should hydrate inventory out with batch and product', () => {
    const { result } = renderHook(() => useDataGraph());

    expect(result.current.inventoryOut).toHaveLength(1);
    const out1 = result.current.inventoryOut[0];
    
    expect(out1.batch).toBeDefined();
    expect(out1.batch?.id).toBe('b1');
    expect(out1.product).toEqual(mockState.products[0]);
  });
});