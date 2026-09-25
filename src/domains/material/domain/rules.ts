/**
 * MATERIAL DOMAIN: RULES
 *
 * Các quy tắc nghiệp vụ thuần túy (Pure Business Rules) của Material Domain:
 * - Tên nguyên liệu không được để trống
 * - Ràng buộc toàn vẹn công thức: không thể xóa nguyên liệu đang dùng trong bất kỳ công thức sản phẩm nào
 */

import { RawMaterial, ProductFormula } from './types';

export class MaterialRules {
  public static validate(material: Partial<RawMaterial>): { valid: boolean; error?: string } {
    if (!material.name || !material.name.trim()) {
      return { valid: false, error: 'Tên nguyên liệu không được để trống.' };
    }
    return { valid: true };
  }

  public static isUsedInFormulas(materialId: string, formulas: ProductFormula[] = []): boolean {
    return formulas.some(
      (f) =>
        (f.ingredients || []).some((ing) => ing.materialId === materialId) ||
        (f.excipients || []).some((exc) => exc.materialId === materialId)
    );
  }
}
