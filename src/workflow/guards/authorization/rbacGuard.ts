/**
 * RBAC GUARD (CANONICAL AUTHORIZATION)
 *
 * Kiểm tra thẩm quyền vai trò theo chuẩn ADR-001:
 * ADMIN, QA, QC, LAB, PRODUCTION, USER, VIEWER, GUEST.
 */

import { WorkflowActionMetadata, WorkflowActor } from '../../contracts/actions';

export interface GuardResult {
  passed: boolean;
  code?: string;
  reason?: string;
}

export class RbacGuard {
  public static verify(actionMeta: WorkflowActionMetadata, actor: WorkflowActor): GuardResult {
    const rawRole = (actor.role || '').toUpperCase().trim();

    // ADMIN luôn có quyền tổng thể, nhưng vẫn phải tuân thủ điều kiện nghiệp vụ
    if (rawRole === 'ADMIN' || (actor as any).isAdmin === true) {
      return { passed: true };
    }

    const isAllowed = actionMeta.allowedRoles.some((role) => {
      const canonical = role.toUpperCase();
      return (
        canonical === rawRole ||
        (rawRole === 'QA' && canonical.includes('QA')) ||
        (rawRole === 'QC' && canonical.includes('QC')) ||
        (rawRole.includes('LAB') && canonical === 'LAB') ||
        (rawRole.includes('PROD') && canonical === 'PRODUCTION') ||
        (rawRole.includes('QC') && canonical === 'QC') ||
        (rawRole.includes('QA') && canonical === 'QA')
      );
    });

    if (!isAllowed) {
      return {
        passed: false,
        code: 'UNAUTHORIZED_ROLE',
        reason: `Vai trò '${actor.role}' không được phép thực hiện hành động ${actionMeta.actionId}. (Yêu cầu: ${actionMeta.allowedRoles.join(', ')})`,
      };
    }

    return { passed: true };
  }
}
