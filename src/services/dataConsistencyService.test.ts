import { describe, it, expect, vi } from 'vitest';
import {
  auditDataConsistency,
  generateAutoHealPlan,
  executeAutoHealPlan,
  SystemDataSnapshot,
} from './dataConsistencyService';
import {
  Product,
  Batch,
  TCCS,
  TestResult,
  ProductFormula,
  RawMaterial,
  CriteriaAlias,
  CriterionType,
} from '../types';

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
      {
        name: 'Định lượng Ginkgo Biloba',
        unit: 'mg/viên',
        min: 90,
        max: 110,
        type: CriterionType.NUMBER,
      },
    ],
    safetyCriteria: [
      {
        name: 'Tổng số vi sinh vật hiếu khí',
        unit: 'CFU/g',
        max: 1000,
        type: CriterionType.NUMBER,
      },
    ],
    createdAt: '2024-01-01T00:00:00Z',
  };

  const sampleFormula: ProductFormula = {
    id: 'formula_1',
    productId: 'prod_1',
    ingredients: [
      {
        id: 'ing_1',
        name: 'Cao Ginkgo Biloba',
        declaredContent: 100,
        unit: 'mg/viên',
        materialId: 'mat_ginkgo',
      },
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
    labId: 'lab_internal',
    labName: 'Phòng Kiểm nghiệm Nội bộ V-BIOTECH',
    testDate: '2024-01-05',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Định lượng Ginkgo Biloba', value: 102, isPass: true, unit: 'mg/viên' },
      { criteriaName: 'Tổng số vi sinh vật hiếu khí', value: 50, isPass: true, unit: 'CFU/g' },
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
        {
          id: 'tccs_orphan',
          productId: 'non_existent_prod',
          code: 'TCCS ORPHAN',
          issueDate: '2024-01-01',
          isActive: true,
          mainQualityCriteria: [],
          safetyCriteria: [],
          createdAt: '2024-01-01',
        },
      ],
      productFormulas: [
        sampleFormula,
        {
          id: 'formula_orphan',
          productId: 'non_existent_prod',
          ingredients: [],
          excipients: [],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
      batches: [
        sampleBatch,
        {
          id: 'batch_orphan',
          productId: 'non_existent_prod',
          tccsId: 'tccs_1',
          batchNo: 'L_ORPHAN',
          mfgDate: '2024-01-01',
          expDate: '2026-01-01',
          theoreticalYield: 100,
          actualYield: 100,
          yieldUnit: 'g',
          status: 'PENDING',
          createdAt: '2024-01-01',
        },
      ],
      testResults: [
        sampleTestResult,
        {
          id: 'test_orphan',
          batchId: 'non_existent_batch',
          labName: 'Lab X',
          testDate: '2024-01-01',
          overallStatus: 'PASS',
          results: [],
          createdAt: '2024-01-01',
        },
      ],
      criteriaAliases: [
        {
          id: 'alias_orphan',
          tccsId: 'non_existent_tccs',
          canonicalName: 'Độ rã',
          aliases: ['do ra'],
          autoDetected: true,
          confirmedByAdmin: false,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    };

    const report = auditDataConsistency(data);
    expect(report.categoryBreakdown.orphanRecords).toBe(5);
    expect(report.criticalCount).toBeGreaterThanOrEqual(4);
    expect(report.grade).toBe('CRITICAL');
  });

  it('3. should detect Cross-Entity Reference Mismatches (Batch pointing to TCCS of different product)', () => {
    const product2: Product = {
      ...sampleProduct,
      id: 'prod_2',
      code: 'SP-002',
      name: 'Sản phẩm B',
    };
    const tccsForProd2: TCCS = {
      ...sampleTCCS,
      id: 'tccs_2',
      productId: 'prod_2',
      code: 'TCCS 02:2024',
    };

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
    const mismatch = report.issues.find((i) => i.type === 'CROSS_PRODUCT_TCCS_MISMATCH');
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
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 80, isPass: false, unit: 'mg/viên' }, // 80 < min 90
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
    const statusMismatch = report.issues.find((i) => i.type === 'TEST_RESULT_STATUS_MISMATCH');
    const dateMismatch = report.issues.find((i) => i.type === 'INVALID_DATE_SEQUENCE');

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
        { id: 'ing_1', name: 'Cao Ginkgo Biloba', declaredContent: 100, unit: 'mg/viên' }, // thiếu materialId
      ],
      excipients: [
        { id: 'exc_1', name: 'Bạch quả', declaredContent: 10, unit: 'mg' }, // khớp với alias của sampleRawMaterial!
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
    const unlinkedIssue = report.issues.find((i) => i.type === 'UNLINKED_FORMULA_MATERIAL');
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
    const dupCode = report.issues.find((i) => i.type === 'DUPLICATE_PRODUCT_CODE');
    const dupBatch = report.issues.find((i) => i.type === 'DUPLICATE_BATCH_NO');

    expect(dupCode).toBeDefined();
    expect(dupBatch).toBeDefined();
  });

  it('7. should resolve test results linked by batchNo as LEGACY_RELATIONSHIP (not missing test) and support auto-healing', async () => {
    const batchWithNo: Batch = {
      ...sampleBatch,
      id: 'batch_uuid_042605',
      batchNo: '042605',
      status: 'RELEASED',
    };

    // TestResult referencing batch by batchNo
    const testWithBatchNo: TestResult = {
      id: 'test_custom_1',
      batchId: '042605',
      labName: 'Lab Trung Tâm',
      testDate: '2024-01-10',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 100, isPass: true, unit: 'mg/viên' },
      ],
      createdAt: '2024-01-10',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [batchWithNo],
      testResults: [testWithBatchNo],
    };

    const report = auditDataConsistency(data);
    const releasedIssue = report.issues.find((i) => i.type === 'RELEASED_BATCH_NO_PASSING_TEST');
    const orphanTestIssue = report.issues.find((i) => i.type === 'ORPHAN_TEST_RESULT');
    const legacyIssue = report.issues.find((i) => i.type === 'TEST_RESULT_RELATIONSHIP_INVALID');

    // Không được kết luận sai là Lô chưa kiểm nghiệm hoặc Phiếu mồ côi
    expect(releasedIssue).toBeUndefined();
    expect(orphanTestIssue).toBeUndefined();

    // Phải phát hiện đúng quan hệ liên kết bằng batchNo cần chuẩn hóa
    expect(legacyIssue).toBeDefined();
    expect(legacyIssue?.autoHealable).toBe(true);
    expect(legacyIssue?.autoHealAction).toBe('FIX_TEST_RELATIONSHIP');

    // Kiểm tra Auto-Heal hàn gắn quan hệ ID
    const plan = generateAutoHealPlan(report, data);
    expect(plan.testResultBatchIdUpdates['test_custom_1']).toBe('batch_uuid_042605');

    const updateTestMock = vi.fn();
    await executeAutoHealPlan(plan, {
      updateProductFormula: vi.fn(),
      updateTestResult: updateTestMock,
      updateTCCS: vi.fn(),
      deleteCriteriaAlias: vi.fn(),
      testResults: [testWithBatchNo],
      tccsList: [sampleTCCS],
    });

    expect(updateTestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test_custom_1',
        batchId: 'batch_uuid_042605',
      })
    );
  });

  it('8. should accept RELEASED batch if initial test was FAIL but re-test/subsequent test was PASS', () => {
    const batchReTested: Batch = {
      ...sampleBatch,
      id: 'batch_retested_012502',
      batchNo: '012502',
      status: 'RELEASED',
    };

    // Test 1: FAIL (lần đầu không đạt)
    const test1Fail: TestResult = {
      id: 'test_fail_1',
      batchId: 'batch_retested_012502',
      labName: 'Lab Nội bộ',
      testDate: '2024-01-02',
      overallStatus: 'FAIL',
      results: [
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 80, isPass: false, unit: 'mg/viên' },
      ],
      createdAt: '2024-01-02',
    };

    // Test 2: PASS (kiểm tra lại đạt)
    const test2Pass: TestResult = {
      id: 'test_pass_2',
      batchId: 'batch_retested_012502',
      labName: 'Lab Kiểm chứng',
      testDate: '2024-01-06',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 102, isPass: true, unit: 'mg/viên' },
      ],
      createdAt: '2024-01-06',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [batchReTested],
      testResults: [test1Fail, test2Pass],
    };

    const report = auditDataConsistency(data);
    const releasedIssue = report.issues.find((i) => i.type === 'RELEASED_BATCH_NO_PASSING_TEST');
    expect(releasedIssue).toBeUndefined();
    expect(report.criticalCount).toBe(0);
  });

  it('9. should detect unnormalized labName and auto-heal to canonical labId and name', async () => {
    const unnormalizedTest: TestResult = {
      id: 'test_unnorm_1',
      batchId: 'batch_1',
      labName: 'Quatest 3',
      testDate: '2024-01-05',
      overallStatus: 'PASS',
      results: [],
      createdAt: '2024-01-05',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [sampleBatch],
      testResults: [unnormalizedTest],
    };

    const report = auditDataConsistency(data);
    const labIssue = report.issues.find((i) => i.autoHealAction === 'NORMALIZE_TEST_LAB');
    expect(labIssue).toBeDefined();
    expect(labIssue?.autoHealable).toBe(true);
    expect(labIssue?.healPayload.targetLabId).toBe('lab_quatest3');
    expect(labIssue?.healPayload.canonicalLabName).toBe(
      'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3'
    );

    const plan = generateAutoHealPlan(report, data);
    expect(plan.testResultLabUpdates['test_unnorm_1']).toBeDefined();
    expect(plan.testResultLabUpdates['test_unnorm_1'].labId).toBe('lab_quatest3');

    const updateTestResultMock = vi.fn();
    await executeAutoHealPlan(plan, {
      updateProductFormula: vi.fn(),
      updateTestResult: updateTestResultMock,
      updateTCCS: vi.fn(),
      deleteCriteriaAlias: vi.fn(),
      testResults: [unnormalizedTest],
      tccsList: [sampleTCCS],
    });

    expect(updateTestResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test_unnorm_1',
        labId: 'lab_quatest3',
        labName: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3',
      })
    );
  });

  it('10. Regression Test Lô 272501: Batch 272501 đã có TestResult hợp lệ liên kết batchId -> TUYỆT ĐỐI KHÔNG CẢNH BÁO', () => {
    const batch272501: Batch = {
      id: '-Nx_real_batch_id_272501',
      productId: 'prod_1',
      tccsId: 'tccs_1',
      batchNo: '272501',
      mfgDate: '2025-01-10',
      expDate: '2028-01-10',
      theoreticalYield: 10000,
      actualYield: 9950,
      yieldUnit: 'viên',
      status: 'RELEASED',
      createdAt: '2025-01-10T00:00:00Z',
    };

    const testResult272501: TestResult = {
      id: '-Ny_real_test_id_for_272501',
      batchId: '-Nx_real_batch_id_272501', // Technical ID mapping chuẩn xác
      labId: 'lab_internal',
      labName: 'Phòng Kiểm nghiệm Nội bộ V-BIOTECH',
      testDate: '2025-01-14',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 100.5, isPass: true, unit: 'mg/viên' },
        { criteriaName: 'Tổng số vi sinh vật hiếu khí', value: 20, isPass: true, unit: 'CFU/g' },
      ],
      createdAt: '2025-01-14T00:00:00Z',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [batch272501],
      testResults: [testResult272501],
      dataFreshness: {
        isTestResultsLoading: false,
        testResultsLoaded: true,
      },
    };

    const report = auditDataConsistency(data);
    const releasedAlert = report.issues.find(
      (i) => i.entityId === batch272501.id || i.title.includes('272501')
    );

    expect(releasedAlert).toBeUndefined();
    expect(report.criticalCount).toBe(0);
    expect(report.grade).toBe('EXCELLENT');
    expect(report.overallScore).toBe(100);
  });

  it('11. Data Freshness Guard: Khi testResults đang tải (isTestResultsLoading=true), KHÔNG tạo false positive alert cho các lô đã xuất xưởng', () => {
    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [sampleBatch], // sampleBatch status: RELEASED
      testResults: [], // Chưa nạp xong từ máy chủ
      dataFreshness: {
        isTestResultsLoading: true,
        testResultsLoaded: false,
      },
    };

    const report = auditDataConsistency(data);
    const releasedIssue = report.issues.find((i) => i.type === 'RELEASED_BATCH_NO_PASSING_TEST');

    // Tuyệt đối không phát sinh cảnh báo thiếu kiểm nghiệm khi dữ liệu đang tải
    expect(releasedIssue).toBeUndefined();
    expect(report.criticalCount).toBe(0);
  });

  it('12. Regression Test: Phiếu kiểm nghiệm có overallStatus lưu dạng tiếng Việt "Đạt" KHÔNG tạo cảnh báo false positive "Sai lệch Đạt/Không Đạt"', () => {
    const testWithVietnamesePass: any = {
      id: 'tr_vietnamese_pass',
      batchId: sampleBatch.id,
      labName: 'Trung tâm Kiểm nghiệm CASE',
      testDate: '2024-01-05',
      overallStatus: 'Đạt', // Lưu tiếng Việt "Đạt" thay vì "PASS"
      results: [
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 100, isPass: true, unit: 'mg/viên' },
      ],
      createdAt: '2024-01-05',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [sampleBatch],
      testResults: [testWithVietnamesePass],
      dataFreshness: {
        isTestResultsLoading: false,
        testResultsLoaded: true,
      },
    };

    const report = auditDataConsistency(data);
    const statusMismatch = report.issues.find((i) => i.type === 'TEST_RESULT_STATUS_MISMATCH');

    // Không được coi "Đạt" là sai lệch so với PASS
    expect(statusMismatch).toBeUndefined();
  });

  it('13. Data Freshness Guard: Khi isTestResultsLoading=true, KHÔNG tạo false positive TEST_RESULT_STATUS_MISMATCH', () => {
    const incompleteLoadingTest: any = {
      id: 'tr_incomplete',
      batchId: sampleBatch.id,
      labName: 'Lab Y',
      testDate: '2024-01-05',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 80, isPass: false, unit: 'mg/viên' },
      ],
      createdAt: '2024-01-05',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [sampleBatch],
      testResults: [incompleteLoadingTest],
      dataFreshness: {
        isTestResultsLoading: true,
        testResultsLoaded: false,
      },
    };

    const report = auditDataConsistency(data);
    const statusMismatch = report.issues.find((i) => i.type === 'TEST_RESULT_STATUS_MISMATCH');

    expect(statusMismatch).toBeUndefined();
  });

  it('14. Multiple Test Results: Khi có phiếu kiểm nghiệm cũ FAIL nhưng có phiếu mới FINAL=PASS, không tạo cảnh báo sai lệch cho phiếu đạt', () => {
    const testOldFail: any = {
      id: 'tr_old_fail',
      batchId: sampleBatch.id,
      labName: 'Lab Internal',
      testDate: '2024-01-02',
      overallStatus: 'FAIL',
      version: 1,
      results: [
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 70, isPass: false, unit: 'mg/viên' },
      ],
      createdAt: '2024-01-02',
    };

    const testNewFinalPass: any = {
      id: 'tr_new_pass',
      batchId: sampleBatch.id,
      labName: 'Quatest 3',
      testDate: '2024-01-05',
      overallStatus: 'PASS',
      status: 'FINAL',
      version: 2,
      results: [
        { criteriaName: 'Định lượng Ginkgo Biloba', value: 100, isPass: true, unit: 'mg/viên' },
      ],
      createdAt: '2024-01-05',
    };

    const data: SystemDataSnapshot = {
      products: [sampleProduct],
      rawMaterials: [sampleRawMaterial],
      tccsList: [sampleTCCS],
      productFormulas: [sampleFormula],
      batches: [sampleBatch],
      testResults: [testOldFail, testNewFinalPass],
      dataFreshness: {
        isTestResultsLoading: false,
        testResultsLoaded: true,
      },
    };

    const report = auditDataConsistency(data);
    const releasedAlert = report.issues.find((i) => i.type === 'RELEASED_BATCH_NO_PASSING_TEST');
    expect(releasedAlert).toBeUndefined();
  });

  // =========================================================================
  // BỘ TEST CASES BẮT BUỘC (TC01 - TC12)
  // =========================================================================
  describe('Bộ Test Cases Bắt Buộc Chuẩn Hóa Trạng Thái & False-Positive (TC01 - TC12)', () => {
    // TC01: Lô có phiếu, tất cả chỉ tiêu PASS -> 0 cảnh báo
    it('TC01: Lô có phiếu, tất cả chỉ tiêu PASS -> 0 cảnh báo', () => {
      const data: SystemDataSnapshot = {
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [sampleTestResult],
      };
      const report = auditDataConsistency(data);
      expect(
        report.issues.filter(
          (i) =>
            i.type === 'TEST_RESULT_STATUS_MISMATCH' || i.type === 'RELEASED_BATCH_NO_PASSING_TEST'
        )
      ).toHaveLength(0);
      expect(report.totalIssuesCount).toBe(0);
    });

    // TC02: overallStatus=PASS, tất cả isPass=true -> 0 cảnh báo
    it('TC02: overallStatus=PASS, tất cả isPass=true -> 0 cảnh báo', () => {
      const tr: TestResult = {
        ...sampleTestResult,
        id: 'tc02_test',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Định lượng Ginkgo Biloba', value: 100, isPass: true },
          { criteriaName: 'Độ rã', value: 15, isPass: true },
        ],
      };
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [tr],
      });
      const mismatch = report.issues.find(
        (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
      );
      expect(mismatch).toBeUndefined();
    });

    // TC03: overallStatus=FAIL, có 1 chỉ tiêu FAIL -> Không cảnh báo mismatch; trạng thái FAIL hợp lệ
    it('TC03: overallStatus=FAIL, có 1 chỉ tiêu FAIL -> Không cảnh báo mismatch', () => {
      const batchTesting: Batch = { ...sampleBatch, status: 'TESTING' };
      const tr: TestResult = {
        ...sampleTestResult,
        id: 'tc03_test',
        overallStatus: 'FAIL',
        results: [
          { criteriaName: 'Định lượng Ginkgo Biloba', value: 50, isPass: false },
          { criteriaName: 'Độ rã', value: 15, isPass: true },
        ],
      };
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [batchTesting],
        testResults: [tr],
      });
      const mismatch = report.issues.find(
        (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
      );
      expect(mismatch).toBeUndefined();
    });

    // TC04: overallStatus=PASS, nhưng có 1 chỉ tiêu FAIL -> Cảnh báo sai lệch
    it('TC04: overallStatus=PASS, nhưng có 1 chỉ tiêu FAIL -> Cảnh báo sai lệch STATUS_MISMATCH', () => {
      const tr: TestResult = {
        ...sampleTestResult,
        id: 'tc04_test',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Định lượng Ginkgo Biloba', value: 50, isPass: false },
          { criteriaName: 'Độ rã', value: 15, isPass: true },
        ],
      };
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [tr],
      });
      const mismatch = report.issues.find(
        (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
      );
      expect(mismatch).toBeDefined();
      expect(mismatch?.actual).toBe('PASS');
      expect(mismatch?.expected).toBe('FAIL');
      expect(mismatch?.diagnostics?.failedCriteriaCount).toBe(1);
    });

    // TC05: overallStatus=FAIL, nhưng tất cả chỉ tiêu PASS -> Cảnh báo sai lệch
    it('TC05: overallStatus=FAIL, nhưng tất cả chỉ tiêu PASS -> Cảnh báo sai lệch STATUS_MISMATCH', () => {
      const tr: TestResult = {
        ...sampleTestResult,
        id: 'tc05_test',
        overallStatus: 'FAIL',
        results: [
          { criteriaName: 'Định lượng Ginkgo Biloba', value: 100, isPass: true },
          { criteriaName: 'Độ rã', value: 15, isPass: true },
        ],
      };
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [tr],
      });
      const mismatch = report.issues.find(
        (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
      );
      expect(mismatch).toBeDefined();
      expect(mismatch?.actual).toBe('FAIL');
      expect(mismatch?.expected).toBe('PASS');
    });

    // TC06: Phiếu có batchId đúng -> Match
    it('TC06: Phiếu có batchId đúng -> Match thành công, không có cảnh báo liên kết', () => {
      const tr: TestResult = {
        ...sampleTestResult,
        batchId: sampleBatch.id,
      };
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [tr],
      });
      const linkIssue = report.issues.find(
        (i) => i.code === 'INVALID_LINK' || i.type === 'TEST_RESULT_RELATIONSHIP_INVALID'
      );
      expect(linkIssue).toBeUndefined();
    });

    // TC07: Phiếu tồn tại nhưng batchId sai -> INVALID_LINK
    it('TC07: Phiếu tồn tại nhưng batchId sai (chứa số lô legacy) -> INVALID_LINK', () => {
      const trLegacy: TestResult = {
        ...sampleTestResult,
        id: 'tr_legacy_batch_no',
        batchId: sampleBatch.batchNo, // dùng batchNo thay vì ID
      };
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [trLegacy],
      });
      const linkIssue = report.issues.find(
        (i) => i.code === 'INVALID_LINK' || i.type === 'TEST_RESULT_RELATIONSHIP_INVALID'
      );
      expect(linkIssue).toBeDefined();
      expect(linkIssue?.autoHealable).toBe(true);
      // Không bị nhầm lẫn phát cảnh báo status mismatch
      const statusMismatch = report.issues.find(
        (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
      );
      expect(statusMismatch).toBeUndefined();
    });

    // TC08: Lô không có phiếu -> MISSING_TEST_RESULT
    it('TC08: Lô xuất xưởng không có phiếu -> MISSING_TEST_RESULT', () => {
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch], // status RELEASED
        testResults: [],
      });
      const missingIssue = report.issues.find(
        (i) => i.code === 'MISSING_TEST_RESULT' || i.type === 'RELEASED_BATCH_NO_PASSING_TEST'
      );
      expect(missingIssue).toBeDefined();
    });

    // TC09: Có nhiều phiếu, một phiếu cũ FAIL, phiếu authoritative PASS -> Không cảnh báo sai
    it('TC09: Có nhiều phiếu, một phiếu cũ FAIL, phiếu authoritative PASS -> Không cảnh báo sai', () => {
      const oldFailTest: any = {
        id: 'tr_old_fail_tc09',
        batchId: sampleBatch.id,
        labName: 'Lab Internal',
        testDate: '2024-01-02',
        overallStatus: 'FAIL',
        version: 1,
        results: [{ criteriaName: 'Độ ẩm', value: 15, isPass: false }],
        createdAt: '2024-01-02',
      };
      const newPassTest: any = {
        id: 'tr_new_pass_tc09',
        batchId: sampleBatch.id,
        labName: 'Quatest 3',
        testDate: '2024-01-06',
        overallStatus: 'PASS',
        status: 'FINAL',
        version: 2,
        results: [{ criteriaName: 'Độ ẩm', value: 5, isPass: true }],
        createdAt: '2024-01-06',
      };
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [oldFailTest, newPassTest],
      });
      // Không có cảnh báo sai lệch cho phiếu cũ vì phiếu cũ tự thân đúng (FAIL == FAIL)
      // Và lô đã có phiếu authoritative đạt
      const mismatch = report.issues.find(
        (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
      );
      expect(mismatch).toBeUndefined();
      const releasedAlert = report.issues.find(
        (i) => i.code === 'MISSING_TEST_RESULT' || i.type === 'RELEASED_BATCH_NO_PASSING_TEST'
      );
      expect(releasedAlert).toBeUndefined();
    });

    // TC10: Status có khoảng trắng/chữ hoa/chữ thường -> Normalize -> đúng trạng thái
    it('TC10: Status có khoảng trắng/chữ hoa/chữ thường (" đạt ", "ĐẠT", "pass") -> Normalize -> không cảnh báo', () => {
      const trWhitespace: any = {
        ...sampleTestResult,
        id: 'tr_whitespace',
        overallStatus: '  đạt  ',
        results: [{ criteriaName: 'Định lượng', value: 100, isPass: true }],
      };
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [trWhitespace],
      });
      const mismatch = report.issues.find(
        (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
      );
      expect(mismatch).toBeUndefined();
    });

    // TC11: Dữ liệu đang loading -> Không tạo discrepancy giả
    it('TC11: Dữ liệu đang loading -> Không tạo discrepancy giả', () => {
      const trBad: TestResult = {
        ...sampleTestResult,
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ ẩm', value: 20, isPass: false }],
      };
      const report = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [trBad],
        dataFreshness: {
          isTestResultsLoading: true,
          testResultsLoaded: false,
        },
      });
      const mismatch = report.issues.find(
        (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
      );
      expect(mismatch).toBeUndefined();
      const releasedAlert = report.issues.find(
        (i) => i.code === 'MISSING_TEST_RESULT' || i.type === 'RELEASED_BATCH_NO_PASSING_TEST'
      );
      expect(releasedAlert).toBeUndefined();
    });

    // TC12: Sau khi sửa phiếu từ FAIL -> PASS -> Reconciliation cập nhật ngay
    it('TC12: Sau khi sửa phiếu từ FAIL -> PASS -> Reconciliation cập nhật ngay', () => {
      // Ban đầu có sai lệch: lưu PASS nhưng chỉ tiêu FAIL
      const initialTR: TestResult = {
        ...sampleTestResult,
        id: 'tr_tc12',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Định lượng', value: 40, isPass: false }],
      };
      const report1 = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [initialTR],
      });
      expect(
        report1.issues.some(
          (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
        )
      ).toBe(true);

      // Sửa chỉ tiêu thành PASS (hoặc cập nhật kết quả kiểm nghiệm mới)
      const fixedTR: TestResult = {
        ...initialTR,
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Định lượng', value: 100, isPass: true }],
      };
      const report2 = auditDataConsistency({
        products: [sampleProduct],
        rawMaterials: [sampleRawMaterial],
        tccsList: [sampleTCCS],
        productFormulas: [sampleFormula],
        batches: [sampleBatch],
        testResults: [fixedTR],
      });
      expect(
        report2.issues.some(
          (i) => i.code === 'STATUS_MISMATCH' || i.type === 'TEST_RESULT_STATUS_MISMATCH'
        )
      ).toBe(false);
    });
  });
});
