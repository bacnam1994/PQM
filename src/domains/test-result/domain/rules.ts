/**
 * TEST RESULT DOMAIN: RULES & STATE MACHINE
 */

import { TestResult } from '../../../types';
export {
  TestResultStateMachine,
  TestResultWorkflowStateMachine,
  QualityWorkflowMatrixGuard,
} from '../../../domain/workflow/stateMachine';
export {
  resolveTestResultStatus,
  calculateOverallStatusForTestResult,
} from '../../../domain/test-result/testResultStatusResolver';

export class TestResultRules {
  /**
   * Xác thực thông tin đầu vào cơ bản của Phiếu kiểm nghiệm
   */
  public static validateTestResult(data: Partial<TestResult>): {
    isValid: boolean;
    error?: string;
  } {
    if (!data.batchId || !data.batchId.trim()) {
      return {
        isValid: false,
        error: 'Phiếu kiểm nghiệm phải gắn liền với một Lô sản xuất cụ thể.',
      };
    }
    if (!data.labName || !data.labName.trim()) {
      return { isValid: false, error: 'Tên phòng kiểm nghiệm (Lab) không được để trống.' };
    }
    if (!data.testDate || !data.testDate.trim()) {
      return { isValid: false, error: 'Ngày kiểm nghiệm không được để trống.' };
    }
    return { isValid: true };
  }

  /**
   * Kiểm tra xem phiếu kiểm nghiệm có thể chỉnh sửa dữ liệu hay không
   */
  public static canEdit(workflowStatus?: string): boolean {
    if (!workflowStatus) return true;
    return workflowStatus === 'DRAFT' || workflowStatus === 'SUBMITTED';
  }

  /**
   * Kiểm tra xem phiếu kiểm nghiệm có bị khóa vĩnh viễn (Superseded/Cancelled) không
   */
  public static isTerminal(workflowStatus?: string): boolean {
    return workflowStatus === 'SUPERSEDED' || workflowStatus === 'CANCELLED';
  }
}
