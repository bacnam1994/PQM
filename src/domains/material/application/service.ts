/**
 * MATERIAL DOMAIN: APPLICATION SERVICE
 *
 * Điều phối các nghiệp vụ quản lý nguyên liệu qua WorkflowFacade:
 * RBAC Authorization, Validation, Ràng buộc Công thức và ALCOA+ Audit Logging
 */

import { RawMaterial, ProductFormula, IMaterialRepository } from '../domain/types';
import { MaterialRules } from '../domain/rules';
import { defaultMaterialRepo } from '../infrastructure/repository';
import { can } from '../../../services/permissionService';
import { WorkflowFacade } from '../../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../../workflow/contracts/actions';

export class MaterialAppService {
  constructor(private repo: IMaterialRepository = defaultMaterialRepo) {}

  private toActor(currentUser: any): WorkflowActor {
    const rawRole = (currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'USER')).toUpperCase();
    return {
      id: currentUser?.id || currentUser?.uid || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || 'Unknown User',
      role: rawRole,
      email: currentUser?.email,
    };
  }

  async createMaterial(material: RawMaterial, currentUser: any): Promise<void> {
    if (!can(currentUser, 'material:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền thêm mới nguyên liệu.');
    }

    const validation = MaterialRules.validate(material);
    if (!validation.valid) {
      throw new Error(validation.error || 'Dữ liệu nguyên liệu không hợp lệ.');
    }

    const execution = await WorkflowFacade.dispatch<RawMaterial>(
      {
        actionId: 'MATERIAL_CREATE',
        entityType: 'MATERIAL',
        entityId: material.id,
        actor: this.toActor(currentUser),
        payload: material,
      },
      async () => {
        await this.repo.save(material);
        return material;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi thêm mới nguyên liệu qua Workflow.');
    }
  }

  async updateMaterial(material: RawMaterial, currentUser: any, reason?: string): Promise<void> {
    if (!can(currentUser, 'material:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật nguyên liệu.');
    }

    const validation = MaterialRules.validate(material);
    if (!validation.valid) {
      throw new Error(validation.error || 'Dữ liệu nguyên liệu không hợp lệ.');
    }

    const execution = await WorkflowFacade.dispatch<RawMaterial>(
      {
        actionId: 'MATERIAL_UPDATE',
        entityType: 'MATERIAL',
        entityId: material.id,
        actor: this.toActor(currentUser),
        payload: material,
        reason:
          reason ||
          `Cập nhật nguyên liệu: ${material.name}${material.code ? ` (${material.code})` : ''}`,
      },
      async () => {
        await this.repo.update(material);
        return material;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi cập nhật nguyên liệu qua Workflow.');
    }
  }

  async deleteMaterial(
    id: string,
    productFormulas: ProductFormula[] = [],
    currentUser: any,
    materialName?: string,
    reason?: string
  ): Promise<void> {
    if (!can(currentUser, 'material:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa nguyên liệu này.');
    }

    // Kiểm tra ràng buộc toàn vẹn: Nguyên liệu có đang được dùng trong công thức nào không?
    if (MaterialRules.isUsedInFormulas(id, productFormulas)) {
      throw new Error(
        'Nguyên liệu này đang được sử dụng trong Công thức sản phẩm. Vui lòng cập nhật công thức trước khi xóa.'
      );
    }

    const execution = await WorkflowFacade.dispatch<string>(
      {
        actionId: 'MATERIAL_DELETE',
        entityType: 'MATERIAL',
        entityId: id,
        actor: this.toActor(currentUser),
        reason: reason || `Xóa nguyên liệu: ${materialName || id}`,
      },
      async () => {
        await this.repo.delete(id);
        return id;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi xóa nguyên liệu qua Workflow.');
    }
  }
}

export const materialAppService = new MaterialAppService();
