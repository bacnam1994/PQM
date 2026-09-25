/**
 * CAPA DOMAIN: WORKFLOW DEFINITIONS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';

export const CAPA_ACTIONS: Record<string, WorkflowActionId> = {
  CREATE: 'CAPA_CREATE',
  EXECUTE: 'CAPA_EXECUTE',
  VERIFY: 'CAPA_VERIFY',
  CLOSE: 'CAPA_CLOSE',
} as const;

export const CAPA_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ thực hiện',
  IN_PROGRESS: 'Đang triển khai',
  COMPLETED: 'Đã hoàn thành',
  VERIFIED: 'Đã xác minh hiệu quả',
} as const;
