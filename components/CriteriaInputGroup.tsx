import React from 'react';
import { Criterion, CriterionType, TCCS, TestResult, TestResultEntry } from '../types';
import { evaluateCriterion, ensureArray, parseFlexibleValue } from '../utils/parsing';
import { EVALUATION_RULE, CRITERION_TYPE_CONST } from '../utils/constants';
import { normalizeNumericString, checkRange, evaluateCriterionSmart, autoFormatInput } from '../utils/criteriaEvaluation';

interface CriteriaInputGroupProps {
  title: string;
  criteria: Criterion[];
  icon: React.ReactNode;
  colorClass: string;
  activeTCCS: TCCS | null;
  testResultsMap: Record<string, string | number>;
  setTestResultsMap: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
  existingResultsForBatch: TestResult[];
}

const CriteriaInputGroup: React.FC<CriteriaInputGroupProps> = ({
  title,
  criteria,
  icon,
  colorClass,
  activeTCCS,
  testResultsMap,
  setTestResultsMap,
  existingResultsForBatch,
}) => {
  if (!criteria || criteria.length === 0) return null;

  const visibleCriteria = criteria.filter(c => {
    const rules = activeTCCS?.alternateRules || [];
    const ruleAsAlt = rules.find((r: any) => r.alt === c.name);
    
    if (ruleAsAlt) {
      const mainName = ruleAsAlt.main;
      const mainValue = testResultsMap[mainName];
      
      const allDefs = [
         ...(activeTCCS?.mainQualityCriteria || []),
         ...(activeTCCS?.safetyCriteria || [])
      ];
      const mainDef = allDefs.find((d: any) => d.name === mainName);
      
      if (!mainDef || mainValue === undefined || mainValue === '') return false;
      
      const isMainPass = evaluateCriterionSmart(mainDef, mainValue);

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

  if (visibleCriteria.length === 0) return null;

  return (
    <div className="space-y-3 animate-in fade-in">
      <h4 className={`text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 border-l-4 pl-4 ${colorClass} border-current`}>
        {icon} {title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleCriteria.map((c, i) => {
          if (!c) return null;
          const criteriaName = c.name || `Chỉ tiêu #${i + 1}`;
          const currentVal = testResultsMap[criteriaName];
          const hasValue = currentVal !== undefined && currentVal !== '';
          
          const isPass = hasValue ? evaluateCriterionSmart(c, currentVal) : null;

          const history = existingResultsForBatch.flatMap(r => {
             const resultsList = ensureArray(r.results);
             const found = resultsList.find(item => item && item.criteriaName === criteriaName);
             return found ? [{ ...found, labName: r.labName, date: r.testDate }] : [];
          });

          return (
            <div key={i} className={`flex flex-col gap-2 p-4 rounded-xl border-2 transition-all ${hasValue ? (isPass ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100') : 'bg-slate-50 border-transparent hover:border-indigo-100 hover:bg-white'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-[10px] font-black uppercase mb-1 ${hasValue ? (isPass ? 'text-emerald-700' : 'text-red-700') : 'text-slate-800'}`}>{criteriaName}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                    Y/C: {(c.type === CRITERION_TYPE_CONST.NUMBER || c.type === CriterionType.NUMBER) ? (
                      (c.min === undefined || c.min === null) && (c.max !== undefined && c.max !== null)
                        ? `≤ ${c.max} ${c.unit || ''}`
                        : (c.min !== undefined && c.min !== null) && (c.max === undefined || c.max === null)
                          ? `≥ ${c.min} ${c.unit || ''}`
                          : `${c.min ?? '-'} ~ ${c.max ?? '-'} ${c.unit || ''}`
                    ) : (c.expectedText || '')}
                  </p>
                </div>
                {hasValue && <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${isPass ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>{isPass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</div>}
              </div>
              <input 
                type="text" placeholder="Nhập kết quả..."
                value={testResultsMap[criteriaName] || ''}
                onChange={(e) => setTestResultsMap({...testResultsMap, [criteriaName]: autoFormatInput(e.target.value)})}
                className={`w-full px-4 py-2 border-none rounded-lg text-right font-mono font-black text-lg outline-none shadow-inner ${hasValue ? (isPass ? 'text-emerald-700 bg-white/50' : 'text-red-700 bg-white/50') : 'bg-white'}`}
              />
              
              {history.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200/50">
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Đã kiểm tại:</p>
                  <div className="space-y-1">
                    {history.map((h, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[9px]">
                         <span className="text-slate-500 font-medium">{h.labName}: <span className="font-bold text-slate-700">{h.value}</span></span>
                         <span className={h.isPass ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{h.isPass ? 'Đạt' : 'K.Đạt'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CriteriaInputGroup;