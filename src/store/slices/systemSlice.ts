import { ref, update as firebaseUpdate } from 'firebase/database';
import { db } from '../../firebase';
import { detectQualityAnomalies } from '../../services/reportService';
import { executeOfflineOptimistic } from '../utils/storeHelpers';
import { queryClient } from '../../lib/queryClient';
import {
  PRODUCT_QUERY_KEYS,
  BATCH_QUERY_KEYS,
  TCCS_QUERY_KEYS,
  TEST_RESULT_QUERY_KEYS,
  LABORATORY_QUERY_KEYS,
} from '../../constants/queryKeys';
import { DEFAULT_TESTING_LABORATORIES } from '../../services/laboratoryService';
import { systemAppService } from '../../services/app/SystemAppService';
import { laboratoryAppService } from '../../services/app/LaboratoryAppService';
import { SystemSlice, StoreSlice, ToastMessage } from './types';

export const createSystemSlice: StoreSlice<SystemSlice> = (set, get) => ({
  // --- INITIAL SYSTEM STATE ---
  syncStatus: 'IDLE',
  toasts: [],
  theme:
    typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  lastSync: null,
  qualityAlerts: [],
  testingLaboratories: DEFAULT_TESTING_LABORATORIES,
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
      if (partialState.testingLaboratories)
        queryClient.setQueryData(LABORATORY_QUERY_KEYS.all, partialState.testingLaboratories);
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

      const user = get().user;
      await systemAppService.resetDemoData(demoData, {
        actorId: user?.uid || 'admin',
        actorRole: get().isAdmin ? 'ADMIN' : user?.role || 'GUEST',
        actorEmail: user?.email,
        reason: 'Khởi tạo dữ liệu mẫu hệ thống từ bảng điều khiển',
        confirmationToken: 'CONFIRM_RESET_DEMO',
      });

      get().notify({ type: 'SUCCESS', message: 'Nạp dữ liệu mẫu thành công!' });
    } catch (e: any) {
      console.error('Lỗi nạp dữ liệu mẫu:', e);
      get().notify({
        type: 'ERROR',
        title: 'Thất bại',
        message: e?.message || 'Lỗi nạp dữ liệu mẫu',
      });
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
      const user = get().user;
      await systemAppService.wipeDatabase({
        actorId: user?.uid || 'admin',
        actorRole: get().isAdmin ? 'ADMIN' : user?.role || 'GUEST',
        actorEmail: user?.email,
        reason: 'Xóa sạch dữ liệu hệ thống từ bảng điều khiển Admin',
        confirmationToken: 'CONFIRM_WIPE',
      });

      get().notify({ type: 'SUCCESS', message: 'Đã xóa sạch dữ liệu!' });
    } catch (e: any) {
      console.error('Lỗi xóa sạch dữ liệu:', e);
      get().notify({
        type: 'ERROR',
        title: 'Thất bại',
        message: e?.message || 'Lỗi xóa sạch dữ liệu',
      });
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
        testing_laboratories: toMap(data.testingLaboratories || (data as any).testing_laboratories),
      };

      const user = get().user;
      await systemAppService.restoreDatabase(restoreData, {
        actorId: user?.uid || 'admin',
        actorRole: get().isAdmin ? 'ADMIN' : user?.role || 'GUEST',
        actorEmail: user?.email,
        reason: 'Khôi phục cơ sở dữ liệu từ tệp sao lưu JSON',
        confirmationToken: 'CONFIRM_RESTORE',
      });

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

  addTestingLaboratory: async (lab) => {
    const user = get().user;
    await laboratoryAppService.createLaboratory(lab, {
      actorId: user?.uid || 'system',
      actorRole: get().isAdmin ? 'ADMIN' : user?.role || 'QA',
      actorEmail: user?.email,
    });
    queryClient.invalidateQueries({ queryKey: LABORATORY_QUERY_KEYS.all });
  },

  updateTestingLaboratory: async (lab) => {
    const user = get().user;
    await laboratoryAppService.updateLaboratory(lab, {
      actorId: user?.uid || 'system',
      actorRole: get().isAdmin ? 'ADMIN' : user?.role || 'QA',
      actorEmail: user?.email,
    });
    queryClient.invalidateQueries({ queryKey: LABORATORY_QUERY_KEYS.all });
  },

  deleteTestingLaboratory: async (id) => {
    const user = get().user;
    await laboratoryAppService.deleteLaboratory(id, {
      actorId: user?.uid || 'system',
      actorRole: get().isAdmin ? 'ADMIN' : user?.role || 'ADMIN',
      actorEmail: user?.email,
      reason: 'Xóa đơn vị kiểm nghiệm từ bảng điều khiển quản lý',
    });
    queryClient.invalidateQueries({ queryKey: LABORATORY_QUERY_KEYS.all });
  },
});
