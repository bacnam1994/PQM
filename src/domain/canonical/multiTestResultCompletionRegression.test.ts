import { describe, it, expect } from 'vitest';
import { Batch, TestResult, TCCS, CriterionType } from '../../types';
import { resolveAuthoritativeTestResultsForBatch } from '../test-result/testResultStatusResolver';
import { CanonicalStatusResolver } from './canonicalResolver';
import { calculateBatchProgress } from '../../pages/batches/BatchList/utils/batchProgress';
import { evaluateBatchQualityClearance } from '../../services/ai/batchClearanceService';

describe('Multi-TestResult & Heavy Metals Completion Regression', () => {
  const mockTccs: TCCS = {
    id: 'tccs_heavy_metals',
    productId: 'prod_syrup_01',
    code: 'TCCS-SYRUP-2026',
    version: 1,
    issueDate: '2026-01-01',
    isActive: true,
    createdAt: '2026-01-01',
    mainQualityCriteria: [
      { name: 'Cảm quan', expectedText: 'Dung dịch trong', type: CriterionType.TEXT, unit: '' },
      { name: 'pH', min: 4.0, max: 6.0, type: CriterionType.NUMBER, unit: 'pH' },
      { name: 'Thể tích thực', min: 95, max: 105, type: CriterionType.NUMBER, unit: 'ml' },
      {
        name: 'Kẽm (Kẽm gluconate)',
        min: 90,
        max: 110,
        type: CriterionType.NUMBER,
        unit: 'mg/100ml',
      },
    ],
    safetyCriteria: [
      { name: 'Chì (Pb)', max: 1.0, type: CriterionType.NUMBER, unit: 'ppm' },
      { name: 'Cadimi (Cd)', max: 0.5, type: CriterionType.NUMBER, unit: 'ppm' },
      { name: 'Thủy ngân (Hg)', max: 0.1, type: CriterionType.NUMBER, unit: 'ppm' },
      { name: 'Arsen (As) tổng số', max: 1.0, type: CriterionType.NUMBER, unit: 'ppm' },
      { name: 'Arsen vô cơ', max: 0.5, type: CriterionType.NUMBER, unit: 'ppm' },
    ],
    alternateRules: [
      {
        type: 'CONDITIONAL_CHECK',
        main: 'Arsen (As) tổng số',
        conditionValue: '> 1.0',
        alt: 'Arsen vô cơ',
      },
    ],
  };

  const mockBatch: Batch = {
    id: 'batch_syrup_lot01',
    batchNo: 'LOT-SYRUP-001',
    productId: 'prod_syrup_01',
    tccsId: 'tccs_heavy_metals',
    mfgDate: '2026-02-01',
    expDate: '2028-02-01',
    theoreticalYield: 5000,
    actualYield: 4950,
    yieldUnit: 'chai',
    status: 'TESTING',
    createdAt: '2026-02-01',
  };

  it('bảo toàn cả 2 phiếu kiểm nghiệm (Hóa lý + Kim loại nặng) khi cùng Lab hoặc không có labName', () => {
    // Phiếu 1: Cảm quan, pH, Thể tích
    const trChem: TestResult = {
      id: 'tr_chem_01',
      batchId: 'batch_syrup_lot01',
      labName: 'Phòng Kiểm Nghiệm Nội Bộ',
      testDate: '2026-02-05',
      overallStatus: 'PASS',
      status: 'APPROVED',
      workflowStatus: 'APPROVED',
      version: 1,
      results: [
        { criteriaName: 'Cảm quan', value: 'Dung dịch trong', isPass: true },
        { criteriaName: 'pH', value: 5.2, isPass: true },
        { criteriaName: 'Thể tích thực', value: 100, isPass: true },
      ],
      createdAt: '2026-02-05',
    };

    // Phiếu 2: Kim loại nặng (Kẽm, Chì, Cadimi, Thủy ngân, Arsen tổng số)
    const trMetals: TestResult = {
      id: 'tr_metals_02',
      batchId: 'batch_syrup_lot01',
      labName: 'Phòng Kiểm Nghiệm Nội Bộ', // CÙNG LAB VỚI PHIẾU 1!
      testDate: '2026-02-08',
      overallStatus: 'PASS',
      status: 'APPROVED',
      workflowStatus: 'APPROVED',
      version: 1,
      results: [
        { criteriaName: 'Kẽm (Kẽm gluconate)', value: 102, isPass: true },
        { criteriaName: 'Chì (Pb)', value: 0.04, isPass: true },
        { criteriaName: 'Cadimi (Cd)', value: 0.01, isPass: true },
        { criteriaName: 'Thủy ngân (Hg)', value: 0.005, isPass: true },
        { criteriaName: 'Arsen (As) tổng số', value: 0.08, isPass: true },
      ],
      createdAt: '2026-02-08',
    };

    const results = [trChem, trMetals];

    // 1. Kiểm tra resolveAuthoritativeTestResultsForBatch giữ trọn vẹn cả 2 phiếu
    const authResults = resolveAuthoritativeTestResultsForBatch(mockBatch, results, mockTccs);
    expect(authResults.length).toBe(2);
    expect(authResults.map((r) => r.id)).toContain('tr_chem_01');
    expect(authResults.map((r) => r.id)).toContain('tr_metals_02');

    // 2. Kiểm tra calculateBatchProgress đạt 100%
    const batchWithTccs = { ...mockBatch, tccs: mockTccs };
    const progress = calculateBatchProgress(batchWithTccs, results);
    expect(progress.missingCriteria).toHaveLength(0);
    expect(progress.progressPercent).toBe(100);

    // 3. Kiểm tra CanonicalStatusResolver.resolveBatchQuality tính toán 100% và PASS
    const qualityResolution = CanonicalStatusResolver.resolveBatchQuality(
      mockBatch,
      results,
      mockTccs
    );
    expect(qualityResolution.batchQualityStatus).toBe('PASS');
    expect(qualityResolution.decisionTrace?.completion.missingCriteria).toHaveLength(0);
    expect(qualityResolution.decisionTrace?.completion.percentage).toBe(100);
    expect(qualityResolution.decisionTrace?.completion.isComplete).toBe(true);

    // 4. Kiểm tra Arsen vô cơ được miễn kiểm và ghi nhận PASS
    const arsenVoCoEval = qualityResolution.decisionTrace?.criterionEvaluations.find(
      (c) => c.criterionName === 'Arsen vô cơ'
    );
    expect(arsenVoCoEval).toBeDefined();
    expect(arsenVoCoEval?.status).toBe('PASS');
    expect(arsenVoCoEval?.isExempted).toBe(true);
    expect(arsenVoCoEval?.actualValue).toBe('Miễn kiểm (quy tắc thay thế)');

    // 5. Kiểm tra AI Batch Quality Clearance Dossier không bị rớt hoặc thiếu chỉ tiêu
    const dossier = evaluateBatchQualityClearance(mockBatch, results, mockTccs);
    expect(dossier.missingCriteria).toHaveLength(0);
    expect(dossier.failedCount).toBe(0);
    expect(dossier.verdict).toBe('READY_FOR_RELEASE');
  });

  it('nhận diện chính xác chỉ tiêu khi tên trên phiếu viết ngắn gọn hơn TCCS (Semantic Matching)', () => {
    // Phiếu 1: Cảm quan, pH, Thể tích thực
    const tr1: TestResult = {
      id: 'tr_chem_alias',
      batchId: 'batch_syrup_lot01',
      labName: 'Phòng Kiểm Nghiệm',
      testDate: '2026-02-05',
      overallStatus: 'PASS',
      status: 'APPROVED',
      workflowStatus: 'APPROVED',
      results: [
        { criteriaName: 'Cảm quan', value: 'Dung dịch trong', isPass: true },
        { criteriaName: 'pH', value: 5.0, isPass: true },
        { criteriaName: 'Thể tích thực', value: 100, isPass: true },
      ],
      createdAt: '2026-02-05',
    };

    // Phiếu 2: Tên chỉ tiêu ghi vắn tắt ("Kẽm", "Chì", "Cadimi", "Thủy ngân", "Arsen")
    const tr2: TestResult = {
      id: 'tr_metals_alias',
      batchId: 'batch_syrup_lot01',
      labName: 'Phòng Kiểm Nghiệm',
      testDate: '2026-02-08',
      overallStatus: 'PASS',
      status: 'APPROVED',
      workflowStatus: 'APPROVED',
      results: [
        { criteriaName: 'Kẽm', value: 95, isPass: true },
        { criteriaName: 'Chì', value: 0.02, isPass: true },
        { criteriaName: 'Cadimi', value: 0.01, isPass: true },
        { criteriaName: 'Thủy ngân', value: 0.002, isPass: true },
        { criteriaName: 'Arsen', value: 0.05, isPass: true },
      ],
      createdAt: '2026-02-08',
    };

    const results = [tr1, tr2];
    const qualityResolution = CanonicalStatusResolver.resolveBatchQuality(
      mockBatch,
      results,
      mockTccs
    );

    // Toàn bộ 5 chỉ tiêu vắn tắt phải khớp vào TCCS
    expect(qualityResolution.decisionTrace?.completion.missingCriteria).toHaveLength(0);
    expect(qualityResolution.decisionTrace?.completion.percentage).toBe(100);
    expect(qualityResolution.batchQualityStatus).toBe('PASS');
  });
});
