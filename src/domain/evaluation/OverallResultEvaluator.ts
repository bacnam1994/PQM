/**
 * OverallResultEvaluator.ts
 * Module thẩm định tổng hợp toàn phiếu kiểm nghiệm (Overall Result & Completion Evaluation).
 * Đảm bảo:
 * - Deterministic 100%, không bị ảnh hưởng bởi thứ tự duyệt mảng
 * - Bảo toàn tính hợp lệ của số 0 (Zero CFU không bị đánh đồng với rỗng)
 * - Tự động áp dụng cả FAIL_RETRY và CONDITIONAL_CHECK
 */

import { TestResultEntry, TCCS } from '../../types';
import { TEST_RESULT_STATUS, EVALUATION_RULE } from '../../utils/constants';
import { normalizeName } from '../../services/criteriaAliasService';
import { CriterionEvaluator } from './CriterionEvaluator';
import { AlternateRuleEvaluator } from './AlternateRuleEvaluator';

export class OverallResultEvaluator {
  /**
   * Tính toán kết quả tổng thể toàn phiếu (PASS hoặc FAIL)
   */
  static calculateOverallStatus(results: TestResultEntry[], tccs: TCCS | null): 'PASS' | 'FAIL' {
    if (!results || results.length === 0) return TEST_RESULT_STATUS.FAIL;

    const rules = tccs?.alternateRules || [];
    const failures = results.filter((r) => r.isPass === false);

    const isNameMatch = (nameA?: string, nameB?: string) => {
      if (!nameA || !nameB) return false;
      return normalizeName(nameA) === normalizeName(nameB);
    };

    // 1. Duyệt qua các chỉ tiêu rớt (Failures) để xem có được cứu/miễn không
    for (const fail of failures) {
      // VÁ BUG 3: Kiểm tra xem lỗi này có thuộc chỉ tiêu phụ được miễn kiểm không?
      const condRuleWhereThisIsAlt = rules.find(
        (r) => r.type === EVALUATION_RULE.CONDITIONAL_CHECK && isNameMatch(r.alt, fail.criteriaName)
      );
      if (condRuleWhereThisIsAlt) {
        const mainResult = results.find((r) =>
          isNameMatch(r.criteriaName, condRuleWhereThisIsAlt.main)
        );
        if (mainResult) {
          const isTriggered = CriterionEvaluator.checkRange(
            condRuleWhereThisIsAlt.conditionValue || '',
            String(mainResult.value)
          );
          // Nếu điều kiện KHÔNG bị kích hoạt -> chỉ tiêu phụ này được MIỄN KIỂM -> Bỏ qua lỗi FAIL của nó
          if (isTriggered !== true) continue;
        }
      }

      // Xử lý logic FAIL_RETRY (Stage 2)
      const retryRule = rules.find(
        (r: any) =>
          isNameMatch(r.main, fail.criteriaName) &&
          (!r.type || r.type === EVALUATION_RULE.FAIL_RETRY)
      );
      if (retryRule) {
        const altResult = results.find((r) => isNameMatch(r.criteriaName, retryRule.alt));
        if (
          !altResult ||
          altResult.value === undefined ||
          altResult.value === '' ||
          altResult.isPass === false
        ) {
          return TEST_RESULT_STATUS.FAIL;
        }
      } else {
        // Không thuộc diện miễn kiểm, cũng không có luật FAIL_RETRY cứu -> Đánh rớt phiếu
        return TEST_RESULT_STATUS.FAIL;
      }
    }

    // 2. VÁ BUG 2: Rà soát xem có CONDITIONAL_CHECK nào BỊ KÍCH HOẠT mà chưa đạt không?
    const conditionalRules = rules.filter((r: any) => r.type === EVALUATION_RULE.CONDITIONAL_CHECK);
    for (const rule of conditionalRules) {
      const mainResult = results.find((r) => isNameMatch(r.criteriaName, rule.main));
      if (mainResult && mainResult.value !== undefined && mainResult.value !== '') {
        // Kiểm tra xem giá trị chỉ tiêu chính có kích hoạt điều kiện phải làm thêm không
        const isTriggered = CriterionEvaluator.checkRange(
          rule.conditionValue || '',
          String(mainResult.value)
        );

        if (isTriggered === true) {
          const altResult = results.find((r) => isNameMatch(r.criteriaName, rule.alt));
          if (
            !altResult ||
            altResult.value === undefined ||
            altResult.value === '' ||
            altResult.isPass === false
          ) {
            return TEST_RESULT_STATUS.FAIL;
          }
        }
      }
    }

    // 3. Kiểm tra xem có chỉ tiêu bắt buộc nào chưa có kết luận không (value rỗng)
    const hasUnresolved = results.some((r) => {
      if (r.isPass !== null && r.isPass !== undefined) return false;
      const valStr = r.value !== undefined && r.value !== null ? String(r.value).trim() : '';
      if (valStr !== '') return false;

      // Kiểm tra xem có được miễn kiểm theo CONDITIONAL_CHECK không
      const condRule = rules.find(
        (rule) =>
          rule.type === EVALUATION_RULE.CONDITIONAL_CHECK && isNameMatch(rule.alt, r.criteriaName)
      );
      if (condRule) {
        const mainResult = results.find((m) => isNameMatch(m.criteriaName, condRule.main));
        if (mainResult && mainResult.value !== undefined && mainResult.value !== '') {
          const isTriggered = CriterionEvaluator.checkRange(
            condRule.conditionValue || '',
            String(mainResult.value)
          );
          if (isTriggered !== true) return false; // Được miễn kiểm
        }
      }
      if (r.isExtra && (!r.limit || r.limit.trim() === '')) return false;
      return true;
    });

    if (hasUnresolved) {
      return TEST_RESULT_STATUS.FAIL;
    }

    // Phải có ít nhất 1 chỉ tiêu đạt
    const hasValidPass = results.some((r) => r.isPass === true);
    if (!hasValidPass) {
      return TEST_RESULT_STATUS.FAIL;
    }

    return TEST_RESULT_STATUS.PASS;
  }

  /**
   * Tính toán tiến độ hoàn thành dữ liệu của phiếu kiểm nghiệm
   */
  static calculateCompletionStatus(
    activeTCCS: any,
    tccsMaps: any,
    formValues: any,
    existingResultsMap: Map<string, any>
  ): { total: number; completed: number; progress: number; isComplete: boolean } {
    if (!activeTCCS) return { total: 0, completed: 0, progress: 0, isComplete: false };
    const { allCriteria = [] } = tccsMaps || {};
    const total = allCriteria.length;
    let completed = 0;

    const getMapVal = (name: string) => {
      const target = name.trim().toLowerCase();
      const testResultsMap = formValues?.testResultsMap || {};
      const key = Object.keys(testResultsMap).find((k) => k.trim().toLowerCase() === target);
      return key ? testResultsMap[key] : undefined;
    };

    allCriteria.forEach((c: any) => {
      const cName = (c.name || '').trim().toLowerCase();
      const val = getMapVal(cName);
      const isExempted = AlternateRuleEvaluator.checkRuleExemption(
        cName,
        getMapVal,
        activeTCCS,
        tccsMaps,
        existingResultsMap
      );

      if (isExempted || (val !== undefined && String(val).trim() !== '')) {
        completed++;
      }
    });

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, progress, isComplete: completed === total };
  }
}
