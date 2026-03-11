import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  toasts: ToastMessage[];
  notify: (msg: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

// --- IMPROVED TOAST NOTIFICATION COMPONENT ---
const ToastContainer = ({ toasts, removeToast }: { toasts: ToastMessage[], removeToast: (id: string) => void }) => {
  return (
    <div className="fixed top-4 right-4 z-[110] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map(t => {
        let config = {
          bg: 'bg-white dark:bg-slate-800',
          border: 'border-slate-100 dark:border-slate-700',
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          progressColor: 'bg-emerald-500'
        };
        let icon = <Info size={20} className={config.iconColor} />;
        
        switch (t.type) {
          case 'SUCCESS':
            config = {
              bg: 'bg-white dark:bg-slate-800',
              border: 'border-emerald-200 dark:border-emerald-800',
              iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              progressColor: 'bg-emerald-500'
            };
            icon = <CheckCircle2 size={20} className={config.iconColor} />;
            break;
          case 'ERROR':
            config = {
              bg: 'bg-white dark:bg-slate-800',
              border: 'border-red-200 dark:border-red-800',
              iconBg: 'bg-red-100 dark:bg-red-900/30',
              iconColor: 'text-red-600 dark:text-red-400',
              progressColor: 'bg-red-500'
            };
            icon = <AlertCircle size={20} className={config.iconColor} />;
            break;
          case 'WARNING':
            config = {
              bg: 'bg-white dark:bg-slate-800',
              border: 'border-amber-200 dark:border-amber-800',
              iconBg: 'bg-amber-100 dark:bg-amber-900/30',
              iconColor: 'text-amber-600 dark:text-amber-400',
              progressColor: 'bg-amber-500'
            };
            icon = <AlertTriangle size={20} className={config.iconColor} />;
            break;
          case 'INFO':
          default:
            config = {
              bg: 'bg-white dark:bg-slate-800',
              border: 'border-blue-200 dark:border-blue-800',
              iconBg: 'bg-blue-100 dark:bg-blue-900/30',
              iconColor: 'text-blue-600 dark:text-blue-400',
              progressColor: 'bg-blue-500'
            };
            icon = <Info size={20} className={config.iconColor} />;
            break;
        }

        return (
          <div 
            key={t.id} 
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border ${config.bg} ${config.border} shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 backdrop-blur-sm animate-in slide-in-from-right duration-300`}
          >
            <div className={`p-2 rounded-xl ${config.iconBg} shrink-0`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              {t.title && <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-0.5">{t.title}</h4>}
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">{t.message}</p>
            </div>
            <button 
              onClick={() => removeToast(t.id)} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X size={16} />
            </button>
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl overflow-hidden">
              <div 
                className={`h-full ${config.progressColor} animate-[shrink_5s_linear_forwards]`}
                style={{ 
                  animation: 'shrink 5s linear forwards',
                  width: '100%'
                }}
              />
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...msg, id }]);
    // Auto dismiss
    setTimeout(() => removeToast(id), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, notify, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};
