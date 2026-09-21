import { AlternateEvaluationResult } from './EvaluationTypes';
import { CriterionEvaluator } from './CriterionEvaluator';
import { AlternateRule } from '../../types';

export class AlternateRuleEvaluator {
  static evaluateCriterionWithAlternates(
    criterion: any,
    value: any,
    allValues: Record<string, any> = {},
    tccsAlternateRules: AlternateRule[] = []
  ): AlternateEvaluationResult {
    const baseEval = CriterionEvaluator.evaluateCriterion(criterion, value);
    if (baseEval.isPass === true) {
      return { isPass: true, usedAlternate: false };
    }

    const targetName = (criterion?.name || '').trim().toLowerCase();
    const applicableRule = tccsAlternateRules.find(
      (rule) => (rule.main || '').trim().toLowerCase() === targetName
    );

    if (!applicableRule) {
      return { isPass: false, usedAlternate: false };
    }

    const altCriteriaName = applicableRule.alt;
    const altValue =
      allValues[altCriteriaName] ??
      allValues[altCriteriaName.toLowerCase()] ??
      allValues[altCriteriaName.trim()];

    if (altValue === undefined || altValue === null || String(altValue).trim() === '') {
      return { isPass: false, usedAlternate: false };
    }

    if (applicableRule.type === 'FAIL_RETRY' || !applicableRule.type) {
      const conditionText = applicableRule.conditionValue || '';
      if (conditionText) {
        const altPass = CriterionEvaluator.checkRange(conditionText, String(altValue));
        if (altPass === true) {
          return {
            isPass: true,
            usedAlternate: true,
            ruleApplied: 'FAIL_RETRY',
            alternateCriterionName: altCriteriaName,
            alternateValue: altValue,
            alternateNote: `Đạt theo quy tắc thay thế: ${altCriteriaName} đáp ứng điều kiện "${conditionText}"`,
          };
        }
      }
      return { isPass: false, usedAlternate: false };
    }

    // Với CONDITIONAL_CHECK, sự tồn tại của altValue không làm thay đổi isPass của chỉ tiêu Main.
    // Việc quyết định phiếu PASS/FAIL tổng thể sẽ do OverallResultEvaluator lo liệu.
    return { isPass: false, usedAlternate: false };
  }

  static checkRuleExemption(
    cName: string,
    getMapVal: (n: string) => any,
    activeTCCS: any,
    tccsMaps: any,
    existingResultsMap: Map<string, any>
  ): boolean {
    if (!activeTCCS || !tccsMaps?.rulesMap) return false;
    const lowerName = (cName || '').trim().toLowerCase();
    let rule = tccsMaps.rulesMap.get(lowerName) || tccsMaps.rulesMap.get(cName);
    if (!rule) {
      for (const [key, r] of tccsMaps.rulesMap.entries()) {
        if (key === lowerName || (r && (r.alt || '').trim().toLowerCase() === lowerName)) {
          rule = r;
          break;
        }
      }
    }
    if (!rule) return false;

    const mainName = (rule.main || '').trim().toLowerCase();
    let mainVal = getMapVal(mainName) ?? getMapVal(rule.main);
    let isMainPass = false;

    let mainDef = tccsMaps.criteriaMap?.get(mainName) || tccsMaps.criteriaMap?.get(rule.main);
    if (!mainDef && tccsMaps.criteriaMap) {
      for (const [key, def] of tccsMaps.criteriaMap.entries()) {
        if (key === mainName || (def && (def.name || '').trim().toLowerCase() === mainName)) {
          mainDef = def;
          break;
        }
      }
    }

    if (mainVal !== undefined && String(mainVal).trim() !== '') {
      if (mainDef) {
        isMainPass = CriterionEvaluator.evaluateCriterion(mainDef, mainVal).isPass === true;
      } else {
        // Nếu không tìm thấy mainDef nhưng có kết quả thì kiểm tra qua existingResultsMap
        const existingRes = existingResultsMap.get(mainName);
        isMainPass = existingRes ? existingRes.isPass === true : true;
      }
    } else {
      const existingRes = existingResultsMap.get(mainName);
      if (existingRes && existingRes.isPass === true) {
        isMainPass = true;
        mainVal = existingRes.value;
      }
    }

    if (isMainPass) {
      // Dùng CriterionEvaluator để kiểm tra chính xác toán tử của điều kiện
      if (rule.type === 'CONDITIONAL_CHECK') {
        const conditionText = rule.conditionValue || '';
        if (!conditionText) return false;
        const isTriggered = CriterionEvaluator.checkRange(conditionText, String(mainVal));
        // Nếu điều kiện không bị kích hoạt -> Được miễn kiểm
        return isTriggered !== true;
      }
      return true;
    }
    return false;
  }
}
