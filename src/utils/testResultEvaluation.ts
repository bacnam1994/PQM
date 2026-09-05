import { evaluateCriterionSmart, parseNumberFromText } from './criteriaEvaluation';

/**
 * Hàm tiện ích để kiểm tra Quy tắc thay thế TCCS
 */
export const checkRuleExemption = (
  cName: string,
  getMapVal: (n: string) => any,
  activeTCCS: any,
  tccsMaps: any,
  existingResultsMap: Map<string, any>
): boolean => {
  if (!activeTCCS) return false;
  const rule = tccsMaps.rulesMap.get(cName);
  if (!rule) return false;

  const mainName = (rule.main || '').trim().toLowerCase();
  let mainVal = getMapVal(mainName);
  let isMainPass = false;

  if (mainVal !== undefined && String(mainVal).trim() !== '') {
    const mainDef = tccsMaps.criteriaMap.get(mainName);
    if (mainDef) isMainPass = evaluateCriterionSmart(mainDef, mainVal) === true;
  } else {
    const existingRes = existingResultsMap.get(mainName);
    if (existingRes && existingRes.isPass === true) {
      isMainPass = true;
      mainVal = existingRes.value;
    }
  }

  if (isMainPass) {
    if (rule.type === 'CONDITIONAL_CHECK') {
      const extractNum = (v: any) => { 
        const str = String(v || '').trim().toUpperCase();
        if (['ND', 'KPH', 'K.P.H', 'KHÔNG PHÁT HIỆN', 'NOT DETECTED', 'ÂM TÍNH', 'NEGATIVE', 'KHÔNG CÓ', 'KHÔNG ĐƯỢC CÓ'].some(kw => str.includes(kw))) return 0;
        const parsed = parseNumberFromText(str);
        if (!isNaN(parsed)) return parsed;
        const match = str.match(/[-+]?[0-9]*[.,]?[0-9]+/); 
        return match ? Number(match[0].replace(',', '.')) : 0; 
      };
      return extractNum(mainVal) <= extractNum(rule.conditionValue);
    }
    return true;
  }
  return false;
};

/**
 * Hàm tính toán độ hoàn thiện của phiếu kiểm nghiệm
 */
export const calculateCompletionStatus = (
  activeTCCS: any,
  tccsMaps: any,
  formValues: any,
  existingResultsMap: Map<string, any>
) => {
  if (!activeTCCS) return { total: 0, completed: 0, progress: 0, isComplete: false };
  const { allCriteria } = tccsMaps;
  const total = allCriteria.length;
  let completed = 0;

  const getMapVal = (name: string) => {
    const target = name.trim().toLowerCase();
    const key = Object.keys(formValues.testResultsMap).find(k => k.trim().toLowerCase() === target);
    return key ? formValues.testResultsMap[key] : undefined;
  };

  allCriteria.forEach((c: any) => {
    const cName = c.name.trim().toLowerCase();
    const val = getMapVal(cName);
    const isExempted = checkRuleExemption(cName, getMapVal, activeTCCS, tccsMaps, existingResultsMap);

    if (isExempted || (val !== undefined && String(val).trim() !== '')) {
      completed++;
    }
  });

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, progress, isComplete: completed === total };
};
