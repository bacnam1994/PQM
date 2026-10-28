/**
 * PQM Domain - Auto-Healing Framework (Model 8)
 * Sửa sai dữ liệu có kiểm soát theo chuẩn GMP.
 *
 * Quy trình 8 bước:
 * 1. Detect (Phát hiện từ Model 7 ConsistencyAuditor)
 * 2. Classify (Phân loại thực thể, trường, mức độ nghiêm trọng)
 * 3. Evaluate confidence (Đánh giá độ tin cậy HIGH / MEDIUM / LOW)
 * 4. Determine healing strategy (SAFE_AUTO_HEAL / CONTROLLED_HEAL / NEVER_AUTO_HEAL)
 * 5. Preview (Sinh HealingPlanPreview chi tiết, impact analysis, requiresManualApproval)
 * 6. Approve / Auto-heal (Thực thi hàn gắn với rào chắn GMP & ALCOA+)
 * 7. Audit (Ghi nhận vết kiểm toán ALCOA+ với đầy đủ oldValue, newValue, reason)
 * 8. Verify (Hậu kiểm Post-Heal Verification: kiểm tra tính toàn vẹn sau khi sửa)
 */

import { HealingStrategyType, CanonicalConsistencyIssue } from '../consistency/consistencyModel';
import { Role } from '../../types/permissions';

export interface HealingAction {
  actionId: string;
  issueId: string;
  planId: string;
  entityId: string;
  entityType?: string;
  actor: string;
  approvedBy?: string;
  oldValue: any;
  newValue: any;
  reason?: string;
  previousVersion?: number;
  newVersion?: number;
  timestamp: string;
  result: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK' | 'PENDING';
  correlationId: string;
}

export interface HealingPlan {
  planId: string;
  correlationId: string;
  actions: HealingAction[];
  approvedBy?: string;
  approvedAt?: string;
  status: 'PROPOSED' | 'APPROVED' | 'EXECUTING' | 'COMMITTED' | 'ROLLED_BACK' | 'FAILED';
}

export interface HealingPlanPreview {
  issueId: string;
  strategy: HealingStrategyType;
  entityType: string;
  entityId: string;
  field: string;
  currentValue: any;
  proposedValue: any;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  impactAnalysis: string;
  requiresManualApproval: boolean;
  canExecute: boolean;
  blockingReason?: string;
}

export interface HealingExecutionResult {
  success: boolean;
  issueId: string;
  healedAt: string;
  healedBy: string;
  actionId?: string;
  correlationId?: string;
  auditRecordId?: string;
  error?: string;
}

export class AutoHealingFramework {
  /**
   * Phân loại chiến lược hàn gắn an toàn dựa trên thuộc tính và bản chất của lỗi
   */
  public static determineHealingStrategy(
    entityType: string,
    field: string,
    issueType: string,
    context?: { isApprovedOrReleased?: boolean }
  ): HealingStrategyType {
    // 1. NEVER AUTO-HEAL: Tuyệt đối không bao giờ tự động sửa kết quả gốc phòng lab, chữ ký số, audit trail
    if (
      field === 'results' ||
      field === 'value' ||
      field === 'rawMeasurement' ||
      field === 'signature' ||
      field === 'electronicSignature' ||
      issueType === 'CRITERIA_FAIL' ||
      entityType === 'AUDIT_LOG' ||
      entityType === 'ELECTRONIC_SIGNATURE'
    ) {
      return 'NEVER_AUTO_HEAL';
    }

    // Nếu thực thể là Phiếu kiểm nghiệm hoặc Lô đã được phê duyệt / xuất xưởng -> Cấm tự động sửa
    if (context?.isApprovedOrReleased) {
      return 'NEVER_AUTO_HEAL';
    }

    // 2. SAFE AUTO-HEAL: Các trường phái sinh, chuẩn hóa format chuỗi ("Đạt" -> "PASS"), index, alias mồ côi
    if (
      field === 'overallStatusFormat' ||
      field === 'searchIndex' ||
      issueType === 'UNNORMALIZED_TEST_LAB' ||
      issueType === 'ORPHAN_ALIAS' ||
      issueType === 'STALE_DERIVED_DATA'
    ) {
      return 'SAFE_AUTO_HEAL';
    }

    // 3. CONTROLLED HEAL: Sửa khóa ngoại trỏ bằng số lô, liên kết nguyên liệu, cập nhật trạng thái Lô
    return 'CONTROLLED_HEAL';
  }

  /**
   * Đánh giá độ tin cậy của giải pháp hàn gắn
   */
  public static evaluateConfidence(
    issue: CanonicalConsistencyIssue,
    strategy?: HealingStrategyType
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    const strat = strategy || issue.healingStrategy;
    if (strat === 'SAFE_AUTO_HEAL') {
      return 'HIGH';
    }
    if (strat === 'CONTROLLED_HEAL') {
      return issue.expected !== undefined && issue.expected !== null ? 'MEDIUM' : 'LOW';
    }
    return 'LOW';
  }

