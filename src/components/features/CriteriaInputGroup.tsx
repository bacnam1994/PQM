import React, { useMemo, useCallback, memo } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { Criterion, CriterionType, TCCS, TestResult, TestResultEntry } from '../../types';
import { ensureArray, parseFlexibleValue, EVALUATION_RULE, autoFormatInput } from '../../utils';
import { CriterionEvaluator } from '../../domain/evaluation/CriterionEvaluator';
import { AlternateRuleResolver, ResolvedAlternateStatus } from '../../domain/evaluation';

interface CriteriaInputGroupProps {
  title: string;
  criteria: Criterion[];
  icon: React.ReactNode;
  colorClass: string;
  activeTCCS: TCCS | null;
  testResultsMap: Record<string, string | number>;
  setMapValue: (mapName: string, key: string, value: any) => void;
  existingResultsForBatch: TestResult[];
  /** Tập hợp tên chỉ tiêu đã được AI tự động điền */
  aiFilledFields?: Set<string>;
}

interface CriteriaInputRowProps {
  c: Criterion;
  criteriaName: string;
  currentVal: string | number | undefined;
  history: any[];
  onChange: (name: string, val: string) => void;
  /** true nếu giá trị này do AI điền */
  isAiFilled?: boolean;
  /** Trạng thái quy tắc thay thế từ Domain Resolver */
  altStatus?: ResolvedAlternateStatus;
}

