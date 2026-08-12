import { TestResultEntry, TCCS } from '../types';
import { parseFlexibleValue } from './parsing';
import { TEST_RESULT_STATUS, EVALUATION_RULE } from './constants';
import { normalizeName } from '../services/criteriaAliasService';

/**
 * Calculates the overall status of a test result, considering alternate and conditional rules.
 * @param results The list of individual criteria results.
 * @param tccs The technical standard specification which may contain rules.
 * @returns 'PASS' or 'FAIL'.
 */
export const calculateOverallStatus = (results: TestResultEntry[], tccs: TCCS | null): 'PASS' | 'FAIL' => {
    // Chốt chặn an toàn: Nếu không có bất kỳ kết quả nào, đánh FAIL ngay lập tức
    if (!results || results.length === 0) {
      return TEST_RESULT_STATUS.FAIL;
    }

    // Get alternate rules from TCCS, if available
    const rules = tccs?.alternateRules || [];

    const failures = results.filter(r => !r.isPass);

    const isNameMatch = (nameA?: string, nameB?: string) => {
      if (!nameA || !nameB) return false;
      return normalizeName(nameA) === normalizeName(nameB);
    };

    // 1. Handle FAIL_RETRY logic
    for (const fail of failures) {
      // Check if this failure can be "saved" by an alternate criterion
      const rule = rules.find((r: any) => isNameMatch(r.main, fail.criteriaName) && (!r.type || r.type === EVALUATION_RULE.FAIL_RETRY));
      
      if (rule) {
        // Find the result of the alternate criterion
        const altResult = results.find(r => isNameMatch(r.criteriaName, rule.alt));
        
        // FIX: Không dùng !altResult.value vì số 0 (Zero) trong kiểm nghiệm là giá trị hợp lệ (VD: 0 CFU)
        // Chỉ đánh FAIL nếu giá trị thực sự bị bỏ trống (undefined/rỗng) hoặc isPass = false
        if (!altResult || altResult.value === undefined || altResult.value === '' || !altResult.isPass) {
          return TEST_RESULT_STATUS.FAIL;
        }
        // If altResult PASSES, this failure is ignored.
      } else {
        // A regular failure with no alternate rule means an overall FAIL
        return TEST_RESULT_STATUS.FAIL;
      }
    }

    // 2. Handle CONDITIONAL_CHECK logic
    const conditionalRules = rules.filter((r: any) => r.type === EVALUATION_RULE.CONDITIONAL_CHECK);
    for (const rule of conditionalRules) {
       const mainResult = results.find(r => isNameMatch(r.criteriaName, rule.main));
       if (mainResult && mainResult.isPass && mainResult.value !== undefined && mainResult.value !== '') {
          const threshold = parseFlexibleValue((rule as any).conditionValue);
          const val = parseFlexibleValue(String(mainResult.value));
          
          if (threshold !== null && val !== null && val > threshold) {
             const altResult = results.find(r => isNameMatch(r.criteriaName, rule.alt));
             // FIX BUG: Tương tự như trên, không dùng !altResult.value để tránh lỗi với số 0
             if (!altResult || altResult.value === undefined || altResult.value === '' || !altResult.isPass) {
                return TEST_RESULT_STATUS.FAIL;
             }
          }
       }
    }

    return TEST_RESULT_STATUS.PASS;
};