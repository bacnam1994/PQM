/**
 * SYSTEM DOMAIN: SYSTEM APPLICATION SERVICE (VS-14)
 * =================================================
 * Application Service phụ trách toàn bộ các tác vụ hệ thống cấp cao (System Destructive & High-Impact Operations).
 *
 * Tuân thủ nghiêm ngặt Canonical Architecture:
 * UI -> Canonical Action -> SystemAppService -> WorkflowFacade -> Confirmation Token -> Repository -> ALCOA+ Audit
 *
 * Cấm mọi thao tác direct DB bypass từ Zustand slice hay UI helpers.
 */

import { ISystemRepository, firebaseSystemRepository } from '../infrastructure/repository';
import { SystemActionContext, SystemActionResult, SystemMaintenanceConfig } from '../domain/types';
import { SystemRules } from '../domain/rules';
import { SYSTEM_WORKFLOW_ACTIONS } from '../workflow/definitions';
import { WorkflowFacade } from '../../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../../workflow/contracts/actions';

export class SystemAppService {
  constructor(private readonly repo: ISystemRepository = firebaseSystemRepository) {}

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
    SystemRules.validateAdminAuthorization(context, 'DATABASE_BACKUP');

    const execution = await WorkflowFacade.dispatch<Record<string, any>>(
      {
        actionId: SYSTEM_WORKFLOW_ACTIONS.BACKUP,
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
    SystemRules.validateAdminAuthorization(context, 'DATABASE_RESTORE');
    SystemRules.validateReason('DATABASE_RESTORE', context.reason);
    SystemRules.validateConfirmationToken('DATABASE_RESTORE', context.confirmationToken);
    SystemRules.validateDataPayload('DATABASE_RESTORE', data);

    const execution = await WorkflowFacade.dispatch<void>(
      {
        actionId: SYSTEM_WORKFLOW_ACTIONS.RESTORE,
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
    SystemRules.validateAdminAuthorization(context, 'DATABASE_WIPE');
    SystemRules.validateReason('DATABASE_WIPE', context.reason);
    SystemRules.validateConfirmationToken('DATABASE_WIPE', context.confirmationToken);

    const execution = await WorkflowFacade.dispatch<void>(
      {
        actionId: SYSTEM_WORKFLOW_ACTIONS.WIPE,
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
    SystemRules.validateAdminAuthorization(context, 'DATABASE_RESET_DEMO');
    SystemRules.validateReason('DATABASE_RESET_DEMO', context.reason);
    SystemRules.validateConfirmationToken('DATABASE_RESET_DEMO', context.confirmationToken);

    const execution = await WorkflowFacade.dispatch<void>(
      {
        actionId: SYSTEM_WORKFLOW_ACTIONS.RESET_DEMO,
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

  /**
   * SYSTEM_CONFIG_UPDATE: Bật / Tắt hoặc cập nhật Chế độ Bảo trì (Maintenance Mode)
   */
  async setMaintenanceMode(
    enabled: boolean,
    options: {
      message?: string;
      scheduledEndTime?: string;
    },
    context: SystemActionContext
  ): Promise<SystemActionResult> {
    SystemRules.validateAdminAuthorization(context, 'SYSTEM_CONFIG_UPDATE');

    const config: SystemMaintenanceConfig = {
      enabled,
      message: options.message?.trim() || undefined,
      scheduledEndTime: options.scheduledEndTime?.trim() || undefined,
      allowedRoles: ['ADMIN'],
      updatedAt: new Date().toISOString(),
      updatedBy: context.actorEmail || context.actorId,
    };

    const execution = await WorkflowFacade.dispatch<SystemMaintenanceConfig>(
      {
        actionId: SYSTEM_WORKFLOW_ACTIONS.CONFIG_UPDATE,
        entityType: 'SYSTEM',
        entityId: 'MAINTENANCE_CONFIG',
        actor: this.toActor(context),
        reason:
          context.reason ||
          (enabled ? 'Bật chế độ bảo trì hệ thống' : 'Tắt chế độ bảo trì hệ thống'),
        payload: config,
      },
      async () => {
        await this.repo.setMaintenanceConfig(config);
        return config;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Cập nhật cấu hình bảo trì thất bại.');
    }

    return {
      executionId: execution.executionId,
      success: true,
      action: 'SYSTEM_CONFIG_UPDATE',
      timestamp: execution.timestamp,
      message: enabled
        ? 'Đã kích hoạt chế độ bảo trì hệ thống (Chỉ đọc cho người dùng thông thường).'
        : 'Đã hủy chế độ bảo trì, hệ thống hoạt động trở lại bình thường.',
      data: execution.data,
    };
  }

  /**
   * Đọc cấu hình bảo trì hiện tại
   */
  async getMaintenanceConfig(): Promise<SystemMaintenanceConfig | null> {
    return await this.repo.getMaintenanceConfig();
  }

  /**
   * Lắng nghe thời gian thực thay đổi cấu hình bảo trì
   */
  listenMaintenanceConfig(callback: (config: SystemMaintenanceConfig | null) => void): () => void {
    return this.repo.listenMaintenanceConfig(callback);
  }
}

export const systemAppService = new SystemAppService();
