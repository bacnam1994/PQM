/**
 * TCCS DOMAIN: WORKFLOW DEFINITIONS & BINDINGS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';

export const TCCS_WORKFLOW_ACTIONS: WorkflowActionId[] = [
  'TCCS_CREATE',
  'TCCS_UPDATE_DRAFT',
  'TCCS_SUBMIT',
  'TCCS_APPROVE',
  'TCCS_REVISE',
  'TCCS_OBSOLETE',
  'CRITERIA_ALIAS_MAP',
];
