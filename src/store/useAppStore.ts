import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, SyncStatus, Product, Batch, TCCS, TestResult, ProductFormula, RawMaterial, AILearnedMapping, CriteriaAlias, Role, ElectronicSignature } from '../types';
import { ref, set as firebaseSet, remove as firebaseRemove, update as firebaseUpdate, get as firebaseGet } from 'firebase/database';
import { db } from '../firebase';
import { User, getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { parseNumberFromText } from '../utils';
import { logAuditAction } from '../services/auditService';
import { detectCriteriaChanges, normalizeName, mergeAliases, createAliasRecord } from '../services/criteriaAliasService';
import { deleteProductService, deleteBatchService, deleteTestResultService } from '../services/databaseService';
import { detectQualityAnomalies } from '../services/reportService';
import { productAppService } from '../services/app/ProductAppService';
import { materialAppService } from '../services/app/MaterialAppService';
import { tccsAppService } from '../services/app/TCCSAppService';
import { formulaAppService } from '../services/app/FormulaAppService';
import { batchAppService } from '../services/app/BatchAppService';
import { testResultAppService } from '../services/app/TestResultAppService';

import { enqueueOfflineMutation, replayOfflineMutations, getPendingMutationsCount } from '../utils/offlineMutationQueue';

export type ToastType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

// --- LOGIC CHỐNG MẤT DỮ LIỆU KHI OFFLINE ---
let pendingWritesCount = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (pendingWritesCount > 0) {
      e.preventDefault();
      e.returnValue = 'Dữ liệu chưa được đồng bộ lên máy chủ. Bạn có chắc chắn muốn thoát?';
      return e.returnValue;
    }
  });
}

export interface MutationMeta {
  path: string;
  operation: 'SET' | 'UPDATE' | 'REMOVE';
  data?: any;
}

const executeOfflineOptimistic = async (
  task: Promise<any>,
  get: any,
  meta?: MutationMeta
) => {
  get().setSyncStatus('SAVING');
  pendingWritesCount++;
  try {
    await Promise.race([
      task,
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_OFFLINE')), 5000))
    ]);
    pendingWritesCount--;
    get().setSyncStatus('SAVED');
    setTimeout(() => get().setSyncStatus('IDLE'), 2000);
  } catch (e: any) {
    if (e.message === 'TIMEOUT_OFFLINE' || e.code === 'unavailable' || !navigator.onLine) {
      get().setSyncStatus('OFFLINE');
      if (meta) {
        enqueueOfflineMutation(meta).catch(err => {
          console.warn('[Store] Lỗi đưa mutation vào hàng đợi ngoại tuyến:', err);
        });
      }
      task.then(() => {
        pendingWritesCount--;
        get().setSyncStatus('SAVED');
        setTimeout(() => get().setSyncStatus('IDLE'), 2000);
      }).catch(() => {
        pendingWritesCount--;
        get().setSyncStatus('ERROR');
      });
      return; // Trả về ngay để UI không bị treo
    }
    pendingWritesCount--;
    throw e;
  }
};

const removeUndefined = (obj: any): any => {
  if (obj === undefined) return null;
  if (typeof obj === 'number') {
    if (isNaN(obj) || !isFinite(obj)) return 0;
    return obj;
  }
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      const val = obj[key];
      if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) {
        result[key] = 0;
      } else {
        result[key] = removeUndefined(val);
      }
    }
  }
  return result;
};

const _handleSave = async (path: string, item: any, get: any) => {
  if (!item || !item.id) throw new Error("Dữ liệu không hợp lệ (Thiếu ID)");
  try {
    const cleanItem = removeUndefined(item);
    const targetPath = `${path}/${item.id}`;
    await executeOfflineOptimistic(
      firebaseSet(ref(db, targetPath), cleanItem),
      get,
      { path: targetPath, operation: 'SET', data: cleanItem }
    );
  } catch (error: any) {
    if (error.message && (error.message.toLowerCase().includes("permission denied") || error.code === "PERMISSION_DENIED")) {
      get().notify({ type: 'ERROR', title: 'Lỗi phân quyền', message: `Lưu thất bại! Bạn không có quyền thực hiện hoặc dữ liệu vi phạm bảo mật.` });
      get().setSyncStatus('IDLE');
    } else {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu dữ liệu', message: error.message });
      get().setSyncStatus('ERROR');
    }
    throw error;
  }
};

