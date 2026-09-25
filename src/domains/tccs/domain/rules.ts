/**
 * TCCS DOMAIN: RULES
 *
 * Các quy tắc nghiệp vụ thuần túy (Pure Business Rules) của TCCS Domain:
 * - Mã TCCS không được để trống
 * - TCCS phải liên kết với một sản phẩm cụ thể (productId)
 * - Ràng buộc toàn vẹn lô: Không được xóa TCCS đang được tham chiếu bởi bất kỳ lô sản xuất nào
 * - Single Active Version invariant: Một sản phẩm tại một thời điểm chỉ có 1 TCCS active (bản mới nhất theo issueDate)
 */

import { TCCS, Batch } from './types';

export class TCCSRules {
  public static validate(tccs: Partial<TCCS>): { valid: boolean; error?: string } {
    if (!tccs.code || !tccs.code.trim()) {
      return { valid: false, error: 'Mã TCCS không được để trống.' };
    }
    if (!tccs.productId) {
      return { valid: false, error: 'TCCS phải liên kết với một sản phẩm cụ thể.' };
    }
    return { valid: true };
  }

  public static isBoundToBatch(tccsId: string, batches: Batch[] = []): boolean {
    return batches.some((b) => b.tccsId === tccsId);
  }

  public static resolveLatestActiveId(allTCCSForProduct: TCCS[]): string | null {
    if (allTCCSForProduct.length === 0) return null;
    const sorted = [...allTCCSForProduct].sort((a, b) =>
      (b.issueDate || '').localeCompare(a.issueDate || '')
    );
    return sorted[0].id;
  }
}
