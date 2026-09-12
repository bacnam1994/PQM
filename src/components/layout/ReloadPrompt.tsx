import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ArrowPathIcon, XMarkIcon, CloudIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  useEffect(() => {
    if (offlineReady) {
      toast.success("Ứng dụng đã sẵn sàng hoạt động offline!", {
        icon: <CloudIcon className="w-5 h-5 text-emerald-500"/>,
        duration: 3000
      });
      setOfflineReady(false);
    }
  }, [offlineReady]);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] p-4 bg-surface text-ink rounded-xl shadow-lg border border-border animate-in slide-in-from-bottom-4 fade-in duration-200 flex flex-col gap-2.5 max-w-xs">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-sm text-ink">Cập nhật phiên bản mới</h3>
        <button type="button" onClick={close} className="text-ink-muted hover:text-ink p-0.5 rounded transition-colors" aria-label="Đóng thông báo">
          <XMarkIcon className="w-4 h-4"/>
        </button>
      </div>
      <p className="text-xs text-ink-muted leading-relaxed">Đã có bản cập nhật mới của hệ thống. Vui lòng làm mới để áp dụng.</p>
      <button 
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-xs"
      >
        <ArrowPathIcon className="w-4 h-4" /> Làm mới ngay
      </button>
    </div>
  );
};

export default ReloadPrompt;