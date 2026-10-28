/**
 * BatchInspectionProgressService.test.ts
 * ======================================
 * Unit Test Suite kiểm thử toàn diện tiến độ kiểm nghiệm, máy trạng thái,
 * tính toàn vẹn ALCOA+ và phân quyền RBAC.
 *
 * 10 Test Cases bắt buộc (TC-01 -> TC-10):
 * TC-01: 0/100 chỉ tiêu hoàn thành → NOT_TESTED, tiến độ 0%.
 * TC-02: 1/100 chỉ tiêu hoàn thành → IN_PROGRESS, tiến độ 1%.
 * TC-03: 99/100 chỉ tiêu hoàn thành → IN_PROGRESS, tiến độ 99% (tuyệt đối không PENDING_REVIEW).
 * TC-04: 100/100 chỉ tiêu hoàn thành → PENDING_REVIEW, tiến độ 100%.
 * TC-05: Dòng kết quả rỗng hoặc giá trị không parse được số cho NUMBER → không tính hoàn thành.
 * TC-06: Chỉ tiêu không bắt buộc (isExtra: true) và quy tắc miễn kiểm (Alternate Rule) → xử lý chuẩn xác.
 * TC-07: Không có chỉ tiêu bắt buộc (requiredCount = 0 hoặc không có TCCS) → NOT_TESTED, fail-closed.
 * TC-08: Tồn tại chỉ tiêu thất bại khi chưa đủ 100% → IN_PROGRESS, hasFailures = true, failedCriteria theo dõi.
 * TC-09: Dữ liệu biến thiên sau khi đã đánh giá → kết luận cũ bị vô hiệu hóa (stale protection), Lô RELEASED được bảo toàn.
 * TC-10: Tính tất định & Idempotency: Nhiều lần gọi đồng thời/tuần tự cho kết quả hoàn toàn trùng khớp 100%.
 *
 * Bonus: Kiểm thử RBAC validateInspectionEvaluation (QA/QC/ADMIN vs LAB/PRODUCTION).
 */

import { describe, it, expect } from 'vitest';
import {
  BatchInspectionProgressService,
  calculateInspectionProgress,
  validateInspectionEvaluation,
  resolveInspectionStatusWithFallback,
} from '../../src/domain/batch/BatchInspectionProgressService';
import { Batch, TestResult, TCCS, Criterion } from '../../src/types';

// ─── Helpers Tạo Dữ Liệu Kiểm Thử ──────────────────────────────────────────

