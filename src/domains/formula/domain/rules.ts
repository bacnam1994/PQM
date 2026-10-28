/**
 * FORMULA DOMAIN: RULES
 *
 * Các quy tắc nghiệp vụ thuần túy (Pure Business Rules) của Formula Domain:
 * - Công thức phải liên kết với một sản phẩm cụ thể (productId)
 * - Sanitization: Chuẩn hóa declaredContent thành số hợp lệ (nếu không hợp lệ thì gán 0)
 * - Sanitization: Chuẩn hóa elementalContent thành số hợp lệ (hoặc bỏ trường nếu không có)
 */

import { ProductFormula } from './types';
import { parseNumberFromText } from '../../../utils';

export class FormulaRules {
  public static validate(formula: Partial<ProductFormula>): { valid: boolean; error?: string } {
    if (!formula.productId || !formula.productId.trim()) {
      return { valid: false, error: 'Công thức phải liên kết với một sản phẩm cụ thể.' };
    }
    return { valid: true };
  }

  public static sanitize(formula: ProductFormula): ProductFormula {
    const processed = { ...formula };

    const sanitizeItem = (item: any) => {
      if (!item) return item;
      const newItem = { ...item };

      // 1. Xử lý declaredContent: nếu là string, parse ra số; nếu NaN / không hợp lệ thì gán 0
      let dc = newItem.declaredContent;
      if (typeof dc === 'string') {
        const parsed = parseNumberFromText(dc);
        dc = isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
      } else if (typeof dc !== 'number' || isNaN(dc) || !isFinite(dc)) {
        dc = 0;
      }
      newItem.declaredContent = dc;

      // 2. Xử lý elementalContent: nếu có thì parse số hợp lệ, nếu không thì undefined
      let ec = newItem.elementalContent;
      if (ec !== undefined && ec !== null && ec !== '') {
        if (typeof ec === 'string') {
          const parsed = parseNumberFromText(ec);
          ec = isNaN(parsed) || !isFinite(parsed) ? undefined : parsed;
        } else if (typeof ec !== 'number' || isNaN(ec) || !isFinite(ec)) {
          ec = undefined;
        }
      } else {
        ec = undefined;
      }

      if (ec !== undefined) {
        newItem.elementalContent = ec;
      } else {
        delete newItem.elementalContent;
      }

      return newItem;
    };

    if (processed.ingredients && Array.isArray(processed.ingredients)) {
      processed.ingredients = processed.ingredients.map(sanitizeItem);
    }
    if (processed.excipients && Array.isArray(processed.excipients)) {
      processed.excipients = processed.excipients.map(sanitizeItem);
    }

    return processed;
  }
}
