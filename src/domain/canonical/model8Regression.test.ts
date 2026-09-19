import { describe, it, expect } from 'vitest';
import { AutoHealingFramework, HealingPlan } from '../healing/autoHealingFramework';
import {
  ConsistencyIssueFactory,
  CanonicalConsistencyIssue,
} from '../consistency/consistencyModel';

describe('Model 8 Regression Suite: Auto-Healing Model', () => {
  const mockSafeIssue = ConsistencyIssueFactory.createIssue({
    type: 'STALE_DERIVED_DATA',
    severity: 'INFO',
    entityType: 'TEST_RESULT',
    entityId: 'tr-001',
    field: 'overallStatusFormat',
    expected: 'PASS',
    actual: 'pass',
    source: 'FormatNormalizer',
    healingStrategy: 'SAFE_AUTO_HEAL',
  });

  const mockControlledIssue = ConsistencyIssueFactory.createIssue({
    type: 'INVALID_REFERENCE',
    severity: 'WARNING',
    entityType: 'TEST_RESULT',
    entityId: 'tr-002',
    field: 'batchId',
    expected: 'batch-canonical-id',
    actual: 'B260901',
    source: 'EntityIdentityManager',
    healingStrategy: 'CONTROLLED_HEAL',
  });

  const mockNeverHealIssue = ConsistencyIssueFactory.createIssue({
    type: 'CRITERIA_MISMATCH',
    severity: 'CRITICAL',
    entityType: 'TEST_RESULT',
    entityId: 'tr-003',
    field: 'results',
    expected: 'ĐẠT',
    actual: 'KHÔNG ĐẠT',
    source: 'LabMeasurement',
    healingStrategy: 'NEVER_AUTO_HEAL',
  });

  describe('1. determineHealingStrategy & evaluateConfidence', () => {
    it('GMP Invariant: cấm tuyệt đối sửa kết quả kiểm nghiệm gốc, chữ ký điện tử hoặc lỗi chỉ tiêu', () => {
      expect(
        AutoHealingFramework.determineHealingStrategy('TEST_RESULT', 'results', 'CRITERIA_FAIL')
      ).toBe('NEVER_AUTO_HEAL');
      expect(
        AutoHealingFramework.determineHealingStrategy('TEST_RESULT', 'value', 'OUT_OF_SPEC')
      ).toBe('NEVER_AUTO_HEAL');
      expect(
        AutoHealingFramework.determineHealingStrategy('TEST_RESULT', 'signature', 'INVALID_SIG')
      ).toBe('NEVER_AUTO_HEAL');
      expect(
        AutoHealingFramework.determineHealingStrategy('AUDIT_LOG', 'details', 'AUDIT_MISMATCH')
      ).toBe('NEVER_AUTO_HEAL');
    });

    it('GMP Invariant: cấm tự động sửa bất kỳ trường nào của phiếu hoặc Lô đã phê duyệt/xuất xưởng', () => {
      expect(
        AutoHealingFramework.determineHealingStrategy(
          'TEST_RESULT',
          'batchId',
          'INVALID_REFERENCE',
          { isApprovedOrReleased: true }
        )
      ).toBe('NEVER_AUTO_HEAL');
    });

    it('SAFE_AUTO_HEAL cho các trường phái sinh, định dạng hoặc index', () => {
      expect(
        AutoHealingFramework.determineHealingStrategy(
          'TEST_RESULT',
          'overallStatusFormat',
          'FORMAT_MISMATCH'
        )
      ).toBe('SAFE_AUTO_HEAL');
      expect(
        AutoHealingFramework.determineHealingStrategy('TEST_RESULT', 'searchIndex', 'STALE_INDEX')
      ).toBe('SAFE_AUTO_HEAL');
      expect(
        AutoHealingFramework.determineHealingStrategy(
          'TEST_RESULT',
          'labName',
          'UNNORMALIZED_TEST_LAB'
        )
      ).toBe('SAFE_AUTO_HEAL');
    });

    it('CONTROLLED_HEAL cho việc chuẩn hóa khóa ngoại và liên kết thực thể', () => {
      expect(
        AutoHealingFramework.determineHealingStrategy('BATCH', 'batchId', 'INVALID_REFERENCE')
      ).toBe('CONTROLLED_HEAL');
    });

    it('evaluateConfidence: trả về độ tin cậy tương ứng với chiến lược và giá trị kỳ vọng', () => {
      expect(AutoHealingFramework.evaluateConfidence(mockSafeIssue)).toBe('HIGH');
      expect(AutoHealingFramework.evaluateConfidence(mockControlledIssue)).toBe('MEDIUM');

      const noExpectedControlled = { ...mockControlledIssue, expected: undefined };
      expect(AutoHealingFramework.evaluateConfidence(noExpectedControlled)).toBe('LOW');
      expect(AutoHealingFramework.evaluateConfidence(mockNeverHealIssue)).toBe('LOW');
    });
  });

  describe('2. previewHealing & previewBatch', () => {
    it('preview cho SAFE_AUTO_HEAL: không yêu cầu duyệt thủ công và cho phép thực thi', () => {
      const preview = AutoHealingFramework.previewHealing(mockSafeIssue);
      expect(preview.requiresManualApproval).toBe(false);
      expect(preview.canExecute).toBe(true);
      expect(preview.confidence).toBe('HIGH');
      expect(preview.proposedValue).toBe('PASS');
    });

    it('preview cho CONTROLLED_HEAL: yêu cầu phê duyệt thủ công, cho phép thực thi với QA/ADMIN', () => {
      const previewQA = AutoHealingFramework.previewHealing(mockControlledIssue, {
        userRole: 'QA',
      });
      expect(previewQA.requiresManualApproval).toBe(true);
      expect(previewQA.canExecute).toBe(true);

      const previewUser = AutoHealingFramework.previewHealing(mockControlledIssue, {
        userRole: 'USER',
      });
      expect(previewUser.canExecute).toBe(false);
      expect(previewUser.blockingReason).toContain('không có thẩm quyền');
    });

    it('preview cho NEVER_AUTO_HEAL: chặn thực thi hoàn toàn kèm lý do vi phạm GMP', () => {
      const preview = AutoHealingFramework.previewHealing(mockNeverHealIssue, {
        userRole: 'ADMIN',
      });
      expect(preview.canExecute).toBe(false);
      expect(preview.blockingReason).toContain('ALCOA+');
    });

    it('previewBatch: tổng hợp danh sách xem trước và phân loại chính xác số lượng', () => {
      const batchResult = AutoHealingFramework.previewBatch(
        [mockSafeIssue, mockControlledIssue, mockNeverHealIssue],
        { userRole: 'QA' }
      );
      expect(batchResult.previews).toHaveLength(3);
      expect(batchResult.safeCount).toBe(1);
      expect(batchResult.controlledCount).toBe(1);
      expect(batchResult.blockedCount).toBe(1);
    });
  });

  describe('3. executeHealing & verifyPostHealState', () => {
    it('chặn thực thi sai lệch NEVER_AUTO_HEAL', async () => {
      const result = await AutoHealingFramework.executeHealing({
        issue: mockNeverHealIssue,
        executor: async () => true,
        actor: 'admin-user',
        actorRole: 'ADMIN',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('ALCOA+');
    });

    it('chặn thực thi CONTROLLED_HEAL nếu không nhập lý do', async () => {
      const result = await AutoHealingFramework.executeHealing({
        issue: mockControlledIssue,
        executor: async () => true,
        actor: 'qa-user',
        actorRole: 'QA',
        reason: '', // Thiếu lý do
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bắt buộc phải nhập lý do');
    });

    it('thực thi thành công SAFE_AUTO_HEAL và cập nhật trạng thái bản ghi thành HEALED', async () => {
      const safeIssueToHeal = { ...mockSafeIssue, status: 'DETECTED' as const };
      let appliedValue = '';

      const result = await AutoHealingFramework.executeHealing({
        issue: safeIssueToHeal,
        executor: async (_issue, val) => {
          appliedValue = val;
          return true;
        },
        actor: 'auto-healing-engine',
      });

      expect(result.success).toBe(true);
      expect(appliedValue).toBe('PASS');
      expect(safeIssueToHeal.status).toBe('HEALED');
      expect(result.auditRecordId).toBeDefined();
    });

    it('thực thi thành công CONTROLLED_HEAL khi có đầy đủ thẩm quyền QA và lý do', async () => {
      const controlledIssueToHeal = { ...mockControlledIssue, status: 'DETECTED' as const };
      let savedBatchId = '';

      const result = await AutoHealingFramework.executeHealing({
        issue: controlledIssueToHeal,
        executor: async (_issue, val) => {
          savedBatchId = val;
          return true;
        },
        actor: 'qa-specialist',
        actorRole: 'QA',
        reason: 'Chuẩn hóa số lô sang khóa chính ID theo đợt kiểm toán định kỳ.',
      });

      expect(result.success).toBe(true);
      expect(savedBatchId).toBe('batch-canonical-id');
      expect(controlledIssueToHeal.status).toBe('HEALED');
    });

    it('verifyPostHealState: xác minh tính toàn vẹn trạng thái sau hàn gắn', () => {
      let mockDbState = 'batch-canonical-id';
      const isVerified = AutoHealingFramework.verifyPostHealState(
        mockControlledIssue,
        () => mockDbState
      );
      expect(isVerified).toBe(true);

      mockDbState = 'wrong-value';
      const isFailed = AutoHealingFramework.verifyPostHealState(
        mockControlledIssue,
        () => mockDbState
      );
      expect(isFailed).toBe(false);
    });

    it('filterHealableIssues: phân loại danh sách sai lệch thành safe, controlled, blocked', () => {
      const filtered = AutoHealingFramework.filterHealableIssues([
        mockSafeIssue,
        mockControlledIssue,
        mockNeverHealIssue,
      ]);
      expect(filtered.safe).toHaveLength(1);
      expect(filtered.controlled).toHaveLength(1);
      expect(filtered.blocked).toHaveLength(1);
    });
  });

  describe('4. executeAtomicHealingPlan (All-or-Nothing Atomic Transaction)', () => {
    it('thực thi thành công 100% các mutation trong plan khi atomic commit thành công', async () => {
      const plan: HealingPlan = {
        planId: 'PLAN-001',
        correlationId: 'CORR-001',
        status: 'PROPOSED',
        actions: [
          {
            actionId: 'ACT-01',
            issueId: 'ISSUE-01',
            planId: 'PLAN-001',
            entityId: 'TR-01',
            actor: 'qa_user',
            oldValue: 'Đạt',
            newValue: 'PASS',
            reason: 'Chuẩn hóa định dạng',
            timestamp: new Date().toISOString(),
            result: 'PENDING' as const,
            correlationId: 'CORR-001',
          },
          {
            actionId: 'ACT-02',
            issueId: 'ISSUE-02',
            planId: 'PLAN-001',
            entityId: 'TR-02',
            actor: 'qa_user',
            oldValue: 'Không đạt',
            newValue: 'FAIL',
            reason: 'Chuẩn hóa định dạng',
            timestamp: new Date().toISOString(),
            result: 'PENDING' as const,
            correlationId: 'CORR-001',
          },
        ],
      };

      const result = await AutoHealingFramework.executeAtomicHealingPlan({
        plan,
        actor: 'qa_lead',
        actorRole: 'QA',
        atomicCommit: async () => true,
      });

      expect(result.success).toBe(true);
      expect(result.committedActions).toBe(2);
      expect(plan.status).toBe('COMMITTED');
      expect(plan.actions.every((a) => a.result === 'SUCCESS')).toBe(true);
    });

    it('rollback toàn bộ plan nếu atomic commit thất bại (chống tình trạng 1 ✓, 2 ✓, 3 ✗)', async () => {
      let rollbackInvoked = false;
      const plan: HealingPlan = {
        planId: 'PLAN-002',
        correlationId: 'CORR-002',
        status: 'PROPOSED',
        actions: [
          {
            actionId: 'ACT-01',
            issueId: 'ISSUE-01',
            planId: 'PLAN-002',
            entityId: 'BATCH-01',
            actor: 'admin_user',
            oldValue: 'TESTING',
            newValue: 'RELEASED',
            timestamp: new Date().toISOString(),
            result: 'PENDING' as const,
            correlationId: 'CORR-002',
          },
          {
            actionId: 'ACT-02',
            issueId: 'ISSUE-02',
            planId: 'PLAN-002',
            entityId: 'BATCH-02',
            actor: 'admin_user',
            oldValue: 'PENDING',
            newValue: 'RELEASED',
            timestamp: new Date().toISOString(),
            result: 'PENDING' as const,
            correlationId: 'CORR-002',
          },
        ],
      };

      const result = await AutoHealingFramework.executeAtomicHealingPlan({
        plan,
        actor: 'admin_lead',
        actorRole: 'ADMIN',
        atomicCommit: async () => false, // Giả lập commit thất bại
        rollbackHandler: async () => {
          rollbackInvoked = true;
        },
      });

      expect(result.success).toBe(false);
      expect(result.committedActions).toBe(0);
      expect(plan.status).toBe('ROLLED_BACK');
      expect(plan.actions.every((a) => a.result === 'ROLLED_BACK')).toBe(true);
      expect(rollbackInvoked).toBe(true);
    });
  });
});
