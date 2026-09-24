/**
 * ReleaseService.ts
 * PQM Application Service - Điều phối quy trình xuất xưởng Lô sản xuất (Batch Release)
 * Tuân thủ 100% tài liệu:
 * - docs/business-rules/BR_05_RELEASE_RULES.md (BR-REL-001)
 * - docs/specs/FRS_09_BATCH_RELEASE.md
 * - 21 CFR Part 11 Electronic Signatures & 7 Release Gates
 */

import { Batch, TestResult, TCCS, QualityDeviation, ElectronicSignature } from '../../types';
import { ReleaseRules } from '../../domain/rules/ReleaseRules';
import { BatchRules } from '../../domain/rules/BatchRules';
import { BatchStateMachine } from '../../domain/workflow/stateMachine';
import { batchAppService } from './BatchAppService';
import { signatureService } from '../signatureService';
import { logAuditAction } from '../auditService';
import { can } from '../permissionService';

export interface ReleaseEvaluationResponse {
  isEligible: boolean;
  score: number;
  allGatesPassed: boolean;
  gates: Array<{
    gateIndex: number;
    gateName: string;
    passed: boolean;
    details?: string;
  }>;
  blockers: string[];
  recommendation: string;
}

export class ReleaseService {
  /**
   * Thẩm định toàn diện mức độ sẵn sàng xuất xưởng qua 7 Cổng Kiểm Soát (7 Release Gates)
   */
  public evaluateReleaseReadiness(options: {
    batch: Batch;
    testResults: TestResult[];
    boundTccs?: TCCS | null;
    deviations?: QualityDeviation[];
    userRole?: string;
    asOfDate?: string | Date;
  }): ReleaseEvaluationResponse {
    const prereq = ReleaseRules.evaluateReleasePrerequisites({
      batch: options.batch,
      testResults: options.testResults,
      userRole: options.userRole,
      boundTccs: options.boundTccs,
      deviations: options.deviations as any,
      asOfDate: options.asOfDate,
    });

    const gatesResult = ReleaseRules.evaluate7ReleaseGates({
      batch: options.batch,
      testResults: options.testResults,
      userRole: options.userRole,
      boundTccs: options.boundTccs,
      deviations: options.deviations as any,
      asOfDate: options.asOfDate,
    });

    return {
      isEligible: prereq.isEligibleForRelease && gatesResult.allGatesPassed,
      score: prereq.score,
      allGatesPassed: gatesResult.allGatesPassed,
      gates: gatesResult.gates,
      blockers: prereq.blockers,
      recommendation: prereq.recommendation,
    };
  }

  /**
   * Thực thi quyết định xuất xưởng Lô sản xuất (Release Batch)
   */
  public async releaseBatch(options: {
    batchId: string;
    currentBatch: Batch;
    testResults: TestResult[];
    currentUser: any;
    boundTccs?: TCCS | null;
    deviations?: QualityDeviation[];
    signature?: ElectronicSignature;
    reason?: string;
  }): Promise<{ success: boolean; message: string }> {
    const {
      batchId,
      currentBatch,
      testResults,
      currentUser,
      boundTccs,
      deviations,
      signature,
      reason,
    } = options;

    // 1. Kiểm tra quyền hạn (QA hoặc ADMIN)
    if (!can(currentUser, 'batch:release', currentBatch)) {
      throw new Error(
        'Từ chối quyền: Chỉ QA hoặc Quản trị viên (ADMIN) mới có thẩm quyền xuất xưởng Lô.'
      );
    }

    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.isAdmin === true;

    // 2. Thẩm tra 7 Release Gates (Bắt buộc 100% người dùng bao gồm Admin, không có ngoại lệ)
    const evaluation = this.evaluateReleaseReadiness({
      batch: currentBatch,
      testResults,
      boundTccs,
      deviations,
      userRole: currentUser?.role,
    });

    if (!evaluation.isEligible || !evaluation.allGatesPassed) {
      throw new Error(
        `Từ chối xuất xưởng: Còn rào cản chưa thỏa mãn (${evaluation.blockers.join('; ')})`
      );
    }

    // 3. Kiểm tra chữ ký điện tử 21 CFR Part 11 (Bắt buộc cho QA; nếu có chữ ký thì bắt buộc kiểm tra tính hợp lệ)
    if (!isAdmin && !signature) {
      throw new Error(
        'Quy chuẩn 21 CFR Part 11: Yêu cầu chữ ký điện tử hợp lệ của QA trước khi xuất xưởng.'
      );
    }

    if (signature) {
      const isSigValid = await signatureService.verifySignatureIntegrity(signature);
      if (!isSigValid) {
        throw new Error('Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp trái phép.');
      }
    }

    // 4. Chuyển trạng thái Lô sang RELEASED thông qua BatchAppService
    await batchAppService.updateStatus(batchId, 'RELEASED', currentUser, {
      reason: reason || 'Phê duyệt xuất xưởng đạt chuẩn 7 Release Gates',
      currentBatch,
      batchTestResults: testResults,
      signature,
      requireSignature: !isAdmin,
    });

    logAuditAction({
      action: 'UPDATE',
      collection: 'BATCHES',
      documentId: batchId,
      details: `Xuất xưởng Lô thành công: ${currentBatch.batchNo || batchId} -> RELEASED [Người duyệt: ${currentUser?.email}]`,
      performedBy: currentUser?.email || 'unknown',
    });

    return {
      success: true,
      message: `Lô sản xuất ${currentBatch.batchNo || batchId} đã được xuất xưởng thành công.`,
    };
  }

