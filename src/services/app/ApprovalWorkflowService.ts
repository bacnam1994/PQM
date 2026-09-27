/**
 * PQM V4 Platform - Approval Workflow Service Adapter
 * Thin adapter re-exporting from canonical approval domain (VS-12).
 * Preserves 100% backward compatibility for legacy imports.
 */

export {
  ApprovalWorkflowService,
  approvalWorkflowService,
} from '../../domains/approval/application/service';
export type {
  ApprovalTask,
  ApprovalEntityType,
  ApprovalStep,
  StepDecision,
  ApprovalOverallStatus,
} from '../../domains/approval/domain/types';
