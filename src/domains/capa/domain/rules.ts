/**
 * CAPA DOMAIN: RULES & STATE MACHINE
 * Tuân thủ ICH Q10 Pharmaceutical Quality System & Closed-Loop CAPA (BR-CAP-001 -> BR-CAP-004)
 */

import { CreateCapaPlanDto, QualityDeviation, CAPAActionItem } from './types';

export type CAPAItemStatus = CAPAActionItem['status'];

export class CAPAStateMachine {
  private static readonly VALID_TRANSITIONS: Record<CAPAItemStatus, CAPAItemStatus[]> = {
    PENDING: ['IN_PROGRESS', 'COMPLETED'],
    IN_PROGRESS: ['COMPLETED', 'PENDING'],
    COMPLETED: ['VERIFIED', 'IN_PROGRESS'],
    VERIFIED: [],
  };

  public static getValidNextStates(fromState: CAPAItemStatus): CAPAItemStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  public static canTransition(
    fromState: CAPAItemStatus,
    toState: CAPAItemStatus
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) return { allowed: true };

    const validNext = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNext.includes(toState)) {
      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái CAPA không hợp lệ từ ${fromState} sang ${toState}.`,
      };
    }

    return { allowed: true };
  }
}

export class CAPARules {
  /**
   * Xác thực thông tin khởi tạo kế hoạch hành động CAPA
   */
  public static validatePlanDto(dto: CreateCapaPlanDto): { isValid: boolean; error?: string } {
    if (!dto.description || !dto.description.trim()) {
      return { isValid: false, error: 'Nội dung hành động CAPA không được để trống.' };
    }
    if (!dto.assignedTo || !dto.assignedTo.trim()) {
      return {
        isValid: false,
        error: 'Người chịu trách nhiệm thực hiện CAPA không được để trống.',
      };
    }
    if (!dto.dueDate || !dto.dueDate.trim()) {
      return { isValid: false, error: 'Hạn chót hoàn thành (Due Date) của CAPA bắt buộc phải có.' };
    }
    return { isValid: true };
  }

  /**
   * Thẩm định điều kiện đóng vòng lặp CAPA (Closed-Loop CAPA)
   */
  public static canCloseCAPA(
    deviation: QualityDeviation,
    effectivenessEvidence: string,
    currentUser: any
  ): { allowed: boolean; reason?: string } {
    const isAuthorized =
      currentUser?.isAdmin || currentUser?.role === 'ADMIN' || currentUser?.role === 'QA';

    if (!isAuthorized) {
      return {
        allowed: false,
        reason:
          'Từ chối quyền: Chỉ Trưởng phòng QA hoặc Quản trị viên mới có thẩm quyền thẩm định hiệu quả và đóng CAPA (BR-CAP-002).',
      };
    }

    if (!effectivenessEvidence || effectivenessEvidence.trim().length < 20) {
      return {
        allowed: false,
        reason:
          'ERR_CAPA_EFFECTIVENESS_MISSING: Bắt buộc phải có báo cáo đánh giá hiệu quả chi tiết (tối thiểu 20 ký tự) trước khi đóng CAPA (BR-CAP-002).',
      };
    }

    const capaItems = deviation.capaItems || [];
    if (capaItems.length === 0) {
      return {
        allowed: false,
        reason:
          'ERR_CAPA_NO_ACTIONS: Hồ sơ CAPA chưa có hành động khắc phục/phòng ngừa nào được thiết lập.',
      };
    }

    const hasPendingItems = capaItems.some(
      (item) => item.status !== 'COMPLETED' && item.status !== 'VERIFIED'
    );
    if (hasPendingItems) {
      return {
        allowed: false,
        reason:
          'ERR_CAPA_ITEMS_INCOMPLETE: Không thể đóng CAPA khi vẫn còn hành động khắc phục/phòng ngừa chưa hoàn thành (COMPLETED).',
      };
    }

    return { allowed: true };
  }
}