const CriteriaInputRow = memo(
  ({
    c,
    criteriaName,
    currentVal,
    history,
    onChange,
    isAiFilled,
    altStatus,
  }: CriteriaInputRowProps) => {
    const hasValue = currentVal !== undefined && currentVal !== '';

    // Sử dụng trực tiếp Domain CriterionEvaluator thay vì logic riêng ở UI
    const evalResult = useMemo(() => {
      if (!hasValue) return null;
      return CriterionEvaluator.evaluateCriterion(c, currentVal);
    }, [c, currentVal, hasValue]);

    const isPass = evalResult?.isPass ?? null;

    // Xác định border và background dựa trên trạng thái chính thức và Alternate Rule
    const containerClass = hasValue
      ? isPass === true
        ? 'bg-emerald-50 border-emerald-100'
        : isPass === false
          ? 'bg-red-50 border-red-200 shadow-sm shadow-red-100'
          : 'bg-amber-50/50 border-amber-200'
      : altStatus?.isRequired && altStatus?.isPending
        ? 'bg-amber-50/80 border-amber-300 shadow-xs shadow-amber-200/50'
        : altStatus?.isExempted
          ? 'bg-slate-50/70 border-slate-200'
          : isAiFilled
            ? 'bg-indigo-50/40 border-indigo-200 border-dashed'
            : 'bg-slate-50 border-transparent hover:border-indigo-100 hover:bg-white';

    const inputPlaceholder =
      altStatus?.isExempted && !hasValue
        ? 'Miễn kiểm (tự động)'
        : altStatus?.isRequired && altStatus?.isPending && !hasValue
          ? 'Bắt buộc nhập kết quả...'
          : 'Nhập kết quả...';

    return (
      <div
        className={`flex flex-col gap-2 p-4 rounded-xl border-2 transition-all ${containerClass}`}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <p
                className={`text-[10px] font-black uppercase truncate ${
                  hasValue
                    ? isPass === true
                      ? 'text-emerald-700'
                      : isPass === false
                        ? 'text-red-700'
                        : 'text-amber-700'
                    : altStatus?.isRequired && altStatus?.isPending
                      ? 'text-amber-800'
                      : 'text-slate-800'
                }`}
              >
                {criteriaName}
              </p>

              {/* Tag nhận diện quy tắc thay thế */}
              {altStatus?.isMain && (
                <span
                  className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200"
                  title={altStatus.displayNote}
                >
                  🔗 Có thay thế
                </span>
              )}
              {altStatus?.isAlt && !hasValue && !altStatus.isExempted && !altStatus.isRequired && (
                <span
                  className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-300"
                  title={altStatus.displayNote}
                >
                  ↳ Phụ thuộc {altStatus.pairedCriterionName}
                </span>
              )}
            </div>

            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
              Y/C:{' '}
              {c.type === CriterionType.NUMBER
                ? (c.min === undefined || c.min === null) && c.max !== undefined && c.max !== null
                  ? `≤ ${c.max} ${c.unit || ''}`
                  : c.min !== undefined && c.min !== null && (c.max === undefined || c.max === null)
                    ? `≥ ${c.min} ${c.unit || ''}`
                    : `${c.min ?? '-'} ~ ${c.max ?? '-'} ${c.unit || ''}`
                : c.expectedText || ''}
            </p>

            {/* Chú thích diễn giải quy tắc thay thế */}
            {altStatus?.isParticipating && altStatus.displayNote && (
              <p
                className={`text-[8.5px] mt-1 font-medium italic ${
                  altStatus.isRequired && altStatus.isPending
                    ? 'text-amber-700 font-semibold'
                    : altStatus.isExempted
                      ? 'text-teal-700'
                      : 'text-slate-500'
                }`}
              >
                {altStatus.isExempted
                  ? '✓ '
                  : altStatus.isRequired && altStatus.isPending
                    ? '⚠️ '
                    : 'ℹ️ '}
                {altStatus.displayNote}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Badge AI đã điền */}
            {isAiFilled && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <SparklesIcon className="w-2.5 h-2.5" />
                <span className="text-[8px] font-black uppercase tracking-wide">AI</span>
              </div>
            )}

            {/* Badge MIỄN KIỂM khi chưa nhập kết quả */}
            {!hasValue && altStatus?.isExempted && (
              <div
                className="px-2 py-1 rounded text-[9px] font-black uppercase tracking-wide bg-teal-100 text-teal-800 border border-teal-200"
                title={altStatus.displayNote}
              >
                MIỄN KIỂM
              </div>
            )}

            {/* Badge CHỜ KẾT QUẢ khi quy tắc kích hoạt bắt buộc kiểm */}
            {!hasValue && altStatus?.isRequired && altStatus?.isPending && (
              <div
                className="px-2 py-1 rounded text-[9px] font-black uppercase tracking-wide bg-amber-200 text-amber-900 border border-amber-300 animate-pulse"
                title={altStatus.displayNote}
              >
                CHỜ KẾT QUẢ
              </div>
            )}

            {/* Badge PASS / FAIL / GHI NHẬN khi đã có kết quả */}
            {hasValue && (
              <div
                className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                  isPass === true
                    ? altStatus?.alternateState === 'TRIGGERED_PASS'
                      ? 'bg-emerald-200 text-emerald-800 border border-emerald-300 font-black'
                      : 'bg-emerald-200 text-emerald-700'
                    : isPass === false
                      ? 'bg-red-200 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isPass === true
                  ? altStatus?.alternateState === 'TRIGGERED_PASS'
                    ? 'ĐẠT (THAY THẾ)'
                    : 'ĐẠT'
                  : isPass === false
                    ? 'K.ĐẠT'
                    : 'GHI NHẬN'}
              </div>
            )}
          </div>
        </div>

        <input
          type="text"
          placeholder={inputPlaceholder}
          value={currentVal || ''}
          onChange={(e) => onChange(criteriaName, e.target.value)}
          className={`w-full px-4 py-2 border-none rounded-lg text-right font-mono font-black text-lg outline-none shadow-inner ${
            hasValue
              ? isPass === true
                ? 'text-emerald-700 bg-white/50'
                : isPass === false
                  ? 'text-red-700 bg-white/50'
                  : 'text-amber-700 bg-white/50'
              : altStatus?.isExempted
                ? 'text-slate-400 bg-slate-100/50 placeholder:text-slate-400/80'
                : isAiFilled
                  ? 'text-indigo-700 bg-white/70'
                  : 'bg-white'
          }`}
        />

        {history && history.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200/50">
            <div className="flex justify-between items-center mb-1">
              <p className="text-[9px] font-bold text-slate-400 uppercase">
                Lịch sử kiểm ({history.length}):
              </p>
              {history.length > 3 && (
                <span className="text-[8px] text-slate-300 italic">Chỉ hiện 3 lần gần nhất</span>
              )}
            </div>
            <div className="space-y-1">
              {/* Tối ưu UX: Chỉ hiển thị 3 kết quả gần nhất để tránh Form bị kéo dài quá mức */}
              {history.slice(0, 3).map((h, idx) => (
                <div key={idx} className="flex justify-between items-center text-[9px]">
                  <span className="text-slate-500 font-medium">
                    {h.labName}: <span className="font-bold text-slate-700">{h.value}</span>
                  </span>
                  <span
                    className={h.isPass ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}
                  >
                    {h.isPass ? 'Đạt' : 'K.Đạt'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

// Tối ưu 1: Biến hằng để tránh việc tạo mảng tham chiếu mới mỗi lần render
const EMPTY_HISTORY: any[] = [];

const CriteriaInputGroup: React.FC<CriteriaInputGroupProps> = ({
  title,
  criteria,
  icon,
  colorClass,
  activeTCCS,
  testResultsMap,
  setMapValue,
  existingResultsForBatch,
  aiFilledFields,
}) => {
  if (!criteria || criteria.length === 0) return null;

  const rulesMap = useMemo(() => {
    const map = new Map<string, any>();
    (activeTCCS?.alternateRules || []).forEach((r: any) => {
      if (r && r.alt) map.set(r.alt, r);
    });
    return map;
  }, [activeTCCS?.alternateRules]);

  const allDefsMap = useMemo(() => {
    const map = new Map<string, any>();
    [...(activeTCCS?.mainQualityCriteria || []), ...(activeTCCS?.safetyCriteria || [])].forEach(
      (d: any) => {
        if (d && d.name) map.set(d.name, d);
      }
    );
    return map;
  }, [activeTCCS?.mainQualityCriteria, activeTCCS?.safetyCriteria]);

  const historyMap = useMemo(() => {
    const map = new Map<string, any[]>();
    existingResultsForBatch.forEach((r) => {
      ensureArray(r.results).forEach((item) => {
        if (item && item.criteriaName) {
          if (!map.has(item.criteriaName)) map.set(item.criteriaName, []);
          map.get(item.criteriaName)!.push({ ...item, labName: r.labName, date: r.testDate });
        }
      });
    });
    return map;
  }, [existingResultsForBatch]);

  // Không lọc ẩn chỉ tiêu phụ thuộc: Mọi chỉ tiêu TCCS đều luôn hiển thị đầy đủ
  const visibleCriteria = criteria;

  const handleValueChange = useCallback(
    (name: string, val: string) => {
      setMapValue('testResultsMap', name, autoFormatInput(val));
    },
    [setMapValue]
  );

  if (visibleCriteria.length === 0) return null;

  return (
    <div className="space-y-3 animate-in fade-in">
      <h4
        className={`text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 border-l-4 pl-4 ${colorClass} border-current`}
      >
        {icon} {title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleCriteria.map((c) => {
          const criteriaName = c.name;
          if (!criteriaName) return null;

          const currentVal = testResultsMap[criteriaName];

          // Phân giải trạng thái quy tắc thay thế (Alternate Rule)
          const altStatus = AlternateRuleResolver.resolveCriterionState(
            criteriaName,
            currentVal,
            testResultsMap,
            activeTCCS,
            c
          );

          // Dùng EMPTY_HISTORY để giữ cho props history LUÔN ỔN ĐỊNH với các Row không có lịch sử
          const history = historyMap.get(criteriaName) || EMPTY_HISTORY;
          const isAiFilled = aiFilledFields ? aiFilledFields.has(criteriaName) : false;

          return (
            <CriteriaInputRow
              key={criteriaName}
              c={c}
              criteriaName={criteriaName}
              currentVal={currentVal}
              history={history}
              onChange={handleValueChange}
              isAiFilled={isAiFilled}
              altStatus={altStatus}
            />
          );
        })}
      </div>
    </div>
  );
};

export default CriteriaInputGroup;
