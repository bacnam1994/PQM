import React, { useState, useEffect } from 'react';
import { ref, onValue, query, get, orderByChild, goOnline, limitToLast } from 'firebase/database';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, X, Info, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import {
  AppState, Batch, Product, TCCS, TestResult, ProductFormula,
  InventoryIn, InventoryOut, SyncStatus, RawMaterial
} from '../types';
import { getFromCache, saveToCache, clearEntireCache } from '../utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

// Giữ nguyên các định dạng Type và Component ToastContainer, SyncIndicator...
export type ToastType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

// --- TOAST NOTIFICATION COMPONENT ---
const GlobalToastContainer = () => {
  const { toasts, removeToast } = useAppStore(useShallow(state => ({
    toasts: state.toasts,
    removeToast: state.removeToast
  })));

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
export const SyncIndicator = () => {
  const status = useAppStore(state => state.syncStatus);
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
  const [isOfflineLoaded, setIsOfflineLoaded] = useState(false);
  const testResultLimit = useAppStore(state => state.testResultLimit);

  // 0. Lắng nghe trạng thái đăng nhập & Quyền Admin
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      useAppStore.getState().setUser(currentUser);
      if (currentUser) {
        try {
          const adminRef = ref(db, `users/admins/${currentUser.uid}`);
          const snapshot = await get(adminRef);
          const isUserAdmin = snapshot.exists();
          useAppStore.getState().setIsAdmin(isUserAdmin);
          useAppStore.getState().setRole(isUserAdmin ? 'ADMIN' : 'USER');
        } catch (e) {
          console.error("Lỗi kiểm tra quyền Admin:", e);
          useAppStore.getState().setIsAdmin(false);
          useAppStore.getState().setRole('USER');
        }
      } else {
        useAppStore.getState().setIsAdmin(false);
        useAppStore.getState().setRole(null);
        
        // Tự động dọn dẹp sạch sẽ bộ nhớ cục bộ (IndexedDB) khi Đăng xuất
        // Ngăn chặn rò rỉ dữ liệu nhạy cảm sang phiên đăng nhập của người khác
        clearEntireCache().catch(e => console.warn("Lỗi dọn dẹp cache khi đăng xuất:", e));
      }
      useAppStore.getState().setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 1. Lắng nghe dữ liệu từ Firebase Realtime Database
  useEffect(() => {
    let isMounted = true;
    const unsubscribes: (() => void)[] = [];

    // Đăng ký event mạng ngay lập tức
    const handleOnline = () => goOnline(db);
    const handleOffline = () => useAppStore.getState().setSyncStatus('OFFLINE');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Đóng gói logic khởi tạo thành chuỗi Async theo thứ tự
    const initializeData = async () => {
      // BƯỚC 1: Tải dữ liệu toàn bộ từ Cache TRƯỚC
      if (!isOfflineLoaded) {
        try {
          const [cachedProducts, cachedBatches, cachedTccs, cachedFormulas, cachedMaterials, cachedInvIn, cachedInvOut, cachedTestResults] = await Promise.all([
            getFromCache('products'), getFromCache('batches'), getFromCache('tccs'), getFromCache('productFormulas'),
            getFromCache('rawMaterials'), getFromCache('inventoryIn'), getFromCache('inventoryOut'), getFromCache('testResults')
          ]);

          if (!isMounted) return;
          const currentState = useAppStore.getState();
          useAppStore.getState().setAppState({
            products: cachedProducts.length > 0 ? cachedProducts : currentState.products,
            batches: cachedBatches.length > 0 ? cachedBatches : currentState.batches,
            tccsList: cachedTccs.length > 0 ? cachedTccs : currentState.tccsList,
            productFormulas: cachedFormulas.length > 0 ? cachedFormulas : currentState.productFormulas,
            rawMaterials: cachedMaterials.length > 0 ? cachedMaterials : currentState.rawMaterials,
            inventoryIn: cachedInvIn.length > 0 ? cachedInvIn : currentState.inventoryIn,
            inventoryOut: cachedInvOut.length > 0 ? cachedInvOut : currentState.inventoryOut,
            testResults: cachedTestResults.length > 0 ? cachedTestResults.sort((a: any, b: any) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()) : currentState.testResults,
          });
          console.log('[Offline-First] Đã nạp dữ liệu AppContext từ IndexedDB');
        } catch (error) {
          console.error("Lỗi nạp cache AppContext:", error);
        } finally {
          setIsOfflineLoaded(true);
        }
      }

      if (!isMounted) return;

      // BƯỚC 2: SAU KHI NẠP CACHE XONG mới gắn Listener Firebase (Phòng tránh Race Condition)
      const refs = {
        products: ref(db, 'products'),
        batches: ref(db, 'batches'),
        tccsList: ref(db, 'tccs'),
        productFormulas: ref(db, 'product_formulas'),
        rawMaterials: ref(db, 'raw_materials'),
        inventoryIn: ref(db, 'inventoryIn'),
        inventoryOut: ref(db, 'inventoryOut')
      };

      Object.entries(refs).forEach(([key, reference]) => {
        const unsubscribe = onValue(reference, (snapshot) => {
          const data = snapshot.val();
          const list = data ? Object.values(data) : [];
          useAppStore.getState().setAppState({ [key]: list, lastSync: new Date().toISOString() });

          // TỐI ƯU HÓA: Đưa thao tác ghi IndexedDB xuống Background (Non-blocking UI Thread)
          if (list.length > 0) {
            const storeName = key === 'tccsList' ? 'tccs' : key;
            const saveTask = () => saveToCache(storeName, list);
            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(saveTask);
            } else {
              setTimeout(saveTask, 500); // Dự phòng cho trình duyệt cũ
            }
          }
        }, (error) => {
          console.error(`Lỗi tải ${key}:`, error);
        });
        unsubscribes.push(unsubscribe);
      });
    };

    initializeData();

    // Theo dõi trạng thái kết nối để tự động phục hồi lỗi
    const connectedRef = ref(db, '.info/connected');
    const unsubConnected = onValue(connectedRef, (snap) => {
      const isConnected = snap.val() === true;
      if (isConnected) {
        const currentStatus = useAppStore.getState().syncStatus;
        if (currentStatus === 'ERROR' || currentStatus === 'OFFLINE') {
          useAppStore.getState().setSyncStatus('IDLE');
        }
      } else {
        useAppStore.getState().setSyncStatus('OFFLINE');
      }
    });
    unsubscribes.push(unsubConnected);

    return () => {
      isMounted = false;
      unsubscribes.forEach(fn => fn());
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Lắng nghe dữ liệu TestResults với Pagination phụ thuộc vào testResultLimit
  useEffect(() => {
    // Kích hoạt trạng thái loading để UI hiển thị vòng xoay trên nút "Tải thêm"
    useAppStore.getState().setSyncStatus('SAVING');

    const qTestResults = query(ref(db, 'testResults'), orderByChild('createdAt'), limitToLast(testResultLimit));
    const unsubTestResults = onValue(qTestResults, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((child) => {
        list.push(child.val());
      });
      
      useAppStore.getState().mergeTestResults(list);
      if (list.length > 0) {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => saveToCache('testResults', list));
        } else {
          setTimeout(() => saveToCache('testResults', list), 500);
        }
      }
      
      // Tắt trạng thái loading sau khi Firebase hoàn tất trả về dữ liệu mới
      // Dùng setTimeout nhỏ để tránh chớp nháy UI nếu cache trả về quá nhanh
      setTimeout(() => useAppStore.getState().setSyncStatus('IDLE'), 300);
    }, (error) => {
      console.error("Lỗi tải testResults:", error);
      useAppStore.getState().setSyncStatus('ERROR');
    });
    return () => unsubTestResults();
  }, [testResultLimit]);
  
  return (
    <>
      {children}
      <GlobalToastContainer />
      <SyncIndicator />
    </>
  );
};
