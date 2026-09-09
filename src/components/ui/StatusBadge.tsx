import React from 'react';

export type QMSStatusType =
  | 'PASS'
  | 'FAIL'
  | 'PENDING'
  | 'RELEASED'
  | 'REJECTED'
  | 'HOLD'
  | 'ACTIVE'
  | 'DISCONTINUED'
  | 'CRITICAL'
  | 'MAJOR'
  | 'MINOR'
  | 'CLOSED'
  | 'DRAFT'
  | 'APPROVED'
  | 'UNDER_INVESTIGATION'
  | 'TESTING';

export interface StatusBadgeProps {
  status: string;
  type?: string;
  label?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
  pulse?: boolean;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string; defaultLabel: string }> = {
  PASS: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    defaultLabel: 'ĐẠT'
  },
  RELEASED: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    defaultLabel: 'ĐÃ XUẤT XƯỞNG'
  },
  APPROVED: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    defaultLabel: 'ĐÃ PHÊ DUYỆT'
  },
  ACTIVE: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    defaultLabel: 'HIỆU LỰC'
  },
  FAIL: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/60',
    dot: 'bg-rose-500',
    defaultLabel: 'KHÔNG ĐẠT (OOS)'
  },
  REJECTED: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/60',
    dot: 'bg-rose-500',
    defaultLabel: 'TỪ CHỐI'
  },
  CRITICAL: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/60',
    dot: 'bg-rose-500',
    defaultLabel: 'NGHIÊM TRỌNG'
  },
  PENDING: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    defaultLabel: 'CHỜ DUYỆT'
  },
  TESTING: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    defaultLabel: 'ĐANG KIỂM NGHIỆM'
  },
  UNDER_INVESTIGATION: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    defaultLabel: 'ĐANG ĐIỀU TRA'
  },
  HOLD: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800/60',
    dot: 'bg-orange-500',
    defaultLabel: 'TẠM GIỮ'
  },
  MAJOR: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800/60',
    dot: 'bg-orange-500',
    defaultLabel: 'MỨC TRUNG'
  },
  MINOR: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800/60',
    dot: 'bg-blue-500',
    defaultLabel: 'MỨC NHẸ'
  },
  CLOSED: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    defaultLabel: 'ĐÃ ĐÓNG'
  },
  DRAFT: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    defaultLabel: 'BẢN NHÁP'
  },
  DISCONTINUED: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    defaultLabel: 'NGỪNG SX'
  }
};

/**
 * StatusBadge - Huy hiệu trạng thái nghiệp vụ chuẩn GMP
 * Áp dụng nguyên tắc Visual Hierarchy: Chỉ làm nổi bật trạng thái cốt lõi bằng dot và nền pastel dịu mắt.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  showDot = true,
  pulse = false,
  className = ''
}) => {
  const normKey = status ? status.toUpperCase().trim() : 'DRAFT';
  const cfg = statusConfig[normKey] || {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    defaultLabel: status || 'N/A'
  };

  const displayLabel = label !== undefined ? label : cfg.defaultLabel;

  const sizeStyles = {
    sm: 'text-[11px] font-semibold px-2.5 py-0.5 gap-1.5',
    md: 'text-xs font-bold px-3 py-1 gap-2'
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2'
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border transition-colors ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeStyles[size]} ${className}`}
    >
      {showDot && (
        <span
          className={`rounded-full shrink-0 ${cfg.dot} ${dotSizes[size]} ${
            pulse ? 'animate-pulse' : ''
          }`}
        />
      )}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
};
