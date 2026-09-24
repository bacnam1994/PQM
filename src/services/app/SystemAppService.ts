/**
 * SystemAppService.ts
 * ===================
 * Application Service phụ trách toàn bộ các tác vụ hệ thống cấp cao (System Destructive & High-Impact Operations).
 *
 * Tuân thủ nghiêm ngặt Canonical Architecture:
 * UI -> Canonical Action -> SystemAppService -> Authorization -> Confirmation Token -> Repository -> Audit
 *
 * Cấm mọi thao tác direct DB bypass từ Zustand slice hay UI helpers.
 */

import { ISystemRepository } from '../../repositories/ISystemRepository';
import { firebaseSystemRepository } from '../../repositories/firebase/FirebaseSystemRepository';
import { logAuditAction } from '../auditService';

export interface SystemActionContext {
  actorId: string;
  actorRole: string;
  actorEmail?: string;
  reason?: string;
  confirmationToken?: string;
}

export interface SystemActionResult {
  executionId: string;
  success: boolean;
  action: 'DATABASE_BACKUP' | 'DATABASE_RESTORE' | 'DATABASE_WIPE' | 'DATABASE_RESET_DEMO';
  timestamp: string;
  message?: string;
  data?: Record<string, any>;
}

export class SystemAppService {
  constructor(private readonly repo: ISystemRepository = firebaseSystemRepository) {}

