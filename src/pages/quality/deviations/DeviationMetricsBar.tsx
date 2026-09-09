/**
 * PQM V4 Platform - Deviation Metrics Bar
 * Thống kê KPI tổng hợp Sai lệch Chất lượng & Tiến độ CAPA theo chuẩn GMP-WHO
 */

import React from 'react';
import { 
  ChartBarSquareIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { QualityDeviation } from '../../../types/deviation';

interface DeviationMetricsBarProps {
  deviations: QualityDeviation[];
  onSelectFilter?: (status: string) => void;
  activeFilter?: string;
}

export const DeviationMetricsBar: React.FC<DeviationMetricsBarProps> = ({
  deviations,
  onSelectFilter,
  activeFilter = 'ALL'
}) => {
  const total = deviations.length;
  const criticalCount = deviations.filter(d => d.severity === 'CRITICAL' && d.status !== 'CLOSED').length;
  const loggedCount = deviations.filter(d => d.status === 'LOGGED').length;
  const investigatingCount = deviations.filter(d => d.status === 'UNDER_INVESTIGATION').length;
  const capaCount = deviations.filter(d => d.status === 'CAPA_PLANNED' || d.status === 'EFFECTIVENESS_REVIEW').length;
  const closedCount = deviations.filter(d => d.status === 'CLOSED').length;

  // Tính tổng số hành động CAPA quá hạn
  const nowStr = new Date().toISOString().split('T')[0];
  const overdueCapaCount = deviations.flatMap(d => d.capaItems || []).filter(item => {
    return item.status !== 'COMPLETED' && item.status !== 'VERIFIED' && item.deadline && item.deadline < nowStr;
  }).length;

  const cards = [
    {
      id: 'ALL',
      label: 'Tổng hồ sơ',
      count: total,
      sub: 'Tất cả nguồn',
      icon: ChartBarSquareIcon,
      color: 'text-ink',
      bg: 'bg-surface',
      border: 'border-border'
    },
    {
      id: 'CRITICAL',
      label: 'Critical mở',
      count: criticalCount,
      sub: 'Cần giải quyết ngay',
      icon: ExclamationCircleIcon,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20'
    },
    {
      id: 'LOGGED',
      label: 'Mới ghi nhận',
      count: loggedCount,
      sub: 'Chờ điều tra Phase 1',
      icon: ExclamationTriangleIcon,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20'
    },
    {
      id: 'UNDER_INVESTIGATION',
      label: 'Đang điều tra RCA',
      count: investigatingCount,
      sub: '5-Why / Ishikawa',
      icon: ClockIcon,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20'
    },
    {
      id: 'CAPA_PLANNED',
      label: 'Đang thực thi CAPA',
      count: capaCount,
      sub: overdueCapaCount > 0 ? `${overdueCapaCount} hành động quá hạn` : 'Đúng tiến độ',
      icon: ClipboardDocumentCheckIcon,
      color: overdueCapaCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-purple-600 dark:text-purple-400',
      bg: overdueCapaCount > 0 ? 'bg-orange-500/10' : 'bg-purple-500/10',
      border: overdueCapaCount > 0 ? 'border-orange-500/30' : 'border-purple-500/20'
    },
    {
      id: 'CLOSED',
      label: 'Đã đóng (Closed)',
      count: closedCount,
      sub: 'Đạt chuẩn xuất xưởng',
      icon: CheckCircleIcon,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        const isSelected = activeFilter === c.id;

        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectFilter?.(c.id)}
            className={`p-3.5 rounded-2xl border text-left transition-all ${c.bg} ${c.border} ${
              isSelected ? 'ring-2 ring-emerald-500 shadow-md scale-[1.02]' : 'hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-muted">
                {c.label}
              </span>
              <Icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black ${c.color}`}>{c.count}</span>
            </div>
            <p className="text-[10px] font-medium text-ink-muted truncate mt-1">
              {c.sub}
            </p>
          </button>
        );
      })}
    </div>
  );
};
