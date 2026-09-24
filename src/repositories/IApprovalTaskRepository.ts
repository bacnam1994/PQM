/**
 * PQM V4 Platform - Approval Task Repository Interface
 * Lưu trữ trạng thái và lịch sử thẩm duyệt đa cấp (Approval Workflow Pipeline)
 */

import { ApprovalTask } from '../types/approvalWorkflow';
import { IRepository } from './types';

export interface IApprovalTaskRepository extends IRepository<ApprovalTask> {
  findByEntity(entityType: string, entityId: string): Promise<ApprovalTask[]>;
  findByAssignee(assigneeRole: string): Promise<ApprovalTask[]>;
}