  private validateAdminAuthorization(context: SystemActionContext, action: string): void {
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

  private generateExecutionId(action: string): string {
    return `sys-exec-${action.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * DATABASE_BACKUP: Sao lưu toàn bộ cơ sở dữ liệu hệ thống
   */
  async backupDatabase(context: SystemActionContext): Promise<SystemActionResult> {
    this.validateAdminAuthorization(context, 'DATABASE_BACKUP');
    const executionId = this.generateExecutionId('BACKUP');

    try {
      const data = await this.repo.backupDatabase();
      await logAuditAction({
        action: 'RESTORE',
        collection: 'SYSTEM',
        documentId: executionId,
        details: `Sao lưu cơ sở dữ liệu thành công (ExecutionId: ${executionId})`,
        performedBy: context.actorEmail || context.actorId,
      });

      return {
        executionId,
        success: true,
        action: 'DATABASE_BACKUP',
        timestamp: new Date().toISOString(),
        data,
      };
    } catch (error: any) {
      await logAuditAction({
        action: 'RESTORE',
        collection: 'SYSTEM',
        documentId: executionId,
        details: `Sao lưu cơ sở dữ liệu thất bại: ${error?.message || error}`,
        performedBy: context.actorEmail || context.actorId,
      });
      throw error;
    }
  }

  /**
   * DATABASE_RESTORE: Khôi phục cơ sở dữ liệu từ bản sao lưu
   */
  async restoreDatabase(
    data: Record<string, any>,
    context: SystemActionContext
  ): Promise<SystemActionResult> {
    this.validateAdminAuthorization(context, 'DATABASE_RESTORE');

    if (!context.reason || context.reason.trim().length === 0) {
      throw new Error('Khôi phục cơ sở dữ liệu bắt buộc phải có lý do giải trình.');
    }

    if (context.confirmationToken !== 'CONFIRM_RESTORE') {
      throw new Error('Mã xác nhận khôi phục không hợp lệ. Yêu cầu nhập đúng CONFIRM_RESTORE.');
    }

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new Error('Dữ liệu khôi phục không hợp lệ hoặc rỗng.');
    }

    const executionId = this.generateExecutionId('RESTORE');

    try {
      await this.repo.restoreDatabase(data);
      await logAuditAction({
        action: 'RESTORE',
        collection: 'SYSTEM',
        documentId: executionId,
        details: `Khôi phục cơ sở dữ liệu thành công (ExecutionId: ${executionId}). Lý do: ${context.reason}`,
        performedBy: context.actorEmail || context.actorId,
      });

      return {
        executionId,
        success: true,
        action: 'DATABASE_RESTORE',
        timestamp: new Date().toISOString(),
        message: 'Khôi phục cơ sở dữ liệu hoàn tất.',
      };
    } catch (error: any) {
      await logAuditAction({
        action: 'RESTORE',
        collection: 'SYSTEM',
        documentId: executionId,
        details: `Khôi phục cơ sở dữ liệu thất bại: ${error?.message || error}`,
        performedBy: context.actorEmail || context.actorId,
      });
      throw error;
    }
  }

  /**
   * DATABASE_WIPE: Xóa sạch toàn bộ dữ liệu cơ sở dữ liệu
   */
  async wipeDatabase(context: SystemActionContext): Promise<SystemActionResult> {
    this.validateAdminAuthorization(context, 'DATABASE_WIPE');

    if (!context.reason || context.reason.trim().length === 0) {
      throw new Error('Xóa sạch cơ sở dữ liệu bắt buộc phải có lý do giải trình.');
    }

    if (context.confirmationToken !== 'CONFIRM_WIPE') {
      throw new Error('Mã xác nhận xóa dữ liệu không hợp lệ. Yêu cầu nhập đúng CONFIRM_WIPE.');
    }

    const executionId = this.generateExecutionId('WIPE');

    try {
      await this.repo.wipeDatabase();
      await logAuditAction({
        action: 'DELETE',
        collection: 'SYSTEM',
        documentId: executionId,
        details: `XÓA SẠCH DỮ LIỆU HỆ THỐNG (ExecutionId: ${executionId}). Lý do: ${context.reason}`,
        performedBy: context.actorEmail || context.actorId,
      });

      return {
        executionId,
        success: true,
        action: 'DATABASE_WIPE',
        timestamp: new Date().toISOString(),
        message: 'Đã xóa sạch toàn bộ cơ sở dữ liệu.',
      };
    } catch (error: any) {
      await logAuditAction({
        action: 'DELETE',
        collection: 'SYSTEM',
        documentId: executionId,
        details: `Xóa dữ liệu thất bại: ${error?.message || error}`,
        performedBy: context.actorEmail || context.actorId,
      });
      throw error;
    }
  }

  /**
   * DATABASE_RESET_DEMO: Khởi tạo lại dữ liệu mẫu cho hệ thống
   */
  async resetDemoData(
    demoData: Record<string, any>,
    context: SystemActionContext
  ): Promise<SystemActionResult> {
    this.validateAdminAuthorization(context, 'DATABASE_RESET_DEMO');

    if (!context.reason || context.reason.trim().length === 0) {
      throw new Error('Nạp dữ liệu mẫu bắt buộc phải có lý do giải trình.');
    }

    if (context.confirmationToken !== 'CONFIRM_RESET_DEMO') {
      throw new Error(
        'Mã xác nhận nạp dữ liệu mẫu không hợp lệ. Yêu cầu nhập đúng CONFIRM_RESET_DEMO.'
      );
    }

    const executionId = this.generateExecutionId('RESET_DEMO');

    try {
      await this.repo.resetDemoData(demoData);
      await logAuditAction({
        action: 'UPDATE',
        collection: 'SYSTEM',
        documentId: executionId,
        details: `Khởi tạo dữ liệu mẫu thành công (ExecutionId: ${executionId}). Lý do: ${context.reason}`,
        performedBy: context.actorEmail || context.actorId,
      });

      return {
        executionId,
        success: true,
        action: 'DATABASE_RESET_DEMO',
        timestamp: new Date().toISOString(),
        message: 'Khởi tạo dữ liệu mẫu hoàn tất.',
      };
    } catch (error: any) {
      await logAuditAction({
        action: 'UPDATE',
        collection: 'SYSTEM',
        documentId: executionId,
        details: `Khởi tạo dữ liệu mẫu thất bại: ${error?.message || error}`,
        performedBy: context.actorEmail || context.actorId,
      });
      throw error;
    }
  }
}

export const systemAppService = new SystemAppService();
