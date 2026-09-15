/**
 * PQM Domain - Batch Rules (Model 6)
 * Các quy tắc nghiệp vụ dành riêng cho Lô sản xuất (Batch)
 */

import { Batch, TestResult, TCCS } from '../../types';
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
    boundTccs?: TCCS | null
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

    // 3. Kết quả kiểm nghiệm đạt chuẩn (Canonical Quality Resolution)
    const qualityRes = CanonicalStatusResolver.resolveBatchQuality(batch, testResults, boundTccs);
    if (qualityRes.batchQualityStatus !== 'PASS') {
      blockers.push(
        `Kết quả kiểm nghiệm chất lượng chưa đạt chuẩn PASS (Hiện tại: ${qualityRes.batchQualityStatus}).`
      );
    }

    // 4. Kiểm tra chỉ tiêu không đạt
    if (qualityRes.criteriaSummary.fail > 0) {
      blockers.push(`Còn ${qualityRes.criteriaSummary.fail} chỉ tiêu kiểm nghiệm không đạt.`);
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
      };
    }

    return { allowed: true };
  }

  /**
   * Kiểm tra điều kiện Từ chối Lô (canRejectBatch)
   */
  public static canReject(batch: Batch, reason?: string): BatchRuleEvaluationResult {
    if (batch.status === 'RELEASED') {
      return {
        allowed: false,
        reason:
          'Lô đã Xuất xưởng (RELEASED), cần quy trình Thu hồi (Recall) hoặc Sai lệch CAPA thay vì từ chối trực tiếp.',
      };
    }

    if (!reason || reason.trim().length === 0) {
      return {
        allowed: false,
        reason: 'Bắt buộc phải nhập lý do từ chối lô sản xuất.',
      };
    }

    return { allowed: true };
  }
}
