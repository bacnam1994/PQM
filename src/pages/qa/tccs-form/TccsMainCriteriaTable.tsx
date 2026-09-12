import React from 'react';
import {
  ChartBarSquareIcon,
  PlusIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  ArrowDownRightIcon,
} from '@heroicons/react/24/outline';
import { CriterionType, Criterion } from '../../../types';
import {
  DosageFormType,
  checkTCCSFormulaConflicts,
} from '../../../services/ai/tccsAssistantService';

interface TccsMainCriteriaTableProps {
  mainCriteria: Criterion[];
  productId: string;
  selectedFormula: any;
  productIngredients: any[];
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
  onApplyPharmacopoeiaTemplate,
  onFetchCriteriaFromFormula,
  onAddCriterion,
  onUpdateCriterion,
  onRemoveCriterion,
  calculateRangePreview,
  autoFormatInput,
  parseNumberFromText,
}) => {
  const conflicts =
    productId && selectedFormula ? checkTCCSFormulaConflicts(mainCriteria, selectedFormula) : [];

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
        const isMinMaxError =
          c.type === CriterionType.NUMBER &&
          c.min !== undefined &&
          c.max !== undefined &&
          c.min !== null &&
          c.max !== null &&
          Number(c.min) > Number(c.max);

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
              <input
                placeholder="Tên chỉ tiêu"
                value={c.name}
                onChange={(e) => onUpdateCriterion(i, 'name', e.target.value)}
                className="flex-[2] px-3 py-2 bg-surface text-ink placeholder:text-ink-muted rounded-lg text-xs font-semibold outline-none border border-border shadow-xs"
              />
              <input
                placeholder="ĐVT"
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
                      const n = parseNumberFromText(v);
                      if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) {
                        onUpdateCriterion(i, 'min', n);
                      }
                    }}
                    className="w-20 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none text-right border border-border shadow-xs font-mono"
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
                      const n = parseNumberFromText(v);
                      if (v !== '' && !isNaN(n) && !v.trim().endsWith('.')) {
                        onUpdateCriterion(i, 'max', n);
                      }
                    }}
                    className="w-20 px-3 py-2 bg-surface text-ink rounded-lg text-xs font-semibold outline-none text-right border border-border shadow-xs font-mono"
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
