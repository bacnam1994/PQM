import React, { useState, useEffect } from 'react';
import { goOnline } from 'firebase/database';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, X, Info, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthSync } from '../hooks/useAuthSync';
import { useFirebaseSync } from '../hooks/useFirebaseSync';
import { getPendingMutationsCount } from '../utils/offlineMutationQueue';

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
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg shadow-slate-200/50 backdrop-blur-sm animate-in slide-in-from-right duration-300 ${bgClass}`}>
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              {t.title && <h4 className="text-sm font-bold text-slate-800 mb-0.5">{t.title}</h4>}
              <p className="text-xs font-medium text-slate-600 leading-relaxed">{t.message}</p>
            </div>
            <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
};

// --- SYNC INDICATOR COMPONENT ---
export const SyncIndicator = () => {
  const status = useAppStore(state => state.syncStatus);
  const [visible, setVisible] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => {
      const count = await getPendingMutationsCount();
      setPendingCount(count);
    };
    updateCount();
    const interval = setInterval(updateCount, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status === 'IDLE' && pendingCount === 0) {
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [status, pendingCount]);

  let icon = <Cloud size={14} />;
  let text = 'Sẵn sàng';
  let colorClass = 'bg-white/80 backdrop-blur text-slate-400 border-slate-200';

  if (status === 'SAVING') { icon = <RefreshCw size={14} className="animate-spin" />; text = 'Đang lưu...'; colorClass = 'bg-blue-50 text-blue-600 border-blue-100'; }
  else if (status === 'SAVED') { icon = <CheckCircle2 size={14} />; text = 'Đã lưu'; colorClass = 'bg-emerald-50 text-emerald-600 border-emerald-100'; }
  else if (status === 'ERROR') { icon = <AlertCircle size={14} />; text = 'Lỗi đồng bộ'; colorClass = 'bg-red-50 text-red-600 border-red-100'; }
  else if (status === 'OFFLINE') { 
    icon = <CloudOff size={14} />; 
    text = pendingCount > 0 ? `Ngoại tuyến (${pendingCount} chờ gửi)` : 'Mất kết nối'; 
    colorClass = 'bg-slate-800 text-white border-slate-700 shadow-lg'; 
  }

  return (
    <div 
      onClick={() => (status === 'OFFLINE' || status === 'ERROR') && goOnline(db)}
      title={status === 'OFFLINE' ? "Bấm để kết nối lại và đồng bộ dữ liệu" : ""}
      className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm text-[10px] font-bold uppercase tracking-wider transition-all duration-500 ${colorClass} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'} ${status === 'OFFLINE' ? 'cursor-pointer hover:bg-slate-700' : ''}`}
    >
      {icon} <span>{text}</span>
    </div>
  );
};

// --- MAIN PROVIDER ---
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Lắng nghe và đồng bộ ngầm thông qua các Hook đã được tách
  useAuthSync();
  useFirebaseSync(); 

  return <>{children}<GlobalToastContainer /><SyncIndicator /></>;
};
