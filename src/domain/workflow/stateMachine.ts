/**
 * PQM Domain - Workflow & State Machine Model (Model 10)
 * Kiểm soát chuyển đổi trạng thái thực thể, ngăn chặn các bước nhảy trạng thái sai lệch.
 *
 * Mỗi transition phải có:
 * currentState + action + actor + business conditions = nextState
 */

import { BatchStatus, TestResultStatus } from '../canonical/canonicalStatus';
import { Role } from '../../types/permissions';

export interface StateTransitionResult<TState> {
  success: boolean;
  fromState: TState;
  toState: TState;
  action: string;
  error?: string;
  timestamp: string;
}

export interface TransitionContext {
  actorRole?: Role | string;
  actorId?: string;
  reason?: string;
  conditionsMet?: boolean;
}

export class BatchStateMachine {
  /**
   * Bảng ánh xạ chuyển đổi hợp lệ cho Lô sản xuất (Batch State Transitions)
   */
  private static readonly VALID_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
    PENDING: ['TESTING', 'REJECTED'],
    TESTING: ['RELEASED', 'REJECTED', 'BLOCKED'],
    BLOCKED: ['TESTING', 'REJECTED'],
    RELEASED: ['BLOCKED'], // Đã xuất xưởng chỉ có thể chuyển sang BLOCKED (Thu hồi/Recall)
    REJECTED: ['PENDING'], // Chỉ cho phép mở lại khi có biên bản CAPA đặc biệt
  };

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

    // Kiểm tra thẩm quyền chuyển sang RELEASED
    if (toState === 'RELEASED') {
      if (context?.actorRole && !['ADMIN', 'QA'].includes(context.actorRole)) {
        return {
          allowed: false,
          reason: `Vai trò ${context.actorRole} không được phép chuyển trạng thái sang RELEASED.`,
        };
      }
      if (context?.conditionsMet === false) {
        return {
          allowed: false,
          reason: 'Điều kiện kiểm nghiệm chất lượng chưa đạt để chuyển sang RELEASED.',
        };
      }
    }

    // Kiểm tra chuyển từ REJECTED sang PENDING (Cần lý do thẩm định)
    if (fromState === 'REJECTED' && toState === 'PENDING') {
      if (!context?.reason || context.reason.trim().length === 0) {
        return {
          allowed: false,
          reason:
            'Mở lại Lô đã bị từ chối bắt buộc phải có biên bản giải trình và lý do xét duyệt.',
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
    if (!check.allowed) {
      return {
        success: false,
        fromState,
        toState,
        action,
        error: check.reason,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      fromState,
      toState,
      action,
      timestamp: new Date().toISOString(),
    };
  }
}

export class TestResultStateMachine {
  private static readonly VALID_TRANSITIONS: Record<TestResultStatus, TestResultStatus[]> = {
    PENDING: ['PASS', 'FAIL', 'INVALID'],
    PASS: ['SUPERSEDED', 'INVALID'],
    FAIL: ['SUPERSEDED', 'INVALID'],
    INVALID: ['PENDING'],
    SUPERSEDED: [], // Trạng thái kết thúc của phiếu đã được thay thế
  };

  public static canTransition(
    fromState: TestResultStatus,
    toState: TestResultStatus,
    context?: TransitionContext
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) {
      return { allowed: true };
    }

    const validNext = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNext.includes(toState)) {
      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái phiếu kiểm nghiệm không hợp lệ từ ${fromState} sang ${toState}.`,
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
      };
    }

    return {
      success: true,
      fromState,
      toState,
      action,
      timestamp: new Date().toISOString(),
    };
  }
}
