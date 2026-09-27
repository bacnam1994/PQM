/**
 * SYSTEM DOMAIN: RULES (VS-14)
 * ============================
 * Rào chắn an ninh & quy tắc nghiệp vụ cho Hệ thống (System Operations):
 * 1. Phân quyền ADMIN nghiêm ngặt cho các tác vụ nhạy cảm / phá hủy (Destructive Actions).
 * 2. Bắt buộc Confirmation Token hai yếu tố (CONFIRM_RESTORE, CONFIRM_WIPE, CONFIRM_RESET_DEMO).
 * 3. Bắt buộc lý do giải trình (ALCOA+ Audit Trail Reason).
 * 4. Kiểm soát phân bổ vai trò (Role Assignment Boundaries).
 */

import { logAuditAction } from '../../../services/auditService';
import { SystemActionContext, ConfirmationToken, UserRole } from './types';

export class SystemRules {
  /**
   * Xác thực thẩm quyền ADMIN tối cao
   */
  static validateAdminAuthorization(context: SystemActionContext, action: string): void {
    const role = (context.actorRole || '').toUpperCase();
    if (role !== 'ADMIN') {
      const err = `Thẩm quyền bị từ chối: Thao tác ${action} bắt buộc quyền Quản trị viên (ADMIN). Vai trò hiện tại: ${context.actorRole || 'NONE'}`;
      logAuditAction({
        action: 'DELETE',
        collection: 'SYSTEM',
        documentId: action,
        details: `[SECURITY REJECTION] Cố gắng thực hiện ${action} trái phép bởi role=${context.actorRole}`,
        performedBy: context.actorEmail || context.actorId || 'unknown',
      });
      throw new Error(err);
    }
  }

  /**
   * Xác thực Confirmation Token cho các tác vụ nhạy cảm
   */
  static validateConfirmationToken(
    action: 'DATABASE_RESTORE' | 'DATABASE_WIPE' | 'DATABASE_RESET_DEMO',
    token?: string
  ): void {
    const tokenMap: Record<typeof action, ConfirmationToken> = {
      DATABASE_RESTORE: 'CONFIRM_RESTORE',
      DATABASE_WIPE: 'CONFIRM_WIPE',
      DATABASE_RESET_DEMO: 'CONFIRM_RESET_DEMO',
    };

    const expectedToken = tokenMap[action];
    if (token !== expectedToken) {
      if (action === 'DATABASE_RESTORE') {
        throw new Error('Mã xác nhận khôi phục không hợp lệ. Yêu cầu nhập đúng CONFIRM_RESTORE.');
      } else if (action === 'DATABASE_WIPE') {
        throw new Error('Mã xác nhận xóa dữ liệu không hợp lệ. Yêu cầu nhập đúng CONFIRM_WIPE.');
      } else if (action === 'DATABASE_RESET_DEMO') {
        throw new Error(
          'Mã xác nhận nạp dữ liệu mẫu không hợp lệ. Yêu cầu nhập đúng CONFIRM_RESET_DEMO.'
        );
      }
      throw new Error(`Mã xác nhận không hợp lệ cho tác vụ ${action}. Yêu cầu: ${expectedToken}`);
    }
  }

  /**
   * Bắt buộc có lý do giải trình khi thực hiện các tác vụ thay đổi hệ thống
   */
  static validateReason(action: string, reason?: string): void {
    if (!reason || reason.trim().length === 0) {
      if (action === 'DATABASE_RESTORE') {
        throw new Error('Khôi phục cơ sở dữ liệu bắt buộc phải có lý do giải trình.');
      }
      if (action === 'DATABASE_WIPE') {
        throw new Error('Xóa sạch cơ sở dữ liệu bắt buộc phải có lý do giải trình.');
      }
      if (action === 'DATABASE_RESET_DEMO') {
        throw new Error('Nạp dữ liệu mẫu bắt buộc phải có lý do giải trình.');
      }
      throw new Error(`Thao tác ${action} bắt buộc phải có lý do giải trình.`);
    }
  }

  /**
   * Kiểm tra tính hợp lệ của dữ liệu khôi phục / nạp mẫu
   */
  static validateDataPayload(action: string, data: any): void {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      if (action === 'DATABASE_RESTORE') {
        throw new Error('Dữ liệu khôi phục không hợp lệ hoặc rỗng.');
      }
      throw new Error(`Dữ liệu cho tác vụ ${action} không hợp lệ hoặc rỗng.`);
    }
  }

  /**
   * Kiểm tra quyền gán hoặc thay đổi vai trò người dùng
   */
  static validateRoleAssignment(targetRole: UserRole, actorRole: string): void {
    const normalizedActorRole = (actorRole || '').toUpperCase();
    if (normalizedActorRole !== 'ADMIN') {
      throw new Error(
        'Chỉ có Quản trị viên (ADMIN) mới có quyền phân bổ hoặc thay đổi vai trò người dùng.'
      );
    }
  }
}
