/**
 * BATCH DOMAIN: RELEASE SERVICE
 *
 * Điều phối quy trình xuất xưởng Lô sản xuất (Batch Release)
 * Tuân thủ 100% tài liệu:
 * - docs/business-rules/BR_05_RELEASE_RULES.md (BR-REL-001)
 * - docs/specs/FRS_09_BATCH_RELEASE.md
 * - 21 CFR Part 11 Electronic Signatures & 7 Release Gates
 */

import { Batch, TestResult, TCCS, QualityDeviation, ElectronicSignature } from '../domain/types';
import { ReleaseRules } from '../domain/rules';
import { batchAppService } from './service';
import { signatureService } from '../../../services/signatureService';
import { logAuditAction } from '../../../services/auditService';
import { can } from '../../../services/permissionService';

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

    // 2. Thẩm định nghiêm ngặt 7 Release Gates
    const evalResult = this.evaluateReleaseReadiness({
      batch: currentBatch,
      testResults,
      boundTccs,
      deviations,
      userRole: currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'USER'),
    });

    if (!evalResult.isEligible) {
      const blockerList = evalResult.blockers.join('; ');
      throw new Error(
        `Từ chối xuất xưởng: Lô không đủ điều kiện (7 Release Gates). Chi tiết: ${blockerList}`
      );
    }

    // 3. Kiểm tra Chữ ký điện tử CFR Part 11
    if (signature) {
      const isValid = await signatureService.verifySignatureIntegrity(signature);
      if (!isValid) {
        throw new Error('Từ chối xuất xưởng: Chữ ký điện tử không hợp lệ hoặc đã bị chỉnh sửa.');
      }
    }

    // 4. Kích hoạt cập nhật trạng thái qua BatchAppService & Workflow State Machine
    await batchAppService.updateStatus(batchId, 'RELEASED', currentUser, {
      reason: reason || 'Phê duyệt xuất xưởng Lô sản xuất đạt chuẩn GMP',
      currentBatch,
      batchTestResults: testResults,
      signature,
      requireSignature: true,
    });

    // 5. Ghi nhận nhật ký kiểm toán ALCOA+ Audit Trail
    await logAuditAction({
      action: 'UPDATE',
      collection: 'BATCHES',
      documentId: batchId,
      details: `Phê duyệt xuất xưởng (RELEASED) thành công lô [${currentBatch.batchNo}]. 7 Gates Passed. Chữ ký xác thực.`,
      performedBy: currentUser?.email || currentUser?.name || 'unknown',
    });

    return {
      success: true,
      message: `Xuất xưởng lô ${currentBatch.batchNo} thành công theo quy chuẩn GMP!`,
    };
  }

  /**
   * Thu hồi hoặc phong tỏa lô khẩn cấp (Emergency Block/Recall)
   */
  public async emergencyBlockBatch(options: {
    batchId: string;
    currentBatch: Batch;
    currentUser: any;
    reason: string;
    signature?: ElectronicSignature;
  }): Promise<{ success: boolean; message: string }> {
    const { batchId, currentBatch, currentUser, reason, signature } = options;

    if (!reason || reason.trim().length < 10) {
      throw new Error(
        'Lý do phong tỏa/thu hồi khẩn cấp phải có ít nhất 10 ký tự giải trình rõ ràng.'
      );
    }

    await batchAppService.updateStatus(batchId, 'BLOCKED', currentUser, {
      reason,
      currentBatch,
      signature,
      requireSignature: false,
    });

    return {
      success: true,
      message: `Đã kích hoạt phong tỏa khẩn cấp lô [${currentBatch.batchNo}].`,
    };
  }
}

export const releaseService = new ReleaseService();
