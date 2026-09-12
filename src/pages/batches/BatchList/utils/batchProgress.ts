import { TestResult } from '../../../../types';
import { ensureArray, parseNumberFromText } from '../../../../utils';

/**
 * Tính toán tiến độ kiểm nghiệm (% hoàn thành và danh sách chỉ tiêu còn thiếu theo TCCS)
 */
export const calculateBatchProgress = (batch: any, batchResults: TestResult[]) => {
  const tccs = batch.tccs;
  const requiredCriteria = tccs ? [
    ...ensureArray(tccs.mainQualityCriteria),
    ...ensureArray(tccs.safetyCriteria)
  ].filter(c => c && c.name && c.name.trim() !== '') : [];

  if (requiredCriteria.length === 0) {
    return { progressPercent: 0, missingCriteria: [], requiredCriteria: [] };
  }
  
  const testedCriteriaNames = new Set<string>();
  const latestResultsMap = new Map<string, { value: any, isPass: boolean }>();

  // Sắp xếp tăng dần theo thời gian để kết quả mới nhất ghi đè kết quả cũ
  if (batchResults.length > 0) {
    const sortedBatchResults = [...batchResults]
      .filter(r => r.batchId === batch.id)
      .sort((a, b) => {
        const dateCmp = a.testDate.localeCompare(b.testDate);
        if (dateCmp !== 0) return dateCmp;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });
    sortedBatchResults.forEach(r => {
      ensureArray(r.results).forEach(res => { 
        if (res && res.criteriaName) {
          const cName = res.criteriaName.trim().toLowerCase();
          testedCriteriaNames.add(cName);
          latestResultsMap.set(cName, { value: res.value, isPass: res.isPass });
        }
      });
    });
  }

  // Chuyển alternateRules thành Map để tra cứu O(1)
  const rulesMap = new Map<string, any>();
  if (tccs && tccs.alternateRules) {
    tccs.alternateRules.forEach((r: any) => {
      if (r && r.alt && r.alt.trim() !== '') rulesMap.set(r.alt.trim().toLowerCase(), r);
    });
  }

  const missingCriteria = requiredCriteria.filter(c => {
    if (!c || !c.name || c.name.trim() === '') return false;
    const cName = c.name.trim().toLowerCase();
    if (testedCriteriaNames.has(cName)) return false;

    const rule = rulesMap.get(cName);
    if (rule) {
      const mainName = (rule.main || '').trim().toLowerCase();
      const mainRes = latestResultsMap.get(mainName);
      if (mainRes !== undefined) {
        if (rule.type === 'CONDITIONAL_CHECK') {
          const extractNum = (val: any) => {
              const str = String(val || '').trim().toUpperCase();
              if (['ND', 'KPH', 'K.P.H', 'KHÔNG PHÁT HIỆN', 'NOT DETECTED', 'ÂM TÍNH', 'NEGATIVE', 'KHÔNG CÓ'].some(kw => str.includes(kw))) return 0;
              const parsed = parseNumberFromText(str);
              if (!isNaN(parsed)) return parsed;
              const match = str.match(/[-+]?[0-9]*[.,]?[0-9]+/);
              return match ? Number(match[0].replace(',', '.')) : 0;
          };
          if (mainRes.isPass && extractNum(mainRes.value) <= extractNum(rule.conditionValue)) return false;
        } else {
          if (mainRes.isPass) return false;
        }
      }
    }
    return true;
  });

  const progressPercent = Math.round(((requiredCriteria.length - missingCriteria.length) / requiredCriteria.length) * 100);
  return { progressPercent, missingCriteria, requiredCriteria };
};
