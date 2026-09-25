/**
 * PQM V4 Platform - Approval Workflow Service
 * Động cơ điều phối xét duyệt nhiều cấp độ (Multi-stage Approval Engine)
 * Tích hợp ràng buộc Chữ ký số (21 CFR Part 11) & Bất biến Audit Trail qua Workflow Engine.
 */

import {
  ApprovalTask,
  ApprovalEntityType,
  ApprovalStep,
  StepDecision,
} from '../../types/approvalWorkflow';
import { ElectronicSignature, Role, Batch } from '../../types';
import { ApprovalWorkflowHandlers } from '../../workflow/handlers/approvalWorkflowHandlers';

export class ApprovalWorkflowService {
  /**
   * Khởi tạo đường ống thẩm duyệt đa cấp chuẩn FRS-MOD-13 với cơ chế bảo vệ SoD
   */
  static initiateApprovalPipeline(
    entityType: ApprovalEntityType,
    entityId: string,
    originatorId: string,
    title?: string,
    customSteps?: ApprovalStep[]
  ): ApprovalTask {
    return ApprovalWorkflowHandlers.initiateApprovalPipeline(
      entityType,
      entityId,
      originatorId,
      title,
      customSteps
    );
  }

  /**
   * Kiểm tra tuân thủ nguyên tắc Tách biệt Trách nhiệm (Segregation of Duties - SoD)
   * Chặn người lập/người phân tích tự thẩm định hoặc tự phê duyệt
   */
  static verifySoDCompliance(
    task: ApprovalTask,
    candidateUser: { uid?: string; email?: string }
  ): boolean {
    return ApprovalWorkflowHandlers.verifySoDCompliance(task, candidateUser);
  }

  /**
   * Tạo một Approval Task mới theo cấu hình chuẩn của từng loại thực thể
   */
  static createStandardTask(
    entityType: ApprovalEntityType,
    entityId: string,
    title: string,
    initiatorEmail: string,
    customSteps?: ApprovalStep[]
  ): ApprovalTask {
    return ApprovalWorkflowHandlers.createStandardTask(
      entityType,
      entityId,
      title,
      initiatorEmail,
      customSteps
    );
  }

  /**
   * Cấu hình các bước phê duyệt chuẩn mực ngành Dược theo từng loại thực thể
   */
  static getDefaultStepsForEntity(entityType: ApprovalEntityType): ApprovalStep[] {
    return ApprovalWorkflowHandlers.getDefaultStepsForEntity(entityType);
  }

  /**
   * Thực thi bước duyệt tiếp theo (Workflow Engine Dispatch)
   */
  static async processStepDecision(
    task: ApprovalTask,
    user: { uid: string; email: string; role: Role | null; isAdmin?: boolean },
    decision: StepDecision,
    reason?: string,
    signature?: ElectronicSignature,
    options?: { enforceSoD?: boolean }
  ): Promise<ApprovalTask> {
    return ApprovalWorkflowHandlers.processStepDecision(
      task,
      user,
      decision,
      reason,
      signature,
      options
    );
  }

  /**
   * Thu hồi hoặc hủy bỏ phê duyệt theo quy chuẩn BR-APP-002 qua Workflow Engine
   * Không được hủy nếu Lô đã xuất xưởng (RELEASED) trừ khi Lô đã HOLD/RECALLED/BLOCKED
   */
  static async revokeApproval(options: {
    task: ApprovalTask;
    user: { uid: string; email: string; role: Role | null; isAdmin?: boolean };
    reason: string;
    relatedBatch?: Batch;
    signature?: ElectronicSignature;
  }): Promise<ApprovalTask> {
    return ApprovalWorkflowHandlers.revokeApproval(options);
  }
}
