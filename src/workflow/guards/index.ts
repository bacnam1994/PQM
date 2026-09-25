/**
 * WORKFLOW GUARDS (CANONICAL ENFORCEMENT)
 *
 * Bộ rào chắn an ninh độc lập kiểm soát:
 * 1. RBAC Guard (Canonical Roles)
 * 2. OCC Guard (Optimistic Concurrency Control)
 * 3. Reason Guard (Giải trình hành động nhạy cảm)
 * 4. Signature Guard (21 CFR Part 11 e-Signature)
 * 5. Confirmation Token Guard (Thao tác phá hủy dữ liệu)
 */

import { WorkflowActionMetadata, WorkflowActor } from '../contracts/actions';

export interface GuardResult {
  passed: boolean;
  code?: string;
  reason?: string;
}

export class WorkflowGuards {
  /**
   * 1. RBAC Guard: Kiểm tra thẩm quyền vai trò theo chuẩn ADR-001
   */
  public static verifyRBAC(actionMeta: WorkflowActionMetadata, actor: WorkflowActor): GuardResult {
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

  /**
   * 2. OCC Guard: Kiểm soát phiên bản đồng thời tránh ghi đè mất dữ liệu
   */
  public static verifyOCC(expectedVersion?: number, currentVersion?: number): GuardResult {
    if (expectedVersion == null || currentVersion == null) {
      return { passed: true };
    }

    if (expectedVersion !== currentVersion) {
      return {
        passed: false,
        code: 'CONCURRENCY_CONFLICT',
        reason: `Xung đột phiên bản (OCC): Dữ liệu trên máy chủ đã thay đổi (Phiên bản máy chủ: v${currentVersion}, phiên bản của bạn: v${expectedVersion}). Vui lòng tải lại dữ liệu.`,
      };
    }

    return { passed: true };
  }

  /**
   * 3. Reason Guard: Ràng buộc lý do giải trình cho các hành vi rủi ro
   */
  public static verifyReason(actionMeta: WorkflowActionMetadata, reason?: string): GuardResult {
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

  /**
   * 4. Signature Guard: Ràng buộc chữ ký số điện tử (21 CFR Part 11)
   */
  public static verifySignature(actionMeta: WorkflowActionMetadata, signature?: any): GuardResult {
    if (!actionMeta.requiresSignature && !signature) {
      return { passed: true };
    }

    if (actionMeta.requiresSignature && !signature) {
      return {
        passed: false,
        code: 'SIGNATURE_REQUIRED',
        reason: `Hành động '${actionMeta.actionId}' bắt buộc phải có Chữ ký điện tử 21 CFR Part 11 hợp lệ.`,
      };
    }

    if (signature) {
      const hasSigner = signature.signerName || signature.signerEmail || signature.signerUid;
      const hasIntegrity = signature.signedAt || signature.timestamp || signature.checksum;
      if (!hasSigner || !hasIntegrity) {
        return {
          passed: false,
          code: 'INVALID_SIGNATURE',
          reason: `Chữ ký điện tử không hợp lệ: thiếu thông tin người ký hoặc dấu thời gian/checksum.`,
        };
      }
    }

    return { passed: true };
  }

  /**
   * 5. Confirmation Token Guard: Ràng buộc chuỗi xác nhận đối với thao tác phá hủy
   */
  public static verifyConfirmationToken(
    actionMeta: WorkflowActionMetadata,
    token?: string
  ): GuardResult {
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
        reason: `Thao tác phá hủy '${actionMeta.actionId}' bị chặn: Chuỗi xác nhận không chính xác. Yêu cầu nhập đúng chuỗi: "${expected}".`,
      };
    }

    return { passed: true };
  }
}
