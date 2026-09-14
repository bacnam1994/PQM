import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ToastType, ToastMessage, AppStoreState, AppStoreActions, AppStore } from './slices/types';
import {
  MutationMeta,
  executeOfflineOptimistic,
  processFormulaBeforeSave,
  handleSaveRecord,
  handleDeleteRecord,
  resolveCurrentIdentity,
} from './utils/storeHelpers';
import { createAuthSlice } from './slices/authSlice';
import { createSystemSlice } from './slices/systemSlice';
import { createProductSlice } from './slices/productSlice';
import { createBatchSlice } from './slices/batchSlice';
import { createTestResultSlice } from './slices/testResultSlice';
import { createTCCSSlice } from './slices/tccsSlice';
import { queryClient } from '../lib/queryClient';

// Re-export types for backward compatibility across the entire app
export type { ToastType, ToastMessage, MutationMeta, AppStoreState, AppStoreActions, AppStore };
export {
  executeOfflineOptimistic,
  processFormulaBeforeSave,
  handleSaveRecord,
  handleDeleteRecord,
  resolveCurrentIdentity,
};

/**
 * useAppStore — Central Zustand Store (V4 Modular Slice Pattern)
 *
 * Kiến trúc V4:
 * - authSlice: Xác thực người dùng, phân quyền, mật khẩu.
 * - systemSlice: SyncStatus, toasts, theme, navigate, qualityAlerts, backup/restore.
 * - productSlice: Products, ProductFormulas, RawMaterials (qua Application Services).
 * - batchSlice: Batches, batch status transitions, electronic signatures (qua BatchAppService).
 * - testResultSlice: TestResults, pagination, dashboard fetching (qua TestResultAppService).
 * - tccsSlice: TCCS, Criteria Aliases, AI Learned Mappings (qua TCCSAppService).
 *
 * Đảm bảo 100% tương thích ngược với tất cả components đang sử dụng useAppStore.
 */
export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createSystemSlice(...a),
      ...createAuthSlice(...a),
      ...createProductSlice(...a),
      ...createBatchSlice(...a),
      ...createTestResultSlice(...a),
      ...createTCCSSlice(...a),
    }),
    { name: 'PQM_AppStore' }
  )
);

// --- TANSTACK QUERY -> ZUSTAND READ-THROUGH FACADE SYNCHRONIZATION ---
// TanStack Query là Single Source of Truth cho Server State.
// Zustand đóng vai trò Read-Through Facade để bảo toàn 100% tương thích ngược cho các components cũ.
const QUERY_KEY_TO_STORE_KEY: Record<string, string> = {
  products: 'products',
  batches: 'batches',
  tccsList: 'tccsList',
  productFormulas: 'productFormulas',
  rawMaterials: 'rawMaterials',
  testResults: 'testResults',
  criteriaAliases: 'criteriaAliases',
  aiLearnedMappings: 'aiLearnedMappings',
};

queryClient.getQueryCache().subscribe((event) => {
  if (event?.type === 'updated') {
    const queryKey = event.query.queryKey;
    if (Array.isArray(queryKey) && queryKey.length === 1 && typeof queryKey[0] === 'string') {
      const storeKey = QUERY_KEY_TO_STORE_KEY[queryKey[0]];
      if (storeKey) {
        const currentData = event.query.state.data;
        if (currentData !== undefined) {
          const currentStoreVal = (useAppStore.getState() as any)[storeKey];
          if (currentStoreVal !== currentData) {
            useAppStore.setState({ [storeKey]: currentData } as any);
          }
        }
      }
    }
  }
});

// --- TỐI ƯU HÓA HOOK SELECTORS (Dành cho components cần tối ưu re-render) ---

