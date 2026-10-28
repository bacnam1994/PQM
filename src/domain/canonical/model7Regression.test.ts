import { describe, it, expect } from 'vitest';
import {
  ConsistencyIssueFactory,
  ConsistencyAuditor,
  CanonicalConsistencyIssue,
  getEffectiveTccsId,
} from '../consistency/consistencyModel';
import { Product, Batch, TCCS, TestResult, QualityDeviation, CriterionType } from '../../types';

describe('Model 7 Regression Suite: Consistency & Reconciliation Model', () => {
  const mockProduct: Product = {
    id: 'prod-001',
    code: 'PROD-001',
    name: 'Paracetamol 500mg',
    group: 'Thuốc giảm đau',
    status: 'ACTIVE',
    registrationNo: 'VD-12345-20',
    registrationDate: '2020-01-01',
    registrant: 'V-Biotech',
    description: 'Thuốc hạ sốt giảm đau',
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
      { name: 'Định lượng', unit: '%', min: 90, max: 110, type: CriterionType.NUMBER },
      { name: 'Độ ẩm', unit: '%', min: 0, max: 5, type: CriterionType.NUMBER },
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
    tccsId: 'tccs-001',
    labName: 'Phòng Kiểm Nghiệm',
    testDate: '2026-09-05',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Định lượng', value: 100.2, isPass: true },
      { criteriaName: 'Độ ẩm', value: 3.5, isPass: true },
    ],
    createdAt: '2026-09-05T08:00:00.000Z',
  };

  describe('1. ConsistencyIssueFactory', () => {
    it('createIssue: tạo bản ghi sai lệch chuẩn hóa kèm mã băm ALCOA+ và trạng thái DETECTED', () => {
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
      expect(issue.severity).toBe('CRITICAL');
      expect(issue.status).toBe('DETECTED');
      expect(issue.canAutoHeal).toBe(true);
      expect(issue.detectedAt).toBeDefined();
    });

    it('createOrphanIssue: tạo bản ghi mồ côi với mức CRITICAL và chiến lược CONTROLLED_HEAL', () => {
      const issue = ConsistencyIssueFactory.createOrphanIssue({
        entityType: 'TEST_RESULT',
        entityId: 'tr-orphan',
        missingParentType: 'BATCH',
        foreignKeyField: 'batchId',
        foreignKeyValue: 'batch-non-existent',
      });

      expect(issue.type).toBe('ORPHAN_RECORD');
      expect(issue.severity).toBe('CRITICAL');
      expect(issue.healingStrategy).toBe('CONTROLLED_HEAL');
      expect(issue.field).toBe('batchId');
    });

    it('createStatusMismatchIssue: gán NEVER_AUTO_HEAL khi trạng thái đúng là FAIL (GMP Invariant)', () => {
      const issue = ConsistencyIssueFactory.createStatusMismatchIssue({
        entityType: 'TEST_RESULT',
        entityId: 'tr-001',
        expectedStatus: 'FAIL',
        actualStatus: 'PASS',
      });

      expect(issue.type).toBe('STATUS_MISMATCH');
      expect(issue.severity).toBe('CRITICAL');
      expect(issue.healingStrategy).toBe('NEVER_AUTO_HEAL');
      expect(issue.canAutoHeal).toBe(false);
    });
  });

  describe('2. ConsistencyAuditor.auditEntityIdentities', () => {
    it('phát hiện bản ghi mồ côi (TestResult không có Batch, Batch không có Product)', () => {
      const orphanTest: TestResult = {
        ...mockTestResultPass,
        id: 'tr-orphan-01',
        batchId: 'batch-ghost',
      };
      const orphanBatch: Batch = {
        ...mockBatch,
        id: 'batch-orphan-01',
        productId: 'prod-ghost',
      };

      const issues = ConsistencyAuditor.auditEntityIdentities({
        products: [mockProduct],
        batches: [mockBatch, orphanBatch],
        tccsList: [mockTccs],
        testResults: [mockTestResultPass, orphanTest],
      });

      const orphanIssues = issues.filter((i) => i.type === 'ORPHAN_RECORD');
      expect(orphanIssues.length).toBeGreaterThanOrEqual(2);
      expect(orphanIssues.some((i) => i.entityId === 'tr-orphan-01')).toBe(true);
      expect(orphanIssues.some((i) => i.entityId === 'batch-orphan-01')).toBe(true);
    });

    it('phát hiện trùng lặp mã sản phẩm và tham chiếu batchNo legacy', () => {
      const dupProduct: Product = {
        ...mockProduct,
        id: 'prod-002',
        code: 'PROD-001', // Trùng mã
      };
      const legacyTest: TestResult = {
        ...mockTestResultPass,
        id: 'tr-legacy-01',
        batchId: 'B260901', // Trỏ bằng batchNo thay vì batch-001
      };

      const issues = ConsistencyAuditor.auditEntityIdentities({
        products: [mockProduct, dupProduct],
        batches: [mockBatch],
        tccsList: [mockTccs],
        testResults: [legacyTest],
      });

      expect(issues.some((i) => i.type === 'DUPLICATE_ENTITY')).toBe(true);
      expect(issues.some((i) => i.type === 'INVALID_REFERENCE')).toBe(true);
    });
  });

  describe('3. ConsistencyAuditor.auditStatusConsistency', () => {
    it('phát hiện xung đột trạng thái phiếu kiểm nghiệm giữa stored và computed', () => {
      const corruptedTest: TestResult = {
        ...mockTestResultPass,
        id: 'tr-corrupted',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Định lượng', value: 80.0, isPass: false }, // Rớt định lượng
        ],
      };

      const issues = ConsistencyAuditor.auditStatusConsistency({
        testResults: [corruptedTest],
        batches: [mockBatch],
        tccsList: [mockTccs],
      });

      const statusMismatch = issues.find(
        (i) => i.type === 'STATUS_MISMATCH' && i.entityId === 'tr-corrupted'
      );
      expect(statusMismatch).toBeDefined();
      expect(statusMismatch?.expected).toBe('FAIL');
      expect(statusMismatch?.severity).toBe('CRITICAL');
      expect(statusMismatch?.healingStrategy).toBe('NEVER_AUTO_HEAL');
    });

    it('phát hiện Lô đã xuất xưởng (RELEASED) nhưng chưa có kiểm nghiệm đạt hoặc có sai lệch CRITICAL', () => {
      const releasedBatch: Batch = {
        ...mockBatch,
        id: 'batch-released-invalid',
        status: 'RELEASED',
      };

      const openDev: QualityDeviation = {
        id: 'dev-001',
        deviationNo: 'DEV-2026-0001',
        batchId: 'batch-released-invalid',
        severity: 'CRITICAL',
        status: 'LOGGED',
        title: 'Lỗi thiết bị dập viên',
        source: 'MANUFACTURING',
        description: 'Máy rung lắc mạnh',
        loggedBy: 'qa',
        loggedAt: '2026-09-02T00:00:00Z',
        version: 1,
        updatedAt: '2026-09-02T00:00:00Z',
      };

      const issues = ConsistencyAuditor.auditStatusConsistency({
        testResults: [], // Không có phiếu kiểm nghiệm đạt nào
        batches: [releasedBatch],
        tccsList: [mockTccs],
        deviations: [openDev],
      });

      expect(issues.some((i) => i.type === 'STATUS_MISMATCH')).toBe(true);
      expect(issues.some((i) => i.type === 'INVALID_BUSINESS_RULE')).toBe(true);
    });

    it('CONFLICT-003: giải quyết TCCS 3 tầng và đánh dấu INCOMPLETE thay vì CONTRADICTORY khi thiếu TCCS', () => {
      // 1. Kiểm tra 3 tầng của getEffectiveTccsId
      const trTier1: TestResult = {
        ...mockTestResultPass,
        tccsId: 'tccs-tier1',
        evaluationSnapshot: { tccsId: 'tccs-snap' } as any,
      };
      expect(getEffectiveTccsId(trTier1, { tccsId: 'tccs-batch' } as any)).toBe('tccs-tier1');

      const trTier2: TestResult = {
        ...mockTestResultPass,
        tccsId: undefined,
        evaluationSnapshot: { tccsId: 'tccs-snap' } as any,
      };
      expect(getEffectiveTccsId(trTier2, { tccsId: 'tccs-batch' } as any)).toBe('tccs-batch');

      const trTier3: TestResult = {
        ...mockTestResultPass,
        tccsId: undefined,
        evaluationSnapshot: { tccsId: 'tccs-snap' } as any,
      };
      expect(getEffectiveTccsId(trTier3, {} as any)).toBe('tccs-snap');

      // 2. Khi khuyết TCCS sau 3 tầng: đánh dấu INCOMPLETE thay vì CONTRADICTORY
      const trMissingTccs: TestResult = {
        ...mockTestResultPass,
        id: 'tr-no-tccs',
        tccsId: undefined,
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Định tính', value: 'Dương tính', isPass: null }],
        evaluationSnapshot: undefined,
      };

      const issues = ConsistencyAuditor.auditStatusConsistency({
        testResults: [trMissingTccs],
        batches: [{ ...mockBatch, tccsId: undefined }],
        tccsList: [],
      });

      const issue = issues.find((i) => i.entityId === 'tr-no-tccs');
      if (issue) {
        expect(issue.category).toBe('INCOMPLETE');
        expect(issue.category).not.toBe('CONTRADICTORY');
        expect(issue.severity).not.toBe('CRITICAL');
      }
    });
  });

  describe('4. ConsistencyAuditor.auditSpecificationIntegrity & auditBatchDates', () => {
    it('phát hiện sản phẩm có nhiều TCCS hiệu lực cùng lúc', () => {
      const tccs2: TCCS = {
        ...mockTccs,
        id: 'tccs-002',
        code: 'TCCS-002',
        isActive: true,
      };

      const issues = ConsistencyAuditor.auditSpecificationIntegrity({
        products: [mockProduct],
        tccsList: [mockTccs, tccs2],
      });

      expect(issues.some((i) => i.type === 'DUPLICATE_ENTITY')).toBe(true);
    });

    it('phát hiện TCCS có chỉ tiêu min > max', () => {
      const invalidTccs: TCCS = {
        ...mockTccs,
        mainQualityCriteria: [
          { name: 'Độ ẩm', unit: '%', min: 10, max: 5, type: CriterionType.NUMBER },
        ],
      };

      const issues = ConsistencyAuditor.auditSpecificationIntegrity({
        products: [mockProduct],
        tccsList: [invalidTccs],
      });

      expect(issues.some((i) => i.type === 'INVALID_SCHEMA')).toBe(true);
    });

    it('auditBatchDates: phát hiện hạn dùng đứng trước ngày sản xuất (expDate < mfgDate)', () => {
      const invalidDateBatch: Batch = {
        ...mockBatch,
        id: 'batch-date-err',
        mfgDate: '2026-09-01',
        expDate: '2025-09-01',
      };

      const issues = ConsistencyAuditor.auditBatchDates([invalidDateBatch]);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('INVALID_SCHEMA');
      expect(issues[0].severity).toBe('CRITICAL');
    });
  });

  describe('5. Comprehensive Audit & Metrics Engine', () => {
    it('auditComprehensive: xuất báo cáo toàn diện và tính toán metrics chính xác', () => {
      const cleanDataset = {
        products: [mockProduct],
        batches: [mockBatch],
        tccsList: [mockTccs],
        testResults: [mockTestResultPass],
      };

      const cleanReport = ConsistencyAuditor.auditComprehensive(cleanDataset);
      expect(cleanReport.isHealthy).toBe(true);
      expect(cleanReport.metrics.totalIssues).toBe(0);
      expect(cleanReport.metrics.score).toBe(100);

      // Dataset có lỗi
      const dirtyDataset = {
        products: [mockProduct],
        batches: [{ ...mockBatch, expDate: '2020-01-01' }], // expDate < mfgDate (CRITICAL)
        tccsList: [mockTccs],
        testResults: [mockTestResultPass],
      };

      const dirtyReport = ConsistencyAuditor.auditComprehensive(dirtyDataset);
      expect(dirtyReport.isHealthy).toBe(false);
      expect(dirtyReport.metrics.criticalCount).toBe(1);
      expect(dirtyReport.metrics.score).toBeLessThan(100);

      // Thử các helper filter & group
      const criticals = ConsistencyAuditor.filterBySeverity(dirtyReport.issues, 'CRITICAL');
      expect(criticals.length).toBe(1);

      const grouped = ConsistencyAuditor.groupIssuesByType(dirtyReport.issues);
      expect(grouped.INVALID_SCHEMA?.length).toBe(1);
    });
  });
});
