/**
 * PQM 3.0 - Raw Material Application Service
 * Điều phối các nghiệp vụ quản lý nguyên liệu: RBAC Authorization, Validation, Ràng buộc Công thức và Audit Logging
 */

import { RawMaterial, ProductFormula } from '../../types';
import { IMaterialRepository } from '../../repositories/MaterialRepository';
import { materialRepository as defaultMaterialRepo } from '../../repositories/firebase/FirebaseMaterialRepository';
import { can } from '../permissionService';
import { logAuditAction } from '../auditService';

export class MaterialAppService {
  constructor(private repo: IMaterialRepository = defaultMaterialRepo) {}

  async createMaterial(material: RawMaterial, currentUser: any): Promise<void> {
    if (!can(currentUser, 'material:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền thêm mới nguyên liệu.');
    }

    if (!material.name?.trim()) {
      throw new Error('Tên nguyên liệu không được để trống.');
    }

    await this.repo.save(material);

    logAuditAction({
      action: 'CREATE',
      collection: 'SYSTEM',
      documentId: material.id,
      details: `Thêm mới nguyên liệu: ${material.name}${material.code ? ` (${material.code})` : ''}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async updateMaterial(material: RawMaterial, currentUser: any): Promise<void> {
    if (!can(currentUser, 'material:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật nguyên liệu.');
    }

    if (!material.name?.trim()) {
      throw new Error('Tên nguyên liệu không được để trống.');
    }

    await this.repo.update(material);

    logAuditAction({
      action: 'UPDATE',
      collection: 'SYSTEM',
      documentId: material.id,
      details: `Cập nhật nguyên liệu: ${material.name}${material.code ? ` (${material.code})` : ''}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async deleteMaterial(
    id: string, 
    productFormulas: ProductFormula[] = [], 
    currentUser: any,
    materialName?: string
  ): Promise<void> {
    if (!can(currentUser, 'material:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa nguyên liệu này.');
    }

    // Kiểm tra ràng buộc toàn vẹn: Nguyên liệu có đang được dùng trong công thức nào không?
    const isUsedInFormula = productFormulas.some(f => 
      (f.ingredients || []).some(ing => ing.materialId === id) ||
      (f.excipients || []).some(exc => exc.materialId === id)
    );

    if (isUsedInFormula) {
      throw new Error('Nguyên liệu này đang được sử dụng trong Công thức sản phẩm. Vui lòng cập nhật công thức trước khi xóa.');
    }

    await this.repo.delete(id);

    logAuditAction({
      action: 'DELETE',
      collection: 'SYSTEM',
      documentId: id,
      details: `Xóa nguyên liệu: ${materialName || id}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }
}

export const materialAppService = new MaterialAppService();