/** Hook chọn dữ liệu Auth */
export const useAppAuth = () => {
  return useAppStore((state) => ({
    user: state.user,
    isAdmin: state.isAdmin,
    role: state.role,
    authLoading: state.authLoading,
    setUser: state.setUser,
    setIsAdmin: state.setIsAdmin,
    setRole: state.setRole,
    login: state.login,
    logout: state.logout,
    signup: state.signup,
    changePassword: state.changePassword,
    resetPassword: state.resetPassword,
  }));
};

/** Hook chọn dữ liệu System (Toasts, Sync, Theme) */
export const useAppSystem = () => {
  return useAppStore((state) => ({
    syncStatus: state.syncStatus,
    toasts: state.toasts,
    theme: state.theme,
    lastSync: state.lastSync,
    qualityAlerts: state.qualityAlerts,
    setAppState: state.setAppState,
    setSyncStatus: state.setSyncStatus,
    setTheme: state.setTheme,
    notify: state.notify,
    removeToast: state.removeToast,
    syncQualityAlerts: state.syncQualityAlerts,
  }));
};

/** Hook chọn dữ liệu Sản phẩm & Công thức */
export const useAppProducts = () => {
  return useAppStore((state) => ({
    products: state.products,
    productFormulas: state.productFormulas,
    rawMaterials: state.rawMaterials,
    addProduct: state.addProduct,
    updateProduct: state.updateProduct,
    deleteProduct: state.deleteProduct,
    bulkAddProducts: state.bulkAddProducts,
    addProductFormula: state.addProductFormula,
    updateProductFormula: state.updateProductFormula,
    deleteProductFormula: state.deleteProductFormula,
    addRawMaterial: state.addRawMaterial,
    updateRawMaterial: state.updateRawMaterial,
    deleteRawMaterial: state.deleteRawMaterial,
  }));
};

/** Hook chọn dữ liệu Lô sản xuất */
export const useAppBatches = () => {
  return useAppStore((state) => ({
    batches: state.batches,
    addBatch: state.addBatch,
    updateBatch: state.updateBatch,
    deleteBatch: state.deleteBatch,
    updateBatchStatus: state.updateBatchStatus,
    updateBatchProgress: state.updateBatchProgress,
  }));
};

/** Hook chọn dữ liệu Phiếu kiểm nghiệm */
export const useAppTestResults = () => {
  return useAppStore((state) => ({
    testResults: state.testResults,
    allTestResults: state.allTestResults,
    testResultLimit: state.testResultLimit,
    addTestResult: state.addTestResult,
    updateTestResult: state.updateTestResult,
    deleteTestResult: state.deleteTestResult,
    loadMoreTestResults: state.loadMoreTestResults,
    mergeTestResults: state.mergeTestResults,
    fetchAllTestResultsForDashboard: state.fetchAllTestResultsForDashboard,
  }));
};

/** Hook chọn dữ liệu Tiêu chuẩn cơ sở & Aliases */
export const useAppTCCS = () => {
  return useAppStore((state) => ({
    tccsList: state.tccsList,
    criteriaAliases: state.criteriaAliases,
    aiLearnedMappings: state.aiLearnedMappings,
    addTCCS: state.addTCCS,
    updateTCCS: state.updateTCCS,
    deleteTCCS: state.deleteTCCS,
    addAiLearnedMapping: state.addAiLearnedMapping,
    addCriteriaAlias: state.addCriteriaAlias,
    updateCriteriaAlias: state.updateCriteriaAlias,
    deleteCriteriaAlias: state.deleteCriteriaAlias,
    confirmCriteriaAlias: state.confirmCriteriaAlias,
    addAliasToExisting: state.addAliasToExisting,
  }));
};

/** Lấy đối tượng định danh người dùng hiện tại có đầy đủ vai trò và quyền hạn */
export const getStoreCurrentUser = () => {
  return resolveCurrentIdentity(useAppStore.getState());
};

if (typeof window !== 'undefined') {
  (window as any).__PQM_GET_CURRENT_USER__ = getStoreCurrentUser;
}
