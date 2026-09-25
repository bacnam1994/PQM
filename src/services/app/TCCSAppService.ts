/**
 * PQM 3.0 & V4 - TCCS Application Service
 * Điều phối các nghiệp vụ quản lý Tiêu chuẩn cơ sở (TCCS) qua WorkflowFacade:
 * RBAC, Single Active Version, Criteria Alias Sync và ALCOA+ Audit Logging.
 * Tuân thủ nghiêm ngặt Repository Pattern, không truy cập trực tiếp Firebase Database.
 */

import { TCCS, Batch, CriteriaAlias, AILearnedMapping } from '../../types';
import { ITCCSRepository } from '../../repositories/TCCSRepository';
import { tccsRepository as defaultTccsRepo } from '../../repositories/firebase/FirebaseTCCSRepository';
import { ICriteriaAliasRepository } from '../../repositories/CriteriaAliasRepository';
import { criteriaAliasRepository as defaultCriteriaAliasRepo } from '../../repositories/firebase/FirebaseCriteriaAliasRepository';
import { IAILearnedMappingRepository } from '../../repositories/AILearnedMappingRepository';
import { aiLearnedMappingRepository as defaultAiLearnedMappingRepo } from '../../repositories/firebase/FirebaseAILearnedMappingRepository';
import { can } from '../permissionService';
import {
  detectCriteriaChanges,
  normalizeName,
  mergeAliases,
  createAliasRecord,
} from '../criteriaAliasService';
import { removeUndefined } from '../../utils';
import { WorkflowFacade } from '../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../workflow/contracts/actions';

export class TCCSAppService {
  constructor(
    private repo: ITCCSRepository = defaultTccsRepo,
    private aliasRepo: ICriteriaAliasRepository = defaultCriteriaAliasRepo,
    private aiRepo: IAILearnedMappingRepository = defaultAiLearnedMappingRepo
  ) {}

