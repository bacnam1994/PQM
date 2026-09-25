/**
 * OOS DOMAIN: APPLICATION SERVICE
 *
 * Điều phối quy trình điều tra Kết quả Ngoài Tiêu Chuẩn (Out of Specification - OOS)
 * Tuân thủ 100% tài liệu:
 * - docs/business-rules/BR_08_OOS_RULES.md (BR-OOS-001 -> BR-OOS-004)
 * - docs/specs/FRS_11_OOS_INVESTIGATION.md
 * - FDA Guidance for Industry: Investigating Out-of-Specification (OOS) Test Results
 */

import {
  TestResult,
  Batch,
  QualityDeviation,
  OOSInvestigationPhase1,
  OOSInvestigationPhase2,
} from '../domain/types';
import { OOSRules } from '../domain/rules';
import { deviationAppService } from '../../deviation/application/service';
import { logAuditAction } from '../../../services/auditService';

export class OOSService {
  /**
   * Kích hoạt hồ sơ điều tra OOS tự động khi có kết quả kiểm nghiệm rớt (BR-OOS-001)
   */
  public async triggerOOSInvestigation(options: {
    testResult: TestResult;
    batch?: Batch;
    failedCriteriaNames: string[];
    currentUser: any;
  }): Promise<QualityDeviation> {
    const { testResult, batch, failedCriteriaNames, currentUser } = options;

    const deviation = await deviationAppService.autoLogFromOOS(testResult, batch, currentUser);

    if (!deviation) {
      throw new Error('Không thể tự động khởi tạo hồ sơ sai lệch từ kết quả kiểm nghiệm OOS.');
    }

    await logAuditAction({
      action: 'CREATE',
      collection: 'OOS_INVESTIGATIONS' as any,
      documentId: deviation.id,
      details: `Kích hoạt quy trình điều tra OOS: ${deviation.deviationNo} cho Lô: ${batch?.batchNo || testResult.batchId}`,
      performedBy: currentUser?.email || 'system',
    });

    return deviation;
  }

  /**
   * Hoàn tất Điều tra Giai đoạn 1 (Lab Investigation) theo chuẩn FDA (BR-OOS-002)
   */
  public async submitPhase1Investigation(options: {
    deviationId: string;
    phase1Data: OOSInvestigationPhase1;
    currentUser: any;
  }): Promise<void> {
    const { deviationId, phase1Data, currentUser } = options;

    const isAuthorized =
      currentUser?.isAdmin ||
      currentUser?.role === 'ADMIN' ||
      currentUser?.role === 'QA' ||
      currentUser?.role === 'QC';

    if (!isAuthorized) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật hồ sơ điều tra OOS.');
    }

    const validation = OOSRules.validatePhase1(phase1Data);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const note = `[OOS Phase 1 Lab Investigation] Lỗi phòng thí nghiệm: ${
      phase1Data.labErrorFound ? 'CÓ (' + phase1Data.labErrorDetails + ')' : 'KHÔNG'
    }. Người thực hiện: ${phase1Data.assignedAnalyst}`;

    await deviationAppService.updateStatus(deviationId, 'UNDER_INVESTIGATION', currentUser, {
      notes: note,
    });

    await logAuditAction({
      action: 'UPDATE',
      collection: 'OOS_INVESTIGATIONS' as any,
      documentId: deviationId,
      details: `Hoàn tất điều tra OOS Phase 1 (Lab Investigation): ${note}`,
      performedBy: currentUser?.email || 'unknown',
    });
  }

  /**
   * Hoàn tất Điều tra Giai đoạn 2 (Manufacturing Investigation) & Kết luận QA (BR-OOS-003)
   */
  public async concludeOOSInvestigation(options: {
    deviationId: string;
    phase2Data: OOSInvestigationPhase2;
    qaDecision: 'BATCH_REJECTED' | 'BATCH_RELEASED_WITH_EXCEPTION';
    currentUser: any;
    closureReason: string;
  }): Promise<void> {
    const { deviationId, phase2Data, qaDecision, currentUser, closureReason } = options;

    const concludeCheck = OOSRules.canConclude(currentUser);
    if (!concludeCheck.allowed) {
      throw new Error(concludeCheck.reason);
    }

    const validation = OOSRules.validatePhase2(phase2Data);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const finalNotes = `[OOS Concluded - ${qaDecision}] Nguyên nhân gốc rễ: ${phase2Data.rootCauseIdentified}. Yêu cầu CAPA: ${
      phase2Data.capaPlanRequired ? 'CÓ' : 'KHÔNG'
    }. Lý do đóng: ${closureReason}`;

    await deviationAppService.updateStatus(deviationId, 'CLOSED', currentUser, {
      notes: finalNotes,
    });

    await logAuditAction({
      action: 'UPDATE',
      collection: 'OOS_INVESTIGATIONS' as any,
      documentId: deviationId,
      details: `Đóng hồ sơ điều tra OOS: ${deviationId} [Quyết định QA: ${qaDecision}]`,
      performedBy: currentUser?.email || 'unknown',
    });
  }
}

export const oosService = new OOSService();
