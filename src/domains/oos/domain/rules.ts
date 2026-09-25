/**
 * OOS DOMAIN: RULES & STATE MACHINE
 * Tuân thủ hướng dẫn FDA Guidance for Industry: Investigating OOS Test Results
 */

import { OOSInvestigationPhase1, OOSInvestigationPhase2, OOSInvestigationStatus } from './types';

export class OOSStateMachine {
  private static readonly VALID_TRANSITIONS: Record<
    OOSInvestigationStatus,
    OOSInvestigationStatus[]
  > = {
    TRIGGERED: ['PHASE1_LAB_INVESTIGATION'],
    PHASE1_LAB_INVESTIGATION: ['PHASE2_MFG_INVESTIGATION', 'CONCLUDED'],
    PHASE2_MFG_INVESTIGATION: ['CONCLUDED'],
    CONCLUDED: [],
  };

  public static getValidNextStates(fromState: OOSInvestigationStatus): OOSInvestigationStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  public static canTransition(
    fromState: OOSInvestigationStatus,
    toState: OOSInvestigationStatus,
    context?: { actorRole?: string }
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) return { allowed: true };

    const validNext = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNext.includes(toState)) {
      return {
        allowed: false,
        reason: `Chuyển đổi điều tra OOS không hợp lệ: Không thể chuyển từ ${fromState} sang ${toState}.`,
      };
    }

    if (toState === 'CONCLUDED') {
      const roleStr = String(context?.actorRole || '').toUpperCase();
      const isQAOrAdmin = roleStr === 'QA' || roleStr === 'ADMIN';
      if (!isQAOrAdmin) {
        return {
          allowed: false,
          reason:
            'Từ chối quyền: Chỉ QA hoặc Quản trị viên mới có thẩm quyền kết luận và đóng hồ sơ OOS.',
        };
      }
    }

    return { allowed: true };
  }
}

export class OOSRules {
  /**
   * Xác thực dữ liệu điều tra phòng kiểm nghiệm (Phase 1 Lab Investigation)
   */
  public static validatePhase1(data: OOSInvestigationPhase1): { isValid: boolean; error?: string } {
    if (!data.assignedAnalyst || !data.assignedAnalyst.trim()) {
      return {
        isValid: false,
        error: 'Kiểm nghiệm viên phụ trách điều tra Phase 1 không được để trống.',
      };
    }
    if (data.labErrorFound && (!data.labErrorDetails || !data.labErrorDetails.trim())) {
      return {
        isValid: false,
        error: 'Bắt buộc phải mô tả chi tiết lỗi phòng thí nghiệm khi xác nhận có sai sót.',
      };
    }
    return { isValid: true };
  }

  /**
   * Xác thực dữ liệu điều tra quy trình sản xuất (Phase 2 Manufacturing Investigation)
   */
  public static validatePhase2(data: OOSInvestigationPhase2): { isValid: boolean; error?: string } {
    if (!data.rootCauseIdentified || !data.rootCauseIdentified.trim()) {
      return {
        isValid: false,
        error: 'Nguyên nhân gốc rễ (Root Cause) không được để trống khi kết luận Phase 2.',
      };
    }
    return { isValid: true };
  }

  /**
   * Kiểm tra thẩm quyền kết luận OOS
   */
  public static canConclude(currentUser: any): { allowed: boolean; reason?: string } {
    const isQAOrAdmin =
      currentUser?.isAdmin || currentUser?.role === 'QA' || currentUser?.role === 'ADMIN';
    if (!isQAOrAdmin) {
      return {
        allowed: false,
        reason:
          'Từ chối quyền: Chỉ QA hoặc Quản trị viên (ADMIN) mới có thẩm quyền kết luận và đóng hồ sơ OOS.',
      };
    }
    return { allowed: true };
  }
}
