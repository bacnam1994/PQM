/**
 * OOS DOMAIN: WORKFLOW DEFINITIONS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';

export const OOS_ACTIONS: Record<string, WorkflowActionId> = {
  CREATE: 'OOS_CREATE',
  PHASE1_LAB_INVESTIGATE: 'OOS_PHASE1_LAB_INVESTIGATE',
  PHASE2_MFG_INVESTIGATE: 'OOS_PHASE2_MFG_INVESTIGATE',
  CONCLUDE: 'OOS_CONCLUDE',
} as const;

export const OOS_STATUS_LABELS: Record<string, string> = {
  TRIGGERED: 'Mới phát hiện OOS',
  PHASE1_LAB_INVESTIGATION: 'Đang điều tra Lab (Phase 1)',
  PHASE2_MFG_INVESTIGATION: 'Đang điều tra Sản xuất (Phase 2)',
  CONCLUDED: 'Đã có kết luận OOS',
} as const;