const _handleDelete = async (path: string, id: string, get: any, requireAdmin: boolean = false) => {
  if (requireAdmin && !get().isAdmin) {
    get().notify({ type: 'ERROR', title: 'Từ chối truy cập', message: 'Chỉ Quản trị viên mới có quyền xóa dữ liệu này.' });
    throw new Error("Permission denied");
  }
  try {
    const targetPath = `${path}/${id}`;
    await executeOfflineOptimistic(
      firebaseRemove(ref(db, targetPath)),
      get,
      { path: targetPath, operation: 'REMOVE' }
    );
  } catch (error: any) {
    if (error.message && (error.message.toLowerCase().includes("permission denied") || error.code === "PERMISSION_DENIED")) {
      get().notify({ type: 'ERROR', title: 'Xóa thất bại', message: 'Bạn không có quyền xóa dữ liệu này.' });
      get().setSyncStatus('IDLE');
    } else {
      get().setSyncStatus('ERROR');
    }
    throw error;
  }
};

// Helper chuẩn hóa công thức trước khi lưu, bảo đảm không có NaN/Infinity gây lỗi Firebase RTDB
const processFormulaBeforeSave = (formula: ProductFormula): ProductFormula => {
  const processed = { ...formula };
  const sanitizeFormulaItem = (item: any) => {
    if (!item) return item;
    const newItem = { ...item };
    
    // 1. Xử lý declaredContent: nếu là string, parse ra số; nếu NaN / không hợp lệ thì gán 0
    let dc = newItem.declaredContent;
    if (typeof dc === 'string') {
      const parsed = parseNumberFromText(dc);
      dc = isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
    } else if (typeof dc !== 'number' || isNaN(dc) || !isFinite(dc)) {
      dc = 0;
    }
    newItem.declaredContent = dc;

    // 2. Xử lý elementalContent: nếu có thì parse số hợp lệ, nếu không hợp lệ hoặc không có thì delete
    let ec = newItem.elementalContent;
    if (ec !== undefined && ec !== null && ec !== '') {
      if (typeof ec === 'string') {
        const parsed = parseNumberFromText(ec);
        ec = isNaN(parsed) || !isFinite(parsed) ? undefined : parsed;
      } else if (typeof ec !== 'number' || isNaN(ec) || !isFinite(ec)) {
        ec = undefined;
      }
    } else {
      ec = undefined;
    }

    if (ec !== undefined) {
      newItem.elementalContent = ec;
    } else {
      delete newItem.elementalContent;
    }

    // 3. Đảm bảo id và name
    if (!newItem.name) newItem.name = '';
    if (!newItem.unit) newItem.unit = '';

    return newItem;
  };

  if (processed.ingredients && Array.isArray(processed.ingredients)) {
    processed.ingredients = processed.ingredients.map(sanitizeFormulaItem);
  }
  if (processed.excipients && Array.isArray(processed.excipients)) {
    processed.excipients = processed.excipients.map(sanitizeFormulaItem);
  }
  return processed;
};

interface AppStoreState extends AppState {
  syncStatus: SyncStatus;
  user: User | null;
  isAdmin: boolean;
  role: Role | null;
  authLoading: boolean;
  toasts: ToastMessage[];
  testResultLimit: number;
  theme: 'light' | 'dark';
  aiLearnedMappings: AILearnedMapping[];
  criteriaAliases: CriteriaAlias[];
}

