import { describe, it, expect } from 'vitest';
import { auditDataConsistency, generateAutoHealPlan, SystemDataSnapshot } from './dataConsistencyService';
import { Product, Batch, TCCS, TestResult, ProductFormula, RawMaterial, CriteriaAlias, CriterionType } from '../types';

describe('dataConsistencyService - Data Linkage & Consistency Engine', () => {
  const sampleProduct: Product = {
    id: 'prod_1',
    code: 'SP-001',
    name: 'Viên ngậm Hoạt Huyết',
    group: 'Dược phẩm',
    registrationNo: 'VD-12345-20',
    registrationDate: '2024-01-01',
    registrant: 'V-Biotech',
    status: 'ACTIVE',
    description: 'Mô tả',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const sampleRawMaterial: RawMaterial = {
    id: 'mat_ginkgo',
    code: 'RM-GINKGO',
    name: 'Cao Ginkgo Biloba',
    aliases: ['Ginkgo extract', 'Bạch quả'],
    category: 'ACTIVE',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const sampleTCCS: TCCS = {
    id: 'tccs_1',
    productId: 'prod_1',
    code: 'TCCS 01:2024/VB',
    issueDate: '2024-01-01',
    isActive: true,
    mainQualityCriteria: [
      { name: 'Định lượng Ginkgo Biloba', unit: 'mg/viên', min: 90, max: 110, type: CriterionType.NUMBER }
    ],
    safetyCriteria: [
      { name: 'Tổng số vi sinh vật hiếu khí', unit: 'CFU/g', max: 1000, type: CriterionType.NUMBER }
    ],
    createdAt: '2024-01-01T00:00:00Z',
  };

  const sampleFormula: ProductFormula = {
    id: 'formula_1',
    productId: 'prod_1',
    ingredients: [
      { id: 'ing_1', name: 'Cao Ginkgo Biloba', declaredContent: 100, unit: 'mg/viên', materialId: 'mat_ginkgo' }
    ],
    excipients: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const sampleBatch: Batch = {
    id: 'batch_1',
    productId: 'prod_1',
    tccsId: 'tccs_1',
    batchNo: 'L240101',
    mfgDate: '2024-01-01',
    expDate: '2027-01-01',
    theoreticalYield: 10000,
    actualYield: 9800,
    yieldUnit: 'viên',
    status: 'RELEASED',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const sampleTestResult: TestResult = {
    id: 'test_1',
    batchId: 'batch_1',
    labName: 'Phòng kiểm nghiệm V-Biotech',
    testDate: '2024-01-05',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Định lượng Ginkgo Biloba', value: 102, isPass: true, unit: 'mg/viên' },
      { criteriaName: 'Tổng số vi sinh vật hiếu khí', value: 50, isPass: true, unit: 'CFU/g' }
    ],
    createdAt: '2024-01-05T00:00:00Z',
  };

  it('1. should report 100 score and EXCELLENT grade for fully consistent system', () => {
    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [sampleBatch],
      testResults: [sampleTestResult],
      criteriaAliases: [],
    };

    const report = auditDataConsistency(data);
    expect(report.overallScore).toBe(100);
    expect(report.grade).toBe('EXCELLENT');
    expect(report.totalIssuesCount).toBe(0);
  });

  it('2. should detect Orphan Records (Batches, Test Results, TCCS, Formulas, Aliases)', () => {
    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [
        sampleTCCS,
        { id: 'tccs_orphan', productId: 'non_existent_prod', code: 'TCCS ORPHAN', issueDate: '2024-01-01', isActive: true, mainQualityCriteria: [], safetyCriteria: [], createdAt: '2024-01-01' }
      ],
      productFormulas: [
        sampleFormula,
        { id: 'formula_orphan', productId: 'non_existent_prod', ingredients: [], excipients: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' }
      ],
      batches: [
        sampleBatch,
        { id: 'batch_orphan', productId: 'non_existent_prod', tccsId: 'tccs_1', batchNo: 'L_ORPHAN', mfgDate: '2024-01-01', expDate: '2026-01-01', theoreticalYield: 100, actualYield: 100, yieldUnit: 'g', status: 'PENDING', createdAt: '2024-01-01' }
      ],
      testResults: [
        sampleTestResult,
        { id: 'test_orphan', batchId: 'non_existent_batch', labName: 'Lab X', testDate: '2024-01-01', overallStatus: 'PASS', results: [], createdAt: '2024-01-01' }
      ],
      criteriaAliases: [
        { id: 'alias_orphan', tccsId: 'non_existent_tccs', canonicalName: 'Độ rã', aliases: ['do ra'], autoDetected: true, confirmedByAdmin: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' }
      ],
    };

    const report = auditDataConsistency(data);
    expect(report.categoryBreakdown.orphanRecords).toBe(5);
    expect(report.criticalCount).toBeGreaterThanOrEqual(4);
    expect(report.grade).toBe('CRITICAL');
  });

  it('3. should detect Cross-Entity Reference Mismatches (Batch pointing to TCCS of different product)', () => {
    const product2: Product = { ...sampleProduct, id: 'prod_2', code: 'SP-002', name: 'Sản phẩm B' };
    const tccsForProd2: TCCS = { ...sampleTCCS, id: 'tccs_2', productId: 'prod_2', code: 'TCCS 02:2024' };
    
    // Lô hàng của Product 1 nhưng lại gán TCCS của Product 2!
    const mismatchedBatch: Batch = {
      ...sampleBatch,
      id: 'batch_mismatch',
      productId: 'prod_1',
      tccsId: 'tccs_2',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct, product2],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS, tccsForProd2],
      productFormulas: [sampleFormula],
      batches: [mismatchedBatch],
      testResults: [],
    };

    const report = auditDataConsistency(data);
    const mismatch = report.issues.find(i => i.type === 'CROSS_PRODUCT_TCCS_MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch?.severity).toBe('CRITICAL');
  });

  it('4. should detect Logical & Status Inconsistencies (TestResult PASS with failing criteria, Invalid Dates)', () => {
    // Phiếu kiểm nghiệm có chỉ tiêu Không Đạt nhưng overallStatus lại ghi PASS
    const inconsistentTest: TestResult = {
      id: 'test_bad_status',
      batchId: 'batch_1',
      labName: 'Lab Y',
      testDate: '2023-12-01', // Trước ngày SX 2024-01-01 -> Invalid Date!
      overallStatus: 'PASS', // Sai, vì chỉ tiêu dưới đây FAIL
      results: [
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 80, isPass: false, unit: 'mg/viên' } // 80 < min 90
      ],
      createdAt: '2024-01-01',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [sampleBatch],
      testResults: [inconsistentTest],
    };

    const report = auditDataConsistency(data);
    const statusMismatch = report.issues.find(i => i.type === 'TEST_RESULT_STATUS_MISMATCH');
    const dateMismatch = report.issues.find(i => i.type === 'INVALID_DATE_SEQUENCE');

    expect(statusMismatch).toBeDefined();
    expect(statusMismatch?.autoHealable).toBe(true);
    expect(statusMismatch?.healPayload?.correctStatus).toBe('FAIL');
    expect(dateMismatch).toBeDefined();
  });

  it('5. should detect Unlinked Formula Materials and generate Auto-Heal Plan', () => {
    // Công thức có hoạt chất nhưng chưa gán materialId (dù trong kho đã có 'Cao Ginkgo Biloba')
    const unlinkedFormula: ProductFormula = {
      id: 'formula_unlinked',
      productId: 'prod_1',
      ingredients: [
        { id: 'ing_1', name: 'Cao Ginkgo Biloba', declaredContent: 100, unit: 'mg/viên' } // thiếu materialId
      ],
      excipients: [
        { id: 'exc_1', name: 'Bạch quả', declaredContent: 10, unit: 'mg' } // khớp với alias của sampleRawMaterial!
      ],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [unlinkedFormula],
      batches: [],
      testResults: [],
    };

    const report = auditDataConsistency(data);
    const unlinkedIssue = report.issues.find(i => i.type === 'UNLINKED_FORMULA_MATERIAL');
    expect(unlinkedIssue).toBeDefined();
    expect(unlinkedIssue?.autoHealable).toBe(true);

    // Kiểm tra Auto-Heal Plan
    const plan = generateAutoHealPlan(report, data);
    expect(plan.totalActionsCount).toBeGreaterThan(0);
    const updatedFormula = plan.formulaUpdates['formula_unlinked'];
    expect(updatedFormula).toBeDefined();
    expect(updatedFormula.ingredients[0].materialId).toBe('mat_ginkgo');
    expect(updatedFormula.excipients![0].materialId).toBe('mat_ginkgo');
  });

  it('6. should detect duplicate product codes and duplicate batch numbers', () => {
    const duplicateProduct: Product = {
      ...sampleProduct,
      id: 'prod_dup',
      name: 'Sản phẩm trùng mã',
      code: 'SP-001', // Trùng với sampleProduct SP-001
    };

    const duplicateBatch: Batch = {
      ...sampleBatch,
      id: 'batch_dup',
      batchNo: 'L240101', // Trùng số lô cùng sản phẩm!
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct, duplicateProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [sampleBatch, duplicateBatch],
      testResults: [],
    };

    const report = auditDataConsistency(data);
    const dupCode = report.issues.find(i => i.type === 'DUPLICATE_PRODUCT_CODE');
    const dupBatch = report.issues.find(i => i.type === 'DUPLICATE_BATCH_NO');

    expect(dupCode).toBeDefined();
    expect(dupBatch).toBeDefined();
  });
});
