/**
 * APPROVAL DOMAIN: WORKFLOW DEFINITIONS & ACTION LABELS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';
import { ApprovalOverallStatus } from '../domain/types';

export const APPROVAL_ACTIONS = {
  CREATE: 'APPROVAL_TASK_CREATE' as WorkflowActionId,
  DECIDE: 'APPROVAL_TASK_DECIDE' as WorkflowActionId,
  CANCEL: 'APPROVAL_TASK_CANCEL' as WorkflowActionId,
} as const;

export const APPROVAL_STATUS_LABELS: Record<ApprovalOverallStatus, string> = {
  PENDING: 'Chờ xử lý',
  IN_PROGRESS: 'Đang xét duyệt',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã hủy bỏ / Thu hồi',
};

export const APPROVAL_STEP_STATUS_LABELS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  SKIPPED: 'Bỏ qua',
} as const;
