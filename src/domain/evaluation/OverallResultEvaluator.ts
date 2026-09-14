/**
 * OverallResultEvaluator.ts
 * Module thẩm định tổng hợp toàn phiếu kiểm nghiệm (Overall Result & Completion Evaluation).
 * Đảm bảo:
 * - Deterministic 100%, không bị ảnh hưởng bởi thứ tự duyệt mảng
 * - Bảo toàn tính hợp lệ của số 0 (Zero CFU không bị đánh đồng với rỗng)
 * - Tự động áp dụng cả FAIL_RETRY và CONDITIONAL_CHECK
 */

import { TestResultEntry, TCCS } from '../../types';
import { parseFlexibleValue } from '../../utils/parsing';
import { TEST_RESULT_STATUS, EVALUATION_RULE } from '../../utils/constants';
import { normalizeName } from '../../services/criteriaAliasService';
import { AlternateRuleEvaluator } from './AlternateRuleEvaluator';

export class OverallResultEvaluator {
  /**
   * Tính toán kết quả tổng thể toàn phiếu (PASS hoặc FAIL)
   */
  static calculateOverallStatus(results: TestResultEntry[], tccs: TCCS | null): 'PASS' | 'FAIL' {
    // Chốt chặn an toàn: Phiếu trống không có chỉ tiêu nào phải đánh FAIL
    if (!results || results.length === 0) {
      return TEST_RESULT_STATUS.FAIL;
    }

    const rules = tccs?.alternateRules || [];

    // Lọc danh sách các chỉ tiêu thực sự KHÔNG ĐẠT (isPass === false)
    // Các chỉ tiêu không có giới hạn hoặc mang tính thông tin (isPass === null / undefined) không tính là FAIL
    const failures = results.filter((r) => r.isPass === false);

    const isNameMatch = (nameA?: string, nameB?: string) => {
      if (!nameA || !nameB) return false;
      return normalizeName(nameA) === normalizeName(nameB);
    };

    // 1. Xử lý logic FAIL_RETRY (Stage 2)
    for (const fail of failures) {
      const rule = rules.find(
        (r: any) =>
          isNameMatch(r.main, fail.criteriaName) &&
          (!r.type || r.type === EVALUATION_RULE.FAIL_RETRY)
      );

      if (rule) {
        const altResult = results.find((r) => isNameMatch(r.criteriaName, rule.alt));
        // Không dùng !altResult.value vì số 0 (Zero) là giá trị hợp lệ (VD: 0 CFU)
        if (
          !altResult ||
          altResult.value === undefined ||
          altResult.value === '' ||
          altResult.isPass === false
        ) {
          return TEST_RESULT_STATUS.FAIL;
        }
      } else {
        return TEST_RESULT_STATUS.FAIL;
      }
    }

    // 2. Xử lý logic CONDITIONAL_CHECK
    const conditionalRules = rules.filter((r: any) => r.type === EVALUATION_RULE.CONDITIONAL_CHECK);

    for (const rule of conditionalRules) {
      const mainResult = results.find((r) => isNameMatch(r.criteriaName, rule.main));
      if (
        mainResult &&
        mainResult.isPass &&
        mainResult.value !== undefined &&
        mainResult.value !== ''
      ) {
        const threshold = parseFlexibleValue((rule as any).conditionValue);
        const val = parseFlexibleValue(String(mainResult.value));

        if (threshold !== null && val !== null && val > threshold) {
          const altResult = results.find((r) => isNameMatch(r.criteriaName, rule.alt));
          if (
            !altResult ||
            altResult.value === undefined ||
            altResult.value === '' ||
            !altResult.isPass
          ) {
            return TEST_RESULT_STATUS.FAIL;
          }
        }
      }
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
