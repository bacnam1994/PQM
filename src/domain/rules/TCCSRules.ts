/**
 * PQM Domain - TCCS Rules (Model 6)
 * Các quy tắc nghiệp vụ dành riêng cho Tiêu chuẩn cơ sở (TCCS)
 */

import { Batch, TCCS, CriterionType } from '../../types';
import { Role } from '../../types/permissions';

export class TCCSRules {
  /**
   * Lấy TCCS hiệu lực duy nhất của một sản phẩm
   */
  public static getActiveTCCS(productId: string, tccsList: TCCS[]): TCCS | undefined {
    const productTccs = tccsList.filter((t) => t.productId === productId);
    return productTccs.find((t) => t.isActive);
  }

  /**
   * Kiểm tra tính hợp lệ về phiên bản hiệu lực của TCCS
   */
  public static validateActiveStatus(
    productId: string,
    tccsList: TCCS[]
  ): {
    isValid: boolean;
    activeCount: number;
    issue?: 'NO_ACTIVE_TCCS' | 'MULTIPLE_ACTIVE_TCCS';
    description?: string;
  } {
    const productTccs = tccsList.filter((t) => t.productId === productId);
    const activeList = productTccs.filter((t) => t.isActive);

    if (productTccs.length > 0 && activeList.length === 0) {
      return {
        isValid: false,
        activeCount: 0,
        issue: 'NO_ACTIVE_TCCS',
        description: `Sản phẩm có ${productTccs.length} tiêu chuẩn TCCS nhưng không có tiêu chuẩn nào được đánh dấu hiệu lực (isActive).`,
      };
    }

    if (activeList.length > 1) {
      return {
        isValid: false,
        activeCount: activeList.length,
        issue: 'MULTIPLE_ACTIVE_TCCS',
        description: `Sản phẩm có đồng thời ${activeList.length} tiêu chuẩn TCCS cùng được đánh dấu hiệu lực (isActive).`,
      };
    }

    return {
      isValid: true,
      activeCount: activeList.length,
    };
  }

  /**
   * Kiểm tra tính hợp lệ về cấu trúc định nghĩa các chỉ tiêu của TCCS
   */
  public static validateCriteriaDefinitions(tccs: TCCS): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const allCriteria = [...(tccs.mainQualityCriteria || []), ...(tccs.safetyCriteria || [])];

    if (allCriteria.length === 0) {
      errors.push('Tiêu chuẩn TCCS phải có ít nhất một chỉ tiêu kỹ thuật.');
    }

    const seenNames = new Set<string>();

    for (const c of allCriteria) {
      // 1. Kiểm tra tên chỉ tiêu
      if (!c.name || c.name.trim().length === 0) {
        errors.push('Tồn tại chỉ tiêu chưa có tên định danh.');
        continue;
      }

      const normalizedName = c.name.trim().toLowerCase();
      if (seenNames.has(normalizedName)) {
        errors.push(`Trùng lặp tên chỉ tiêu trong cùng TCCS: "${c.name.trim()}".`);
      }
      seenNames.add(normalizedName);

      // 2. Kiểm tra giới hạn số min <= max
      if (c.type === CriterionType.NUMBER) {
        if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
          errors.push(
            `Chỉ tiêu "${c.name}" có giới hạn cận dưới (min: ${c.min}) lớn hơn cận trên (max: ${c.max}).`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Kiểm tra điều kiện kích hoạt hiệu lực TCCS (canActivateTCCS)
   */
  public static canActivate(
    tccs: TCCS,
    existingTccsList: TCCS[],
    userRole?: Role | string
  ): {
    allowed: boolean;
    reason?: string;
    blockers: string[];
  } {
    const blockers: string[] = [];

    // 1. Kiểm tra thẩm quyền (QA hoặc ADMIN)
    if (userRole && userRole !== 'ADMIN' && userRole !== 'QA') {
      blockers.push(
        `Vai trò ${userRole} không có thẩm quyền kích hoạt hiệu lực TCCS (yêu cầu QA hoặc ADMIN).`
      );
    }

    // 2. Kiểm tra cấu trúc chỉ tiêu
    const defCheck = this.validateCriteriaDefinitions(tccs);
    if (!defCheck.isValid) {
      blockers.push(...defCheck.errors);
    }

    return {
      allowed: blockers.length === 0,
      reason: blockers.length > 0 ? blockers[0] : undefined,
      blockers,
    };
  }

  /**
   * Kiểm tra điều kiện xóa TCCS (canDeleteTCCS)
   */
  public static canDelete(
    tccs: TCCS,
    linkedBatches?: Batch[],
    userRole?: Role | string
  ): {
    allowed: boolean;
    reason?: string;
    blockers: string[];
  } {
    const blockers: string[] = [];

    // 1. Phải là QA hoặc ADMIN
    if (userRole && userRole !== 'ADMIN' && userRole !== 'QA') {
      blockers.push(
        `Chỉ Quản trị viên (ADMIN) hoặc Đảm bảo chất lượng (QA) mới có quyền xóa TCCS.`
      );
    }

    // 2. Không được xóa TCCS đang hiệu lực nếu có lô hàng đang phụ thuộc
    if (linkedBatches && linkedBatches.length > 0) {
      const boundBatches = linkedBatches.filter((b) => b.tccsId === tccs.id);
      if (boundBatches.length > 0) {
        blockers.push(
          `Không thể xóa TCCS "${tccs.code}" vì đang được liên kết với ${boundBatches.length} Lô sản xuất theo quy chuẩn ALCOA+.`
        );
      }
    }

    return {
      allowed: blockers.length === 0,
      reason: blockers.length > 0 ? blockers[0] : undefined,
      blockers,
    };
  }
}
