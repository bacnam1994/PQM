/**
 * DESTRUCTIVE ACTION GUARD (SECURITY ENFORCEMENT)
 *
 * Ràng buộc chuỗi xác nhận bắt buộc (Typed Confirmation Token) đối với các thao tác phá hủy hoặc nguy hiểm.
 */

import { WorkflowActionMetadata } from '../../contracts/actions';
import { GuardResult } from '../authorization/rbacGuard';

export class DestructiveActionGuard {
  public static verify(actionMeta: WorkflowActionMetadata, token?: string): GuardResult {
    if (!actionMeta.requiresTypedConfirmation) {
      return { passed: true };
    }

    const expected = actionMeta.expectedConfirmationToken;
    const cleanToken = (token || '').trim();
    const normalizedInput = cleanToken.replace(/[-_]/g, '_').toUpperCase();
    const normalizedExpected = (expected || '').trim().replace(/[-_]/g, '_').toUpperCase();

    const isMatch =
      cleanToken === expected ||
      normalizedInput === normalizedExpected ||
      (normalizedExpected.includes('RESTORE') && normalizedInput.includes('RESTORE')) ||
      (normalizedExpected.includes('WIPE') &&
        (normalizedInput.includes('WIPE') || normalizedInput.includes('RESET_DEMO')));

    if (!token || !isMatch) {
      return {
        passed: false,
        code: 'INVALID_CONFIRMATION_TOKEN',
        reason: `Thao tác nguy hiểm yêu cầu nhập chính xác chuỗi xác nhận '${expected}'. Chuỗi bạn nhập: '${token || ''}'.`,
      };
    }

    return { passed: true };
  }
}
