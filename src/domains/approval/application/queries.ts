/**
 * APPROVAL DOMAIN: APPLICATION QUERIES
 * Cung cấp các thao tác đọc và tra cứu cho Approval Tasks qua Repository.
 */

import { ApprovalTask, ApprovalEntityType } from '../domain/types';
import {
  IApprovalTaskRepository,
  firebaseApprovalTaskRepository,
} from '../infrastructure/repository';

export class ApprovalQueries {
  constructor(private repo: IApprovalTaskRepository = firebaseApprovalTaskRepository) {}

  /**
   * Truy vấn danh sách tasks theo thực thể liên kết (TestResult, Batch, TCCS, v.v.)
   */
  async findByEntity(
    entityType: ApprovalEntityType | string,
    entityId: string
  ): Promise<ApprovalTask[]> {
    return this.repo.findByEntity(entityType, entityId);
  }

  /**
   * Truy vấn danh sách tasks theo vai trò người được giao (Assignee Role)
   */
  async findByAssignee(assigneeRole: string): Promise<ApprovalTask[]> {
    return this.repo.findByAssignee(assigneeRole);
  }

  /**
   * Truy vấn chi tiết task theo ID
   */
  async findById(id: string): Promise<ApprovalTask | null> {
    return this.repo.findById(id);
  }

  /**
   * Lấy toàn bộ danh sách approval tasks
   */
  async findAll(): Promise<ApprovalTask[]> {
    return this.repo.findAll();
  }

  /**
   * Lấy danh sách các tasks đang chờ duyệt (PENDING hoặc IN_PROGRESS)
   */
  async findPendingTasks(): Promise<ApprovalTask[]> {
    const all = await this.repo.findAll();
    return all.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  }
}

export const approvalQueries = new ApprovalQueries();