  /**
   * Tạm dừng lưu thông / Giữ lại Lô sản xuất để thẩm định khẩn cấp (Batch Hold - BR-REL-002)
   */
  public async executeBatchHold(options: {
    batchId: string;
    currentBatch: Batch;
    reason: string;
    currentUser: any;
    signature?: ElectronicSignature;
  }): Promise<{ success: boolean; message: string }> {
    const { batchId, currentBatch, reason, currentUser, signature } = options;

    const isAuthorized =
      currentUser?.role === 'ADMIN' || currentUser?.isAdmin === true || currentUser?.role === 'QA';

    if (!isAuthorized) {
      throw new Error(
        'Từ chối quyền: Chỉ Quản lý chất lượng (QA) hoặc Quản trị viên mới có thẩm quyền ban hành Lệnh giữ lô (Batch Hold).'
      );
    }

    if (!reason || !reason.trim()) {
      throw new Error(
        'ERR_HOLD_REASON_REQUIRED: Bắt buộc phải nhập lý do giải trình khi tạm đình chỉ lưu thông lô.'
      );
    }

    if (signature) {
      const isSigValid = await signatureService.verifySignatureIntegrity(signature);
      if (!isSigValid) {
        throw new Error('Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp trái phép.');
      }
    }

    await batchAppService.updateStatus(batchId, 'BLOCKED', currentUser, {
      reason: `[LỆNH GIỮ LÔ] ${reason}`,
      currentBatch,
      signature,
    });

    logAuditAction({
      action: 'UPDATE',
      collection: 'BATCHES',
      documentId: batchId,
      details: `[TẠM ĐÌNH CHỈ / HOLD] Lô ${currentBatch.batchNo || batchId} bị giữ lại. Lý do: ${reason}`,
      performedBy: currentUser?.email || 'unknown',
    });

    return {
      success: true,
      message: `Đã ban hành Lệnh giữ Lô ${currentBatch.batchNo || batchId} thành công.`,
    };
  }

  /**
   * Thu hồi Lô khẩn cấp theo các cấp độ Class I / II / III (Batch Recall - BR-REL-002)
   */
  public async executeBatchRecall(options: {
    batchId: string;
    currentBatch: Batch;
    recallClass: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | string;
    reason: string;
    currentUser: any;
    signature?: ElectronicSignature;
  }): Promise<{ success: boolean; message: string }> {
    const { batchId, currentBatch, recallClass, reason, currentUser, signature } = options;

    const isAuthorized =
      currentUser?.role === 'ADMIN' || currentUser?.isAdmin === true || currentUser?.role === 'QA';

    if (!isAuthorized) {
      throw new Error(
        'Từ chối quyền: Chỉ Quản lý chất lượng (QA) hoặc Quản trị viên mới có thẩm quyền ban hành Lệnh thu hồi lô (Batch Recall).'
      );
    }

    if (!reason || !reason.trim()) {
      throw new Error(
        'ERR_RECALL_REASON_REQUIRED: Bắt buộc phải nhập lý do giải trình khi ban hành Lệnh thu hồi lô.'
      );
    }

    if (signature) {
      const isSigValid = await signatureService.verifySignatureIntegrity(signature);
      if (!isSigValid) {
        throw new Error('Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp trái phép.');
      }
    }

    await batchAppService.updateStatus(batchId, 'BLOCKED', currentUser, {
      reason: `[THU HỒI ${recallClass}] ${reason}`,
      currentBatch,
      signature,
    });

    logAuditAction({
      action: 'UPDATE',
      collection: 'BATCHES',
      documentId: batchId,
      details: `[THU HỒI KHẨN CẤP / RECALL] Lô ${currentBatch.batchNo || batchId} bị thu hồi (${recallClass}). Lý do: ${reason}`,
      performedBy: currentUser?.email || 'unknown',
    });

    return {
      success: true,
      message: `Đã ban hành Lệnh thu hồi Lô ${currentBatch.batchNo || batchId} (${recallClass}) thành công.`,
    };
  }
}

export const releaseService = new ReleaseService();
