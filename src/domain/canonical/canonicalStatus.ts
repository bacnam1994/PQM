/**
 * PQM Domain - Canonical Status Model (Model 2)
 * Thiết lập một nguồn sự thật duy nhất cho trạng thái.
 *
 * TÁCH BIỆT HOÀN TOÀN:
 * Batch.status !== TestResult.overallStatus
 * vì đây là hai trạng thái thuộc hai domain khác nhau.
 */

/**
 * Trạng thái của Phiếu kiểm nghiệm (TestResult)
 */
export type TestResultStatus = 'PENDING' | 'PASS' | 'FAIL' | 'INVALID' | 'SUPERSEDED';

/**
 * Trạng thái vòng đời của Lô sản xuất (Batch Lifecycle)
 */
export type BatchStatus = 'PENDING' | 'TESTING' | 'RELEASED' | 'REJECTED' | 'BLOCKED';

/**
 * Trạng thái chất lượng chuẩn hóa của Lô (dựa trên kết quả phân tích kiểm nghiệm)
 */
export type CanonicalBatchQualityStatus =
  | 'NOT_TESTED'
  | 'TESTING'
  | 'PASS'
  | 'FAIL'
  | 'INCOMPLETE'
  | 'INVALID';

/**
 * Trạng thái từng chỉ tiêu kiểm nghiệm đơn lẻ
 */
export type CriterionPassStatus = 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';

export interface CanonicalQualityEvaluation {
  canonicalStatus: CanonicalBatchQualityStatus;
  testResultStatus: TestResultStatus;
  authoritativeTestResultId?: string;
  totalCriteriaCount: number;
  passedCriteriaCount: number;
  failedCriteriaCount: number;
  pendingCriteriaCount: number;
  reasons: string[];
  evaluatedAt: string;
  resolverVersion: string;
}
