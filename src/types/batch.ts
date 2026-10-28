/**
 * PQM 3.0 - Lô sản xuất (Batch)
 * MODEL 1: CANONICAL DATA MODEL HARDENING
 */

import { TCCS } from './tccs';
import { ProductFormula } from './product';

/**
 * Trạng thái quy trình sản xuất / xuất xưởng của Lô (Batch Workflow Status).
 * ĐÂY LÀ WORKFLOW STATUS, TUYỆT ĐỐI KHÔNG DÙNG LÀM QUALITY STATUS.
 * RELEASED != PASS, REJECTED != FAIL.
 */
export type BatchWorkflowStatus = 'PENDING' | 'TESTING' | 'RELEASED' | 'REJECTED' | 'BLOCKED';

/**
 * Trạng thái tiến độ kiểm nghiệm và kết luận chất lượng của Lô (Inspection Status).
 * Tách biệt hoàn toàn khỏi BatchWorkflowStatus và 7 Release Gates.
 * - NOT_TESTED: Chưa có chỉ tiêu bắt buộc nào hoàn thành (completedCount = 0).
 * - IN_PROGRESS: Đã có ít nhất một chỉ tiêu hoàn thành nhưng chưa đạt 100% (0 < completedCount < requiredCount).
 * - PENDING_REVIEW: Toàn bộ chỉ tiêu bắt buộc đã hoàn thành hợp lệ, đang chờ đánh giá (completedCount = requiredCount).
 * - PASS: Người dùng có thẩm quyền (QA/QC/ADMIN) đã xác nhận Đạt.
 * - FAIL: Người dùng có thẩm quyền (QA/QC/ADMIN) đã xác nhận Không đạt.
 */
export type BatchInspectionStatus =
  | 'NOT_TESTED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'PASS'
  | 'FAIL';

/**
 * Bản ghi kết luận chất lượng có thẩm quyền và dấu vết kiểm toán ALCOA+
 */
export interface BatchInspectionEvaluation {
  /** Kết luận chất lượng chính thức: PASS hoặc FAIL (tuyệt đối không dùng PASS_OR_FAIL) */
  status: 'PASS' | 'FAIL';
  /** ID người dùng thực hiện đánh giá */
  evaluatedBy: string;
  /** Tên hiển thị người đánh giá */
  evaluatorName: string;
  /** Vai trò của người đánh giá tại thời điểm thực hiện (QA, QC hoặc ADMIN) */
  evaluatorRole: 'QA' | 'QC' | 'ADMIN';
  /** Thời điểm xác nhận (ISO 8601 string) */
  evaluatedAt: string;
  /** Lý do / Nhận xét đánh giá (Bắt buộc nếu status = FAIL) */
  reason?: string;
  /** Mã băm niêm phong toàn vẹn SHA-256 đối với bộ kết quả kiểm nghiệm */
  evaluationHash?: string;
  /** Phiên bản của Lô tại thời điểm đánh giá */
  versionAtEvaluation?: number;
}

/**
 * Tiến độ kiểm nghiệm số lượng chỉ tiêu bắt buộc
 */
export interface BatchInspectionProgress {
  /** Số chỉ tiêu bắt buộc hợp lệ theo TCCS (đã trừ chỉ tiêu miễn kiểm) */
  requiredCount: number;
  /** Số chỉ tiêu bắt buộc có kết quả hợp lệ và hoàn thành */
  completedCount: number;
  /** Phần trăm tiến độ (0-100), làm tròn từ completedCount/requiredCount */
  percentage: number;
  /** Danh sách tên các chỉ tiêu còn thiếu chưa hoàn thành */
  missingCriteria: string[];
  /** Thời điểm tính toán tiến độ (ISO 8601 string) */
  evaluatedAt: string;
}

/**
 * Tiến trình 7 Release Gates (tách biệt hoàn toàn với Batch Workflow Status).
 * - Batch.status = vòng đời workflow (PENDING, TESTING, RELEASED, ...)
 * - BatchReleaseStage = tiến trình hoàn thành từng Gate (GATE_1 → READY_TO_RELEASE)
 *
 * TUYỆT ĐỐI KHÔNG biến 7 Gate thành Batch.status.
 * Gate FAIL → release bị blocked, không phải Batch REJECTED.
 * Chỉ BATCH_RELEASE_APPROVE mới chuyển TESTING → RELEASED qua StateMachine.
 */
