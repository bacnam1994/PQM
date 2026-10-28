/**
 * TEST RESULT DOMAIN: WORKFLOW DEFINITIONS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';

export const TEST_RESULT_ACTIONS: Record<string, WorkflowActionId> = {
  CREATE: 'TEST_RESULT_CREATE',
  ENTRY_INPUT: 'TEST_RESULT_ENTRY_INPUT',
  CALCULATION_RUN: 'TEST_RESULT_CALCULATION_RUN',
  SUBMIT: 'TEST_RESULT_SUBMIT',
  APPROVE: 'TEST_RESULT_APPROVE',
  REJECT: 'TEST_RESULT_REJECT',
  CANCEL: 'TEST_RESULT_CANCEL',
  REVOKE: 'TEST_RESULT_REVOKE',
  REEVALUATE: 'TEST_RESULT_REEVALUATE',
  DELETE: 'TEST_RESULT_DELETE',
} as const;

export const TEST_RESULT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Chờ duyệt',
  FINAL: 'Hoàn tất kết quả',
  APPROVED: 'Đã duyệt',
  RELEASED: 'Đã xuất xưởng',
  SUPERSEDED: 'Đã bị thay thế',
  CANCELLED: 'Đã hủy',
} as const;
