import React from 'react';
import { CloudArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { goOnline } from 'firebase/database';
import { db } from '../../firebase';
import { queryClient } from '../../lib/queryClient';

interface OperationalOfflineBannerProps {
  isOffline: boolean;
  queuedCount?: number;
  className?: string;
}

export const OperationalOfflineBanner: React.FC<OperationalOfflineBannerProps> = ({
  isOffline,
  queuedCount = 0,
  className = '',
}) => {
  if (!isOffline) return null;

  const handleReconnect = () => {
    try {
      goOnline(db);
      queryClient.resumePausedMutations();
    } catch (e) {
      console.warn('Lỗi kết nối lại:', e);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-700 bg-slate-900 text-white p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300 ${className}`}
    >
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-2 rounded-xl bg-slate-800 text-amber-400 shrink-0">
          <CloudArrowDownIcon className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold flex items-center gap-2">
            Đang làm việc ở chế độ Ngoại tuyến (Offline)
            {queuedCount > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {queuedCount} thay đổi chờ gửi
              </span>
            )}
          </h4>
          <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
            Mọi thao tác lưu và sửa đổi sẽ được lưu trữ an toàn trong bộ nhớ máy và tự động đồng bộ
            lên hệ thống khi có mạng.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleReconnect}
        className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold tracking-wide transition-all border border-slate-600 flex items-center gap-1.5 shrink-0 self-end sm:self-center cursor-pointer active:scale-95"
      >
        <ArrowPathIcon className="w-3.5 h-3.5 text-sky-400" />
        Kiểm tra kết nối
      </button>
    </div>
  );
};
