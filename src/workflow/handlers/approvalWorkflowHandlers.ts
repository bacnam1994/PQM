/**
 * approvalWorkflowHandlers.ts
 * PQM Workflow Engine - Approval & Electronic Signature Handlers
 * Đảm bảo 100% các thao tác duyệt đa cấp và chữ ký điện tử đi qua WorkflowFacade.dispatch()
 */

import { WorkflowFacade } from '../WorkflowFacade';
import { WorkflowExecutionContext, WorkflowActor } from '../contracts/actions';
import {
  ApprovalTask,
  ApprovalEntityType,
  ApprovalOverallStatus,
  ApprovalStep,
  StepDecision,
  ApprovalLogEntry,
} from '../../types/approvalWorkflow';
import { ElectronicSignature, Role, Batch } from '../../types';
import { signatureService } from '../../services/signatureService';
import { logAuditAction } from '../../services/auditService';

export class ApprovalWorkflowHandlers {
  private static toActor(user: {
    uid?: string;
    email: string;
    role: Role | null;
    isAdmin?: boolean;
  }): WorkflowActor {
    const rawRole = (user.role || (user.isAdmin ? 'ADMIN' : 'USER')).toUpperCase();
    return {
      id: user.uid || user.email,
      name: user.email,
      role: rawRole,
      email: user.email,
      isAdmin: user.isAdmin || rawRole === 'ADMIN',
    } as any;
  }

