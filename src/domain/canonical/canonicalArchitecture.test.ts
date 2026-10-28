import { describe, it, expect } from 'vitest';
import {
  BaseEntity,
  TestResultStatus,
  BatchStatus,
  CanonicalBatchQualityStatus,
  CanonicalStatusResolver,
  EntityIdentityManager,
  DataLineageManager,
  ValidationEngine,
  BatchRules,
  TestResultRules,
  ReleaseRules,
  TCCSRules,
  ConsistencyIssueFactory,
  AutoHealingFramework,
  AlcoaAuditManager,
  BatchStateMachine,
  TestResultStateMachine,
  ConcurrencyManager,
  ConcurrentModificationError,
  ObservabilityManager,
} from '../index';
import { Batch, TestResult, Product, TCCS, ProductFormula, CriterionType } from '../../types';

describe('12 Core Canonical Models Architecture Suite', () => {
  const mockProduct: Product = {
    id: 'prod-001',
    code: 'PROD-001',
    name: 'Sản phẩm thử nghiệm A',
    group: 'Dược phẩm',
    status: 'ACTIVE',
    registrationNo: 'VD-12345-20',
    registrationDate: '2020-01-01',
    registrant: 'V-Biotech',
    description: 'Mô tả sản phẩm',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockTccs: TCCS = {
    id: 'tccs-001',
    productId: 'prod-001',
    code: 'TCCS-001',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      { name: 'Độ ẩm', unit: '%', min: 0, max: 5, type: CriterionType.NUMBER },
      { name: 'Định lượng hoạt chất', unit: 'mg', min: 90, max: 110, type: CriterionType.NUMBER },
    ],
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const mockBatch: Batch = {
    id: 'batch-001',
    productId: 'prod-001',
    tccsId: 'tccs-001',
    batchNo: 'B260901',
    mfgDate: '2026-09-01',
    expDate: '2028-09-01',
    theoreticalYield: 1000,
    actualYield: 995,
    yieldUnit: 'chai',
    status: 'TESTING',
    createdAt: '2026-09-01T08:00:00.000Z',
  };

  const mockTestResultPass: TestResult = {
    id: 'tr-001',
    batchId: 'batch-001',
    labName: 'QUATEST 3',
    testDate: '2026-09-05',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Độ ẩm', value: 3.2, isPass: true },
      { criteriaName: 'Định lượng hoạt chất', value: 98.5, isPass: true },
    ],
    createdAt: '2026-09-05T10:00:00.000Z',
  };

  const mockTestResultFail: TestResult = {
    id: 'tr-002',
    batchId: 'batch-001',
    labName: 'QUATEST 3',
    testDate: '2026-09-06',
    overallStatus: 'FAIL',
    results: [
      { criteriaName: 'Độ ẩm', value: 7.5, isPass: false },
      { criteriaName: 'Định lượng hoạt chất', value: 98.5, isPass: true },
    ],
    createdAt: '2026-09-06T10:00:00.000Z',
  };

  // 1. Model 1: Canonical Data Model
  describe('Model 1: Canonical Data Model', () => {
    it('chuẩn hóa BaseEntity chứa đầy đủ các trường nền tảng', () => {
      const entity: BaseEntity = {
        id: 'ent-1',
        createdAt: '2026-09-15T08:00:00Z',
        createdBy: 'user-01',
        updatedAt: '2026-09-15T09:00:00Z',
        updatedBy: 'user-02',
        version: 1,
        status: 'ACTIVE',
        metadata: { source: 'ERP_SYNC' },
      };
      expect(entity.id).toBe('ent-1');
      expect(entity.version).toBe(1);
      expect(entity.metadata?.source).toBe('ERP_SYNC');
    });
  });

  // 2. Model 2: Canonical Status Model & Resolver
  describe('Model 2: Canonical Status Model & Resolver', () => {
    it('phân giải chính xác trạng thái phiếu kiểm nghiệm và chất lượng lô', () => {
      const testStatus = CanonicalStatusResolver.calculateCanonicalTestStatus(mockTestResultPass);
      expect(testStatus).toBe('PASS');

      const failStatus = CanonicalStatusResolver.calculateCanonicalTestStatus(mockTestResultFail);
      expect(failStatus).toBe('FAIL');

      const batchQuality = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(mockBatch, [
        mockTestResultPass,
      ]);
      expect(batchQuality).toBe('PASS');
    });

    it('phát hiện sai lệch giữa stored overallStatus và kết quả tính toán', () => {
      const invalidPassResult: TestResult = {
        ...mockTestResultPass,
        id: 'tr-bad',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Độ ẩm', value: 8.0, isPass: false }, // FAIL
        ],
      };

      const res = CanonicalStatusResolver.resolveBatchQuality(mockBatch, [invalidPassResult]);
      expect(res.hasDiscrepancy).toBe(true);
      expect(res.discrepancyDetails?.actual).toBe('PASS');
      expect(res.discrepancyDetails?.expected).toBe('FAIL');
    });
  });

  // 3. Model 3: Entity Identity Model
  describe('Model 3: Entity Identity Model', () => {
    it('xác thực thành công quan hệ khi sử dụng đúng Technical ID', () => {
      const check = EntityIdentityManager.validateTestResultBatch(mockTestResultPass, [mockBatch]);
      expect(check.isValid).toBe(true);
      expect(check.relationship).toBe('TEST_RESULT_BATCH_PRIMARY');
    });

    it('phát hiện lỗi legacy khi trỏ batchId bằng số lô batchNo', () => {
      const legacyTestResult: TestResult = {
        ...mockTestResultPass,
        id: 'tr-legacy',
        batchId: 'B260901', // trỏ bằng batchNo
      };
      const check = EntityIdentityManager.validateTestResultBatch(legacyTestResult, [mockBatch]);
      expect(check.isValid).toBe(false);
      expect(check.isLegacyMatch).toBe(true);
      expect(check.relationship).toBe('TEST_RESULT_BATCH_LEGACY_MATCH');
    });

    it('phát hiện phiếu mồ côi (Orphan)', () => {
      const orphanTest: TestResult = {
        ...mockTestResultPass,
        id: 'tr-orphan',
        batchId: 'batch-non-existent',
      };
      const check = EntityIdentityManager.validateTestResultBatch(orphanTest, [mockBatch]);
      expect(check.isValid).toBe(false);
      expect(check.relationship).toBe('TEST_RESULT_BATCH_ORPHAN');
    });
  });

  // 4. Model 4: Data Lineage Model
  describe('Model 4: Data Lineage Model', () => {
    it('truy vết toàn diện phả hệ dữ liệu của Lô sản xuất và giải trình nguồn gốc', () => {
      const lineage = DataLineageManager.buildBatchLineage({
        batch: mockBatch,
        products: [mockProduct],
        tccsList: [mockTccs],
        formulas: [],
        testResults: [mockTestResultPass],
      });

      expect(lineage.batch.batchNo).toBe('B260901');
      expect(lineage.product?.code).toBe('PROD-001');
      expect(lineage.tccs?.code).toBe('TCCS-001');
      expect(lineage.testResults).toHaveLength(1);
      expect(lineage.qualityExplanation.derivedValue).toBe('PASS');
      expect(lineage.qualityExplanation.sourceId).toBe('tr-001');
      expect(lineage.qualityExplanation.criteriaEvidence?.summary).toBe('2/2 chỉ tiêu ĐẠT');
    });
  });

  // 5. Model 5: 3-Tier Validation Model
  describe('Model 5: 3-Tier Validation Model', () => {
    it('vượt qua cả 3 tầng validation khi dữ liệu hợp lệ', () => {
      const res = ValidationEngine.validateTestResult(mockTestResultPass, [mockBatch], mockTccs);
      expect(res.isValid).toBe(true);
      expect(res.tier1Passed).toBe(true);
      expect(res.tier2Passed).toBe(true);
      expect(res.tier3Passed).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('chặn tại Tier 1 khi dữ liệu vi phạm Schema', () => {
      const badSchema = { overallStatus: 'PASS' }; // thiếu id, batchId, results
      const res = ValidationEngine.validateTestResult(badSchema, [mockBatch], mockTccs);
      expect(res.isValid).toBe(false);
      expect(res.tier1Passed).toBe(false);
    });

    it('chặn tại Tier 2 khi vi phạm Referential Integrity', () => {
      const orphanTest = { ...mockTestResultPass, batchId: 'unknown-batch' };
      const res = ValidationEngine.validateTestResult(orphanTest, [mockBatch], mockTccs);
      expect(res.isValid).toBe(false);
      expect(res.tier1Passed).toBe(true);
      expect(res.tier2Passed).toBe(false);
    });

    it('chặn tại Tier 3 khi vi phạm Business Rules (FAIL mà ghi PASS)', () => {
      const badBizTest = {
        ...mockTestResultPass,
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Chỉ tiêu A', value: 1, isPass: false }],
      };
      const res = ValidationEngine.validateTestResult(badBizTest, [mockBatch], mockTccs);
      expect(res.isValid).toBe(false);
      expect(res.tier2Passed).toBe(true);
      expect(res.tier3Passed).toBe(false);
      expect(res.errors[0].code).toBe('BIZ_STATUS_CRITERIA_MISMATCH');
    });
  });

  // 6. Model 6: Business Rule Engine
  describe('Model 6: Business Rule Engine', () => {
    it('BatchRules: ngăn chặn xuất xưởng khi kết quả kiểm nghiệm chưa đạt PASS', () => {
      const evalFail = BatchRules.canRelease(mockBatch, [mockTestResultFail], 'QA');
      expect(evalFail.allowed).toBe(false);
      expect(evalFail.blockers?.[0]).toContain('chưa đạt chuẩn PASS');

      const evalPass = BatchRules.canRelease(mockBatch, [mockTestResultPass], 'QA');
      expect(evalPass.allowed).toBe(true);
    });

    it('TestResultRules: chỉ cho phép ADMIN/QA/QC phê duyệt kết quả kiểm nghiệm', () => {
      const checkUser = TestResultRules.canApprove(mockTestResultPass, 'USER');
      expect(checkUser.allowed).toBe(false);

      const checkQA = TestResultRules.canApprove(mockTestResultPass, 'QA');
      expect(checkQA.allowed).toBe(true);
    });

    it('ReleaseRules: đánh giá toàn diện các điều kiện tiên quyết xuất xưởng', () => {
      const prereq = ReleaseRules.evaluateReleasePrerequisites({
        batch: mockBatch,
        testResults: [mockTestResultPass],
        userRole: 'QA',
      });
      expect(prereq.isEligibleForRelease).toBe(true);
      expect(prereq.score).toBe(100);
    });

    it('ReleaseRules: cho phép xuất xưởng khi phiếu có chỉ tiêu cảm quan/text (isPass: null)', () => {
      const testResultWithSensory: TestResult = {
        ...mockTestResultPass,
        id: 'tr-sensory',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Định lượng', value: 99.5, isPass: true },
          { criteriaName: 'Cảm quan', value: 'Bột màu trắng', isPass: null as any },
          { criteriaName: 'Ghi chú', value: 'Đạt yêu cầu', isPass: undefined },
        ],
      };

      const prereq = ReleaseRules.evaluateReleasePrerequisites({
        batch: mockBatch,
        testResults: [testResultWithSensory],
        userRole: 'QA',
      });

      expect(prereq.isEligibleForRelease).toBe(true);
      expect(prereq.criteriaMet.allTestCriteriaPassed).toBe(true);
    });

    it('ReleaseRules: cho phép xuất xưởng khi chỉ tiêu rớt được cứu bởi alternateRules (FAIL_RETRY)', () => {
      const tccsWithRetry: TCCS = {
        ...mockTccs,
        mainQualityCriteria: [
          { name: 'Độ rã', unit: 'phút', min: 0, max: 15, type: CriterionType.NUMBER },
        ],
        alternateRules: [
          {
            main: 'Độ rã',
            alt: 'Độ rã lần 2',
            type: 'FAIL_RETRY' as any,
          },
        ],
      };

      const testResultWithRetry: TestResult = {
        ...mockTestResultPass,
        id: 'tr-retry',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Độ rã', value: '18 phút', isPass: false },
          { criteriaName: 'Độ rã lần 2', value: '12 phút', isPass: true },
        ],
      };

      const prereq = ReleaseRules.evaluateReleasePrerequisites({
        batch: mockBatch,
        testResults: [testResultWithRetry],
        userRole: 'QA',
        boundTccs: tccsWithRetry,
      });

      expect(prereq.isEligibleForRelease).toBe(true);
      expect(prereq.criteriaMet.allTestCriteriaPassed).toBe(true);
    });

    it('ReleaseRules: chặn xuất xưởng khi có chỉ tiêu OOS không đạt và không có luật cứu', () => {
      const prereq = ReleaseRules.evaluateReleasePrerequisites({
        batch: mockBatch,
        testResults: [mockTestResultFail],
        userRole: 'QA',
      });

      expect(prereq.isEligibleForRelease).toBe(false);
      expect(prereq.criteriaMet.allTestCriteriaPassed).toBe(false);
      expect(prereq.blockers.length).toBeGreaterThan(0);
      expect(prereq.blockers[0]).toContain('chưa đạt chuẩn PASS');
    });

    it('ReleaseRules: cho phép xuất xưởng khi lô có nhiều phiếu kiểm nghiệm chia theo lab (Hóa lý + Vi sinh) cùng đạt', () => {
      const chemistryTest: TestResult = {
        ...mockTestResultPass,
        id: 'tr-chem',
        labName: 'Phòng Kiểm Nghiệm Hóa Lý',
        results: [
          { criteriaName: 'Định lượng', value: 100.2, isPass: true },
          { criteriaName: 'Độ ẩm', value: 3.5, isPass: true },
        ],
      };

      const microbiologyTest: TestResult = {
        ...mockTestResultPass,
        id: 'tr-micro',
        labName: 'Phòng Kiểm Nghiệm Vi Sinh',
        results: [
          { criteriaName: 'Tổng số vi sinh vật hiếu khí', value: 10, isPass: true },
          { criteriaName: 'E. coli', value: 'Âm tính', isPass: true },
        ],
      };

      const prereq = ReleaseRules.evaluateReleasePrerequisites({
        batch: mockBatch,
        testResults: [chemistryTest, microbiologyTest],
        userRole: 'QA',
      });

      expect(prereq.isEligibleForRelease).toBe(true);
      expect(prereq.criteriaMet.allTestCriteriaPassed).toBe(true);
    });

    it('TCCSRules: phát hiện lỗi thiếu TCCS hoặc trùng lặp nhiều TCCS hiệu lực', () => {
      const checkValid = TCCSRules.validateActiveStatus('prod-001', [mockTccs]);
      expect(checkValid.isValid).toBe(true);

      const checkDuplicate = TCCSRules.validateActiveStatus('prod-001', [
        mockTccs,
        { ...mockTccs, id: 'tccs-002', code: 'TCCS-002', isActive: true },
      ]);
      expect(checkDuplicate.isValid).toBe(false);
      expect(checkDuplicate.issue).toBe('MULTIPLE_ACTIVE_TCCS');
    });
  });

  // 7. Model 7: Consistency Model
  describe('Model 7: Consistency Model', () => {
    it('tạo chuẩn hóa bản ghi sai lệch ConsistencyIssue với đầy đủ thông tin ALCOA+', () => {
      const issue = ConsistencyIssueFactory.createIssue({
        type: 'STATUS_MISMATCH',
        severity: 'CRITICAL',
        entityType: 'BATCH',
        entityId: 'batch-001',
        field: 'status',
        expected: 'PASS',
        actual: 'FAIL',
        source: 'CanonicalResolver',
        healingStrategy: 'CONTROLLED_HEAL',
      });

      expect(issue.id).toContain('ISSUE-');
      expect(issue.type).toBe('STATUS_MISMATCH');
      expect(issue.canAutoHeal).toBe(true);
      expect(issue.status).toBe('DETECTED');
    });
  });

  // 8. Model 8: Auto-Healing Model
  describe('Model 8: Auto-Healing Model', () => {
    it('phân loại chính xác chiến lược SAFE, CONTROLLED, NEVER AUTO-HEAL', () => {
      expect(
        AutoHealingFramework.determineHealingStrategy('TEST_RESULT', 'results', 'CRITERIA_FAIL')
      ).toBe('NEVER_AUTO_HEAL');
      expect(
        AutoHealingFramework.determineHealingStrategy(
          'TEST_RESULT',
          'overallStatusFormat',
          'FORMAT_MISMATCH'
        )
      ).toBe('SAFE_AUTO_HEAL');
      expect(
        AutoHealingFramework.determineHealingStrategy('BATCH', 'batchId', 'INVALID_REFERENCE')
      ).toBe('CONTROLLED_HEAL');
    });

    it('tạo preview chi tiết trước khi hàn gắn', () => {
      const issue = ConsistencyIssueFactory.createIssue({
        type: 'INVALID_REFERENCE',
        severity: 'WARNING',
        entityType: 'TEST_RESULT',
        entityId: 'tr-001',
        field: 'batchId',
        expected: 'batch-001',
        actual: 'B260901',
        source: 'EntityIdentityManager',
        healingStrategy: 'CONTROLLED_HEAL',
      });

      const preview = AutoHealingFramework.previewHealing(issue);
      expect(preview.requiresManualApproval).toBe(true);
      expect(preview.strategy).toBe('CONTROLLED_HEAL');
      expect(preview.proposedValue).toBe('batch-001');
    });
  });

  // 9. Model 9: Audit Trail Model (ALCOA+)
  describe('Model 9: Audit Trail Model (ALCOA+)', () => {
    it('tạo bản ghi kiểm toán kèm mã băm SHA-256 và xác thực tính toàn vẹn chuỗi', async () => {
      const log1 = await AlcoaAuditManager.createRecord({
        entityType: 'BATCH',
        entityId: 'batch-001',
        action: 'UPDATE',
        field: 'status',
        oldValue: 'PENDING',
        newValue: 'TESTING',
        userId: 'qa-user-01',
        reason: 'Bắt đầu gửi mẫu kiểm nghiệm',
      });

      const log2 = await AlcoaAuditManager.createRecord({
        entityType: 'BATCH',
        entityId: 'batch-001',
        action: 'STATUS_CHANGE',
        field: 'status',
        oldValue: 'TESTING',
        newValue: 'RELEASED',
        userId: 'admin-01',
        reason: 'Ký duyệt xuất xưởng sau khi có kết quả đạt',
        previousHash: log1.entryHash,
      });

      const verifyValid = await AlcoaAuditManager.verifyChainIntegrity([log1, log2]);
      expect(verifyValid.isValid).toBe(true);

      // Thử can thiệp giả mạo dữ liệu
      const tamperedLog2 = { ...log2, newValue: 'REJECTED' };
      const verifyTampered = await AlcoaAuditManager.verifyChainIntegrity([log1, tamperedLog2]);
      expect(verifyTampered.isValid).toBe(false);
      expect(verifyTampered.tamperedIndex).toBe(1);
    });
  });

  // 10. Model 10: Workflow State Machine
  describe('Model 10: Workflow State Machine', () => {
    it('cho phép chuyển trạng thái hợp lệ: PENDING -> TESTING -> RELEASED', () => {
      const step1 = BatchStateMachine.transition('PENDING', 'TESTING', 'START_TESTING');
      expect(step1.success).toBe(true);

      const step2 = BatchStateMachine.transition('TESTING', 'RELEASED', 'RELEASE_BATCH', {
        actorRole: 'QA',
        conditionsMet: true,
      });
      expect(step2.success).toBe(true);
    });

    it('chặn bước nhảy trạng thái bất hợp pháp: RELEASED -> PENDING', () => {
      const illegal = BatchStateMachine.transition('RELEASED', 'PENDING', 'RESET_BATCH');
      expect(illegal.success).toBe(false);
      expect(illegal.error).toContain('Chuyển đổi trạng thái không hợp lệ');
    });

    it('TestResultStateMachine: quản lý chuyển trạng thái phiếu kiểm nghiệm', () => {
      const res = TestResultStateMachine.transition('PENDING', 'PASS', 'EVALUATE_PASS');
      expect(res.success).toBe(true);

      const superseded = TestResultStateMachine.transition(
        'PASS',
        'SUPERSEDED',
        'RETEST_NEW_RESULT'
      );
      expect(superseded.success).toBe(true);
    });
  });

  // 11. Model 11: Concurrency & Versioning Model
  describe('Model 11: Concurrency & Versioning Model', () => {
    it('kiểm tra khớp phiên bản thành công', () => {
      const entity = { id: 'batch-001', version: 3 };
      const check = ConcurrencyManager.verifyVersion(entity, 3);
      expect(check.isValid).toBe(true);
    });

    it('báo lỗi CONCURRENT_MODIFICATION khi xung đột phiên bản', () => {
      const entity = { id: 'batch-001', version: 4 };
      const check = ConcurrencyManager.verifyVersion(entity, 3);
      expect(check.isValid).toBe(false);
      expect(check.error).toBeInstanceOf(ConcurrentModificationError);
      expect(check.error?.expectedVersion).toBe(3);
      expect(check.error?.actualVersion).toBe(4);
    });

    it('tăng phiên bản tuần tự khi cập nhật dữ liệu', () => {
      const entity = { id: 'batch-001', version: 2, updatedAt: '2026-09-01' };
      const updated = ConcurrencyManager.prepareNextVersion(entity, 'user-qa');
      expect(updated.version).toBe(3);
      expect(updated.updatedBy).toBe('user-qa');
    });
  });

  // 12. Model 12: Observability & Diagnostics Model
  describe('Model 12: Observability & Diagnostics Model', () => {
    it('bọc thực thi tác vụ với đầy đủ correlationId, duration và ghi nhận chẩn đoán', async () => {
      const execution = await ObservabilityManager.executeWithDiagnostics(
        'EVALUATE_BATCH_QUALITY',
        {
          entityType: 'BATCH',
          entityId: 'batch-001',
          resolver: 'CanonicalStatusResolver',
        },
        () => {
          return { status: 'PASS', score: 100 };
        }
      );

      expect(execution.result.status).toBe('PASS');
      expect(execution.diagnostics.correlationId).toBeDefined();
      expect(execution.diagnostics.durationMs).toBeGreaterThanOrEqual(0);
      expect(execution.diagnostics.operationName).toBe('EVALUATE_BATCH_QUALITY');

      const recentLogs = ObservabilityManager.getRecentDiagnostics(5);
      expect(recentLogs.some((l) => l.operationName === 'EVALUATE_BATCH_QUALITY')).toBe(true);
    });
  });
});
