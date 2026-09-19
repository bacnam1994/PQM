import { describe, it, expect } from 'vitest';
import {
  BatchStateMachine,
  TestResultStateMachine,
  TestResultWorkflowStateMachine,
  QualityWorkflowMatrixGuard,
  WorkflowValidator,
} from './stateMachine';

describe('PHASE A — Workflow Runtime Enforcement Test Suite', () => {
  describe('A1 & A2: BatchStateMachine Enforcement', () => {
    it('chặn nhảy cóc PENDING sang RELEASED', () => {
      const check = BatchStateMachine.canTransition('PENDING', 'RELEASED');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Không thể chuyển từ PENDING sang RELEASED');
    });

    it('chặn chuyển từ RELEASED về PENDING (Bất biến GMP)', () => {
      const check = BatchStateMachine.canTransition('RELEASED', 'PENDING');
      expect(check.allowed).toBe(false);
    });

    it('chặn chuyển từ RELEASED về TESTING', () => {
      const check = BatchStateMachine.canTransition('RELEASED', 'TESTING');
      expect(check.allowed).toBe(false);
    });

    it('cho phép thu hồi RELEASED sang BLOCKED khi có lý do rõ ràng và thẩm quyền QA/Admin', () => {
      const check = BatchStateMachine.canTransition('RELEASED', 'BLOCKED', {
        actorRole: 'QA',
        reason: 'Thu hồi khẩn cấp do nghi ngờ nhiễm chéo vi sinh vật',
      });
      expect(check.allowed).toBe(true);
    });

    it('chặn thu hồi RELEASED sang BLOCKED nếu thiếu lý do giải trình', () => {
      const check = BatchStateMachine.canTransition('RELEASED', 'BLOCKED', {
        actorRole: 'QA',
        reason: '',
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('bắt buộc phải có lý do');
    });

    it('chặn thu hồi RELEASED sang BLOCKED nếu vai trò không phải QA/Admin', () => {
      const check = BatchStateMachine.canTransition('RELEASED', 'BLOCKED', {
        actorRole: 'PRODUCTION',
        reason: 'Yêu cầu kiểm tra lại',
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Cần thẩm quyền QA hoặc ADMIN');
    });
  });

  describe('A1 & A2: TestResultWorkflowStateMachine Enforcement', () => {
    it('cho phép DRAFT sang SUBMITTED đối với nhân viên phòng Lab', () => {
      const check = TestResultWorkflowStateMachine.canTransition('DRAFT', 'SUBMITTED', {
        actorRole: 'LAB',
      });
      expect(check.allowed).toBe(true);
    });

    it('chặn DRAFT nhảy cóc trực tiếp sang APPROVED', () => {
      const check = TestResultWorkflowStateMachine.canTransition('DRAFT', 'APPROVED', {
        actorRole: 'QA',
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Không thể chuyển từ DRAFT sang APPROVED');
    });

    it('chặn nộp phiếu (SUBMITTED) nhảy sang APPROVED mà chưa chốt FINAL', () => {
      const check = TestResultWorkflowStateMachine.canTransition('SUBMITTED', 'APPROVED', {
        actorRole: 'QA',
      });
      expect(check.allowed).toBe(false);
    });

    it('cho phép SUBMITTED sang FINAL khi QC/QA soát xét', () => {
      const check = TestResultWorkflowStateMachine.canTransition('SUBMITTED', 'FINAL', {
        actorRole: 'QC',
      });
      expect(check.allowed).toBe(true);
    });

    it('chặn người dùng phi-QA/Admin phê duyệt FINAL sang APPROVED', () => {
      const check = TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED', {
        actorRole: 'LAB',
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('không có thẩm quyền');
    });

    it('cho phép QA phê duyệt FINAL sang APPROVED', () => {
      const check = TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED', {
        actorRole: 'QA',
      });
      expect(check.allowed).toBe(true);
    });

    it('cho phép chuyển sang SUPERSEDED từ bất kỳ trạng thái nào và chặn chuyển tiếp từ SUPERSEDED', () => {
      const checkFinalToSup = TestResultWorkflowStateMachine.canTransition('FINAL', 'SUPERSEDED');
      expect(checkFinalToSup.allowed).toBe(true);

      const checkSupToFinal = TestResultWorkflowStateMachine.canTransition('SUPERSEDED', 'FINAL');
      expect(checkSupToFinal.allowed).toBe(false);
      expect(checkSupToFinal.reason).toContain('SUPERSEDED là trạng thái kết thúc bất biến');
    });
  });

  describe('A1 & A2: QualityWorkflowMatrixGuard (Quality × Workflow Matrix)', () => {
    it('cho phép DRAFT ở mọi trạng thái chất lượng (UNKNOWN, PENDING, PASS, FAIL)', () => {
      expect(QualityWorkflowMatrixGuard.validate('DRAFT', 'UNKNOWN').allowed).toBe(true);
      expect(QualityWorkflowMatrixGuard.validate('DRAFT', 'PENDING').allowed).toBe(true);
      expect(QualityWorkflowMatrixGuard.validate('DRAFT', 'PASS').allowed).toBe(true);
      expect(QualityWorkflowMatrixGuard.validate('DRAFT', 'FAIL').allowed).toBe(true);
    });

    it('chặn SUBMITTED khi chất lượng là UNKNOWN', () => {
      const check = QualityWorkflowMatrixGuard.validate('SUBMITTED', 'UNKNOWN');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('chưa có kết quả chỉ tiêu');
    });

    it('chặn FINAL khi chất lượng còn PENDING hoặc UNKNOWN', () => {
      const checkPending = QualityWorkflowMatrixGuard.validate('FINAL', 'PENDING');
      expect(checkPending.allowed).toBe(false);
      expect(checkPending.reason).toContain('Không thể chốt kỹ thuật (FINAL)');

      const checkUnknown = QualityWorkflowMatrixGuard.validate('FINAL', 'UNKNOWN');
      expect(checkUnknown.allowed).toBe(false);
    });

    it('chặn APPROVED khi chất lượng còn PENDING hoặc UNKNOWN', () => {
      const checkPending = QualityWorkflowMatrixGuard.validate('APPROVED', 'PENDING');
      expect(checkPending.allowed).toBe(false);
      expect(checkPending.reason).toContain('QA không thể phê duyệt');
    });

    it('cho phép APPROVED khi chất lượng là PASS hoặc FAIL (duyệt OOS để điều tra)', () => {
      expect(QualityWorkflowMatrixGuard.validate('APPROVED', 'PASS').allowed).toBe(true);
      expect(QualityWorkflowMatrixGuard.validate('APPROVED', 'FAIL').allowed).toBe(true);
    });

    it('BẤT BIẾN GMP: Tuyệt đối cấm xuất xưởng (RELEASED) khi chất lượng là FAIL', () => {
      const check = QualityWorkflowMatrixGuard.validate('RELEASED', 'FAIL');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('BẤT BIẾN GMP: Tuyệt đối cấm xuất xưởng (RELEASED)');
    });

    it('chặn xuất xưởng (RELEASED) khi chất lượng là PENDING hoặc UNKNOWN', () => {
      const check = QualityWorkflowMatrixGuard.validate('RELEASED', 'PENDING');
      expect(check.allowed).toBe(false);
    });

    it('cho phép xuất xưởng (RELEASED) duy nhất khi chất lượng là PASS', () => {
      const check = QualityWorkflowMatrixGuard.validate('RELEASED', 'PASS');
      expect(check.allowed).toBe(true);
    });
  });

  describe('A1 & A2: WorkflowValidator Chain Checks', () => {
    it('phát hiện chuỗi chuyển đổi trạng thái Lô không hợp lệ', () => {
      const validChain = WorkflowValidator.validateBatchStateChain([
        'PENDING',
        'TESTING',
        'RELEASED',
        'BLOCKED',
      ]);
      expect(validChain.isValid).toBe(true);

      const invalidChain = WorkflowValidator.validateBatchStateChain(['PENDING', 'RELEASED']);
      expect(invalidChain.isValid).toBe(false);
      expect(invalidChain.violations[0]).toContain('Chuyển đổi bất hợp pháp PENDING -> RELEASED');
    });
  });
});
