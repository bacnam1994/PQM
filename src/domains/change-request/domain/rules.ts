/**
 * CHANGE REQUEST DOMAIN: RULES & STATE MACHINE
 * Tuân thủ ICH Q10 Pharmaceutical Quality System & Change Management (BR-CR-001 -> BR-CR-005)
 */

import { ChangeRequest, ChangeStatus, CreateChangeRequestInput, FMEARiskAssessment } from './types';

export class ChangeRequestStateMachine {
  private static readonly VALID_TRANSITIONS: Record<ChangeStatus, ChangeStatus[]> = {
    DRAFT: ['IMPACT_ASSESSMENT', 'QA_REVIEW', 'REJECTED'],
    IMPACT_ASSESSMENT: ['QA_REVIEW', 'REJECTED', 'DRAFT'],
    QA_REVIEW: ['APPROVED', 'REJECTED', 'IMPACT_ASSESSMENT'],
    APPROVED: ['IMPLEMENTATION', 'REJECTED'],
    IMPLEMENTATION: ['EFFECTIVENESS_VERIFICATION', 'REJECTED', 'CLOSED'],
    EFFECTIVENESS_VERIFICATION: ['CLOSED', 'REJECTED', 'IMPLEMENTATION'],
    CLOSED: [],
    REJECTED: [],
  };

  public static getValidNextStates(fromState: ChangeStatus): ChangeStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  public static canTransition(
    fromState: ChangeStatus,
    toState: ChangeStatus
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) return { allowed: true };

    const validNext = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNext.includes(toState)) {
      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái Change Request không hợp lệ từ ${fromState} sang ${toState}.`,
      };
    }

    return { allowed: true };
  }
}

export class ChangeRequestRules {
  /**
   * Xác thực thông tin đầu vào khi khởi tạo Change Request
   */
  public static validateCreateInput(input: CreateChangeRequestInput): {
    isValid: boolean;
    error?: string;
  } {
    if (!input.title || !input.title.trim()) {
      return { isValid: false, error: 'Tiêu đề Yêu cầu Thay đổi không được để trống.' };
    }
    if (!input.category) {
      return { isValid: false, error: 'Phân loại thay đổi (Category) là bắt buộc.' };
    }
    if (!input.changeType) {
      return { isValid: false, error: 'Mức độ thay đổi (Change Type) là bắt buộc.' };
    }
    if (!input.justification || !input.justification.trim()) {
      return { isValid: false, error: 'Lý do/Sự cần thiết thay đổi không được để trống.' };
    }
    if (!input.description || !input.description.trim()) {
      return { isValid: false, error: 'Mô tả chi tiết nội dung thay đổi không được để trống.' };
    }
    if (!input.targetImplementationDate || !input.targetImplementationDate.trim()) {
      return { isValid: false, error: 'Thời hạn hoàn thành dự kiến là bắt buộc.' };
    }
    return { isValid: true };
  }

  /**
   * Tính toán điểm rủi ro RPN và phân loại cấp độ rủi ro theo ma trận FMEA
   */
  public static calculateFMEARisk(
    fmea: Omit<FMEARiskAssessment, 'rpn' | 'riskLevel'>
  ): FMEARiskAssessment {
    const rpn = fmea.severity * fmea.probability * fmea.detectability;
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = rpn >= 60 ? 'HIGH' : rpn >= 25 ? 'MEDIUM' : 'LOW';

    return {
      ...fmea,
      rpn,
      riskLevel,
    };
  }

  /**
   * Kiểm tra điều kiện thẩm quyền và tính trọn vẹn trước khi Đóng (Close) Change Request
   */
  public static canCloseChangeRequest(
    cr: ChangeRequest,
    currentUser: { role?: string | null; isAdmin?: boolean }
  ): { allowed: boolean; reason?: string } {
    const isAuthorized =
      currentUser?.isAdmin || currentUser?.role === 'QA' || currentUser?.role === 'ADMIN';

    if (!isAuthorized) {
      return {
        allowed: false,
        reason:
          'Từ chối quyền: Chỉ Quản lý QA hoặc Quản trị viên mới có thẩm quyền Đóng (Close) Change Request.',
      };
    }

    const hasUnfinished = (cr.actionItems || []).some((a) => a.status !== 'COMPLETED');
    if (hasUnfinished) {
      return {
        allowed: false,
        reason: 'Không thể đóng thay đổi: Vẫn còn các hành động trong kế hoạch chưa hoàn thành.',
      };
    }

    return { allowed: true };
  }
}
