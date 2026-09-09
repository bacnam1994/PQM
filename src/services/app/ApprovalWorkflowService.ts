/**
 * PQM V4 Platform - Approval Workflow Service
 * Động cơ điều phối xét duyệt nhiều cấp độ (Multi-stage Approval Engine)
 * Tích hợp ràng buộc Chữ ký số (21 CFR Part 11) & Bất biến Audit Trail.
 */

import {
  ApprovalTask,
  ApprovalEntityType,
  ApprovalStep,
  StepDecision,
  ApprovalLogEntry
} from '../../types/approvalWorkflow';
import { ElectronicSignature, Role } from '../../types';
import { signatureService } from '../signatureService';
import { logAuditAction } from '../auditService';

export class ApprovalWorkflowService {
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
    const now = new Date().toISOString();
    const defaultSteps = customSteps || this.getDefaultStepsForEntity(entityType);

    const initialHistory: ApprovalLogEntry = {
      timestamp: now,
      actorEmail: initiatorEmail,
      actorRole: 'INITIATOR',
      action: 'INITIATED',
      stepOrder: 0,
      comments: `Khởi tạo quy trình xét duyệt cho ${entityType} #${entityId}`
    };

    return {
      id: `task_${entityType.toLowerCase()}_${entityId}_${Date.now()}`,
      entityType,
      entityId,
      title,
      version: 1,
      status: 'PENDING',
      currentStepIndex: 0,
      steps: defaultSteps,
      history: [initialHistory],
      createdAt: now,
      updatedAt: now,
      createdBy: initiatorEmail
    };
  }

  /**
   * Cấu hình các bước phê duyệt chuẩn mực ngành Dược theo từng loại thực thể
   */
  static getDefaultStepsForEntity(entityType: ApprovalEntityType): ApprovalStep[] {
    switch (entityType) {
      case 'TEST_RESULT':
        return [
          { stepOrder: 1, stepName: 'Soát xét Kết quả Phân tích (QC Review)', roleRequired: 'QC', status: 'PENDING' },
          { stepOrder: 2, stepName: 'Phê duyệt & Khóa Phiếu Kiểm nghiệm (QA Approval)', roleRequired: 'QA', status: 'PENDING' }
        ];

      case 'BATCH':
        return [
          { stepOrder: 1, stepName: 'Xác nhận Hồ sơ Lô Hoàn tất (QC Complete)', roleRequired: 'QC', status: 'PENDING' },
          { stepOrder: 2, stepName: 'Đánh giá Sai lệch & Thẩm định Xuất xưởng (QA Clearance)', roleRequired: 'QA', status: 'PENDING' }
        ];

      case 'TCCS':
        return [
          { stepOrder: 1, stepName: 'Thẩm tra Kỹ thuật & Định lượng (QC Review)', roleRequired: 'QC', status: 'PENDING' },
          { stepOrder: 2, stepName: 'Phê duyệt Tiêu chuẩn Cơ sở (QA Approval)', roleRequired: 'QA', status: 'PENDING' }
        ];

      case 'DEVIATION':
        return [
          { stepOrder: 1, stepName: 'Đánh giá Nguyên nhân Gốc rễ & CAPA (QA Lead)', roleRequired: 'QA', status: 'PENDING' },
          { stepOrder: 2, stepName: 'Phê duyệt Đóng Sai lệch (QA Head Approval)', roleRequired: 'QA', status: 'PENDING' }
        ];

      case 'CHANGE_CONTROL':
        return [
          { stepOrder: 1, stepName: 'Đánh giá Tác động Thay đổi (Change Impact Assessment)', roleRequired: 'QA', status: 'PENDING' },
          { stepOrder: 2, stepName: 'Phê duyệt Triển khai Thay đổi (Management Approval)', roleRequired: 'ADMIN', status: 'PENDING' }
        ];

      default:
        return [
          { stepOrder: 1, stepName: 'Phê duyệt Chung', roleRequired: 'QA', status: 'PENDING' }
        ];
    }
  }

  /**
   * Thực thi bước duyệt tiếp theo
   */
  static async processStepDecision(
    task: ApprovalTask,
    user: { uid: string; email: string; role: Role | null; isAdmin?: boolean },
    decision: StepDecision,
    reason?: string,
    signature?: ElectronicSignature
  ): Promise<ApprovalTask> {
    if (task.status === 'APPROVED' || task.status === 'REJECTED' || task.status === 'CANCELLED') {
      throw new Error(`Nhiệm vụ xét duyệt đã kết thúc với trạng thái: ${task.status}.`);
    }

    const currentStep = task.steps[task.currentStepIndex];
    if (!currentStep) {
      throw new Error('Không tìm thấy bước xét duyệt hiện tại.');
    }

    // 1. Kiểm tra thẩm quyền vai trò (Role-based enforcement)
    const isAuthorized =
      user.isAdmin ||
      user.role === 'ADMIN' ||
      user.role === currentStep.roleRequired;

    if (!isAuthorized) {
      throw new Error(
        `Từ chối quyền: Bước "${currentStep.stepName}" yêu cầu vai trò ${currentStep.roleRequired}. Bạn hiện là ${user.role || 'GUEST'}.`
      );
    }

    // 2. Kiểm tra bắt buộc Chữ ký số (Electronic Signature) cho vai trò QA hoặc quyết định APPROVE
    if (currentStep.roleRequired === 'QA' || decision === 'APPROVE') {
      if (!signature) {
        throw new Error('Bắt buộc phải có chữ ký điện tử hợp lệ (Electronic Signature) để hoàn tất phê duyệt theo 21 CFR Part 11.');
      }
      const isValidSig = await signatureService.verifySignatureIntegrity(signature);
      if (!isValidSig) {
        throw new Error('Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp (Integrity Check Failed).');
      }
    }

    const now = new Date().toISOString();
    const updatedSteps = [...task.steps];
    const updatedHistory = [...task.history];

    if (decision === 'REJECT') {
      // Từ chối: đánh dấu bước bị REJECTED và toàn bộ task thành REJECTED
      updatedSteps[task.currentStepIndex] = {
        ...currentStep,
        status: 'REJECTED',
        decision: 'REJECT',
        reason: reason || 'Từ chối không nêu lý do cụ thể',
        signature,
        decidedAt: now,
        decidedBy: user.email
      };

      updatedHistory.push({
        timestamp: now,
        actorEmail: user.email,
        actorRole: String(user.role || 'ADMIN'),
        action: 'STEP_REJECTED',
        stepOrder: currentStep.stepOrder,
        comments: reason
      });

      logAuditAction({
        action: 'UPDATE',
        collection: 'ELECTRONIC_SIGNATURES',
        documentId: task.id,
        details: `[TỪ CHỐI] Bước ${currentStep.stepOrder} (${currentStep.stepName}) cho ${task.entityType} #${task.entityId}. Lý do: ${reason}`,
        performedBy: user.email
      });

      return {
        ...task,
        status: 'REJECTED',
        steps: updatedSteps,
        history: updatedHistory,
        updatedAt: now
      };
    }

    // Quyết định: APPROVE
    updatedSteps[task.currentStepIndex] = {
      ...currentStep,
      status: 'APPROVED',
      decision: 'APPROVE',
      reason,
      signature,
      decidedAt: now,
      decidedBy: user.email
    };

    updatedHistory.push({
      timestamp: now,
      actorEmail: user.email,
      actorRole: String(user.role || 'ADMIN'),
      action: 'STEP_APPROVED',
      stepOrder: currentStep.stepOrder,
      comments: reason
    });

    const isLastStep = task.currentStepIndex === task.steps.length - 1;
    const nextStepIndex = isLastStep ? task.currentStepIndex : task.currentStepIndex + 1;
    const newOverallStatus = isLastStep ? 'APPROVED' : 'IN_PROGRESS';

    logAuditAction({
      action: 'UPDATE',
      collection: 'ELECTRONIC_SIGNATURES',
      documentId: task.id,
      details: `[PHÊ DUYỆT] Bước ${currentStep.stepOrder} (${currentStep.stepName}) cho ${task.entityType} #${task.entityId}. Trạng thái tổng: ${newOverallStatus}`,
      performedBy: user.email
    });

    return {
      ...task,
      status: newOverallStatus,
      currentStepIndex: nextStepIndex,
      steps: updatedSteps,
      history: updatedHistory,
      updatedAt: now
    };
  }
}