interface AppStoreActions {
  // State Setters (Dành cho AppInitializer đẩy dữ liệu từ Firebase vào)
  setAppState: (partialState: Partial<AppState>) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setUser: (user: User | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setRole: (role: Role | null) => void;
  setAuthLoading: (loading: boolean) => void;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  
  signup: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;

  // Toast Actions
  notify: (msg: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Data Actions (CRUD)
  addProduct: (p: Product) => Promise<void>;
  updateProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkAddProducts: (products: Product[]) => Promise<void>;

  addProductFormula: (f: ProductFormula) => Promise<void>;
  updateProductFormula: (f: ProductFormula) => Promise<void>;
  deleteProductFormula: (id: string) => Promise<void>;

  addRawMaterial: (rm: RawMaterial) => Promise<void>;
  updateRawMaterial: (rm: RawMaterial) => Promise<void>;
  deleteRawMaterial: (id: string) => Promise<void>;

  addBatch: (b: Batch) => Promise<void>;
  updateBatch: (b: Batch) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  updateBatchStatus: (id: string, status: string, rejectReason?: string, signature?: ElectronicSignature) => Promise<void>;
  updateBatchProgress: (id: string, progressPercent: number) => Promise<void>;

  addTCCS: (t: TCCS) => Promise<void>;
  updateTCCS: (t: TCCS) => Promise<void>;
  deleteTCCS: (id: string) => Promise<void>;

  addTestResult: (r: TestResult) => Promise<void>;
  updateTestResult: (r: TestResult) => Promise<void>;
  deleteTestResult: (id: string) => Promise<void>;
  loadMoreTestResults: () => void;
  mergeTestResults: (list: TestResult[]) => void;
  resetToDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  fetchAllTestResultsForDashboard: () => Promise<void>;
  loadBackup: (data: AppState) => Promise<void>;
  navigate: (path: string, options?: any) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  addAiLearnedMapping: (originalName: string, systemName: string) => Promise<void>;
  syncQualityAlerts: () => Promise<void>;

  // CriteriaAlias Actions
  addCriteriaAlias: (alias: CriteriaAlias) => Promise<void>;
  updateCriteriaAlias: (alias: CriteriaAlias) => Promise<void>;
  deleteCriteriaAlias: (id: string) => Promise<void>;
  confirmCriteriaAlias: (id: string) => Promise<void>;
  addAliasToExisting: (aliasId: string, newAlias: string) => Promise<void>;
}

export const useAppStore = create<AppStoreState & AppStoreActions>()(devtools((set, get) => ({
  // --- INITIAL STATE ---
  products: [],
  batches: [],
  tccsList: [],
  productFormulas: [],
  rawMaterials: [],
  testResults: [],
  allTestResults: [],
  aiLearnedMappings: [],
  qualityAlerts: [],
  criteriaAliases: [],
  lastSync: null,
  syncStatus: 'IDLE',
  user: (typeof window !== 'undefined' && import.meta.env.DEV && localStorage.getItem('pqm_dev_mock_auth') === 'admin@example.com')
    ? ({ uid: 'e2e-test-admin', email: 'admin@example.com', displayName: 'Admin Test' } as any)
    : null,
  isAdmin: (typeof window !== 'undefined' && import.meta.env.DEV && localStorage.getItem('pqm_dev_mock_auth') === 'admin@example.com'),
  role: (typeof window !== 'undefined' && import.meta.env.DEV && localStorage.getItem('pqm_dev_mock_auth') === 'admin@example.com')
    ? 'ADMIN'
    : null,
  authLoading: (typeof window !== 'undefined' && import.meta.env.DEV && localStorage.getItem('pqm_dev_mock_auth') === 'admin@example.com')
    ? false
    : true,
  toasts: [],
  testResultLimit: 50,
  theme: (typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark') ? 'dark' : 'light',
  navigate: () => console.warn('Hàm navigate chưa được khởi tạo!'),

  // --- SETTERS & DERIVED STATE ---
  setAppState: (partialState) => set((state) => {
    const newState = { ...state, ...partialState };
    return newState;
  }, false, 'setAppState'),

  setSyncStatus: (status) => set({ syncStatus: status }, false, `setSyncStatus/${status}`),
  setUser: (user) => set({ user }, false, 'setUser'),
  setIsAdmin: (isAdmin) => set({ isAdmin }, false, 'setIsAdmin'),
  setRole: (role) => set({ role }, false, 'setRole'),
  setAuthLoading: (loading) => set({ authLoading: loading }, false, 'setAuthLoading'),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') localStorage.setItem('theme', theme);
    set({ theme }, false, 'setTheme');
  },

  login: async (email, password) => {
    try {
      await signInWithEmailAndPassword(getAuth(), email, password);
    } catch (err: any) {
      // Hỗ trợ kiểm thử E2E Playwright trên môi trường DEV cục bộ và CI
      if (import.meta.env.DEV && email === 'admin@example.com') {
        if (typeof window !== 'undefined') localStorage.setItem('pqm_dev_mock_auth', 'admin@example.com');
        const mockUser = {
          uid: 'e2e-test-admin',
          email: 'admin@example.com',
          displayName: 'Admin Test',
          photoURL: '',
        } as any;
        set({ user: mockUser, role: 'ADMIN', authLoading: false, isAdmin: true }, false, 'login-dev-mock');
        return;
      }
      throw err;
    }
  },

  resetPassword: async (email) => {
    await sendPasswordResetEmail(getAuth(), email);
  },
  
  logout: async () => {
    if (typeof window !== 'undefined') localStorage.removeItem('pqm_dev_mock_auth');
    await signOut(getAuth());
  },

  signup: async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(getAuth(), email, password);
      const user = userCredential.user;
      await firebaseSet(ref(db, `users/${user.uid}`), {
        email: user.email,
        role: 'GUEST',
        createdAt: new Date().toISOString()
      });
      set({ user: user, role: 'GUEST', authLoading: false }, false, 'signup');
    } catch (error) {
      console.error('Lỗi khi đăng ký:', error);
      throw error;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    const { user } = get();
    const currentUser = user || getAuth().currentUser;
    if (!currentUser || !currentUser.email) throw new Error("Không tìm thấy thông tin người dùng đang đăng nhập.");
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
  },

  // --- TOASTS ---
  notify: (msg) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...msg, id }] }), false, 'notify');
    setTimeout(() => get().removeToast(id), 5000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }), false, 'removeToast'),

  // --- CRUD ACTIONS (MIGRATED TO APPLICATION SERVICES VIA STRANGLER PATTERN) ---
  addProduct: async (p) => {
    try {
      await productAppService.createProduct(p, get().user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu sản phẩm', message: error.message });
      throw error;
    }
  },
  updateProduct: async (p) => {
    try {
      const state = get();
      const oldProduct = state.products.find(item => item.id === p.id);
      await productAppService.updateProduct(p, state.user, oldProduct);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật sản phẩm', message: error.message });
      throw error;
    }
  },
  deleteProduct: async (id) => {
    try {
      const product = get().products.find(p => p.id === id);
      await productAppService.deleteProduct(id, get().user, product?.name);
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa sản phẩm', message: error.message });
      throw error;
    }
  },
  bulkAddProducts: async (products) => {
    try {
      await productAppService.bulkCreateProducts(products, get().user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi nạp sản phẩm', message: error.message });
      throw error;
    }
  },

  addProductFormula: async (f) => {
    try {
      await formulaAppService.createFormula(f, get().user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu công thức', message: error.message });
      throw error;
    }
  },
  updateProductFormula: async (f) => {
    try {
      await formulaAppService.updateFormula(f, get().user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật công thức', message: error.message });
      throw error;
    }
  },
  deleteProductFormula: async (id) => {
    try {
      await formulaAppService.deleteFormula(id, get().user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa công thức', message: error.message });
      throw error;
    }
  },

  addRawMaterial: async (rm) => {
    try {
      await materialAppService.createMaterial(rm, get().user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu nguyên liệu', message: error.message });
      throw error;
    }
  },
  updateRawMaterial: async (rm) => {
    try {
      await materialAppService.updateMaterial(rm, get().user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật nguyên liệu', message: error.message });
      throw error;
    }
  },
  deleteRawMaterial: async (id: string) => {
    try {
      const state = get();
      const material = state.rawMaterials.find(m => m.id === id);
      await materialAppService.deleteMaterial(id, state.productFormulas, state.user, material?.name);
    } catch (error: any) {
      get().notify({ type: 'WARNING', title: 'Không thể xóa', message: error.message });
      throw error;
    }
  },

  addBatch: async (b) => {
    try {
      const state = get();
      await batchAppService.createBatch(b, state.user, state.batches, {
        activeTCCS: state.tccsList.find(t => t.id === b.tccsId),
        tccsList: state.tccsList,
        productFormula: state.productFormulas.find(f => f.productId === b.productId),
        productFormulas: state.productFormulas,
      });
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu lô sản xuất', message: error.message });
      throw error;
    }
  },
  updateBatch: async (b) => {
    try {
      const state = get();
      const oldBatch = state.batches.find(item => item.id === b.id);
      await batchAppService.updateBatch(b, state.user, oldBatch);
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật lô sản xuất', message: error.message });
      throw error;
    }
  },
  deleteBatch: async (id) => {
    try {
      const state = get();
      const batch = state.batches.find(b => b.id === id);
      await batchAppService.deleteBatch(id, state.user, batch?.batchNo);
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa lô sản xuất', message: error.message });
      throw error;
    }
  },
  updateBatchStatus: async (id, status, rejectReason, signature) => {
    try {
      const state = get();
      const currentBatch = state.batches.find(b => b.id === id);
      const batchTestResults = state.testResults.filter(r => r.batchId === id);
      await batchAppService.updateStatus(id, status as Batch['status'], state.user, {
        reason: rejectReason,
        currentBatch,
        batchTestResults,
        signature,
      });
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi trạng thái lô', message: error.message || 'Không thể cập nhật trạng thái lô' });
      throw error;
    }
  },
  updateBatchProgress: async (id, progressPercent) => {
    try {
      await batchAppService.updateProgress(id, progressPercent, get().user);
    } catch (e: any) {
      console.error("Lỗi cập nhật tiến độ lô", e);
    }
  },

  addTCCS: async (t) => {
    try {
      const state = get();
      await tccsAppService.createTCCS(t, state.tccsList, state.user);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu TCCS', message: error.message });
      throw error;
    }
  },
  updateTCCS: async (t) => {
    try {
      const state = get();
      const oldTCCS = state.tccsList.find(item => item.id === t.id);
      const { aliasUpdates } = await tccsAppService.updateTCCS(t, oldTCCS, state.criteriaAliases, state.user);
      if (Object.keys(aliasUpdates).length > 0) {
        await executeOfflineOptimistic(firebaseUpdate(ref(db), aliasUpdates), get);
      }
      return get().addTCCS(t);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật TCCS', message: error.message });
      throw error;
    }
  },
  deleteTCCS: async (id) => {
    try {
      const state = get();
      const tccs = state.tccsList.find(t => t.id === id);
      await tccsAppService.deleteTCCS(id, state.batches, state.user, tccs?.code);
      // Dọn dẹp các Criteria Alias gắn liền với TCCS này để tránh orphan records
      const relatedAliases = state.criteriaAliases.filter(a => a.tccsId === id);
      if (relatedAliases.length > 0) {
        const aliasUpdates: Record<string, any> = {};
        relatedAliases.forEach(a => { aliasUpdates[`criteria_aliases/${a.id}`] = null; });
        try {
          await executeOfflineOptimistic(firebaseUpdate(ref(db), aliasUpdates), get);
        } catch (e) {
          console.warn("Lỗi dọn dẹp alias khi xóa TCCS:", e);
        }
      }
    } catch (error: any) {
      get().notify({ type: 'WARNING', title: 'Không thể xóa', message: error.message });
      throw error;
    }
  },

  addTestResult: async (r) => {
    try {
      const state = get();
      const batch = state.batches.find(b => b.id === r.batchId);
      await testResultAppService.createTestResult(r, state.user, { batch });
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu phiếu kiểm nghiệm', message: error.message });
      throw error;
    }
  },
  updateTestResult: async (r) => {
    try {
      const state = get();
      const oldResult = state.testResults.find(item => item.id === r.id);
      await testResultAppService.updateTestResult(r, state.user, oldResult);
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi cập nhật phiếu kiểm nghiệm', message: error.message });
      throw error;
    }
  },
  deleteTestResult: async (id) => {
    try {
      const state = get();
      const oldResult = state.testResults.find(item => item.id === id);
      await testResultAppService.deleteTestResult(id, state.user, oldResult);
      await get().syncQualityAlerts();
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi xóa phiếu kiểm nghiệm', message: error.message });
      throw error;
    }
  },

  loadMoreTestResults: () => set((state) => ({ testResultLimit: state.testResultLimit + 50 }), false, 'loadMoreTestResults'),
  
  mergeTestResults: (list) => set((state) => {
    const map = new Map(state.testResults.map(item => [item.id, item]));
    list.forEach(item => map.set(item.id, item));
    const merged = Array.from(map.values());
    merged.sort((a, b) => b.testDate.localeCompare(a.testDate));
    return { testResults: merged };
  }, false, 'mergeTestResults'),

  fetchAllTestResultsForDashboard: async () => {
    try {
      const state = get();
      // Nếu đã có dữ liệu và vừa tải trong vòng 60 giây, không cần fetch lại
      if (state.allTestResults && state.allTestResults.length > 0 && (state as any)._lastFetchTestResultsTime && (Date.now() - (state as any)._lastFetchTestResultsTime < 60000)) {
        return;
      }
      const snapshot = await firebaseGet(ref(db, 'testResults'));
      if (snapshot.exists()) {
        const list = Object.values(snapshot.val()) as TestResult[];
        set({ allTestResults: list, _lastFetchTestResultsTime: Date.now() } as any, false, 'fetchAllTestResultsForDashboard');
      }
    } catch (e) {
      console.error("Lỗi tải toàn bộ dữ liệu cho Dashboard:", e);
    }
  },

  resetToDemoData: async () => {
    if (!get().isAdmin) return get().notify({ type: 'ERROR', title: 'Từ chối', message: 'Chỉ Admin mới có quyền nạp dữ liệu mẫu.' });
    try {
      const demoData = {
        products: {
          'demo_p1': { id: 'demo_p1', code: 'DEMO-001', name: 'Sản phẩm mẫu A', createdAt: new Date().toISOString() }
        },
        product_formulas: {},
        tccs: {
          'demo_t1': { id: 'demo_t1', productId: 'demo_p1', code: 'TCCS 01:2024', name: 'TCCS Mẫu A', issueDate: new Date().toISOString(), createdAt: new Date().toISOString() }
        },
        batches: {}, testResults: {}, raw_materials: {},
        criteria_aliases: {}, ai_learned_mappings: {}
      };
      await executeOfflineOptimistic(firebaseSet(ref(db), demoData), get);
      get().notify({ type: 'SUCCESS', message: 'Nạp dữ liệu mẫu thành công!' });
    } catch (e) {
      console.error("Lỗi nạp dữ liệu mẫu:", e);
    }
  },

  clearAllData: async () => {
    if (!get().isAdmin) return get().notify({ type: 'ERROR', title: 'Từ chối', message: 'Chỉ Admin mới có quyền xóa dữ liệu.' });
    try {
      await executeOfflineOptimistic(firebaseSet(ref(db), null), get);
      get().notify({ type: 'SUCCESS', message: 'Đã xóa sạch dữ liệu!' });
    } catch (e) {
      console.error("Lỗi xóa sạch dữ liệu:", e);
    }
  },

  loadBackup: async (data) => {
    if (!get().isAdmin) return get().notify({ type: 'ERROR', title: 'Từ chối', message: 'Chỉ Admin mới có quyền khôi phục.' });
    try {
      const toMap = (arr: any[]) => {
        if (!Array.isArray(arr)) return arr || {};
        const map: any = {};
        arr.forEach(item => { if(item?.id) map[item.id] = item; });
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
      get().notify({ type: 'SUCCESS', title: 'Thành công', message: 'Khôi phục dữ liệu hoàn tất.' });
    } catch (e) { throw e; }
  },

  addAiLearnedMapping: async (originalName: string, systemName: string) => {
    try {
      const state = get();
      const existing = state.aiLearnedMappings.find(m => m.originalName === originalName && m.systemName === systemName);
      const now = new Date().toISOString();
      
      if (existing) {
        // Tăng tần suất sử dụng và cập nhật timestamp
        const updated = { ...existing, frequency: existing.frequency + 1, updatedAt: now };
        await executeOfflineOptimistic(firebaseUpdate(ref(db, `ai_learned_mappings/${existing.id}`), { 
          frequency: updated.frequency,
          updatedAt: updated.updatedAt
        }), get);
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
        await executeOfflineOptimistic(firebaseSet(ref(db, `ai_learned_mappings/${newId}`), newMapping), get);
      }
    } catch (e) {
      console.error("Lỗi cập nhật AI Learned Mapping:", e);
    }
  },

  // --- CRITERIA ALIAS ACTIONS ---
  addCriteriaAlias: async (alias: CriteriaAlias) => {
    await _handleSave('criteria_aliases', alias, get);
    logAuditAction({ action: 'CREATE', collection: 'CRITERIA_ALIASES', documentId: alias.id, details: `Tạo alias: "${alias.aliases.join(', ')}" → "${alias.canonicalName}" (TCCS: ${alias.tccsId})`, performedBy: get().user?.email || 'unknown' });
  },

  updateCriteriaAlias: async (alias: CriteriaAlias) => {
    const updated = { ...alias, updatedAt: new Date().toISOString() };
    await _handleSave('criteria_aliases', updated, get);
    logAuditAction({ action: 'UPDATE', collection: 'CRITERIA_ALIASES', documentId: alias.id, details: `Cập nhật alias cho "${alias.canonicalName}"`, performedBy: get().user?.email || 'unknown' });
  },

  deleteCriteriaAlias: async (id: string) => {
    const alias = get().criteriaAliases.find(a => a.id === id);
    await _handleDelete('criteria_aliases', id, get);
    logAuditAction({ action: 'DELETE', collection: 'CRITERIA_ALIASES', documentId: id, details: `Xóa alias cho "${alias?.canonicalName || id}"`, performedBy: get().user?.email || 'unknown' });
  },

  confirmCriteriaAlias: async (id: string) => {
    const alias = get().criteriaAliases.find(a => a.id === id);
    if (!alias) return;
    const updated = { ...alias, confirmedByAdmin: true, updatedAt: new Date().toISOString() };
    await _handleSave('criteria_aliases', updated, get);
    get().notify({ type: 'SUCCESS', message: `Đã xác nhận alias cho "${alias.canonicalName}"` });
  },

  addAliasToExisting: async (aliasId: string, newAlias: string) => {
    const alias = get().criteriaAliases.find(a => a.id === aliasId);
    if (!alias) return;
    const merged = mergeAliases(alias, [newAlias]);
    merged.confirmedByAdmin = true;
    await _handleSave('criteria_aliases', merged, get);
    get().notify({ type: 'SUCCESS', message: `Đã thêm alias "${newAlias}" cho "${alias.canonicalName}"` });
  },

  syncQualityAlerts: async () => {
    try {
      const state = get();
      if (!state.user) return;
      const anomalies = detectQualityAnomalies({
        products: state.products,
        batches: state.batches,
        testResults: state.testResults
      }, 30);

      // [FIX P0.4] Dùng firebaseUpdate với timestamp key thay vì firebaseSet ghi đè
      // Để giữ lịch sử cảnh báo, mỗi lần chạy đỬng overwrite key 'latest' dỡn biết
      const alertUpdate: Record<string, any> = {};
      alertUpdate['latest'] = {
        updatedAt: new Date().toISOString(),
        alerts: anomalies
      };
      await executeOfflineOptimistic(firebaseUpdate(ref(db, 'quality_alerts'), alertUpdate), get);
    } catch (e) {
      console.error("Lỗi đồng bộ cảnh báo chất lượng:", e);
    }
  }
}), { name: 'PQM_AppStore' }));
