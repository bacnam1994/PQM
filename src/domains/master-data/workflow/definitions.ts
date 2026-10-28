/**
 * MASTER DATA DOMAIN: WORKFLOW DEFINITIONS & ACTION IDENTIFIERS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';

export const MASTER_DATA_ACTIONS = {
  // Master Criteria
  CRITERIA_CREATE: 'CRITERIA_MASTER_CREATE' as WorkflowActionId,
  CRITERIA_UPDATE: 'CRITERIA_MASTER_UPDATE' as WorkflowActionId,
  CRITERIA_ALIAS_MAP: 'CRITERIA_ALIAS_MAP' as WorkflowActionId,

  // Pharmacopoeia
  PHARMACOPOEIA_CREATE: 'PHARMACOPOEIA_CREATE' as WorkflowActionId,
  PHARMACOPOEIA_UPDATE: 'PHARMACOPOEIA_UPDATE' as WorkflowActionId,
  PHARMACOPOEIA_DELETE: 'PHARMACOPOEIA_DELETE' as WorkflowActionId,

  // Laboratory
  LAB_CREATE: 'LAB_MASTER_CREATE' as WorkflowActionId,
  LAB_UPDATE: 'LAB_MASTER_UPDATE' as WorkflowActionId,
} as const;

export const MASTER_DATA_CATEGORY_LABELS = {
  CRITERIA: 'Chỉ tiêu kiểm nghiệm mẫu',
  PHARMACOPOEIA: 'Tiêu chuẩn Dược điển',
  LABORATORY: 'Đơn vị / Phòng kiểm nghiệm',
} as const;
