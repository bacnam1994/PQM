/**
 * SystemAppService.ts
 * ===================
 * Application Service phụ trách toàn bộ các tác vụ hệ thống cấp cao (System Destructive & High-Impact Operations).
 *
 * Tuân thủ nghiêm ngặt Canonical Architecture:
 * UI -> Canonical Action -> SystemAppService -> WorkflowFacade -> Confirmation Token -> Repository -> ALCOA+ Audit
 *
 * Cấm mọi thao tác direct DB bypass từ Zustand slice hay UI helpers.
 */

import { ISystemRepository } from '../../repositories/ISystemRepository';
import { firebaseSystemRepository } from '../../repositories/firebase/FirebaseSystemRepository';
import { logAuditAction } from '../auditService';
import { WorkflowFacade } from '../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../workflow/contracts/actions';

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

  private toActor(context: SystemActionContext): WorkflowActor {
    return {
      id: context.actorId,
      name: context.actorEmail || context.actorId,
      role: context.actorRole.toUpperCase(),
      email: context.actorEmail,
    };
  }

  /**
   * DATABASE_BACKUP: Sao lưu toàn bộ cơ sở dữ liệu hệ thống
   */
  async backupDatabase(context: SystemActionContext): Promise<SystemActionResult> {
    this.validateAdminAuthorization(context, 'DATABASE_BACKUP');

    const execution = await WorkflowFacade.dispatch<Record<string, any>>(
      {
        actionId: 'SYSTEM_BACKUP_EXECUTE',
        entityType: 'SYSTEM',
        entityId: 'DATABASE',
        actor: this.toActor(context),
      },
      async () => {
        return await this.repo.backupDatabase();
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Sao lưu cơ sở dữ liệu thất bại.');
    }

    return {
      executionId: execution.executionId,
      success: true,
      action: 'DATABASE_BACKUP',
      timestamp: execution.timestamp,
      data: execution.data,
    };
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

    const execution = await WorkflowFacade.dispatch<void>(
      {
        actionId: 'SYSTEM_RESTORE_EXECUTE',
        entityType: 'SYSTEM',
        entityId: 'DATABASE',
        actor: this.toActor(context),
        reason: context.reason,
        confirmationToken: context.confirmationToken,
      },
      async () => {
        await this.repo.restoreDatabase(data);
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Khôi phục cơ sở dữ liệu thất bại.');
    }

    return {
      executionId: execution.executionId,
      success: true,
      action: 'DATABASE_RESTORE',
      timestamp: execution.timestamp,
      message: 'Khôi phục cơ sở dữ liệu hoàn tất.',
    };
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

    const execution = await WorkflowFacade.dispatch<void>(
      {
        actionId: 'SYSTEM_WIPE_DEMO_EXECUTE',
        entityType: 'SYSTEM',
        entityId: 'DATABASE',
        actor: this.toActor(context),
        reason: context.reason,
        confirmationToken: context.confirmationToken,
      },
      async () => {
        await this.repo.wipeDatabase();
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Xóa dữ liệu thất bại.');
    }

    return {
      executionId: execution.executionId,
      success: true,
      action: 'DATABASE_WIPE',
      timestamp: execution.timestamp,
      message: 'Đã xóa sạch toàn bộ cơ sở dữ liệu.',
    };
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

    const execution = await WorkflowFacade.dispatch<void>(
      {
        actionId: 'SYSTEM_WIPE_DEMO_EXECUTE',
        entityType: 'SYSTEM',
        entityId: 'DATABASE',
        actor: this.toActor(context),
        reason: context.reason,
        confirmationToken: context.confirmationToken,
      },
      async () => {
        await this.repo.resetDemoData(demoData);
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Khởi tạo dữ liệu mẫu thất bại.');
    }

    return {
      executionId: execution.executionId,
      success: true,
      action: 'DATABASE_RESET_DEMO',
      timestamp: execution.timestamp,
      message: 'Khởi tạo dữ liệu mẫu hoàn tất.',
    };
  }
}

export const systemAppService = new SystemAppService();
