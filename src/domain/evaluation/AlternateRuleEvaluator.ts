/**
 * AlternateRuleEvaluator.ts
 * Xử lý các quy tắc thay thế (Alternate Rules) của Tiêu chuẩn cơ sở (TCCS).
 * Hỗ trợ 2 mô hình theo tiêu chuẩn Dược điển và GMP:
 * 1. FAIL_RETRY: Khi chỉ tiêu chính không đạt, cho phép kiểm tra chỉ tiêu thay thế (Stage 2 Re-test)
 * 2. CONDITIONAL_CHECK: Chỉ tiêu phụ chỉ bắt buộc kiểm nghiệm nếu chỉ tiêu chính vi phạm ngưỡng điều kiện
 */

import { AlternateEvaluationResult } from './EvaluationTypes';
import { CriterionEvaluator } from './CriterionEvaluator';
import { normalizeValue, parseNumberFromText } from './ValueNormalizer';
import { AlternateRule } from '../../types';

export class AlternateRuleEvaluator {
  /**
   * Đánh giá chỉ tiêu có xem xét alternateRules từ TCCS
   */
  static evaluateCriterionWithAlternates(
    criterion: any,
    value: any,
    allValues: Record<string, any> = {},
    tccsAlternateRules: AlternateRule[] = []
  ): AlternateEvaluationResult {
    // 1. Đánh giá chỉ tiêu chính trước
    const baseEval = CriterionEvaluator.evaluateCriterion(criterion, value);
    if (baseEval.isPass === true) {
      return { isPass: true, usedAlternate: false };
    }

    // 2. Tìm quy tắc thay thế áp dụng cho chỉ tiêu này
    const targetName = (criterion?.name || '').trim().toLowerCase();
    const applicableRule = tccsAlternateRules.find(
      (rule) => (rule.main || '').trim().toLowerCase() === targetName
    );

    if (!applicableRule) {
      return { isPass: false, usedAlternate: false };
    }

    // 3. Tìm giá trị của chỉ tiêu thay thế (alt)
    const altCriteriaName = applicableRule.alt;
    const altValue =
      allValues[altCriteriaName] ??
      allValues[altCriteriaName.toLowerCase()] ??
      allValues[altCriteriaName.trim()];

    if (altValue === undefined || altValue === null || String(altValue).trim() === '') {
      return { isPass: false, usedAlternate: false };
    }

    // 4. Xử lý quy tắc FAIL_RETRY
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
            alternateNote: `Đạt theo quy tắc thay thế: ${altCriteriaName} (${altValue}) đáp ứng điều kiện "${conditionText}"`,
          };
        }
      }
      return { isPass: false, usedAlternate: false };
    }

    // 5. Xử lý quy tắc CONDITIONAL_CHECK
    if (applicableRule.type === 'CONDITIONAL_CHECK') {
      const conditionText = applicableRule.conditionValue || '';
      if (conditionText) {
        const altPass = CriterionEvaluator.checkRange(conditionText, String(altValue));
        if (altPass !== null) {
          return {
            isPass: altPass,
            usedAlternate: true,
            ruleApplied: 'CONDITIONAL_CHECK',
            alternateCriterionName: altCriteriaName,
            alternateValue: altValue,
            alternateNote: `Kiểm tra điều kiện: ${altCriteriaName} (${altValue}) so với "${conditionText}"`,
          };
        }
      }
    }

    return { isPass: false, usedAlternate: false };
  }

  /**
   * Kiểm tra xem chỉ tiêu có thuộc diện được miễn kiểm (Rule Exemption) hay không
   */
  static checkRuleExemption(
    cName: string,
    getMapVal: (n: string) => any,
    activeTCCS: any,
    tccsMaps: any,
    existingResultsMap: Map<string, any>
  ): boolean {
    if (!activeTCCS) return false;
    const rule = tccsMaps.rulesMap.get(cName);
    if (!rule) return false;

    const mainName = (rule.main || '').trim().toLowerCase();
    let mainVal = getMapVal(mainName);
    let isMainPass = false;

    if (mainVal !== undefined && String(mainVal).trim() !== '') {
      const mainDef = tccsMaps.criteriaMap.get(mainName);
      if (mainDef) {
        const evalRes = CriterionEvaluator.evaluateCriterion(mainDef, mainVal);
        isMainPass = evalRes.isPass === true;
      }
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
          const norm = normalizeValue(v);
          if (norm.isND) return 0;
          if (norm.numericValue !== null) return norm.numericValue;
          const parsed = parseNumberFromText(String(v || ''));
          return isNaN(parsed) ? 0 : parsed;
        };
        return extractNum(mainVal) <= extractNum(rule.conditionValue);
      }
      return true;
    }
    return false;
  }
}
