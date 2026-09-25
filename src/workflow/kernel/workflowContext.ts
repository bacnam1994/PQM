/**
 * WORKFLOW KERNEL: CONTEXT
 *
 * Re-export ngữ cảnh thực thi từ contracts/actions để đảm bảo tính SSoT duy nhất.
 */

export type {
  WorkflowActor,
  WorkflowExecutionContext,
  CanonicalRole,
  EntityType,
} from '../contracts/actions';
