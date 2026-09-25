/**
 * SIGNATURE GUARD (21 CFR PART 11 INTEGRITY)
 *
 * Ràng buộc chữ ký số điện tử đạt chuẩn FDA 21 CFR Part 11:
 * - Danh tính người ký (signer identity)
 * - Dấu thời gian / checksum bảo đảm toàn vẹn
 */

import { WorkflowActionMetadata } from '../../contracts/actions';
import { GuardResult } from '../authorization/rbacGuard';

export class SignatureGuard {
  public static verify(actionMeta: WorkflowActionMetadata, signature?: any): GuardResult {
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
}
