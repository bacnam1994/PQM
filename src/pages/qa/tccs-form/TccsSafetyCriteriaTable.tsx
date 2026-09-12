import React from 'react';
import { ShieldCheckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CriterionType, Criterion } from '../../../types';

interface TccsSafetyCriteriaTableProps {
  microbiologicalCriteria: Criterion[];
  heavyMetalCriteria: Criterion[];
  mycotoxinCriteria: Criterion[];
  onAdd: (category: 'microbiologicalCriteria' | 'heavyMetalCriteria' | 'mycotoxinCriteria') => void;
  onUpdate: (
    category: 'microbiologicalCriteria' | 'heavyMetalCriteria' | 'mycotoxinCriteria',
    index: number,
    field: string,
    value: any
  ) => void;
  onRemove: (
    category: 'microbiologicalCriteria' | 'heavyMetalCriteria' | 'mycotoxinCriteria',
    index: number
  ) => void;
  autoFormatInput: (val: string) => string;
  parseNumberFromText: (val: string) => number;
}

export const TccsSafetyCriteriaTable: React.FC<TccsSafetyCriteriaTableProps> = ({
  microbiologicalCriteria,
  heavyMetalCriteria,
  mycotoxinCriteria,
  onAdd,
  onUpdate,
  onRemove,
  autoFormatInput,
  parseNumberFromText,
}) => {
  const renderSafetyGroup = (
    title: string,
    category: 'microbiologicalCriteria' | 'heavyMetalCriteria' | 'mycotoxinCriteria',
    list: Criterion[],
    colorClass: string,
    emptyMessage?: string
  ) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div
          className={`flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${colorClass}`}
        >
          <ShieldCheckIcon className="w-4 h-4" /> {title}
        </div>
        <button
          type="button"
          onClick={() => onAdd(category)}
          className="p-2 bg-surface-2 text-ink-muted hover:text-ink rounded-lg hover:bg-surface-3 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {list.length === 0 && emptyMessage ? (
        <p className="text-xs text-ink-muted italic bg-surface-2 p-3 rounded-xl border border-border">
          {emptyMessage}
        </p>
      ) : (
        list.map((c, i) => (
          <div
            key={i}
            className="flex gap-2 items-center bg-surface-2 p-2 rounded-xl border border-border hover:border-border-strong transition-all"
          >
            <select
              value={c.type}
              onChange={(e) => onUpdate(category, i, 'type', e.target.value as any)}
              className="w-16 px-1 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"
            >
              <option value="NUMBER">Số</option>
              <option value="TEXT">Chữ</option>
            </select>
            <input
              placeholder="Tên chỉ tiêu"
              value={c.name}
              onChange={(e) => onUpdate(category, i, 'name', e.target.value)}
              className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"
            />
            <input
              placeholder="ĐVT"
              value={c.unit}
              onChange={(e) => onUpdate(category, i, 'unit', e.target.value)}
              className="w-16 px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none text-center border border-border shadow-xs"
            />
            {c.type === CriterionType.NUMBER ? (
              <div className="flex items-center gap-2 bg-surface px-3 w-32 border border-border shadow-xs rounded-lg">
                <span className="text-xs font-bold text-ink-muted">≤</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Max"
                  value={c.max ?? ''}
                  onChange={(e) => {
                    const v = autoFormatInput(e.target.value);
                    onUpdate(category, i, 'max', v === '' ? undefined : (v as any));
                  }}
                  onBlur={(e) => {
                    const v = e.target.value;
                    const n = parseNumberFromText(v);
                    if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) {
                      onUpdate(category, i, 'max', n);
                    }
                  }}
                  className="w-full bg-transparent py-2 text-xs font-semibold text-ink outline-none text-right font-mono"
                />
              </div>
            ) : (
              <input
                type="text"
                placeholder="Giới hạn chấp nhận"
                value={c.expectedText || ''}
                onChange={(e) => onUpdate(category, i, 'expectedText', e.target.value)}
                className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"
              />
            )}
            <button
              type="button"
              onClick={() => onRemove(category, i)}
              className="p-2 text-ink-muted hover:text-rose-500 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      {renderSafetyGroup(
        '3. Giới hạn Vi sinh vật',
        'microbiologicalCriteria',
        microbiologicalCriteria,
        'text-rose-600 dark:text-rose-400'
      )}
      {renderSafetyGroup(
        '4. Giới hạn Kim loại nặng',
        'heavyMetalCriteria',
        heavyMetalCriteria,
        'text-rose-600 dark:text-rose-400'
      )}
      {renderSafetyGroup(
        '5. Độc tố vi nấm & Chỉ tiêu An toàn khác',
        'mycotoxinCriteria',
        mycotoxinCriteria,
        'text-amber-600 dark:text-amber-400',
        'Chưa có chỉ tiêu độc tố vi nấm / dư lượng nào. Nhấn dấu (+) để thêm nếu sản phẩm yêu cầu.'
      )}
    </div>
  );
};
