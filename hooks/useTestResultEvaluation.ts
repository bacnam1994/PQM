import { useMemo } from 'react';
import { TCCS } from '../types';
import { ensureArray, evaluateCriterion, parseNumberFromText } from '../utils';

export const useTestResultEvaluation = (
  activeTCCS: TCCS | null | undefined,
  testResultsMap: Record<string, string | number>,
  tccsMaps: { rulesMap: Map<string, any>; criteriaMap: Map<string, any> }
) => {
  const completionStatus = useMemo(() => {
    if (!activeTCCS) return { progress: 0, isComplete: false, total: 0, completed: 0 };

    const allCriteria = [
      ...ensureArray(activeTCCS.mainQualityCriteria),
      ...ensureArray(activeTCCS.safetyCriteria)
    ].filter(c => c && c.name);

    const total = allCriteria.length;
    if (total === 0) return { progress: 0, isComplete: false, total: 0, completed: 0 };

    let completed = 0;
    const { rulesMap, criteriaMap } = tccsMaps;

    allCriteria.forEach(c => {
      const val = testResultsMap[c.name];
      const hasValue = val !== undefined && val !== '' && val !== null;

      if (hasValue) {
        completed++;
      } else {
        // Kiểm tra logic thay thế: Nếu TC1 đạt -> TC2 (là c) được coi là hoàn thành (không cần kiểm)
        const rule = rulesMap.get(c.name);
        if (rule) {
          const mainName = rule.main;
          const mainVal = testResultsMap[mainName];
          
          if (mainVal !== undefined && mainVal !== '' && mainVal !== null) {
            const mainDef = criteriaMap.get(mainName);
            if (mainDef) {
              const isMainPass = evaluateCriterion(mainDef, mainVal);

              if (rule.type !== 'CONDITIONAL_CHECK' && isMainPass === true) {
                completed++;
              } else if (rule.type === 'CONDITIONAL_CHECK') {
                if (!isMainPass) {
                  completed++; 
                } else {
                  const conditionVal = parseNumberFromText(String(rule.conditionValue || '0'));
                  const actualMainVal = parseNumberFromText(String(mainVal));
                  if (actualMainVal <= conditionVal) {
                    completed++; // Điều kiện kích hoạt -> bỏ qua hợp lệ
                  }
                }
              }
            }
          }
        }
      }
    });

    const progress = Math.round((completed / total) * 100);
    return { progress, isComplete: progress >= 100, total, completed };
  }, [activeTCCS, testResultsMap, tccsMaps]);

  return { completionStatus };
};