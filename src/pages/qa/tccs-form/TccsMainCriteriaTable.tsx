import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChartBarSquareIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  ArrowDownRightIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { CriterionType, Criterion, AlternateRule } from '../../../types';
import {
  DosageFormType,
  checkTCCSFormulaConflicts,
} from '../../../services/ai/tccsAssistantService';
import {
  useExistingCriteriaSuggestions,
  filterCriteriaSuggestions,
  CriterionSuggestionItem,
} from './useExistingCriteriaSuggestions';

// ─── Autocomplete Combobox cho tên chỉ tiêu ──────────────────────────────────

interface CriterionNameAutocompleteProps {
  value: string;
  allSuggestions: CriterionSuggestionItem[];
  onChange: (name: string, suggestion?: CriterionSuggestionItem) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Autocomplete combobox cho ô "Tên chỉ tiêu" trong TCCS Form.
 * - Gợi ý tổng hợp từ: Thành phần Công thức SP đang chọn + Hồ sơ TCCS đã có (kèm tần suất) + Master Criteria + Alias + PKN + Chuẩn Dược điển.
 * - Hỗ trợ tìm kiếm tiếng Việt có dấu & không dấu (normalizeSearch) và phím mũi tên ↑/↓/Enter.
 * - Khi chọn: tự động điền tên, đơn vị tính (defaultUnit), kiểu dữ liệu (Số/Chữ), liên kết Master/Công thức.
 */
const CriterionNameAutocomplete: React.FC<CriterionNameAutocompleteProps> = ({
  value,
  allSuggestions,
  onChange,
  placeholder = 'Nhập hoặc chọn chỉ tiêu đã có...',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync nếu value thay đổi từ bên ngoài (VD: reset form)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Lọc gợi ý không dấu + ưu tiên nhóm Chất lượng chính / Cảm quan / Công thức
  const suggestions = React.useMemo(() => {
    return filterCriteriaSuggestions(allSuggestions, query, {
      preferredCategories: ['QUALITY', 'SENSORY'],
      limit: 10,
    });
  }, [query, allSuggestions]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [suggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    // Gõ tự do → truyền lên không kèm suggestion
    onChange(v, undefined);
  };

  const handleSelect = useCallback(
    (item: CriterionSuggestionItem) => {
      setQuery(item.canonicalName);
      setOpen(false);
      onChange(item.canonicalName, item);
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlightIdx((prev) => Math.min(prev + 1, Math.max(suggestions.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Enter' && open && suggestions[highlightIdx]) {
      e.preventDefault();
      handleSelect(suggestions[highlightIdx]);
    }
  };

  const hasExactMatch = React.useMemo(() => {
    if (!query || !query.trim()) return true;
    const qLower = query.trim().toLowerCase();
    return allSuggestions.some((c) => c.canonicalName.toLowerCase() === qLower);
  }, [query, allSuggestions]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs focus:border-amber-400 dark:focus:border-amber-600 transition-colors"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-border/50">
          {suggestions.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 transition-colors text-left group ${
                idx === highlightIdx ? 'bg-amber-50/80 dark:bg-amber-950/30' : 'hover:bg-surface-2'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <LinkIcon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    item.source === 'FORMULA'
                      ? 'text-emerald-500'
                      : item.masterCriterionId
                        ? 'text-indigo-500'
                        : 'text-amber-500'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-ink truncate">
                    {item.canonicalName}
                  </span>
                  <span className="text-[10px] text-ink-muted truncate">
                    {item.defaultUnit ? (
                      <span className="font-mono font-semibold text-ink-soft">
                        ĐVT: {item.defaultUnit}
                      </span>
                    ) : (
                      <span>
                        {item.type === CriterionType.TEXT ? 'Định tính (Chữ)' : 'Định lượng (Số)'}
                      </span>
                    )}
                    {item.sampleLimitText && (
                      <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">
                        · {item.sampleLimitText}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {item.source === 'FORMULA' && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    Công thức SP
                  </span>
                )}
                {item.usageCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    {item.usageCount} TCCS
                  </span>
                )}
                {item.masterCriterionId && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                    Master
                  </span>
                )}
              </div>
            </button>
          ))}
          {query.trim() && !hasExactMatch && (
            <div className="px-3 py-2 bg-surface-2">
              <p className="text-[10px] text-ink-muted italic">
                💡 Nhập tên mới: <strong>"{query.trim()}"</strong> sẽ được lưu trực tiếp vào TCCS
                này.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface TccsMainCriteriaTableProps {
  mainCriteria: Criterion[];
  productId: string;
  selectedFormula: any;
  productIngredients: any[];
  alternateRules?: AlternateRule[];
  onApplyPharmacopoeiaTemplate: (dosageForm: DosageFormType) => void;
  onFetchCriteriaFromFormula: (tolerancePercent: number) => void;
  onAddCriterion: () => void;
  onUpdateCriterion: (index: number, field: string, value: any) => void;
  onRemoveCriterion: (index: number) => void;
  calculateRangePreview: (text: string) => string | null;
  autoFormatInput: (val: string) => string;
  parseNumberFromText: (val: string) => number;
}

export const TccsMainCriteriaTable: React.FC<TccsMainCriteriaTableProps> = ({
  mainCriteria,
  productId,
  selectedFormula,
  productIngredients,
  alternateRules = [],
  onApplyPharmacopoeiaTemplate,
  onFetchCriteriaFromFormula,
  onAddCriterion,
  onUpdateCriterion,
  onRemoveCriterion,
  calculateRangePreview,
  autoFormatInput,
  parseNumberFromText,
}) => {
  const allSuggestions = useExistingCriteriaSuggestions(productIngredients);
  const conflicts =
    productId && selectedFormula ? checkTCCSFormulaConflicts(mainCriteria, selectedFormula) : [];

  /**
   * Xử lý khi người dùng chọn tên từ Autocomplete.
   * - Cập nhật name
   * - Tự động điền unit, type, masterCriterionId, và liên kết công thức nếu có
   */
  const handleNameChange = useCallback(
    (index: number, name: string, suggestion?: CriterionSuggestionItem) => {
      onUpdateCriterion(index, 'name', name);
      const currentRow = mainCriteria[index];
      if (suggestion) {
        if (suggestion.masterCriterionId) {
          onUpdateCriterion(index, 'masterCriterionId', suggestion.masterCriterionId);
        }
        // Auto-điền unit khi ô unit đang trống
        if (suggestion.defaultUnit && !currentRow?.unit) {
          onUpdateCriterion(index, 'unit', suggestion.defaultUnit);
        }
        // Auto-điền kiểu Số/Chữ nếu dòng mới chưa nhập giới hạn
        const isRowUntouched =
          currentRow?.min === undefined &&
          currentRow?.max === undefined &&
          !currentRow?.expectedText;
        if (isRowUntouched && suggestion.type) {
          onUpdateCriterion(index, 'type', suggestion.type);
        }
        // Nếu gợi ý từ Công thức sản phẩm → tự động điền hàm lượng công bố & liên kết thành phần
        if (suggestion.declaredContent !== undefined && !currentRow?.declaredContent) {
          onUpdateCriterion(index, 'declaredContent', suggestion.declaredContent);
        }
        if (suggestion.formulaIngredientName && !currentRow?.formulaIngredientId) {
          onUpdateCriterion(index, 'formulaIngredientId', suggestion.formulaIngredientName);
        }
      } else {
        // Gõ tự do → xóa FK cũ nếu có (tránh stale FK)
        if (currentRow?.masterCriterionId) {
          onUpdateCriterion(index, 'masterCriterionId', undefined);
        }
      }
    },
    [onUpdateCriterion, mainCriteria]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
          <ChartBarSquareIcon className="h-4 w-4" /> 2. Chỉ tiêu Chất lượng chính
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Dropdown Mẫu Dược điển */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                onApplyPharmacopoeiaTemplate(e.target.value as DosageFormType);
                e.target.value = '';
              }
            }}
            className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 px-2.5 py-1.5 rounded-lg outline-none cursor-pointer hover:bg-indigo-100 transition-colors"
            defaultValue=""
          >
            <option value="" disabled>
              📖 AI Gợi ý mẫu Dược điển...
            </option>
            <option value="TABLET">💊 Viên nén (DĐVN V)</option>
            <option value="CAPSULE">💊 Viên nang (DĐVN V)</option>
            <option value="SYRUP">🧪 Siro / Dung dịch uống</option>
            <option value="POWDER_GRANULE">🌾 Cốm / Bột pha</option>
            <option value="INJECTION">💉 Thuốc tiêm / Truyền</option>
            <option value="CREAM_OINTMENT">🧴 Thuốc mỡ / Kem</option>
          </select>

          {/* Dropdown Đồng bộ Công thức */}
          <select
            disabled={!productId}
            onChange={(e) => {
              if (e.target.value) {
                onFetchCriteriaFromFormula(Number(e.target.value));
                e.target.value = '';
              }
            }}
            className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1.5 rounded-lg outline-none cursor-pointer hover:bg-emerald-100 transition-colors disabled:opacity-50"
            defaultValue=""
          >
            <option value="" disabled>
              ⚡ Đồng bộ từ Công thức...
            </option>
            <option value="5">Chuẩn Dược điển (±5%)</option>
            <option value="10">Chuẩn TCCS thông thường (±10%)</option>
            <option value="20">Biên độ rộng (±20%)</option>
          </select>

          <button
            type="button"
            onClick={onAddCriterion}
            className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors border border-amber-200 dark:border-amber-800/40"
            title="Thêm chỉ tiêu thủ công"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cảnh báo mâu thuẫn giữa Công thức & TCCS */}
      {conflicts.length > 0 && (
        <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-1">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <ExclamationCircleIcon className="h-4 w-4 text-amber-600" /> Cảnh báo đồng bộ Công thức
            & TCCS:
          </p>
          <ul className="text-xs font-medium text-amber-700 dark:text-amber-400 space-y-0.5 pl-4 list-disc">
            {conflicts.map((warn, wIdx) => (
              <li key={wIdx}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Danh sách từng dòng chỉ tiêu */}
      {mainCriteria.map((c, i) => {
        const minParsed =
          c.min !== undefined && c.min !== null && String(c.min).trim() !== ''
            ? parseNumberFromText(String(c.min))
            : NaN;
        const maxParsed =
          c.max !== undefined && c.max !== null && String(c.max).trim() !== ''
            ? parseNumberFromText(String(c.max))
            : NaN;
        const isMinMaxError =
          c.type === CriterionType.NUMBER &&
          !isNaN(minParsed) &&
          !isNaN(maxParsed) &&
          minParsed > maxParsed;

        const isLinked = !!c.masterCriterionId;

        return (
          <div
            key={i}
            className={`flex flex-col gap-1 p-2 rounded-xl border transition-all group ${
              isMinMaxError
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-surface-2 border-border hover:border-border-strong'
            }`}
          >
            <div className="flex gap-2 items-center">
              <select
                value={c.type}
                onChange={(e) => onUpdateCriterion(i, 'type', e.target.value as any)}
                className="w-16 px-1 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"
              >
                <option value="NUMBER">Số</option>
                <option value="TEXT">Chữ</option>
              </select>

              {/* ── Autocomplete thay thế input text thô ── */}
              <div className="flex-[2] relative">
                <CriterionNameAutocomplete
                  value={c.name}
                  allSuggestions={allSuggestions}
                  onChange={(name, suggestion) => handleNameChange(i, name, suggestion)}
                />
                {/* Badge hiển thị khi đã liên kết Master */}
                {isLinked && (
                  <span
                    className="absolute -top-1.5 right-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 pointer-events-none"
                    title={`Đã liên kết: ${c.masterCriterionId}`}
                  >
                    <LinkIcon className="w-2.5 h-2.5" /> Master
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
                        className="absolute -top-1.5 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/70"
                        title={`Áp dụng quy tắc thay thế với: ${ruleAsMain.alt}`}
                      >
                        🔗 Có thay thế
                      </span>
                    );
                  }
                  if (ruleAsAlt) {
                    return (
                      <span
                        className="absolute -top-1.5 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/70"
                        title={`Phụ thuộc vào chỉ tiêu: ${ruleAsAlt.main}`}
                      >
                        ↳ Phụ thuộc: {ruleAsAlt.main}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              <input
                placeholder="ĐVT"
                list="criteria-unit-suggestions"
                value={c.unit}
                onChange={(e) => onUpdateCriterion(i, 'unit', e.target.value)}
                className="w-16 px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none text-center border border-border shadow-xs"
              />
              {c.type === CriterionType.NUMBER ? (
                <>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Min"
                    value={c.min ?? ''}
                    onChange={(e) => {
                      const v = autoFormatInput(e.target.value);
                      onUpdateCriterion(i, 'min', v === '' ? undefined : (v as any));
                    }}
                    onBlur={(e) => {
                      const v = e.target.value;
                      const hasSci = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻^×xX]/.test(v);
                      const n = parseNumberFromText(v);
                      if (v !== '' && !isNaN(n) && !v.trim().endsWith('.') && !hasSci) {
                        onUpdateCriterion(i, 'min', n);
                      }
                    }}
                    className="w-24 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none text-right border border-border shadow-xs font-mono"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Max"
                    value={c.max ?? ''}
                    onChange={(e) => {
                      const v = autoFormatInput(e.target.value);
                      onUpdateCriterion(i, 'max', v === '' ? undefined : (v as any));
                    }}
                    onBlur={(e) => {
                      const v = e.target.value;
                      const hasSci = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻^×xX]/.test(v);
                      const n = parseNumberFromText(v);
                      if (v !== '' && !isNaN(n) && !v.trim().endsWith('.') && !hasSci) {
                        onUpdateCriterion(i, 'max', n);
                      }
                    }}
                    className="w-24 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none text-right border border-border shadow-xs font-mono"
                  />
                </>
              ) : (
                <div className="flex-[2] flex flex-col gap-0.5">
                  <input
                    type="text"
                    placeholder="Mô tả mức chất lượng chấp nhận (VD: 500 mg ± 5% hoặc Âm tính)"
                    value={c.expectedText || ''}
                    onChange={(e) => onUpdateCriterion(i, 'expectedText', e.target.value)}
                    className="w-full px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"
                  />
                  {c.expectedText && calculateRangePreview(c.expectedText) && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 pl-1 font-medium italic">
                      ✨ Phân tích: {calculateRangePreview(c.expectedText)}
                    </span>
                  )}
                </div>
              )}

              {c.type === CriterionType.NUMBER && (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="text"
                    placeholder="Công bố"
                    value={c.declaredContent ?? ''}
                    onChange={(e) => {
                      const v = autoFormatInput(e.target.value);
                      onUpdateCriterion(i, 'declaredContent', v === '' ? undefined : v);
                    }}
                    className="w-24 px-3 py-2 bg-emerald-500/10 rounded-lg text-xs font-semibold outline-none text-right border border-emerald-500/20 shadow-xs font-mono text-emerald-700 dark:text-emerald-400 shrink-0"
                    title="Hàm lượng công bố"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => onRemoveCriterion(i)}
                className="p-2 text-ink-muted hover:text-rose-500 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {isMinMaxError && (
              <p className="text-xs font-semibold text-rose-500 pl-2 flex items-center gap-1">
                <ExclamationCircleIcon className="w-3.5 h-3.5 shrink-0" />
                Giá trị Min ({c.min}) không được lớn hơn Max ({c.max})
              </p>
            )}

            <div className="flex items-center gap-2 px-2 opacity-60 group-hover:opacity-100 transition-opacity">
              <ArrowDownRightIcon className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              <input
                placeholder="Ghi chú / Phương pháp thử..."
                value={(c as any).notes || ''}
                onChange={(e) => onUpdateCriterion(i, 'notes', e.target.value)}
                className="w-full bg-transparent text-xs text-ink-muted outline-none border-b border-transparent focus:border-border transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 px-2 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
              <ArrowDownRightIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <select
                value={c.formulaIngredientId || ''}
                onChange={(e) => onUpdateCriterion(i, 'formulaIngredientId', e.target.value)}
                className="px-2 py-1 bg-surface text-emerald-700 dark:text-emerald-400 rounded text-xs font-semibold outline-none border border-emerald-500/20 cursor-pointer"
              >
                <option value="">-- Liên kết với thành phần để tính % (Tùy chọn) --</option>
                {productIngredients.map((ing) => (
                  <option key={ing.id} value={ing.name}>
                    {ing.name} ({ing.declaredContent} {ing.unit})
                  </option>
                ))}
              </select>
              {c.formulaIngredientId && (
                <select
                  value={c.calculationBasis || 'DECLARED'}
                  onChange={(e) => onUpdateCriterion(i, 'calculationBasis', e.target.value as any)}
                  className="px-2 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded text-xs font-semibold outline-none border border-emerald-500/20 cursor-pointer"
                >
                  <option value="DECLARED">Tính % theo Muối/Hợp chất (Mặc định)</option>
                  <option value="ELEMENTAL">Tính % theo Ion/Base</option>
                </select>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
