/**
 * DEVIATION DOMAIN: WORKFLOW DEFINITIONS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';

export const DEVIATION_ACTIONS: Record<string, WorkflowActionId> = {
  CREATE: 'DEVIATION_CREATE',
  INVESTIGATE: 'DEVIATION_INVESTIGATE',
  APPROVE: 'DEVIATION_APPROVE',
  CLOSE: 'DEVIATION_CLOSE',
  DELETE: 'DEVIATION_DELETE',
} as const;

export const DEVIATION_STATUS_LABELS: Record<string, string> = {
  LOGGED: 'Mới ghi nhận',
  UNDER_INVESTIGATION: 'Đang điều tra',
  CAPA_PLANNED: 'Đã lập CAPA',
  EFFECTIVENESS_REVIEW: 'Đánh giá hiệu quả',
  CLOSED: 'Đã đóng',
} as const;
