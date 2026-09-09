/**
 * PQM V4 Platform - Deviation Metrics Bar
 * Thống kê KPI tổng hợp Sai lệch Chất lượng & Tiến độ CAPA theo chuẩn GMP-WHO
 */

import React from 'react';
import { 
  ShieldAlert, AlertTriangle, AlertOctagon, Clock, 
  CheckCircle2, Activity, ListChecks 
} from 'lucide-react';
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
      icon: Activity,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/30',
      border: 'border-indigo-100 dark:border-indigo-900/50'
    },
    {
      id: 'CRITICAL',
      label: 'Critical mở',
      count: criticalCount,
      sub: 'Cần giải quyết ngay',
      icon: AlertOctagon,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      border: 'border-rose-100 dark:border-rose-900/50'
    },
    {
      id: 'LOGGED',
      label: 'Mới ghi nhận',
      count: loggedCount,
      sub: 'Chờ điều tra Phase 1',
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-100 dark:border-amber-900/50'
    },
    {
      id: 'UNDER_INVESTIGATION',
      label: 'Đang điều tra RCA',
      count: investigatingCount,
      sub: '5-Why / Ishikawa',
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      border: 'border-blue-100 dark:border-blue-900/50'
    },
    {
      id: 'CAPA_PLANNED',
      label: 'Đang thực thi CAPA',
      count: capaCount,
      sub: overdueCapaCount > 0 ? `${overdueCapaCount} hành động quá hạn` : 'Đúng tiến độ',
      icon: ListChecks,
      color: overdueCapaCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-purple-600 dark:text-purple-400',
      bg: overdueCapaCount > 0 ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-purple-50 dark:bg-purple-950/30',
      border: overdueCapaCount > 0 ? 'border-orange-200 dark:border-orange-800' : 'border-purple-100 dark:border-purple-900/50'
    },
    {
      id: 'CLOSED',
      label: 'Đã đóng (Closed)',
      count: closedCount,
      sub: 'Đạt chuẩn xuất xưởng',
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-100 dark:border-emerald-900/50'
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
              isSelected ? 'ring-2 ring-indigo-500 shadow-md scale-[1.02]' : 'hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {c.label}
              </span>
              <Icon size={16} className={c.color} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black ${c.color}`}>{c.count}</span>
            </div>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mt-1">
              {c.sub}
            </p>
          </button>
        );
      })}
    </div>
  );
};
