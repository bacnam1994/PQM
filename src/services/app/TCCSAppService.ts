/**
 * PQM 3.0 - TCCS Application Service
 * Điều phối các nghiệp vụ quản lý Tiêu chuẩn cơ sở (TCCS): RBAC, Single Active Version, Criteria Alias Sync và Audit Logging
 */

import { TCCS, Batch, CriteriaAlias } from '../../types';
import { ITCCSRepository } from '../../repositories/TCCSRepository';
import { tccsRepository as defaultTccsRepo } from '../../repositories/firebase/FirebaseTCCSRepository';
import { can } from '../permissionService';
import { logAuditAction } from '../auditService';
import { detectCriteriaChanges, normalizeName, mergeAliases, createAliasRecord } from '../criteriaAliasService';
import { removeUndefined } from '../../utils';

export class TCCSAppService {
  constructor(private repo: ITCCSRepository = defaultTccsRepo) {}

  async createTCCS(tccs: TCCS, existingTCCSList: TCCS[] = [], currentUser: any): Promise<void> {
    if (!can(currentUser, 'tccs:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền tạo mới Tiêu chuẩn cơ sở (TCCS).');
    }

    if (!tccs.code?.trim()) {
      throw new Error('Mã TCCS không được để trống.');
    }
    if (!tccs.productId) {
      throw new Error('TCCS phải liên kết với một sản phẩm cụ thể.');
    }

    const otherTCCS = existingTCCSList.filter(item => item.productId === tccs.productId && item.id !== tccs.id);
    const allTCCS = [...otherTCCS, tccs].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));

    if (allTCCS.length <= 1) {
      await this.repo.save({ ...tccs, isActive: true });
    } else {
      const latestId = allTCCS[0].id;
      const updates: Record<string, any> = {};

      allTCCS.forEach(item => {
        const shouldBeActive = item.id === latestId;
        if (item.id === tccs.id) {
          updates[`tccs/${item.id}`] = removeUndefined({ ...tccs, isActive: shouldBeActive });
        } else if (item.isActive !== shouldBeActive) {
          updates[`tccs/${item.id}/isActive`] = shouldBeActive;
        }
      });

      if ('batchUpdate' in this.repo) {
        await (this.repo as any).batchUpdate(updates);
      } else {
        await this.repo.save({ ...tccs, isActive: tccs.id === latestId });
      }
    }

    logAuditAction({
      action: 'CREATE',
      collection: 'TCCS',
      documentId: tccs.id,
      details: `Tạo TCCS: ${tccs.code} (Sản phẩm: ${tccs.productId})`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async updateTCCS(
    tccs: TCCS, 
    oldTCCS?: TCCS, 
    existingAliases: CriteriaAlias[] = [],
    currentUser?: any
  ): Promise<{ aliasUpdates: Record<string, any> }> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật TCCS.');
    }

    if (!tccs.code?.trim()) {
      throw new Error('Mã TCCS không được để trống.');
    }

    const aliasUpdates: Record<string, any> = {};

    // Tự động phát hiện thay đổi tên chỉ tiêu để cập nhật bảng Alias
    if (oldTCCS) {
      const oldNames = [
        ...(oldTCCS.mainQualityCriteria || []),
        ...(oldTCCS.safetyCriteria || []),
      ].filter(c => c?.name).map(c => c.name);

      const newNames = [
        ...(tccs.mainQualityCriteria || []),
        ...(tccs.safetyCriteria || []),
      ].filter(c => c?.name).map(c => c.name);

      const changes = detectCriteriaChanges(oldNames, newNames);

      for (const change of changes) {
        const existing = existingAliases.find(
          a => a.tccsId === tccs.id && normalizeName(a.canonicalName) === normalizeName(change.newName)
        );

        if (existing) {
          const merged = mergeAliases(existing, [change.oldName]);
          if (change.autoConfirm) merged.confirmedByAdmin = true;
          aliasUpdates[`criteria_aliases/${existing.id}`] = removeUndefined(merged);
        } else {
          const newId = `ca_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const newAlias: CriteriaAlias = {
            id: newId,
            ...createAliasRecord(tccs.id, change.newName, [change.oldName], true, change.autoConfirm),
          };
          aliasUpdates[`criteria_aliases/${newId}`] = removeUndefined(newAlias);
        }
      }
    }

    await this.repo.update(tccs);

    logAuditAction({
      action: 'UPDATE',
      collection: 'TCCS',
      documentId: tccs.id,
      details: `Cập nhật TCCS: ${tccs.code}`,
      performedBy: currentUser?.email || 'unknown'
    });

    return { aliasUpdates };
  }

  async deleteTCCS(id: string, batches: Batch[] = [], currentUser: any, tccsCode?: string): Promise<void> {
    if (!can(currentUser, 'tccs:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa TCCS này.');
    }

    // Ràng buộc toàn vẹn: Không xóa TCCS đang được lô sản xuất tham chiếu
    const isBoundToBatch = batches.some(b => b.tccsId === id);
    if (isBoundToBatch) {
      throw new Error('TCCS này đang liên kết với ít nhất một lô sản xuất. Không thể xóa.');
    }

    await this.repo.delete(id);

    logAuditAction({
      action: 'DELETE',
      collection: 'TCCS',
      documentId: id,
      details: `Xóa TCCS: ${tccsCode || id}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }
}

export const tccsAppService = new TCCSAppService();
