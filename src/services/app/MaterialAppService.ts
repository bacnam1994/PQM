/**
 * PQM 3.0 - Raw Material Application Service
 * Điều phối các nghiệp vụ quản lý nguyên liệu qua WorkflowFacade:
 * RBAC Authorization, Validation, Ràng buộc Công thức và ALCOA+ Audit Logging
 */

import { RawMaterial, ProductFormula } from '../../types';
import { IMaterialRepository } from '../../repositories/MaterialRepository';
import { materialRepository as defaultMaterialRepo } from '../../repositories/firebase/FirebaseMaterialRepository';
import { can } from '../permissionService';
import { WorkflowFacade } from '../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../workflow/contracts/actions';

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

    if (!material.name?.trim()) {
      throw new Error('Tên nguyên liệu không được để trống.');
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

    if (!material.name?.trim()) {
      throw new Error('Tên nguyên liệu không được để trống.');
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
    const isUsedInFormula = productFormulas.some(
      (f) =>
        (f.ingredients || []).some((ing) => ing.materialId === id) ||
        (f.excipients || []).some((exc) => exc.materialId === id)
    );

    if (isUsedInFormula) {
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
