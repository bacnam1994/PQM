import React from 'react';

export const CpkBadge: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null || value === undefined || isNaN(value)) {
    return <span className="text-zinc-400 text-xs italic">Chưa đủ dữ liệu</span>;
  }
  const cls = value >= 1.33
    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    : value >= 1.0
    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
  const label = value >= 1.33 ? 'GMP chuẩn ≥1.33' : value >= 1.0 ? 'Tối thiểu ≥1.0' : 'Dưới chuẩn <1.0';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-black ${cls}`}>
      {value.toFixed(3)} <span className="font-medium opacity-70">— {label}</span>
    </span>
  );
};
