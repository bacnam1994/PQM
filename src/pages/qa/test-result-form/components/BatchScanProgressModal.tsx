import React from 'react';
import { DocumentDuplicateIcon, XMarkIcon, ArrowPathIcon, CheckBadgeIcon, XCircleIcon } from '@heroicons/react/24/outline';

export interface BatchFileStatus {
  fileName: string;
  status: 'waiting' | 'processing' | 'done' | 'error';
  criteriaCount?: number;
  error?: string;
  progressStep?: string;
  progressPercent?: number;
}

export interface BatchScanProgressModalProps {
  isOpen: boolean;
  files: BatchFileStatus[];
  totalDone: number;
  onClose?: () => void;
}

export const BatchScanProgressModal: React.FC<BatchScanProgressModalProps> = ({
  isOpen,
  files,
  totalDone,
  onClose
}) => {
  if (!isOpen) return null;
  const total = files.length;
  const overallPercent = total > 0 ? Math.round((totalDone / total) * 100) : 0;
  const allFinished = files.every(f => f.status === 'done' || f.status === 'error');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <DocumentDuplicateIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink uppercase tracking-wide">AI Batch Scan – Quét nhiều file</h3>
              <p className="text-xs text-ink-muted">{totalDone}/{total} file hoàn tất</p>
            </div>
            {allFinished && onClose && (
              <button onClick={onClose} className="ml-auto p-2 hover:bg-surface-3 rounded-lg text-ink-muted transition-colors">
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="px-5 pt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Tiến độ tổng thể</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{overallPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>

        {/* File list */}
        <div className="p-5 space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border">
              {/* Status icon */}
              <div className="flex-shrink-0">
                {f.status === 'waiting' && <div className="w-5 h-5 rounded-full border-2 border-border" />}
                {f.status === 'processing' && <ArrowPathIcon className="w-5 h-5 animate-spin text-emerald-600" />}
                {f.status === 'done' && <CheckBadgeIcon className="w-5 h-5 text-emerald-600" />}
                {f.status === 'error' && <XCircleIcon className="w-5 h-5 text-rose-500" />}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-ink truncate" title={f.fileName}>{f.fileName}</p>
                {f.status === 'processing' && f.progressStep && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">{f.progressStep}</p>
                )}
                {f.status === 'done' && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    ✓ {f.criteriaCount ?? 0} chỉ tiêu đọc được
                  </p>
                )}
                {f.status === 'error' && (
                  <p className="text-[10px] text-rose-500 font-medium mt-0.5 truncate" title={f.error}>❌ {f.error}</p>
                )}
              </div>

              {/* Per-file progress bar khi đang xử lý */}
              {f.status === 'processing' && typeof f.progressPercent === 'number' && (
                <div className="w-16 h-1.5 rounded-full bg-surface-3 overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${f.progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {allFinished && (
          <div className="px-5 pb-5">
            <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
              files.some(f => f.status === 'error')
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
            }`}>
              <CheckBadgeIcon className="w-4 h-4" />
              Đã hoàn tất: {files.filter(f => f.status === 'done').length} thành công, {files.filter(f => f.status === 'error').length} lỗi.
              {onClose && <button onClick={onClose} className="ml-auto font-semibold underline">Đóng</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
