/**
 * PQM 3.0 - Phiếu kiểm nghiệm (Test Result)
 * MODEL 1: CANONICAL DATA MODEL HARDENING
 */

import { Batch } from './batch';

/**
 * Canonical Quality Status chính thức của PQM:
 * Chỉ bao gồm đúng 4 trạng thái thẩm định chất lượng kỹ thuật.
 * Tuyệt đối không bổ sung thêm hoặc nhầm lẫn với Workflow Status.
 */
export type CanonicalQualityStatus = 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';

/**
 * Trạng thái quy trình tài liệu / phê duyệt (Workflow Status)
 * Tách biệt hoàn toàn khỏi Quality Status:
 * APPROVED != PASS, FINAL != PASS, RELEASED != PASS, REJECTED != FAIL
 */
export type TestResultWorkflowStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'FINAL'
  | 'APPROVED'
  | 'RELEASED'
  | 'REJECTED'
  | 'SUPERSEDED';

export type AlternateCriterionState =
  | 'NONE'
  | 'NOT_TRIGGERED'
  | 'TRIGGERED_PENDING'
  | 'TRIGGERED_PASS'
  | 'TRIGGERED_FAIL'
  | 'EXEMPTED';

/**
 * Trạng thái đánh giá chi tiết cấp Chỉ tiêu (Criterion-Level Evaluation State)
 */
export type CriterionEvaluationState =
  | 'NOT_STARTED'
  | 'REQUIRED'
  | 'TESTING'
  | 'PASS'
  | 'FAIL'
  | 'PENDING'
  | 'EXEMPTED'
  | 'NOT_APPLICABLE';

export type CriterionResult = TestResultEntry;

export interface TestResultEntry {
  /** ID chỉ tiêu (Tham chiếu Criterion.id) */
  criterionId?: string;
  criteriaName: string;
  value: string | number;
  /**
   * isPass: boolean | null
   * true  -> PASS criterion
   * false -> FAIL criterion
   * null  -> unresolved / PENDING / informational (cảm quan/ghi nhận)
   * Tuyệt đối không mặc định true hoặc coi missing là PASS.
   */
  isPass: boolean | null;
  isExtra?: boolean;
  isExempted?: boolean;
  unit?: string;
  limit?: string;
  analysisMethod?: string;
  confidence?: string;

  /** Trạng thái đánh giá chuẩn hóa */
  evaluationState?: CriterionEvaluationState;
  /** Trạng thái quy tắc thay thế / phụ thuộc */
  alternateState?: AlternateCriterionState;
  alternateRuleId?: string;
  alternateSourceCriterion?: string;
  alternateNote?: string;
  /** Bằng chứng đính kèm (sắc ký đồ HPLC, file đo quang) */
  evidenceUrls?: string[];
}

export interface Attachment {
  name: string;
  url: string;
  source: 'google_drive' | 'firebase';
  uploadedAt: string;
}

export interface EvaluationSnapshotCriterionResult {
  /** ID chỉ tiêu */
  criterionId?: string;
  criteriaName: string;
  value: string | number | boolean | null;
  normalizedValue?: string | number | null;
  isPass: boolean | null;
  ruleApplied?: string;
  usedAlternate?: boolean;
  note?: string;

  /** Trạng thái đánh giá chuẩn hóa */
  evaluationState?: CriterionEvaluationState;
  /** Trạng thái quy tắc thay thế trong snapshot */
  alternateState?: AlternateCriterionState;
  alternateRuleId?: string;
  alternateSourceCriterion?: string;
  alternateNote?: string;
}

export interface EvaluationSnapshot {
  engineVersion: string;
  testResultId?: string;
  batchId?: string;
  tccsId?: string;
  tccsVersion?: string | number;
  evaluatedAt: string;
  evaluatedBy: string;
  overallStatus: CanonicalQualityStatus;
  criterionResults: EvaluationSnapshotCriterionResult[];
  alternateUsed: boolean;
  reasons: string[];
  warnings: string[];
  evaluationHash: string;
  footnotes?: string[];
  isInvalidated?: boolean;
}

/**
 * Mô hình dữ liệu chuẩn của Phiếu kiểm nghiệm (Model 1 - Canonical Data Model).
 * Đảm bảo Quality Status tách bạch hoàn toàn khỏi Workflow Status.
 */
export interface CanonicalTestResult {
  id: string;
  batchId: string;
  productId: string;

  criteria: CriterionResult[];

  /**
   * Quyết định chất lượng kỹ thuật tất định:
   * PASS | FAIL | PENDING | UNKNOWN
   */
  qualityStatus: CanonicalQualityStatus;

  /**
   * Vòng đời tài liệu / hành chính độc lập:
   * DRAFT | FINAL | APPROVED | RELEASED
   */
  workflowStatus: 'DRAFT' | 'FINAL' | 'APPROVED' | 'RELEASED';

  evaluationSnapshot?: EvaluationSnapshot;

