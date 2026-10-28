/**
 * MASTER DATA DOMAIN: TYPES & CONTRACTS
 * Chuẩn hóa các thực thể Master Data: Chỉ tiêu mẫu (Master Criteria), Dược điển (Pharmacopoeia) và Phòng kiểm nghiệm (Laboratory).
 */

import { MasterCriterion, MasterCriterionCategory } from '../../../types';
import { PharmacopoeiaStandard } from '../../../services/pharmacopoeiaService';
import { TestingLaboratory } from '../../../types/laboratory';

export type { MasterCriterion, MasterCriterionCategory, PharmacopoeiaStandard, TestingLaboratory };

export interface PharmacopoeiaActionContext {
  actorId: string;
  actorRole: string;
  actorEmail?: string;
  reason?: string;
}

export interface LabActionContext {
  actorId: string;
  actorRole: string;
  actorEmail?: string;
  reason?: string;
}

export interface BulkRenameCriteriaResult {
  updatedCount: number;
  totalScanned: number;
}
