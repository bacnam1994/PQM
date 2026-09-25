/**
 * WORKFLOW KERNEL: RESULT
 *
 * Định nghĩa kết quả thực thi và failure codes chuẩn hóa từ contracts/actions.
 */

export type { WorkflowExecutionResult } from '../contracts/actions';

export type WorkflowFailureCode =
  | 'UNKNOWN_WORKFLOW_ACTION'
  | 'ENTITY_TYPE_MISMATCH'
  | 'UNAUTHORIZED_ROLE'
  | 'CONCURRENCY_CONFLICT'
  | 'REASON_REQUIRED'
  | 'SIGNATURE_REQUIRED'
  | 'INVALID_SIGNATURE'
  | 'CONFIRMATION_TOKEN_REQUIRED'
  | 'INVALID_CONFIRMATION_TOKEN'
  | 'INVALID_STATE_TRANSITION'
  | 'TRANSITION_EVALUATION_ERROR'
  | 'DOMAIN_VALIDATION_FAILED'
  | 'VALIDATION_EXECUTION_ERROR'
  | 'MUTATION_FAILED'
  | 'AUDIT_LOG_FAILED'
  | 'UNKNOWN_ACTION';
