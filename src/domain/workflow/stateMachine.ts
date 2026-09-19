/**
 * PQM Domain - Workflow & State Machine Model (Model 10)
 * Kiểm soát chuyển đổi trạng thái thực thể, ngăn chặn các bước nhảy trạng thái sai lệch.
 *
 * Mỗi transition phải có:
 * currentState + action + actor + business conditions = nextState
 *
 * Bất biến GMP cốt lõi:
 * 1. RELEASED -> không thể quay về PENDING hay TESTING (chỉ BLOCKED nếu thu hồi).
 * 2. REJECTED -> chỉ có thể mở lại với biên bản giải trình đầy đủ.
 * 3. Chuyển sang RELEASED bắt buộc QA/ADMIN + conditionsMet = true.
 * 4. SUPERSEDED là trạng thái kết thúc tuyệt đối của phiếu kiểm nghiệm.
 */

import { BatchStatus, TestResultStatus } from '../canonical/canonicalStatus';
import { Role } from '../../types/permissions';
import { TestResultWorkflowStatus, CanonicalQualityStatus } from '../../types/testResult';

export interface StateTransitionResult<TState> {
  success: boolean;
  fromState: TState;
  toState: TState;
  action: string;
  error?: string;
  timestamp: string;
  requiresAuditRecord?: boolean;
}

export interface TransitionContext {
  actorRole?: Role | string;
  actorId?: string;
  reason?: string;
  conditionsMet?: boolean;
}

export interface WorkflowHistoryEntry<TState> {
  fromState: TState;
  toState: TState;
  action: string;
  actorId?: string;
  actorRole?: string;
  reason?: string;
  timestamp: string;
}

