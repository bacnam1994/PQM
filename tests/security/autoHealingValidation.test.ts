/**
 * PQM - Auto-Healing & AI Governance Validation Tests (Phase E / Sections 18-19)
 *
 * Kiểm tra toàn diện quy trình Auto-Healing:
 * AI / Detection -> Healing Plan -> Validate Plan -> Authorization -> Preview/Diff -> Atomic Transaction -> Audit -> Verification
 *
 * Các ca kiểm thử bắt buộc:
 * 1. Valid healing (SAFE_AUTO_HEAL format normalization, CONTROLLED_HEAL with QA/ADMIN)
 * 2. Invalid healing (NEVER_AUTO_HEAL blocked on raw lab results, signatures, audit logs, released batches)
 * 3. Unauthorized healing (Thao tác viên OPERATOR hoặc GUEST bị từ chối)
 * 4. Stale healing (Xung đột phiên bản / stale version OCC)
 * 5. Partial failure (Gặp lỗi giữa chừng trong transaction)
 * 6. Rollback (Atomic all-or-nothing rollback & rollbackHandler execution)
 * 7. Audit failure (Kiểm soát ghi nhận audit ALCOA+)
 * 8. Post-healing verification (verifyPostHealState xác minh sau khi sửa)
 * 9. AI proposal enforcement (AI không được phép ghi DB trực tiếp, bắt buộc trả về proposal)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AutoHealingFramework,
  HealingPlan,
  HealingAction,
} from '../../src/domain/healing/autoHealingFramework';
import { CanonicalConsistencyIssue } from '../../src/domain/consistency/consistencyModel';
import { aiActionGuard } from '../../src/services/ai/aiActionGuard';
import { triggerAutoHealingAction } from '../../src/services/ai/tools/autoHealingTool';
import { useAppStore } from '../../src/store/useAppStore';

describe('Auto-Healing & AI Governance Validation Tests (Phase E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Valid Healing
  // --------------------------------------------------------------------------
  it('1. VALID HEALING - SAFE_AUTO_HEAL thực thi thành công cho chuẩn hóa định dạng', async () => {
    const issue: CanonicalConsistencyIssue = {
      id: 'ISSUE-001',
      type: 'UNNORMALIZED_TEST_LAB',
      entityType: 'TEST_RESULT',
      entityId: 'TR-101',
      field: 'overallStatusFormat',
      actual: 'Đạt chuẩn',
      expected: 'PASS',
      severity: 'LOW',
      healingStrategy: 'SAFE_AUTO_HEAL',
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    };

    const preview = AutoHealingFramework.previewHealing(issue, { userRole: 'OPERATOR' });
    expect(preview.canExecute).toBe(true);
    expect(preview.strategy).toBe('SAFE_AUTO_HEAL');
    expect(preview.requiresManualApproval).toBe(false);

    let dbState = 'Đạt chuẩn';
    const execution = await AutoHealingFramework.executeHealing({
      issue,
      executor: async (_iss, proposed) => {
        dbState = proposed;
        return true;
      },
      actor: 'system-agent',
      actorRole: 'OPERATOR',
    });

    expect(execution.success).toBe(true);
    expect(dbState).toBe('PASS');
    expect(issue.status).toBe('HEALED');
  });

  it('1b. VALID HEALING - CONTROLLED_HEAL thực thi thành công khi có QA/ADMIN và lý do', async () => {
    const issue: CanonicalConsistencyIssue = {
      id: 'ISSUE-002',
      type: 'BATCH_FOREIGN_KEY_MISMATCH',
      entityType: 'TEST_RESULT',
      entityId: 'TR-102',
      field: 'batchId',
      actual: 'OLD-BATCH-ID',
      expected: 'NEW-BATCH-ID',
      severity: 'MEDIUM',
      healingStrategy: 'CONTROLLED_HEAL',
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    };

    const preview = AutoHealingFramework.previewHealing(issue, { userRole: 'QA' });
    expect(preview.canExecute).toBe(true);
    expect(preview.strategy).toBe('CONTROLLED_HEAL');
    expect(preview.requiresManualApproval).toBe(true);

    let dbValue = 'OLD-BATCH-ID';
    const execution = await AutoHealingFramework.executeHealing({
      issue,
      executor: async (_iss, val) => {
        dbValue = val;
        return true;
      },
      actor: 'qa_lead@pqm.vn',
      actorRole: 'QA',
      reason: 'Cập nhật lại khóa ngoại theo đúng số lô thực tế trên phiếu xuất xưởng',
    });

    expect(execution.success).toBe(true);
    expect(dbValue).toBe('NEW-BATCH-ID');
    expect(issue.status).toBe('HEALED');
  });

  // --------------------------------------------------------------------------
  // 2. Invalid Healing (NEVER_AUTO_HEAL)
  // --------------------------------------------------------------------------
  it('2. INVALID HEALING - Chặn NEVER_AUTO_HEAL đối với kết quả kiểm nghiệm gốc và chữ ký', () => {
    const forbiddenFields = [
      'results',
      'value',
      'rawMeasurement',
      'signature',
      'electronicSignature',
    ];

    for (const field of forbiddenFields) {
      const strategy = AutoHealingFramework.determineHealingStrategy(
        'TEST_RESULT',
        field,
        'DATA_ANOMALY'
      );
      expect(strategy).toBe('NEVER_AUTO_HEAL');

      const issue: CanonicalConsistencyIssue = {
        id: `ISSUE-${field}`,
        type: 'UNAUTHORIZED_ALTERATION',
        entityType: 'TEST_RESULT',
        entityId: 'TR-999',
        field,
        actual: 90,
        expected: 95,
        severity: 'CRITICAL',
        healingStrategy: strategy,
        status: 'OPEN',
        detectedAt: new Date().toISOString(),
      };

      const preview = AutoHealingFramework.previewHealing(issue, { userRole: 'ADMIN' });
      expect(preview.canExecute).toBe(false);
      expect(preview.blockingReason).toContain('Quy chuẩn GMP & ALCOA+');
    }
  });

  it('2b. INVALID HEALING - Cấm hàn gắn khi Lô hoặc Phiếu đã RELEASED / APPROVED', () => {
    const strategy = AutoHealingFramework.determineHealingStrategy(
      'BATCH',
      'tccsId',
      'TCCS_STALE',
      { isApprovedOrReleased: true }
    );
    expect(strategy).toBe('NEVER_AUTO_HEAL');
  });

  // --------------------------------------------------------------------------
  // 3. Unauthorized Healing
  // --------------------------------------------------------------------------
  it('3. UNAUTHORIZED HEALING - Người dùng không có quyền QA/ADMIN bị từ chối CONTROLLED_HEAL', async () => {
    const issue: CanonicalConsistencyIssue = {
      id: 'ISSUE-003',
      type: 'TCCS_LINK_MISMATCH',
      entityType: 'BATCH',
      entityId: 'BATCH-001',
      field: 'tccsId',
      actual: 'TCCS-OLD',
      expected: 'TCCS-NEW',
      severity: 'HIGH',
      healingStrategy: 'CONTROLLED_HEAL',
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    };

    const preview = AutoHealingFramework.previewHealing(issue, { userRole: 'OPERATOR' });
    expect(preview.canExecute).toBe(false);
    expect(preview.blockingReason).toContain('không có thẩm quyền thực hiện hàn gắn');

    const result = await AutoHealingFramework.executeHealing({
      issue,
      executor: vi.fn(),
      actor: 'operator_user',
      actorRole: 'OPERATOR',
      reason: 'Cố ý cập nhật trái phép',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('không có thẩm quyền thực hiện hàn gắn');
  });

  it('3b. UNAUTHORIZED HEALING - executeAtomicHealingPlan từ chối vai trò không phải QA/ADMIN', async () => {
    const plan: HealingPlan = {
      planId: 'PLAN-001',
      correlationId: 'CORR-001',
      actions: [],
      status: 'PROPOSED',
    };

    const outcome = await AutoHealingFramework.executeAtomicHealingPlan({
      plan,
      actor: 'guest_user',
      actorRole: 'VIEWER',
      atomicCommit: vi.fn(),
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toContain('Chỉ QA hoặc ADMIN mới có quyền');
    expect(plan.status).toBe('FAILED');
  });

  // --------------------------------------------------------------------------
  // 4. Stale Healing (Version Conflict)
  // --------------------------------------------------------------------------
  it('4. STALE HEALING - Phát hiện xung đột khi phiên bản hoặc giá trị thực tế đã thay đổi trước khi commit', async () => {
    let currentDbVersion = 3;
    const issue: CanonicalConsistencyIssue = {
      id: 'ISSUE-STALE-01',
      type: 'ORPHAN_ALIAS',
      entityType: 'RAW_MATERIAL',
      entityId: 'MAT-001',
      field: 'alias',
      actual: 'Ginkgo biloba',
      expected: 'Ginkgo Biloba Standard',
      severity: 'LOW',
      healingStrategy: 'CONTROLLED_HEAL',
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    };

    // Giả lập stale version: plan được tạo ở version 2, nhưng DB hiện tại đã là version 3
    const plannedVersion = 2;
    const executeWithVersionCheck = async () => {
      if (plannedVersion !== currentDbVersion) {
        throw new Error(
          `STALE_VERSION_CONFLICT: Expected v${plannedVersion}, actual v${currentDbVersion}`
        );
      }
      return true;
    };

    const result = await AutoHealingFramework.executeHealing({
      issue,
      executor: executeWithVersionCheck,
      actor: 'qa_user',
      actorRole: 'QA',
      reason: 'Cập nhật alias chuẩn hóa',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('STALE_VERSION_CONFLICT');
    expect(issue.status).toBe('OPEN'); // Không bị đổi thành HEALED
  });

  // --------------------------------------------------------------------------
  // 5 & 6. Partial Failure & Atomic Rollback
  // --------------------------------------------------------------------------
  it('5 & 6. PARTIAL FAILURE & ATOMIC ROLLBACK - Lỗi commit rollback toàn bộ plan', async () => {
    const actions: HealingAction[] = [
      {
        actionId: 'ACT-1',
        issueId: 'ISS-1',
        planId: 'PLAN-ATOMIC',
        entityId: 'E-1',
        actor: 'admin',
        oldValue: 'A',
        newValue: 'A_FIXED',
        timestamp: new Date().toISOString(),
        result: 'PENDING',
        correlationId: 'CORR-ATOMIC',
      },
      {
        actionId: 'ACT-2',
        issueId: 'ISS-2',
        planId: 'PLAN-ATOMIC',
        entityId: 'E-2',
        actor: 'admin',
        oldValue: 'B',
        newValue: 'B_FIXED',
        timestamp: new Date().toISOString(),
        result: 'PENDING',
        correlationId: 'CORR-ATOMIC',
      },
    ];

    const plan: HealingPlan = {
      planId: 'PLAN-ATOMIC',
      correlationId: 'CORR-ATOMIC',
      actions,
      status: 'PROPOSED',
    };

    const rollbackHandlerMock = vi.fn().mockResolvedValue(undefined);

    const outcome = await AutoHealingFramework.executeAtomicHealingPlan({
      plan,
      actor: 'admin_lead',
      actorRole: 'ADMIN',
      atomicCommit: async () => {
        // Giả lập commit giữa chừng gặp lỗi DB
        throw new Error('DATABASE_CONNECTION_LOST_DURING_COMMIT');
      },
      rollbackHandler: rollbackHandlerMock,
    });

    expect(outcome.success).toBe(false);
    expect(outcome.error).toContain('DATABASE_CONNECTION_LOST_DURING_COMMIT');
    expect(plan.status).toBe('ROLLED_BACK');
    expect(actions[0].result).toBe('ROLLED_BACK');
    expect(actions[1].result).toBe('ROLLED_BACK');
    expect(rollbackHandlerMock).toHaveBeenCalledTimes(1);
    expect(rollbackHandlerMock).toHaveBeenCalledWith(actions);
  });

  // --------------------------------------------------------------------------
  // 7. Audit & Reason Enforcement
  // --------------------------------------------------------------------------
  it('7. AUDIT REQUIREMENT - CONTROLLED_HEAL bắt buộc phải có lý do giải trình', async () => {
    const issue: CanonicalConsistencyIssue = {
      id: 'ISSUE-NO-REASON',
      type: 'TCCS_LINK_MISMATCH',
      entityType: 'BATCH',
      entityId: 'BATCH-002',
      field: 'tccsId',
      actual: 'TCCS-1',
      expected: 'TCCS-2',
      severity: 'HIGH',
      healingStrategy: 'CONTROLLED_HEAL',
      status: 'OPEN',
      detectedAt: new Date().toISOString(),
    };

    const result = await AutoHealingFramework.executeHealing({
      issue,
      executor: vi.fn(),
      actor: 'qa_officer',
      actorRole: 'QA',
      reason: '', // Thiếu lý do
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Bắt buộc phải nhập lý do và căn cứ');
  });

  // --------------------------------------------------------------------------
  // 8. Post-Healing Verification
  // --------------------------------------------------------------------------
  it('8. POST-HEALING VERIFICATION - Xác minh trạng thái sau hàn gắn khớp với giá trị kỳ vọng', () => {
    const issue: CanonicalConsistencyIssue = {
      id: 'ISSUE-VERIFY',
      type: 'UNNORMALIZED_TEST_LAB',
      entityType: 'TEST_RESULT',
      entityId: 'TR-200',
      field: 'overallStatus',
      actual: 'Chờ kết quả',
      expected: 'PENDING',
      severity: 'LOW',
      status: 'HEALED',
      detectedAt: new Date().toISOString(),
    };

    let simulatedDbValue = 'PENDING';
    const isVerifiedPass = AutoHealingFramework.verifyPostHealState(issue, () => simulatedDbValue);
    expect(isVerifiedPass).toBe(true);

    simulatedDbValue = 'UNKNOWN'; // Giả lập DB không khớp
    const isVerifiedFail = AutoHealingFramework.verifyPostHealState(issue, () => simulatedDbValue);
    expect(isVerifiedFail).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 9. AI Proposal Enforcement (AI không được ghi DB trực tiếp)
  // --------------------------------------------------------------------------
  it('9. AI PROPOSAL ENFORCEMENT - AI kích hoạt autoHealInconsistencies bắt buộc chuyển thành Proposal yêu cầu phê duyệt', async () => {
    const fakeAdminUser = {
      id: 'admin-ai-user',
      name: 'System Admin',
      email: 'admin@pqm.vn',
      role: 'ADMIN',
    };

    const guard = aiActionGuard.validateAIAction('autoHealInconsistencies', {}, fakeAdminUser);

    // Dù user là ADMIN, vì đây là Regulated Tool Action, guard BẮT BUỘC trả về requiresUserApproval = true
    expect(guard.allowed).toBe(true);
    expect(guard.requiresUserApproval).toBe(true);
    expect(guard.proposal).toBeDefined();
    expect(guard.proposal?.status).toBe('PENDING_APPROVAL');
    expect(guard.proposal?.isRegulated).toBe(true);
    expect(guard.proposal?.requiresConfirmation).toBe(true);

    // Kiểm tra triggerAutoHealingAction trong tool của AI
    vi.spyOn(useAppStore, 'getState').mockReturnValue({
      user: fakeAdminUser,
    } as any);

    const toolResult = await triggerAutoHealingAction();
    expect(toolResult.success).toBe(false);
    expect(toolResult.isRegulated).toBe(true);
    expect(toolResult.requiresApproval).toBe(true);
    expect(toolResult.proposal).toBeDefined();
    expect(toolResult.message).toContain(
      'Hành động tái cấu trúc dữ liệu (Auto-Heal) cần phê duyệt'
    );
  });
});
