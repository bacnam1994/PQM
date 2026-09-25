/**
 * PQM 3.0 - Product Formula Application Service
 * Điều phối các nghiệp vụ Công thức sản phẩm qua WorkflowFacade:
 * Sanitization, Ràng buộc thành phần định lượng, RBAC và ALCOA+ Audit Logging
 */

import { ProductFormula } from '../../types';
import { IFormulaRepository } from '../../repositories/FormulaRepository';
import { formulaRepository as defaultFormulaRepo } from '../../repositories/firebase/FirebaseFormulaRepository';
import { can } from '../permissionService';
import { parseNumberFromText } from '../../utils';
import { WorkflowFacade } from '../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../workflow/contracts/actions';

export class FormulaAppService {
  constructor(private repo: IFormulaRepository = defaultFormulaRepo) {}

  private toActor(currentUser: any): WorkflowActor {
    const rawRole = (currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'USER')).toUpperCase();
    return {
      id: currentUser?.id || currentUser?.uid || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || 'Unknown User',
      role: rawRole,
      email: currentUser?.email,
    };
  }

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

    const execution = await WorkflowFacade.dispatch<ProductFormula>(
      {
        actionId: 'FORMULA_CREATE',
        entityType: 'FORMULA',
        entityId: formula.id,
        actor: this.toActor(currentUser),
        payload: cleanFormula,
      },
      async () => {
        await this.repo.save(cleanFormula);
        return cleanFormula;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi tạo Công thức sản phẩm qua Workflow.');
    }
  }

  async updateFormula(formula: ProductFormula, currentUser: any, reason?: string): Promise<void> {
    if (!can(currentUser, 'formula:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật Công thức sản phẩm.');
    }

    const cleanFormula = this.sanitizeFormula(formula);

    const execution = await WorkflowFacade.dispatch<ProductFormula>(
      {
        actionId: 'FORMULA_UPDATE',
        entityType: 'FORMULA',
        entityId: formula.id,
        actor: this.toActor(currentUser),
        payload: cleanFormula,
        reason: reason || `Cập nhật công thức cho sản phẩm: ${formula.productId}`,
      },
      async () => {
        await this.repo.update(cleanFormula);
        return cleanFormula;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi cập nhật Công thức sản phẩm qua Workflow.');
    }
  }

  async deleteFormula(id: string, currentUser: any, reason?: string): Promise<void> {
    if (!can(currentUser, 'formula:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa Công thức sản phẩm.');
    }

    const execution = await WorkflowFacade.dispatch<string>(
      {
        actionId: 'FORMULA_ARCHIVE',
        entityType: 'FORMULA',
        entityId: id,
        actor: this.toActor(currentUser),
        reason: reason || `Lưu trữ/Xóa công thức sản phẩm: ${id}`,
      },
      async () => {
        await this.repo.delete(id);
        return id;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi xóa Công thức sản phẩm qua Workflow.');
    }
  }
}

export const formulaAppService = new FormulaAppService();
