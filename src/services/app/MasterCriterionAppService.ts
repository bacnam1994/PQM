/**
 * PQM V4 - Master Criterion Application Service
 * Quản lý danh mục Chỉ tiêu Kiểm nghiệm Chuẩn (Master Criteria) và Đổi tên đồng loạt có Audit Trail.
 */

import { MasterCriterion, MasterCriterionCategory } from '../../types';
import { IMasterCriterionRepository } from '../../repositories/MasterCriterionRepository';
import { masterCriterionRepository as defaultRepo } from '../../repositories/firebase/FirebaseMasterCriterionRepository';
import { bulkRenameCriteriaInAllTestResults } from '../testResultService';
import { logAuditAction } from '../auditService';
import { can } from '../permissionService';

export class MasterCriterionAppService {
  constructor(private repo: IMasterCriterionRepository = defaultRepo) {}

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

    await this.repo.save(criterion);

    logAuditAction({
      action: 'CREATE',
      collection: 'SYSTEM',
      documentId: criterion.id,
      details: `Tạo chỉ tiêu mẫu: "${criterion.canonicalName}" (${criterion.category})`,
      performedBy: currentUser?.email || 'unknown',
    });
  }

  async update(criterion: MasterCriterion, currentUser: any): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền sửa Chỉ tiêu chuẩn.');
    }

    await this.repo.update(criterion);

    logAuditAction({
      action: 'UPDATE',
      collection: 'SYSTEM',
      documentId: criterion.id,
      details: `Cập nhật chỉ tiêu mẫu: "${criterion.canonicalName}"`,
      performedBy: currentUser?.email || 'unknown',
    });
  }

  async delete(id: string, currentUser: any, name?: string): Promise<void> {
    if (!can(currentUser, 'tccs:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa Chỉ tiêu chuẩn.');
    }

    await this.repo.delete(id);

    logAuditAction({
      action: 'DELETE',
      collection: 'SYSTEM',
      documentId: id,
      details: `Xóa chỉ tiêu mẫu: "${name || id}"`,
      performedBy: currentUser?.email || 'unknown',
    });
  }

  /**
   * Đổi tên hàng loạt chỉ tiêu trên toàn bộ hệ thống Test Results với Audit Trail
   */
  async bulkRename(
    oldName: string,
    newName: string,
    currentUser: any,
    targetProductId?: string
  ): Promise<{ updatedCount: number; totalScanned: number }> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error(
        'Từ chối quyền: Chỉ Quản lý/Quản trị viên mới có quyền đổi tên chỉ tiêu hàng loạt.'
      );
    }

    const result = await bulkRenameCriteriaInAllTestResults(oldName, newName, targetProductId);

    logAuditAction({
      action: 'UPDATE',
      collection: 'TEST_RESULTS',
      documentId: 'BULK_RENAME',
      details: `Đổi tên chỉ tiêu hàng loạt từ "${oldName}" sang "${newName}" (Đã cập nhật: ${result.updatedCount}/${result.totalScanned} PKN)`,
      performedBy: currentUser?.email || 'unknown',
    });

    return result;
  }
}

export const masterCriterionAppService = new MasterCriterionAppService();
