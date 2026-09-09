import React from 'react';

export const TrendTooltip: React.FC<any> = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-lg p-3 text-xs space-y-1.5 max-w-[240px]">
      <p className="font-black text-slate-700 dark:text-zinc-200 text-[11px] border-b border-slate-100 dark:border-zinc-800 pb-1 mb-1">{label}</p>
      {payload.map((p: any) => {
        const pct = p.payload?.percent;
        return (
          <div key={p.dataKey} className="space-y-0.5">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-zinc-400 truncate">{p.name}</span>
              <span className="font-bold" style={{ color: p.color }}>
                {typeof p.value === 'number' && !isNaN(p.value) ? p.value.toFixed(4) : p.value} {unit}
              </span>
            </div>
            {pct !== null && pct !== undefined && !isNaN(pct) && (
              <div className="flex justify-between gap-3 text-[11px]">
                <span className="text-slate-400">% so với công bố:</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono">{pct.toFixed(1)}%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