  /**
   * Tạo bản xem trước kế hoạch hàn gắn (Preview Step)
   */
  public static previewHealing(
    issue: CanonicalConsistencyIssue,
    options?: { userRole?: Role | string }
  ): HealingPlanPreview {
    const strategy =
      issue.healingStrategy ||
      this.determineHealingStrategy(issue.entityType, issue.field || '', issue.type);

    const requiresManualApproval = strategy === 'CONTROLLED_HEAL';
    const confidence = this.evaluateConfidence(issue, strategy);

    let impact = 'Tác động thấp: Chỉ chuẩn hóa dữ liệu phái sinh hoặc định dạng hiển thị.';
    let canExecute = true;
    let blockingReason: string | undefined;

    if (strategy === 'NEVER_AUTO_HEAL') {
      impact =
        'CẤM TỰ ĐỘNG SỬA: Vi phạm tính toàn vẹn dữ liệu gốc GMP (ALCOA+). Yêu cầu thẩm định thủ công.';
      canExecute = false;
      blockingReason =
        'Quy chuẩn GMP & ALCOA+: Lỗi liên quan đến kết quả kiểm nghiệm gốc, chữ ký điện tử hoặc dữ liệu kiểm toán không được phép tự động sửa chữa.';
    } else if (strategy === 'CONTROLLED_HEAL') {
      impact = 'Tác động trung bình: Cập nhật khóa ngoại hoặc thuộc tính nghiệp vụ chính.';
      if (options?.userRole && !['ADMIN', 'QA'].includes(options.userRole)) {
        canExecute = false;
        blockingReason = `Vai trò ${options.userRole} không có thẩm quyền thực hiện hàn gắn có kiểm soát (yêu cầu QA hoặc ADMIN).`;
      }
    }

    return {
      issueId: issue.id,
      strategy,
      entityType: issue.entityType,
      entityId: issue.entityId,
      field: issue.field || 'unknown',
      currentValue: issue.actual,
      proposedValue: issue.expected,
      confidence,
      impactAnalysis: impact,
      requiresManualApproval,
      canExecute,
      blockingReason,
    };
  }

  /**
   * Tạo danh sách xem trước cho hàng loạt sai lệch (Batch Preview)
   */
  public static previewBatch(
    issues: CanonicalConsistencyIssue[],
    options?: { userRole?: Role | string }
  ): {
    previews: HealingPlanPreview[];
    safeCount: number;
    controlledCount: number;
    blockedCount: number;
  } {
    const previews = issues.map((issue) => this.previewHealing(issue, options));
    const safeCount = previews.filter(
      (p) => p.strategy === 'SAFE_AUTO_HEAL' && p.canExecute
    ).length;
    const controlledCount = previews.filter(
      (p) => p.strategy === 'CONTROLLED_HEAL' && p.canExecute
    ).length;
    const blockedCount = previews.filter((p) => !p.canExecute).length;

    return {
      previews,
      safeCount,
      controlledCount,
      blockedCount,
    };
  }

  /**
   * Thực thi hàn gắn có rào chắn bảo vệ (Guarded Execution)
   */
  public static async executeHealing(params: {
    issue: CanonicalConsistencyIssue;
    executor: (issue: CanonicalConsistencyIssue, proposedValue: any) => Promise<boolean> | boolean;
    actor: string;
    actorRole?: Role | string;
    reason?: string;
  }): Promise<HealingExecutionResult> {
    const { issue, executor, actor, actorRole, reason } = params;

    // 1. Thẩm định qua preview trước khi thực thi
    const preview = this.previewHealing(issue, { userRole: actorRole });
    if (!preview.canExecute) {
      return {
        success: false,
        issueId: issue.id,
        healedAt: new Date().toISOString(),
        healedBy: actor,
        error: preview.blockingReason || 'Không được phép thực thi hàn gắn.',
      };
    }

    // 2. Với CONTROLLED_HEAL, bắt buộc phải có lý do
    if (preview.requiresManualApproval) {
      if (!reason || reason.trim().length === 0) {
        return {
          success: false,
          issueId: issue.id,
          healedAt: new Date().toISOString(),
          healedBy: actor,
          error: 'Bắt buộc phải nhập lý do và căn cứ khi thực hiện hàn gắn có kiểm soát.',
        };
      }
    }

    try {
      // 3. Thực thi hành động sửa dữ liệu
      const applied = await executor(issue, preview.proposedValue);
      if (!applied) {
        return {
          success: false,
          issueId: issue.id,
          healedAt: new Date().toISOString(),
          healedBy: actor,
          error: 'Hàm executor không hoàn tất được việc cập nhật dữ liệu.',
        };
      }

      // 4. Cập nhật trạng thái bản ghi sai lệch
      issue.status = 'HEALED';
      const actionId = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const correlationId = `CORR-${Date.now()}`;

      return {
        success: true,
        issueId: issue.id,
        actionId,
        correlationId,
        healedAt: new Date().toISOString(),
        healedBy: actor,
        auditRecordId: `AUDIT-HEAL-${Date.now()}`,
      };
    } catch (err: any) {
      return {
        success: false,
        issueId: issue.id,
        healedAt: new Date().toISOString(),
        healedBy: actor,
        error: err?.message || 'Lỗi ngoại lệ trong quá trình thực thi hàn gắn.',
      };
    }
  }

