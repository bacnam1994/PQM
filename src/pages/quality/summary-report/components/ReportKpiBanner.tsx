import React from 'react';
import { FileText, CheckCircle2, XCircle, Activity } from 'lucide-react';
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
      <DSCard className="p-4 flex items-center gap-3.5">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
          <FileText size={22} />
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Tổng số lô kiểm nghiệm</div>
          <div className="text-xl font-black text-slate-800 dark:text-zinc-100">{stats.total} <span className="text-xs font-medium text-slate-400">lô</span></div>
        </div>
      </DSCard>

      <DSCard className="p-4 flex items-center gap-3.5">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
          <CheckCircle2 size={22} />
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Lô Đạt tiêu chuẩn</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{stats.pass} <span className="text-xs font-medium text-slate-400">lô</span></div>
        </div>
      </DSCard>

      <DSCard className="p-4 flex items-center gap-3.5">
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
          <XCircle size={22} />
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Lô Không đạt (OOS)</div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400">{stats.fail} <span className="text-xs font-medium text-slate-400">lô</span></div>
        </div>
      </DSCard>

      <DSCard className="p-4 flex items-center gap-3.5">
        <div className="p-3 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
          <Activity size={22} />
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Tỷ lệ đạt chuẩn</div>
          <div className="text-xl font-black text-purple-600 dark:text-purple-400">{stats.passRate}</div>
        </div>
      </DSCard>
    </div>
  );
};
