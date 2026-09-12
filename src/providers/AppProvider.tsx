import React, { useState, useEffect } from 'react';
import { goOnline } from 'firebase/database';
import {
  CloudIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthSync } from '../hooks/useAuthSync';
import { useFirebaseSync } from '../hooks/useFirebaseSync';
import { useIsMutating, useIsFetching, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';

// --- TOAST NOTIFICATION COMPONENT ---
const GlobalToastContainer = () => {
  const { toasts, removeToast } = useAppStore(
    useShallow((state) => ({
      toasts: state.toasts,
      removeToast: state.removeToast,
    }))
  );

  return (
    <div className="fixed top-4 right-4 z-[110] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => {
        let bgClass = 'bg-surface border-border text-ink';
        let icon = <InformationCircleIcon className="w-5 h-5 text-sky-500" />;

        switch (t.type) {
          case 'SUCCESS':
            bgClass =
              'bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-ink';
            icon = <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
            break;
          case 'ERROR':
            bgClass =
              'bg-rose-50/95 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-ink';
            icon = <ExclamationCircleIcon className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
            break;
          case 'WARNING':
            bgClass =
              'bg-amber-50/95 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-ink';
            icon = (
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            );
            break;
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md animate-in slide-in-from-right duration-300 ${bgClass}`}
          >
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
              {t.title && <h4 className="text-sm font-bold mb-0.5">{t.title}</h4>}
              <p className="text-xs font-medium text-ink-muted leading-relaxed">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

// --- SYNC INDICATOR COMPONENT (CHUẨN TANSTACK QUERY OFFLINE) ---
export const SyncIndicator = () => {
  const isMutating = useIsMutating();
  const isFetching = useIsFetching();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && isMutating === 0 && isFetching === 0) {
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [isOnline, isMutating, isFetching]);

  let icon = <CloudIcon className="w-3.5 h-3.5" />;
  let text = 'Sẵn sàng';
  let colorClass = 'bg-surface/90 backdrop-blur text-ink-muted border-border';

  if (!isOnline) {
    icon = <CloudIcon className="w-3.5 h-3.5 opacity-60" />;
    text = isMutating > 0 ? `Ngoại tuyến (${isMutating} chờ gửi)` : 'Mất kết nối';
    colorClass = 'bg-slate-900 text-white border-slate-700 shadow-xl';
  } else if (isMutating > 0) {
    icon = <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-sky-600 dark:text-sky-400" />;
    text = `Đang lưu (${isMutating})...`;
    colorClass =
      'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
  } else if (isFetching > 0) {
    icon = (
      <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
    );
    text = 'Đang đồng bộ...';
    colorClass =
      'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
  } else {
    icon = <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
    text = 'Đã đồng bộ';
    colorClass =
      'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  }

  return (
    <div
      onClick={() => !isOnline && goOnline(db)}
      title={!isOnline ? 'Bấm để kết nối lại và đồng bộ dữ liệu' : ''}
      className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-500 ${colorClass} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'} ${!isOnline ? 'cursor-pointer hover:bg-slate-800' : ''}`}
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <GlobalToastContainer />
      <SyncIndicator />
    </QueryClientProvider>
  );
};
