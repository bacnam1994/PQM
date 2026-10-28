import React from 'react';
import { Link } from 'react-router-dom';
import {
  Square3Stack3DIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  ShieldExclamationIcon,
  ArrowUpRightIcon,
} from '@heroicons/react/24/outline';
import { DashboardStats } from './types';
import { AnimatedNumber } from '../../../components/ui';

interface DashboardKpiCardsProps {
  stats: DashboardStats;
  alertsCount: number;
  highAlertsCount: number;
}

export const DashboardKpiCards: React.FC<DashboardKpiCardsProps> = ({
  stats,
  alertsCount,
  highAlertsCount,
}) => {
  const releasedRatio =
    stats.totalBatches > 0 ? Math.round((stats.releasedBatches / stats.totalBatches) * 100) : 0;

  return (
    <section
      aria-label="Chỉ số hiệu suất chất lượng cốt lõi"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5"
    >
      {/* TIER 1 — HERO METRIC CARD: Tỷ lệ đạt chỉ tiêu kiểm nghiệm (Accent-tinted primary card per ui-craft) */}
      <Link
        to="/test-results"
        className="group relative p-5 sm:p-6 rounded-xl bg-emerald-500/[0.05] dark:bg-emerald-500/[0.08] border border-emerald-500/30 hover:border-emerald-500/60 shadow-2xs hover:shadow-md hover:shadow-emerald-500/10 hover:-translate-y-0.5 transition-[transform,border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col justify-between overflow-hidden"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-emerald-800 dark:text-emerald-300">
              Tỷ lệ đạt kiểm nghiệm
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105">
              <ClipboardDocumentCheckIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight tabular-nums font-display leading-none">
              {stats.passRate !== null ? (
                <AnimatedNumber
                  value={stats.passRate}
                  suffix="%"
                  decimals={stats.passRate % 1 !== 0 ? 1 : 0}
                />
              ) : (
                '—'
              )}
            </div>

            {/* Inline SVG Sparkline showing pass rate trajectory */}
            <svg
              className="w-20 h-8 text-emerald-600 dark:text-emerald-400 shrink-0"
              viewBox="0 0 80 32"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="heroSparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M2 24 L18 20 L34 22 L50 14 L64 11 L78 6 L78 30 L2 30 Z"
                fill="url(#heroSparkFill)"
              />
              <polyline
                points="2,24 18,20 34,22 50,14 64,11 78,6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-xs text-ink-muted mt-2 tabular-nums">
            Tổng cộng {stats.totalResults} phiếu kiểm nghiệm trong kỳ
          </p>
        </div>

        <div className="pt-3.5 mt-4 border-t border-emerald-500/20 grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-bold text-ink tabular-nums">
                <AnimatedNumber value={stats.passResults} />
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">Phiếu đạt</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="font-bold text-ink tabular-nums">
                <AnimatedNumber value={stats.failResults} />
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">Không đạt</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="font-bold text-ink tabular-nums">
                <AnimatedNumber value={stats.pendingResults} />
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">Chờ KQ</span>
          </div>
        </div>
      </Link>

      {/* TIER 2 — SUPPORTING CARD 1: Tổng số lô sản xuất */}
      <Link
        to="/batches"
        className="group p-5 sm:p-6 rounded-xl bg-surface/90 dark:bg-surface/85 border border-border/80 hover:border-emerald-500/40 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-[transform,border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-ink-muted group-hover:text-ink transition-colors">
              Tổng số lô sản xuất
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-2 text-ink-soft group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center justify-center shrink-0 transition-colors">
              <Square3Stack3DIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[28px] sm:text-3xl font-bold text-ink tracking-tight tabular-nums font-display leading-none">
              <AnimatedNumber value={stats.totalBatches} />
            </div>
            <span className="text-xs text-ink-muted tabular-nums">
              {releasedRatio}% đã xuất xưởng
            </span>
          </div>

          {/* Proportion bar */}
          <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden flex mt-3">
            <div
              style={{ width: `${releasedRatio}%` }}
              className="h-full bg-emerald-500 transition-all duration-300"
            />
          </div>
        </div>

        <div className="pt-3.5 mt-4 border-t border-border/60 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Đã xuất
            </span>
            <span className="font-semibold text-ink tabular-nums">
              <AnimatedNumber value={stats.releasedBatches} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Đang kiểm
            </span>
            <span className="font-semibold text-ink tabular-nums">
              <AnimatedNumber value={stats.testingBatches} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Chờ duyệt
            </span>
            <span className="font-semibold text-ink tabular-nums">
              <AnimatedNumber value={stats.reviewBatches} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Không đạt
            </span>
            <span className="font-semibold text-ink tabular-nums">
              <AnimatedNumber value={stats.rejectedBatches} />
            </span>
          </div>
        </div>
      </Link>

      {/* TIER 2 — SUPPORTING CARD 2: Sản phẩm & TCCS */}
      <Link
        to="/products"
        className="group p-5 sm:p-6 rounded-xl bg-surface/90 dark:bg-surface/85 border border-border/80 hover:border-emerald-500/40 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-[transform,border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-ink-muted group-hover:text-ink transition-colors">
              Sản phẩm lưu hành
            </span>
            <div className="w-8 h-8 rounded-lg bg-surface-2 text-ink-soft group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center justify-center shrink-0 transition-colors">
              <CubeIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] sm:text-3xl font-bold text-ink tracking-tight tabular-nums font-display leading-none">
              <AnimatedNumber value={stats.activeProducts} />
            </span>
            <span className="text-sm font-medium text-ink-muted tabular-nums">
              / <AnimatedNumber value={stats.totalProducts} /> danh mục
            </span>
          </div>

          <p className="text-xs text-ink-muted mt-2">
            Hồ sơ tiêu chuẩn cơ sở & nguyên liệu đầu vào
          </p>
        </div>

        <div className="pt-3.5 mt-4 border-t border-border/60 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-semibold text-ink tabular-nums">
                <AnimatedNumber value={stats.activeTCCS} />
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">TCCS hiệu lực</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span className="font-semibold text-ink tabular-nums">
                <AnimatedNumber value={stats.totalMaterials} />
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">Nguyên liệu</span>
          </div>
        </div>
      </Link>

      {/* TIER 2 — SUPPORTING CARD 3: Cảnh báo chất lượng & Hạn dùng */}
      <Link
        to="/alerts"
        className="group p-5 sm:p-6 rounded-xl bg-surface/90 dark:bg-surface/85 border border-border/80 hover:border-emerald-500/40 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-[transform,border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-ink-muted group-hover:text-ink transition-colors">
              Cảnh báo & Hạn dùng
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                highAlertsCount > 0
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'bg-surface-2 text-ink-soft group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
              }`}
            >
              <ShieldExclamationIcon className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[28px] sm:text-3xl font-bold text-ink tracking-tight tabular-nums font-display leading-none">
              <AnimatedNumber value={alertsCount} />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <span>Chi tiết</span>
              <ArrowUpRightIcon className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>

          <p className="text-xs text-ink-muted mt-2">
            {highAlertsCount > 0
              ? `Có ${highAlertsCount} cảnh báo mức độ nghiêm trọng`
              : 'Hệ thống đang vận hành trong ngưỡng an toàn'}
          </p>
        </div>

        <div className="pt-3.5 mt-4 border-t border-border/60 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="font-semibold text-ink tabular-nums">
                <AnimatedNumber value={highAlertsCount} />
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">Mức cao (OOS)</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="font-semibold text-ink tabular-nums">
                <AnimatedNumber value={stats.expiringBatchesCount} />
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">Cận hạn ≤90 ngày</span>
          </div>
        </div>
      </Link>
    </section>
  );
};
