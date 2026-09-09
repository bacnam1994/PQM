import React from 'react';
import { Files, X, Loader2, CheckCheck, XCircle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-xl shadow-md">
              <Files size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">AI Batch Scan – Quét nhiều file</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{totalDone}/{total} file hoàn tất</p>
            </div>
            {allFinished && onClose && (
              <button onClick={onClose} className="ml-auto p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="px-5 pt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tiến độ tổng thể</span>
            <span className="text-[10px] font-black text-violet-600 dark:text-violet-400">{overallPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>

        {/* File list */}
        <div className="p-5 space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
              {/* Status icon */}
              <div className="flex-shrink-0">
                {f.status === 'waiting' && <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />}
                {f.status === 'processing' && <Loader2 size={18} className="animate-spin text-violet-500" />}
                {f.status === 'done' && <CheckCheck size={18} className="text-emerald-500" />}
                {f.status === 'error' && <XCircle size={18} className="text-red-500" />}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={f.fileName}>{f.fileName}</p>
                {f.status === 'processing' && f.progressStep && (
                  <p className="text-[10px] text-violet-500 font-medium mt-0.5">{f.progressStep}</p>
                )}
                {f.status === 'done' && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    ✓ {f.criteriaCount ?? 0} chỉ tiêu đọc được
                  </p>
                )}
                {f.status === 'error' && (
                  <p className="text-[10px] text-red-500 font-medium mt-0.5 truncate" title={f.error}>❌ {f.error}</p>
                )}
              </div>

              {/* Per-file progress bar khi đang xử lý */}
              {f.status === 'processing' && typeof f.progressPercent === 'number' && (
                <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full bg-violet-400 transition-all duration-300"
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
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            }`}>
              <CheckCheck size={14} />
              Đã hoàn tất: {files.filter(f => f.status === 'done').length} thành công, {files.filter(f => f.status === 'error').length} lỗi.
              {onClose && <button onClick={onClose} className="ml-auto font-black underline">Đóng</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