export type BatchReleaseStage =
  | 'NOT_STARTED'
  | 'GATE_1'
  | 'GATE_2'
  | 'GATE_3'
  | 'GATE_4'
  | 'GATE_5'
  | 'GATE_6'
  | 'GATE_7'
  | 'READY_TO_RELEASE'
  | 'RELEASED'
  | 'BLOCKED'
  | 'REJECTED';

/** Tiến độ số lượng Gate hoàn thành (tuần tự, first-fail rule) */
export interface BatchReleaseGateProgress {
  /** Số Gate đã hoàn thành tuần tự (first blocking gate = stop, không cộng các gate phía sau dù PASS) */
  completed: number;
  /** Tổng số Gate (luôn là 7) */
  total: 7;
  /** Gate hiện tại đang chờ (1-7); 0 nếu chưa bắt đầu; 8 nếu tất cả 7/7 xong */
  currentGate: number;
  /** Phần trăm tiến độ (0-100), tính theo completed/total */
  percentage: number;
  /** Thời điểm tính toán (ISO string) */
  evaluatedAt: string;
}

export interface Batch {
  id: string;
  productId: string;
  tccsId: string;
  batchNo: string;
  mfgDate: string;
  expDate: string;
  theoreticalYield: number;
  actualYield: number;
  yieldUnit: string;
  packaging?: string;
  /** Trạng thái quy trình xuất xưởng (Batch Workflow Status) */
  status: BatchWorkflowStatus;
  /** Trạng thái chất lượng thẩm định kỹ thuật (Canonical Quality Status) */
  qualityStatus?: import('./testResult').CanonicalQualityStatus;
  /** Cờ cảnh báo có hồ sơ OOS chưa đóng */
  hasActiveOOS?: boolean;
  /** Cờ cảnh báo có sai lệch (Deviation) chưa đóng */
  hasActiveDeviation?: boolean;
  /** Trạng thái thẩm định Hồ sơ sản xuất (BPR Review Status - Gate 6) */
  bprReviewStatus?: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  bprReviewedAt?: string;
  bprReviewedBy?: string;
  bprReviewComment?: string;
  releasedAt?: string;
  releasedBy?: string;
  rejectReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  recalledAt?: string;
  recalledBy?: string;
  recallReason?: string;
  heldAt?: string;
  heldBy?: string;
  holdReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  resumeReason?: string;
  progressPercent?: number;
  version?: number;
  tccsSnapshot?: TCCS;
  formulaSnapshot?: ProductFormula;
  /** Bản chụp thẩm định niêm phong bất biến (ALCOA+ Evaluation Snapshot) */
  evaluationSnapshot?: import('./testResult').EvaluationSnapshot;
  /** Mã băm SHA-256 niêm phong kết quả thẩm định */
  evaluationHash?: string;
  /**
   * Trạng thái tiến độ kiểm nghiệm và kết luận chất lượng mới (SSoT).
   * NOT_TESTED | IN_PROGRESS | PENDING_REVIEW | PASS | FAIL
   */
  inspectionStatus?: BatchInspectionStatus;
  /** Bản ghi kết luận chất lượng chính thức do QA/QC/ADMIN xác nhận */
  inspectionEvaluation?: BatchInspectionEvaluation;
  /** Tiến độ số lượng chỉ tiêu bắt buộc hoàn thành */
  inspectionProgress?: BatchInspectionProgress;
  /**
   * Giai đoạn 7 Release Gates hiện tại (tách biệt với Batch.status).
   * Được tính và persist bởi BatchReleaseWorkflowSynchronizer.
   * UI chỉ đọc – KHÔNG tự tính.
   */
  releaseStage?: BatchReleaseStage;
  /**
   * Tiến độ số lượng Gate hoàn thành (first-fail sequential rule).
   * Được tính và persist bởi BatchReleaseWorkflowSynchronizer.
   * UI chỉ đọc – KHÔNG tự tính.
   */
  releaseGateProgress?: BatchReleaseGateProgress;
  /** Snapshot quyết định xuất xưởng 7 Release Gates (ALCOA+ Release Decision Snapshot) */
  releaseDecisionSnapshot?: any;
  /** Chữ ký điện tử 21 CFR Part 11 phê duyệt xuất xưởng */
  releaseSignatures?: any[];
  createdAt: string;
  updatedAt?: string;
}
