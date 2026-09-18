import { describe, it, expect } from 'vitest';
import { ValidationEngine } from '../validation/validationEngine';
import {
  Product,
  Batch,
  TCCS,
  TestResult,
  QualityDeviation,
  EvaluationSnapshot,
} from '../../types';

describe('MODEL 5: 3-TIER VALIDATION MODEL REGRESSION TESTS', () => {
  const mockProduct: Product = {
    id: 'prod_para_500',
    code: 'PARA500',
    name: 'Paracetamol 500mg',
    group: 'Thuốc hạ sốt giảm đau',
    registrationNo: 'VD-12345-20',
    registrationDate: '2020-01-01',
    registrant: 'V-Biotech',
    status: 'ACTIVE',
    description: 'Paracetamol 500mg viên nén',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockOtherProduct: Product = {
    id: 'prod_amox_500',
    code: 'AMOX500',
    name: 'Amoxicillin 500mg',
    group: 'Kháng sinh',
    registrationNo: 'VD-54321-20',
    registrationDate: '2020-01-01',
    registrant: 'V-Biotech',
    status: 'ACTIVE',
    description: 'Amoxicillin 500mg viên nang',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockTccs: TCCS = {
    id: 'tccs_para_01',
    productId: 'prod_para_500',
    code: 'TCCS-PARA-01',
    issueDate: '2026-01-01',
    isActive: true,
    version: 1,
    mainQualityCriteria: [
      {
        name: 'Định lượng Paracetamol',
        unit: '%',
        min: 95,
        max: 105,
        type: 'NUMBER' as any,
      },
    ],
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockOtherTccs: TCCS = {
    id: 'tccs_amox_01',
    productId: 'prod_amox_500', // Belongs to prod_amox_500!
    code: 'TCCS-AMOX-01',
    issueDate: '2026-01-01',
    isActive: true,
    version: 1,
    mainQualityCriteria: [],
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockBatch: Batch = {
    id: 'batch_tech_001',
    batchNo: 'LOT-2026-001',
    productId: 'prod_para_500',
    tccsId: 'tccs_para_01',
    mfgDate: '2026-02-01',
    expDate: '2029-02-01',
    theoreticalYield: 100000,
    actualYield: 99500,
    yieldUnit: 'viên',
    status: 'RELEASED',
    progressPercent: 100,
    createdAt: '2026-02-01T00:00:00Z',
  };

  const validTestResult: TestResult = {
    id: 'tr_2026_001',
    batchId: 'batch_tech_001',
    tccsId: 'tccs_para_01',
    labName: 'Phòng QC V-Biotech',
    testDate: '2026-02-15',
    overallStatus: 'PASS',
    results: [
      {
        criteriaName: 'Định lượng Paracetamol',
        value: 99.5,
        isPass: true,
      },
    ],
    createdAt: '2026-02-15T00:00:00Z',
  };

  it('1. TIER 1 SCHEMA: blocks invalid schema immediately without running Tier 2 or 3', () => {
    const badSchema = {
      overallStatus: 'PASS',
      // missing id, batchId, results
    };

    const res = ValidationEngine.validateTestResult(badSchema, [mockBatch], mockTccs);
    expect(res.isValid).toBe(false);
    expect(res.tier1Passed).toBe(false);
    expect(res.tier2Passed).toBe(false);
    expect(res.tier3Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'SCHEMA_MISSING_ID')).toBe(true);
    expect(res.errors.some((e) => e.code === 'SCHEMA_MISSING_BATCH_ID')).toBe(true);
  });

  it('2. TIER 1 DATE SANITY: rejects batch with expDate earlier than mfgDate', () => {
    const invalidDateBatch: Batch = {
      ...mockBatch,
      mfgDate: '2026-02-01',
      expDate: '2025-01-01', // Expired before manufactured!
    };

    const res = ValidationEngine.validateBatch(
      invalidDateBatch,
      [mockProduct],
      [mockTccs],
      [validTestResult]
    );

    expect(res.isValid).toBe(false);
    expect(res.tier1Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'SCHEMA_EXP_BEFORE_MFG')).toBe(true);
  });

  it('3. TIER 2 REFERENTIAL: blocks TestResult referencing batch by batchNo instead of technical ID', () => {
    const legacyTr: TestResult = {
      ...validTestResult,
      id: 'tr_legacy',
      batchId: 'LOT-2026-001', // Using batchNo!
    };

    const res = ValidationEngine.validateTestResult(legacyTr, [mockBatch], mockTccs);
    expect(res.isValid).toBe(false);
    expect(res.tier1Passed).toBe(true);
    expect(res.tier2Passed).toBe(false);
    expect(res.tier3Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'REF_LEGACY_BATCH_NO')).toBe(true);
  });

  it('4. TIER 2 REFERENTIAL: blocks orphan TestResult referencing non-existent batchId', () => {
    const orphanTr: TestResult = {
      ...validTestResult,
      id: 'tr_orphan',
      batchId: 'ghost_batch_id',
    };

    const res = ValidationEngine.validateTestResult(orphanTr, [mockBatch], mockTccs);
    expect(res.isValid).toBe(false);
    expect(res.tier1Passed).toBe(true);
    expect(res.tier2Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'REF_ORPHAN_FOREIGN_KEY')).toBe(true);
  });

  it('5. TIER 2 REFERENTIAL: blocks Batch referencing TCCS belonging to a different Product', () => {
    const crossBatch: Batch = {
      ...mockBatch,
      id: 'batch_cross',
      productId: 'prod_para_500',
      tccsId: 'tccs_amox_01', // belongs to prod_amox_500!
    };

    const res = ValidationEngine.validateBatch(
      crossBatch,
      [mockProduct, mockOtherProduct],
      [mockTccs, mockOtherTccs],
      [validTestResult]
    );

    expect(res.isValid).toBe(false);
    expect(res.tier1Passed).toBe(true);
    expect(res.tier2Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'REF_CROSS_PRODUCT_TCCS')).toBe(true);
  });

  it('6. TIER 3 BUSINESS: blocks TestResult with failing criteria but overallStatus marked PASS', () => {
    const contradictoryTr: TestResult = {
      ...validTestResult,
      overallStatus: 'PASS',
      results: [
        {
          criteriaName: 'Định lượng Paracetamol',
          value: 80.0, // Limit is 95-105% -> FAIL!
          isPass: false,
        },
      ],
    };

    const res = ValidationEngine.validateTestResult(contradictoryTr, [mockBatch], mockTccs);
    expect(res.isValid).toBe(false);
    expect(res.tier1Passed).toBe(true);
    expect(res.tier2Passed).toBe(true);
    expect(res.tier3Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'BIZ_STATUS_CRITERIA_MISMATCH')).toBe(true);
  });

  it('7. TIER 3 BUSINESS: blocks TestResult with invalid/tampered evaluation snapshot', () => {
    const tamperedSnapshot: EvaluationSnapshot = {
      engineVersion: '7.1.0-CANONICAL',
      testResultId: 'tr_2026_001',
      batchId: 'batch_tech_001',
      tccsId: 'tccs_para_01',
      evaluatedAt: '2026-02-15T00:00:00Z',
      evaluatedBy: 'qc',
      overallStatus: 'PASS',
      criterionResults: [{ criteriaName: 'Định lượng Paracetamol', value: 99.5, isPass: true }],
      alternateUsed: false,
      reasons: [],
      warnings: [],
      evaluationHash: 'invalid_tampered_hash_value', // Bad hash!
    };

    const trWithBadSnapshot: TestResult = {
      ...validTestResult,
      evaluationSnapshot: tamperedSnapshot,
    };

    const res = ValidationEngine.validateTestResult(trWithBadSnapshot, [mockBatch], mockTccs);
    expect(res.isValid).toBe(false);
    expect(res.tier1Passed).toBe(true);
    expect(res.tier2Passed).toBe(true);
    expect(res.tier3Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'BIZ_SNAPSHOT_INVALID')).toBe(true);
  });

  it('8. TIER 3 BUSINESS: blocks Batch RELEASED when test result is FAIL', () => {
    const failTr: TestResult = {
      ...validTestResult,
      overallStatus: 'FAIL',
      results: [{ criteriaName: 'Định lượng Paracetamol', value: 80, isPass: false }],
    };

    const releasedBatch: Batch = {
      ...mockBatch,
      status: 'RELEASED',
    };

    const res = ValidationEngine.validateBatch(releasedBatch, [mockProduct], [mockTccs], [failTr]);

    expect(res.isValid).toBe(false);
    expect(res.tier1Passed).toBe(true);
    expect(res.tier2Passed).toBe(true);
    expect(res.tier3Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'BIZ_RELEASED_WITHOUT_PASSING_TEST')).toBe(true);
  });

  it('9. TIER 3 BUSINESS: blocks Batch RELEASED when an open CRITICAL deviation exists', () => {
    const criticalDeviation: QualityDeviation = {
      id: 'dev_crit_01',
      deviationNo: 'DEV-2026-CRIT-001',
      title: 'Phát hiện tạp chất lạ trong mẻ hạt',
      source: 'MANUFACTURING',
      severity: 'CRITICAL',
      status: 'UNDER_INVESTIGATION', // Open!
      batchId: 'batch_tech_001',
      batchNo: 'LOT-2026-001',
      description: 'Đang gửi mẫu đi kiểm nghiệm bên ngoài',
      loggedBy: 'qa_manager',
      loggedAt: '2026-02-10T00:00:00Z',
      version: 1,
      updatedAt: '2026-02-10T00:00:00Z',
    };

    const res = ValidationEngine.validateBatch(
      mockBatch, // status: 'RELEASED'
      [mockProduct],
      [mockTccs],
      [validTestResult],
      [criticalDeviation]
    );

    expect(res.isValid).toBe(false);
    expect(res.tier3Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'BIZ_RELEASE_BLOCKED_BY_OPEN_DEVIATION')).toBe(true);
  });

  it('10. TIER 3 BUSINESS: blocks TCCS when min > max on numeric criterion', () => {
    const badTccs: TCCS = {
      ...mockTccs,
      id: 'tccs_bad_min_max',
      mainQualityCriteria: [
        {
          name: 'Độ ẩm',
          unit: '%',
          min: 10,
          max: 5, // 10 > 5!
          type: 'NUMBER' as any,
        },
      ],
    };

    const res = ValidationEngine.validateTCCS(badTccs, [mockProduct]);
    expect(res.isValid).toBe(false);
    expect(res.tier1Passed).toBe(true);
    expect(res.tier2Passed).toBe(true);
    expect(res.tier3Passed).toBe(false);
    expect(res.errors.some((e) => e.code === 'BIZ_CRITERIA_MIN_GT_MAX')).toBe(true);
  });

  it('11. CLEAN ENTITY: passes all 3 tiers with 100% compliance', () => {
    const trRes = ValidationEngine.validateTestResult(validTestResult, [mockBatch], mockTccs);
    expect(trRes.isValid).toBe(true);
    expect(trRes.tier1Passed).toBe(true);
    expect(trRes.tier2Passed).toBe(true);
    expect(trRes.tier3Passed).toBe(true);
    expect(trRes.errors).toHaveLength(0);

    const batchRes = ValidationEngine.validateBatch(
      mockBatch,
      [mockProduct],
      [mockTccs],
      [validTestResult]
    );
    expect(batchRes.isValid).toBe(true);
    expect(batchRes.tier1Passed).toBe(true);
    expect(batchRes.tier2Passed).toBe(true);
    expect(batchRes.tier3Passed).toBe(true);

    const tccsRes = ValidationEngine.validateTCCS(mockTccs, [mockProduct]);
    expect(tccsRes.isValid).toBe(true);
    expect(tccsRes.tier1Passed).toBe(true);
    expect(tccsRes.tier2Passed).toBe(true);
    expect(tccsRes.tier3Passed).toBe(true);
  });

  it('12. COMPLETE DATASET AUDIT: calculates system validation summary and pass rate', () => {
    const summary = ValidationEngine.validateCompleteDataset({
      products: [mockProduct],
      batches: [mockBatch],
      tccsList: [mockTccs],
      testResults: [validTestResult],
    });

    expect(summary.totalEntities).toBe(3);
    expect(summary.validEntities).toBe(3);
    expect(summary.invalidEntities).toBe(0);
    expect(summary.passRate).toBe(100);
    expect(summary.isCompliant).toBe(true);
  });
});
