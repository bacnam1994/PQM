/**
 * PQM REBUILD - APPROVAL TASK REPOSITORY INTERFACE
 */

import { ApprovalTask } from '../../types';
import { IRepository } from '../types';

export interface IApprovalTaskRepository extends IRepository<ApprovalTask> {
  findByEntityId(entityId: string): Promise<ApprovalTask[]>;
  findByStatus(status: ApprovalTask['status']): Promise<ApprovalTask[]>;
  findByAssignee(userId: string): Promise<ApprovalTask[]>;
}
