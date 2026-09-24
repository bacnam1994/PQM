/**
 * PQM V4 Platform - Change Control Repository Interface
 * Chuẩn hóa lưu trữ Yêu cầu Thay đổi (Change Control) GMP-WHO / ICH Q10
 */

import { ChangeRequest, ChangeStatus } from '../types/changeControl';
import { IRepository } from './types';

export interface IChangeControlRepository extends IRepository<ChangeRequest> {
  findByStatus(status: ChangeStatus): Promise<ChangeRequest[]>;
  findByProductId(productId: string): Promise<ChangeRequest[]>;
}
