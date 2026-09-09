import React from 'react';
import { BookUser, Beaker, Component, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MaterialMetricsBarProps {
  metrics: {
    total: number;
    activeCount: number;
    excipientCount: number;
    usedCount: number;
    unusedCount: number;
    unlinkedIngredients: number;
  };
}

export const MaterialMetricsBar: React.FC<MaterialMetricsBarProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
          <BookUser size={22} />
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Tổng Master Catalog</div>
          <div className="text-xl font-black text-slate-800 dark:text-zinc-100">
            {metrics.total} <span className="text-xs font-medium text-slate-400">nguyên liệu</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
          <Beaker size={22} />
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Hoạt chất (Active)</div>
          <div className="text-xl font-black text-slate-800 dark:text-zinc-100">
            {metrics.activeCount} <span className="text-xs font-medium text-slate-400">chất</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
        <div className="p-3 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
          <Component size={22} />
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Tá dược / Phụ liệu</div>
          <div className="text-xl font-black text-slate-800 dark:text-zinc-100">
            {metrics.excipientCount} <span className="text-xs font-medium text-slate-400">chất</span>
          </div>
        </div>
      </div>

      <div className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs ${metrics.unlinkedIngredients > 0 ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/20' : 'border-slate-200/80 dark:border-zinc-800'}`}>
        <div className={`p-3 rounded-xl ${metrics.unlinkedIngredients > 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'}`}>
          {metrics.unlinkedIngredients > 0 ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
        </div>
        <div>
          <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Chưa gắn mã trong Công thức</div>
          <div className="text-xl font-black text-slate-800 dark:text-zinc-100">
            {metrics.unlinkedIngredients} <span className="text-xs font-medium text-slate-400">thành phần</span>
          </div>
        </div>
      </div>
    </div>
  );
};