// ============================================================
// 10a. BatchStateMachine
// ============================================================
export class BatchStateMachine {
  /**
   * Bảng ánh xạ chuyển đổi hợp lệ cho Lô sản xuất (Batch State Transitions)
   * PENDING → TESTING | REJECTED
   * TESTING → RELEASED | REJECTED | BLOCKED
   * BLOCKED → TESTING | REJECTED (Thu hồi/Recall rồi tái thẩm định)
   * RELEASED → BLOCKED (Thu hồi: chỉ chuyển sang BLOCKED, không về PENDING)
   * REJECTED → PENDING (Mở lại với CAPA bắt buộc)
   */
  private static readonly VALID_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
    PENDING: ['TESTING', 'REJECTED'],
    TESTING: ['RELEASED', 'REJECTED', 'BLOCKED'],
    BLOCKED: ['TESTING', 'REJECTED'],
    RELEASED: ['BLOCKED'],
    REJECTED: ['PENDING'],
  };

  /** Danh sách transitions bắt buộc phải tạo ALCOA+ Audit Record */
  private static readonly AUDIT_REQUIRED_TRANSITIONS: Partial<Record<BatchStatus, BatchStatus[]>> =
    {
      TESTING: ['RELEASED', 'REJECTED'],
      RELEASED: ['BLOCKED'],
      BLOCKED: ['REJECTED'],
      REJECTED: ['PENDING'],
    };

  /** Danh sách transitions bắt buộc thẩm quyền QA/ADMIN */
  private static readonly QA_ADMIN_REQUIRED_TRANSITIONS: Partial<
    Record<BatchStatus, BatchStatus[]>
  > = {
    TESTING: ['RELEASED'],
    RELEASED: ['BLOCKED'],
  };

  /**
   * Trả về danh sách các trạng thái hợp lệ tiếp theo từ trạng thái hiện tại
   */
  public static getValidNextStates(fromState: BatchStatus): BatchStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  /**
   * Kiểm tra chuyển trạng thái Lô có hợp lệ không
   */
  public static canTransition(
    fromState: BatchStatus,
    toState: BatchStatus,
    context?: TransitionContext
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) {
      return { allowed: true };
    }

    const validNextStates = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNextStates.includes(toState)) {
      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái không hợp lệ: Không thể chuyển từ ${fromState} sang ${toState}.`,
      };
    }

    // Kiểm tra thẩm quyền chuyển sang RELEASED hoặc thu hồi RELEASED
    const requiresQA = (this.QA_ADMIN_REQUIRED_TRANSITIONS[fromState] || []).includes(toState);
    if (requiresQA && context?.actorRole && !['ADMIN', 'QA'].includes(String(context.actorRole))) {
      return {
        allowed: false,
        reason: `Vai trò ${context.actorRole} không được phép thực hiện chuyển trạng thái từ ${fromState} sang ${toState}. Cần thẩm quyền QA hoặc ADMIN.`,
      };
    }

    // Bắt buộc conditionsMet khi chuyển sang RELEASED
    if (toState === 'RELEASED') {
      if (context?.conditionsMet === false) {
        return {
          allowed: false,
          reason: 'Điều kiện kiểm nghiệm chất lượng chưa đạt để chuyển sang RELEASED.',
        };
      }
    }

    // Mở lại lô REJECTED bắt buộc phải có lý do thẩm định (CAPA)
    if (fromState === 'REJECTED' && toState === 'PENDING') {
      if (!context?.reason || context.reason.trim().length === 0) {
        return {
          allowed: false,
          reason:
            'Mở lại Lô đã bị từ chối bắt buộc phải có biên bản giải trình và lý do xét duyệt.',
        };
      }
    }

    // Thu hồi RELEASED -> BLOCKED bắt buộc có lý do nghiệp vụ
    if (fromState === 'RELEASED' && toState === 'BLOCKED') {
      if (!context?.reason || context.reason.trim().length === 0) {
        return {
          allowed: false,
          reason: 'Thu hồi lô đã xuất xưởng bắt buộc phải có lý do thu hồi rõ ràng.',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Thực hiện chuyển đổi trạng thái Lô sản xuất
   */
  public static transition(
    fromState: BatchStatus,
    toState: BatchStatus,
    action: string,
    context?: TransitionContext
  ): StateTransitionResult<BatchStatus> {
    const check = this.canTransition(fromState, toState, context);
    const requiresAuditRecord = (this.AUDIT_REQUIRED_TRANSITIONS[fromState] || []).includes(
      toState
    );

    if (!check.allowed) {
      return {
        success: false,
        fromState,
        toState,
        action,
        error: check.reason,
        timestamp: new Date().toISOString(),
        requiresAuditRecord,
      };
    }

    return {
      success: true,
      fromState,
      toState,
      action,
      timestamp: new Date().toISOString(),
      requiresAuditRecord,
    };
  }

  /**
   * Tạo lịch sử workflow từ chuỗi chuyển đổi
   */
  public static buildHistory(
    transitions: Array<
      StateTransitionResult<BatchStatus> & { actorId?: string; actorRole?: string; reason?: string }
    >
  ): WorkflowHistoryEntry<BatchStatus>[] {
    return transitions
      .filter((t) => t.success)
      .map((t) => ({
        fromState: t.fromState,
        toState: t.toState,
        action: t.action,
        actorId: t.actorId,
        actorRole: t.actorRole,
        reason: t.reason,
        timestamp: t.timestamp,
      }));
  }
}

// ============================================================
// 10b. TestResultStateMachine
// ============================================================
export class TestResultStateMachine {
  private static readonly VALID_TRANSITIONS: Record<TestResultStatus, TestResultStatus[]> = {
    PENDING: ['PASS', 'FAIL', 'INVALID'],
    PASS: ['SUPERSEDED', 'INVALID'],
    FAIL: ['SUPERSEDED', 'INVALID'],
    INVALID: ['PENDING'],
    SUPERSEDED: [], // Trạng thái kết thúc tuyệt đối — không được chuyển tiếp
  };

  /** Transitions bắt buộc QA/ADMIN */
  private static readonly QA_ADMIN_REQUIRED: Partial<Record<TestResultStatus, TestResultStatus[]>> =
    {
      PENDING: ['PASS'],
      FAIL: ['SUPERSEDED'],
      PASS: ['SUPERSEDED'],
    };

  public static getValidNextStates(fromState: TestResultStatus): TestResultStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  public static canTransition(
    fromState: TestResultStatus,
    toState: TestResultStatus,
    context?: TransitionContext
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) {
      return { allowed: true };
    }

    // SUPERSEDED là trạng thái kết thúc tuyệt đối
    if (fromState === 'SUPERSEDED') {
      return {
        allowed: false,
        reason:
          'Phiếu kiểm nghiệm đã được thay thế (SUPERSEDED) là trạng thái kết thúc bất biến — không thể chuyển đổi tiếp.',
      };
    }

    const validNext = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNext.includes(toState)) {
      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái phiếu kiểm nghiệm không hợp lệ từ ${fromState} sang ${toState}.`,
      };
    }

    // Chuyển PENDING -> PASS yêu cầu thẩm quyền
    const requiresQA = (this.QA_ADMIN_REQUIRED[fromState] || []).includes(toState);
    if (
      requiresQA &&
      context?.actorRole &&
      !['ADMIN', 'QA', 'QC'].includes(String(context.actorRole))
    ) {
      return {
        allowed: false,
        reason: `Thao tác phê duyệt kết quả ${fromState} -> ${toState} yêu cầu thẩm quyền QA/QC/ADMIN.`,
      };
    }

    return { allowed: true };
  }

  public static transition(
    fromState: TestResultStatus,
    toState: TestResultStatus,
    action: string,
    context?: TransitionContext
  ): StateTransitionResult<TestResultStatus> {
    const check = this.canTransition(fromState, toState, context);
    if (!check.allowed) {
      return {
        success: false,
        fromState,
        toState,
        action,
        error: check.reason,
        timestamp: new Date().toISOString(),
        requiresAuditRecord: true,
      };
    }

    return {
      success: true,
      fromState,
      toState,
      action,
      timestamp: new Date().toISOString(),
      requiresAuditRecord: ['PASS', 'FAIL', 'SUPERSEDED'].includes(toState),
    };
  }
}

