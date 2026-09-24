/**
 * PQM V4 Platform - Firebase Approval Task Repository
 * Lưu trữ bền vững dữ liệu quy trình thẩm duyệt trên Firebase Realtime Database (/approval_tasks)
 */

import { ref, remove } from 'firebase/database';
import { db } from '../../firebase';
import { ApprovalTask } from '../../types/approvalWorkflow';
import { IApprovalTaskRepository } from '../IApprovalTaskRepository';
import { BaseFirebaseRepository } from './BaseFirebaseRepository';

export class FirebaseApprovalTaskRepository
  extends BaseFirebaseRepository<ApprovalTask>
  implements IApprovalTaskRepository
{
  protected readonly collectionPath = 'approval_tasks';

  async findByEntity(entityType: string, entityId: string): Promise<ApprovalTask[]> {
    const all = await this.findAll();
    return all.filter((task) => task.entityType === entityType && task.entityId === entityId);
  }

  async findByAssignee(assigneeRole: string): Promise<ApprovalTask[]> {
    const all = await this.findAll();
    const target = assigneeRole.toLowerCase();
    return all.filter((task) => {
      const currentStep = task.steps[task.currentStepIndex];
      return currentStep && String(currentStep.roleRequired).toLowerCase() === target;
    });
  }

  async delete(id: string): Promise<void> {
    const targetPath = `${this.collectionPath}/${id}`;
    await remove(ref(db, targetPath));
  }
}

export const firebaseApprovalTaskRepository = new FirebaseApprovalTaskRepository();
