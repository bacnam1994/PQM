import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ref, onValue, set, remove, update, query, get, orderByChild, equalTo, goOnline } from 'firebase/database';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, X, Info, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import {
  AppState, Batch, Product, TCCS, TestResult, ProductFormula,
  InventoryIn, InventoryOut, SyncStatus, RawMaterial
} from '../types';
import { parseNumberFromText } from '../utils/criteriaEvaluation';
import { evaluateBatchStatus } from '../utils/batchEvaluation';
import { BATCH_STATUS } from '../utils/constants';
import { findTCCSByMfgDate } from '../utils/tccsUtils';
import { debug } from '../utils/debug';

export type ToastType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface AppContextType {
  state: AppState;
  syncStatus: SyncStatus;
  stockMap: Map<string, { in: number; out: number; balance: number }>;
  user: User | null;
  isAdmin: boolean;
  notify: (msg: Omit<ToastMessage, 'id'>) => void;
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
  
  resetToDemoData: () => void;
  clearAllData: () => void;
  loadBackup: (data: AppState) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

// --- TOAST NOTIFICATION COMPONENT ---
const ToastContainer = ({ toasts, removeToast }: { toasts: ToastMessage[], removeToast: (id: string) => void }) => {
  return (
    <div className="fixed top-4 right-4 z-[110] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map(t => {
        let bgClass = 'bg-white border-slate-100';
        let icon = <Info size={20} className="text-blue-500" />;
        
        switch (t.type) {
          case 'SUCCESS':
            bgClass = 'bg-emerald-50/90 border-emerald-100';
            icon = <CheckCircle2 size={20} className="text-emerald-600" />;
            break;
          case 'ERROR':
            bgClass = 'bg-red-50/90 border-red-100';
            icon = <AlertCircle size={20} className="text-red-600" />;
            break;
          case 'WARNING':
            bgClass = 'bg-amber-50/90 border-amber-100';
            icon = <AlertTriangle size={20} className="text-amber-600" />;
            break;
        }

        return (
          <div 
            key={t.id} 
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg shadow-slate-200/50 backdrop-blur-sm animate-in slide-in-from-right duration-300 ${bgClass}`}
          >
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              {t.title && <h4 className="text-sm font-bold text-slate-800 mb-0.5">{t.title}</h4>}
              <p className="text-xs font-medium text-slate-600 leading-relaxed">{t.message}</p>
            </div>
            <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

// Export SyncIndicator để có thể tái sử dụng ở TestResultContext hoặc Layout chính
export const SyncIndicator = ({ status }: { status: SyncStatus }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (status === 'IDLE') {
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [status]);

  let icon;
  let text;
  let colorClass;

  switch (status) {
    case 'SAVING':
      icon = <RefreshCw size={14} className="animate-spin" />;
      text = 'Đang lưu...';
      colorClass = 'bg-blue-50 text-blue-600 border-blue-100';
      break;
    case 'SAVED':
      icon = <CheckCircle2 size={14} />;
      text = 'Đã lưu';
      colorClass = 'bg-emerald-50 text-emerald-600 border-emerald-100';
      break;
    case 'ERROR':
      icon = <AlertCircle size={14} />;
      text = 'Lỗi đồng bộ';
      colorClass = 'bg-red-50 text-red-600 border-red-100';
      break;
    case 'OFFLINE':
      icon = <CloudOff size={14} />;
      text = 'Mất kết nối';
      colorClass = 'bg-slate-800 text-white border-slate-700 shadow-lg';
      break;
    case 'IDLE':
    default:
      icon = <Cloud size={14} />;
      text = 'Sẵn sàng';
      colorClass = 'bg-white/80 backdrop-blur text-slate-400 border-slate-200';
      break;
  }

  return (
    <div 
      onClick={() => (status === 'OFFLINE' || status === 'ERROR') && goOnline(db)}
      title={status === 'OFFLINE' ? "Bấm để kết nối lại" : ""}
      className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm text-[10px] font-bold uppercase tracking-wider transition-all duration-500 ${colorClass} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'} ${status === 'OFFLINE' ? 'cursor-pointer hover:bg-slate-700' : ''}`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    products: [],
    batches: [],
    tccsList: [],
    productFormulas: [],
    rawMaterials: [],
    testResults: [], // Giữ lại mảng rỗng để tránh lỗi type nếu AppState chưa cập nhật, nhưng không dùng logic ở đây nữa
    inventoryIn: [],
    inventoryOut: [],
    lastSync: null
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('IDLE');
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Helper: Loại bỏ undefined recursive (Nhanh hơn JSON.parse(JSON.stringify))
  const removeUndefined = (obj: any): any => {
    if (typeof obj === 'number' && Number.isNaN(obj)) return null; // Firebase không chấp nhận NaN -> convert sang null
    if (Array.isArray(obj)) return obj.map(removeUndefined);
    if (obj !== null && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = removeUndefined(value);
        return acc;
      }, {} as any);
    }
    return obj;
  };

  // --- TOAST LOGIC ---
  const notify = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...msg, id }]);
    // Auto dismiss
    setTimeout(() => removeToast(id), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // 0. Lắng nghe trạng thái đăng nhập & Quyền Admin
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const adminRef = ref(db, `users/admins/${currentUser.uid}`);
          const snapshot = await get(adminRef);
          setIsAdmin(snapshot.exists());
        } catch (e) {
          debug.error("Lỗi kiểm tra quyền Admin:", e);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 1. Lắng nghe dữ liệu từ Firebase Realtime Database
  useEffect(() => {
    const refs = {
      products: ref(db, 'products'),
      batches: ref(db, 'batches'),
      tccsList: ref(db, 'tccs'),
      productFormulas: ref(db, 'product_formulas'),
      rawMaterials: ref(db, 'raw_materials'),
      inventoryIn: ref(db, 'inventoryIn'),
      inventoryOut: ref(db, 'inventoryOut')
    };

    const unsubscribes: (() => void)[] = [];

    Object.entries(refs).forEach(([key, reference]) => {
      const unsubscribe = onValue(reference, (snapshot) => {
        const data = snapshot.val();
        const list = data ? Object.values(data) : [];
        setState(prev => ({ ...prev, [key]: list, lastSync: new Date().toISOString() }));
      }, (error) => {
        debug.error(`Lỗi tải ${key}:`, error);
        // Không set ERROR global để tránh chặn UI khi mạng chập chờn
        // setSyncStatus('ERROR'); 
      });
      unsubscribes.push(unsubscribe);
    });

    // --- BỔ SUNG: Lắng nghe trạng thái mạng trình duyệt để phản hồi nhanh hơn ---
    const handleOnline = () => {
      // Khi trình duyệt báo có mạng, ép Firebase kết nối lại ngay lập tức thay vì chờ timeout
      goOnline(db);
    };
    const handleOffline = () => {
      setSyncStatus('OFFLINE');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Theo dõi trạng thái kết nối để tự động phục hồi lỗi
    const connectedRef = ref(db, '.info/connected');
    const unsubConnected = onValue(connectedRef, (snap) => {
      const isConnected = snap.val() === true;
      if (isConnected) {
        // Khi kết nối lại, chuyển trạng thái từ LỖI hoặc MẤT KẾT NỐI về BÌNH THƯỜNG.
        // SDK tự động đồng bộ lại dữ liệu, đây chỉ là cập nhật trạng thái cho UI.
        setSyncStatus(prev => (prev === 'ERROR' || prev === 'OFFLINE') ? 'IDLE' : prev);
      } else {
        // Khi mất kết nối, cập nhật trạng thái để UI có thể hiển thị thông báo.
        setSyncStatus('OFFLINE');
      }
    });
    unsubscribes.push(unsubConnected);

    return () => {
      unsubscribes.forEach(fn => fn());
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Tính toán tồn kho (Stock Map)
  const stockMap = useMemo(() => {
    const map = new Map<string, { in: number; out: number; balance: number }>();
    state.batches.forEach(b => {
      if (b && b.id) map.set(b.id, { in: 0, out: 0, balance: 0 });
    });

    state.inventoryIn.forEach(i => {
      const current = map.get(i.batchId) || { in: 0, out: 0, balance: 0 };
      map.set(i.batchId, { ...current, in: current.in + i.quantity, balance: current.balance + i.quantity });
    });

    state.inventoryOut.forEach(o => {
      const current = map.get(o.batchId) || { in: 0, out: 0, balance: 0 };
      map.set(o.batchId, { ...current, out: current.out + o.quantity, balance: current.balance - o.quantity });
    });

    return map;
  }, [state.batches, state.inventoryIn, state.inventoryOut]);

  // 3. Helper Functions
  const handleSave = async (path: string, item: any) => {
    if (!item || !item.id) {
      debug.error(`Lỗi dữ liệu: Không thể lưu vào ${path} vì thiếu ID hoặc dữ liệu rỗng.`, item);
      setSyncStatus('ERROR');
      throw new Error("Dữ liệu không hợp lệ (Thiếu ID)");
    }
    
    if (typeof item.id !== 'string' && typeof item.id !== 'number') {
      debug.error(`Lỗi dữ liệu: ID không hợp lệ (${typeof item.id})`, item);
      setSyncStatus('ERROR');
      throw new Error("ID dữ liệu không hợp lệ");
    }

    setSyncStatus('SAVING');
    try {
      // Firebase không chấp nhận giá trị undefined, cần làm sạch dữ liệu trước khi lưu
      // OPTIMIZE: Dùng hàm removeUndefined thay vì JSON clone để tối ưu hiệu năng
      const cleanItem = removeUndefined(item);

      // Kiểm tra an toàn: Nếu dữ liệu sau khi làm sạch chỉ còn mỗi ID (các trường khác bị undefined hết), cảnh báo
      if (Object.keys(cleanItem).length <= 1) {
        debug.warn(`Cảnh báo: Dữ liệu lưu vào ${path} có thể bị thiếu thông tin quan trọng (do undefined).`, cleanItem);
      }

      const dbRef = ref(db, `${path}/${item.id}`);
      await set(dbRef, cleanItem);
      
      setSyncStatus('SAVED');
      // Tự động reset trạng thái về bình thường sau 2s
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e: any) {
      debug.error(`Lỗi thao tác dữ liệu (${path}):`, e);
      
      // Tạo thông báo lỗi chi tiết
      let errorMsg = `Lưu thất bại! (${path})\n\n`;
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        errorMsg += "Nguyên nhân: Dữ liệu không hợp lệ hoặc vi phạm quy tắc bảo mật.\n";
        errorMsg += "- Kiểm tra các trường bắt buộc (Mã, Tên...).\n";
        errorMsg += "- Đảm bảo dữ liệu liên kết tồn tại (VD: Sản phẩm của Lô hàng).\n";
        errorMsg += "- Kiểm tra quyền Admin của tài khoản.";
        notify({ type: 'ERROR', title: 'Lỗi phân quyền', message: errorMsg });
        setSyncStatus('IDLE'); // Reset trạng thái vì đây là lỗi logic/quyền, không phải lỗi mạng
      } else {
        notify({ type: 'ERROR', title: 'Lỗi lưu dữ liệu', message: errorMsg + `\nChi tiết: ${e.message}` });
        setSyncStatus('ERROR');
      }
      
      throw e;
    }
  };

  const handleDelete = async (path: string, id: string) => {
    if (!id) {
      debug.error(`Lỗi xóa dữ liệu: ID không hợp lệ (${path})`);
      setSyncStatus('ERROR');
      throw new Error("ID không hợp lệ");
    }
    setSyncStatus('SAVING');
    try {
      await remove(ref(db, `${path}/${id}`));

      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e: any) {
      debug.error(`Lỗi xóa dữ liệu (${path}/${id}):`, e);
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        notify({ type: 'ERROR', title: 'Xóa thất bại', message: 'Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ Admin.' });
        setSyncStatus('IDLE');
      } else {
        setSyncStatus('ERROR');
      }
      throw e;
    }
  };

  // --- Products ---
  const addProduct = async (p: Product) => handleSave('products', p);
  const updateProduct = async (p: Product) => handleSave('products', p);
  const deleteProduct = async (id: string) => {
    if (!id) {
      debug.error("Lỗi xóa sản phẩm: ID không hợp lệ");
      setSyncStatus('ERROR');
      throw new Error("ID không hợp lệ");
    }
    setSyncStatus('SAVING');
    try {
      const updates: Record<string, any> = {};

      // 1. Xóa sản phẩm
      updates[`products/${id}`] = null;

      // 2. Xóa TCCS liên quan
      const tccsQuery = query(ref(db, 'tccs'), orderByChild('productId'), equalTo(id));
      const tccsSnap = await get(tccsQuery);
      if (tccsSnap.exists()) {
        Object.keys(tccsSnap.val()).forEach(k => updates[`tccs/${k}`] = null);
      }

      // 3. Xóa các lô liên quan và dữ liệu con
      const batchesQuery = query(ref(db, 'batches'), orderByChild('productId'), equalTo(id));
      const batchesSnap = await get(batchesQuery);
      
      if (batchesSnap.exists()) {
        const batches = batchesSnap.val();
        await Promise.all(Object.keys(batches).map(async (bid) => {
          updates[`batches/${bid}`] = null;
          
          const trQuery = query(ref(db, 'testResults'), orderByChild('batchId'), equalTo(bid));
          const trSnap = await get(trQuery);
          if (trSnap.exists()) Object.keys(trSnap.val()).forEach(k => updates[`testResults/${k}`] = null);

          const inQuery = query(ref(db, 'inventoryIn'), orderByChild('batchId'), equalTo(bid));
          const inSnap = await get(inQuery);
          if (inSnap.exists()) Object.keys(inSnap.val()).forEach(k => updates[`inventoryIn/${k}`] = null);

          const outQuery = query(ref(db, 'inventoryOut'), orderByChild('batchId'), equalTo(bid));
          const outSnap = await get(outQuery);
          if (outSnap.exists()) Object.keys(outSnap.val()).forEach(k => updates[`inventoryOut/${k}`] = null);
        }));
      }

      // Thực hiện update atomic (tất cả hoặc không gì cả)
      await update(ref(db), updates);

      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e: any) {
      debug.error("Lỗi xóa sản phẩm:", e);
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        notify({ type: 'ERROR', title: 'Xóa thất bại', message: 'Bạn không có quyền xóa sản phẩm này.' });
        setSyncStatus('IDLE');
      } else {
        setSyncStatus('ERROR');
      }
      throw e;
    }
  };
  const bulkAddProducts = async (products: Product[]) => {
    setSyncStatus('SAVING');
    try {
      const updates: Record<string, any> = {};
      products.forEach(p => {
        updates[`products/${p.id}`] = p;
      });
      await update(ref(db), updates);
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e) {
      setSyncStatus('ERROR');
      throw e;
    }
  };

  // --- Product Formulas ---
  const processFormulaBeforeSave = (formula: ProductFormula): ProductFormula => {
    const processedFormula = { ...formula };
    // Kiểm tra và xử lý hàm lượng của các thành phần
    if (processedFormula.ingredients && Array.isArray(processedFormula.ingredients)) {
      processedFormula.ingredients = processedFormula.ingredients.map(ing => { 
        const newIng = { ...ing } as any;
        // Nếu hàm lượng là chuỗi, chuyển đổi nó thành số, hỗ trợ số mũ
        if (ing.declaredContent && typeof ing.declaredContent === 'string') {
          newIng.declaredContent = parseNumberFromText(ing.declaredContent);
        }
        if (ing.elementalContent && typeof ing.elementalContent === 'string') {
          newIng.elementalContent = parseNumberFromText(ing.elementalContent);
        } else if (!ing.elementalContent) {
          delete newIng.elementalContent;
        }
        if ((ing as any).materialId) {
          newIng.materialId = (ing as any).materialId;
        }
        return newIng;
      });
    }

    // Xử lý tương tự cho phụ liệu (excipients)
    if (processedFormula.excipients && Array.isArray(processedFormula.excipients)) {
      processedFormula.excipients = processedFormula.excipients.map(exc => {
        const newExc = { ...exc } as any;
        if (exc.declaredContent && typeof exc.declaredContent === 'string') {
          newExc.declaredContent = parseNumberFromText(exc.declaredContent);
        }
        if (exc.elementalContent && typeof exc.elementalContent === 'string') {
          newExc.elementalContent = parseNumberFromText(exc.elementalContent);
        } else if (!exc.elementalContent) {
          delete newExc.elementalContent;
        }
        if ((exc as any).materialId) {
          newExc.materialId = (exc as any).materialId;
        }
        return newExc;
      });
    }
    return processedFormula;
  };

  const addProductFormula = async (f: ProductFormula) => {
    return handleSave('product_formulas', processFormulaBeforeSave(f));
  };
  const updateProductFormula = async (f: ProductFormula) => {
    return handleSave('product_formulas', processFormulaBeforeSave(f));
  };
  const deleteProductFormula = async (id: string) => handleDelete('product_formulas', id);

  // --- Raw Materials ---
  const addRawMaterial = async (rm: RawMaterial) => handleSave('raw_materials', rm);
  const updateRawMaterial = async (rm: RawMaterial) => handleSave('raw_materials', rm);
  const deleteRawMaterial = async (id: string) => handleDelete('raw_materials', id);

  // --- Batches ---
  const addBatch = async (b: Batch) => handleSave('batches', b);
  const updateBatch = async (b: Batch) => handleSave('batches', b);
  const deleteBatch = async (id: string) => {
    if (!id) {
      debug.error("Lỗi xóa lô: ID không hợp lệ");
      setSyncStatus('ERROR');
      throw new Error("ID không hợp lệ");
    }
    setSyncStatus('SAVING');
    try {
      const updates: Record<string, any> = {};
      updates[`batches/${id}`] = null;
      
      // Bọc các truy vấn liên quan trong try-catch để đảm bảo xóa lô vẫn chạy dù query phụ lỗi
      try {
        const trQuery = query(ref(db, 'testResults'), orderByChild('batchId'), equalTo(id));
        const trSnap = await get(trQuery);
        if (trSnap.exists()) Object.keys(trSnap.val()).forEach(k => updates[`testResults/${k}`] = null);
        
        const inQuery = query(ref(db, 'inventoryIn'), orderByChild('batchId'), equalTo(id));
        const inSnap = await get(inQuery);
        if (inSnap.exists()) Object.keys(inSnap.val()).forEach(k => updates[`inventoryIn/${k}`] = null);

        const outQuery = query(ref(db, 'inventoryOut'), orderByChild('batchId'), equalTo(id));
        const outSnap = await get(outQuery);
        if (outSnap.exists()) Object.keys(outSnap.val()).forEach(k => updates[`inventoryOut/${k}`] = null);
      } catch (queryError) {
        debug.warn("Lỗi khi tìm dữ liệu liên quan của lô (có thể do thiếu Index), vẫn tiếp tục xóa lô:", queryError);
      }

      await update(ref(db), updates);

      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e: any) {
      debug.error("Lỗi xóa lô:", e);
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        notify({ type: 'ERROR', title: 'Xóa thất bại', message: 'Bạn không có quyền xóa lô hàng này.' });
        setSyncStatus('IDLE');
      } else {
        setSyncStatus('ERROR');
      }
      throw e;
    }
  };
  const updateBatchStatus = async (id: string, status: string, rejectReason?: string) => {
    try {
      const updates: Record<string, any> = { status, updatedAt: new Date().toISOString() };
      if (status === 'REJECTED') {
        updates.rejectReason = rejectReason || null;
      } else {
        updates.rejectReason = null; // Xóa lý do nếu chuyển sang trạng thái khác
      }
      await update(ref(db, `batches/${id}`), updates);
    } catch (e: any) {
      debug.error("Lỗi cập nhật trạng thái lô:", e);
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        notify({ type: 'ERROR', title: 'Cập nhật thất bại', message: 'Bạn không có quyền thay đổi trạng thái lô.' });
      }
    }
  };

  // --- TCCS ---
  const saveTCCSWithActiveCheck = async (t: TCCS) => {
    // Logic: Đảm bảo chỉ có TCCS mới nhất (theo ngày ban hành) là isActive = true
    const otherTCCS = state.tccsList.filter(item => item.productId === t.productId && item.id !== t.id);
    const allTCCS = [...otherTCCS, t];
    
    // Sắp xếp giảm dần theo ngày ban hành
    allTCCS.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    
    // Phần tử đầu tiên là mới nhất -> Active
    const latestId = allTCCS[0].id;

    const updates: Record<string, any> = {};
    
    allTCCS.forEach(item => {
      const shouldBeActive = item.id === latestId;
      
      if (item.id === t.id) {
        // Item đang được lưu (Add/Update)
        const newItem = { ...t, isActive: shouldBeActive };
        updates[`tccs/${item.id}`] = removeUndefined(newItem);
      } else {
        // Item khác trong DB - chỉ update nếu trạng thái thay đổi
        if (item.isActive !== shouldBeActive) {
          updates[`tccs/${item.id}/isActive`] = shouldBeActive;
        }
      }
    });

    setSyncStatus('SAVING');
    try {
      // Lưu TCCS trước
      await update(ref(db), updates);
      
      // === TỰ ĐỘNG CẬP NHẬT TRẠNG THÁI LÔ KHI TCCS THAY ĐỔI ===
      // Sau khi lưu TCCS thành công, tìm tất cả các lô đang sử dụng TCCS này
      // và tính toán lại trạng thái dựa trên kết quả kiểm nghiệm hiện có
      const tccsId = t.id;
      
      // Lấy tất cả các lô sử dụng TCCS này từ state
      const affectedBatches = state.batches.filter(b => b.tccsId === tccsId);
      
      if (affectedBatches.length > 0) {
        debug.log(`[TCCS Update] Tìm thấy ${affectedBatches.length} lô đang sử dụng TCCS ${tccsId}. Đang tính toán lại trạng thái...`);
        
        // Query testResults từ Firebase để lấy dữ liệu mới nhất
        const testResultsRef = ref(db, 'testResults');
        const testResultsSnap = await get(testResultsRef);
        const allTestResults = testResultsSnap.exists() ? Object.values(testResultsSnap.val()) as TestResult[] : [];
        
        for (const batch of affectedBatches) {
          // Lọc kết quả kiểm nghiệm của lô này
          const batchTestResults = allTestResults.filter(tr => tr.batchId === batch.id);
          
          // Chỉ re-evaluate nếu lô có kết quả kiểm nghiệm
          if (batchTestResults.length > 0) {
            // Tính toán trạng thái mới với TCCS đã cập nhật
            const evaluation = evaluateBatchStatus(batch, batchTestResults, t);
            const newStatus = evaluation.suggestedStatus;
            
            // Chỉ cập nhật nếu trạng thái thay đổi
            if (newStatus !== batch.status) {
              debug.log(`[TCCS Update] Lô ${batch.batchNo}: ${batch.status} -> ${newStatus}. Lý do: ${evaluation.reason}`);
              updates[`batches/${batch.id}/status`] = newStatus;
              updates[`batches/${batch.id}/updatedAt`] = new Date().toISOString();
            }
          }
        }
        
        // Thực hiện batch update nếu có thay đổi trạng thái
        const batchStatusUpdates = Object.keys(updates).filter(k => k.startsWith('batches/'));
        if (batchStatusUpdates.length > 0) {
          await update(ref(db), updates);
          notify({ 
            type: 'INFO', 
            title: 'Cập nhật tự động', 
            message: `Đã tính toán lại trạng thái cho ${batchStatusUpdates.length} lô hàng dựa trên TCCS mới.` 
          });
        }
      }
      
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e: any) {
      debug.error("Lỗi lưu TCCS:", e);
      let errorMsg = `Lưu thất bại! (tccs)\n\n`;
      if (e.message && (e.message.toLowerCase().includes("permission denied") || e.code === "PERMISSION_DENIED")) {
        notify({ type: 'ERROR', title: 'Lỗi phân quyền', message: errorMsg + "Bạn không có quyền thực hiện thao tác này." });
        setSyncStatus('IDLE');
      } else {
        notify({ type: 'ERROR', title: 'Lỗi lưu dữ liệu', message: errorMsg + `Chi tiết: ${e.message}` });
        setSyncStatus('ERROR');
      }
      throw e;
    }
  };

  const addTCCS = async (t: TCCS) => saveTCCSWithActiveCheck(t);
  const updateTCCS = async (t: TCCS) => saveTCCSWithActiveCheck(t);
  const deleteTCCS = async (id: string) => {
    if (!id) {
      debug.error("Lỗi xóa TCCS: ID không hợp lệ");
      setSyncStatus('ERROR');
      throw new Error("ID không hợp lệ");
    }
    setSyncStatus('SAVING');
    try {
      const batchesQuery = query(ref(db, 'batches'), orderByChild('tccsId'), equalTo(id));
      const batchesSnap = await get(batchesQuery);
      if (batchesSnap.exists()) {
        const batches = batchesSnap.val();
        // Lấy danh sách mã lô hàng (code) hoặc ID để hiển thị trong thông báo lỗi
        const batchCodes = Object.values(batches).map((b: any) => b.batchNo || b.code || b.id).join(', ');
        const msg = `Không thể xóa! TCCS đang được sử dụng bởi các lô: ${batchCodes}.\nVui lòng xóa các lô hàng này trước.`;
        
        debug.warn(msg);
        // Hiển thị thông báo ngay lập tức cho người dùng
        notify({ type: 'WARNING', title: 'Không thể xóa', message: msg });
        
        setSyncStatus('IDLE');
        throw new Error(msg);
      }
      await handleDelete('tccs', id);
    } catch (e: any) {
      debug.error("Lỗi xóa TCCS:", e);
      // Nới lỏng điều kiện kiểm tra lỗi để bắt đúng thông báo
      if (e && (e.message?.includes("Không thể xóa") || typeof e === 'string' && e.includes("Không thể xóa"))) {
        setSyncStatus('IDLE');
      } else {
        setSyncStatus('ERROR');
      }
      throw e;
    }
  };

  // --- Inventory ---
  const addInventoryIn = async (inv: InventoryIn) => handleSave('inventoryIn', inv);
  const deleteInventoryIn = async (id: string) => handleDelete('inventoryIn', id);
  const addInventoryOut = async (inv: InventoryOut) => handleSave('inventoryOut', inv);
  const deleteInventoryOut = async (id: string) => handleDelete('inventoryOut', id);

  // ============================================================
  // TỰ ĐỘNG ĐÁNH GIÁ TRẠNG THÁI LÔ KHI CÓ THAY ĐỔI TEST RESULTS
  // Phương án 3: Lắng nghe thay đổi testResults trong Firebase
  // Cải tiến: Thêm cờ chống race condition và debounce
  // ============================================================
  useEffect(() => {
    let isMounted = true;
    let isProcessing = false;
    let debounceTimer: NodeJS.Timeout | null = null;

    const testResultsRef = ref(db, 'testResults');
    
    const unsubscribe = onValue(testResultsRef, async (snapshot) => {
      // Debounce: Đợi 500ms sau lần thay đổi cuối cùng trước khi xử lý
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(async () => {
        // Chống race condition: Nếu đang xử lý, bỏ qua lần thay đổi này
        if (isProcessing || !isMounted) return;
        
        isProcessing = true;
        
        try {
          const allTestResults = snapshot.exists() ? Object.values(snapshot.val()) as TestResult[] : [];
          
          // Nhóm test results theo batchId
          const resultsByBatch = new Map<string, TestResult[]>();
          allTestResults.forEach(tr => {
            const existing = resultsByBatch.get(tr.batchId) || [];
            existing.push(tr);
            resultsByBatch.set(tr.batchId, existing);
          });

          // Lấy tất cả batch từ Firebase để có dữ liệu mới nhất
          const batchesRef = ref(db, 'batches');
          const batchesSnap = await get(batchesRef);
          const allBatches = batchesSnap.exists() ? Object.values(batchesSnap.val()) as Batch[] : [];
          
          // Lấy tất cả TCCS
          const tccsRef = ref(db, 'tccs');
          const tccsSnap = await get(tccsRef);
          const allTccs = tccsSnap.exists() ? Object.values(tccsSnap.val()) as TCCS[] : [];

          // Kiểm tra lại sau khi async
          if (!isMounted) return;

          // Đánh giá lại tất cả các lô có kết quả kiểm nghiệm
          const updates: Record<string, any> = {};
          let updateCount = 0;

          resultsByBatch.forEach((batchResults, batchId) => {
            const batch = allBatches.find(b => b.id === batchId);
            if (!batch) return;

  // Sử dụng logic chọn TCCS theo ngày SX để đánh giá chính xác
            // Lọc TCCS active trước khi tìm
            const activeTccsList = allTccs.filter(t => t.productId === batch.productId && t.isActive);
            const tccs = findTCCSByMfgDate(batch.productId, batch.mfgDate || null, activeTccsList, batch.tccsId);
            
            // Sắp xếp theo ngày giảm dần (mới nhất trước)
            const sortedResults = batchResults.sort((a, b) => 
              new Date(b.testDate).getTime() - new Date(a.testDate).getTime()
            );

            try {
              // Đánh giá trạng thái (Bọc try-catch để tránh crash app nếu logic đánh giá lỗi)
              const evaluation = evaluateBatchStatus(batch, sortedResults, tccs);
              const newStatus = evaluation.suggestedStatus;

              // Chỉ cập nhật nếu trạng thái thay đổi và không phải PENDING (tránh overwrite thủ công)
              if (newStatus !== batch.status && batch.status !== BATCH_STATUS.PENDING) {
                updates[`batches/${batchId}/status`] = newStatus;
                updates[`batches/${batchId}/updatedAt`] = new Date().toISOString();
                debug.log(`[AppContext Auto-Eval] Lô ${batch.batchNo}: ${batch.status} -> ${newStatus}. Lý do: ${evaluation.reason}`);
                updateCount++;
              }
            } catch (evalErr) {
              debug.warn(`[AppContext Auto-Eval] Lỗi khi đánh giá lô ${batch.batchNo}:`, evalErr);
            }
          });

          // Thực hiện batch update nếu có thay đổi
          if (updateCount > 0) {
            try {
              await update(ref(db), updates);
              debug.log(`[AppContext Auto-Eval] Đã cập nhật ${updateCount} lô hàng`);
            } catch (err) {
              debug.error("[AppContext Auto-Eval] Lỗi cập nhật:", err);
            }
          }
        } finally {
          isProcessing = false;
        }
      }, 500); // Debounce 500ms
    }, (error) => {
      debug.error("Lỗi lắng nghe testResults:", error);
    });

    return () => {
      isMounted = false;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      unsubscribe();
    };
  }, []);

  // --- Utils ---
  const resetToDemoData = async () => {
    setSyncStatus('SAVING');
    try {
      // Tạo bộ dữ liệu mẫu tối thiểu để hệ thống có thể chạy
      const demoData = {
        products: {
          'demo_p1': { id: 'demo_p1', code: 'DEMO-001', name: 'Sản phẩm mẫu A', createdAt: new Date().toISOString() },
          'demo_p2': { id: 'demo_p2', code: 'DEMO-002', name: 'Sản phẩm mẫu B', createdAt: new Date().toISOString() }
        },
        product_formulas: {},
        tccs: {
          'demo_t1': { id: 'demo_t1', productId: 'demo_p1', code: 'TCCS 01:2024', name: 'TCCS Mẫu A', issueDate: new Date().toISOString(), createdAt: new Date().toISOString() }
        },
        batches: {},
        testResults: {},
        inventoryIn: {},
        inventoryOut: {}
      };
      
      await set(ref(db), demoData);
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e) {
      debug.error("Lỗi nạp dữ liệu mẫu:", e);
      setSyncStatus('ERROR');
    }
  };

  const clearAllData = async () => {
    setSyncStatus('SAVING');
    try {
      await set(ref(db), null);
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e) {
      debug.error("Lỗi xóa sạch dữ liệu:", e);
      setSyncStatus('ERROR');
    }
  };

  const loadBackup = async (data: AppState) => {
    setSyncStatus('SAVING');
    try {
      // Helper: Chuyển đổi mảng (từ file backup JSON) thành Object Map (để lưu vào Firebase)
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
        tccs: toMap(data.tccsList), // Lưu ý: State dùng 'tccsList', DB dùng 'tccs'
        testResults: toMap(data.testResults),
        inventoryIn: toMap(data.inventoryIn),
        inventoryOut: toMap(data.inventoryOut)
      };

      await set(ref(db), restoreData);
      setSyncStatus('SAVED');
      setTimeout(() => setSyncStatus('IDLE'), 2000);
    } catch (e) {
      debug.error("Lỗi khôi phục dữ liệu:", e);
      setSyncStatus('ERROR');
      throw e;
    }
  };
  
  return (
    <AppContext.Provider value={{
      state, syncStatus, stockMap, user, isAdmin, notify,
      addProduct, updateProduct, deleteProduct, bulkAddProducts,
      addProductFormula, updateProductFormula, deleteProductFormula,
      addRawMaterial, updateRawMaterial, deleteRawMaterial,
      addBatch, updateBatch, deleteBatch, updateBatchStatus,
      addTCCS, updateTCCS, deleteTCCS,
      addInventoryIn, deleteInventoryIn, addInventoryOut, deleteInventoryOut,
      resetToDemoData, clearAllData, loadBackup
    }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <SyncIndicator status={syncStatus} />
    </AppContext.Provider>
  );
};
