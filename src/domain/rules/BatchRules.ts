/**
 * PQM Domain - Batch Rules (Model 6)
 * Các quy tắc nghiệp vụ dành riêng cho Lô sản xuất (Batch)
 */

import { Batch, TestResult, TCCS, QualityDeviation, BatchWorkflowStatus } from '../../types';
import { Role } from '../../types/permissions';
import { CanonicalStatusResolver } from '../canonical/canonicalResolver';

export interface BatchRuleEvaluationResult {
  allowed: boolean;
  reason?: string;
  blockers?: string[];
}

export class BatchRules {
  /**
   * Kiểm tra điều kiện xuất xưởng Lô sản xuất (canReleaseBatch)
   */
  public static canRelease(
    batch: Batch,
    testResults: TestResult[],
    userRole?: Role | string,
    boundTccs?: TCCS | null,
    deviations?: QualityDeviation[],
    options?: { asOfDate?: string | Date }
  ): BatchRuleEvaluationResult {
    const blockers: string[] = [];

    // 1. Kiểm tra quyền hạn (Role check: ADMIN hoặc QA)
    if (userRole && userRole !== 'ADMIN' && userRole !== 'QA') {
      blockers.push(
        `Vai trò ${userRole} không có thẩm quyền ký duyệt xuất xưởng Lô (yêu cầu QA hoặc ADMIN).`
      );
    }

    // 2. Trạng thái hiện tại của Lô
    if (batch.status === 'RELEASED') {
      blockers.push('Lô này đã ở trạng thái Xuất xưởng (RELEASED).');
    }
    if (batch.status === 'REJECTED') {
      blockers.push('Lô đã bị Từ chối (REJECTED), không thể xuất xưởng trực tiếp.');
    }

    // 3. Kiểm tra hạn sử dụng (Expiration Date Check)
    if (batch.expDate) {
      const asOf = options?.asOfDate ? new Date(options.asOfDate) : new Date();
      const exp = new Date(batch.expDate);
      if (!isNaN(exp.getTime()) && exp.getTime() < asOf.getTime()) {
        blockers.push(
          `Lô sản xuất đã hết hạn sử dụng (${batch.expDate}), không được phép xuất xưởng.`
        );
      }
    }

    // 4. Kiểm tra tính hợp lý của sản lượng (Yield sanity)
    if (batch.theoreticalYield !== undefined && batch.theoreticalYield <= 0) {
      blockers.push('Sản lượng lý thuyết của Lô phải lớn hơn 0.');
    }
    if (batch.actualYield !== undefined && batch.actualYield < 0) {
      blockers.push('Sản lượng thực tế của Lô không được là số âm.');
    }

    // 5. Kết quả kiểm nghiệm đạt chuẩn (Canonical Quality Resolution)
    const qualityRes = CanonicalStatusResolver.resolveBatchQuality(batch, testResults, boundTccs);
    if (qualityRes.batchQualityStatus !== 'PASS') {
      blockers.push(
        `Kết quả kiểm nghiệm chất lượng chưa đạt chuẩn PASS (Hiện tại: ${qualityRes.batchQualityStatus}).`
      );
    }

    // 6. Kiểm tra chỉ tiêu không đạt
    if (qualityRes.criteriaSummary.fail > 0) {
      blockers.push(`Còn ${qualityRes.criteriaSummary.fail} chỉ tiêu kiểm nghiệm không đạt.`);
    }

    // 7. Kiểm tra hồ sơ sai lệch nghiêm trọng chưa đóng (Open Critical Deviations)
    if (deviations && deviations.length > 0) {
      const openCritical = deviations.filter(
        (d) =>
          (d.batchId === batch.id || d.batchNo === batch.batchNo) &&
          d.severity === 'CRITICAL' &&
          d.status !== 'CLOSED'
      );
      if (openCritical.length > 0) {
        blockers.push(
          `Còn ${openCritical.length} hồ sơ sai lệch nghiêm trọng (CRITICAL) chưa được xử lý đóng (CLOSED).`
        );
      }
    }

    return {
      allowed: blockers.length === 0,
      reason: blockers.length > 0 ? blockers[0] : undefined,
      blockers,
    };
  }

  /**
   * Kiểm tra điều kiện chỉnh sửa Lô đã xuất xưởng (canEditReleasedBatch)
   */
  public static canEditReleased(batch: Batch, userRole?: Role | string): BatchRuleEvaluationResult {
    if (batch.status !== 'RELEASED') {
      return { allowed: true };
    }

    // Lô đã xuất xưởng chỉ có ADMIN mới có quyền sửa kèm lý do kiểm toán
    if (userRole !== 'ADMIN') {
      return {
        allowed: false,
        reason:
          'Lô đã Xuất xưởng (RELEASED) bị khóa dữ liệu theo quy định GMP. Chỉ ADMIN mới được phép điều chỉnh.',
        blockers: [
          'Lô đã Xuất xưởng (RELEASED) bị khóa dữ liệu theo quy định GMP. Chỉ ADMIN mới được phép điều chỉnh.',
        ],
      };
    }

    return { allowed: true };
  }

