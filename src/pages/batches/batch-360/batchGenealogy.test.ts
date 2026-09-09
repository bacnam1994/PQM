import { describe, it, expect } from 'vitest';
import { buildBatchGenealogy } from '../../../services/ai/batchGenealogyService';

describe('Batch 360 & Genealogy Tree Engine', () => {
  const mockProduct = {
    id: 'prod-001',
    code: 'SP-01',
    name: 'Ginkgo Biloba 120mg',
    group: 'Dược phẩm',
    status: 'ACTIVE',
  };

  const mockTccs = {
    id: 'tccs-001',
    productId: 'prod-001',
    code: 'TCCS-01/2026',
    isActive: true,
    mainQualityCriteria: [
      { name: 'Định lượng Ginkgo Flavonol Glycosid', min: 22, max: 27, unit: '%' }
    ]
  };

  const mockBatch = {
    id: 'batch-001',
    productId: 'prod-001',
    tccsId: 'tccs-001',
    batchNo: 'L260901',
    mfgDate: '2026-09-01',
    expDate: '2029-09-01',
    theoreticalYield: 100000,
    actualYield: 98500,
    yieldUnit: 'viên',
    status: 'RELEASED' as const,
    createdAt: '2026-09-01T08:00:00.000Z'
  };

  const mockTestResults = [
    {
      id: 'tr-001',
      batchId: 'batch-001',
      labName: 'Phòng Kiểm nghiệm V-Biotech',
      testDate: '2026-09-05',
      overallStatus: 'PASS' as const,
      results: [
        { criteriaName: 'Định lượng Ginkgo Flavonol Glycosid', value: '24.5', isPass: true }
      ]
    }
  ];

  it('xây dựng thành công cây phả hệ lô với điểm truy xuất cao khi đủ dữ liệu', () => {
    const report = buildBatchGenealogy({
      batch: mockBatch,
      product: mockProduct,
      tccs: mockTccs,
      formula: { id: 'form-001', productId: 'prod-001', ingredients: [] },
      rawMaterials: [],
      testResults: mockTestResults,
      allBatches: [mockBatch]
    });

    expect(report).toBeDefined();
    expect(report.batchNo).toBe('L260901');
    expect(report.tree.type).toBe('BATCH');
    expect(report.traceabilityScore).toBeGreaterThanOrEqual(70);
    expect(report.tree.children).toBeDefined();
    expect(report.tree.children!.length).toBeGreaterThan(0);
  });

  it('phát hiện đúng các liên kết còn thiếu (missingLinks) khi thiếu TCCS hoặc Formula', () => {
    const incompleteBatch = {
      ...mockBatch,
      id: 'batch-002',
      batchNo: 'L260902',
      tccsId: undefined
    };

    const report = buildBatchGenealogy({
      batch: incompleteBatch,
      product: mockProduct,
      tccs: undefined,
      formula: undefined,
      rawMaterials: [],
      testResults: [],
      allBatches: [incompleteBatch]
    });

    expect(report.missingLinks.length).toBeGreaterThan(0);
    expect(report.traceabilityScore).toBeLessThan(70);
  });

  it('đánh dấu rủi ro HIGH khi lô có phiếu kiểm nghiệm FAIL hoặc bị REJECTED', () => {
    const failedBatch = {
      ...mockBatch,
      id: 'batch-003',
      batchNo: 'L260903',
      status: 'REJECTED' as const
    };

    const failedTestResult = [
      {
        id: 'tr-fail-001',
        batchId: 'batch-003',
        labName: 'Trung tâm Quatest',
        testDate: '2026-09-06',
        overallStatus: 'FAIL' as const,
        results: [
          { criteriaName: 'Định lượng Ginkgo Flavonol Glycosid', value: '18.2', isPass: false }
        ]
      }
    ];

    const report = buildBatchGenealogy({
      batch: failedBatch,
      product: mockProduct,
      tccs: mockTccs,
      formula: undefined,
      rawMaterials: [],
      testResults: failedTestResult,
      allBatches: [failedBatch]
    });

    expect(report.overallRisk).toBe('HIGH');
    expect(report.riskReasons.length).toBeGreaterThan(0);
  });
});
