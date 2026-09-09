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
  | 'TESTING'
  | 'LOGGED'
  | 'CAPA_PLANNED';

/** @alias backward-compat alias for GMPStatus used in new workbench components */
export type GMPStatus = QMSStatusType;

export interface StatusBadgeProps {
  status: string;
  type?: string;
  label?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
  pulse?: boolean;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; ring: string; dot: string; defaultLabel: string }> = {
  PASS: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/30',
    dot: 'fill-emerald-500',
    defaultLabel: 'ĐẠT'
  },
  RELEASED: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/30',
    dot: 'fill-emerald-500',
    defaultLabel: 'ĐÃ XUẤT XƯỞNG'
  },
  APPROVED: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/30',
    dot: 'fill-emerald-500',
    defaultLabel: 'ĐÃ PHÊ DUYỆT'
  },
  ACTIVE: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/30',
    dot: 'fill-emerald-500',
    defaultLabel: 'HIỆU LỰC'
  },
  FAIL: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-1 ring-inset ring-rose-600/20 dark:ring-rose-500/30',
    dot: 'fill-rose-500',
    defaultLabel: 'KHÔNG ĐẠT (OOS)'
  },
  REJECTED: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-1 ring-inset ring-rose-600/20 dark:ring-rose-500/30',
    dot: 'fill-rose-500',
    defaultLabel: 'TỪ CHỐI'
  },
  CRITICAL: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-1 ring-inset ring-rose-600/20 dark:ring-rose-500/30',
    dot: 'fill-rose-500',
    defaultLabel: 'NGHIÊM TRỌNG'
  },
  PENDING: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-1 ring-inset ring-amber-600/20 dark:ring-amber-500/30',
    dot: 'fill-amber-500',
    defaultLabel: 'CHỜ DUYỆT'
  },
  TESTING: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-1 ring-inset ring-amber-600/20 dark:ring-amber-500/30',
    dot: 'fill-amber-500',
    defaultLabel: 'ĐANG KIỂM NGHIỆM'
  },
  UNDER_INVESTIGATION: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-1 ring-inset ring-amber-600/20 dark:ring-amber-500/30',
    dot: 'fill-amber-500',
    defaultLabel: 'ĐANG ĐIỀU TRA'
  },
  HOLD: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    ring: 'ring-1 ring-inset ring-orange-600/20 dark:ring-orange-500/30',
    dot: 'fill-orange-500',
    defaultLabel: 'TẠM GIỮ'
  },
  MAJOR: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-300',
    ring: 'ring-1 ring-inset ring-orange-600/20 dark:ring-orange-500/30',
    dot: 'fill-orange-500',
    defaultLabel: 'MỨC TRUNG'
  },
  MINOR: {
    bg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/30',
    dot: 'fill-emerald-500',
    defaultLabel: 'MỨC NHẸ'
  },
  CLOSED: {
    bg: 'bg-surface-3/60 text-ink',
    text: 'text-ink-soft dark:text-ink-faint',
    ring: 'ring-1 ring-inset ring-border',
    dot: 'fill-ink-faint',
    defaultLabel: 'ĐÃ ĐÓNG'
  },
  DRAFT: {
    bg: 'bg-surface-3/60 text-ink',
    text: 'text-ink-soft dark:text-ink-faint',
    ring: 'ring-1 ring-inset ring-border',
    dot: 'fill-ink-faint',
    defaultLabel: 'BẢN NHÁP'
  },
  DISCONTINUED: {
    bg: 'bg-surface-3/60 text-ink',
    text: 'text-ink-soft dark:text-ink-faint',
    ring: 'ring-1 ring-inset ring-border',
    dot: 'fill-ink-faint',
    defaultLabel: 'NGỪNG SX'
  },
  LOGGED: {
    bg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/30',
    dot: 'fill-emerald-500',
    defaultLabel: 'ĐÃ GHI NHẬN'
  },
  CAPA_PLANNED: {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-300',
    ring: 'ring-1 ring-inset ring-teal-600/20 dark:ring-teal-500/30',
    dot: 'fill-teal-500',
    defaultLabel: 'ĐÃ LẬP CAPA'
  }
};

/**
 * StatusBadge - Tailwind UI Status Badge with Dot Indicator
 * Áp dụng nguyên tắc Visual Hierarchy chuẩn Tailwind UI: Dot indicator SVG, ring inset viền mảnh và nền nhẹ dịu mắt.
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
    bg: 'bg-surface-3/60 text-ink',
    text: 'text-ink-soft dark:text-ink-faint',
    ring: 'ring-1 ring-inset ring-border',
    dot: 'fill-ink-faint',
    defaultLabel: status || 'N/A'
  };

  const displayLabel = label !== undefined ? label : cfg.defaultLabel;

  const sizeStyles = {
    sm: 'text-[11px] font-medium px-2 py-0.5 gap-x-1.5',
    md: 'text-xs font-semibold px-2.5 py-1 gap-x-1.5'
  };

  return (
    <span
      className={`inline-flex items-center rounded-full transition-colors ${cfg.bg} ${cfg.text} ${cfg.ring} ${sizeStyles[size]} ${className}`}
    >
      {showDot && (
        <svg
          viewBox="0 0 6 6"
          aria-hidden="true"
          className={`h-1.5 w-1.5 ${cfg.dot} shrink-0 ${pulse ? 'animate-pulse' : ''}`}
        >
          <circle r={3} cx={3} cy={3} />
        </svg>
      )}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
};

