/**
 * BATCH DOMAIN: WORKFLOW DEFINITIONS & BINDINGS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';

export const BATCH_WORKFLOW_ACTIONS: WorkflowActionId[] = [
  'BATCH_CREATE',
  'BATCH_UPDATE_METADATA',
  'BATCH_DISPATCH_TESTING',
  'BATCH_EVALUATE_RELEASE',
  'BATCH_RELEASE_APPROVE',
  'BATCH_REJECT',
  'BATCH_HOLD',
  'BATCH_RECALL',
  'BATCH_DELETE',
];
