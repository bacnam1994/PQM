/**
 * PharmacopoeiaAppService.ts
 * ==========================
 * Canonical Application Service quản lý Master Data Dược điển (Pharmacopoeia Standards).
 *
 * Tuân thủ Workflow Pipeline:
 * UI -> Canonical Action -> PharmacopoeiaAppService -> Auth & Validation -> Repository -> Audit
 */

import { PharmacopoeiaStandard } from '../pharmacopoeiaService';
import { IPharmacopoeiaRepository } from '../../repositories/IPharmacopoeiaRepository';
import { firebasePharmacopoeiaRepository } from '../../repositories/firebase/FirebasePharmacopoeiaRepository';
import { logAuditAction } from '../auditService';

export interface PharmacopoeiaActionContext {
  actorId: string;
  actorRole: string;
  actorEmail?: string;
  reason?: string;
}

export class PharmacopoeiaAppService {
  constructor(private readonly repo: IPharmacopoeiaRepository = firebasePharmacopoeiaRepository) {}

  private validatePermission(
    context: PharmacopoeiaActionContext,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SEED'
  ): void {
    const role = (context.actorRole || '').toUpperCase();
    if (action === 'DELETE' || action === 'SEED') {
      if (role !== 'ADMIN') {
        throw new Error(
          `Thẩm quyền bị từ chối: Chỉ Quản trị viên (ADMIN) mới có quyền thực hiện ${action} tiêu chuẩn dược điển.`
        );
      }
    } else {
      if (!['ADMIN', 'QA', 'QA_MANAGER'].includes(role)) {
        throw new Error(
          `Thẩm quyền bị từ chối: Vai trò ${context.actorRole} không có quyền thực hiện ${action} tiêu chuẩn dược điển.`
        );
      }
    }
  }

  async createStandard(
    standard: PharmacopoeiaStandard,
    context: PharmacopoeiaActionContext
  ): Promise<PharmacopoeiaStandard> {
    this.validatePermission(context, 'CREATE');

    if (!standard.id || !standard.title || !standard.standard) {
      throw new Error('Dữ liệu không hợp lệ: Yêu cầu đầy đủ ID, tiêu đề và nội dung quy chuẩn.');
    }

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
    this.validatePermission(context, 'UPDATE');

    if (!standard.id || !standard.title || !standard.standard) {
      throw new Error('Dữ liệu không hợp lệ: Yêu cầu đầy đủ ID, tiêu đề và nội dung quy chuẩn.');
    }

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
    this.validatePermission(context, 'DELETE');

    if (!context.reason || context.reason.trim().length === 0) {
      throw new Error('Xóa tiêu chuẩn dược điển bắt buộc phải có lý do giải trình.');
    }

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
    this.validatePermission(context, 'SEED');

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
