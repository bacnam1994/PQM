import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, SyncStatus, Product, Batch, TCCS, TestResult, ProductFormula, RawMaterial, InventoryIn, InventoryOut } from '../types';
import { ref, set as firebaseSet, remove as firebaseRemove, update as firebaseUpdate, get as firebaseGet } from 'firebase/database';
import { db } from '../firebase';
import { User, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { parseNumberFromText } from '../utils';

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

const executeOfflineOptimistic = async (task: Promise<any>, get: any) => {
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
    if (e.message === 'TIMEOUT_OFFLINE') {
      get().setSyncStatus('OFFLINE');
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
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      result[key] = removeUndefined(obj[key]);
    }
  }
  return result;
};

const _handleSave = async (path: string, item: any, get: any) => {
  if (!item || !item.id) throw new Error("Dữ liệu không hợp lệ (Thiếu ID)");
  try {
    const cleanItem = removeUndefined(item);
    await executeOfflineOptimistic(firebaseSet(ref(db, `${path}/${item.id}`), cleanItem), get);
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
    await executeOfflineOptimistic(firebaseRemove(ref(db, `${path}/${id}`)), get);
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

// Helper chuẩn hóa công thức trước khi lưu
const processFormulaBeforeSave = (formula: ProductFormula): ProductFormula => {
  const processed = { ...formula };
  if (processed.ingredients) {
    processed.ingredients = processed.ingredients.map(ing => {
      const newIng = { ...ing } as any;
      if (typeof newIng.declaredContent === 'string') newIng.declaredContent = parseNumberFromText(newIng.declaredContent);
      if (typeof newIng.elementalContent === 'string') newIng.elementalContent = parseNumberFromText(newIng.elementalContent);
      else if (!newIng.elementalContent) delete newIng.elementalContent;
      return newIng;
    });
  }
  if (processed.excipients) {
    processed.excipients = processed.excipients.map(exc => {
      const newExc = { ...exc } as any;
      if (typeof newExc.declaredContent === 'string') newExc.declaredContent = parseNumberFromText(newExc.declaredContent);
      if (typeof newExc.elementalContent === 'string') newExc.elementalContent = parseNumberFromText(newExc.elementalContent);
      else if (!newExc.elementalContent) delete newExc.elementalContent;
      return newExc;
    });
  }
  return processed;
};

interface AppStoreState extends AppState {
  syncStatus: SyncStatus;
  user: User | null;
  isAdmin: boolean;
  role: 'ADMIN' | 'USER' | null;
  authLoading: boolean;
  toasts: ToastMessage[];
  stockMap: Map<string, { in: number; out: number; balance: number }>;
  testResultLimit: number;
}

interface AppStoreActions {
  // State Setters (Dành cho AppInitializer đẩy dữ liệu từ Firebase vào)
  setAppState: (partialState: Partial<AppState>) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setUser: (user: User | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setRole: (role: 'ADMIN' | 'USER' | null) => void;
  setAuthLoading: (loading: boolean) => void;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  
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

  addTCCS: (t: TCCS) => Promise<void>;
  updateTCCS: (t: TCCS) => Promise<void>;
  deleteTCCS: (id: string) => Promise<void>;

  addInventoryIn: (inv: InventoryIn) => Promise<void>;
  deleteInventoryIn: (id: string) => Promise<void>;
  addInventoryOut: (inv: InventoryOut) => Promise<void>;
  deleteInventoryOut: (id: string) => Promise<void>;

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
}

export const useAppStore = create<AppStoreState & AppStoreActions>()(devtools((set, get) => ({
  // --- INITIAL STATE ---
  products: [],
  batches: [],
  tccsList: [],
  productFormulas: [],
  rawMaterials: [],
  inventoryIn: [],
  inventoryOut: [],
  testResults: [],
  allTestResults: [],
  lastSync: null,
  syncStatus: 'IDLE',
  user: null,
  isAdmin: false,
  role: null,
  authLoading: true,
  toasts: [],
  stockMap: new Map(),
  testResultLimit: 50,
  navigate: () => console.warn('Hàm navigate chưa được khởi tạo!'),

  // --- SETTERS & DERIVED STATE ---
  setAppState: (partialState) => set((state) => {
    const newState = { ...state, ...partialState };
    
    // Tự động tính toán lại stockMap mỗi khi batches hoặc inventory thay đổi
    if (partialState.batches || partialState.inventoryIn || partialState.inventoryOut) {
      const map = new Map<string, { in: number; out: number; balance: number }>();
      (newState.batches || []).forEach(b => map.set(b.id, { in: 0, out: 0, balance: 0 }));
      
      (newState.inventoryIn || []).forEach(i => {
        const current = map.get(i.batchId) || { in: 0, out: 0, balance: 0 };
        map.set(i.batchId, { ...current, in: current.in + i.quantity, balance: current.balance + i.quantity });
      });
      (newState.inventoryOut || []).forEach(o => {
        const current = map.get(o.batchId) || { in: 0, out: 0, balance: 0 };
        map.set(o.batchId, { ...current, out: current.out + o.quantity, balance: current.balance - o.quantity });
      });
      newState.stockMap = map;
    }
    
    return newState;
  }, false, 'setAppState'),

  setSyncStatus: (status) => set({ syncStatus: status }, false, `setSyncStatus/${status}`),
  setUser: (user) => set({ user }, false, 'setUser'),
  setIsAdmin: (isAdmin) => set({ isAdmin }, false, 'setIsAdmin'),
  setRole: (role) => set({ role }, false, 'setRole'),
  setAuthLoading: (loading) => set({ authLoading: loading }, false, 'setAuthLoading'),

  login: async (email, password) => {
    await signInWithEmailAndPassword(getAuth(), email, password);
  },
  
  logout: async () => {
    await signOut(getAuth());
  },

  // --- TOASTS ---
  notify: (msg) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...msg, id }] }), false, 'notify');
    setTimeout(() => get().removeToast(id), 5000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }), false, 'removeToast'),

  // --- CRUD ACTIONS ---
  addProduct: (p) => _handleSave('products', p, get),
  updateProduct: (p) => _handleSave('products', p, get),
  deleteProduct: (id) => _handleDelete('products', id, get, true),
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
  deleteRawMaterial: (id) => _handleDelete('raw_materials', id, get),

  addBatch: (b) => _handleSave('batches', b, get),
  updateBatch: (b) => _handleSave('batches', b, get),
  deleteBatch: (id) => _handleDelete('batches', id, get, true),
  updateBatchStatus: async (id, status, rejectReason) => {
    try {
      const updates: any = { status, updatedAt: new Date().toISOString() };
      updates.rejectReason = status === 'REJECTED' ? (rejectReason || null) : null;
      await executeOfflineOptimistic(firebaseUpdate(ref(db, `batches/${id}`), updates), get);
    } catch (e: any) {
      get().notify({ type: 'ERROR', title: 'Lỗi', message: 'Không thể cập nhật trạng thái lô' });
    }
  },

  addTCCS: async (t) => {
    try {
      const state = get();
      const otherTCCS = state.tccsList.filter(item => item.productId === t.productId && item.id !== t.id);
      const allTCCS = [...otherTCCS, t].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
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
  updateTCCS: async (t) => get().addTCCS(t),
  deleteTCCS: async (id) => {
    const isUsed = get().batches.some(b => b.tccsId === id);
    if (isUsed) {
      get().notify({ type: 'WARNING', title: 'Không thể xóa', message: 'TCCS này đang được sử dụng bởi các Lô hàng. Vui lòng xóa Lô trước.' });
      throw new Error("TCCS is in use");
    }
    await _handleDelete('tccs', id, get, true);
  },

  addInventoryIn: (inv) => _handleSave('inventoryIn', inv, get),
  deleteInventoryIn: (id) => _handleDelete('inventoryIn', id, get),
  addInventoryOut: (inv) => _handleSave('inventoryOut', inv, get),
  deleteInventoryOut: (id) => _handleDelete('inventoryOut', id, get),

  addTestResult: (r) => _handleSave('testResults', r, get),
  updateTestResult: (r) => _handleSave('testResults', r, get),
  deleteTestResult: (id) => _handleDelete('testResults', id, get),

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
      const snapshot = await firebaseGet(ref(db, 'testResults'));
      if (snapshot.exists()) {
        const list = Object.values(snapshot.val()) as TestResult[];
        set({ allTestResults: list }, false, 'fetchAllTestResultsForDashboard');
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
      batches: {}, testResults: {}, inventoryIn: {}, inventoryOut: {}, raw_materials: {}
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
        products: toMap(data.products), batches: toMap(data.batches), product_formulas: toMap(data.productFormulas),
        tccs: toMap(data.tccsList), testResults: toMap(data.testResults), 
        inventoryIn: toMap(data.inventoryIn), inventoryOut: toMap(data.inventoryOut), raw_materials: toMap(data.rawMaterials)
      };
      await executeOfflineOptimistic(firebaseSet(ref(db), restoreData), get);
      get().notify({ type: 'SUCCESS', title: 'Thành công', message: 'Khôi phục dữ liệu hoàn tất.' });
    } catch (e) { throw e; }
  }
}), { name: 'PQM_AppStore' }));
