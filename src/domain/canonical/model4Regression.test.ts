import { describe, it, expect } from 'vitest';
import { DataLineageManager, BatchDataLineage } from '../lineage/dataLineageModel';
import {
  Product,
  Batch,
  TCCS,
  TestResult,
  ProductFormula,
  RawMaterial,
  QualityDeviation,
  EvaluationSnapshot,
} from '../../types';

describe('MODEL 4: DATA LINEAGE MODEL REGRESSION TESTS', () => {
  const mockProduct: Product = {
    id: 'prod_amox_500',
    code: 'AMOX500',
    name: 'Amoxicillin 500mg',
    group: 'Kháng sinh',
    registrationNo: 'VD-12345-20',
    registrationDate: '2020-01-01',
    registrant: 'V-Biotech',
    status: 'ACTIVE',
    description: 'Amoxicillin 500mg viên nang',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockTccs: TCCS = {
    id: 'tccs_amox_01',
    productId: 'prod_amox_500',
    code: 'TCCS-AMOX-01',
    issueDate: '2026-01-01',
    isActive: true,
    version: 1,
    mainQualityCriteria: [
      {
        name: 'Định lượng Amoxicillin',
        unit: '%',
        min: 90,
        max: 110,
        type: 'NUMBER' as any,
      },
    ],
    safetyCriteria: [
      {
        name: 'Giới hạn nhiễm khuẩn',
        unit: 'CFU/g',
        max: 1000,
        type: 'NUMBER' as any,
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockFormula: ProductFormula = {
    id: 'formula_amox_01',
    productId: 'prod_amox_500',
    version: 1,
    ingredients: [
      {
        id: 'ing_1',
        materialId: 'mat_amox_trihydrate',
        name: 'Amoxicillin Trihydrate',
        declaredContent: 500,
        unit: 'mg',
      },
    ],
    excipients: [
      {
        id: 'exc_1',
        materialId: 'mat_magnesium_stearate',
        name: 'Magnesium Stearate',
        declaredContent: 5,
        unit: 'mg',
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockBatch: Batch = {
    id: 'batch_amox_26001',
    batchNo: 'LOT-AMOX-26001',
    productId: 'prod_amox_500',
    tccsId: 'tccs_amox_01',
    mfgDate: '2026-02-01',
    expDate: '2029-02-01',
    theoreticalYield: 100000,
    actualYield: 99400,
    yieldUnit: 'viên',
    status: 'RELEASED',
    progressPercent: 100,
    createdAt: '2026-02-01T00:00:00Z',
  };

  const mockSnapshot: EvaluationSnapshot = {
    engineVersion: '7.1.0-CANONICAL',
    testResultId: 'tr_amox_001',
    batchId: 'batch_amox_26001',
    tccsId: 'tccs_amox_01',
    tccsVersion: 1,
    evaluatedAt: '2026-02-15T10:00:00Z',
    evaluatedBy: 'qc_lead@vbiotech.vn',
    overallStatus: 'PASS',
    criterionResults: [
      { criteriaName: 'Tính chất', value: 'Viên nang cứng', isPass: null },
      { criteriaName: 'Định lượng Amoxicillin', value: 99.8, isPass: true },
    ],
    alternateUsed: false,
    reasons: ['Tất cả chỉ tiêu bắt buộc đạt'],
    warnings: [],
    evaluationHash: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
  };

  const mockTestResult: TestResult = {
    id: 'tr_amox_001',
    batchId: 'batch_amox_26001',
    tccsId: 'tccs_amox_01',
    labId: 'lab_internal',
    labName: 'Phòng QC V-Biotech',
    testDate: '2026-02-15',
    overallStatus: 'PASS',
    evaluationSnapshot: mockSnapshot,
    results: [
      {
        criteriaName: 'Tính chất',
        value: 'Viên nang cứng',
        isPass: null, // Informational / sensory criterion
      },
      {
        criteriaName: 'Định lượng Amoxicillin',
        value: 99.8,
        isPass: true,
      },
    ],
    createdAt: '2026-02-15T00:00:00Z',
  };

  const mockDeviation: QualityDeviation = {
    id: 'dev_2026_001',
    deviationNo: 'DEV-2026-0001',
    title: 'Nhiệt độ phòng dập viên vượt ngưỡng 1.5 độ C trong 15 phút',
    source: 'MANUFACTURING',
    status: 'CLOSED',
    severity: 'MINOR',
    batchId: 'batch_amox_26001',
    batchNo: 'LOT-AMOX-26001',
    productId: 'prod_amox_500',
    description: 'Điều hòa gặp sự cố ngắn, đã khắc phục và sản phẩm không bị ảnh hưởng.',
    loggedBy: 'prod_lead',
    loggedAt: '2026-02-02T00:00:00Z',
    version: 1,
    updatedAt: '2026-02-02T00:00:00Z',
  };

  it('1. COMPLETE BATCH LINEAGE TREE: builds full genealogical hierarchy', () => {
    const lineage = DataLineageManager.buildBatchLineage({
      batch: mockBatch,
      products: [mockProduct],
      tccsList: [mockTccs],
      formulas: [mockFormula],
      testResults: [mockTestResult],
      deviations: [mockDeviation],
    });

    // Batch node
    expect(lineage.batch.id).toBe('batch_amox_26001');
    expect(lineage.batch.batchNo).toBe('LOT-AMOX-26001');

    // Product branch
    expect(lineage.product?.id).toBe('prod_amox_500');
    expect(lineage.product?.code).toBe('AMOX500');

    // TCCS branch
    expect(lineage.tccs?.id).toBe('tccs_amox_01');
    expect(lineage.tccs?.totalCriteria).toBe(2);

    // Formula branch
    expect(lineage.formula?.id).toBe('formula_amox_01');
    expect(lineage.formula?.materials).toHaveLength(2);
    expect(lineage.formula?.materials[0].name).toBe('Amoxicillin Trihydrate');

    // Test Results branch
    expect(lineage.testResults).toHaveLength(1);
    expect(lineage.testResults[0].isAuthoritative).toBe(true);

    // Deviations branch
    expect(lineage.deviations).toHaveLength(1);
    expect(lineage.deviations![0].deviationNo).toBe('DEV-2026-0001');
  });

  it('2. CANONICAL CRITERIA EVIDENCE: preserves isPass = null for sensory/informational criteria', () => {
    const lineage = DataLineageManager.buildBatchLineage({
      batch: mockBatch,
      products: [mockProduct],
      tccsList: [mockTccs],
      formulas: [mockFormula],
      testResults: [mockTestResult],
    });

    const criteria = lineage.testResults[0].criteria;
    expect(criteria).toHaveLength(2);

    // Sensory criterion
    expect(criteria[0].criteriaName).toBe('Tính chất');
    expect(criteria[0].isPass).toBeNull(); // Must remain null, NOT coerced to true!

    // Numeric criterion
    expect(criteria[1].criteriaName).toBe('Định lượng Amoxicillin');
    expect(criteria[1].isPass).toBe(true);

    // Evidence summary
    expect(lineage.qualityExplanation.criteriaEvidence?.unresolvedCriteria).toBe(1);
    expect(lineage.qualityExplanation.criteriaEvidence?.passedCriteria).toBe(1);
  });

  it('3. TECHNICAL ID TRACEABILITY CHAIN: provides ordered technical ID provenance', () => {
    const lineage = DataLineageManager.buildBatchLineage({
      batch: mockBatch,
      products: [mockProduct],
      tccsList: [mockTccs],
      formulas: [mockFormula],
      testResults: [mockTestResult],
    });

    const chain = lineage.qualityExplanation.traceabilityChain;
    expect(chain).toEqual([
      'prod_amox_500', // Product.id
      'tccs_amox_01', // TCCS.id
      'formula_amox_01', // Formula.id
      'batch_amox_26001', // Batch.id
      'tr_amox_001', // TestResult.id
    ]);
  });

  it('4. EVALUATION SNAPSHOT INTEGRATION: captures SHA-256 hash seal in lineage explanation', () => {
    const lineage = DataLineageManager.buildBatchLineage({
      batch: mockBatch,
      products: [mockProduct],
      tccsList: [mockTccs],
      formulas: [mockFormula],
      testResults: [mockTestResult],
    });

    expect(lineage.qualityExplanation.sourceType).toBe('EVALUATION_SNAPSHOT');
    expect(lineage.qualityExplanation.evaluationSnapshotHash).toBe(mockSnapshot.evaluationHash);
    expect(lineage.qualityExplanation.confidence).toBe('HIGH');
  });

  it('5. ON-DEMAND FIELD EXPLAINABILITY: explainFieldOrigin explains specific properties', () => {
    // Quality status explainability
    const qualityExpl = DataLineageManager.explainFieldOrigin(mockBatch, 'qualityStatus', {
      products: [mockProduct],
      tccsList: [mockTccs],
      formulas: [mockFormula],
      testResults: [mockTestResult],
    });
    expect(qualityExpl.field).toBe('qualityStatus');
    expect(qualityExpl.derivedValue).toBe('PASS');
    expect(qualityExpl.sourceType).toBe('EVALUATION_SNAPSHOT');

    // Lifecycle release decision explainability
    const releaseExpl = DataLineageManager.explainFieldOrigin(mockBatch, 'releaseDecision', {
      products: [mockProduct],
      tccsList: [mockTccs],
      formulas: [mockFormula],
      testResults: [mockTestResult],
    });
    expect(releaseExpl.derivedValue).toBe('RELEASED');
    expect(releaseExpl.sourceType).toBe('BATCH_LIFECYCLE');

    // TCCS explainability
    const tccsExpl = DataLineageManager.explainFieldOrigin(mockBatch, 'tccs', {
      products: [mockProduct],
      tccsList: [mockTccs],
      formulas: [mockFormula],
      testResults: [mockTestResult],
    });
    expect(tccsExpl.derivedValue).toBe('TCCS-AMOX-01');
    expect(tccsExpl.sourceType).toBe('TCCS');
  });

  it('6. FORWARD RAW MATERIAL TRACEABILITY: traces raw material to impacted formulas and batches', () => {
    const rawMaterials: RawMaterial[] = [
      {
        id: 'mat_amox_trihydrate',
        code: 'RM-AMOX-01',
        name: 'Amoxicillin Trihydrate',
        aliases: ['Amoxicillin', 'Amox'],
        category: 'ACTIVE',
        standard: 'BP 2024',
        description: 'Hoạt chất chính',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const impact = DataLineageManager.traceRawMaterialImpact('mat_amox_trihydrate', {
      formulas: [mockFormula],
      batches: [mockBatch],
      materials: rawMaterials,
    });

    expect(impact.materialId).toBe('mat_amox_trihydrate');
    expect(impact.materialName).toBe('Amoxicillin Trihydrate');
    expect(impact.impactedFormulas).toHaveLength(1);
    expect(impact.impactedFormulas[0].formulaId).toBe('formula_amox_01');
    expect(impact.impactedBatches).toHaveLength(1);
    expect(impact.impactedBatches[0].batchId).toBe('batch_amox_26001');
    expect(impact.totalBatchesImpacted).toBe(1);
  });

  it('7. FORWARD RAW MATERIAL TRACEABILITY: returns 0 when raw material is not used', () => {
    const impact = DataLineageManager.traceRawMaterialImpact('mat_unused_excipient', {
      formulas: [mockFormula],
      batches: [mockBatch],
    });

    expect(impact.impactedFormulas).toHaveLength(0);
    expect(impact.impactedBatches).toHaveLength(0);
    expect(impact.totalBatchesImpacted).toBe(0);
  });

  it('8. LINEAGE COMPLETENESS CHECK: verifies complete vs incomplete lineage', () => {
    const completeLineage = DataLineageManager.buildBatchLineage({
      batch: mockBatch,
      products: [mockProduct],
      tccsList: [mockTccs],
      formulas: [mockFormula],
      testResults: [mockTestResult],
    });

    const checkComplete = DataLineageManager.verifyLineageCompleteness(completeLineage);
    expect(checkComplete.isComplete).toBe(true);
    expect(checkComplete.missingNodes).toHaveLength(0);

    // Incomplete lineage: missing product and TCCS
    const incompleteLineage = DataLineageManager.buildBatchLineage({
      batch: mockBatch,
      products: [], // no product!
      tccsList: [], // no TCCS!
      formulas: [],
      testResults: [],
    });

    const checkIncomplete = DataLineageManager.verifyLineageCompleteness(incompleteLineage);
    expect(checkIncomplete.isComplete).toBe(false);
    expect(checkIncomplete.missingNodes).toContain('PRODUCT');
    expect(checkIncomplete.missingNodes).toContain('TCCS');
    expect(checkIncomplete.warnings).toContain(
      'BATCH_NO_FORMULA: Lô sản xuất chưa có công thức định mức liên kết.'
    );
  });

  it('9. MULTI-TEST RESULTS: correctly designates single authoritative test result in lineage', () => {
    const draftTest: TestResult = {
      ...mockTestResult,
      id: 'tr_amox_draft',
      workflowStatus: 'DRAFT',
      testDate: '2026-02-10',
    };

    const finalTest: TestResult = {
      ...mockTestResult,
      id: 'tr_amox_final',
      workflowStatus: 'APPROVED',
      testDate: '2026-02-15',
    };

    const lineage = DataLineageManager.buildBatchLineage({
      batch: mockBatch,
      products: [mockProduct],
      tccsList: [mockTccs],
      formulas: [mockFormula],
      testResults: [draftTest, finalTest],
    });

    expect(lineage.testResults).toHaveLength(2);
    const authList = lineage.testResults.filter((tr) => tr.isAuthoritative);
    expect(authList).toHaveLength(1);
    expect(authList[0].id).toBe('tr_amox_final');
  });
});
