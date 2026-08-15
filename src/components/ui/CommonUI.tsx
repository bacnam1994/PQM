import React, { memo } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Tag, ShieldCheck, Clock, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { BATCH_STATUS, PRODUCT_STATUS, TEST_RESULT_STATUS } from '../../utils/constants';

// --- BỘ NHẬN DIỆN TRẠNG THÁI DÙNG CHUNG ---
export const StatusBadge: React.FC<{ type: string; status: string }> = memo(({ type, status }) => {
  const configs: Record<string, any> = {
    PRODUCT: {
      [PRODUCT_STATUS.ACTIVE]: { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-900/30', icon: Tag, label: 'Đang công bố' },
      [PRODUCT_STATUS.DISCONTINUED]: { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100/80 dark:border-amber-900/30', icon: AlertCircle, label: 'Ngừng SX' },
      [PRODUCT_STATUS.RECALLED]: { bg: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100/80 dark:border-red-900/30', icon: X, label: 'Thu hồi' },
    },
    BATCH: {
      [BATCH_STATUS.PENDING]: { bg: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700/40', icon: Clock, label: 'Kế hoạch' },
      [BATCH_STATUS.TESTING]: { bg: 'bg-blue-600 text-white border border-blue-700/20', icon: Loader2, label: 'Đang kiểm', spin: true },
      [BATCH_STATUS.RELEASED]: { bg: 'bg-emerald-600 text-white border border-emerald-700/20', icon: ShieldCheck, label: 'Phê duyệt' },
      [BATCH_STATUS.REJECTED]: { bg: 'bg-red-500 text-white border border-red-600/20', icon: X, label: 'Loại bỏ' },
    },
    RESULT: {
      [TEST_RESULT_STATUS.PASS]: { bg: 'bg-emerald-500 text-white border border-emerald-600/20', label: 'ĐẠT (PASS)' },
      [TEST_RESULT_STATUS.FAIL]: { bg: 'bg-red-500 text-white border border-red-600/20', label: 'LỖI (FAIL)' },
    }
  };

  const config = configs[type]?.[status] || { bg: 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500 border border-zinc-200/60 dark:border-zinc-700/40', icon: HelpCircle, label: status };
  const Icon = config.icon;

  return (
    <span className={`${config.bg} px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 w-fit whitespace-nowrap`}>
      {Icon && <Icon size={11} className={config.spin ? 'animate-spin' : ''} />}
      {config.label}
    </span>
  );
});

// --- COMPONENT TIẾN ĐỘ HÌNH TRÒN ---
export const CircularProgress = ({ progress, color = 'text-emerald-500 dark:text-emerald-400', completeColor = 'text-emerald-500 dark:text-emerald-400' }: { progress: number, color?: string, completeColor?: string }) => {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = Math.max(0, circumference - (progress / 100) * circumference);
  const colorClass = progress === 100 ? completeColor : color;

  return (
    <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-100 dark:text-zinc-800" />
        <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} className={`${colorClass} transition-all duration-500 ease-in-out`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[9px] font-semibold text-zinc-600 dark:text-zinc-400">{progress}%</span>
    </div>
  );
};

// --- WRAPPER CHO CÁC MODAL ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; icon: any; color?: string }> = ({ isOpen, onClose, title, children, icon: Icon, color = 'bg-emerald-600' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 dark:bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl w-full max-w-2xl shadow-2xl my-auto animate-in zoom-in-95 duration-150 overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50">
        {/* Premium header with accent gradient strip */}
        <div className="relative px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/40">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent" />
          <div className="flex items-center gap-3.5">
            <div className={`${color} p-2.5 rounded-xl text-white shadow-sm`}><Icon size={18} /></div>
            <h3 className="text-base font-display font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">{title}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition-all"><X size={18}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// --- TIÊU ĐỀ TRANG DÙNG CHUNG ---
export const PageHeader: React.FC<{ title: string; subtitle: string; icon: any; action?: React.ReactNode }> = ({ title, subtitle, icon, action }) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon;
    return <IconComp className="w-5 h-5" />;
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-7">
      <div>
        <h1 className="text-[22px] font-display font-bold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-3">
          <div className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.06))' }}>
            {renderIcon()}
          </div>
          {title}
        </h1>
        <p className="text-zinc-400 dark:text-zinc-500 font-medium text-xs uppercase tracking-widest mt-2 pl-1">{subtitle}</p>
      </div>
      {action && <div className="flex gap-2.5">{action}</div>}
    </div>
  );
};

// --- COMPONENT PHÂN TRANG DÙNG CHUNG ---
export const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = memo(({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center items-center gap-3 mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/60 no-print">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="p-2.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed dark:text-zinc-400 text-zinc-500 transition-all"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="p-2.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed dark:text-zinc-400 text-zinc-500 transition-all"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
});

// --- COMPONENT MODAL XÁC NHẬN ---
export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ElementType;
  confirmButtonColor?: string;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  icon: Icon = AlertCircle,
  confirmButtonColor = 'bg-red-500 hover:bg-red-600',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} icon={Icon} color={confirmButtonColor.split(' ')[0]}>
      <div className="space-y-5">
        <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm">{message}</p>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-zinc-500 dark:text-zinc-400 font-medium text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} className={`px-6 py-2.5 text-white rounded-xl font-semibold text-sm shadow-sm transition-all ${confirmButtonColor}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// --- COMPONENT SKELETON LOADING ---
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-800/60 rounded-xl ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent" />
    </div>
  );
};
