import React from 'react';

export const TrendTooltip: React.FC<any> = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl shadow-xl p-3 text-xs space-y-1.5 max-w-[240px]">
      <p className="font-bold text-ink text-[11px] border-b border-border pb-1 mb-1">{label}</p>
      {payload.map((p: any) => {
        const pct = p.payload?.percent;
        return (
          <div key={p.dataKey} className="space-y-0.5">
            <div className="flex justify-between gap-3">
              <span className="text-ink-muted truncate">{p.name}</span>
              <span className="font-bold" style={{ color: p.color }}>
                {typeof p.value === 'number' && !isNaN(p.value) ? p.value.toFixed(4) : p.value} {unit}
              </span>
            </div>
            {pct !== null && pct !== undefined && !isNaN(pct) && (
              <div className="flex justify-between gap-3 text-[11px]">
                <span className="text-ink-muted">% so với công bố:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{pct.toFixed(1)}%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
