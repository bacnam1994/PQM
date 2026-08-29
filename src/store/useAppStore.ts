import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, SyncStatus, Product, Batch, TCCS, TestResult, ProductFormula, RawMaterial, AILearnedMapping, CriteriaAlias } from '../types';
import { ref, set as firebaseSet, remove as firebaseRemove, update as firebaseUpdate, get as firebaseGet } from 'firebase/database';
import { db } from '../firebase';
import { User, getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { parseNumberFromText } from '../utils';
import { logAuditAction } from '../services/auditService';
import { detectCriteriaChanges, normalizeName, mergeAliases, createAliasRecord } from '../services/criteriaAliasService';
import { deleteProductService, deleteBatchService, deleteTestResultService } from '../services/databaseService';
import { detectQualityAnomalies } from '../services/reportService';

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
  role: 'ADMIN' | 'USER' | 'GUEST' | null;
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
  setRole: (role: 'ADMIN' | 'USER' | 'GUEST' | null) => void;
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
  updateBatchStatus: (id: string, status: string, rejectReason?: string) => Promise<void>;
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
  user: null,
  isAdmin: false,
  role: null,
  authLoading: true,
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
    await signInWithEmailAndPassword(getAuth(), email, password);
  },

  resetPassword: async (email) => {
    await sendPasswordResetEmail(getAuth(), email);
  },
  
  logout: async () => {
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

  // --- CRUD ACTIONS ---
  addProduct: async (p) => {
    await _handleSave('products', p, get);
    logAuditAction({ action: 'CREATE', collection: 'PRODUCTS', documentId: p.id, details: `Tạo sản phẩm: ${p.name} (${p.code})`, performedBy: get().user?.email || 'unknown' });
  },
  updateProduct: async (p) => {
    await _handleSave('products', p, get);
    logAuditAction({ action: 'UPDATE', collection: 'PRODUCTS', documentId: p.id, details: `Cập nhật sản phẩm: ${p.name} (${p.code})`, performedBy: get().user?.email || 'unknown' });
  },
  deleteProduct: async (id) => {
    if (!get().isAdmin) {
      get().notify({ type: 'ERROR', title: 'Từ chối truy cập', message: 'Chỉ Quản trị viên mới có quyền xóa dữ liệu này.' });
      throw new Error("Permission denied");
    }
    const product = get().products.find(p => p.id === id);
    await executeOfflineOptimistic(deleteProductService(id), get);
    await get().syncQualityAlerts();
    logAuditAction({ action: 'DELETE', collection: 'PRODUCTS', documentId: id, details: `Xóa sản phẩm: ${product?.name || id}`, performedBy: get().user?.email || 'unknown' });
  },
  bulkAddProducts: async (products) => {
    try {
      const updates: Record<string, any> = {};
      products.forEach(p => { updates[`products/${p.id}`] = removeUndefined(p); });
      await executeOfflineOptimistic(firebaseUpdate(ref(db), updates), get);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi', message: error.message });
      throw error;
    }
  },

  addProductFormula: (f) => _handleSave('product_formulas', processFormulaBeforeSave(f), get),
  updateProductFormula: (f) => _handleSave('product_formulas', processFormulaBeforeSave(f), get),
  deleteProductFormula: (id) => _handleDelete('product_formulas', id, get),

  addRawMaterial: (rm) => _handleSave('raw_materials', rm, get),
  updateRawMaterial: (rm) => _handleSave('raw_materials', rm, get),
  deleteRawMaterial: async (id: string) => {
    const state = get();
    const material = state.rawMaterials.find(m => m.id === id);
    // Kiểm tra xem nguyên liệu có đang được dùng trong công thức sản phẩm nào không
    const isUsedInFormula = state.productFormulas.some(f => 
      (f.ingredients || []).some(ing => ing.materialId === id || (material && ing.name?.trim().toLowerCase() === material.name?.trim().toLowerCase())) ||
      (f.excipients || []).some(exc => exc.materialId === id || (material && exc.name?.trim().toLowerCase() === material.name?.trim().toLowerCase()))
    );
    if (isUsedInFormula) {
      get().notify({ type: 'WARNING', title: 'Không thể xóa', message: 'Nguyên liệu này đang được sử dụng trong Công thức sản phẩm. Vui lòng cập nhật công thức trước.' });
      throw new Error("Material is in use");
    }
    await _handleDelete('raw_materials', id, get);
  },

  addBatch: async (b) => {
    await _handleSave('batches', b, get);
    await get().syncQualityAlerts();
    logAuditAction({ action: 'CREATE', collection: 'BATCHES', documentId: b.id, details: `Tạo lô hàng: ${b.batchNo}`, performedBy: get().user?.email || 'unknown' });
  },
  updateBatch: async (b) => {
    await _handleSave('batches', b, get);
    await get().syncQualityAlerts();
    logAuditAction({ action: 'UPDATE', collection: 'BATCHES', documentId: b.id, details: `Cập nhật lô: ${b.batchNo} -> trạng thái: ${b.status}`, performedBy: get().user?.email || 'unknown' });
  },
  deleteBatch: async (id) => {
    if (!get().isAdmin) {
      get().notify({ type: 'ERROR', title: 'Từ chối truy cập', message: 'Chỉ Quản trị viên mới có quyền xóa dữ liệu này.' });
      throw new Error("Permission denied");
    }
    const batch = get().batches.find(b => b.id === id);
    await executeOfflineOptimistic(deleteBatchService(id), get);
    await get().syncQualityAlerts();
    logAuditAction({ action: 'DELETE', collection: 'BATCHES', documentId: id, details: `Xóa lô: ${batch?.batchNo || id}`, performedBy: get().user?.email || 'unknown' });
  },
  updateBatchStatus: async (id, status, rejectReason) => {
    try {
      const updates: any = { status, updatedAt: new Date().toISOString() };
      updates.rejectReason = status === 'REJECTED' ? (rejectReason || null) : null;
      await executeOfflineOptimistic(firebaseUpdate(ref(db, `batches/${id}`), updates), get);
      await get().syncQualityAlerts();
    } catch (e: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi', message: 'Không thể cập nhật trạng thái lô' });
    }
  },
  updateBatchProgress: async (id, progressPercent) => {
    try {
      await executeOfflineOptimistic(firebaseUpdate(ref(db, `batches/${id}`), { progressPercent }), get);
    } catch (e: any) {
      console.error("Lỗi cập nhật tiến độ lô", e);
    }
  },

  addTCCS: async (t) => {
    try {
      const state = get();
      const otherTCCS = state.tccsList.filter(item => item.productId === t.productId && item.id !== t.id);
      const allTCCS = [...otherTCCS, t].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
      if (allTCCS.length === 0) {
        // Guard: không có TCCS nào (rất hiếm) — lưu thẳng không cần lóc thứ tự
        await executeOfflineOptimistic(firebaseSet(ref(db, `tccs/${t.id}`), removeUndefined({ ...t, isActive: true })), get);
        return;
      }
      const latestId = allTCCS[0].id;
      const updates: Record<string, any> = {};
      
      allTCCS.forEach(item => {
        const shouldBeActive = item.id === latestId;
        if (item.id === t.id) {
          updates[`tccs/${item.id}`] = removeUndefined({ ...t, isActive: shouldBeActive });
        } else if (item.isActive !== shouldBeActive) {
          updates[`tccs/${item.id}/isActive`] = shouldBeActive;
        }
      });
      
      await executeOfflineOptimistic(firebaseUpdate(ref(db), updates), get);
    } catch (error: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi', message: error.message });
      throw error;
    }
  },
  updateTCCS: async (t) => {
    // 1. Phát hiện thay đổi tên chỉ tiêu so với TCCS cũ → tự động tạo alias
    try {
      const state = get();
      const oldTCCS = state.tccsList.find(item => item.id === t.id);
      if (oldTCCS) {
        const oldNames = [
          ...(oldTCCS.mainQualityCriteria || []),
          ...(oldTCCS.safetyCriteria || []),
        ].filter(c => c?.name).map(c => c.name);

        const newNames = [
          ...(t.mainQualityCriteria || []),
          ...(t.safetyCriteria || []),
        ].filter(c => c?.name).map(c => c.name);

        const changes = detectCriteriaChanges(oldNames, newNames);

        if (changes.length > 0) {
          const aliasUpdates: Record<string, any> = {};
          const existingAliases = state.criteriaAliases;
          let autoConfirmCount = 0;

          for (const change of changes) {
            // Tìm alias record đã có cho tên mới này
            const existing = existingAliases.find(
              a => a.tccsId === t.id && normalizeName(a.canonicalName) === normalizeName(change.newName)
            );

            if (existing) {
              // Merge alias cũ vào record đã có
              const merged = mergeAliases(existing, [change.oldName]);
              if (change.autoConfirm) merged.confirmedByAdmin = true;
              aliasUpdates[`criteria_aliases/${existing.id}`] = removeUndefined(merged);
            } else {
              // Tạo alias record mới
              const newId = `ca_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const newAlias: CriteriaAlias = {
                id: newId,
                ...createAliasRecord(t.id, change.newName, [change.oldName], true, change.autoConfirm),
              };
              aliasUpdates[`criteria_aliases/${newId}`] = removeUndefined(newAlias);
            }
            if (change.autoConfirm) autoConfirmCount++;
          }

          if (Object.keys(aliasUpdates).length > 0) {
            await executeOfflineOptimistic(firebaseUpdate(ref(db), aliasUpdates), get);
            const pendingCount = changes.length - autoConfirmCount;
            get().notify({
              type: 'INFO',
              title: '🔗 Alias tự động tạo',
              message: `Phát hiện ${changes.length} chỉ tiêu đổi tên. Đã tạo ${autoConfirmCount} alias tự động${
                pendingCount > 0 ? `, ${pendingCount} cần Admin xác nhận.` : '.'
              }`,
            });
          }
        }
      }
    } catch (aliasError) {
      console.warn('Lỗi khi phát hiện alias TCCS (không ảnh hưởng đến việc lưu TCCS):', aliasError);
    }

    // 2. Lưu TCCS bình thường
    return get().addTCCS(t);
  },
  deleteTCCS: async (id) => {
    const isUsed = get().batches.some(b => b.tccsId === id);
    if (isUsed) {
      get().notify({ type: 'WARNING', title: 'Không thể xóa', message: 'TCCS này đang được sử dụng bởi các Lô hàng. Vui lòng xóa Lô trước.' });
      throw new Error("TCCS is in use");
    }
    // Dọn dẹp các Criteria Alias gắn liền với TCCS này để tránh orphan records
    const state = get();
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
    await _handleDelete('tccs', id, get, true);
  },

  addTestResult: async (r) => {
    await _handleSave('testResults', r, get);
    await get().syncQualityAlerts();
    logAuditAction({ action: 'CREATE', collection: 'TEST_RESULTS', documentId: r.id, details: `Thêm phiếu KN: Lô ${r.batchId}, Lab: ${r.labName}, Kết quả: ${r.overallStatus}`, performedBy: get().user?.email || 'unknown' });
  },
  updateTestResult: async (r) => {
    await _handleSave('testResults', r, get);
    await get().syncQualityAlerts();
    logAuditAction({ action: 'UPDATE', collection: 'TEST_RESULTS', documentId: r.id, details: `Cập nhật phiếu KN: ${r.id}, Kết quả: ${r.overallStatus}`, performedBy: get().user?.email || 'unknown' });
  },
  deleteTestResult: async (id) => {
    await executeOfflineOptimistic(deleteTestResultService(id), get);
    await get().syncQualityAlerts();
    logAuditAction({ action: 'DELETE', collection: 'TEST_RESULTS', documentId: id, details: `Xóa phiếu KN: ${id}`, performedBy: get().user?.email || 'unknown' });
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
