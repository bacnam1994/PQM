/**
 * PQM Domain - Batch Rules (Model 6)
 * Các quy tắc nghiệp vụ dành riêng cho Lô sản xuất (Batch)
 */

import { Batch, TestResult, TCCS, QualityDeviation, BatchWorkflowStatus } from '../../types';
import { Role } from '../../types/permissions';
import { ReleaseRules } from './ReleaseRules';

export interface BatchRuleEvaluationResult {
  allowed: boolean;
  reason?: string;
  blockers?: string[];
}

export class BatchRules {
  /**
   * Kiểm tra điều kiện xuất xưởng Lô sản xuất (canReleaseBatch)
   * Ủy quyền trực tiếp cho ReleaseRules.evaluateReleasePrerequisites (Single Source of Truth)
   */
  public static canRelease(
    batch: Batch,
    testResults: TestResult[],
    userRole?: Role | string,
    boundTccs?: TCCS | null,
    deviations?: QualityDeviation[],
    options?: { asOfDate?: string | Date }
  ): BatchRuleEvaluationResult {
    const prereq = ReleaseRules.evaluateReleasePrerequisites({
      batch,
      testResults,
      userRole,
      boundTccs,
      deviations,
      asOfDate: options?.asOfDate,
    });

    return {
      allowed: prereq.isEligibleForRelease,
      reason: prereq.blockers[0],
      blockers: prereq.blockers,
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
