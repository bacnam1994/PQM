import { ref, set as firebaseSet, update as firebaseUpdate } from 'firebase/database';
import { db } from '../../firebase';
import { detectQualityAnomalies } from '../../services/reportService';
import { executeOfflineOptimistic } from '../utils/storeHelpers';
import { queryClient } from '../../lib/queryClient';
import {
  PRODUCT_QUERY_KEYS,
  BATCH_QUERY_KEYS,
  TCCS_QUERY_KEYS,
  TEST_RESULT_QUERY_KEYS,
} from '../../constants/queryKeys';
import { SystemSlice, StoreSlice, ToastMessage } from './types';

export const createSystemSlice: StoreSlice<SystemSlice> = (set, get) => ({
  // --- INITIAL SYSTEM STATE ---
  syncStatus: 'IDLE',
  toasts: [],
  theme:
    typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  lastSync: null,
  qualityAlerts: [],
  navigate: () => console.warn('Hàm navigate chưa được khởi tạo!'),

  // --- ACTIONS ---
  setAppState: (partialState) => {
    // Single Source of Truth: Đồng bộ trực tiếp vào TanStack Query Cache
    try {
      if (partialState.products)
        queryClient.setQueryData(PRODUCT_QUERY_KEYS.all, partialState.products);
      if (partialState.batches)
        queryClient.setQueryData(BATCH_QUERY_KEYS.all, partialState.batches);
      if (partialState.tccsList)
        queryClient.setQueryData(TCCS_QUERY_KEYS.all, partialState.tccsList);
      if (partialState.productFormulas)
        queryClient.setQueryData(PRODUCT_QUERY_KEYS.formulas, partialState.productFormulas);
      if (partialState.rawMaterials)
        queryClient.setQueryData(PRODUCT_QUERY_KEYS.materials, partialState.rawMaterials);
      if (partialState.testResults)
        queryClient.setQueryData(TEST_RESULT_QUERY_KEYS.all, partialState.testResults);
      if (partialState.criteriaAliases)
        queryClient.setQueryData(TCCS_QUERY_KEYS.aliases, partialState.criteriaAliases);
      if (partialState.aiLearnedMappings)
        queryClient.setQueryData(TCCS_QUERY_KEYS.aiMappings, partialState.aiLearnedMappings);
    } catch (e) {
      // Bỏ qua lỗi đồng bộ trong môi trường test nếu queryClient chưa khởi tạo đầy đủ
    }

    set((state) => ({ ...state, ...partialState }), false, 'setAppState');
  },

  setSyncStatus: (status) => set({ syncStatus: status }, false, `setSyncStatus/${status}`),

  setTheme: (theme) => {
    if (typeof window !== 'undefined') localStorage.setItem('theme', theme);
    set({ theme }, false, 'setTheme');
  },

  notify: (msg) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...msg, id }] }), false, 'notify');
    setTimeout(() => get().removeToast(id), 5000);
  },

  removeToast: (id) =>
    set(
      (state) => ({ toasts: state.toasts.filter((t: ToastMessage) => t.id !== id) }),
      false,
      'removeToast'
    ),

  resetToDemoData: async () => {
    if (!get().isAdmin) {
      return get().notify({
        type: 'ERROR',
        title: 'Từ chối',
        message: 'Chỉ Admin mới có quyền nạp dữ liệu mẫu.',
      });
    }
    try {
      const demoData = {
        products: {
          demo_p1: {
            id: 'demo_p1',
            code: 'DEMO-001',
            name: 'Sản phẩm mẫu A',
            createdAt: new Date().toISOString(),
          },
        },
        product_formulas: {},
        tccs: {
          demo_t1: {
            id: 'demo_t1',
            productId: 'demo_p1',
            code: 'TCCS 01:2024',
            name: 'TCCS Mẫu A',
            issueDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        },
        batches: {},
        testResults: {},
        raw_materials: {},
        criteria_aliases: {},
        ai_learned_mappings: {},
      };
      await executeOfflineOptimistic(firebaseSet(ref(db), demoData), get);
      get().notify({ type: 'SUCCESS', message: 'Nạp dữ liệu mẫu thành công!' });
    } catch (e) {
      console.error('Lỗi nạp dữ liệu mẫu:', e);
    }
  },

  clearAllData: async () => {
    if (!get().isAdmin) {
      return get().notify({
        type: 'ERROR',
        title: 'Từ chối',
        message: 'Chỉ Admin mới có quyền xóa dữ liệu.',
      });
    }
    try {
      await executeOfflineOptimistic(firebaseSet(ref(db), null), get);
      get().notify({ type: 'SUCCESS', message: 'Đã xóa sạch dữ liệu!' });
    } catch (e) {
      console.error('Lỗi xóa sạch dữ liệu:', e);
    }
  },

  loadBackup: async (data) => {
    if (!get().isAdmin) {
      return get().notify({
        type: 'ERROR',
        title: 'Từ chối',
        message: 'Chỉ Admin mới có quyền khôi phục.',
      });
    }
    try {
      const toMap = (arr: any[]) => {
        if (!Array.isArray(arr)) return arr || {};
        const map: any = {};
        arr.forEach((item) => {
          if (item?.id) map[item.id] = item;
        });
        return map;
      };
      const restoreData = {
        products: toMap(data.products),
        batches: toMap(data.batches),
        product_formulas: toMap(data.productFormulas),
        tccs: toMap(data.tccsList),
        testResults: toMap(data.testResults),
        raw_materials: toMap(data.rawMaterials),
        ai_learned_mappings: toMap(data.aiLearnedMappings || (data as any).ai_learned_mappings),
        criteria_aliases: toMap(data.criteriaAliases || (data as any).criteria_aliases),
      };
      await executeOfflineOptimistic(firebaseSet(ref(db), restoreData), get);
      get().notify({
        type: 'SUCCESS',
        title: 'Thành công',
        message: 'Khôi phục dữ liệu hoàn tất.',
      });
    } catch (e) {
      throw e;
    }
  },

  syncQualityAlerts: async () => {
    try {
      const state = get();
      if (!state.user) return;
      const anomalies = detectQualityAnomalies(
        {
          products: state.products,
          batches: state.batches,
          testResults: state.testResults,
        },
        30
      );

      // [FIX P0.4] Dùng firebaseUpdate với timestamp key thay vì firebaseSet ghi đè
      const alertUpdate: Record<string, any> = {};
      alertUpdate['latest'] = {
        updatedAt: new Date().toISOString(),
        alerts: anomalies,
      };
      await executeOfflineOptimistic(firebaseUpdate(ref(db, 'quality_alerts'), alertUpdate), get);
    } catch (e) {
      console.error('Lỗi đồng bộ cảnh báo chất lượng:', e);
    }
  },
});
