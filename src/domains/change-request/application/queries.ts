/**
 * CHANGE REQUEST DOMAIN: READ QUERIES
 */

import { ChangeRequest, ChangeStatus, IChangeControlRepository } from '../domain/types';
import { firebaseChangeControlRepository } from '../infrastructure/repository';

export class ChangeControlQueries {
  constructor(private repo: IChangeControlRepository = firebaseChangeControlRepository) {}

  /**
   * Lấy toàn bộ danh sách Change Requests sắp xếp theo ngày đề xuất mới nhất
   */
  async getAll(): Promise<ChangeRequest[]> {
    const items = await this.repo.findAll();
    return [...items].sort((a, b) => (b.proposedAt || '').localeCompare(a.proposedAt || ''));
  }

  /**
   * Lấy chi tiết một Change Request theo ID
   */
  async getById(id: string): Promise<ChangeRequest | null> {
    return this.repo.findById(id);
  }

  /**
   * Lấy danh sách Change Requests theo trạng thái quy trình
   */
  async getByStatus(status: ChangeStatus): Promise<ChangeRequest[]> {
    return this.repo.findByStatus(status);
  }

  /**
   * Lấy danh sách Change Requests liên quan đến một sản phẩm
   */
  async getByProductId(productId: string): Promise<ChangeRequest[]> {
    return this.repo.findByProductId(productId);
  }
}

export const changeControlQueries = new ChangeControlQueries();
