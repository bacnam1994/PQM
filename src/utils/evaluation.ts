import { TestResultEntry, TCCS } from '../types';
import { QualityEvaluationEngine } from '../domain/evaluation/QualityEvaluationEngine';

/**
 * Calculates the overall status of a test result, considering alternate and conditional rules.
 * Facade delegating to QualityEvaluationEngine (Phase 3 Domain Engine).
 * @param results The list of individual criteria results.
 * @param tccs The technical standard specification which may contain rules.
 * @returns 'PASS' or 'FAIL'.
 */
export const calculateOverallStatus = (
  results: TestResultEntry[],
  tccs: TCCS | null
): 'PASS' | 'FAIL' => {
  return QualityEvaluationEngine.calculateOverallStatus(results, tccs);
};