  /**
   * Tạo nhiệm vụ xét duyệt chuẩn
   */
  public static createStandardTask(
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
      comments: `Khởi tạo quy trình xét duyệt cho ${entityType} #${entityId}`,
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
      createdBy: initiatorEmail,
    };
  }

  /**
   * Cấu hình các bước phê duyệt chuẩn mực ngành Dược theo từng loại thực thể
   */
  public static getDefaultStepsForEntity(entityType: ApprovalEntityType): ApprovalStep[] {
    switch (entityType) {
      case 'TEST_RESULT':
        return [
          {
            stepOrder: 1,
            stepName: 'Soát xét Kết quả Phân tích (QC Review)',
            roleRequired: 'QC',
            status: 'PENDING',
          },
          {
            stepOrder: 2,
            stepName: 'Phê duyệt & Khóa Phiếu Kiểm nghiệm (QA Approval)',
            roleRequired: 'QA',
            status: 'PENDING',
          },
        ];

      case 'BATCH':
        return [
          {
            stepOrder: 1,
            stepName: 'Xác nhận Hồ sơ Lô Hoàn tất (QC Complete)',
            roleRequired: 'QC',
            status: 'PENDING',
          },
          {
            stepOrder: 2,
            stepName: 'Đánh giá Sai lệch & Thẩm định Xuất xưởng (QA Clearance)',
            roleRequired: 'QA',
            status: 'PENDING',
          },
        ];

      case 'TCCS':
        return [
          {
            stepOrder: 1,
            stepName: 'Thẩm tra Kỹ thuật & Định lượng (QC Review)',
            roleRequired: 'QC',
            status: 'PENDING',
          },
          {
            stepOrder: 2,
            stepName: 'Phê duyệt Tiêu chuẩn Cơ sở (QA Approval)',
            roleRequired: 'QA',
            status: 'PENDING',
          },
        ];

      case 'DEVIATION':
        return [
          {
            stepOrder: 1,
            stepName: 'Đánh giá Nguyên nhân Gốc rễ & CAPA (QA Lead)',
            roleRequired: 'QA',
            status: 'PENDING',
          },
          {
            stepOrder: 2,
            stepName: 'Phê duyệt Đóng Sai lệch (QA Head Approval)',
            roleRequired: 'QA',
            status: 'PENDING',
          },
        ];

      case 'CHANGE_CONTROL':
        return [
          {
            stepOrder: 1,
            stepName: 'Đánh giá Tác động Thay đổi (Change Impact Assessment)',
            roleRequired: 'QA',
            status: 'PENDING',
          },
          {
            stepOrder: 2,
            stepName: 'Phê duyệt Triển khai Thay đổi (Management Approval)',
            roleRequired: 'ADMIN',
            status: 'PENDING',
          },
        ];

      default:
        return [
          { stepOrder: 1, stepName: 'Phê duyệt Chung', roleRequired: 'QA', status: 'PENDING' },
        ];
    }
  }

  /**
   * Kiểm tra tuân thủ nguyên tắc Tách biệt Trách nhiệm (Segregation of Duties - SoD)
   */
  public static verifySoDCompliance(
    task: ApprovalTask,
    candidateUser: { uid?: string; email?: string }
  ): boolean {
    const candidateEmail = (candidateUser.email || '').trim().toLowerCase();
    const candidateUid = (candidateUser.uid || '').trim();
    const createdBy = (task.createdBy || '').trim().toLowerCase();
    const originatorId = (task.metadata?.originatorId || '').trim().toLowerCase();

    if (candidateEmail && (candidateEmail === createdBy || candidateEmail === originatorId)) {
      return false;
    }
    if (candidateUid && (candidateUid === createdBy || candidateUid === originatorId)) {
      return false;
    }
    return true;
  }

  /**
   * Khởi tạo đường ống thẩm duyệt qua Workflow Engine
   */
  public static initiateApprovalPipeline(
    entityType: ApprovalEntityType,
    entityId: string,
    originatorId: string,
    title?: string,
    customSteps?: ApprovalStep[]
  ): ApprovalTask {
    const defaultTitle = title || `Quy trình thẩm duyệt ${entityType} #${entityId}`;
    const task = this.createStandardTask(
      entityType,
      entityId,
      defaultTitle,
      originatorId,
      customSteps
    );
    task.metadata = {
      ...task.metadata,
      originatorId,
      enforceSoD: true,
    };
    return task;
  }

  /**
   * Quyết định bước thẩm duyệt (Phê duyệt hoặc Từ chối) qua WorkflowFacade
   */
  public static async processStepDecision(
    task: ApprovalTask,
    user: { uid: string; email: string; role: Role | null; isAdmin?: boolean },
    decision: StepDecision,
    reason?: string,
    signature?: ElectronicSignature,
    options?: { enforceSoD?: boolean }
  ): Promise<ApprovalTask> {
    const actor = this.toActor(user);

    const context: WorkflowExecutionContext = {
      actionId: 'APPROVAL_TASK_DECIDE',
      entityType: 'APPROVAL_TASK',
      entityId: task.id,
      actor,
      payload: {
        taskId: task.id,
        decision,
        reason,
        entityType: task.entityType,
        entityId: task.entityId,
        stepIndex: task.currentStepIndex,
      },
      signature: signature as any,
    };

    const execution = await WorkflowFacade.dispatch<any, ApprovalTask>(
      context,
      async (): Promise<ApprovalTask> => {
        if (
          task.status === 'APPROVED' ||
          task.status === 'REJECTED' ||
          task.status === 'CANCELLED'
        ) {
          throw new Error(`Nhiệm vụ xét duyệt đã kết thúc với trạng thái: ${task.status}.`);
        }

        const currentStep = task.steps[task.currentStepIndex];
        if (!currentStep) {
          throw new Error('Không tìm thấy bước xét duyệt hiện tại.');
        }

        // 0. Kiểm tra SoD (Segregation of Duties) nghiêm ngặt
        const shouldCheckSoD = options?.enforceSoD ?? task.metadata?.enforceSoD ?? false;
        if (shouldCheckSoD && !this.verifySoDCompliance(task, user)) {
          logAuditAction({
            action: 'UPDATE',
            collection: 'ELECTRONIC_SIGNATURES',
            documentId: task.id,
            details: `[CẢNH BÁO AN NINH] Cố gắng vi phạm nguyên tắc tách biệt trách nhiệm (SoD): Người dùng ${user.email} cố tự duyệt bản ghi #${task.entityId}`,
            performedBy: user.email,
          });
          throw new Error(
            'ERR_SOD_VIOLATION: Người lập bản ghi không được phép tự thẩm định hoặc tự phê duyệt (Vi phạm nguyên tắc Tách biệt trách nhiệm SoD).'
          );
        }

        // 1. Kiểm tra thẩm quyền vai trò (Role-based enforcement)
        const isAuthorized =
          user.isAdmin || user.role === 'ADMIN' || user.role === currentStep.roleRequired;

        if (!isAuthorized) {
          throw new Error(
            `Từ chối quyền: Bước "${currentStep.stepName}" yêu cầu vai trò ${currentStep.roleRequired}. Bạn hiện là ${user.role || 'GUEST'}.`
          );
        }

        // 2. Kiểm tra bắt buộc Chữ ký số (Electronic Signature) cho vai trò QA hoặc quyết định APPROVE
        if (currentStep.roleRequired === 'QA' || decision === 'APPROVE') {
          if (!signature) {
            throw new Error(
              'Bắt buộc phải có chữ ký điện tử hợp lệ (Electronic Signature) để hoàn tất phê duyệt theo 21 CFR Part 11.'
            );
          }
          const isValidSig = await signatureService.verifySignatureIntegrity(signature);
          if (!isValidSig) {
            throw new Error(
              'Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp (Integrity Check Failed).'
            );
          }
        }

        const now = new Date().toISOString();
        const updatedSteps = [...task.steps];
        const updatedHistory = [...task.history];

        if (decision === 'REJECT') {
          if (!reason || !reason.trim()) {
            throw new Error(
              'ERR_REJECTION_REASON_REQUIRED: Bắt buộc phải nhập lý do khi từ chối phê duyệt.'
            );
          }
          if (reason.trim().length < 10) {
            throw new Error(
              'ERR_REJECTION_REASON_TOO_SHORT: Lý do từ chối phải có tối thiểu 10 ký tự giải trình cụ thể.'
            );
          }
          updatedSteps[task.currentStepIndex] = {
            ...currentStep,
            status: 'REJECTED',
            decision: 'REJECT',
            reason: reason || 'Từ chối không nêu lý do cụ thể',
            signature,
            decidedAt: now,
            decidedBy: user.email,
          };

          updatedHistory.push({
            timestamp: now,
            actorEmail: user.email,
            actorRole: String(user.role || 'ADMIN'),
            action: 'STEP_REJECTED',
            stepOrder: currentStep.stepOrder,
            comments: reason,
          });

          logAuditAction({
            action: 'UPDATE',
            collection: 'ELECTRONIC_SIGNATURES',
            documentId: task.id,
            details: `[TỪ CHỐI] Bước ${currentStep.stepOrder} (${currentStep.stepName}) cho ${task.entityType} #${task.entityId}. Lý do: ${reason}`,
            performedBy: user.email,
          });

          return {
            ...task,
            status: 'REJECTED' as ApprovalOverallStatus,
            steps: updatedSteps,
            history: updatedHistory,
            updatedAt: now,
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
          decidedBy: user.email,
        };

        updatedHistory.push({
          timestamp: now,
          actorEmail: user.email,
          actorRole: String(user.role || 'ADMIN'),
          action: 'STEP_APPROVED',
          stepOrder: currentStep.stepOrder,
          comments: reason,
        });

        const isLastStep = task.currentStepIndex === task.steps.length - 1;
        const nextStepIndex = isLastStep ? task.currentStepIndex : task.currentStepIndex + 1;
        const newOverallStatus: ApprovalOverallStatus = isLastStep ? 'APPROVED' : 'IN_PROGRESS';

        logAuditAction({
          action: 'UPDATE',
          collection: 'ELECTRONIC_SIGNATURES',
          documentId: task.id,
          details: `[PHÊ DUYỆT] Bước ${currentStep.stepOrder} (${currentStep.stepName}) cho ${task.entityType} #${task.entityId}. Trạng thái tổng: ${newOverallStatus}`,
          performedBy: user.email,
        });

        return {
          ...task,
          status: newOverallStatus,
          currentStepIndex: nextStepIndex,
          steps: updatedSteps,
          history: updatedHistory,
          updatedAt: now,
        };
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi thực thi APPROVAL_TASK_DECIDE qua Workflow.');
    }

    return execution.data!;
  }

  /**
   * Thu hồi hoặc hủy bỏ phê duyệt qua Workflow Engine
   */
  public static async revokeApproval(options: {
    task: ApprovalTask;
    user: { uid: string; email: string; role: Role | null; isAdmin?: boolean };
    reason: string;
    relatedBatch?: Batch;
    signature?: ElectronicSignature;
  }): Promise<ApprovalTask> {
    const { task, user, reason, relatedBatch, signature } = options;
    const actor = this.toActor(user);

    const context: WorkflowExecutionContext = {
      actionId: 'APPROVAL_TASK_CANCEL',
      entityType: 'APPROVAL_TASK',
      entityId: task.id,
      actor,
      payload: {
        taskId: task.id,
        reason,
        entityType: task.entityType,
        entityId: task.entityId,
      },
      reason,
      signature: signature as any,
    };

    const execution = await WorkflowFacade.dispatch(context, async () => {
      // 1. Kiểm tra quyền hạn (QA hoặc ADMIN)
      const isAuthorized = user.isAdmin || user.role === 'ADMIN' || user.role === 'QA';
      if (!isAuthorized) {
        throw new Error(
          'Từ chối quyền: Chỉ QA Manager hoặc Quản trị viên mới có thẩm quyền thu hồi/hủy phê duyệt (BR-APP-002).'
        );
      }

      // 2. Kiểm tra điều kiện Lô liên quan (BR-APP-002)
      if (relatedBatch?.status === 'RELEASED') {
        throw new Error(
          'BỊ TỪ CHỐI: Không thể hủy duyệt phiếu khi Lô sản xuất liên quan đã Xuất xưởng (RELEASED). Phải đưa Lô về trạng thái HOLD hoặc RECALLED/BLOCKED trước (BR-APP-002).'
        );
      }

      // 3. Kiểm tra độ dài lý do giải trình kỹ thuật (Tối thiểu 30 ký tự per BR-APP-002)
      if (!reason || reason.trim().length < 30) {
        throw new Error(
          'ERR_REVOCATION_REASON_TOO_SHORT: Lý do thu hồi/hủy duyệt bắt buộc phải có tối thiểu 30 ký tự giải trình chi tiết kỹ thuật (BR-APP-002).'
        );
      }

      // 4. Kiểm tra chữ ký số nếu có
      if (signature) {
        const isValidSig = await signatureService.verifySignatureIntegrity(signature);
        if (!isValidSig) {
          throw new Error('Chữ ký điện tử xác nhận thu hồi không hợp lệ hoặc đã bị can thiệp.');
        }
      }

      const now = new Date().toISOString();
      const updatedHistory: ApprovalLogEntry[] = [
        ...task.history,
        {
          timestamp: now,
          actorEmail: user.email,
          actorRole: String(user.role || 'ADMIN'),
          action: 'CANCELLED',
          stepOrder: task.currentStepIndex + 1,
          comments: `[THU HỒI / HỦY PHÊ DUYỆT] ${reason}`,
        },
      ];

      logAuditAction({
        action: 'UPDATE',
        collection: 'ELECTRONIC_SIGNATURES',
        documentId: task.id,
        details: `[THU HỒI PHÊ DUYỆT] Hủy duyệt ${task.entityType} #${task.entityId}. Lý do: ${reason}`,
        performedBy: user.email,
      });

      return {
        ...task,
        status: 'REJECTED' as ApprovalOverallStatus,
        history: updatedHistory,
        updatedAt: now,
        metadata: {
          ...task.metadata,
          revokedAt: now,
          revokedBy: user.email,
          revocationReason: reason,
        },
      };
    });

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi thực thi APPROVAL_TASK_CANCEL qua Workflow.');
    }

    return execution.data!;
  }
}
