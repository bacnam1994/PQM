import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { DateRangeFilter, DashboardStats, PipelineStageKey } from './types';
import { MOTION_SPRINGS } from '../../../lib/motion';

// Gauge Chart Component — Precision SVG Arc with optical centering & tabular-nums
const GaugeChart: React.FC<{
  passRate: number | null;
  passResults: number;
  totalResults: number;
}> = ({ passRate, passResults, totalResults }) => {
  // -90° = 0%, +90° = 100%
  const needleRotation = -90 + ((passRate ?? 0) / 100) * 180;

  let qualityGrade = 'Chưa có dữ liệu';
  let gradeBadge = 'bg-surface-2 text-ink-muted border-border';

  if (passRate !== null) {
    if (passRate >= 95) {
      qualityGrade = 'Đạt chuẩn GMP · Tối ưu';
      gradeBadge = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25';
    } else if (passRate >= 85) {
      qualityGrade = 'Phù hợp TCCS';
      gradeBadge = 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25';
    } else {
      qualityGrade = 'Cần kiểm soát OOS';
      gradeBadge = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25';
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      {/* SVG Gauge Arc */}
      <div className="relative w-40 h-20 overflow-hidden">
        <svg className="w-40 h-40 transform -rotate-180" viewBox="0 0 100 100">
          {/* Track background */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeDasharray="125.6 126"
            strokeLinecap="round"
            className="text-surface-3"
          />
          {/* Vùng đỏ: 0-60% */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#ef4444"
            strokeWidth="7"
            strokeDasharray="75.4 126"
            strokeDashoffset="-75.4"
            strokeLinecap="round"
            className="opacity-75"
          />
          {/* Vùng vàng: 60-85% */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="7"
            strokeDasharray="31.4 126"
            strokeDashoffset="-94.2"
            strokeLinecap="round"
            className="opacity-85"
          />
          {/* Vùng xanh: 85-100% */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#10b981"
            strokeWidth="7"
            strokeDasharray="37.7 126"
            strokeDashoffset="-125.6"
            strokeLinecap="round"
          />
        </svg>

        {/* Kim đo xoay động */}
        <div
          className="absolute bottom-0 left-1/2 w-0.5 h-13 bg-ink origin-bottom rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] z-10"
          style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
        />
        {/* Trụ kim trung tâm */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-surface shadow-xs border-2 border-emerald-600 z-20" />
      </div>

      {/* Nhãn giá trị & Tỷ lệ */}
      <div className="text-center -mt-0.5">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-[28px] leading-none font-extrabold tracking-tight tabular-nums text-ink font-display">
            {passRate !== null ? `${passRate}%` : '—'}
          </span>
          <span className="text-xs text-ink-muted font-medium">đạt chuẩn</span>
        </div>
        <div className="flex items-center justify-center mt-1.5">
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${gradeBadge}`}
          >
            {qualityGrade}
          </span>
        </div>
        <div className="text-[11px] text-ink-muted mt-1 tabular-nums">
          {passResults} / {totalResults} phiếu kiểm nghiệm
        </div>
      </div>
    </div>
  );
};

interface DashboardHeaderProps {
  stats: DashboardStats;
  user: any;
  dateRange: DateRangeFilter;
  setDateRange: (range: DateRangeFilter) => void;
  syncStatus: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  selectedStage?: PipelineStageKey;
  onSelectStage?: (stage: PipelineStageKey) => void;
}

const DATE_RANGE_OPTIONS: { key: DateRangeFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: '30D', label: '30 ngày' },
  { key: '90D', label: '90 ngày' },
  { key: 'YTD', label: 'Năm nay' },
];

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  stats,
  user,
  dateRange,
  setDateRange,
  onRefresh,
  isRefreshing,
  selectedStage,
  onSelectStage,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Quản lý';
  const userRole = user?.role || (user?.isAdmin ? 'ADMIN' : 'USER');

  const roleMeta = useMemo(() => {
    switch (userRole) {
      case 'ADMIN':
        return {
          label: 'Quản trị viên hệ thống',
          badge: 'bg-surface-2 text-ink-soft border-border',
        };
      case 'QA':
        return {
          label: 'QA · Đảm bảo chất lượng',
          badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
        };
      case 'QC':
        return {
          label: 'QC · Kiểm soát chất lượng',
          badge: 'bg-surface-2 text-ink-soft border-border',
        };
      case 'LAB':
        return {
          label: 'Phòng Lab · Kiểm nghiệm viên',
          badge: 'bg-surface-2 text-ink-soft border-border',
        };
      case 'PRODUCTION':
        return {
          label: 'Sản xuất · Quản đốc phân xưởng',
          badge: 'bg-surface-2 text-ink-soft border-border',
        };
      case 'VIEWER':
        return {
          label: 'Thanh tra · Quyền quan sát',
          badge: 'bg-surface-2 text-ink-soft border-border',
        };
      default:
        return {
          label: 'Nhân viên nghiệp vụ',
          badge: 'bg-surface-2 text-ink-soft border-border',
        };
    }
  }, [userRole]);

  const todayFormatted = useMemo(() => {
    const d = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[d.getDay()];
    const dateStr = d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${dayName}, ${dateStr}`;
  }, []);

  const statusBreakdown: {
    key: PipelineStageKey;
    label: string;
    count: number;
    dotColor: string;
  }[] = [
    {
      key: 'RELEASED',
      label: 'Đã xuất xưởng',
      count: stats.releasedBatches,
      dotColor: 'bg-emerald-500',
    },
    {
      key: 'IN_PROGRESS',
      label: 'Đang kiểm tại Lab',
      count: stats.testingBatches,
      dotColor: 'bg-amber-500',
    },
    {
      key: 'PENDING_REVIEW',
      label: 'Chờ đánh giá QA/QC',
      count: stats.reviewBatches,
      dotColor: 'bg-indigo-500',
    },
    {
      key: 'NOT_TESTED',
      label: 'Chưa kiểm nghiệm',
      count: stats.notTestedBatches,
      dotColor: 'bg-sky-500',
    },
    {
      key: 'REJECTED',
      label: 'Không đạt / OOS',
      count: stats.rejectedBatches,
      dotColor: 'bg-rose-500',
    },
  ];

  return (
    <section
      aria-label="Tổng quan điều hành chất lượng"
      className="p-5 sm:p-6 lg:p-7 rounded-2xl bg-surface/90 dark:bg-surface/85 backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden border border-border/80 shadow-xs"
    >
      {/* Subtle single-hue ambient highlight (90% neutral + 1 brand accent rule) */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/[0.06] rounded-full blur-3xl pointer-events-none" />

      {/* Left content block — Golden Ratio vertical spacing (12px -> 20px) */}
      <div className="space-y-4 max-w-3xl z-10 flex-1 min-w-0">
        {/* Metadata context row */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleMeta.badge}`}
          >
            <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            {roleMeta.label}
          </span>

          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <CalendarDaysIcon className="w-3.5 h-3.5" />
            {todayFormatted}
          </span>
        </div>

        {/* Focal Headline & Concise Operational Summary */}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-[28px] font-bold tracking-tight text-ink font-display leading-tight">
            {greeting}, <span className="text-emerald-600 dark:text-emerald-400">{userName}</span>
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1.5 leading-relaxed max-w-[68ch]">
            Đang giám sát{' '}
            <strong className="text-ink font-semibold tabular-nums">{stats.totalBatches}</strong> lô
            sản xuất và{' '}
            <strong className="text-ink font-semibold tabular-nums">{stats.totalResults}</strong>{' '}
            phiếu kiểm nghiệm. Hiện có{' '}
            <strong className="text-ink font-semibold tabular-nums">{stats.testingBatches}</strong>{' '}
            lô đang phân tích tại Lab và{' '}
            <strong
              className={`font-semibold tabular-nums ${
                stats.rejectedBatches > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink'
              }`}
            >
              {stats.rejectedBatches}
            </strong>{' '}
            lô cảnh báo OOS.
          </p>
        </div>

        {/* Interactive Status Breakdown Strip — inline 6px semantic dots */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-border/60">
          {statusBreakdown.map((item) => {
            const isActive = selectedStage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectStage && onSelectStage(isActive ? 'ALL' : item.key)}
                className={`group inline-flex items-center gap-2 py-1 px-2 -mx-2 rounded-lg text-left transition-[background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'hover:bg-surface-2/80 text-ink-soft hover:text-ink'
                }`}
                title={`Nhấn để lọc nhanh giai đoạn: ${item.label}`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${item.dotColor}`} />
                <span className="text-sm font-bold text-ink tabular-nums">{item.count}</span>
                <span className="text-xs text-ink-muted group-hover:text-ink-soft transition-colors">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date Filter Toolbar & Primary Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Date range segmented control with Spring Gliding Pill */}
          <div
            role="group"
            aria-label="Bộ lọc khoảng thời gian"
            className="inline-flex items-center p-1 bg-surface-2/80 rounded-xl border border-border/80"
          >
            {DATE_RANGE_OPTIONS.map((opt) => {
              const active = dateRange === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDateRange(opt.key)}
                  className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150 cursor-pointer z-10 ${
                    active ? 'text-white' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="dashboard-date-range-pill"
                      transition={shouldReduceMotion ? { duration: 0 } : MOTION_SPRINGS.snappy}
                      className="absolute inset-0 rounded-lg bg-emerald-600 shadow-2xs -z-10"
                    />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Action links */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-surface-2/80 hover:bg-surface-3 border border-border/80 hover:border-border text-ink-muted hover:text-ink active:scale-95 transition-[transform,background-color,color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer"
              title="Làm mới dữ liệu"
              aria-label="Làm mới dữ liệu"
            >
              <ArrowPathIcon
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`}
              />
            </button>

            <Link
              to="/reports/quality-summary"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow-md hover:shadow-emerald-500/15 transition-[transform,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              <DocumentTextIcon className="w-4 h-4 shrink-0" />
              <span>Báo cáo tổng hợp (PQR)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Right Gauge Chart Card — Responsive full-width on mobile, compact on desktop */}
      <div className="p-5 bg-surface-2/50 dark:bg-surface-2/30 border border-border/80 rounded-xl shrink-0 flex flex-col items-center justify-center z-10 w-full sm:w-auto sm:min-w-[220px] self-stretch lg:self-center">
        <GaugeChart
          passRate={stats.passRate}
          passResults={stats.passResults}
          totalResults={stats.totalResults}
        />
      </div>
    </section>
  );
};
