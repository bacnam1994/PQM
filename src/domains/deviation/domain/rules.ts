/**
 * DEVIATION DOMAIN: RULES & STATE MACHINE
 */

import { QualityDeviation, DeviationStatus, CreateDeviationInput } from '../../../types/deviation';

export class DeviationStateMachine {
  private static readonly VALID_TRANSITIONS: Record<DeviationStatus, DeviationStatus[]> = {
    LOGGED: ['UNDER_INVESTIGATION', 'CLOSED'],
    UNDER_INVESTIGATION: ['CAPA_PLANNED', 'CLOSED'],
    CAPA_PLANNED: ['EFFECTIVENESS_REVIEW', 'UNDER_INVESTIGATION', 'CLOSED'],
    EFFECTIVENESS_REVIEW: ['CLOSED', 'UNDER_INVESTIGATION'],
    CLOSED: ['UNDER_INVESTIGATION'], // Mở lại khi cần tái điều tra (chỉ QA/ADMIN)
  };

  public static getValidNextStates(fromState: DeviationStatus): DeviationStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  public static canTransition(
    fromState: DeviationStatus,
    toState: DeviationStatus,
    context?: { actorRole?: string; reason?: string }
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) return { allowed: true };

    const validNext = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNext.includes(toState)) {
      return {
        allowed: false,
        reason: `Không thể chuyển đổi trạng thái sai lệch từ ${fromState} sang ${toState}.`,
      };
    }

    if (toState === 'CLOSED') {
      const roleStr = String(context?.actorRole || '').toUpperCase();
      const isQAOrAdmin = roleStr === 'QA' || roleStr === 'ADMIN';
      if (!isQAOrAdmin) {
        return {
          allowed: false,
          reason:
            'Chỉ Trưởng phòng QA hoặc Quản trị viên mới có thẩm quyền Đóng (Close) hồ sơ sai lệch.',
        };
      }
      if (!context?.reason || !context.reason.trim()) {
        return {
          allowed: false,
          reason:
            'Quy chuẩn GMP: Bắt buộc phải có lý do giải trình và kết luận trước khi đóng sai lệch.',
        };
      }
    }

    return { allowed: true };
  }
}

export class DeviationRules {
  /**
   * Xác thực thông tin đầu vào khi tạo mới sai lệch
   */
  public static validateCreateInput(input: CreateDeviationInput): {
    isValid: boolean;
    error?: string;
  } {
    if (!input.title || !input.title.trim()) {
      return { isValid: false, error: 'Tiêu đề sai lệch không được để trống.' };
    }
    if (!input.source) {
      return { isValid: false, error: 'Nguồn phát hiện sai lệch không được để trống.' };
    }
    if (!input.severity) {
      return { isValid: false, error: 'Mức độ nghiêm trọng của sai lệch không được để trống.' };
    }
    if (!input.description || !input.description.trim()) {
      return { isValid: false, error: 'Mô tả chi tiết sai lệch không được để trống.' };
    }
    return { isValid: true };
  }

  /**
   * Kiểm tra điều kiện đóng hồ sơ sai lệch
   */
  public static canClose(
    deviation: QualityDeviation,
    currentUser: any,
    notes?: string
  ): { allowed: boolean; reason?: string } {
    const isQAOrAdmin =
      currentUser?.isAdmin || currentUser?.role === 'QA' || currentUser?.role === 'ADMIN';
    if (!isQAOrAdmin) {
      return {
        allowed: false,
        reason:
          'Từ chối quyền: Chỉ Trưởng phòng QA hoặc Quản trị viên mới có quyền Đóng (Close) hồ sơ sai lệch.',
      };
    }
    if (!notes && !deviation.closureNotes) {
      return {
        allowed: false,
        reason:
          'Quy chuẩn GMP: Bắt buộc phải ghi nhận ý kiến thẩm định và kết luận trước khi đóng sai lệch.',
      };
    }
    return { allowed: true };
  }
}
