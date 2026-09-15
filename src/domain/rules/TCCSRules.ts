/**
 * PQM Domain - TCCS Rules (Model 6)
 * Các quy tắc nghiệp vụ dành riêng cho Tiêu chuẩn cơ sở (TCCS)
 */

import { TCCS } from '../../types';

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
}
