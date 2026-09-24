/**
 * LaboratoryAppService.ts
 * =======================
 * Canonical Application Service quản lý Master Data Đơn vị Kiểm nghiệm (Testing Laboratory).
 *
 * Tuân thủ Workflow Pipeline:
 * UI -> Canonical Action -> LaboratoryAppService -> Auth & Validation -> Repository -> Audit
 */

import { TestingLaboratory } from '../../types/laboratory';
import { ILaboratoryRepository } from '../../repositories/ILaboratoryRepository';
import { firebaseLaboratoryRepository } from '../../repositories/firebase/FirebaseLaboratoryRepository';
import { logAuditAction } from '../auditService';

export interface LabActionContext {
  actorId: string;
  actorRole: string;
  actorEmail?: string;
  reason?: string;
}

export class LaboratoryAppService {
  constructor(private readonly repo: ILaboratoryRepository = firebaseLaboratoryRepository) {}

  private validatePermission(
    context: LabActionContext,
    action: 'CREATE' | 'UPDATE' | 'DELETE'
  ): void {
    const role = (context.actorRole || '').toUpperCase();
    if (action === 'DELETE') {
      if (role !== 'ADMIN') {
        throw new Error(
          'Thẩm quyền bị từ chối: Chỉ Quản trị viên (ADMIN) mới có quyền xóa đơn vị kiểm nghiệm.'
        );
      }
    } else {
      if (!['ADMIN', 'QA', 'QA_MANAGER'].includes(role)) {
        throw new Error(
          `Thẩm quyền bị từ chối: Vai trò ${context.actorRole} không có quyền thực hiện ${action} đơn vị kiểm nghiệm.`
        );
      }
    }
  }

  async createLaboratory(
    lab: TestingLaboratory,
    context: LabActionContext
  ): Promise<TestingLaboratory> {
    this.validatePermission(context, 'CREATE');

    if (!lab.id || !lab.code || !lab.canonicalName) {
      throw new Error(
        'Dữ liệu không hợp lệ: Yêu cầu đầy đủ ID, mã Code và Tên chuẩn hóa của phòng kiểm nghiệm.'
      );
    }

    const existing = await this.repo.findById(lab.id);
    if (existing) {
      throw new Error(`Đơn vị kiểm nghiệm với mã ${lab.id} đã tồn tại trong hệ thống.`);
    }

    const newLab: TestingLaboratory = {
      ...lab,
      createdAt: lab.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.repo.save(newLab);

    await logAuditAction({
      action: 'CREATE',
      collection: 'SYSTEM',
      documentId: newLab.id,
      details: `Tạo mới đơn vị kiểm nghiệm: ${newLab.canonicalName} (${newLab.code})`,
      performedBy: context.actorEmail || context.actorId,
    });

    return newLab;
  }

  async updateLaboratory(lab: TestingLaboratory, context: LabActionContext): Promise<void> {
    this.validatePermission(context, 'UPDATE');

    if (!lab.id || !lab.canonicalName) {
      throw new Error('Dữ liệu không hợp lệ: Yêu cầu ID và Tên chuẩn hóa của phòng kiểm nghiệm.');
    }

    const updatedLab: TestingLaboratory = {
      ...lab,
      updatedAt: new Date().toISOString(),
    };

    await this.repo.update(updatedLab);

    await logAuditAction({
      action: 'UPDATE',
      collection: 'SYSTEM',
      documentId: lab.id,
      details: `Cập nhật đơn vị kiểm nghiệm: ${lab.canonicalName} (${lab.code})`,
      performedBy: context.actorEmail || context.actorId,
    });
  }

  async deleteLaboratory(id: string, context: LabActionContext): Promise<void> {
    this.validatePermission(context, 'DELETE');

    if (!context.reason || context.reason.trim().length === 0) {
      throw new Error('Xóa đơn vị kiểm nghiệm bắt buộc phải có lý do giải trình.');
    }

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Không tìm thấy đơn vị kiểm nghiệm với ID: ${id}`);
    }

    await this.repo.delete(id);

    await logAuditAction({
      action: 'DELETE',
      collection: 'SYSTEM',
      documentId: id,
      details: `Xóa đơn vị kiểm nghiệm: ${existing.canonicalName} (${existing.code}). Lý do: ${context.reason}`,
      performedBy: context.actorEmail || context.actorId,
    });
  }

  async getAllLaboratories(): Promise<TestingLaboratory[]> {
    return this.repo.findAll();
  }
}

export const laboratoryAppService = new LaboratoryAppService();
