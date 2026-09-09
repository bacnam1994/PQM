import { tccsAppService } from '../../services/app/TCCSAppService';
import { TCCSSlice, StoreSlice } from './types';
import { TCCS, CriteriaAlias } from '../../types';

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
      await tccsAppService.updateTCCS(
        t,
        oldTCCS,
        state.criteriaAliases,
        state.user
      );
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật TCCS', message: error.message });
      throw error;
    }
  },

  deleteTCCS: async (id: string) => {
    try {
      const state = get();
      const tccs = state.tccsList.find((t: TCCS) => t.id === id);
      await tccsAppService.deleteTCCS(
        id, 
        state.batches, 
        state.user, 
        tccs?.code,
        state.criteriaAliases
      );
    } catch (error: any) {
      get().notify({ type: 'WARNING', title: 'Không thể xóa', message: error.message });
      throw error;
    }
  },

  // --- AI LEARNED MAPPING ACTIONS ---
  addAiLearnedMapping: async (originalName: string, systemName: string) => {
    try {
      const state = get();
      await tccsAppService.addAiLearnedMapping(
        originalName, 
        systemName, 
        state.aiLearnedMappings, 
        state.user
      );
    } catch (e: any) {
      console.error('Lỗi cập nhật AI Learned Mapping:', e);
    }
  },

  // --- CRITERIA ALIAS ACTIONS ---
  addCriteriaAlias: async (alias: CriteriaAlias) => {
    try {
      await tccsAppService.addCriteriaAlias(alias, get().user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi tạo Criteria Alias', message: error.message });
      throw error;
    }
  },

  updateCriteriaAlias: async (alias: CriteriaAlias) => {
    try {
      await tccsAppService.updateCriteriaAlias(alias, get().user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật Criteria Alias', message: error.message });
      throw error;
    }
  },

  deleteCriteriaAlias: async (id: string) => {
    try {
      const alias = get().criteriaAliases.find((a: CriteriaAlias) => a.id === id);
      await tccsAppService.deleteCriteriaAlias(id, get().user, alias?.canonicalName);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa Criteria Alias', message: error.message });
      throw error;
    }
  },

  confirmCriteriaAlias: async (id: string) => {
    try {
      const alias = get().criteriaAliases.find((a: CriteriaAlias) => a.id === id);
      if (!alias) return;
      await tccsAppService.confirmCriteriaAlias(alias, get().user);
      get().notify({
        type: 'SUCCESS',
        message: `Đã xác nhận alias cho "${alias.canonicalName}"`
      });
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xác nhận Criteria Alias', message: error.message });
      throw error;
    }
  },

  addAliasToExisting: async (aliasId: string, newAlias: string) => {
    try {
      const alias = get().criteriaAliases.find((a: CriteriaAlias) => a.id === aliasId);
      if (!alias) return;
      await tccsAppService.addAliasToExisting(alias, newAlias, get().user);
      get().notify({
        type: 'SUCCESS',
        message: `Đã thêm alias "${newAlias}" cho "${alias.canonicalName}"`
      });
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi thêm alias', message: error.message });
      throw error;
    }
  }
});
