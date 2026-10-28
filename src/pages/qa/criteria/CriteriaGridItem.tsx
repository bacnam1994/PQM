import React, { memo } from 'react';
import { BeakerIcon, PencilSquareIcon, LinkIcon } from '@heroicons/react/24/outline';
import { DSCard } from '../../../components';
import { CriteriaSummary } from './types';

export interface CriteriaGridItemProps {
  item: CriteriaSummary;
  onEdit: (item: CriteriaSummary) => void;
  isAdmin: boolean;
  masterCriteriaMap: Map<string, string>;
}

export const CriteriaGridItem = memo(
  ({ item, onEdit, isAdmin, masterCriteriaMap }: CriteriaGridItemProps) => {
    const isLinked = !!item.masterCriterionId && masterCriteriaMap.has(item.masterCriterionId);
    return (
      <DSCard className="p-5 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group relative overflow-hidden h-full bg-surface border border-border">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 relative z-10">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            <BeakerIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Chỉ tiêu phân tích</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isLinked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60">
                <LinkIcon className="w-3 h-3" /> Master
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink-muted border border-border">
              Tần suất: {item.count}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-3 relative z-10 flex-grow">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100 dark:border-emerald-900/30">
              <BeakerIcon className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="font-semibold text-ink text-base leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 truncate">
                {item.name}
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                Sử dụng trong {item.relatedTCCS.length} hồ sơ
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2.5 border-t border-border mt-auto">
            <div className="flex flex-wrap gap-1.5">
              {item.relatedTCCS.slice(0, 3).map((t, idx) => (
                <span
                  key={idx}
                  className="bg-surface border border-border px-2 py-0.5 rounded text-xs font-medium text-ink-soft truncate max-w-full"
                  title={t.product}
                >
                  {t.code}
                </span>
              ))}
              {item.relatedTCCS.length > 3 && (
                <span className="bg-surface-3 px-1.5 py-0.5 rounded text-xs text-ink-muted font-medium border border-border">
                  +{item.relatedTCCS.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {isAdmin && (
          <div className="flex items-center justify-between pt-3 mt-auto border-t border-border relative z-10">
            <div className="opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(item)}
                className="p-1.5 text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-2 rounded-lg transition-all"
                title="Đổi tên chỉ tiêu"
              >
                <PencilSquareIcon className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => onEdit(item)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-2 text-ink-soft hover:bg-surface-3 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all ml-auto border border-border"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" /> Đổi tên
            </button>
          </div>
        )}
      </DSCard>
    );
  }
);
