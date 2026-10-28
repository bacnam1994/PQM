import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ShieldCheckIcon,
  PlusIcon,
  XMarkIcon,
  LinkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { CriterionType, Criterion, AlternateRule } from '../../../types';
import { useMasterCriteriaActiveQuery } from '../../../hooks/queries/useMasterCriterionQueries';
import { MasterCriterion } from '../../../types';

interface TccsSafetyCriteriaTableProps {
  microbiologicalCriteria: Criterion[];
  heavyMetalCriteria: Criterion[];
  mycotoxinCriteria: Criterion[];
  alternateRules?: AlternateRule[];
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

// ─── Autocomplete Combobox (giống TccsMainCriteriaTable) ───────────────────────

interface SafetyCriterionNameAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  onSelectMaster: (master: MasterCriterion) => void;
  categoryFilter?: 'SAFETY' | 'MICROBIO';
}

const SafetyCriterionNameAutocomplete: React.FC<SafetyCriterionNameAutocompleteProps> = ({
  value,
  onChange,
  onSelectMaster,
  categoryFilter,
}) => {
  const { data: masterCriteria = [] } = useMasterCriteriaActiveQuery();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!value || value.length < 1) return [];
    const q = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
    return masterCriteria
      .filter((mc) => {
        if (categoryFilter && mc.category !== categoryFilter) return false;
        const name = mc.canonicalName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd');
        return name.includes(q);
      })
      .slice(0, 6);
  }, [value, masterCriteria, categoryFilter]);

  useEffect(() => {
    setHighlightIdx(0);
    setIsOpen(suggestions.length > 0);
  }, [suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestions[highlightIdx]) {
      e.preventDefault();
      onSelectMaster(suggestions[highlightIdx]);
      onChange(suggestions[highlightIdx].canonicalName);
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative flex-[2]">
      <div className="relative">
        <input
          ref={inputRef}
          placeholder="Tên chỉ tiêu"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!e.target.value) setIsOpen(false);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs pr-7"
        />
        <MagnifyingGlassIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" />
      </div>
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-0.5 max-h-40 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl divide-y divide-border">
          {suggestions.map((mc, idx) => (
            <li
              key={mc.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectMaster(mc);
                onChange(mc.canonicalName);
                setIsOpen(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs transition-colors ${idx === highlightIdx ? 'bg-rose-50 dark:bg-rose-950/20' : 'hover:bg-surface-2'}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${mc.category === 'MICROBIO' ? 'bg-violet-400' : 'bg-rose-400'}`}
              />
              <span className="font-semibold text-ink truncate">{mc.canonicalName}</span>
              {mc.defaultUnit && (
                <span className="text-ink-muted ml-auto shrink-0">{mc.defaultUnit}</span>
              )}
              {mc.linkedMaterialId && <LinkIcon className="w-3 h-3 text-rose-500 shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const TccsSafetyCriteriaTable: React.FC<TccsSafetyCriteriaTableProps> = ({
  microbiologicalCriteria,
  heavyMetalCriteria,
  mycotoxinCriteria,
  alternateRules = [],
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
            <SafetyCriterionNameAutocomplete
              value={c.name}
              onChange={(name) => {
                onUpdate(category, i, 'name', name);
                if ((c as any).masterCriterionId)
                  onUpdate(category, i, 'masterCriterionId', undefined);
              }}
              onSelectMaster={(master) => {
                onUpdate(category, i, 'name', master.canonicalName);
                if (master.defaultUnit) onUpdate(category, i, 'unit', master.defaultUnit);
                if (master.type)
                  onUpdate(
                    category,
                    i,
                    'type',
                    master.type === 'TEXT' ? CriterionType.TEXT : CriterionType.NUMBER
                  );
                onUpdate(category, i, 'masterCriterionId', master.id);
              }}
              categoryFilter={category === 'microbiologicalCriteria' ? 'MICROBIO' : 'SAFETY'}
            />
            {(c as any).masterCriterionId && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40 shrink-0">
                <LinkIcon className="w-2.5 h-2.5" />
                Master
              </span>
            )}
            {/* Badge Quy tắc thay thế */}
            {(() => {
              const cNorm = (c.name || '').trim().toLowerCase();
              if (!cNorm) return null;
              const ruleAsMain = alternateRules.find(
                (r) => r.main && r.main.trim().toLowerCase() === cNorm
              );
              const ruleAsAlt = alternateRules.find(
                (r) => r.alt && r.alt.trim().toLowerCase() === cNorm
              );

              if (ruleAsMain) {
                return (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/70 shrink-0"
                    title={`Áp dụng quy tắc thay thế với: ${ruleAsMain.alt}`}
                  >
                    🔗 Có thay thế
                  </span>
                );
              }
              if (ruleAsAlt) {
                return (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/70 shrink-0"
                    title={`Phụ thuộc vào chỉ tiêu: ${ruleAsAlt.main}`}
                  >
                    ↳ Phụ thuộc: {ruleAsAlt.main}
                  </span>
                );
              }
              return null;
            })()}

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
