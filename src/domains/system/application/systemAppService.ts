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
import { SystemActionContext, SystemActionResult } from '../domain/types';
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
}

export const systemAppService = new SystemAppService();
