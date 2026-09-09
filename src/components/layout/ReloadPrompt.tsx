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
    <div className="fixed bottom-4 right-4 z-[100] p-4 bg-surface text-ink rounded-2xl shadow-xl border border-border animate-in slide-in-from-bottom-5 fade-in duration-300 flex flex-col gap-3 max-w-xs">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-sm">Cập nhật mới</h3>
        <button type="button" onClick={close} className="text-ink-faint hover:text-ink transition-colors">
          <XMarkIcon className="w-4 h-4"/>
        </button>
      </div>
      <p className="text-xs text-ink-faint">Đã có phiên bản mới của hệ thống. Vui lòng làm mới để cập nhật.</p>
      <button 
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold uppercase flex items-center justify-center gap-2 transition-all shadow-xs"
      >
        <ArrowPathIcon className="w-4 h-4" /> Làm mới ngay
      </button>
    </div>
  );
};

export default ReloadPrompt;