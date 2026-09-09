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
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
          <IdentificationIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Tổng Master Catalog</div>
          <div className="text-xl font-bold text-ink">
            {metrics.total} <span className="text-xs font-normal text-ink-muted">nguyên liệu</span>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
          <BeakerIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Hoạt chất (Active)</div>
          <div className="text-xl font-bold text-ink">
            {metrics.activeCount} <span className="text-xs font-normal text-ink-muted">chất</span>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
        <div className="p-3 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-lg">
          <SquaresPlusIcon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Tá dược / Phụ liệu</div>
          <div className="text-xl font-bold text-ink">
            {metrics.excipientCount} <span className="text-xs font-normal text-ink-muted">chất</span>
          </div>
        </div>
      </div>

      <div className={`bg-surface border rounded-xl p-4 flex items-center gap-3.5 shadow-sm ${metrics.unlinkedIngredients > 0 ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20' : 'border-border'}`}>
        <div className={`p-3 rounded-lg ${metrics.unlinkedIngredients > 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'}`}>
          {metrics.unlinkedIngredients > 0 ? <ExclamationTriangleIcon className="h-5 w-5" /> : <CheckCircleIcon className="h-5 w-5" />}
        </div>
        <div>
          <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Chưa gắn mã Công thức</div>
          <div className="text-xl font-bold text-ink">
            {metrics.unlinkedIngredients} <span className="text-xs font-normal text-ink-muted">thành phần</span>
          </div>
        </div>
      </div>
    </div>
  );
};

