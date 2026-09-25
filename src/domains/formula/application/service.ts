/**
 * FORMULA DOMAIN: APPLICATION SERVICE
 *
 * Điều phối các nghiệp vụ Công thức sản phẩm qua WorkflowFacade:
 * Sanitization, Ràng buộc thành phần định lượng, RBAC và ALCOA+ Audit Logging
 */

import { ProductFormula, IFormulaRepository } from '../domain/types';
import { FormulaRules } from '../domain/rules';
import { defaultFormulaRepo } from '../infrastructure/repository';
import { can } from '../../../services/permissionService';
import { WorkflowFacade } from '../../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../../workflow/contracts/actions';

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
    return FormulaRules.sanitize(formula);
  }

  async createFormula(formula: ProductFormula, currentUser: any): Promise<void> {
    if (!can(currentUser, 'formula:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền tạo Công thức sản phẩm.');
    }

    const validation = FormulaRules.validate(formula);
    if (!validation.valid) {
      throw new Error(validation.error || 'Dữ liệu công thức không hợp lệ.');
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

    const validation = FormulaRules.validate(formula);
    if (!validation.valid) {
      throw new Error(validation.error || 'Dữ liệu công thức không hợp lệ.');
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
