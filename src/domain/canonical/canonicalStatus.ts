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

export interface CriterionEvaluationDetail {
  criterionName: string;
  expectedLimit: string;
  actualValue: string | number;
  unit?: string;
  isPass: boolean | null;
  status: CriterionPassStatus;
  evaluationMethod?: 'NUMERIC' | 'TEXT' | 'RANGE' | 'ALTERNATE_RULE' | 'EXEMPTION';
  isExempted?: boolean;
  note?: string;
  storedIsPass?: boolean | null;
  recalculatedIsPass?: boolean | null;
}

export interface EvaluationDecisionTrace {
  batchId: string;
  batchNo: string;
  productId: string;
  productName?: string;
  tccsId?: string;
  tccsVersion?: string;
  tccsSnapshotHash?: string;
  tccsResolutionStatus:
    | 'SNAPSHOT_MATCH'
    | 'EXACT_ID_MATCH'
    | 'TCCS_RESOLUTION_ERROR'
    | 'TCCS_NOT_PROVIDED';
  evaluationVersion: string;
  completion: {
    requiredCount: number;
    testedCount: number;
    percentage: number;
    isComplete: boolean;
    missingCriteria: string[];
  };
  authoritativeTestResults: {
    id: string;
    labName: string;
    testDate: string;
    status: string;
    overallStatus: string;
    isFinal?: boolean;
  }[];
  criterionEvaluations: CriterionEvaluationDetail[];
  failedCriteria: CriterionEvaluationDetail[];
  pendingCriteria: CriterionEvaluationDetail[];
  unknownCriteria: CriterionEvaluationDetail[];
  qualityStatus: CanonicalBatchQualityStatus;
  canonicalQualityStatus?: CanonicalBatchQualityStatus;
  qualityReason: string;
  releaseEligibility: {
    isEligible: boolean;
    score: number;
    blockers: string[];
    recommendation: string;
  };
  workflowStatus: BatchStatus;
  workflowTransition?: string;
  actor?: string;
  timestamp: string;
  aiAdvisory?: {
    summary?: string;
    riskFactors?: string[];
    recommendations?: string[];
  };
}
