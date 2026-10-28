/**
 * APPROVAL DOMAIN: RULES & STATE MACHINE
 * Các quy tắc nghiệp vụ, rào chắn an ninh (SoD) và Máy trạng thái Phê duyệt Đa cấp (FSM)
 * Tuân thủ BR-APP-001 -> BR-APP-003, 21 CFR Part 11 và EU GMP Annex 11.
 */

import { Role, ElectronicSignature, Batch } from '../../../types';
import {
  ApprovalTask,
  ApprovalEntityType,
  ApprovalOverallStatus,
  ApprovalStep,
  StepDecision,
  ApprovalLogEntry,
} from './types';

export class ApprovalTaskStateMachine {
  private static readonly VALID_TRANSITIONS: Record<
    ApprovalOverallStatus,
    ApprovalOverallStatus[]
  > = {
    PENDING: ['IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED'],
    IN_PROGRESS: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['REJECTED', 'CANCELLED'], // Cho phép thu hồi/hủy duyệt theo BR-APP-002
    REJECTED: [],
    CANCELLED: [],
  };

  public static getValidNextStates(fromState: ApprovalOverallStatus): ApprovalOverallStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  public static canTransition(
    fromState: ApprovalOverallStatus,
    toState: ApprovalOverallStatus
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) return { allowed: true };

    const validNext = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNext.includes(toState)) {
      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái nhiệm vụ phê duyệt không hợp lệ từ ${fromState} sang ${toState}.`,
      };
    }

    return { allowed: true };
  }

  public static isTerminal(status: ApprovalOverallStatus): boolean {
    return status === 'REJECTED' || status === 'CANCELLED';
  }
}

export class ApprovalRules {
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
   * Tạo một Approval Task mới theo cấu hình chuẩn của từng loại thực thể
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
   * Kiểm tra tuân thủ nguyên tắc Tách biệt Trách nhiệm (Segregation of Duties - SoD)
   * Chặn người lập/người phân tích tự thẩm định hoặc tự phê duyệt
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
   * Khởi tạo đường ống thẩm duyệt đa cấp với cơ chế bảo vệ SoD
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
   * Thẩm định điều kiện thực thi bước duyệt (BR-APP-001)
   */
  public static validateStepDecisionPreconditions(options: {
    task: ApprovalTask;
    user: { uid?: string; email: string; role: Role | null; isAdmin?: boolean };
    decision: StepDecision;
    reason?: string;
    signature?: ElectronicSignature;
    enforceSoD?: boolean;
  }): { currentStep: ApprovalStep } {
    const { task, user, decision, reason, signature, enforceSoD } = options;

    if (task.status === 'APPROVED' || task.status === 'REJECTED' || task.status === 'CANCELLED') {
      throw new Error(`Nhiệm vụ xét duyệt đã kết thúc với trạng thái: ${task.status}.`);
    }

    const currentStep = task.steps[task.currentStepIndex];
    if (!currentStep) {
      throw new Error('Không tìm thấy bước xét duyệt hiện tại.');
    }

    // 1. Kiểm tra SoD (Segregation of Duties)
    const shouldCheckSoD = enforceSoD ?? task.metadata?.enforceSoD ?? false;
    if (shouldCheckSoD && !this.verifySoDCompliance(task, user)) {
      throw new Error(
        'ERR_SOD_VIOLATION: Người lập bản ghi không được phép tự thẩm định hoặc tự phê duyệt (Vi phạm nguyên tắc Tách biệt trách nhiệm SoD).'
      );
    }

    // 2. Kiểm tra thẩm quyền vai trò (Role-based enforcement)
    const isAuthorized =
      user.isAdmin || user.role === 'ADMIN' || user.role === currentStep.roleRequired;

    if (!isAuthorized) {
      throw new Error(
        `Từ chối quyền: Bước "${currentStep.stepName}" yêu cầu vai trò ${currentStep.roleRequired}. Bạn hiện là ${user.role || 'GUEST'}.`
      );
    }

    // 3. Kiểm tra bắt buộc Chữ ký số (Electronic Signature) cho vai trò QA hoặc quyết định APPROVE
    if (currentStep.roleRequired === 'QA' || decision === 'APPROVE') {
      if (!signature) {
        throw new Error(
          'Bắt buộc phải có chữ ký điện tử hợp lệ (Electronic Signature) để hoàn tất phê duyệt theo 21 CFR Part 11.'
        );
      }
    }

    // 4. Kiểm tra lý do khi từ chối (REJECT)
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
    }

    return { currentStep };
  }

  /**
   * Thẩm định điều kiện thu hồi hoặc hủy bỏ phê duyệt (BR-APP-002)
   */
  public static validateRevocationPreconditions(options: {
    task: ApprovalTask;
    user: { uid?: string; email: string; role: Role | null; isAdmin?: boolean };
    reason: string;
    relatedBatch?: Batch;
  }): void {
    const { user, reason, relatedBatch } = options;

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
  }
}
