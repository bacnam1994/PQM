import React, { memo } from 'react';
import { PencilSquareIcon, LinkIcon } from '@heroicons/react/24/outline';
import { CriteriaSummary } from './types';

export interface CriteriaListItemProps {
  item: CriteriaSummary;
  onEdit: (item: CriteriaSummary) => void;
  isAdmin: boolean;
  masterCriteriaMap: Map<string, string>;
}

export const CriteriaListItem = memo(
  ({ item, onEdit, isAdmin, masterCriteriaMap }: CriteriaListItemProps) => {
    const isLinked = !!item.masterCriterionId && masterCriteriaMap.has(item.masterCriterionId);
    return (
      <tr className="hover:bg-surface-2 transition-colors group">
        <td className="px-6 py-3.5 font-medium text-ink text-sm">{item.name}</td>
        <td className="px-6 py-3.5 text-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
            {item.count}
          </span>
        </td>
        <td className="px-6 py-3.5">
          <div className="flex flex-wrap gap-1">
            {item.relatedTCCS.slice(0, 3).map((t, idx) => (
              <span
                key={idx}
                className="text-xs bg-surface text-ink-soft px-2 py-0.5 rounded border border-border truncate max-w-[150px]"
                title={t.product}
              >
                {t.code}
              </span>
            ))}
            {item.relatedTCCS.length > 3 && (
              <span className="text-xs bg-surface-3 text-ink-muted px-1.5 py-0.5 rounded border border-border font-medium">
                +{item.relatedTCCS.length - 3}
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-3.5 text-center">
          {isLinked ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60">
              <LinkIcon className="w-3 h-3" /> Đã liên kết
            </span>
          ) : (
            <span className="text-[10px] text-ink-muted">Chưa liên kết</span>
          )}
        </td>
        <td className="px-6 py-3.5 text-right">
          {isAdmin && (
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-2 rounded-lg transition-all"
              title="Đổi tên chỉ tiêu"
            >
              <PencilSquareIcon className="w-4 h-4" />
            </button>
          )}
        </td>
      </tr>
    );
  }
);
