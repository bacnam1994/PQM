/**
 * PQM — IMasterCriterionRepository
 * Interface repository cho MasterCriterion (master_criteria/).
 * Định nghĩa contract để dễ mock trong unit test.
 */

import { MasterCriterion, MasterCriterionCategory } from '../types';
import { IRepository } from './types';

export interface IMasterCriterionRepository extends IRepository<MasterCriterion> {
  /** Tìm tất cả chỉ tiêu đang hoạt động (isActive = true) */
  findActive(): Promise<MasterCriterion[]>;

  /** Tìm theo nhóm phân loại */
  findByCategory(category: MasterCriterionCategory): Promise<MasterCriterion[]>;

  /** Tìm kiếm theo tên (full-text fallback) */
  searchByName(query: string): Promise<MasterCriterion[]>;

  /** Tìm theo nguyên liệu liên kết */
  findByLinkedMaterial(materialId: string): Promise<MasterCriterion[]>;
}
