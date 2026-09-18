import { describe, it, expect } from 'vitest';
import {
  BatchStateMachine,
  TestResultStateMachine,
  WorkflowValidator,
} from '../workflow/stateMachine';

describe('Model 10: Workflow & State Machine Regression Suite', () => {
  // ===========================================================
  // 1. BatchStateMachine — Happy Path
  // ===========================================================
  describe('BatchStateMachine — Luồng sản xuất hợp lệ', () => {
    it('cho phép toàn bộ luồng xuất xưởng tiêu chuẩn: PENDING → TESTING → RELEASED', () => {
      const step1 = BatchStateMachine.transition('PENDING', 'TESTING', 'START_TESTING');
      expect(step1.success).toBe(true);

      const step2 = BatchStateMachine.transition('TESTING', 'RELEASED', 'RELEASE_BATCH', {
        actorRole: 'QA',
        conditionsMet: true,
        reason: 'Kết quả kiểm nghiệm đạt chuẩn PASS',
      });
      expect(step2.success).toBe(true);
      expect(step2.requiresAuditRecord).toBe(true);
    });

    it('cho phép luồng từ chối: TESTING → REJECTED', () => {
      const result = BatchStateMachine.transition('TESTING', 'REJECTED', 'REJECT_BATCH', {
        actorRole: 'QA',
        reason: 'OOS vi sinh không thể cứu vãn',
      });
      expect(result.success).toBe(true);
      expect(result.requiresAuditRecord).toBe(true);
    });

    it('cho phép mở lại lô bị từ chối: REJECTED → PENDING với biên bản CAPA', () => {
      const result = BatchStateMachine.transition('REJECTED', 'PENDING', 'REOPEN_WITH_CAPA', {
        actorRole: 'ADMIN',
        reason: 'Điều tra xác định nguyên nhân lỗi thiết bị, đã sửa chữa và thẩm định lại',
      });
      expect(result.success).toBe(true);
    });

    it('cho phép thu hồi lô đã xuất xưởng: RELEASED → BLOCKED với lý do', () => {
      const result = BatchStateMachine.transition('RELEASED', 'BLOCKED', 'RECALL_BATCH', {
        actorRole: 'QA',
        reason: 'Phát hiện OOS sau xuất xưởng — khởi động thu hồi khẩn cấp',
      });
      expect(result.success).toBe(true);
      expect(result.requiresAuditRecord).toBe(true);
    });
  });

  // ===========================================================
  // 2. BatchStateMachine — Bất biến GMP (Inviolable Guards)
  // ===========================================================
  describe('BatchStateMachine — Rào chắn bất biến GMP', () => {
    it('chặn bước nhảy trạng thái bất hợp pháp: RELEASED → PENDING', () => {
      const illegal = BatchStateMachine.transition('RELEASED', 'PENDING', 'RESET_BATCH');
      expect(illegal.success).toBe(false);
      expect(illegal.error).toContain('Chuyển đổi trạng thái không hợp lệ');
    });

    it('chặn REJECTED → RELEASED (không được phép theo GMP)', () => {
      const illegal = BatchStateMachine.transition('REJECTED', 'RELEASED', 'FORCE_RELEASE');
      expect(illegal.success).toBe(false);
    });

    it('chặn chuyển TESTING → RELEASED khi conditionsMet = false', () => {
      const blocked = BatchStateMachine.transition('TESTING', 'RELEASED', 'RELEASE_BATCH', {
        actorRole: 'QA',
        conditionsMet: false,
      });
      expect(blocked.success).toBe(false);
      expect(blocked.error).toContain('chưa đạt để chuyển sang RELEASED');
    });

    it('chặn chuyển TESTING → RELEASED khi vai trò LAB không có thẩm quyền', () => {
      const blocked = BatchStateMachine.transition('TESTING', 'RELEASED', 'RELEASE_BATCH', {
        actorRole: 'LAB',
        conditionsMet: true,
      });
      expect(blocked.success).toBe(false);
      expect(blocked.error).toContain('Cần thẩm quyền QA hoặc ADMIN');
    });

    it('chặn mở lại REJECTED → PENDING khi thiếu lý do thẩm định (CAPA)', () => {
      const blocked = BatchStateMachine.transition('REJECTED', 'PENDING', 'REOPEN', {
        reason: '',
      });
      expect(blocked.success).toBe(false);
      expect(blocked.error).toContain('biên bản giải trình');
    });

    it('chặn thu hồi RELEASED → BLOCKED khi thiếu lý do thu hồi', () => {
      const blocked = BatchStateMachine.transition('RELEASED', 'BLOCKED', 'RECALL', {
        actorRole: 'QA',
        reason: '',
      });
      expect(blocked.success).toBe(false);
      expect(blocked.error).toContain('lý do thu hồi rõ ràng');
    });
  });

  // ===========================================================
  // 3. TestResultStateMachine
  // ===========================================================
  describe('TestResultStateMachine — Quản lý vòng đời phiếu kiểm nghiệm', () => {
    it('cho phép chuyển PENDING → PASS khi QA phê duyệt', () => {
      const result = TestResultStateMachine.transition('PENDING', 'PASS', 'EVALUATE_PASS', {
        actorRole: 'QA',
      });
      expect(result.success).toBe(true);
      expect(result.requiresAuditRecord).toBe(true);
    });

    it('cho phép chuyển PENDING → FAIL khi có chỉ tiêu OOS', () => {
      const result = TestResultStateMachine.transition('PENDING', 'FAIL', 'EVALUATE_FAIL');
      expect(result.success).toBe(true);
    });

    it('cho phép đánh dấu SUPERSEDED khi có phiếu retest mới', () => {
      const passResult = TestResultStateMachine.transition(
        'PASS',
        'SUPERSEDED',
        'RETEST_NEW_RESULT'
      );
      expect(passResult.success).toBe(true);

      const failResult = TestResultStateMachine.transition(
        'FAIL',
        'SUPERSEDED',
        'RETEST_NEW_RESULT'
      );
      expect(failResult.success).toBe(true);
    });

    it('bảo vệ bất biến SUPERSEDED: phiếu đã SUPERSEDED không thể chuyển tiếp', () => {
      const illegal1 = TestResultStateMachine.transition('SUPERSEDED', 'PENDING', 'RESET');
      expect(illegal1.success).toBe(false);
      expect(illegal1.error).toContain('SUPERSEDED');

      const illegal2 = TestResultStateMachine.transition('SUPERSEDED', 'PASS', 'RE_APPROVE');
      expect(illegal2.success).toBe(false);
    });

    it('chặn chuyển đổi bất hợp pháp PASS → FAIL (không có luật cứu)', () => {
      const illegal = TestResultStateMachine.transition('PASS', 'FAIL', 'DOWNGRADE');
      expect(illegal.success).toBe(false);
      expect(illegal.error).toContain('không hợp lệ');
    });
  });

  // ===========================================================
  // 4. WorkflowValidator — Xác thực chuỗi trạng thái
  // ===========================================================
  describe('WorkflowValidator — Xác thực chuỗi trạng thái lịch sử', () => {
    it('xác thực chuỗi Batch hợp lệ: PENDING → TESTING → RELEASED', () => {
      const result = WorkflowValidator.validateBatchStateChain(['PENDING', 'TESTING', 'RELEASED']);
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('phát hiện bước nhảy bất hợp pháp trong lịch sử Batch', () => {
      const result = WorkflowValidator.validateBatchStateChain([
        'PENDING',
        'TESTING',
        'RELEASED',
        'PENDING', // RELEASED → PENDING bất hợp pháp
      ]);
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('RELEASED -> PENDING');
    });

    it('xác thực chuỗi TestResult hợp lệ: PENDING → FAIL → SUPERSEDED', () => {
      const result = WorkflowValidator.validateTestResultStateChain([
        'PENDING',
        'FAIL',
        'SUPERSEDED',
      ]);
      expect(result.isValid).toBe(true);
    });

    it('phát hiện vi phạm SUPERSEDED trong chuỗi TestResult', () => {
      const result = WorkflowValidator.validateTestResultStateChain([
        'PENDING',
        'PASS',
        'SUPERSEDED',
        'PENDING', // Không thể tiếp tục từ SUPERSEDED
      ]);
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================
  // 5. getValidNextStates
  // ===========================================================
  it('getValidNextStates trả về đúng danh sách trạng thái kế tiếp', () => {
    expect(BatchStateMachine.getValidNextStates('PENDING')).toEqual(
      expect.arrayContaining(['TESTING', 'REJECTED'])
    );
    expect(BatchStateMachine.getValidNextStates('RELEASED')).toEqual(['BLOCKED']);
    expect(TestResultStateMachine.getValidNextStates('SUPERSEDED')).toEqual([]);
  });
});
