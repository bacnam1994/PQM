import { TestResultEntry, TCCS } from '../types';
import { parseFlexibleValue } from './parsing';
import { TEST_RESULT_STATUS, EVALUATION_RULE } from './constants';

/**
 * Calculates the overall status of a test result, considering alternate and conditional rules.
 * @param results The list of individual criteria results.
 * @param tccs The technical standard specification which may contain rules.
 * @returns 'PASS' or 'FAIL'.
 */
export const calculateOverallStatus = (results: TestResultEntry[], tccs: TCCS | null): 'PASS' | 'FAIL' => {
    // Get alternate rules from TCCS, if available
    const rules = tccs?.alternateRules || [];

    const failures = results.filter(r => !r.isPass);

    // 1. Handle FAIL_RETRY logic
    for (const fail of failures) {
      // Check if this failure can be "saved" by an alternate criterion
      const rule = rules.find((r: any) => r.main === fail.criteriaName && (!r.type || r.type === EVALUATION_RULE.FAIL_RETRY));
      
      if (rule) {
        // Find the result of the alternate criterion
        const altResult = results.find(r => r.criteriaName === rule.alt);
        
        // If the alternate is missing or also fails, the overall result is FAIL
        if (!altResult || !altResult.value || !altResult.isPass) {
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
       const mainResult = results.find(r => r.criteriaName === rule.main);
       if (mainResult && mainResult.isPass && mainResult.value !== undefined && mainResult.value !== '') {
          const threshold = parseFlexibleValue((rule as any).conditionValue);
          const val = parseFlexibleValue(String(mainResult.value));
          
          if (threshold !== null && val !== null && val > threshold) {
             const altResult = results.find(r => r.criteriaName === rule.alt);
             if (!altResult || !altResult.value || !altResult.isPass) {
                return TEST_RESULT_STATUS.FAIL;
             }
          }
       }
    }

    return TEST_RESULT_STATUS.PASS;
};