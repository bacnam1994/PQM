/**
 * PQM Domain - Test Result Rules (Model 6)
 * Các quy tắc nghiệp vụ dành riêng cho Phiếu kiểm nghiệm (TestResult)
 */

import { Batch, TestResult, TestResultEntry, TCCS } from '../../types';
import { Role } from '../../types/permissions';
import { CanonicalStatusResolver } from '../canonical/canonicalResolver';
import { TestResultStatus } from '../canonical/canonicalStatus';

export interface TestResultRuleEvaluationResult {
  allowed: boolean;
  reason?: string;
  blockers?: string[];
}

export class TestResultRules {
  /**
   * Đánh giá kết quả kiểm nghiệm (evaluateTestResult)
   */
  public static evaluate(testResult: TestResult): {
    status: TestResultStatus;
    totalCriteria: number;
    passedCriteria: number;
    failedCriteria: number;
    pendingCriteria: number;
  } {
    const evalCriteria = CanonicalStatusResolver.evaluateCriteria(testResult.results || []);
    const status = CanonicalStatusResolver.calculateCanonicalTestStatus(testResult);

    return {
      status,
      totalCriteria: evalCriteria.total,
      passedCriteria: evalCriteria.pass,
      failedCriteria: evalCriteria.fail,
      pendingCriteria: evalCriteria.pending,
    };
  }

  /**
   * Kiểm tra điều kiện phê duyệt Phiếu kiểm nghiệm (canApproveTestResult)
   */
  public static canApprove(
    testResult: TestResult,
    userRole?: Role | string
  ): TestResultRuleEvaluationResult {
    const blockers: string[] = [];

    // 1. Kiểm tra vai trò (QA, QC hoặc ADMIN)
    if (userRole && !['ADMIN', 'QA', 'QC'].includes(userRole)) {
      blockers.push(`Vai trò ${userRole} không có thẩm quyền phê duyệt kết quả kiểm nghiệm.`);
    }

    // 2. Không được duyệt phiếu rỗng
    if (!testResult.results || testResult.results.length === 0) {
      blockers.push('Phiếu kiểm nghiệm chưa có dữ liệu kết quả chỉ tiêu.');
    }

    // 3. Không được duyệt phiếu có chỉ tiêu chưa hoàn tất (PENDING)
    const { pendingCriteria } = this.evaluate(testResult);
    if (pendingCriteria > 0) {
      blockers.push(`Còn ${pendingCriteria} chỉ tiêu chưa hoàn tất đánh giá kết quả.`);
    }

    return {
      allowed: blockers.length === 0,
      reason: blockers.length > 0 ? blockers[0] : undefined,
      blockers,
    };
  }

  /**
   * Kiểm tra điều kiện chỉnh sửa Phiếu kiểm nghiệm (canEditTestResult)
   */
  public static canEdit(
    testResult: TestResult,
    linkedBatch?: Batch | null,
    userRole?: Role | string
  ): TestResultRuleEvaluationResult {
    // Nếu Lô liên kết đã xuất xưởng thì chỉ ADMIN mới được phép sửa
    if (linkedBatch && linkedBatch.status === 'RELEASED') {
      if (userRole !== 'ADMIN') {
        return {
          allowed: false,
          reason:
            'Lô sản xuất đã Xuất xưởng (RELEASED). Chỉ ADMIN mới được điều chỉnh phiếu kiểm nghiệm kèm lý do kiểm toán.',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Kiểm tra điều kiện xóa Phiếu kiểm nghiệm (canDeleteTestResult)
   */
  public static canDelete(
    testResult: TestResult,
    linkedBatch?: Batch | null,
    userRole?: Role | string
  ): TestResultRuleEvaluationResult {
    // 1. Chỉ ADMIN hoặc QA mới có quyền xóa
    if (userRole && !['ADMIN', 'QA'].includes(userRole)) {
      return {
        allowed: false,
        reason:
          'Chỉ Quản trị viên (ADMIN) hoặc Đảm bảo chất lượng (QA) mới có quyền xóa phiếu kiểm nghiệm.',
      };
    }

    // 2. Không được xóa phiếu của Lô đã xuất xưởng
    if (linkedBatch && linkedBatch.status === 'RELEASED') {
      return {
        allowed: false,
        reason:
          'Không thể xóa phiếu kiểm nghiệm của Lô đã Xuất xưởng (RELEASED) theo quy chuẩn ALCOA+.',
      };
    }

    return { allowed: true };
  }
}