function createMockTccs(criteriaCount: number, overrides: Partial<TCCS> = {}): TCCS {
  const mainQualityCriteria: Criterion[] = [];
  for (let i = 1; i <= criteriaCount; i++) {
    mainQualityCriteria.push({
      id: `crit_${i}`,
      name: `Chỉ tiêu ${i}`,
      type: 'NUMBER',
      min: 90,
      max: 110,
      unit: '%',
    });
  }
  return {
    id: 'tccs_mock_001',
    productId: 'prod_mock_001',
    code: 'TCCS-MOCK-001',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria,
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: 'batch_mock_001',
    productId: 'prod_mock_001',
    tccsId: 'tccs_mock_001',
    batchNo: 'BM-2026-001',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    batchSize: 1000,
    unit: 'chai',
    status: 'TESTING',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockTestResult(
  batchId: string,
  entries: Array<{
    name: string;
    value: any;
    isPass?: boolean;
    isExtra?: boolean;
    isExempted?: boolean;
  }>,
  overrides: Partial<TestResult> = {}
): TestResult {
  return {
    id: 'tr_mock_001',
    batchId,
    labName: 'QC V-Biotech',
    testDate: '2026-01-02',
    status: 'APPROVED',
    results: entries.map((e, idx) => ({
      id: `res_entry_${idx + 1}`,
      criteriaName: e.name,
      value: e.value,
      isPass: e.isPass ?? true,
      isExtra: e.isExtra,
      isExempted: e.isExempted,
    })),
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('BatchInspectionProgressService', () => {
  // TC-01: 0/100 chỉ tiêu hoàn thành → NOT_TESTED, tiến độ 0%
  it('TC-01: 0/100 chỉ tiêu hoàn thành → trạng thái là NOT_TESTED, tiến độ 0%', () => {
    const tccs = createMockTccs(100);
    const batch = createMockBatch({ tccsId: tccs.id });

    const result = calculateInspectionProgress({
      batch,
      testResults: [],
      boundTccs: tccs,
    });

    expect(result.status).toBe('NOT_TESTED');
    expect(result.progress.requiredCount).toBe(100);
    expect(result.progress.completedCount).toBe(0);
    expect(result.progress.percentage).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.hasFailures).toBe(false);
    expect(result.missingCriteria.length).toBe(100);
  });

  // TC-02: 1/100 chỉ tiêu hoàn thành → IN_PROGRESS, tiến độ 1%
  it('TC-02: 1/100 chỉ tiêu hoàn thành → trạng thái chuyển sang IN_PROGRESS, tiến độ 1%', () => {
    const tccs = createMockTccs(100);
    const batch = createMockBatch({ tccsId: tccs.id });
    const testResult = createMockTestResult(batch.id, [{ name: 'Chỉ tiêu 1', value: '100' }]);

    const result = calculateInspectionProgress({
      batch,
      testResults: [testResult],
      boundTccs: tccs,
    });

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.progress.requiredCount).toBe(100);
    expect(result.progress.completedCount).toBe(1);
    expect(result.progress.percentage).toBe(1);
    expect(result.isComplete).toBe(false);
    expect(result.completedCriteria).toEqual(['Chỉ tiêu 1']);
    expect(result.missingCriteria.length).toBe(99);
  });

  // TC-03: 99/100 chỉ tiêu hoàn thành → IN_PROGRESS, tiến độ 99% (tuyệt đối không PENDING_REVIEW)
  it('TC-03: 99/100 chỉ tiêu hoàn thành → giữ vững IN_PROGRESS, tiến độ 99%, TUYỆT ĐỐI KHÔNG PENDING_REVIEW', () => {
    const tccs = createMockTccs(100);
    const batch = createMockBatch({ tccsId: tccs.id });

    // Tạo 99 entries hoàn thành hợp lệ
    const entries = [];
    for (let i = 1; i <= 99; i++) {
      entries.push({ name: `Chỉ tiêu ${i}`, value: '100' });
    }
    const testResult = createMockTestResult(batch.id, entries);

    const result = calculateInspectionProgress({
      batch,
      testResults: [testResult],
      boundTccs: tccs,
    });

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.progress.requiredCount).toBe(100);
    expect(result.progress.completedCount).toBe(99);
    expect(result.progress.percentage).toBe(99);
    expect(result.isComplete).toBe(false);
    expect(result.missingCriteria).toEqual(['Chỉ tiêu 100']);
  });

  // TC-04: 100/100 chỉ tiêu hoàn thành → PENDING_REVIEW, tiến độ 100%
  it('TC-04: 100/100 chỉ tiêu hoàn thành → trạng thái chuyển sang PENDING_REVIEW, tiến độ 100%', () => {
    const tccs = createMockTccs(100);
    const batch = createMockBatch({ tccsId: tccs.id });

    const entries = [];
    for (let i = 1; i <= 100; i++) {
      entries.push({ name: `Chỉ tiêu ${i}`, value: '100' });
    }
    const testResult = createMockTestResult(batch.id, entries);

    const result = calculateInspectionProgress({
      batch,
      testResults: [testResult],
      boundTccs: tccs,
    });

    expect(result.status).toBe('PENDING_REVIEW');
    expect(result.progress.requiredCount).toBe(100);
    expect(result.progress.completedCount).toBe(100);
    expect(result.progress.percentage).toBe(100);
    expect(result.isComplete).toBe(true);
    expect(result.missingCriteria).toHaveLength(0);
    expect(result.hasFailures).toBe(false);
    expect(result.evaluationHash).toBeTruthy();
  });

  // TC-05: Dòng kết quả rỗng hoặc giá trị không parse được số cho NUMBER → không tính hoàn thành
  it('TC-05: Dòng kết quả rỗng hoặc giá trị "abc" cho NUMBER → không tính vào completedCount', () => {
    const tccs = createMockTccs(2);
    const batch = createMockBatch({ tccsId: tccs.id });

    // Chỉ tiêu 1: giá trị "abc" (không parse được số)
    // Chỉ tiêu 2: giá trị "" (rỗng)
    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 'abc' },
      { name: 'Chỉ tiêu 2', value: '   ' },
    ]);

    const result = calculateInspectionProgress({
      batch,
      testResults: [testResult],
      boundTccs: tccs,
    });

    expect(result.status).toBe('NOT_TESTED');
    expect(result.progress.requiredCount).toBe(2);
    expect(result.progress.completedCount).toBe(0);
    expect(result.progress.percentage).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.missingCriteria).toEqual(['Chỉ tiêu 1', 'Chỉ tiêu 2']);
  });

  // TC-06: Chỉ tiêu không bắt buộc (isExtra: true) và quy tắc miễn kiểm (Alternate Rule)
  it('TC-06: Chỉ tiêu phụ (isExtra: true) bị loại bỏ khỏi requiredCount, chỉ tiêu miễn kiểm tính hoàn thành', () => {
    const tccs: TCCS = {
      id: 'tccs_002',
      productId: 'prod_002',
      code: 'TCCS-002',
      issueDate: '2026-01-01',
      isActive: true,
      mainQualityCriteria: [
        { id: 'c1', name: 'Định lượng A', type: 'NUMBER', min: 90, max: 110 },
        { id: 'c2', name: 'Chỉ tiêu phụ tham khảo', type: 'TEXT', isExtra: true } as any,
      ],
      safetyCriteria: [{ id: 'c3', name: 'Độc tố vi nấm B', type: 'NUMBER', max: 10 }],
      alternateRules: [
        {
          id: 'rule_1',
          tccsId: 'tccs_002',
          main: 'Định lượng A',
          alt: 'Độc tố vi nấm B',
          type: 'FAIL_RETRY',
          conditionValue: '<= 10',
        },
      ],
      createdAt: '2026-01-01T00:00:00Z',
    };

    const batch = createMockBatch({ tccsId: tccs.id });

    // Chỉ kiểm tra c1 và c3 có giá trị "Miễn kiểm"
    const testResult = createMockTestResult(batch.id, [
      { name: 'Định lượng A', value: '100' },
      { name: 'Độc tố vi nấm B', value: 'Miễn kiểm' },
      { name: 'Chỉ tiêu phụ tham khảo', value: 'Không bắt buộc', isExtra: true },
    ]);

    const result = calculateInspectionProgress({
      batch,
      testResults: [testResult],
      boundTccs: tccs,
    });

    // Chỉ tiêu phụ isExtra không tính vào requiredCount -> chỉ có 2 chỉ tiêu bắt buộc
    expect(result.progress.requiredCount).toBe(2);
    expect(result.progress.completedCount).toBe(2);
    expect(result.progress.percentage).toBe(100);
    expect(result.status).toBe('PENDING_REVIEW');
    expect(result.isComplete).toBe(true);
  });

  // TC-07: Không có chỉ tiêu bắt buộc (requiredCount = 0 hoặc không có TCCS) → NOT_TESTED, fail-closed
  it('TC-07: Không có chỉ tiêu bắt buộc hoặc không có TCCS → khóa chặt NOT_TESTED (Fail-Closed)', () => {
    const batchWithoutTccs = createMockBatch({ tccsId: undefined });

    const result1 = calculateInspectionProgress({
      batch: batchWithoutTccs,
      testResults: [],
      boundTccs: null,
    });

    expect(result1.status).toBe('NOT_TESTED');
    expect(result1.progress.requiredCount).toBe(0);
    expect(result1.progress.completedCount).toBe(0);
    expect(result1.isComplete).toBe(false);

    // TCCS rỗng chỉ tiêu
    const emptyTccs = createMockTccs(0);
    const result2 = calculateInspectionProgress({
      batch: createMockBatch({ tccsId: emptyTccs.id }),
      testResults: [],
      boundTccs: emptyTccs,
    });

    expect(result2.status).toBe('NOT_TESTED');
    expect(result2.progress.requiredCount).toBe(0);
    expect(result2.progress.completedCount).toBe(0);
    expect(result2.isComplete).toBe(false);
  });

  // TC-08: Tồn tại chỉ tiêu thất bại khi chưa đủ 100% → IN_PROGRESS, hasFailures = true, failedCriteria theo dõi
  it('TC-08: Chỉ tiêu thất bại khi chưa đủ 100% → IN_PROGRESS, hasFailures = true, failedCriteria được ghi nhận', () => {
    const tccs = createMockTccs(10);
    const batch = createMockBatch({ tccsId: tccs.id });

    // 5 chỉ tiêu đã kiểm: 4 đạt, 1 rớt (Chỉ tiêu 3 giá trị 80 < min 90)
    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: '100' },
      { name: 'Chỉ tiêu 2', value: '105' },
      { name: 'Chỉ tiêu 3', value: '80' }, // FAIL!
      { name: 'Chỉ tiêu 4', value: '95' },
      { name: 'Chỉ tiêu 5', value: '99' },
    ]);

    const result = calculateInspectionProgress({
      batch,
      testResults: [testResult],
      boundTccs: tccs,
    });

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.progress.requiredCount).toBe(10);
    expect(result.progress.completedCount).toBe(5);
    expect(result.progress.percentage).toBe(50);
    expect(result.hasFailures).toBe(true);
    expect(result.failedCriteria).toEqual(['Chỉ tiêu 3']);
    expect(result.isComplete).toBe(false);
  });

  // TC-09: Dữ liệu biến thiên sau khi đã đánh giá → kết luận cũ bị vô hiệu hóa (Stale Protection)
  it('TC-09: Sửa đổi dữ liệu kiểm nghiệm sau khi đã đánh giá PASS → tự động vô hiệu hóa kết luận cũ', () => {
    const tccs = createMockTccs(2);
    const batch = createMockBatch({ tccsId: tccs.id });

    const initialTestResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: '100' },
      { name: 'Chỉ tiêu 2', value: '100' },
    ]);

    // Lần 1: Tính toán và thẩm định PASS
    const initialCalc = calculateInspectionProgress({
      batch,
      testResults: [initialTestResult],
      boundTccs: tccs,
    });

    expect(initialCalc.status).toBe('PENDING_REVIEW');

    const evalValidation = validateInspectionEvaluation({
      batch,
      newStatus: 'PASS',
      user: { id: 'user_qa_1', name: 'QA Lead', role: 'QA' },
      progress: initialCalc.progress,
      hasFailures: initialCalc.hasFailures,
      evaluationHash: initialCalc.evaluationHash,
    });

    expect(evalValidation.valid).toBe(true);
    const validEvaluation = evalValidation.evaluation!;

    // Gắn kết luận PASS vào batch
    const batchWithPass: Batch = {
      ...batch,
      inspectionStatus: 'PASS',
      inspectionEvaluation: validEvaluation,
    };

    // Xác nhận khi dữ liệu chưa đổi thì status vẫn là PASS
    const recheckSameData = calculateInspectionProgress({
      batch: batchWithPass,
      testResults: [initialTestResult],
      boundTccs: tccs,
    });
    expect(recheckSameData.status).toBe('PASS');
    expect(recheckSameData.isEvaluationStale).toBe(false);

    // Bây giờ: Người dùng sửa đổi kết quả đo lường (Chỉ tiêu 2 đổi giá trị từ 100 thành 108)
    const mutatedTestResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: '100' },
      { name: 'Chỉ tiêu 2', value: '108' }, // mutated!
    ]);

    const checkAfterMutation = calculateInspectionProgress({
      batch: batchWithPass,
      testResults: [mutatedTestResult],
      boundTccs: tccs,
    });

    // Bị vô hiệu hóa! Trở về PENDING_REVIEW để QA thẩm định lại
    expect(checkAfterMutation.status).toBe('PENDING_REVIEW');
    expect(checkAfterMutation.isEvaluationStale).toBe(true);
    expect(checkAfterMutation.staleReason).toContain('biến thiên');
    expect(checkAfterMutation.evaluation).toBeUndefined();

    // Nếu dữ liệu bị xóa mất 1 chỉ tiêu
    const incompleteTestResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: '100' },
    ]);

    const checkAfterDeletion = calculateInspectionProgress({
      batch: batchWithPass,
      testResults: [incompleteTestResult],
      boundTccs: tccs,
    });

    // Bị vô hiệu hóa và trở về IN_PROGRESS!
    expect(checkAfterDeletion.status).toBe('IN_PROGRESS');
    expect(checkAfterDeletion.isEvaluationStale).toBe(true);
    expect(checkAfterDeletion.progress.completedCount).toBe(1);

    // Bảo vệ Lô đã Xuất xưởng (RELEASED): Lô đã RELEASED không bị lùi trạng thái
    const releasedBatch: Batch = {
      ...batchWithPass,
      status: 'RELEASED',
    };

    const checkReleased = calculateInspectionProgress({
      batch: releasedBatch,
      testResults: [mutatedTestResult],
      boundTccs: tccs,
    });

    expect(checkReleased.status).toBe('PASS');
    expect(checkReleased.isEvaluationStale).toBe(false);
  });

  // TC-10: Tính tất định & Idempotency: Nhiều lần gọi đồng thời/tuần tự cho kết quả hoàn toàn trùng khớp 100%
  it('TC-10: Idempotency tuyệt đối: Cùng inputs luôn cho kết quả giống hệt nhau 100%', () => {
    const tccs = createMockTccs(5);
    const batch = createMockBatch({ tccsId: tccs.id });
    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: '100' },
      { name: 'Chỉ tiêu 2', value: '95' },
      { name: 'Chỉ tiêu 3', value: '105' },
    ]);

    const params = {
      batch,
      testResults: [testResult],
      boundTccs: tccs,
    };

    const resultA = calculateInspectionProgress(params);
    const resultB = calculateInspectionProgress(params);
    const resultC = calculateInspectionProgress(params);

    expect(resultA.status).toBe(resultB.status);
    expect(resultB.status).toBe(resultC.status);
    expect(resultA.progress.completedCount).toBe(resultB.progress.completedCount);
    expect(resultA.progress.percentage).toBe(resultB.progress.percentage);
    expect(resultA.evaluationHash).toBe(resultB.evaluationHash);
    expect(resultA.missingCriteria).toEqual(resultB.missingCriteria);
    expect(resultA.completedCriteria).toEqual(resultB.completedCriteria);
  });

  // RBAC & Authority Validation Tests
  describe('validateInspectionEvaluation & RBAC', () => {
    const tccs = createMockTccs(2);
    const batch = createMockBatch({ tccsId: tccs.id });

    it('Chặn người dùng không có thẩm quyền (LAB, PRODUCTION, VIEWER)', () => {
      const progress = {
        requiredCount: 2,
        completedCount: 2,
        percentage: 100,
        missingCriteria: [],
        evaluatedAt: new Date().toISOString(),
      };

      const labValidation = validateInspectionEvaluation({
        batch,
        newStatus: 'PASS',
        user: { id: 'u1', name: 'Analyst', role: 'LAB' },
        progress,
        hasFailures: false,
        evaluationHash: 'hash_123',
      });
      expect(labValidation.valid).toBe(false);
      expect(labValidation.error).toContain('Chỉ người dùng có vai trò QA, QC hoặc ADMIN');

      const prodValidation = validateInspectionEvaluation({
        batch,
        newStatus: 'PASS',
        user: { id: 'u2', name: 'Worker', role: 'PRODUCTION' },
        progress,
        hasFailures: false,
        evaluationHash: 'hash_123',
      });
      expect(prodValidation.valid).toBe(false);
    });

    it('Cho phép QA, QC hoặc ADMIN đánh giá', () => {
      const progress = {
        requiredCount: 2,
        completedCount: 2,
        percentage: 100,
        missingCriteria: [],
        evaluatedAt: new Date().toISOString(),
      };

      const qaValidation = validateInspectionEvaluation({
        batch,
        newStatus: 'PASS',
        user: { id: 'u_qa', name: 'QA Head', role: 'QA' },
        progress,
        hasFailures: false,
        evaluationHash: 'hash_123',
      });
      expect(qaValidation.valid).toBe(true);
      expect(qaValidation.evaluation?.status).toBe('PASS');
      expect(qaValidation.evaluation?.evaluatorRole).toBe('QA');

      const qcValidation = validateInspectionEvaluation({
        batch,
        newStatus: 'PASS',
        user: { id: 'u_qc', name: 'QC Supervisor', role: 'QC' },
        progress,
        hasFailures: false,
        evaluationHash: 'hash_123',
      });
      expect(qcValidation.valid).toBe(true);
      expect(qcValidation.evaluation?.evaluatorRole).toBe('QC');
    });

    it('Cấm xác nhận PASS khi chưa hoàn thành 100% chỉ tiêu', () => {
      const incompleteProgress = {
        requiredCount: 2,
        completedCount: 1,
        percentage: 50,
        missingCriteria: ['Chỉ tiêu 2'],
        evaluatedAt: new Date().toISOString(),
      };

      const val = validateInspectionEvaluation({
        batch,
        newStatus: 'PASS',
        user: { id: 'u_qa', name: 'QA Head', role: 'QA' },
        progress: incompleteProgress,
        hasFailures: false,
        evaluationHash: 'hash_123',
      });

      expect(val.valid).toBe(false);
      expect(val.error).toContain('chưa hoàn thành đầy đủ 100%');
    });

    it('Cấm xác nhận PASS khi tồn tại chỉ tiêu FAIL (OOS)', () => {
      const completeWithFail = {
        requiredCount: 2,
        completedCount: 2,
        percentage: 100,
        missingCriteria: [],
        evaluatedAt: new Date().toISOString(),
      };

      const val = validateInspectionEvaluation({
        batch,
        newStatus: 'PASS',
        user: { id: 'u_qa', name: 'QA Head', role: 'QA' },
        progress: completeWithFail,
        hasFailures: true, // Fail!
        evaluationHash: 'hash_123',
      });

      expect(val.valid).toBe(false);
      expect(val.error).toContain('tồn tại chỉ tiêu kiểm nghiệm không đạt tiêu chuẩn');
    });

    it('Bắt buộc nhập lý do giải trình khi xác nhận FAIL', () => {
      const progress = {
        requiredCount: 2,
        completedCount: 1,
        percentage: 50,
        missingCriteria: ['Chỉ tiêu 2'],
        evaluatedAt: new Date().toISOString(),
      };

      const emptyReasonVal = validateInspectionEvaluation({
        batch,
        newStatus: 'FAIL',
        user: { id: 'u_qa', name: 'QA Head', role: 'QA' },
        reason: '',
        progress,
        hasFailures: true,
        evaluationHash: 'hash_123',
      });

      expect(emptyReasonVal.valid).toBe(false);
      expect(emptyReasonVal.error).toContain('Bắt buộc nhập lý do giải trình');

      const validReasonVal = validateInspectionEvaluation({
        batch,
        newStatus: 'FAIL',
        user: { id: 'u_qa', name: 'QA Head', role: 'QA' },
        reason: 'Chỉ tiêu 1 không đạt hàm lượng hoạt chất theo TCCS',
        progress,
        hasFailures: true,
        evaluationHash: 'hash_123',
      });

      expect(validReasonVal.valid).toBe(true);
      expect(validReasonVal.evaluation?.status).toBe('FAIL');
      expect(validReasonVal.evaluation?.reason).toBe(
        'Chỉ tiêu 1 không đạt hàm lượng hoạt chất theo TCCS'
      );
    });
  });

  // Legacy Fallback Adapter Tests
  describe('resolveInspectionStatusWithFallback', () => {
    it('Lô đã xuất xưởng lịch sử (RELEASED) fallback về PASS', () => {
      const releasedBatch = createMockBatch({ status: 'RELEASED' });
      const status = resolveInspectionStatusWithFallback({ batch: releasedBatch });
      expect(status).toBe('PASS');
    });

    it('Lô đã từ chối lịch sử (REJECTED) fallback về FAIL', () => {
      const rejectedBatch = createMockBatch({ status: 'REJECTED' });
      const status = resolveInspectionStatusWithFallback({ batch: rejectedBatch });
      expect(status).toBe('FAIL');
    });
  });
});
