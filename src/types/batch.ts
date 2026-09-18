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
export type BatchWorkflowStatus = 'PENDING' | 'TESTING' | 'RELEASED' | 'REJECTED';

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
  rejectReason?: string;
  progressPercent?: number;
  version?: number;
  tccsSnapshot?: TCCS;
  formulaSnapshot?: ProductFormula;
  createdAt: string;
  updatedAt?: string;
}
