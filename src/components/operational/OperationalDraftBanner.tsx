import React from 'react';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  TrashIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';

interface OperationalDraftBannerProps {
  hasDraft: boolean;
  draftTimestamp?: string | null;
  onRestore: () => void;
  onDiscard: () => void;
  className?: string;
}

export const OperationalDraftBanner: React.FC<OperationalDraftBannerProps> = ({
  hasDraft,
  draftTimestamp,
  onRestore,
  onDiscard,
  className = '',
}) => {
  if (!hasDraft) return null;

  const formattedTime = draftTimestamp
    ? new Date(draftTimestamp).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : 'phiên trước';

  return (
    <div
      className={`rounded-2xl border border-sky-500/30 bg-sky-50/80 dark:bg-sky-950/40 p-4 backdrop-blur-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top-2 duration-300 ${className}`}
    >
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
          <DocumentTextIcon className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-sky-950 dark:text-sky-100 flex items-center gap-2">
            Phát hiện bản nháp tự động lưu
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
              Lúc {formattedTime}
            </span>
          </h4>
          <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80 mt-0.5 leading-relaxed">
            Bạn có dữ liệu đang nhập dở chưa được lưu vào hệ thống. Bạn có muốn khôi phục không?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <button
          type="button"
          onClick={onDiscard}
          className="px-3 py-1.5 rounded-lg border border-sky-300/50 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          Bỏ qua
        </button>
        <button
          type="button"
          onClick={onRestore}
          className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
          Khôi phục bản nháp
        </button>
      </div>
    </div>
  );
};

export const AutoSaveStatusBadge: React.FC<{
  isSaving?: boolean;
  lastSavedAt?: string | null;
  isOffline?: boolean;
  className?: string;
}> = ({ isSaving, lastSavedAt, isOffline, className = '' }) => {
  if (isSaving) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-600 dark:text-sky-400 ${className}`}
      >
        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
        Đang lưu nháp...
      </span>
    );
  }

  if (isOffline) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 ${className}`}
      >
        <CloudArrowUpIcon className="w-3.5 h-3.5" />
        Ngoại tuyến: Lưu nháp cục bộ
      </span>
    );
  }

  if (lastSavedAt) {
    const formatted = new Date(lastSavedAt).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted ${className}`}
      >
        <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
        Đã lưu nháp lúc {formatted}
      </span>
    );
  }

  return null;
};