  private toActor(currentUser: any): WorkflowActor {
    const rawRole = (currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'USER')).toUpperCase();
    return {
      id: currentUser?.id || currentUser?.uid || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || 'Unknown User',
      role: rawRole,
      email: currentUser?.email,
    };
  }

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

    const execution = await WorkflowFacade.dispatch<TCCS>(
      {
        actionId: 'TCCS_CREATE',
        entityType: 'TCCS',
        entityId: tccs.id,
        actor: this.toActor(currentUser),
        payload: tccs,
      },
      async () => {
        const otherTCCS = existingTCCSList.filter(
          (item) => item.productId === tccs.productId && item.id !== tccs.id
        );
        const allTCCS = [...otherTCCS, tccs].sort((a, b) =>
          (b.issueDate || '').localeCompare(a.issueDate || '')
        );

        if (allTCCS.length <= 1) {
          await this.repo.save({ ...tccs, isActive: true });
        } else {
          const latestId = allTCCS[0].id;
          const updates: Record<string, any> = {};

          allTCCS.forEach((item) => {
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
        return tccs;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi tạo mới TCCS qua Workflow.');
    }
  }

  async updateTCCS(
    tccs: TCCS,
    oldTCCS?: TCCS,
    existingAliases: CriteriaAlias[] = [],
    currentUser?: any,
    reason?: string
  ): Promise<{ aliasUpdates: Record<string, any> }> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật TCCS.');
    }

    if (!tccs.code?.trim()) {
      throw new Error('Mã TCCS không được để trống.');
    }

    const execution = await WorkflowFacade.dispatch<TCCS, { aliasUpdates: Record<string, any> }>(
      {
        actionId: 'TCCS_UPDATE_DRAFT',
        entityType: 'TCCS',
        entityId: tccs.id,
        actor: this.toActor(currentUser),
        payload: tccs,
        reason: reason || `Cập nhật TCCS: ${tccs.code}`,
      },
      async () => {
        const aliasUpdates: Record<string, any> = {};

        // Tự động phát hiện thay đổi tên chỉ tiêu để cập nhật bảng Alias
        if (oldTCCS) {
          const oldNames = [
            ...(oldTCCS.mainQualityCriteria || []),
            ...(oldTCCS.safetyCriteria || []),
          ]
            .filter((c) => c?.name)
            .map((c) => c.name);

          const newNames = [...(tccs.mainQualityCriteria || []), ...(tccs.safetyCriteria || [])]
            .filter((c) => c?.name)
            .map((c) => c.name);

          const changes = detectCriteriaChanges(oldNames, newNames);

          for (const change of changes) {
            const existing = existingAliases.find(
              (a) =>
                a.tccsId === tccs.id &&
                normalizeName(a.canonicalName) === normalizeName(change.newName)
            );

            if (existing) {
              const merged = mergeAliases(existing, [change.oldName]);
              if (change.autoConfirm) merged.confirmedByAdmin = true;
              const cleanMerged = removeUndefined(merged);
              aliasUpdates[`criteria_aliases/${existing.id}`] = cleanMerged;
              try {
                await this.aliasRepo.update(cleanMerged);
              } catch (e: any) {
                console.warn('Lỗi cập nhật alias khi cập nhật TCCS:', e);
              }
            } else {
              const newId = `ca_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const newAlias: CriteriaAlias = {
                id: newId,
                ...createAliasRecord(
                  tccs.id,
                  change.newName,
                  [change.oldName],
                  true,
                  change.autoConfirm
                ),
              };
              const cleanNewAlias = removeUndefined(newAlias);
              aliasUpdates[`criteria_aliases/${newId}`] = cleanNewAlias;
              try {
                await this.aliasRepo.save(cleanNewAlias);
              } catch (e: any) {
                console.warn('Lỗi lưu alias mới khi cập nhật TCCS:', e);
              }
            }
          }
        }

        await this.repo.update(tccs);
        return { aliasUpdates };
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi cập nhật TCCS qua Workflow.');
    }

    return execution.data!;
  }

  async deleteTCCS(
    id: string,
    batches: Batch[] = [],
    currentUser?: any,
    tccsCode?: string,
    existingAliases: CriteriaAlias[] = [],
    reason?: string
  ): Promise<void> {
    if (!can(currentUser, 'tccs:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa TCCS này.');
    }

    // Ràng buộc toàn vẹn: Không xóa TCCS đang được lô sản xuất tham chiếu
    const isBoundToBatch = batches.some((b) => b.tccsId === id);
    if (isBoundToBatch) {
      throw new Error('TCCS này đang liên kết với ít nhất một lô sản xuất. Không thể xóa.');
    }

    const execution = await WorkflowFacade.dispatch<string>(
      {
        actionId: 'TCCS_OBSOLETE',
        entityType: 'TCCS',
        entityId: id,
        actor: this.toActor(currentUser),
        reason: reason || `Ngừng áp dụng/Xóa TCCS: ${tccsCode || id}`,
      },
      async () => {
        await this.repo.delete(id);

        // Xóa liên kết alias mồ côi
        const relatedAliases = existingAliases.filter((a) => a.tccsId === id);
        if (relatedAliases.length > 0) {
          for (const a of relatedAliases) {
            try {
              await this.aliasRepo.delete(a.id);
            } catch (e: any) {
              console.warn('Lỗi dọn dẹp alias khi xóa TCCS:', e);
            }
          }
        }
        return id;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi xóa TCCS qua Workflow.');
    }
  }

  // --- AI LEARNED MAPPING OPERATIONS ---
  async addAiLearnedMapping(
    originalName: string,
    systemName: string,
    existingMappings: AILearnedMapping[] = [],
    currentUser?: any
  ): Promise<void> {
    const execution = await WorkflowFacade.dispatch<
      { originalName: string; systemName: string },
      void
    >(
      {
        actionId: 'CRITERIA_ALIAS_MAP',
        entityType: 'MASTER_DATA',
        entityId: originalName,
        actor: this.toActor(currentUser),
        payload: { originalName, systemName },
      },
      async () => {
        const existing = existingMappings.find(
          (m) => m.originalName === originalName && m.systemName === systemName
        );
        const now = new Date().toISOString();

        if (existing) {
          await this.aiRepo.update({
            ...existing,
            frequency: existing.frequency + 1,
            updatedAt: now,
          });
        } else {
          const newId = `aim_${Date.now()}`;
          const newMapping: AILearnedMapping = {
            id: newId,
            originalName,
            systemName,
            frequency: 1,
            createdAt: now,
            updatedAt: now,
          };
          await this.aiRepo.save(newMapping);
        }
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi lưu ánh xạ AI qua Workflow.');
    }
  }

  // --- CRITERIA ALIAS OPERATIONS ---
  async addCriteriaAlias(alias: CriteriaAlias, currentUser: any): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền tạo Criteria Alias.');
    }

    const cleanAlias = removeUndefined(alias);

    const execution = await WorkflowFacade.dispatch<CriteriaAlias>(
      {
        actionId: 'CRITERIA_ALIAS_MAP',
        entityType: 'MASTER_DATA',
        entityId: alias.id,
        actor: this.toActor(currentUser),
        payload: cleanAlias,
      },
      async () => {
        await this.aliasRepo.save(cleanAlias);
        return cleanAlias;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi tạo Criteria Alias qua Workflow.');
    }
  }

  async updateCriteriaAlias(alias: CriteriaAlias, currentUser: any): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật Criteria Alias.');
    }

    const updated = removeUndefined({ ...alias, updatedAt: new Date().toISOString() });

    const execution = await WorkflowFacade.dispatch<CriteriaAlias>(
      {
        actionId: 'CRITERIA_ALIAS_MAP',
        entityType: 'MASTER_DATA',
        entityId: alias.id,
        actor: this.toActor(currentUser),
        payload: updated,
      },
      async () => {
        await this.aliasRepo.update(updated);
        return updated;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi cập nhật Criteria Alias qua Workflow.');
    }
  }

  async deleteCriteriaAlias(id: string, currentUser: any, canonicalName?: string): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa Criteria Alias.');
    }

    const execution = await WorkflowFacade.dispatch<string>(
      {
        actionId: 'CRITERIA_ALIAS_MAP',
        entityType: 'MASTER_DATA',
        entityId: id,
        actor: this.toActor(currentUser),
      },
      async () => {
        await this.aliasRepo.delete(id);
        return id;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi xóa Criteria Alias qua Workflow.');
    }
  }

  async confirmCriteriaAlias(alias: CriteriaAlias, currentUser: any): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xác nhận Criteria Alias.');
    }

    const updated = {
      ...alias,
      confirmedByAdmin: true,
      updatedAt: new Date().toISOString(),
    };
    await this.updateCriteriaAlias(updated, currentUser);
  }

  async addAliasToExisting(
    alias: CriteriaAlias,
    newAlias: string,
    currentUser: any
  ): Promise<void> {
    if (!can(currentUser, 'tccs:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền thêm alias mới.');
    }

    const merged = mergeAliases(alias, [newAlias]);
    merged.confirmedByAdmin = true;
    await this.updateCriteriaAlias(merged, currentUser);
  }
}

export const tccsAppService = new TCCSAppService();
