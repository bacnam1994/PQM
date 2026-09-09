import { ref, set as firebaseSet, update as firebaseUpdate } from 'firebase/database';
import { db } from '../../firebase';
import { tccsAppService } from '../../services/app/TCCSAppService';
import { logAuditAction } from '../../services/auditService';
import { mergeAliases } from '../../services/criteriaAliasService';
import { executeOfflineOptimistic, handleSaveRecord, handleDeleteRecord } from '../utils/storeHelpers';
import { TCCSSlice, StoreSlice } from './types';
import { TCCS, CriteriaAlias, AILearnedMapping } from '../../types';

export const createTCCSSlice: StoreSlice<TCCSSlice> = (set, get) => ({
  // --- INITIAL TCCS STATE ---
  tccsList: [],
  criteriaAliases: [],
  aiLearnedMappings: [],

  // --- TCCS ACTIONS ---
  addTCCS: async (t: TCCS) => {
    try {
      const state = get();
      await tccsAppService.createTCCS(t, state.tccsList, state.user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu TCCS', message: error.message });
      throw error;
    }
  },

  updateTCCS: async (t: TCCS) => {
    try {
      const state = get();
      const oldTCCS = state.tccsList.find((item: TCCS) => item.id === t.id);
      const { aliasUpdates } = await tccsAppService.updateTCCS(
        t,
        oldTCCS,
        state.criteriaAliases,
        state.user
      );
      if (Object.keys(aliasUpdates).length > 0) {
        await executeOfflineOptimistic(
          firebaseUpdate(ref(db), aliasUpdates),
          get
        );
      }
      return get().addTCCS(t);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật TCCS', message: error.message });
      throw error;
    }
  },

  deleteTCCS: async (id: string) => {
    try {
      const state = get();
      const tccs = state.tccsList.find((t: TCCS) => t.id === id);
      await tccsAppService.deleteTCCS(id, state.batches, state.user, tccs?.code);
      // Dọn dẹp các Criteria Alias gắn liền với TCCS này để tránh orphan records
      const relatedAliases = state.criteriaAliases.filter(
        (a: CriteriaAlias) => a.tccsId === id
      );
      if (relatedAliases.length > 0) {
        const aliasUpdates: Record<string, any> = {};
        relatedAliases.forEach((a: CriteriaAlias) => {
          aliasUpdates[`criteria_aliases/${a.id}`] = null;
        });
        try {
          await executeOfflineOptimistic(
            firebaseUpdate(ref(db), aliasUpdates),
            get
          );
        } catch (e) {
          console.warn('Lỗi dọn dẹp alias khi xóa TCCS:', e);
        }
      }
    } catch (error: any) {
      get().notify({ type: 'WARNING', title: 'Không thể xóa', message: error.message });
      throw error;
    }
  },

  // --- AI LEARNED MAPPING ACTIONS ---
  addAiLearnedMapping: async (originalName: string, systemName: string) => {
    try {
      const state = get();
      const existing = state.aiLearnedMappings.find(
        (m: AILearnedMapping) =>
          m.originalName === originalName && m.systemName === systemName
      );
      const now = new Date().toISOString();

      if (existing) {
        // Tăng tần suất sử dụng và cập nhật timestamp
        const updated = {
          ...existing,
          frequency: existing.frequency + 1,
          updatedAt: now
        };
        await executeOfflineOptimistic(
          firebaseUpdate(ref(db, `ai_learned_mappings/${existing.id}`), {
            frequency: updated.frequency,
            updatedAt: updated.updatedAt
          }),
          get
        );
      } else {
        // Tạo mapping mới
        const newId = `aim_${Date.now()}`;
        const newMapping: AILearnedMapping = {
          id: newId,
          originalName,
          systemName,
          frequency: 1,
          createdAt: now,
          updatedAt: now
        };
        await executeOfflineOptimistic(
          firebaseSet(ref(db, `ai_learned_mappings/${newId}`), newMapping),
          get
        );
      }
    } catch (e) {
      console.error('Lỗi cập nhật AI Learned Mapping:', e);
    }
  },

  // --- CRITERIA ALIAS ACTIONS ---
  addCriteriaAlias: async (alias: CriteriaAlias) => {
    await handleSaveRecord('criteria_aliases', alias, get);
    logAuditAction({
      action: 'CREATE',
      collection: 'CRITERIA_ALIASES',
      documentId: alias.id,
      details: `Tạo alias: "${alias.aliases.join(', ')}" → "${alias.canonicalName}" (TCCS: ${alias.tccsId})`,
      performedBy: get().user?.email || 'unknown'
    });
  },

  updateCriteriaAlias: async (alias: CriteriaAlias) => {
    const updated = { ...alias, updatedAt: new Date().toISOString() };
    await handleSaveRecord('criteria_aliases', updated, get);
    logAuditAction({
      action: 'UPDATE',
      collection: 'CRITERIA_ALIASES',
      documentId: alias.id,
      details: `Cập nhật alias cho "${alias.canonicalName}"`,
      performedBy: get().user?.email || 'unknown'
    });
  },

  deleteCriteriaAlias: async (id: string) => {
    const alias = get().criteriaAliases.find((a: CriteriaAlias) => a.id === id);
    await handleDeleteRecord('criteria_aliases', id, get);
    logAuditAction({
      action: 'DELETE',
      collection: 'CRITERIA_ALIASES',
      documentId: id,
      details: `Xóa alias cho "${alias?.canonicalName || id}"`,
      performedBy: get().user?.email || 'unknown'
    });
  },

  confirmCriteriaAlias: async (id: string) => {
    const alias = get().criteriaAliases.find((a: CriteriaAlias) => a.id === id);
    if (!alias) return;
    const updated = {
      ...alias,
      confirmedByAdmin: true,
      updatedAt: new Date().toISOString()
    };
    await handleSaveRecord('criteria_aliases', updated, get);
    get().notify({
      type: 'SUCCESS',
      message: `Đã xác nhận alias cho "${alias.canonicalName}"`
    });
  },

  addAliasToExisting: async (aliasId: string, newAlias: string) => {
    const alias = get().criteriaAliases.find((a: CriteriaAlias) => a.id === aliasId);
    if (!alias) return;
    const merged = mergeAliases(alias, [newAlias]);
    merged.confirmedByAdmin = true;
    await handleSaveRecord('criteria_aliases', merged, get);
    get().notify({
      type: 'SUCCESS',
      message: `Đã thêm alias "${newAlias}" cho "${alias.canonicalName}"`
    });
  }
});