// ============================================================
// 10c. WorkflowValidator — xác thực chuỗi workflow hoàn chỉnh
// ============================================================
export class WorkflowValidator {
  /**
   * Xác thực chuỗi trạng thái lô sản xuất có hợp lệ theo luật GMP không
   * @param stateHistory Mảng trạng thái theo thứ tự thời gian
   */
  public static validateBatchStateChain(stateHistory: BatchStatus[]): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    for (let i = 1; i < stateHistory.length; i++) {
      const from = stateHistory[i - 1];
      const to = stateHistory[i];
      const validNext = BatchStateMachine.getValidNextStates(from);

      if (from !== to && !validNext.includes(to)) {
        violations.push(`Bước ${i}: Chuyển đổi bất hợp pháp ${from} -> ${to}`);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * Xác thực chuỗi trạng thái phiếu kiểm nghiệm
   */
  public static validateTestResultStateChain(stateHistory: TestResultStatus[]): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    for (let i = 1; i < stateHistory.length; i++) {
      const from = stateHistory[i - 1];
      const to = stateHistory[i];

      if (from === 'SUPERSEDED') {
        violations.push(
          `Bước ${i}: Phiếu kiểm nghiệm đã SUPERSEDED không thể chuyển tiếp sang ${to}.`
        );
        continue;
      }

      const validNext = TestResultStateMachine.getValidNextStates(from);
      if (from !== to && !validNext.includes(to)) {
        violations.push(`Bước ${i}: Chuyển đổi bất hợp pháp ${from} -> ${to}`);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }
}

// ============================================================
// 10d. TestResultWorkflowStateMachine (Document Lifecycle FSM)
// ============================================================
export class TestResultWorkflowStateMachine {
  /**
   * Ma trận chuyển đổi vòng đời quy trình tài liệu theo PQM_STATE_TRANSITION_MATRIX.md
   * DRAFT -> SUBMITTED | SUPERSEDED
   * SUBMITTED -> DRAFT | FINAL | SUPERSEDED
   * FINAL -> APPROVED | SUPERSEDED
   * APPROVED -> RELEASED | SUPERSEDED
   * RELEASED -> SUPERSEDED
   * REJECTED -> DRAFT | SUPERSEDED
   * SUPERSEDED -> [] (Trạng thái kết thúc tuyệt đối)
   */
  private static readonly VALID_TRANSITIONS: Record<
    TestResultWorkflowStatus,
    TestResultWorkflowStatus[]
  > = {
    DRAFT: ['SUBMITTED', 'SUPERSEDED'],
    SUBMITTED: ['DRAFT', 'FINAL', 'SUPERSEDED'],
    FINAL: ['APPROVED', 'SUPERSEDED'],
    APPROVED: ['RELEASED', 'SUPERSEDED'],
    RELEASED: ['SUPERSEDED'],
    REJECTED: ['DRAFT', 'SUPERSEDED'],
    SUPERSEDED: [],
  };

  /** Thẩm quyền vai trò bắt buộc cho từng bước nhảy quy trình */
  private static readonly ROLE_REQUIREMENTS: Partial<
    Record<TestResultWorkflowStatus, Partial<Record<TestResultWorkflowStatus, string[]>>>
  > = {
    DRAFT: {
      SUBMITTED: ['LAB', 'QC', 'QA', 'ADMIN'],
    },
    SUBMITTED: {
      DRAFT: ['LAB', 'QC', 'QA', 'ADMIN'],
      FINAL: ['QC', 'QA', 'ADMIN'],
    },
    FINAL: {
      APPROVED: ['QA', 'ADMIN'],
    },
    APPROVED: {
      RELEASED: ['QA', 'ADMIN'],
    },
  };

  public static getValidNextStates(
    fromState: TestResultWorkflowStatus
  ): TestResultWorkflowStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  public static canTransition(
    fromState: TestResultWorkflowStatus,
    toState: TestResultWorkflowStatus,
    context?: TransitionContext
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) {
      return { allowed: true };
    }

    if (fromState === 'SUPERSEDED') {
      return {
        allowed: false,
        reason:
          'Phiếu kiểm nghiệm đã SUPERSEDED là trạng thái kết thúc bất biến — cấm chuyển đổi tiếp.',
      };
    }

    const validNext = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNext.includes(toState)) {
      return {
        allowed: false,
        reason: `Chuyển đổi quy trình không hợp lệ: Không thể chuyển từ ${fromState} sang ${toState}.`,
      };
    }

    // Kiểm tra vai trò
    const allowedRoles = this.ROLE_REQUIREMENTS[fromState]?.[toState];
    if (allowedRoles && context?.actorRole) {
      const roleStr = String(context.actorRole).toUpperCase();
      if (!allowedRoles.includes(roleStr) && roleStr !== 'ADMIN') {
        return {
          allowed: false,
          reason: `Vai trò ${context.actorRole} không có thẩm quyền chuyển trạng thái quy trình từ ${fromState} sang ${toState}. Yêu cầu: ${allowedRoles.join(', ')}.`,
        };
      }
    }

    return { allowed: true };
  }

  public static transition(
    fromState: TestResultWorkflowStatus,
    toState: TestResultWorkflowStatus,
    action: string,
    context?: TransitionContext
  ): StateTransitionResult<TestResultWorkflowStatus> {
    const check = this.canTransition(fromState, toState, context);
    if (!check.allowed) {
      return {
        success: false,
        fromState,
        toState,
        action,
        error: check.reason,
        timestamp: new Date().toISOString(),
        requiresAuditRecord: true,
      };
    }

    return {
      success: true,
      fromState,
      toState,
      action,
      timestamp: new Date().toISOString(),
      requiresAuditRecord: ['FINAL', 'APPROVED', 'RELEASED', 'SUPERSEDED'].includes(toState),
    };
  }
}

// ============================================================
// 10e. QualityWorkflowMatrixGuard (Quality × Workflow Matrix)
// ============================================================
export class QualityWorkflowMatrixGuard {
  /**
   * Thẩm tra tính hợp lệ giữa QualityStatus và WorkflowStatus
   * Theo bảng ma trận Section 10 PQM_SYSTEM_WORKFLOW_MASTER.md:
   *
   * WorkflowStatus | UNKNOWN | PENDING | PASS | FAIL
   * DRAFT          |    OK   |   OK    |  OK  |  OK
   * SUBMITTED      |  FORBID |   OK    |  OK  |  OK
   * FINAL          |  FORBID | FORBID  |  OK  |  OK
   * APPROVED       |  FORBID | FORBID  |  OK  |  OK
   * RELEASED       |  FORBID | FORBID  |  OK  | FORBID (BẤT BIẾN GMP)
   * SUPERSEDED     |    OK   |   OK    |  OK  |  OK
   */
  public static validate(
    workflowStatus: TestResultWorkflowStatus,
    qualityStatus: CanonicalQualityStatus
  ): { allowed: boolean; reason?: string } {
    if (workflowStatus === 'SUBMITTED' && qualityStatus === 'UNKNOWN') {
      return {
        allowed: false,
        reason:
          'Không được nộp phiếu kiểm nghiệm (SUBMITTED) khi trạng thái chất lượng là UNKNOWN (chưa có kết quả chỉ tiêu).',
      };
    }

    if (
      workflowStatus === 'FINAL' &&
      (qualityStatus === 'UNKNOWN' || qualityStatus === 'PENDING')
    ) {
      return {
        allowed: false,
        reason: `Không thể chốt kỹ thuật (FINAL) khi chất lượng còn ở trạng thái ${qualityStatus}. Bắt buộc tất cả chỉ tiêu phải có kết luận rõ ràng.`,
      };
    }

    if (
      workflowStatus === 'APPROVED' &&
      (qualityStatus === 'UNKNOWN' || qualityStatus === 'PENDING')
    ) {
      return {
        allowed: false,
        reason: `QA không thể phê duyệt (APPROVED) khi chất lượng còn ở trạng thái ${qualityStatus}.`,
      };
    }

    if (workflowStatus === 'RELEASED') {
      if (qualityStatus === 'FAIL') {
        return {
          allowed: false,
          reason:
            'BẤT BIẾN GMP: Tuyệt đối cấm xuất xưởng (RELEASED) phiếu hoặc Lô hàng có kết quả kiểm nghiệm FAIL.',
        };
      }
      if (qualityStatus === 'UNKNOWN' || qualityStatus === 'PENDING') {
        return {
          allowed: false,
          reason: `Không thể xuất xưởng (RELEASED) khi chất lượng kiểm nghiệm là ${qualityStatus}.`,
        };
      }
    }

    return { allowed: true };
  }
}
