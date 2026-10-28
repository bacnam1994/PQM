/**
 * MASTER DATA DOMAIN: PHARMACOPOEIA APPLICATION SERVICE
 * Canonical Application Service quản lý Master Data Dược điển (Pharmacopoeia Standards).
 */

import { PharmacopoeiaStandard, PharmacopoeiaActionContext } from '../domain/types';
import { PharmacopoeiaRules } from '../domain/rules';
import {
  IPharmacopoeiaRepository,
  firebasePharmacopoeiaRepository,
} from '../infrastructure/repository';
import { logAuditAction } from '../../../services/auditService';

export class PharmacopoeiaAppService {
  constructor(private readonly repo: IPharmacopoeiaRepository = firebasePharmacopoeiaRepository) {}

  async createStandard(
    standard: PharmacopoeiaStandard,
    context: PharmacopoeiaActionContext
  ): Promise<PharmacopoeiaStandard> {
    PharmacopoeiaRules.validatePermission(context, 'CREATE');
    PharmacopoeiaRules.validate(standard);

    const payload: PharmacopoeiaStandard = {
      ...standard,
      updatedAt: new Date().toISOString(),
      updatedBy: context.actorEmail || context.actorId || 'QA_ADMIN',
    };

    await this.repo.save(payload);

    await logAuditAction({
      action: 'CREATE',
      collection: 'SYSTEM',
      documentId: payload.id,
      details: `Tạo mới chuyên luận dược điển: ${payload.title} (${payload.source})`,
      performedBy: context.actorEmail || context.actorId,
    });

    return payload;
  }

  async updateStandard(
    standard: PharmacopoeiaStandard,
    context: PharmacopoeiaActionContext
  ): Promise<void> {
    PharmacopoeiaRules.validatePermission(context, 'UPDATE');
    PharmacopoeiaRules.validate(standard);

    const payload: PharmacopoeiaStandard = {
      ...standard,
      updatedAt: new Date().toISOString(),
      updatedBy: context.actorEmail || context.actorId || 'QA_ADMIN',
    };

    await this.repo.update(payload);

    await logAuditAction({
      action: 'UPDATE',
      collection: 'SYSTEM',
      documentId: payload.id,
      details: `Cập nhật chuyên luận dược điển: ${payload.title} (${payload.source})`,
      performedBy: context.actorEmail || context.actorId,
    });
  }

  async deleteStandard(id: string, context: PharmacopoeiaActionContext): Promise<void> {
    PharmacopoeiaRules.validatePermission(context, 'DELETE');
    PharmacopoeiaRules.validateDeletionReason(context.reason);

    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Không tìm thấy tiêu chuẩn dược điển với ID: ${id}`);
    }

    await this.repo.delete(id);

    await logAuditAction({
      action: 'DELETE',
      collection: 'SYSTEM',
      documentId: id,
      details: `Xóa chuyên luận dược điển: ${existing.title}. Lý do: ${context.reason}`,
      performedBy: context.actorEmail || context.actorId,
    });
  }

  async seedDefaultStandards(
    defaults: PharmacopoeiaStandard[],
    context: PharmacopoeiaActionContext
  ): Promise<void> {
    PharmacopoeiaRules.validatePermission(context, 'SEED');

    await this.repo.seedDefaults(defaults);

    await logAuditAction({
      action: 'IMPORT',
      collection: 'SYSTEM',
      documentId: 'seed-defaults',
      details: `Khởi tạo lại danh mục tiêu chuẩn dược điển mặc định (${defaults.length} tiêu chuẩn). Lý do: ${context.reason || 'Khởi tạo hệ thống'}`,
      performedBy: context.actorEmail || context.actorId,
    });
  }

  async getAllStandards(): Promise<PharmacopoeiaStandard[]> {
    return this.repo.findAll();
  }
}

export const pharmacopoeiaAppService = new PharmacopoeiaAppService();
