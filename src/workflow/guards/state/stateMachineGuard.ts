/**
 * STATE MACHINE GUARD (FINITE STATE MACHINE TRANSITION)
 *
 * Kiểm tra tính hợp lệ của việc chuyển đổi trạng thái thực thể theo FSM được định nghĩa.
 */

import { GuardResult } from '../authorization/rbacGuard';

export class StateMachineGuard {
  public static verifyTransition(
    currentState: string,
    actionId: string,
    transitionResolver?: () => { nextState: string } | null
  ): GuardResult & { nextState?: string } {
    if (!transitionResolver) {
      return { passed: true };
    }

    try {
      const transition = transitionResolver();
      if (!transition) {
        return {
          passed: false,
          code: 'INVALID_STATE_TRANSITION',
          reason: `Chuyển trạng thái từ '${currentState}' cho hành động '${actionId}' không hợp lệ theo State Machine.`,
        };
      }
      return { passed: true, nextState: transition.nextState };
    } catch (err: any) {
      return {
        passed: false,
        code: 'TRANSITION_EVALUATION_ERROR',
        reason: err?.message || 'Lỗi đánh giá chuyển trạng thái State Machine.',
      };
    }
  }
}
