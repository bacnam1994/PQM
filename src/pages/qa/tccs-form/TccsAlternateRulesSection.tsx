import React from 'react';
import {
  ArrowsRightLeftIcon,
  PlusIcon,
  XMarkIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { AlternateRule } from '../../../types';

interface TccsAlternateRulesSectionProps {
  alternateRules: AlternateRule[];
  allCriteriaNames: string[];
  onAddRule: () => void;
  onUpdateRule: (index: number, field: string, value: any) => void;
  onRemoveRule: (index: number) => void;
}

export const TccsAlternateRulesSection: React.FC<TccsAlternateRulesSectionProps> = ({
  alternateRules,
  allCriteriaNames,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
}) => {
  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
          <ArrowsRightLeftIcon className="w-4 h-4" /> 6. Điều kiện thay thế (Tự động Pass)
        </div>
        <button
          type="button"
          onClick={onAddRule}
          className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {alternateRules.map((rule, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 bg-surface-2 p-3 rounded-xl border border-border"
        >
          <div className="flex items-center gap-2">
            <select
              value={rule.main}
              onChange={(e) => onUpdateRule(i, 'main', e.target.value)}
              className="flex-1 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"
            >
              <option value="">-- TC1 (Chỉ tiêu chính) --</option>
              {allCriteriaNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ArrowRightIcon className="w-4 h-4 text-ink-muted shrink-0" />
            <select
              value={rule.alt}
              onChange={(e) => onUpdateRule(i, 'alt', e.target.value)}
              className="flex-1 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"
            >
              <option value="">-- TC2 (Chỉ tiêu phụ thuộc) --</option>
              {allCriteriaNames
                .filter((n) => n !== rule.main)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => onRemoveRule(i)}
              className="p-2 text-ink-muted hover:text-rose-500 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 pl-2">
            <select
              value={rule.type || 'FAIL_RETRY'}
              onChange={(e) => onUpdateRule(i, 'type', e.target.value as any)}
              className="px-2 py-1.5 bg-surface text-ink rounded-lg text-xs font-medium outline-none border border-border shadow-xs"
            >
              <option value="FAIL_RETRY">Nếu TC1 RỚT -&gt; Kiểm tra TC2</option>
              <option value="CONDITIONAL_CHECK">
                Nếu TC1 ĐẠT và &gt; Giá trị -&gt; Kiểm tra TC2
              </option>
            </select>
            {rule.type === 'CONDITIONAL_CHECK' && (
              <input
                type="number"
                placeholder="Ngưỡng..."
                value={rule.conditionValue || ''}
                onChange={(e) => onUpdateRule(i, 'conditionValue', e.target.value)}
                className="w-24 px-2 py-1.5 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
