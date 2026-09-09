/**
 * PQM 3.0 - TCCS Application Service
 * Điều phối các nghiệp vụ quản lý Tiêu chuẩn cơ sở (TCCS): RBAC, Single Active Version, Criteria Alias Sync và Audit Logging
 */

import { ref, set, update, remove } from 'firebase/database';
import { db } from '../../firebase';
import { TCCS, Batch, CriteriaAlias, AILearnedMapping } from '../../types';
import { ITCCSRepository } from '../../repositories/TCCSRepository';
import { tccsRepository as defaultTccsRepo } from '../../repositories/firebase/FirebaseTCCSRepository';
import { can } from '../permissionService';
import { logAuditAction } from '../auditService';
import { detectCriteriaChanges, normalizeName, mergeAliases, createAliasRecord } from '../criteriaAliasService';
import { removeUndefined } from '../../utils';
import { enqueueOfflineMutation } from '../../utils/offlineMutationQueue';

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

    if (Object.keys(aliasUpdates).length > 0) {
      try {
        await update(ref(db), aliasUpdates);
      } catch (e: any) {
        if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
          for (const [path, data] of Object.entries(aliasUpdates)) {
            await enqueueOfflineMutation({ path, operation: 'SET', data });
          }
        } else {
          console.warn('Lỗi cập nhật alias khi cập nhật TCCS:', e);
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

  async deleteTCCS(
    id: string, 
    batches: Batch[] = [], 
    currentUser: any, 
    tccsCode?: string,
    existingAliases: CriteriaAlias[] = []
  ): Promise<void> {
    if (!can(currentUser, 'tccs:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa TCCS này.');
    }

    // Ràng buộc toàn vẹn: Không xóa TCCS đang được lô sản xuất tham chiếu
    const isBoundToBatch = batches.some(b => b.tccsId === id);
    if (isBoundToBatch) {
      throw new Error('TCCS này đang liên kết với ít nhất một lô sản xuất. Không thể xóa.');
    }

    await this.repo.delete(id);

    // Tự động dọn dẹp các Criteria Alias gắn liền với TCCS này để tránh orphan records
    const relatedAliases = existingAliases.filter(a => a.tccsId === id);
    if (relatedAliases.length > 0) {
      const aliasUpdates: Record<string, any> = {};
      relatedAliases.forEach(a => {
        aliasUpdates[`criteria_aliases/${a.id}`] = null;
      });
      try {
        await update(ref(db), aliasUpdates);
      } catch (e: any) {
        if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
          for (const a of relatedAliases) {
            await enqueueOfflineMutation({ path: `criteria_aliases/${a.id}`, operation: 'REMOVE' });
          }
        } else {
          console.warn('Lỗi dọn dẹp alias khi xóa TCCS:', e);
        }
      }
    }

    logAuditAction({
      action: 'DELETE',
      collection: 'TCCS',
      documentId: id,
      details: `Xóa TCCS: ${tccsCode || id}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  // --- AI LEARNED MAPPING OPERATIONS ---
  async addAiLearnedMapping(
    originalName: string, 
    systemName: string, 
    existingMappings: AILearnedMapping[] = [],
    currentUser?: any
  ): Promise<void> {
    const existing = existingMappings.find(
      m => m.originalName === originalName && m.systemName === systemName
    );
    const now = new Date().toISOString();

    if (existing) {
      const targetPath = `ai_learned_mappings/${existing.id}`;
      const updates = {
        frequency: existing.frequency + 1,
        updatedAt: now
      };
      try {
        await update(ref(db, targetPath), updates);
      } catch (e: any) {
        if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
          await enqueueOfflineMutation({ path: targetPath, operation: 'UPDATE', data: updates });
        } else {
          throw e;
        }
      }
    } else {
      const newId = `aim_${Date.now()}`;
      const newMapping: AILearnedMapping = {
        id: newId,
        originalName,
        systemName,
        frequency: 1,
        createdAt: now,
        updatedAt: now
      };
      const targetPath = `ai_learned_mappings/${newId}`;
      try {
        await set(ref(db, targetPath), newMapping);
      } catch (e: any) {
        if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
          await enqueueOfflineMutation({ path: targetPath, operation: 'SET', data: newMapping });
        } else {
          throw e;
        }
      }
    }

    logAuditAction({
      action: existing ? 'UPDATE' : 'CREATE',
      collection: 'SYSTEM',
      documentId: existing ? existing.id : originalName,
      details: `Học ánh xạ chỉ tiêu: "${originalName}" → "${systemName}"`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  // --- CRITERIA ALIAS OPERATIONS ---
  async addCriteriaAlias(alias: CriteriaAlias, currentUser: any): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền tạo Criteria Alias.');
    }

    const cleanAlias = removeUndefined(alias);
    const targetPath = `criteria_aliases/${alias.id}`;
    try {
      await set(ref(db, targetPath), cleanAlias);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'SET', data: cleanAlias });
      } else {
        throw e;
      }
    }

    logAuditAction({
      action: 'CREATE',
      collection: 'CRITERIA_ALIASES',
      documentId: alias.id,
      details: `Tạo alias: "${alias.aliases.join(', ')}" → "${alias.canonicalName}" (TCCS: ${alias.tccsId})`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async updateCriteriaAlias(alias: CriteriaAlias, currentUser: any): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật Criteria Alias.');
    }

    const updated = removeUndefined({ ...alias, updatedAt: new Date().toISOString() });
    const targetPath = `criteria_aliases/${alias.id}`;
    try {
      await update(ref(db, targetPath), updated);
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'UPDATE', data: updated });
      } else {
        throw e;
      }
    }

    logAuditAction({
      action: 'UPDATE',
      collection: 'CRITERIA_ALIASES',
      documentId: alias.id,
      details: `Cập nhật alias cho "${alias.canonicalName}"`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async deleteCriteriaAlias(id: string, currentUser: any, canonicalName?: string): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa Criteria Alias.');
    }

    const targetPath = `criteria_aliases/${id}`;
    try {
      await remove(ref(db, targetPath));
    } catch (e: any) {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || e?.code === 'unavailable')) {
        await enqueueOfflineMutation({ path: targetPath, operation: 'REMOVE' });
      } else {
        throw e;
      }
    }

    logAuditAction({
      action: 'DELETE',
      collection: 'CRITERIA_ALIASES',
      documentId: id,
      details: `Xóa alias cho "${canonicalName || id}"`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async confirmCriteriaAlias(alias: CriteriaAlias, currentUser: any): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xác nhận Criteria Alias.');
    }

    const updated = {
      ...alias,
      confirmedByAdmin: true,
      updatedAt: new Date().toISOString()
    };
    await this.updateCriteriaAlias(updated, currentUser);
  }

  async addAliasToExisting(alias: CriteriaAlias, newAlias: string, currentUser: any): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền thêm alias mới.');
    }

    const merged = mergeAliases(alias, [newAlias]);
    merged.confirmedByAdmin = true;
    await this.updateCriteriaAlias(merged, currentUser);
  }
}

export const tccsAppService = new TCCSAppService();
