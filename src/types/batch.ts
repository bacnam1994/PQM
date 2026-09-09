/**
 * PQM 3.0 - Lô sản xuất (Batch)
 */

import { TCCS } from './tccs';
import { ProductFormula } from './product';

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
  status: 'PENDING' | 'TESTING' | 'RELEASED' | 'REJECTED';
  rejectReason?: string;
  progressPercent?: number;
  version?: number;
  tccsSnapshot?: TCCS;
  formulaSnapshot?: ProductFormula;
  createdAt: string;
  updatedAt?: string;
}
