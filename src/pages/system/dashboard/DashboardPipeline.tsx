import React from 'react';
import { Link } from 'react-router-dom';
import {
  ClockIcon,
  ClipboardDocumentCheckIcon,
  CheckBadgeIcon,
  ShieldExclamationIcon,
  DocumentCheckIcon,
  ArrowsRightLeftIcon,
  ArrowTrendingUpIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { DashboardStats, PipelineStageKey } from './types';
import { AnimatedNumber } from '../../../components/ui';

interface DashboardPipelineProps {
  stats: DashboardStats;
  selectedStage: PipelineStageKey;
  onSelectStage: (stage: PipelineStageKey) => void;
}

export const DashboardPipeline: React.FC<DashboardPipelineProps> = ({
  stats,
  selectedStage,
  onSelectStage,
}) => {
  const total = stats.totalBatches || 1;

  const stages = [
    {
      key: 'NOT_TESTED' as PipelineStageKey,
      step: '01',
      title: 'Chưa kiểm nghiệm',
      count: stats.notTestedBatches,
      percentage: Math.round((stats.notTestedBatches / total) * 100),
      description: 'Chưa phát sinh chỉ tiêu (0/N)',
      icon: ClockIcon,
      dotColor: 'bg-sky-500',
      activeBorder: 'border-sky-500/60 ring-2 ring-sky-500/15 bg-sky-500/[0.06]',
      barColor: 'bg-sky-500',
    },
    {
      key: 'IN_PROGRESS' as PipelineStageKey,
      step: '02',
      title: 'Đang kiểm nghiệm',
      count: stats.testingBatches,
      percentage: Math.round((stats.testingBatches / total) * 100),
      description: 'Phòng Lab đang phân tích chỉ tiêu',
      icon: ClipboardDocumentCheckIcon,
      dotColor: 'bg-amber-500',
      activeBorder: 'border-amber-500/60 ring-2 ring-amber-500/15 bg-amber-500/[0.06]',
      barColor: 'bg-amber-500',
    },
    {
      key: 'PENDING_REVIEW' as PipelineStageKey,
      step: '03',
      title: 'Chờ QA/QC đánh giá',
      count: stats.reviewBatches,
      percentage: Math.round((stats.reviewBatches / total) * 100),
      description: 'Đủ 100% chỉ tiêu, chờ kết luận',
      icon: DocumentCheckIcon,
      dotColor: 'bg-indigo-500',
      activeBorder: 'border-indigo-500/60 ring-2 ring-indigo-500/15 bg-indigo-500/[0.06]',
      barColor: 'bg-indigo-500',
    },
    {
      key: 'RELEASED' as PipelineStageKey,
      step: '04',
      title: 'Đã xuất xưởng',
      count: stats.releasedBatches,
      percentage: Math.round((stats.releasedBatches / total) * 100),
      description: 'Đạt chuẩn kiểm nghiệm & Xuất xưởng',
      icon: CheckBadgeIcon,
      dotColor: 'bg-emerald-500',
      activeBorder: 'border-emerald-500/60 ring-2 ring-emerald-500/15 bg-emerald-500/[0.06]',
      barColor: 'bg-emerald-500',
    },
    {
      key: 'REJECTED' as PipelineStageKey,
      step: '05',
      title: 'Không đạt / OOS',
      count: stats.rejectedBatches,
      percentage: Math.round((stats.rejectedBatches / total) * 100),
      description: 'Chỉ tiêu OOS / Từ chối xuất xưởng',
      icon: ShieldExclamationIcon,
      dotColor: 'bg-rose-500',
      activeBorder: 'border-rose-500/60 ring-2 ring-rose-500/15 bg-rose-500/[0.06]',
      barColor: 'bg-rose-500',
    },
  ];

  const activeStageObj = stages.find(
    (s) =>
      s.key === selectedStage ||
      (selectedStage === 'PENDING' && s.key === 'NOT_TESTED') ||
      (selectedStage === 'TESTING' && s.key === 'IN_PROGRESS') ||
      (selectedStage === 'REVIEW' && s.key === 'PENDING_REVIEW')
  );

  return (
    <section
      aria-label="Vòng đời chất lượng lô sản xuất GMP"
      className="p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/85 backdrop-blur-md border border-border/80 space-y-5 shadow-xs"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-ink font-display">
              Vòng đời kiểm nghiệm & Xuất xưởng lô (GMP Pipeline)
            </h2>
            {selectedStage !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                <FunnelIcon className="w-3 h-3" />
                <span>{activeStageObj?.title || selectedStage}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectStage('ALL');
                  }}
                  className="hover:text-rose-600 dark:hover:text-rose-400 ml-0.5 cursor-pointer"
                  title="Bỏ lọc giai đoạn"
                  aria-label="Bỏ lọc giai đoạn"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Chọn một giai đoạn trong quy trình 5 bước để lọc danh sách lô sản xuất bên dưới
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <Link
            to="/quality/comparison"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
            <span>Đối chiếu Lab</span>
          </Link>
          <Link
            to="/reports/trend-analysis"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
            <span>Phân tích SPC</span>
          </Link>
        </div>
      </div>

      {/* Cumulative proportion bar */}
      <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden flex gap-0.5">
        {stages.map((st) =>
          st.count > 0 ? (
            <div
              key={st.key}
              style={{ width: `${(st.count / total) * 100}%` }}
              className={`h-full ${st.barColor} transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
              title={`${st.title}: ${st.count} lô (${st.percentage}%)`}
            />
          ) : null
        )}
      </div>

      {/* 5 Sequential Process Stages Grid (Responsive: 1 col xs -> 2 cols sm -> 3 cols md -> 5 cols lg) */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {stages.map((st) => {
          const Icon = st.icon;
          const isSelected =
            selectedStage === st.key ||
            (selectedStage === 'PENDING' && st.key === 'NOT_TESTED') ||
            (selectedStage === 'TESTING' && st.key === 'IN_PROGRESS') ||
            (selectedStage === 'REVIEW' && st.key === 'PENDING_REVIEW');

          return (
            <button
              key={st.key}
              type="button"
              onClick={() => onSelectStage(isSelected ? 'ALL' : st.key)}
              aria-pressed={isSelected}
              className={`group p-4 rounded-xl border text-left cursor-pointer flex flex-col justify-between transition-[transform,border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 ${
                isSelected
                  ? st.activeBorder
                  : 'bg-surface-2/45 hover:bg-surface-2/80 border-border/80 hover:border-emerald-500/40 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${st.dotColor}`} />
                  <span className="font-mono text-[11px] font-medium text-ink-muted tabular-nums">
                    Bước {st.step}
                  </span>
                </div>
                <Icon className="w-4 h-4 text-ink-muted group-hover:text-ink transition-colors" />
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold text-ink tabular-nums font-display leading-none">
                    <AnimatedNumber value={st.count} />
                  </span>
                  <span className="text-xs font-medium text-ink-muted tabular-nums">
                    <AnimatedNumber value={st.percentage} suffix="%" />
                  </span>
                </div>
                <div className="text-[13px] font-semibold text-ink mt-2 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {st.title}
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5 line-clamp-1">
                  {st.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
