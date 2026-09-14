import { QualityEvaluationEngine } from '../domain/evaluation/QualityEvaluationEngine';
import { resolveDeclaredBasis, calculateRelativePercentage } from './basisCalculation';

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

/**
 * Hàm chuẩn hóa tính tỷ lệ % hàm lượng cho 1 chỉ tiêu kiểm nghiệm.
 * Tự động phân giải ưu tiên cơ sở tính toán (Công thức -> TCCS -> Tiêu chuẩn).
 * Khắc phục hồi quy Bacillus và hỗ trợ giá trị 0% cho vi sinh/tạp chất.
 */
export const getContentPercent = (
  criteriaName: string,
  value: string | number | undefined,
  criterion?: any,
  formula?: any,
  resolver?: { isMatch: (a: string, b: string) => boolean }
): string | null => {
  const targetCriterion = criterion || { name: criteriaName };
  const basisInfo = resolveDeclaredBasis(targetCriterion, formula, resolver);

  if (!basisInfo.basis || basisInfo.basis <= 0) return null;

  return calculateRelativePercentage(value, basisInfo.basis);
};
