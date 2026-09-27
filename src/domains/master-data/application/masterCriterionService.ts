/**
 * MASTER DATA DOMAIN: MASTER CRITERION APPLICATION SERVICE
 * Quản lý danh mục Chỉ tiêu Kiểm nghiệm Chuẩn (Master Criteria) và Đổi tên đồng loạt qua WorkflowFacade.
 */

import { MasterCriterion } from '../domain/types';
import {
  IMasterCriterionRepository,
  masterCriterionRepository as defaultRepo,
} from '../infrastructure/repository';
import { MasterCriterionRules } from '../domain/rules';
import { bulkRenameCriteriaInAllTestResults } from '../../../services/testResultService';
import { WorkflowFacade } from '../../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../../workflow/contracts/actions';

export class MasterCriterionAppService {
  constructor(private repo: IMasterCriterionRepository = defaultRepo) {}

  private toActor(currentUser: any): WorkflowActor {
    const rawRole = (currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'USER')).toUpperCase();
    return {
      id: currentUser?.id || currentUser?.uid || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || 'Unknown User',
      role: rawRole,
      email: currentUser?.email,
    };
  }

  async getAll(): Promise<MasterCriterion[]> {
    return this.repo.findAll();
  }

  async getActive(): Promise<MasterCriterion[]> {
    return this.repo.findActive();
  }

  async create(criterion: MasterCriterion, currentUser: any): Promise<void> {
    MasterCriterionRules.validatePermission(currentUser, 'tccs:create');
    MasterCriterionRules.validate(criterion);

    const execution = await WorkflowFacade.dispatch<MasterCriterion>(
      {
        actionId: 'CRITERIA_MASTER_CREATE',
        entityType: 'MASTER_DATA',
        entityId: criterion.id,
        actor: this.toActor(currentUser),
        payload: criterion,
      },
      async () => {
        await this.repo.save(criterion);
        return criterion;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi tạo chỉ tiêu chuẩn qua Workflow.');
    }
  }

  async update(criterion: MasterCriterion, currentUser: any, reason?: string): Promise<void> {
    MasterCriterionRules.validatePermission(currentUser, 'tccs:update');
    MasterCriterionRules.validate(criterion);

    const execution = await WorkflowFacade.dispatch<MasterCriterion>(
      {
        actionId: 'CRITERIA_MASTER_UPDATE',
        entityType: 'MASTER_DATA',
        entityId: criterion.id,
        actor: this.toActor(currentUser),
        payload: criterion,
        reason: reason || `Cập nhật chỉ tiêu mẫu: "${criterion.canonicalName}"`,
      },
      async () => {
        await this.repo.update(criterion);
        return criterion;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi cập nhật chỉ tiêu chuẩn qua Workflow.');
    }
  }

  async delete(id: string, currentUser: any, name?: string, reason?: string): Promise<void> {
    MasterCriterionRules.validatePermission(currentUser, 'tccs:delete');

    const execution = await WorkflowFacade.dispatch<string>(
      {
        actionId: 'CRITERIA_MASTER_UPDATE',
        entityType: 'MASTER_DATA',
        entityId: id,
        actor: this.toActor(currentUser),
        reason: reason || `Xóa chỉ tiêu mẫu: "${name || id}"`,
      },
      async () => {
        await this.repo.delete(id);
        return id;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi xóa chỉ tiêu mẫu qua Workflow.');
    }
  }

  /**
   * Đổi tên hàng loạt chỉ tiêu trên toàn bộ hệ thống Test Results với Audit Trail
   */
  async bulkRename(
    oldName: string,
    newName: string,
    currentUser: any,
    targetProductId?: string,
    reason?: string
  ): Promise<{ updatedCount: number; totalScanned: number }> {
    MasterCriterionRules.validateBulkRenamePermission(currentUser);

    const execution = await WorkflowFacade.dispatch<{ updatedCount: number; totalScanned: number }>(
      {
        actionId: 'CRITERIA_MASTER_UPDATE',
        entityType: 'MASTER_DATA',
        entityId: 'BULK_RENAME',
        actor: this.toActor(currentUser),
        reason: reason || `Đổi tên chỉ tiêu hàng loạt từ "${oldName}" sang "${newName}"`,
      },
      async () => {
        return await bulkRenameCriteriaInAllTestResults(oldName, newName, targetProductId);
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi đổi tên chỉ tiêu hàng loạt qua Workflow.');
    }

    return execution.data!;
  }
}

export const masterCriterionAppService = new MasterCriterionAppService();
