/**
 * WORKFLOW CONTRACTS: CORE INTERFACES
 *
 * Định nghĩa các interface chuẩn hóa cho Workflow Kernel và các thành phần phụ trợ:
 * - IWorkflowExecutor
 * - IWorkflowFacade
 * - IWorkflowGuard
 * - IWorkflowHandler
 */

import {
  WorkflowActionId,
  WorkflowActor,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
} from './actions';

export type WorkflowState = string;

export interface IWorkflowGuard<TContext = any> {
  verify(context: TContext): Promise<{ passed: boolean; code?: string; reason?: string }>;
}

export interface IWorkflowHandler<TInput = any, TOutput = any> {
  actionId: WorkflowActionId;
  handle(input: TInput, actor: WorkflowActor): Promise<TOutput>;
}

export interface IWorkflowExecutor {
  execute<TPayload = any, TData = any>(
    context: WorkflowExecutionContext<TPayload>,
    mutationHandler: () => Promise<TData>,
    domainValidator?: () => Promise<{ valid: boolean; error?: string; code?: string }>,
    transitionResolver?: () => { nextState: string } | null
  ): Promise<WorkflowExecutionResult<TData>>;
}

export interface IWorkflowFacade {
  dispatch<TPayload = any, TData = any>(
    actionId: WorkflowActionId,
    entityType: string,
    entityId: string,
    payload: TPayload,
    actor: WorkflowActor,
    options?: {
      reason?: string;
      signature?: any;
      confirmationToken?: string;
      expectedVersion?: number;
      currentState?: string;
      correlationId?: string;
      idempotencyKey?: string;
      domainValidator?: () => Promise<{ valid: boolean; error?: string; code?: string }>;
      transitionResolver?: () => { nextState: string } | null;
    }
  ): Promise<WorkflowExecutionResult<TData>>;
}
