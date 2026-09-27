/**
 * COA DOMAIN: WORKFLOW DEFINITIONS
 */

import { WorkflowActionId } from '../../../workflow/contracts/actions';
import { CoAStatus } from '../domain/types';

export const COA_ACTIONS: Record<string, WorkflowActionId> = {
  GENERATE: 'COA_GENERATE',
  SIGN: 'COA_SIGN',
  REVOKE: 'COA_REVOKE',
} as const;

export const COA_STATUS_LABELS: Record<CoAStatus, string> = {
  GENERATED: 'Đã tạo bản chụp CoA',
  SIGNED: 'Đã ký số ban hành',
  REVOKED: 'Đã thu hồi hiệu lực',
};
