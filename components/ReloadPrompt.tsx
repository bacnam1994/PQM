import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Cloud } from 'lucide-react';
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
        icon: <Cloud size={18} className="text-emerald-500"/>,
        duration: 3000
      });
      setOfflineReady(false);
    }
  }, [offlineReady]);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] p-4 bg-slate-800 text-white rounded-xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-5 fade-in duration-500 flex flex-col gap-3 max-w-xs">
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-sm">Cập nhật mới</h3>
        <button onClick={close} className="text-slate-400 hover:text-white"><X size={16}/></button>
      </div>
      <p className="text-xs text-slate-300">Đã có phiên bản mới. Vui lòng làm mới để cập nhật.</p>
      <button 
        onClick={() => updateServiceWorker(true)}
        className="w-full py-2 bg-[#009639] hover:bg-emerald-600 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors"
      >
        <RefreshCw size={14} /> Làm mới ngay
      </button>
    </div>
  );
};

export default ReloadPrompt;