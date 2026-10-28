import React from 'react';
import { QueueListIcon, TrashIcon } from '@heroicons/react/24/outline';

export interface ExtraCriterion {
  id: string;
  name: string;
  value: string;
  unit: string;
  limit: string;
}

export interface ExtraCriteriaSectionProps {
  extraCriteria: ExtraCriterion[];
  addToArray: (field: string, item: any) => void;
  updateInArray: (field: string, index: number, key: string, value: any) => void;
  removeFromArray: (field: string, index: number) => void;
}

export const ExtraCriteriaSection: React.FC<ExtraCriteriaSectionProps> = ({
  extraCriteria,
  addToArray,
  updateInArray,
  removeFromArray,
}) => {
  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-2">
          <QueueListIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> CHỈ TIÊU BỔ SUNG
        </h4>
        <button
          type="button"
          onClick={() =>
            addToArray('extraCriteria', {
              id: 'extra_' + Date.now(),
              name: '',
              value: '',
              unit: '',
              limit: '',
            })
          }
          className="text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-ink px-3 py-1.5 rounded-lg border border-border transition-colors"
        >
          + Thêm dòng
        </button>
      </div>
      {extraCriteria.map((item, idx) => (
        <div key={item.id} className="flex gap-2 items-start">
          <input
            placeholder="Tên chỉ tiêu"
            value={item.name}
            onChange={(e) => updateInArray('extraCriteria', idx, 'name', e.target.value)}
            className="flex-[2] px-3 py-2 bg-surface border border-border rounded-xl text-sm font-medium text-ink placeholder:text-ink-muted outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
          <input
            placeholder="Kết quả"
            value={item.value}
            onChange={(e) => updateInArray('extraCriteria', idx, 'value', e.target.value)}
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-xl text-sm font-semibold text-emerald-600 dark:text-emerald-400 placeholder:text-ink-muted outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
          <input
            placeholder="ĐVT"
            value={item.unit}
            onChange={(e) => updateInArray('extraCriteria', idx, 'unit', e.target.value)}
            className="w-20 px-3 py-2 bg-surface border border-border rounded-xl text-sm font-medium text-ink placeholder:text-ink-muted outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
          <button
            type="button"
            onClick={() => removeFromArray('extraCriteria', idx)}
            className="p-2 text-ink-muted hover:text-rose-500 transition-colors"
            title="Xóa chỉ tiêu"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
};
