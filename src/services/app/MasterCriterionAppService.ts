/**
 * PQM V4 - Master Criterion Application Service
 * Quản lý danh mục Chỉ tiêu Kiểm nghiệm Chuẩn (Master Criteria) và Đổi tên đồng loạt qua WorkflowFacade.
 */

import { MasterCriterion, MasterCriterionCategory } from '../../types';
import { IMasterCriterionRepository } from '../../repositories/MasterCriterionRepository';
import { masterCriterionRepository as defaultRepo } from '../../repositories/firebase/FirebaseMasterCriterionRepository';
import { bulkRenameCriteriaInAllTestResults } from '../testResultService';
import { can } from '../permissionService';
import { WorkflowFacade } from '../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../workflow/contracts/actions';

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
    if (!can(currentUser, 'tccs:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền tạo Chỉ tiêu chuẩn.');
    }

    if (!criterion.canonicalName?.trim()) {
      throw new Error('Tên chỉ tiêu không được để trống.');
    }

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
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền sửa Chỉ tiêu chuẩn.');
    }

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
    if (!can(currentUser, 'tccs:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa Chỉ tiêu chuẩn.');
    }

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
    if (!can(currentUser, 'tccs:update')) {
      throw new Error(
        'Từ chối quyền: Chỉ Quản lý/Quản trị viên mới có quyền đổi tên chỉ tiêu hàng loạt.'
      );
    }

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
