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

import { AlternateRuleResolver } from './AlternateRuleResolver';

export type CanonicalTestStatus = 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';

export class OverallResultEvaluator {
  /**
   * Tính toán kết quả tổng thể toàn phiếu: PASS, FAIL, PENDING hoặc UNKNOWN
   * Tuân thủ quy chuẩn ALCOA+: Không ép PENDING/UNKNOWN thành FAIL ở tầng domain.
   */
  static calculateOverallStatus(
    results: TestResultEntry[],
    tccs: TCCS | null
  ): CanonicalTestStatus {
    if (!results || results.length === 0) return 'UNKNOWN';

    const rules = tccs?.alternateRules || [];
    const failures = results.filter((r) => r.isPass === false);

    const isNameMatch = (nameA?: string, nameB?: string) => {
      if (!nameA || !nameB) return false;
      return normalizeName(nameA) === normalizeName(nameB);
    };

    let hasPendingRetry = false;

    // 1. Duyệt qua các chỉ tiêu rớt (Failures) để xem có được cứu/miễn không
    for (const fail of failures) {
      // Kiểm tra trạng thái phân giải quy tắc thay thế cho chỉ tiêu này
      const failAltStatus = AlternateRuleResolver.resolveCriterionState(
        fail.criteriaName,
        fail.value,
        results,
        tccs
      );

      // Nếu chỉ tiêu phụ này thuộc diện MIỄN KIỂM (chưa kích hoạt) -> Bỏ qua lỗi
      if (failAltStatus.isExempted) {
        continue;
      }

      // LƯU Ý NGHIỆP VỤ CONDITIONAL_CHECK:
      // CONDITIONAL_CHECK chỉ áp dụng khi "TC1 ĐẠT". Nếu TC1 KHÔNG ĐẠT, phiếu kiểm nghiệm
      // lập tức bị đánh giá là KHÔNG ĐẠT (FAIL) độc lập với bất kỳ điều kiện thay thế nào.
      // Do đó CONDITIONAL_CHECK không tham gia cứu (rescue) chỉ tiêu chính bị rớt.

      // Xử lý logic FAIL_RETRY (Stage 2)
      const retryRule = rules.find(
        (r: any) =>
          isNameMatch(r.main, fail.criteriaName) &&
          (!r.type || r.type === EVALUATION_RULE.FAIL_RETRY)
      );

      if (retryRule) {
        const altResult = results.find((r) => isNameMatch(r.criteriaName, retryRule.alt));
        const altValStr =
          altResult?.value !== undefined && altResult?.value !== null
            ? String(altResult.value).trim()
            : '';

        // Nếu chỉ tiêu phụ chưa có kết quả -> Đang chờ kết quả phụ (PENDING), không kết luận FAIL ngay
        if (
          !altResult ||
          altValStr === '' ||
          altResult.isPass === null ||
          altResult.isPass === undefined
        ) {
          hasPendingRetry = true;
          continue;
        }

        // Nếu chỉ tiêu phụ ĐẠT -> Đã cứu được chỉ tiêu chính
        if (altResult.isPass === true) {
          continue;
        }

        // Chỉ tiêu phụ cũng rớt -> Thất bại hoàn toàn
        return 'FAIL';
      }

      // Không thuộc diện miễn kiểm, cũng không có luật thay thế cứu -> Đánh rớt phiếu
      return 'FAIL';
    }

    // 2. Rà soát xem có CONDITIONAL_CHECK nào BỊ KÍCH HOẠT mà chưa đạt hoặc chưa có kết quả không?
    const conditionalRules = rules.filter((r: any) => r.type === EVALUATION_RULE.CONDITIONAL_CHECK);
    let hasPendingConditional = false;
    for (const rule of conditionalRules) {
      const mainResult = results.find((r) => isNameMatch(r.criteriaName, rule.main));
      if (mainResult && mainResult.value !== undefined && mainResult.value !== '') {
        const isMainPass = mainResult.isPass === true;
        // CONDITIONAL_CHECK chỉ kích hoạt khi TC1 ĐẠT! Nếu TC1 rớt, đã bị bắt ở Bước 1.
        if (!isMainPass) continue;

        // Kiểm tra xem giá trị chỉ tiêu chính có kích hoạt điều kiện phải làm thêm không
        const isTriggered = AlternateRuleResolver.isConditionalCheckTriggered(
          rule.conditionValue,
          mainResult.value,
          isMainPass
        );

        if (isTriggered === true) {
          const altResult = results.find((r) => isNameMatch(r.criteriaName, rule.alt));
          const altValStr =
            altResult?.value !== undefined && altResult?.value !== null
              ? String(altResult.value).trim()
              : '';

          if (
            !altResult ||
            altValStr === '' ||
            altResult.isPass === null ||
            altResult.isPass === undefined
          ) {
            hasPendingConditional = true;
          } else if (altResult.isPass === false) {
            return 'FAIL';
          }
        }
      }
    }

    // 3. Kiểm tra xem có chỉ tiêu bắt buộc nào chưa có kết luận không (value rỗng hoặc isPass null)
    let hasUnresolved = false;
    for (const r of results) {
      if (r.isExtra && (!r.limit || r.limit.trim() === '')) continue;

      // Phân giải xem chỉ tiêu này có được miễn kiểm không (FAIL_RETRY hoặc CONDITIONAL_CHECK)
      const altStatus = AlternateRuleResolver.resolveCriterionState(
        r.criteriaName,
        r.value,
        results,
        tccs
      );

      // Nếu chỉ tiêu này được miễn kiểm -> không bắt buộc nhập giá trị
      if (altStatus.isExempted) {
        continue;
      }

      // Nếu chỉ tiêu bắt buộc nhưng đang chờ kết quả
      if (altStatus.isRequired && altStatus.isPending) {
        hasUnresolved = true;
        continue;
      }

      const valStr = r.value !== undefined && r.value !== null ? String(r.value).trim() : '';
      if (valStr === '' || r.isPass === null || r.isPass === undefined) {
        hasUnresolved = true;
      }
    }

    if (hasUnresolved || hasPendingConditional || hasPendingRetry) {
      return 'PENDING';
    }

    // Phải có ít nhất 1 chỉ tiêu đạt
    const hasValidPass = results.some((r) => r.isPass === true);
    if (!hasValidPass) {
      return 'PENDING';
    }

    return 'PASS';
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
