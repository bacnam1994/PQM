import React from 'react';
import { DSCard } from '../../../../components';
import { CpkBadge } from './CpkBadge';

interface StatsSummaryCardsProps {
  chartDataLength: number;
  spcStats: any;
  selectedCriteria: any;
}

export const StatsSummaryCards: React.FC<StatsSummaryCardsProps> = ({
  chartDataLength,
  spcStats,
  selectedCriteria
}) => {
  if (!spcStats) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <DSCard className="p-4">
        <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Số lô phân tích</p>
        <span className="text-2xl font-black text-slate-800 dark:text-zinc-100">{chartDataLength}</span>
      </DSCard>

      <DSCard className="p-4">
        <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Trung bình (X̄)</p>
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{spcStats.mean.toFixed(3)}</span>
          {selectedCriteria?.unit && <span className="text-xs text-slate-400 font-bold">{selectedCriteria.unit}</span>}
        </div>
        {spcStats.meanPercent !== null && (
          <p className="text-xs font-black text-indigo-600 dark:text-indigo-300 mt-0.5 font-mono">
            = {spcStats.meanPercent.toFixed(1)}% <span className="font-normal text-[10px] opacity-75">công bố</span>
          </p>
        )}
        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">σ={spcStats.std.toFixed(3)} | CV={spcStats.cv.toFixed(1)}%</p>
      </DSCard>

      <DSCard className="p-4">
        <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Năng lực quá trình</p>
        <div className="mt-1">
          <CpkBadge value={spcStats.cpk} />
        </div>
      </DSCard>

      <DSCard className="p-4">
        <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Ngoài kiểm soát</p>
        <span className={`text-2xl font-black ${spcStats.outOfControl.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {spcStats.outOfControl.length}
        </span>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {spcStats.outOfSpec.length > 0 ? `${spcStats.outOfSpec.length} ngoài tiêu chuẩn` : 'Không lô nào ngoài spec'}
        </p>
      </DSCard>
    </div>
  );
};
