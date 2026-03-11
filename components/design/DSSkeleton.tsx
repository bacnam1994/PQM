import React from 'react';

// ============================================
// SKELETON LOADING - With shimmer effect
// ============================================

export interface DSSkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const DSSkeleton: React.FC<DSSkeletonProps> = ({ className = '', variant = 'rectangular' }) => {
  const baseClass = 'relative overflow-hidden bg-slate-200/80 dark:bg-slate-700/80';
  const variantClass = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };
  
  return (
    <div className={`${baseClass} ${variantClass[variant]} ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 dark:via-slate-400/30 to-transparent" />
    </div>
  );
};

// ============================================
// SKELETON CARD
// ============================================

export const DSSkeletonCard: React.FC = () => (
  <div className="glass rounded-2xl border border-white/20 dark:border-slate-600/30 p-5 shadow-lg">
    <div className="flex justify-between items-start mb-4">
      <DSSkeleton variant="circular" className="w-12 h-12" />
      <DSSkeleton className="w-20 h-6 rounded-full" />
    </div>
    <DSSkeleton className="h-5 w-3/4 mb-2" />
    <DSSkeleton className="h-3 w-1/2 mb-4" />
    <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-3">
      <DSSkeleton className="h-3 w-full" />
      <DSSkeleton className="h-3 w-2/3" />
    </div>
  </div>
);

// ============================================
// SKELETON TABLE
// ============================================

export interface DSSkeletonTableProps {
  rows?: number;
  columns?: number;
}

export const DSSkeletonTable: React.FC<DSSkeletonTableProps> = ({ rows = 5, columns = 5 }) => (
  <div className="glass rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg overflow-x-auto">
    <table className="w-full text-left min-w-[600px]">
      <thead className="bg-gradient-to-r from-slate-50/80 to-slate-100/80 dark:from-slate-700/50 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-600">
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <DSSkeleton className="h-4 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <tr key={rowIdx} className="hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-transparent dark:hover:from-emerald-900/20 dark:hover:to-transparent transition-all duration-300">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <td key={colIdx} className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                <DSSkeleton className="h-4 w-full" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default DSSkeleton;

