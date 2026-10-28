/**
 * MASTER DATA DOMAIN: LABORATORY APPLICATION SERVICE
 * Canonical Application Service quản lý Master Data Đơn vị Kiểm nghiệm (Testing Laboratory).
 */

import { TestingLaboratory, LabActionContext } from '../domain/types';
import { LaboratoryRules } from '../domain/rules';
import { ILaboratoryRepository, firebaseLaboratoryRepository } from '../infrastructure/repository';
import { logAuditAction } from '../../../services/auditService';

export class LaboratoryAppService {
  constructor(private readonly repo: ILaboratoryRepository = firebaseLaboratoryRepository) {}

  async createLaboratory(
    lab: TestingLaboratory,
    context: LabActionContext
  ): Promise<TestingLaboratory> {
    LaboratoryRules.validatePermission(context, 'CREATE');
    LaboratoryRules.validate(lab);

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
    LaboratoryRules.validatePermission(context, 'UPDATE');

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
    LaboratoryRules.validatePermission(context, 'DELETE');
    LaboratoryRules.validateDeletionReason(context.reason);

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
