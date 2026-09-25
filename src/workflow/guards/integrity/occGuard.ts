/**
 * OCC GUARD (CONCURRENCY INTEGRITY)
 *
 * Kiểm soát phiên bản đồng thời (Optimistic Concurrency Control) tránh ghi đè mất mát dữ liệu.
 */

import { GuardResult } from '../authorization/rbacGuard';

export class OccGuard {
  public static verify(expectedVersion?: number, currentVersion?: number): GuardResult {
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
}
