import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDataGraph } from './useDataGraph';
import * as queries from './queries';

vi.mock('./queries', () => ({
  useProductsQuery: vi.fn(),
  useBatchesQuery: vi.fn(),
  useTCCSListQuery: vi.fn(),
  useTestResultsQuery: vi.fn(),
  useProductFormulasQuery: vi.fn(),
  useRawMaterialsQuery: vi.fn(),
  useCriteriaAliasesQuery: vi.fn(),
}));

describe('Phase 5: Data Graph & Indexing', () => {
  const mockProducts = [
    { id: 'PROD-01', name: 'Paracetamol 500mg', code: 'PARA500' },
    { id: 'PROD-02', name: 'Ibuprofen 400mg', code: 'IBU400' },
  ];

  const mockBatches = [
    {
      id: 'BATCH-01',
      batchNo: 'B001',
      productId: 'PROD-01',
      tccsId: 'TCCS-01',
      mfgDate: '2026-01-01',
    },
    {
      id: 'BATCH-02',
      batchNo: 'B002',
      productId: 'PROD-01',
      tccsId: 'TCCS-01',
      mfgDate: '2026-02-01',
    },
    {
      id: 'BATCH-03',
      batchNo: 'B003',
      productId: 'PROD-02',
      tccsId: 'TCCS-02',
      mfgDate: '2026-03-01',
    },
  ];

  const mockTccsList = [
    { id: 'TCCS-01', productId: 'PROD-01', code: 'TCCS-PARA', isActive: true },
    { id: 'TCCS-02', productId: 'PROD-02', code: 'TCCS-IBU', isActive: true },
  ];

  const mockTestResults = [
    {
      id: 'TR-01',
      batchId: 'BATCH-01',
      testDate: '2026-01-10',
      overallStatus: 'PASS',
      results: [],
    },
    {
      id: 'TR-02',
      batchId: 'BATCH-01',
      testDate: '2026-01-11',
      overallStatus: 'PASS',
      results: [],
    },
    {
      id: 'TR-03',
      batchId: 'BATCH-03',
      testDate: '2026-03-10',
      overallStatus: 'FAIL',
      results: [],
    },
  ];

  const mockFormulas = [
    {
      id: 'FORM-01',
      productId: 'PROD-01',
      ingredients: [{ materialId: 'MAT-01', name: 'Paracetamol API' }],
    },
  ];

  const mockMaterials = [{ id: 'MAT-01', name: 'Paracetamol Active Ingredient' }];

  const mockAliases = [
    {
      id: 'ALIAS-01',
      tccsId: 'TCCS-01',
      canonicalName: 'Định lượng',
      aliases: ['ham luong'],
      autoDetected: false,
      confirmedByAdmin: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  beforeEach(() => {
    vi.mocked(queries.useProductsQuery).mockReturnValue({ data: mockProducts as any } as any);
    vi.mocked(queries.useBatchesQuery).mockReturnValue({ data: mockBatches as any } as any);
    vi.mocked(queries.useTCCSListQuery).mockReturnValue({ data: mockTccsList as any } as any);
    vi.mocked(queries.useTestResultsQuery).mockReturnValue({ data: mockTestResults as any } as any);
    vi.mocked(queries.useProductFormulasQuery).mockReturnValue({
      data: mockFormulas as any,
    } as any);
    vi.mocked(queries.useRawMaterialsQuery).mockReturnValue({ data: mockMaterials as any } as any);
    vi.mocked(queries.useCriteriaAliasesQuery).mockReturnValue({ data: mockAliases as any } as any);
  });

  it('xây dựng các index bản đồ ID chuẩn O(1)', () => {
    const { result } = renderHook(() => useDataGraph());

    expect(result.current.productsById.get('PROD-01')?.name).toBe('Paracetamol 500mg');
    expect(result.current.batchesById.get('BATCH-01')?.batchNo).toBe('B001');
    expect(result.current.tccsById.get('TCCS-01')?.code).toBe('TCCS-PARA');
    expect(result.current.testResultsById.get('TR-01')?.overallStatus).toBe('PASS');
    expect(result.current.formulasByProductId.get('PROD-01')?.id).toBe('FORM-01');
  });

  it('xây dựng quan hệ phân cấp (Data Graph) bằng index liên kết ngoại', () => {
    const { result } = renderHook(() => useDataGraph());

    // 1. Batches by Product
    const prod1Batches = result.current.batchesByProductId.get('PROD-01');
    expect(prod1Batches).toHaveLength(2);
    expect(prod1Batches?.map((b) => b.id)).toEqual(['BATCH-01', 'BATCH-02']);

    // 2. TestResults by Batch
    const batch1Tests = result.current.testResultsByBatchId.get('BATCH-01');
    expect(batch1Tests).toHaveLength(2);
    expect(batch1Tests?.map((t) => t.id)).toEqual(['TR-01', 'TR-02']);

    // 3. Batches by TCCS
    const tccs1Batches = result.current.batchesByTccsId.get('TCCS-01');
    expect(tccs1Batches).toHaveLength(2);

    // 4. Aliases by TCCS
    const tccs1Aliases = result.current.aliasesByTccsId.get('TCCS-01');
    expect(tccs1Aliases).toHaveLength(1);
    expect(tccs1Aliases?.[0].canonicalName).toBe('Định lượng');
  });

  it('cung cấp các hàm tra cứu nhanh O(1) tiện dụng', () => {
    const { result } = renderHook(() => useDataGraph());

    expect(result.current.getBatchesByProductId('PROD-01')).toHaveLength(2);
    expect(result.current.getBatchesByProductId('NON-EXISTENT')).toEqual([]);

    expect(result.current.getTestResultsByBatchId('BATCH-01')).toHaveLength(2);
    expect(result.current.getTestResultsByBatchId('BATCH-03')).toHaveLength(1);

    expect(result.current.getActiveTccsByProductId('PROD-01')?.id).toBe('TCCS-01');
    expect(result.current.getFormulaByProductId('PROD-01')?.id).toBe('FORM-01');
  });

  it('duy trì tính tương thích ngược hoàn toàn cho các mảng Hydrated', () => {
    const { result } = renderHook(() => useDataGraph());

    expect(result.current.products).toHaveLength(2);
    expect(result.current.products[0].batchesCount).toBe(2);
    expect(result.current.products[0].testResultsCount).toBe(2);
    expect(result.current.products[0].passRate).toBe(100);

    expect(result.current.batches).toHaveLength(3);
    expect(result.current.batches[0].product?.name).toBe('Paracetamol 500mg');
    expect(result.current.batches[0].tccs?.code).toBe('TCCS-PARA');
    expect(result.current.batches[0].testResultsCount).toBe(2);

    expect(result.current.testResults).toHaveLength(3);
    expect(result.current.testResults[0].batch?.batchNo).toBe('B001');
  });
});
