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

export interface TestResultEntry {
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
  unit?: string;
  limit?: string;
  analysisMethod?: string;
  confidence?: string;
}

export interface Attachment {
  name: string;
  url: string;
  source: 'google_drive' | 'firebase';
  uploadedAt: string;
}

export interface EvaluationSnapshotCriterionResult {
  criteriaName: string;
  value: string | number | boolean | null;
  normalizedValue?: string | number | null;
  isPass: boolean | null;
  ruleApplied?: string;
  usedAlternate?: boolean;
  note?: string;
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
  isInvalidated?: boolean;
}

export interface TestResult {
  id: string;
  batchId: string;
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
  /** Canonical Quality Status của phiếu kiểm nghiệm (Authoritative Quality Decision) */
  overallStatus: CanonicalQualityStatus;
  /** Trạng thái quy trình tài liệu / phê duyệt (Document Workflow) */
  workflowStatus?: TestResultWorkflowStatus;
  evaluationSnapshot?: EvaluationSnapshot;
  notes?: string;
  attachments?: Attachment[];
  version?: number;
  createdAt: string;
  updatedAt?: string;

  // ========================================================================
  // LEGACY FIELDS (Chỉ dùng cho mục đích tương thích đọc dữ liệu cũ / diagnostic)
  // Tuyệt đối không dùng làm nguồn ghi mới và không được override Canonical overallStatus.
  // ========================================================================
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  status?: string;
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  overallResult?: string;
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  resultStatus?: string;
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  result?: string;
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  conclusion?: string;
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  conclusionStatus?: string;
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  qualityStatus?: string;
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  isPassed?: boolean;
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  passed?: boolean;
  /** @deprecated @legacy Sử dụng overallStatus thay thế */
  pass?: boolean;
}
