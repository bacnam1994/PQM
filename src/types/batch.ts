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
  releasedAt?: string;
  releasedBy?: string;
  rejectReason?: string;
  progressPercent?: number;
  version?: number;
  tccsSnapshot?: TCCS;
  formulaSnapshot?: ProductFormula;
  /** Bản chụp thẩm định niêm phong bất biến (ALCOA+ Evaluation Snapshot) */
  evaluationSnapshot?: import('./testResult').EvaluationSnapshot;
  /** Mã băm SHA-256 niêm phong kết quả thẩm định */
  evaluationHash?: string;
  createdAt: string;
  updatedAt?: string;
}
