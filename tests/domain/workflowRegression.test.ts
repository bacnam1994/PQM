/**
 * tests/domain/workflowRegression.test.ts
 * ========================================
 * GOLDEN REGRESSION TEST SUITE FOR PQM WORKFLOW ARCHITECTURE
 *
 * Đảm bảo các bất biến vàng:
 * 1. Không có Workflow Status Mutation từ việc Lưu Test Result (Data Entry).
 * 2. Không có Workflow Status Mutation từ Quality Evaluation (100% != RELEASED, FAIL != REJECTED).
 * 3. Batch 702601 Regression: Lưu kết quả không đổi Batch status.
 * 4. PENDING / UNKNOWN không suy diễn thành REJECTED.
 * 5. Stale Client Cache Defense: Luôn đọc fresh data từ DB khi quyết định Workflow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BatchStateMachine,
  TestResultWorkflowStateMachine,
} from '../../src/domain/workflow/stateMachine';
import { BatchRules } from '../../src/domain/rules/BatchRules';
import { ReleaseRules } from '../../src/domain/rules/ReleaseRules';
import { CanonicalStatusResolver } from '../../src/domain/canonical/canonicalResolver';
import { computeSignatureChecksum } from '../../src/services/signatureService';
import { Batch } from '../../src/types/batch';
import { TestResult } from '../../src/types/testResult';
import { UserIdentity } from '../../src/types/permissions';

describe('PQM Workflow Golden Regression Suite', () => {
  const qaUser: UserIdentity = {
    uid: 'u-qa',
    role: 'QA',
    fullName: 'QA Inspector',
    email: 'qa@vbiotech.vn',
  };
  const labUser: UserIdentity = {
    uid: 'u-lab',
    role: 'LAB',
    fullName: 'Lab Analyst',
    email: 'lab@vbiotech.vn',
  };
  const prodUser: UserIdentity = {
    uid: 'u-prod',
    role: 'PRODUCTION',
    fullName: 'Prod Operator',
    email: 'prod@vbiotech.vn',
  };

  describe('1. Decoupled Tri-Axis Invariant (Completion vs Quality vs Workflow)', () => {
    it('100% hoàn thành kiểm nghiệm KHÔNG tự suy luận thành RELEASED', () => {
      const passResults = Array.from({ length: 10 }, (_, i) => ({
        criterionName: `Chỉ tiêu ${i + 1}`,
        value: '100',
        isPass: true,
      }));
      const criteriaEval = CanonicalStatusResolver.evaluateCriteria(passResults);

      expect(criteriaEval.total).toBe(10);
      expect(criteriaEval.pass).toBe(10);
      expect(criteriaEval.allPass).toBe(true);

      const batch: Batch = {
        id: 'B-TEST-01',
        batchNo: 'L26001',
        productId: 'P-01',
        status: 'TESTING',
      };
      const tr: TestResult = {
        id: 'TR-01',
        batchId: 'B-TEST-01',
        results: passResults,
        overallStatus: 'PASS',
        workflowStatus: 'FINAL',
      };

      const qualityStatus = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(batch, [
        tr,
      ]);
      expect(qualityStatus).toBe('PASS');
      // Bất biến: batch.status vẫn là TESTING, không tự động biến thành RELEASED
      expect(batch.status).toBe('TESTING');
    });

    it('Quality FAIL KHÔNG tự suy luận thành Batch REJECTED', () => {
      const failResults = [
        { criterionName: 'Chỉ tiêu 1', value: '100', isPass: true },
        { criterionName: 'Chỉ tiêu 2', value: 'OOS', isPass: false },
      ];
      const criteriaEval = CanonicalStatusResolver.evaluateCriteria(failResults);
      expect(criteriaEval.fail).toBe(1);

      const batch: Batch = {
        id: 'B-TEST-02',
        batchNo: 'L26002',
        productId: 'P-01',
        status: 'TESTING',
      };
      const tr: TestResult = {
        id: 'TR-02',
        batchId: 'B-TEST-02',
        results: failResults,
        overallStatus: 'FAIL',
        workflowStatus: 'FINAL',
      };

      const qualityStatus = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(batch, [
        tr,
      ]);
      expect(qualityStatus).toBe('FAIL');
      // Bất biến: batch.status vẫn là TESTING, không tự động biến thành REJECTED
      expect(batch.status).toBe('TESTING');
    });

    it('Quality PENDING / INCOMPLETE KHÔNG tự suy luận thành REJECTED', () => {
      const pendingResults = [
        { criterionName: 'Chỉ tiêu 1', value: '100', isPass: true },
        { criterionName: 'Chỉ tiêu 2', value: '', isPass: 'PENDING' as any },
      ];
      const criteriaEval = CanonicalStatusResolver.evaluateCriteria(pendingResults);
      expect(criteriaEval.pending).toBe(1);

      const batch: Batch = {
        id: 'B-TEST-03',
        batchNo: 'L26003',
        productId: 'P-01',
        status: 'TESTING',
      };
      const tr: TestResult = {
        id: 'TR-03',
        batchId: 'B-TEST-03',
        results: pendingResults,
        overallStatus: 'PENDING',
        workflowStatus: 'SUBMITTED',
      };

      const qualityStatus = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(batch, [
        tr,
      ]);
      expect(qualityStatus).not.toBe('FAIL');
      expect(qualityStatus).not.toBe('REJECTED');
      expect(batch.status).toBe('TESTING');
    });

    it('Quality UNKNOWN (0 kết quả hợp lệ) KHÔNG tự suy luận thành REJECTED', () => {
      const batch: Batch = {
        id: 'B-TEST-04',
        batchNo: 'L26004',
        productId: 'P-01',
        status: 'TESTING',
      };

      const qualityStatus = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(batch, []);
      expect(qualityStatus).toBe('TESTING');
      expect(qualityStatus).not.toBe('FAIL');
      expect(qualityStatus).not.toBe('REJECTED');
      expect(batch.status).toBe('TESTING');
    });
  });

  describe('2. BATCH-702601 Workflow Regression Test', () => {
    it('Batch 702601 giữ nguyên trạng thái TESTING khi lưu Test Result (kể cả PASS hoặc FAIL)', () => {
      const batch702601: Batch = {
        id: 'batch-702601',
        batchNo: '702601',
        productId: 'prod-bio-sacacillus',
        status: 'TESTING',
        mfgDate: '2026-03-01',
        expDate: '2028-03-01',
        version: 1,
      };

      // Giả lập lưu phiếu PASS 100%
      const testResultPass: TestResult = {
        id: 'tr-702601-pass',
        batchId: 'batch-702601',
        overallStatus: 'PASS',
        workflowStatus: 'FINAL',
        results: [
          { criterionName: 'Định lượng Bacillus subtilis', value: '1.2 x 10^9', isPass: true },
          { criterionName: 'Độ ẩm', value: '5.0', isPass: true },
        ],
      };

      const passQuality = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(
        batch702601,
        [testResultPass]
      );
      expect(passQuality).toBe('PASS');

      // Batch status PHẢI VẪN LÀ TESTING, KHÔNG ĐƯỢC TỰ BIẾN THÀNH RELEASED
      expect(batch702601.status).toBe('TESTING');

      // Giả lập lưu phiếu FAIL
      const testResultFail: TestResult = {
        id: 'tr-702601-fail',
        batchId: 'batch-702601',
        overallStatus: 'FAIL',
        workflowStatus: 'FINAL',
        results: [
          { criterionName: 'Định lượng Bacillus subtilis', value: '1.2 x 10^9', isPass: true },
          { criterionName: 'Độ ẩm', value: '12.0', isPass: false },
        ],
      };

      const failQuality = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(
        batch702601,
        [testResultFail]
      );
      expect(failQuality).toBe('FAIL');

      // Batch status PHẢI VẪN LÀ TESTING, KHÔNG ĐƯỢC TỰ BIẾN THÀNH REJECTED
      expect(batch702601.status).toBe('TESTING');
    });
  });

  describe('3. Batch State Machine Transition Rules', () => {
    it('PENDING -> TESTING cho phép LAB / PRODUCTION / QA', () => {
      const labCheck = BatchStateMachine.canTransition('PENDING', 'TESTING', { actorRole: 'LAB' });
      expect(labCheck.allowed).toBe(true);

      const prodCheck = BatchStateMachine.canTransition('PENDING', 'TESTING', {
        actorRole: 'PRODUCTION',
      });
      expect(prodCheck.allowed).toBe(true);

      const qaCheck = BatchStateMachine.canTransition('PENDING', 'TESTING', { actorRole: 'QA' });
      expect(qaCheck.allowed).toBe(true);
    });

    it('PENDING -> RELEASED bị CHẶN tuyệt đối', () => {
      const check = BatchStateMachine.canTransition('PENDING', 'RELEASED', { actorRole: 'QA' });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Chuyển đổi trạng thái không hợp lệ');
    });

    it('PENDING -> REJECTED bắt buộc QA/ADMIN và có reason', () => {
      const labCheck = BatchStateMachine.canTransition('PENDING', 'REJECTED', {
        actorRole: 'LAB',
        reason: 'Fail',
      });
      expect(labCheck.allowed).toBe(false);

      const noReasonCheck = BatchStateMachine.canTransition('PENDING', 'REJECTED', {
        actorRole: 'QA',
        reason: '',
      });
      expect(noReasonCheck.allowed).toBe(false);

      const validCheck = BatchStateMachine.canTransition('PENDING', 'REJECTED', {
        actorRole: 'QA',
        reason: 'Nguyên liệu hỏng trước kiểm nghiệm',
      });
      expect(validCheck.allowed).toBe(true);
    });

    it('TESTING -> RELEASED yêu cầu QA/ADMIN', () => {
      const prodCheck = BatchStateMachine.canTransition('TESTING', 'RELEASED', {
        actorRole: 'PRODUCTION',
      });
      expect(prodCheck.allowed).toBe(false);

      const qaCheck = BatchStateMachine.canTransition('TESTING', 'RELEASED', { actorRole: 'QA' });
      expect(qaCheck.allowed).toBe(true);
    });

    it('TESTING -> REJECTED yêu cầu QA/ADMIN và reason', () => {
      const noReasonCheck = BatchStateMachine.canTransition('TESTING', 'REJECTED', {
        actorRole: 'QA',
        reason: '',
      });
      expect(noReasonCheck.allowed).toBe(false);

      const withReasonCheck = BatchStateMachine.canTransition('TESTING', 'REJECTED', {
        actorRole: 'QA',
        reason: 'Chỉ tiêu độ ẩm không đạt TCCS',
      });
      expect(withReasonCheck.allowed).toBe(true);
    });

    it('TESTING -> BLOCKED yêu cầu QA/ADMIN và reason', () => {
      const noReason = BatchStateMachine.canTransition('TESTING', 'BLOCKED', { actorRole: 'QA' });
      expect(noReason.allowed).toBe(false);

      const withReason = BatchStateMachine.canTransition('TESTING', 'BLOCKED', {
        actorRole: 'QA',
        reason: 'Nghi vấn sai số thiết bị phân tích',
      });
      expect(withReason.allowed).toBe(true);
    });

    it('BLOCKED -> TESTING yêu cầu QA/ADMIN và lý do / kế hoạch retest', () => {
      const prodCheck = BatchStateMachine.canTransition('BLOCKED', 'TESTING', {
        actorRole: 'PRODUCTION',
        reason: 'Xong rồi',
      });
      expect(prodCheck.allowed).toBe(false);

      const qaCheck = BatchStateMachine.canTransition('BLOCKED', 'TESTING', {
        actorRole: 'QA',
        reason: 'Kế hoạch kiểm nghiệm lại số 01/KH-KN',
      });
      expect(qaCheck.allowed).toBe(true);
    });

    it('REJECTED -> PENDING yêu cầu QA/ADMIN và lý do giải trình CAPA', () => {
      const prodCheck = BatchStateMachine.canTransition('REJECTED', 'PENDING', {
        actorRole: 'PRODUCTION',
        reason: 'Sửa lại',
      });
      expect(prodCheck.allowed).toBe(false);

      const noReasonCheck = BatchStateMachine.canTransition('REJECTED', 'PENDING', {
        actorRole: 'QA',
      });
      expect(noReasonCheck.allowed).toBe(false);

      const qaCheck = BatchStateMachine.canTransition('REJECTED', 'PENDING', {
        actorRole: 'QA',
        reason: 'CAPA-2026-003: Hiệu chuẩn lại máy dập viên',
      });
      expect(qaCheck.allowed).toBe(true);
    });

    it('RELEASED -> BLOCKED yêu cầu QA/ADMIN và lý do thu hồi (Recall)', () => {
      const noReason = BatchStateMachine.canTransition('RELEASED', 'BLOCKED', { actorRole: 'QA' });
      expect(noReason.allowed).toBe(false);

      const withReason = BatchStateMachine.canTransition('RELEASED', 'BLOCKED', {
        actorRole: 'QA',
        reason: 'Thu hồi khẩn cấp do khiếu nại chất lượng',
      });
      expect(withReason.allowed).toBe(true);
    });

    it('RELEASED -> RELEASED là no-op (cho phép)', () => {
      const check = BatchStateMachine.canTransition('RELEASED', 'RELEASED', { actorRole: 'QA' });
      expect(check.allowed).toBe(true);
    });

    it('RELEASED -> PENDING / TESTING / REJECTED bị cấm tuyệt đối', () => {
      expect(
        BatchStateMachine.canTransition('RELEASED', 'PENDING', { actorRole: 'ADMIN' }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('RELEASED', 'TESTING', { actorRole: 'ADMIN' }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('RELEASED', 'REJECTED', { actorRole: 'ADMIN' }).allowed
      ).toBe(false);
    });
  });

  describe('4. TestResult State Machine Transition Rules', () => {
    it('DRAFT -> SUBMITTED -> FINAL -> APPROVED -> SUPERSEDED hợp lệ', () => {
      expect(
        TestResultWorkflowStateMachine.canTransition('DRAFT', 'SUBMITTED', { actorRole: 'LAB' })
          .allowed
      ).toBe(true);
      expect(
        TestResultWorkflowStateMachine.canTransition('SUBMITTED', 'FINAL', { actorRole: 'QC' })
          .allowed
      ).toBe(true);
      expect(
        TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED', { actorRole: 'QA' })
          .allowed
      ).toBe(true);
      expect(
        TestResultWorkflowStateMachine.canTransition('APPROVED', 'SUPERSEDED', {
          actorRole: 'QA',
          reason: 'Kiểm nghiệm lại theo CAPA',
        }).allowed
      ).toBe(true);
    });

    it('FINAL -> APPROVED yêu cầu QA hoặc ADMIN', () => {
      const labCheck = TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED', {
        actorRole: 'LAB',
      });
      expect(labCheck.allowed).toBe(false);
      expect(labCheck.reason).toContain('Yêu cầu: QA, ADMIN');
    });

    it('SUPERSEDED -> ANY bị cấm hoàn toàn', () => {
      expect(
        TestResultWorkflowStateMachine.canTransition('SUPERSEDED', 'DRAFT', { actorRole: 'ADMIN' })
          .allowed
      ).toBe(false);
      expect(
        TestResultWorkflowStateMachine.canTransition('SUPERSEDED', 'APPROVED', {
          actorRole: 'ADMIN',
        }).allowed
      ).toBe(false);
      expect(
        TestResultWorkflowStateMachine.canTransition('SUPERSEDED', 'FINAL', { actorRole: 'ADMIN' })
          .allowed
      ).toBe(false);
    });
  });

  describe('5. Unified Release Gate (Single Source of Truth)', () => {
    it('BatchRules.canRelease ủy quyền hoàn toàn cho ReleaseRules', () => {
      const validBatch: Batch = {
        id: 'B-01',
        batchNo: 'L26001',
        productId: 'P-01',
        status: 'TESTING',
        tccsId: 'TCCS-01',
      };

      const validTccs = {
        id: 'TCCS-01',
        productId: 'P-01',
        code: 'TCCS-01/2026',
        mainQualityCriteria: [{ criterionName: 'Độ tinh khiết' }],
      };

      // Trường hợp chưa có TestResult -> Bị chặn
      const resWithoutTests = BatchRules.canRelease(validBatch, [], 'QA', validTccs as any);
      expect(resWithoutTests.allowed).toBe(false);
      expect(resWithoutTests.reason).toMatch(/chưa có phiếu kiểm nghiệm/i);

      // ReleaseRules cũng phải trả về blocker tương tự
      const evalPrereq = ReleaseRules.evaluateReleasePrerequisites({
        batch: validBatch,
        testResults: [],
        userRole: 'QA',
        boundTccs: validTccs as any,
      });
      expect(evalPrereq.isEligibleForRelease).toBe(false);
    });
  });
});
