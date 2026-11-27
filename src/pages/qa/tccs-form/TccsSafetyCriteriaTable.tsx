import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ShieldCheckIcon,
  PlusIcon,
  XMarkIcon,
  LinkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { CriterionType, Criterion, AlternateRule } from '../../../types';
import {
  useExistingCriteriaSuggestions,
  filterCriteriaSuggestions,
  CriterionSuggestionItem,
  SuggestionCategory,
} from './useExistingCriteriaSuggestions';

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

// ─── Autocomplete Combobox cho Chỉ tiêu An toàn ───────────────────────────────

interface SafetyCriterionNameAutocompleteProps {
  value: string;
  allSuggestions: CriterionSuggestionItem[];
  onChange: (name: string) => void;
  onSelectSuggestion: (item: CriterionSuggestionItem) => void;
  preferredCategories: SuggestionCategory[];
}

const SafetyCriterionNameAutocomplete: React.FC<SafetyCriterionNameAutocompleteProps> = ({
  value,
  allSuggestions,
  onChange,
  onSelectSuggestion,
  preferredCategories,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = useMemo(() => {
    return filterCriteriaSuggestions(allSuggestions, value, {
      preferredCategories,
      limit: 8,
    });
  }, [value, allSuggestions, preferredCategories]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      else setHighlightIdx((i) => Math.min(i + 1, Math.max(suggestions.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && isOpen && suggestions[highlightIdx]) {
      e.preventDefault();
      onSelectSuggestion(suggestions[highlightIdx]);
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-[2]">
      <div className="relative">
        <input
          ref={inputRef}
          placeholder="Nhập hoặc chọn chỉ tiêu đã có..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs pr-7 focus:border-rose-400 dark:focus:border-rose-600 transition-colors"
        />
        <MagnifyingGlassIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" />
      </div>
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl divide-y divide-border/50">
          {suggestions.map((mc, idx) => (
            <li
              key={mc.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectSuggestion(mc);
                setIsOpen(false);
              }}
              className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer text-xs transition-colors ${
                idx === highlightIdx ? 'bg-rose-50 dark:bg-rose-950/20' : 'hover:bg-surface-2'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    mc.category === 'MICROBIO'
                      ? 'bg-violet-400'
                      : mc.category === 'MYCOTOXIN'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-ink truncate">{mc.canonicalName}</span>
                  {(mc.defaultUnit || mc.sampleLimitText) && (
                    <span className="text-[10px] text-ink-muted truncate">
                      {mc.defaultUnit && <span className="font-mono">ĐVT: {mc.defaultUnit}</span>}
                      {mc.sampleLimitText && (
                        <span className="ml-1.5 text-rose-600 dark:text-rose-400">
                          · {mc.sampleLimitText}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {mc.usageCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                    {mc.usageCount} TCCS
                  </span>
                )}
                {mc.masterCriterionId && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                    Master
                  </span>
                )}
              </div>
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
  const allSuggestions = useExistingCriteriaSuggestions();

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
              allSuggestions={allSuggestions}
              onChange={(name) => {
                onUpdate(category, i, 'name', name);
                if ((c as any).masterCriterionId)
                  onUpdate(category, i, 'masterCriterionId', undefined);
              }}
              onSelectSuggestion={(suggestion) => {
                onUpdate(category, i, 'name', suggestion.canonicalName);
                if (suggestion.defaultUnit && !c.unit) {
                  onUpdate(category, i, 'unit', suggestion.defaultUnit);
                }
                if (suggestion.type) {
                  onUpdate(category, i, 'type', suggestion.type);
                }
                if (suggestion.masterCriterionId) {
                  onUpdate(category, i, 'masterCriterionId', suggestion.masterCriterionId);
                }
                // Tự động điền giới hạn mẫu nếu dòng mới chưa nhập giới hạn
                if (
                  suggestion.type === CriterionType.NUMBER &&
                  suggestion.sampleMax !== undefined &&
                  c.max === undefined
                ) {
                  onUpdate(category, i, 'max', suggestion.sampleMax);
                } else if (
                  suggestion.type === CriterionType.TEXT &&
                  suggestion.sampleExpectedText &&
                  !c.expectedText
                ) {
                  onUpdate(category, i, 'expectedText', suggestion.sampleExpectedText);
                }
              }}
              preferredCategories={
                category === 'microbiologicalCriteria'
                  ? ['MICROBIO']
                  : category === 'heavyMetalCriteria'
                    ? ['HEAVY_METAL']
                    : ['MYCOTOXIN', 'SAFETY']
              }
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
              list="criteria-unit-suggestions"
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
