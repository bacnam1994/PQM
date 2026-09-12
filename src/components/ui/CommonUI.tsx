import React, { memo, Fragment } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  TagIcon,
  ShieldCheckIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { BATCH_STATUS, PRODUCT_STATUS, TEST_RESULT_STATUS } from '../../utils/constants';

// --- BỘ NHẬN DIỆN TRẠNG THÁI DÙNG CHUNG ---
export const LegacyStatusBadge: React.FC<{ type: string; status: string }> = memo(({ type, status }) => {
  const configs: Record<string, any> = {
    PRODUCT: {
      [PRODUCT_STATUS.ACTIVE]: { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-inset ring-emerald-600/20', icon: TagIcon, label: 'Đang công bố' },
      [PRODUCT_STATUS.DISCONTINUED]: { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ring-1 ring-inset ring-amber-600/20', icon: ExclamationCircleIcon, label: 'Ngừng SX' },
      [PRODUCT_STATUS.RECALLED]: { bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-1 ring-inset ring-rose-600/20', icon: XMarkIcon, label: 'Thu hồi' },
    },
    BATCH: {
      [BATCH_STATUS.PENDING]: { bg: 'bg-surface-3/60 text-ink-soft ring-1 ring-inset ring-border', icon: ClockIcon, label: 'Kế hoạch' },
      [BATCH_STATUS.TESTING]: { bg: 'bg-emerald-600 text-white shadow-xs', icon: ArrowPathIcon, label: 'Đang kiểm', spin: true },
      [BATCH_STATUS.RELEASED]: { bg: 'bg-emerald-600 text-white shadow-xs', icon: ShieldCheckIcon, label: 'Phê duyệt' },
      [BATCH_STATUS.REJECTED]: { bg: 'bg-rose-600 text-white shadow-xs', icon: XMarkIcon, label: 'Loại bỏ' },
    },
    RESULT: {
      [TEST_RESULT_STATUS.PASS]: { bg: 'bg-emerald-600 text-white shadow-xs', icon: CheckCircleIcon, label: 'ĐẠT (PASS)' },
      [TEST_RESULT_STATUS.FAIL]: { bg: 'bg-rose-600 text-white shadow-xs', icon: ExclamationTriangleIcon, label: 'LỖI (FAIL)' },
    }
  };

  const config = configs[type]?.[status] || { bg: 'bg-surface-3/60 text-ink-faint ring-1 ring-inset ring-border', icon: QuestionMarkCircleIcon, label: status };
  const Icon = config.icon;

  return (
    <span className={`${config.bg} px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide flex items-center gap-1.5 w-fit whitespace-nowrap`}>
      {Icon && <Icon className={`w-3.5 h-3.5 ${config.spin ? 'animate-spin' : ''}`} />}
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
        <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-surface-3/80 dark:text-surface-3" />
        <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} className={`${colorClass} transition-all duration-500 ease-in-out`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[9px] font-semibold text-ink-soft">{progress}%</span>
    </div>
  );
};

// --- WRAPPER CHO CÁC MODAL (Chuẩn Tailwind UI + Headless UI Dialog) ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; icon?: any; color?: string }> = ({
  isOpen,
  onClose,
  title,
  children,
  icon: Icon,
  color = 'bg-emerald-600 text-white'
}) => {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto p-4 sm:p-6 md:p-8 flex min-h-full items-center justify-center text-center">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel className="relative transform overflow-hidden rounded-2xl bg-surface text-left shadow-2xl transition-all w-full max-w-2xl border border-border">
              {/* Header with accent indicator */}
              <div className="relative px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/40">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent" />
                <div className="flex items-center gap-3">
                  {Icon && (
                    <div className={`${color} p-2 rounded-xl shadow-xs shrink-0 flex items-center justify-center`}>
                      {React.isValidElement(Icon) ? Icon : <Icon className="w-5 h-5" />}
                    </div>
                  )}
                  <DialogTitle as="h3" className="text-base font-semibold leading-6 text-ink tracking-tight">
                    {title}
                  </DialogTitle>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors"
                >
                  <span className="sr-only">Đóng</span>
                  <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">{children}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

// --- TIÊU ĐỀ TRANG DÙNG CHUNG (LEGACY) ---
export const LegacyPageHeader: React.FC<{ title: string; subtitle: string; icon: any; action?: React.ReactNode }> = ({ title, subtitle, icon, action }) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon;
    return <IconComp className="w-5 h-5" />;
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-3">
          <div className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
            {renderIcon()}
          </div>
          {title}
        </h1>
        <p className="text-ink-muted font-medium text-xs mt-1.5 pl-1">{subtitle}</p>
      </div>
      {action && <div className="flex gap-2.5">{action}</div>}
    </div>
  );
};

// --- COMPONENT PHÂN TRANG DÙNG CHUNG (Tailwind UI Standard Pagination) ---
export const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = memo(({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center items-center gap-3 mt-6 pt-4 border-t border-border no-print">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed text-ink transition-colors shadow-2xs"
        aria-label="Trang trước"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
      <span className="text-xs font-medium text-ink-muted tabular-nums">
        Trang <span className="font-semibold text-ink">{currentPage}</span> / <span className="font-semibold text-ink">{totalPages}</span>
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed text-ink transition-colors shadow-2xs"
        aria-label="Trang tiếp theo"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
});

// --- COMPONENT MODAL XÁC NHẬN (Tailwind UI Confirmation Dialog) ---
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
  icon: Icon = ExclamationTriangleIcon,
  confirmButtonColor = 'bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} icon={Icon} color="bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
      <div className="space-y-5">
        <div className="text-ink-soft text-sm leading-relaxed">{message}</div>
        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-ink-soft hover:text-ink font-medium text-sm hover:bg-surface-2 rounded-lg transition-colors border border-border"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg font-medium text-sm shadow-xs transition-all ${confirmButtonColor}`}
          >
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
    <div className={`relative overflow-hidden bg-surface-2/80 dark:bg-surface-3/60 rounded-xl ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-surface/40 dark:via-surface/10 to-transparent" />
    </div>
  );
};