  /**
   * Kiểm tra điều kiện Từ chối Lô (canRejectBatch)
   */
  public static canReject(
    batch: Batch,
    reason?: string,
    userRole?: Role | string
  ): BatchRuleEvaluationResult {
    const blockers: string[] = [];

    // Kiểm tra thẩm quyền (QA hoặc ADMIN)
    if (userRole && userRole !== 'ADMIN' && userRole !== 'QA') {
      blockers.push(`Vai trò ${userRole} không có thẩm quyền từ chối Lô (yêu cầu QA hoặc ADMIN).`);
    }

    if (batch.status === 'RELEASED') {
      blockers.push(
        'Lô đã Xuất xưởng (RELEASED), cần quy trình Thu hồi (Recall) hoặc Sai lệch CAPA thay vì từ chối trực tiếp.'
      );
    }

    if (!reason || reason.trim().length === 0) {
      blockers.push('Bắt buộc phải nhập lý do từ chối lô sản xuất.');
    }

    return {
      allowed: blockers.length === 0,
      reason: blockers.length > 0 ? blockers[0] : undefined,
      blockers,
    };
  }

  /**
   * Kiểm tra điều kiện bắt đầu kiểm nghiệm Lô (canStartTesting)
   */
  public static canStartTesting(batch: Batch, boundTccs?: TCCS | null): BatchRuleEvaluationResult {
    const blockers: string[] = [];

    if (batch.status === 'RELEASED') {
      blockers.push('Lô đã Xuất xưởng (RELEASED), không thể bắt đầu kiểm nghiệm lại.');
    }
    if (batch.status === 'REJECTED') {
      blockers.push('Lô đã bị Từ chối (REJECTED), không thể bắt đầu kiểm nghiệm.');
    }
    if (!boundTccs && !batch.tccsId) {
      blockers.push('Lô chưa được liên kết với Tiêu chuẩn cơ sở (TCCS) nào để kiểm nghiệm.');
    }

    return {
      allowed: blockers.length === 0,
      reason: blockers.length > 0 ? blockers[0] : undefined,
      blockers,
    };
  }

  /**
   * Kiểm tra điều kiện Thu hồi Lô sản xuất (canRecallBatch)
   */
  public static canRecall(
    batch: Batch,
    reason?: string,
    userRole?: Role | string
  ): BatchRuleEvaluationResult {
    const blockers: string[] = [];

    if (userRole && userRole !== 'ADMIN' && userRole !== 'QA') {
      blockers.push(`Vai trò ${userRole} không có thẩm quyền thu hồi Lô (yêu cầu QA hoặc ADMIN).`);
    }

    if (batch.status !== 'RELEASED') {
      blockers.push(
        'Chỉ có thể thu hồi (Recall) đối với Lô đã ở trạng thái Xuất xưởng (RELEASED).'
      );
    }

    if (!reason || reason.trim().length === 0) {
      blockers.push('Bắt buộc phải nhập lý do và quyết định thu hồi Lô sản xuất.');
    }

    return {
      allowed: blockers.length === 0,
      reason: blockers.length > 0 ? blockers[0] : undefined,
      blockers,
    };
  }

  /**
   * Kiểm tra tính hợp lệ của việc chuyển đổi trạng thái Lô (canTransitionStatus)
   */
  public static canTransitionStatus(
    currentStatus: BatchWorkflowStatus,
    targetStatus: BatchWorkflowStatus,
    userRole?: Role | string
  ): BatchRuleEvaluationResult {
    if (currentStatus === targetStatus) {
      return { allowed: true };
    }

    const blockers: string[] = [];

    if (currentStatus === 'RELEASED') {
      if (userRole !== 'ADMIN') {
        blockers.push(
          'Lô đã Xuất xưởng (RELEASED) bị khóa dữ liệu theo quy định GMP. Chỉ ADMIN mới được phép điều chỉnh.'
        );
      }
    }

    if (currentStatus === 'REJECTED') {
      if (targetStatus === 'RELEASED') {
        blockers.push(
          'Lô đã bị Từ chối (REJECTED) không thể chuyển trực tiếp sang Xuất xưởng (RELEASED).'
        );
      }
    }

    return {
      allowed: blockers.length === 0,
      reason: blockers.length > 0 ? blockers[0] : undefined,
      blockers,
    };
  }
}
