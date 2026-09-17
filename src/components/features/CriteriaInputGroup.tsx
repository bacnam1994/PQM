import React, { useMemo, useCallback, memo } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { Criterion, CriterionType, TCCS, TestResult, TestResultEntry } from '../../types';
import { ensureArray, parseFlexibleValue, EVALUATION_RULE, autoFormatInput } from '../../utils';
import { CriterionEvaluator } from '../../domain/evaluation/CriterionEvaluator';

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
}

const CriteriaInputRow = memo(
  ({ c, criteriaName, currentVal, history, onChange, isAiFilled }: CriteriaInputRowProps) => {
    const hasValue = currentVal !== undefined && currentVal !== '';

    // Sử dụng trực tiếp Domain CriterionEvaluator thay vì logic riêng ở UI
    const evalResult = useMemo(() => {
      if (!hasValue) return null;
      return CriterionEvaluator.evaluateCriterion(c, currentVal);
    }, [c, currentVal, hasValue]);

    const isPass = evalResult?.isPass ?? null;

    // Xác định border và background dựa trên trạng thái chính thức: PASS (true) / FAIL (false) / INFORMATIONAL (null)
    const containerClass = hasValue
      ? isPass === true
        ? 'bg-emerald-50 border-emerald-100'
        : isPass === false
          ? 'bg-red-50 border-red-200 shadow-sm shadow-red-100'
          : 'bg-amber-50/50 border-amber-200'
      : isAiFilled
        ? 'bg-indigo-50/40 border-indigo-200 border-dashed'
        : 'bg-slate-50 border-transparent hover:border-indigo-100 hover:bg-white';

    return (
      <div
        className={`flex flex-col gap-2 p-4 rounded-xl border-2 transition-all ${containerClass}`}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={`text-[10px] font-black uppercase mb-1 truncate ${
                hasValue
                  ? isPass === true
                    ? 'text-emerald-700'
                    : isPass === false
                      ? 'text-red-700'
                      : 'text-amber-700'
                  : 'text-slate-800'
              }`}
            >
              {criteriaName}
            </p>
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
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Badge AI đã điền */}
            {isAiFilled && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <SparklesIcon className="w-2.5 h-2.5" />
                <span className="text-[8px] font-black uppercase tracking-wide">AI</span>
              </div>
            )}
            {/* Badge PASS / FAIL / GHI NHẬN */}
            {hasValue && (
              <div
                className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                  isPass === true
                    ? 'bg-emerald-200 text-emerald-700'
                    : isPass === false
                      ? 'bg-red-200 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isPass === true ? 'ĐẠT' : isPass === false ? 'K.ĐẠT' : 'GHI NHẬN'}
              </div>
            )}
          </div>
        </div>
        <input
          type="text"
          placeholder="Nhập kết quả..."
          value={currentVal || ''}
          onChange={(e) => onChange(criteriaName, e.target.value)}
          className={`w-full px-4 py-2 border-none rounded-lg text-right font-mono font-black text-lg outline-none shadow-inner ${
            hasValue
              ? isPass === true
                ? 'text-emerald-700 bg-white/50'
                : isPass === false
                  ? 'text-red-700 bg-white/50'
                  : 'text-amber-700 bg-white/50'
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

  const visibleCriteria = useMemo(() => {
    return criteria.filter((c) => {
      if (!c || !c.name) return false;
      const ruleAsAlt = rulesMap.get(c.name);

      if (ruleAsAlt) {
        const mainName = ruleAsAlt.main;
        const mainValue = testResultsMap[mainName];
        const mainDef = allDefsMap.get(mainName);

        if (!mainDef || mainValue === undefined || mainValue === '') return false;

        const mainEval = CriterionEvaluator.evaluateCriterion(mainDef, mainValue);
        const isMainPass = mainEval.isPass === true;

        if (ruleAsAlt.type === EVALUATION_RULE.CONDITIONAL_CHECK) {
          if (!isMainPass) return false;

          const threshold = parseFlexibleValue(ruleAsAlt.conditionValue);
          const val = parseFlexibleValue(String(mainValue));

          if (threshold !== null && val !== null && val > threshold) {
            return true;
          }
          return false;
        } else {
          if (isMainPass) return false;
        }
      }
      return true;
    });
  }, [criteria, rulesMap, allDefsMap, testResultsMap]);

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
            />
          );
        })}
      </div>
    </div>
  );
};

export default CriteriaInputGroup;
