/**
 * PRODUCT DOMAIN: RULES
 *
 * Các quy tắc nghiệp vụ thuần túy (Pure Business Rules) của Product Domain:
 * - Tên sản phẩm không được rỗng
 * - Mã sản phẩm không được rỗng
 */

import { Product } from './types';

export class ProductRules {
  public static validate(product: Partial<Product>): { valid: boolean; error?: string } {
    if (!product.name || !product.name.trim()) {
      return { valid: false, error: 'Tên sản phẩm không được để trống.' };
    }
    if (!product.code || !product.code.trim()) {
      return { valid: false, error: 'Mã sản phẩm không được để trống.' };
    }
    return { valid: true };
  }
}