  evaluationHash?: string;

  version: number;

  createdAt: number;
  updatedAt: number;
}

export interface TestResult {
  id: string;
  batchId: string;
  productId?: string; // Khóa ngoại kỹ thuật liên kết Product (Model 1 & 3)
  /**
   * batch: Thuộc tính ảo (virtual join) phục vụ hiển thị trên UI và xuất phiếu CoA.
   * KHÔNG được lưu trực tiếp vào cơ sở dữ liệu Firebase.
   */
  batch?: Batch;
  tccsId?: string; // Khóa ngoại kỹ thuật liên kết với TCCS (Model 3)
  labId?: string; // Khóa ngoại liên kết với TestingLaboratory (nếu đã chuẩn hóa)
  labName: string;
  testDate: string;
  results: TestResultEntry[];
  /** Danh sách chỉ tiêu chuẩn canonical (đồng bộ với results) */
  criteria?: CriterionResult[];
  /** Canonical Quality Status của phiếu kiểm nghiệm (Authoritative Quality Decision) */
  overallStatus: CanonicalQualityStatus;
  /** Trạng thái chất lượng canonical chuẩn Model 1 (đồng bộ với overallStatus) */
  qualityStatus?: CanonicalQualityStatus;
  /** Trạng thái quy trình tài liệu / phê duyệt (Document Workflow) */
  workflowStatus?: TestResultWorkflowStatus;
  evaluationSnapshot?: EvaluationSnapshot;
  evaluationHash?: string;
  notes?: string;
  attachments?: Attachment[];
  version?: number;
  createdAt: string;
  updatedAt?: string;

  // ========================================================================
  // LEGACY FIELDS (Chỉ dùng cho mục đích tương thích đọc dữ liệu cũ / diagnostic)
  // Tuyệt đối không dùng làm nguồn ghi mới và không được override Canonical overallStatus.
  // ========================================================================
  /** @deprecated @legacy Sử dụng overallStatus / qualityStatus thay thế */
  status?: string;
  /** @deprecated @legacy Sử dụng overallStatus / qualityStatus thay thế */
  overallResult?: string;
  /** @deprecated @legacy Sử dụng overallStatus / qualityStatus thay thế */
  resultStatus?: string;
  /** @deprecated @legacy Sử dụng overallStatus / qualityStatus thay thế */
  result?: string;
  /** @deprecated @legacy Sử dụng overallStatus / qualityStatus thay thế */
  conclusion?: string;
  /** @deprecated @legacy Sử dụng overallStatus / qualityStatus thay thế */
  conclusionStatus?: string;
  /** @deprecated @legacy Sử dụng overallStatus / qualityStatus thay thế */
  isPassed?: boolean;
  /** @deprecated @legacy Sử dụng overallStatus / qualityStatus thay thế */
  passed?: boolean;
  /** @deprecated @legacy Sử dụng overallStatus / qualityStatus thay thế */
  pass?: boolean;
}

/**
 * Chuyển đổi an toàn từ TestResult sang CanonicalTestResult (Model 1)
 */
export function toCanonicalTestResult(
  tr: TestResult,
  fallbackProductId?: string
): CanonicalTestResult {
  const normQualityStatus: CanonicalQualityStatus =
    (tr.qualityStatus as CanonicalQualityStatus) || tr.overallStatus || 'UNKNOWN';

  let normWorkflowStatus: 'DRAFT' | 'FINAL' | 'APPROVED' | 'RELEASED' = 'DRAFT';
  if (
    tr.workflowStatus === 'APPROVED' ||
    tr.workflowStatus === 'RELEASED' ||
    tr.workflowStatus === 'FINAL'
  ) {
    normWorkflowStatus = tr.workflowStatus;
  } else if (tr.workflowStatus === 'SUBMITTED') {
    normWorkflowStatus = 'DRAFT';
  } else if (tr.workflowStatus === 'REJECTED' || tr.workflowStatus === 'SUPERSEDED') {
    normWorkflowStatus = 'FINAL';
  }

  const createdTs =
    typeof tr.createdAt === 'number' ? tr.createdAt : Date.parse(tr.createdAt || '') || Date.now();

  const updatedTs =
    typeof tr.updatedAt === 'number'
      ? tr.updatedAt
      : (tr.updatedAt ? Date.parse(tr.updatedAt) : createdTs) || createdTs;

  const criteriaList: CriterionResult[] = tr.criteria || tr.results || [];

  return {
    id: tr.id,
    batchId: tr.batchId,
    productId: tr.productId || tr.batch?.productId || fallbackProductId || '',
    criteria: criteriaList,
    qualityStatus: normQualityStatus,
    workflowStatus: normWorkflowStatus,
    evaluationSnapshot: tr.evaluationSnapshot,
    evaluationHash: tr.evaluationHash || tr.evaluationSnapshot?.evaluationHash,
    version: tr.version ?? 1,
    createdAt: createdTs,
    updatedAt: updatedTs,
  };
}
