/**
 * PQM 3.0 - Product Formula Application Service
 * Điều phối các nghiệp vụ Công thức sản phẩm: Sanitization, Ràng buộc thành phần định lượng, RBAC và Audit Logging
 */

import { ProductFormula } from '../../types';
import { IFormulaRepository } from '../../repositories/FormulaRepository';
import { formulaRepository as defaultFormulaRepo } from '../../repositories/firebase/FirebaseFormulaRepository';
import { can } from '../permissionService';
import { logAuditAction } from '../auditService';
import { parseNumberFromText } from '../../utils';

export class FormulaAppService {
  constructor(private repo: IFormulaRepository = defaultFormulaRepo) {}

  /**
   * Chuẩn hóa làm sạch số liệu công thức trước khi lưu (Sanitization)
   */
  sanitizeFormula(formula: ProductFormula): ProductFormula {
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

  async createFormula(formula: ProductFormula, currentUser: any): Promise<void> {
    if (!can(currentUser, 'formula:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền tạo Công thức sản phẩm.');
    }

    if (!formula.productId) {
      throw new Error('Công thức phải liên kết với một sản phẩm cụ thể.');
    }

    const cleanFormula = this.sanitizeFormula(formula);
    await this.repo.save(cleanFormula);

    logAuditAction({
      action: 'CREATE',
      collection: 'FORMULAS',
      documentId: formula.id,
      details: `Tạo công thức cho sản phẩm: ${formula.productId}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async updateFormula(formula: ProductFormula, currentUser: any): Promise<void> {
    if (!can(currentUser, 'formula:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật Công thức sản phẩm.');
    }

    const cleanFormula = this.sanitizeFormula(formula);
    await this.repo.update(cleanFormula);

    logAuditAction({
      action: 'UPDATE',
      collection: 'FORMULAS',
      documentId: formula.id,
      details: `Cập nhật công thức cho sản phẩm: ${formula.productId}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async deleteFormula(id: string, currentUser: any): Promise<void> {
    if (!can(currentUser, 'formula:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa Công thức sản phẩm.');
    }

    await this.repo.delete(id);

    logAuditAction({
      action: 'DELETE',
      collection: 'FORMULAS',
      documentId: id,
      details: `Xóa công thức ID: ${id}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }
}

export const formulaAppService = new FormulaAppService();
