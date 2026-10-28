/**
 * REASON GUARD (REGULATED VALIDATION)
 *
 * Ràng buộc lý do giải trình bắt buộc cho các hành vi rủi ro hoặc thay đổi nhạy cảm.
 */

import { WorkflowActionMetadata } from '../../contracts/actions';
import { GuardResult } from '../authorization/rbacGuard';

export class ReasonGuard {
  public static verify(actionMeta: WorkflowActionMetadata, reason?: string): GuardResult {
    if (!actionMeta.requiresReason) {
      return { passed: true };
    }

    if (!reason || reason.trim().length === 0) {
      return {
        passed: false,
        code: 'REASON_REQUIRED',
        reason: `Hành động ${actionMeta.actionId} bắt buộc phải có lý do giải trình.`,
      };
    }

    return { passed: true };
  }
}
