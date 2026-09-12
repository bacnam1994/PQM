import React from 'react';
import {
  IdentificationIcon,
  BeakerIcon,
  SquaresPlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

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
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
          <IdentificationIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">Tổng Master Catalog</div>
          <div className="text-xl font-bold text-ink tabular-nums mt-0.5">
            {metrics.total} <span className="text-xs font-normal text-ink-muted">nguyên liệu</span>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
        <div className="w-10 h-10 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center shrink-0">
          <BeakerIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">Hoạt chất (Active)</div>
          <div className="text-xl font-bold text-ink tabular-nums mt-0.5">
            {metrics.activeCount} <span className="text-xs font-normal text-ink-muted">chất</span>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
        <div className="w-10 h-10 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg flex items-center justify-center shrink-0">
          <SquaresPlusIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">Tá dược / Phụ liệu</div>
          <div className="text-xl font-bold text-ink tabular-nums mt-0.5">
            {metrics.excipientCount} <span className="text-xs font-normal text-ink-muted">chất</span>
          </div>
        </div>
      </div>

      <div className={`bg-surface border rounded-xl p-4 flex items-center gap-3.5 shadow-xs ${metrics.unlinkedIngredients > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border'}`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${metrics.unlinkedIngredients > 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
          {metrics.unlinkedIngredients > 0 ? <ExclamationTriangleIcon className="h-5 w-5" /> : <CheckCircleIcon className="h-5 w-5" />}
        </div>
        <div>
          <div className="text-xs font-medium text-ink-muted">Chưa gắn mã công thức</div>
          <div className="text-xl font-bold text-ink tabular-nums mt-0.5">
            {metrics.unlinkedIngredients} <span className="text-xs font-normal text-ink-muted">thành phần</span>
          </div>
        </div>
      </div>
    </div>
  );
};

