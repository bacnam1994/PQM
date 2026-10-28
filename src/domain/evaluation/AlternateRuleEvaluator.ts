import { AlternateEvaluationResult } from './EvaluationTypes';
import { CriterionEvaluator } from './CriterionEvaluator';
import { AlternateRuleResolver } from './AlternateRuleResolver';
import { AlternateRule } from '../../types';
import { isCriteriaMatch } from '../../utils/aiMapping';

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
      (rule) =>
        (rule.main || '').trim().toLowerCase() === targetName ||
        isCriteriaMatch(rule.main, criterion?.name) ||
        isCriteriaMatch(criterion?.name, rule.main)
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
        const altName = r && r.alt ? r.alt.trim().toLowerCase() : '';
        if (
          key === lowerName ||
          altName === lowerName ||
          isCriteriaMatch(key, cName) ||
          isCriteriaMatch(cName, key) ||
          (altName && (isCriteriaMatch(altName, cName) || isCriteriaMatch(cName, altName)))
        ) {
          rule = r;
          break;
        }
      }
    }
    if (!rule) return false;

    const mainName = (rule.main || '').trim().toLowerCase();
    let mainVal = getMapVal(mainName) ?? getMapVal(rule.main);
    if (mainVal === undefined && tccsMaps.criteriaMap) {
      for (const [key] of tccsMaps.criteriaMap.entries()) {
        if (isCriteriaMatch(key, rule.main) || isCriteriaMatch(rule.main, key)) {
          mainVal = getMapVal(key);
          if (mainVal !== undefined) break;
        }
      }
    }

    let isMainPass = false;

    let mainDef = tccsMaps.criteriaMap?.get(mainName) || tccsMaps.criteriaMap?.get(rule.main);
    if (!mainDef && tccsMaps.criteriaMap) {
      for (const [key, def] of tccsMaps.criteriaMap.entries()) {
        const defName = def && def.name ? def.name.trim().toLowerCase() : '';
        if (
          key === mainName ||
          defName === mainName ||
          isCriteriaMatch(key, rule.main) ||
          isCriteriaMatch(rule.main, key) ||
          (defName && (isCriteriaMatch(defName, rule.main) || isCriteriaMatch(rule.main, defName)))
        ) {
          mainDef = def;
          break;
        }
      }
    }

    const findExistingRes = (target: string) => {
      if (!existingResultsMap) return undefined;
      if (existingResultsMap.has(target)) return existingResultsMap.get(target);
      const lower = target.trim().toLowerCase();
      if (existingResultsMap.has(lower)) return existingResultsMap.get(lower);
      for (const [k, v] of existingResultsMap.entries()) {
        if (isCriteriaMatch(k, target) || isCriteriaMatch(target, k)) return v;
      }
      return undefined;
    };

    if (mainVal !== undefined && String(mainVal).trim() !== '') {
      if (mainDef) {
        isMainPass = CriterionEvaluator.evaluateCriterion(mainDef, mainVal).isPass === true;
      } else {
        // Nếu không tìm thấy mainDef nhưng có kết quả thì kiểm tra qua existingResultsMap
        const existingRes = findExistingRes(mainName) || findExistingRes(rule.main);
        isMainPass = existingRes ? existingRes.isPass === true : true;
      }
    } else {
      const existingRes = findExistingRes(mainName) || findExistingRes(rule.main);
      if (existingRes && existingRes.isPass === true) {
        isMainPass = true;
        mainVal = existingRes.value;
      }
    }

    if (isMainPass) {
      // Dùng AlternateRuleResolver để kiểm tra chính xác toán tử của điều kiện
      if (rule.type === 'CONDITIONAL_CHECK') {
        const conditionText = rule.conditionValue || '';
        if (!conditionText) return false;
        const isTriggered = AlternateRuleResolver.isConditionalCheckTriggered(
          conditionText,
          mainVal,
          isMainPass
        );
        // Nếu điều kiện không bị kích hoạt -> Được miễn kiểm
        return isTriggered !== true;
      }
      return true;
    }
    return false;
  }
}
