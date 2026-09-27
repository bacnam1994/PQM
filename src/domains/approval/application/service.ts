/**
 * APPROVAL DOMAIN: APPLICATION SERVICE
 * Động cơ điều phối xét duyệt nhiều cấp độ (Multi-stage Approval Engine)
 * Tích hợp ràng buộc Chữ ký số (21 CFR Part 11) & Bất biến Audit Trail qua Workflow Engine.
 */

import { ApprovalTask, ApprovalEntityType, ApprovalStep, StepDecision } from '../domain/types';
import { Role, ElectronicSignature, Batch } from '../../../types';
import { ApprovalWorkflowHandlers } from '../../../workflow/handlers/approvalWorkflowHandlers';
import {
  IApprovalTaskRepository,
  firebaseApprovalTaskRepository,
} from '../infrastructure/repository';
import { ApprovalRules } from '../domain/rules';

export class ApprovalWorkflowService {
  constructor(private repo: IApprovalTaskRepository = firebaseApprovalTaskRepository) {}

  /**
   * Truy vấn approval tasks theo thực thể
   */
  static async findByEntity(entityType: string, entityId: string): Promise<ApprovalTask[]> {
    return firebaseApprovalTaskRepository.findByEntity(entityType, entityId);
  }

  async findByEntity(entityType: string, entityId: string): Promise<ApprovalTask[]> {
    return this.repo.findByEntity(entityType, entityId);
  }

  /**
   * Lưu trữ hoặc cập nhật approval task
   */
  static async saveTask(task: ApprovalTask): Promise<void> {
    await firebaseApprovalTaskRepository.save(task);
  }

  async saveTask(task: ApprovalTask): Promise<void> {
    await this.repo.save(task);
  }

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
    return ApprovalRules.initiateApprovalPipeline(
      entityType,
      entityId,
      originatorId,
      title,
      customSteps
    );
  }

  initiateApprovalPipeline(
    entityType: ApprovalEntityType,
    entityId: string,
    originatorId: string,
    title?: string,
    customSteps?: ApprovalStep[]
  ): ApprovalTask {
    return ApprovalWorkflowService.initiateApprovalPipeline(
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
    return ApprovalRules.verifySoDCompliance(task, candidateUser);
  }

  verifySoDCompliance(
    task: ApprovalTask,
    candidateUser: { uid?: string; email?: string }
  ): boolean {
    return ApprovalWorkflowService.verifySoDCompliance(task, candidateUser);
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
    return ApprovalRules.createStandardTask(
      entityType,
      entityId,
      title,
      initiatorEmail,
      customSteps
    );
  }

  createStandardTask(
    entityType: ApprovalEntityType,
    entityId: string,
    title: string,
    initiatorEmail: string,
    customSteps?: ApprovalStep[]
  ): ApprovalTask {
    return ApprovalWorkflowService.createStandardTask(
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
    return ApprovalRules.getDefaultStepsForEntity(entityType);
  }

  getDefaultStepsForEntity(entityType: ApprovalEntityType): ApprovalStep[] {
    return ApprovalWorkflowService.getDefaultStepsForEntity(entityType);
  }

  /**
   * Thực thi bước duyệt tiếp theo (Workflow Engine Dispatch qua ApprovalWorkflowHandlers)
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

  async processStepDecision(
    task: ApprovalTask,
    user: { uid: string; email: string; role: Role | null; isAdmin?: boolean },
    decision: StepDecision,
    reason?: string,
    signature?: ElectronicSignature,
    options?: { enforceSoD?: boolean }
  ): Promise<ApprovalTask> {
    return ApprovalWorkflowService.processStepDecision(
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

  async revokeApproval(options: {
    task: ApprovalTask;
    user: { uid: string; email: string; role: Role | null; isAdmin?: boolean };
    reason: string;
    relatedBatch?: Batch;
    signature?: ElectronicSignature;
  }): Promise<ApprovalTask> {
    return ApprovalWorkflowService.revokeApproval(options);
  }
}

export const approvalWorkflowService = new ApprovalWorkflowService();