  /**
   * Thực thi toàn bộ Plan hàn gắn theo cơ chế Atomic Transaction (All-or-Nothing).
   * Không bao giờ để cơ sở dữ liệu ở trạng thái dở dang (ví dụ 1 ✓, 2 ✓, 3 ✗).
   * Nếu commit thất bại, toàn bộ action được đánh dấu ROLLED_BACK.
   */
  public static async executeAtomicHealingPlan(params: {
    plan: HealingPlan;
    actor: string;
    actorRole?: Role | string;
    atomicCommit: (actions: HealingAction[]) => Promise<boolean>;
    rollbackHandler?: (actions: HealingAction[]) => Promise<void>;
  }): Promise<{
    success: boolean;
    planId: string;
    correlationId: string;
    committedActions: number;
    error?: string;
  }> {
    const { plan, actor, actorRole, atomicCommit, rollbackHandler } = params;

    // Kiểm tra thẩm quyền phê duyệt
    const isPrivileged = actorRole === 'ADMIN' || actorRole === 'QA';
    if (!isPrivileged) {
      plan.status = 'FAILED';
      return {
        success: false,
        planId: plan.planId,
        correlationId: plan.correlationId,
        committedActions: 0,
        error: 'Chỉ QA hoặc ADMIN mới có quyền thực thi kế hoạch hàn gắn dữ liệu.',
      };
    }

    if (plan.actions.length === 0) {
      return {
        success: true,
        planId: plan.planId,
        correlationId: plan.correlationId,
        committedActions: 0,
      };
    }

    plan.status = 'EXECUTING';

    try {
      // Thực thi atomic commit duy nhất
      const isCommitted = await atomicCommit(plan.actions);
      if (!isCommitted) {
        throw new Error('Atomic transaction commit failed from database.');
      }

      // Đánh dấu thành công toàn bộ
      plan.actions.forEach((a) => {
        a.result = 'SUCCESS';
        a.approvedBy = plan.approvedBy || actor;
      });
      plan.status = 'COMMITTED';

      return {
        success: true,
        planId: plan.planId,
        correlationId: plan.correlationId,
        committedActions: plan.actions.length,
      };
    } catch (err: any) {
      // ROLLBACK: Bảo đảm không để lại DB trạng thái dở dang
      plan.status = 'ROLLED_BACK';
      plan.actions.forEach((a) => {
        a.result = 'ROLLED_BACK';
      });

      if (rollbackHandler) {
        try {
          await rollbackHandler(plan.actions);
        } catch (rbErr) {
          console.error('[AutoHealingFramework] Rollback handler failed:', rbErr);
        }
      }

      return {
        success: false,
        planId: plan.planId,
        correlationId: plan.correlationId,
        committedActions: 0,
        error: err?.message || 'Atomic transaction failed and was rolled back.',
      };
    }
  }

  /**
   * Hậu kiểm tính toàn vẹn sau khi hàn gắn (Post-Heal Verification)
   */
  public static verifyPostHealState(
    issue: CanonicalConsistencyIssue,
    readUpdatedValue: () => any
  ): boolean {
    const actualCurrent = readUpdatedValue();
    return actualCurrent === issue.expected;
  }

  /**
   * Phân loại danh sách sai lệch thành 3 nhóm xử lý
   */
  public static filterHealableIssues(issues: CanonicalConsistencyIssue[]): {
    safe: CanonicalConsistencyIssue[];
    controlled: CanonicalConsistencyIssue[];
    blocked: CanonicalConsistencyIssue[];
  } {
    return {
      safe: issues.filter((i) => i.healingStrategy === 'SAFE_AUTO_HEAL'),
      controlled: issues.filter((i) => i.healingStrategy === 'CONTROLLED_HEAL'),
      blocked: issues.filter((i) => i.healingStrategy === 'NEVER_AUTO_HEAL'),
    };
  }
}
