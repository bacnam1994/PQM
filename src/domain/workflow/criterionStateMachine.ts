/**
 * criterionStateMachine.ts
 * PQM Domain - Criterion & Alternate Rule State Machines (Model 10 Extension)
 * Tuân thủ 100% tài liệu: docs/contracts/STATE_MACHINES.md
 *
 * Quản lý vòng đời trạng thái ở cấp chỉ tiêu:
 * 1. CriterionResultStateMachine: Quản lý CriterionEvaluationState
 *    (NOT_STARTED -> REQUIRED -> TESTING -> PASS / FAIL / PENDING / EXEMPTED / NOT_APPLICABLE)
 * 2. AlternateRuleStateMachine: Quản lý AlternateCriterionState
 *    (NONE -> NOT_TRIGGERED -> TRIGGERED_PENDING -> TRIGGERED_PASS / TRIGGERED_FAIL / EXEMPTED)
 */

import { CriterionEvaluationState, AlternateCriterionState } from '../../types/testResult';

export interface StateTransitionCheck<TState> {
  allowed: boolean;
  from: TState;
  to: TState;
  reason?: string;
}

// ============================================================
// 1. CriterionResultStateMachine
// ============================================================
export class CriterionResultStateMachine {
  /**
   * Bảng ma trận chuyển dịch trạng thái hợp lệ của chỉ tiêu
   */
  private static readonly VALID_TRANSITIONS: Record<
    CriterionEvaluationState,
    CriterionEvaluationState[]
  > = {
    NOT_STARTED: ['REQUIRED', 'TESTING', 'EXEMPTED', 'NOT_APPLICABLE'],
    REQUIRED: ['TESTING', 'EXEMPTED', 'NOT_APPLICABLE', 'PENDING'],
    TESTING: ['PASS', 'FAIL', 'PENDING', 'EXEMPTED'],
    PASS: ['TESTING', 'PASS'], // Cho phép kiểm tra lại nếu có Re-test
    FAIL: ['TESTING', 'FAIL'], // Cho phép thử nghiệm bổ sung hoặc OOS retest
    PENDING: ['TESTING', 'PASS', 'FAIL', 'EXEMPTED'],
    EXEMPTED: ['REQUIRED', 'TESTING'], // Nếu chỉ tiêu chính bị hủy/sửa, có thể mở lại
    NOT_APPLICABLE: ['NOT_STARTED', 'REQUIRED'],
  };

  /**
   * Kiểm tra xem bước chuyển trạng thái có hợp lệ hay không
   */
  public static canTransition(
    from: CriterionEvaluationState,
    to: CriterionEvaluationState
  ): StateTransitionCheck<CriterionEvaluationState> {
    if (from === to) {
      return { allowed: true, from, to };
    }

    const allowedNextStates = this.VALID_TRANSITIONS[from] || [];
    if (!allowedNextStates.includes(to)) {
      return {
        allowed: false,
        from,
        to,
        reason: `Bước chuyển trạng thái không hợp lệ: Không thể chuyển chỉ tiêu từ [${from}] sang [${to}].`,
      };
    }

    return { allowed: true, from, to };
  }

  /**
   * Thực hiện chuyển đổi trạng thái chỉ tiêu, ném lỗi nếu vi phạm
   */
  public static transition(
    from: CriterionEvaluationState,
    to: CriterionEvaluationState
  ): CriterionEvaluationState {
    const check = this.canTransition(from, to);
    if (!check.allowed) {
      throw new Error(check.reason);
    }
    return to;
  }
}

// ============================================================
// 2. AlternateRuleStateMachine
// ============================================================
export class AlternateRuleStateMachine {
  /**
   * Bảng chuyển đổi trạng thái của Quy tắc thay thế
   * NONE -> NOT_TRIGGERED
   * NOT_TRIGGERED -> EXEMPTED (khi Main PASS) | TRIGGERED_PENDING (khi Main FAIL/Triggered)
   * TRIGGERED_PENDING -> TRIGGERED_PASS | TRIGGERED_FAIL | NOT_TRIGGERED (nếu reset)
   * TRIGGERED_PASS -> TRIGGERED_PENDING (nếu sửa lại kết quả)
   * TRIGGERED_FAIL -> TRIGGERED_PENDING (nếu thử lại)
   * EXEMPTED -> TRIGGERED_PENDING (nếu Main bị sửa thành FAIL) | NOT_TRIGGERED
   */
  private static readonly VALID_TRANSITIONS: Record<
    AlternateCriterionState,
    AlternateCriterionState[]
  > = {
    NONE: ['NOT_TRIGGERED'],
    NOT_TRIGGERED: ['EXEMPTED', 'TRIGGERED_PENDING', 'NONE'],
    TRIGGERED_PENDING: ['TRIGGERED_PASS', 'TRIGGERED_FAIL', 'NOT_TRIGGERED'],
    TRIGGERED_PASS: ['TRIGGERED_PENDING', 'NOT_TRIGGERED'],
    TRIGGERED_FAIL: ['TRIGGERED_PENDING', 'NOT_TRIGGERED'],
    EXEMPTED: ['TRIGGERED_PENDING', 'NOT_TRIGGERED'],
  };

  /**
   * Kiểm tra tính hợp lệ của việc chuyển trạng thái Alternate
   */
  public static canTransition(
    from: AlternateCriterionState,
    to: AlternateCriterionState
  ): StateTransitionCheck<AlternateCriterionState> {
    if (from === to) {
      return { allowed: true, from, to };
    }

    const allowed = this.VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      return {
        allowed: false,
        from,
        to,
        reason: `Bước chuyển trạng thái Alternate Rule không hợp lệ từ [${from}] sang [${to}].`,
      };
    }

    return { allowed: true, from, to };
  }

  /**
   * Phân giải trạng thái AlternateRule một cách tiền định dựa trên trạng thái của Main và Alt
   */
  public static resolveNextState(params: {
    isTriggered: boolean;
    mainIsPass: boolean | null;
    altHasValue: boolean;
    altIsPass: boolean | null;
  }): AlternateCriterionState {
    const { isTriggered, mainIsPass, altHasValue, altIsPass } = params;

    // 1. Nếu chỉ tiêu chính ĐẠT (PASS) và không bị trigger điều kiện ngoại lệ -> EXEMPTED
    if (mainIsPass === true && !isTriggered) {
      return 'EXEMPTED';
    }

    // 2. Nếu đã kích hoạt (Main FAIL hoặc thỏa điều kiện kích hoạt):
    if (isTriggered) {
      // Chưa nhập kết quả cho chỉ tiêu phụ -> TRIGGERED_PENDING
      if (!altHasValue || altIsPass === null) {
        return 'TRIGGERED_PENDING';
      }

      // Đã nhập và ĐẠT -> TRIGGERED_PASS
      if (altIsPass === true) {
        return 'TRIGGERED_PASS';
      }

      // Đã nhập và KHÔNG ĐẠT -> TRIGGERED_FAIL
      return 'TRIGGERED_FAIL';
    }

    // 3. Chưa có kết quả hoặc chưa bị kích hoạt -> NOT_TRIGGERED
    return 'NOT_TRIGGERED';
  }
}

/** Alias chuẩn hóa theo STATE_MACHINES.md */
export const CriterionStateMachine = CriterionResultStateMachine;
