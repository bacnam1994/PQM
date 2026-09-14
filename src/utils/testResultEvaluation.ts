import { QualityEvaluationEngine } from '../domain/evaluation/QualityEvaluationEngine';

/**
 * Hàm tiện ích để kiểm tra Quy tắc thay thế TCCS.
 * Facade delegating to QualityEvaluationEngine (Phase 3 Domain Engine).
 */
export const checkRuleExemption = (
  cName: string,
  getMapVal: (n: string) => any,
  activeTCCS: any,
  tccsMaps: any,
  existingResultsMap: Map<string, any>
): boolean => {
  return QualityEvaluationEngine.checkRuleExemption(
    cName,
    getMapVal,
    activeTCCS,
    tccsMaps,
    existingResultsMap
  );
};

/**
 * Hàm tính toán độ hoàn thiện của phiếu kiểm nghiệm.
 * Facade delegating to QualityEvaluationEngine (Phase 3 Domain Engine).
 */
export const calculateCompletionStatus = (
  activeTCCS: any,
  tccsMaps: any,
  formValues: any,
  existingResultsMap: Map<string, any>
) => {
  return QualityEvaluationEngine.calculateCompletionStatus(
    activeTCCS,
    tccsMaps,
    formValues,
    existingResultsMap
  );
};
