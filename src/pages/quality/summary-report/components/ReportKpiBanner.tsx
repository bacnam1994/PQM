import React from 'react';
import { 
  DocumentTextIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ChartBarIcon 
} from '@heroicons/react/24/outline';
import { DSCard } from '../../../../components';

interface ReportKpiBannerProps {
  stats: {
    total: number;
    pass: number;
    fail: number;
    passRate: string;
  };
}

export const ReportKpiBanner: React.FC<ReportKpiBannerProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <DSCard className="p-4 flex items-center gap-3.5 hover:shadow-md transition-shadow">
        <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
          <DocumentTextIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Tổng số lô kiểm nghiệm</div>
          <div className="text-xl font-black text-ink mt-0.5">{stats.total} <span className="text-xs font-medium text-ink-muted">lô</span></div>
        </div>
      </DSCard>

      <DSCard className="p-4 flex items-center gap-3.5 hover:shadow-md transition-shadow">
        <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
          <CheckCircleIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Lô Đạt tiêu chuẩn</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.pass} <span className="text-xs font-medium text-ink-muted">lô</span></div>
        </div>
      </DSCard>

      <DSCard className="p-4 flex items-center gap-3.5 hover:shadow-md transition-shadow">
        <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20">
          <XCircleIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Lô Không đạt (OOS)</div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{stats.fail} <span className="text-xs font-medium text-ink-muted">lô</span></div>
        </div>
      </DSCard>

      <DSCard className="p-4 flex items-center gap-3.5 hover:shadow-md transition-shadow">
        <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20">
          <ChartBarIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Tỷ lệ đạt chuẩn</div>
          <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">{stats.passRate}</div>
        </div>
      </DSCard>
    </div>
  );
};
