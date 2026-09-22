/**
 * CAPAService.ts
 * PQM Application Service - Điều phối quy trình Hành Động Khắc Phục và Phòng Ngừa (CAPA Closed-Loop)
 * Tuân thủ 100% tài liệu:
 * - docs/business-rules/BR_10_CAPA_RULES.md (BR-CAP-001 -> BR-CAP-004)
 * - docs/specs/FRS_13_CAPA_MANAGEMENT.md
 * - ICH Q10 Pharmaceutical Quality System & Closed-Loop CAPA
 */

import { QualityDeviation, CAPAActionItem } from '../../types';
import { deviationAppService } from './DeviationAppService';
import { logAuditAction } from '../auditService';

export interface CreateCapaPlanDto {
  deviationId: string;
  actionType: 'CORRECTIVE' | 'PREVENTIVE';
  description: string;
  assignedTo: string;
  dueDate: string;
}

export class CAPAService {
  /**
   * Tạo kế hoạch hành động CAPA mới gắn với hồ sơ sai lệch (BR-CAP-001)
   */
  public async addCapaAction(dto: CreateCapaPlanDto, currentUser: any): Promise<QualityDeviation> {
    const isAuthorized =
      currentUser?.isAdmin || currentUser?.role === 'ADMIN' || currentUser?.role === 'QA';

    if (!isAuthorized) {
      throw new Error('Từ chối quyền: Bạn không có quyền khởi tạo hành động CAPA.');
    }

    if (!dto.description?.trim()) {
      throw new Error('Nội dung hành động CAPA không được để trống.');
    }
    if (!dto.assignedTo?.trim()) {
      throw new Error('Người chịu trách nhiệm thực hiện CAPA không được để trống.');
    }
    if (!dto.dueDate?.trim()) {
      throw new Error('Hạn chót hoàn thành (Due Date) của CAPA bắt buộc phải có.');
    }

    const updatedDeviation = await deviationAppService.addCAPAItem(
      dto.deviationId,
      {
        type: dto.actionType,
        action: dto.description.trim(),
        responsible: dto.assignedTo.trim(),
        deadline: dto.dueDate,
        status: 'PENDING',
      },
      currentUser
    );

    logAuditAction({
      action: 'UPDATE',
      collection: 'DEVIATIONS',
      documentId: dto.deviationId,
      details: `Bổ sung hành động CAPA (${dto.actionType}): "${dto.description}" [Giao cho: ${dto.assignedTo}, Hạn: ${dto.dueDate}]`,
      performedBy: currentUser?.email || 'unknown',
    });

    return updatedDeviation;
  }

  /**
   * Hoàn thành hành động CAPA kèm bằng chứng thực thi (BR-CAP-002)
   */
  public async completeCapaAction(
    deviationId: string,
    capaId: string,
    currentUser: any,
    completionEvidence?: string
  ): Promise<QualityDeviation> {
    const updated = await deviationAppService.completeCAPAItem(deviationId, capaId, currentUser);

    logAuditAction({
      action: 'UPDATE',
      collection: 'DEVIATIONS',
      documentId: deviationId,
      details: `Xác nhận hoàn thành hành động CAPA ${capaId}${
        completionEvidence ? ` [Bằng chứng: ${completionEvidence}]` : ''
      }`,
      performedBy: currentUser?.email || 'unknown',
    });

    return updated;
  }
}

export const capaService = new CAPAService();
