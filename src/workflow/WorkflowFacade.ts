/**
 * WORKFLOW FACADE (SINGLE SOURCE OF TRUTH ENTRYPOINT)
 *
 * Cửa ngõ điều phối duy nhất cho toàn bộ hệ thống PQM:
 * 1. dispatch(): Thực thi mọi thao tác nghiệp vụ qua Kernel điều phối
 * 2. getAllowedActions(): Cung cấp danh sách hành động hợp lệ cho UI
 * 3. canExecute(): Kiểm tra nhanh thẩm quyền người dùng trước khi render nút bấm
 * 4. getActionMetadata(): Lấy đặc tả chi tiết của từng Workflow Action
 */

import {
  WorkflowActionId,
  WorkflowActor,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  WorkflowActionMetadata,
  EntityType,
} from './contracts/actions';
import { CANONICAL_ACTION_REGISTRY } from './definitions';
import { UnifiedWorkflowExecutor } from './UnifiedWorkflowExecutor';
import { WorkflowGuards } from './guards';

export class WorkflowFacade {
  /**
   * Điều phối thực thi một hành động có quy chuẩn
   */
  public static async dispatch<TPayload = any, TData = any>(
    context: WorkflowExecutionContext<TPayload>,
    mutationHandler: () => Promise<TData>,
    domainValidator?: () => Promise<{ valid: boolean; error?: string; code?: string }>,
    transitionResolver?: () => { nextState: string } | null
  ): Promise<WorkflowExecutionResult<TData>> {
    return UnifiedWorkflowExecutor.execute<TPayload, TData>(
      context,
      mutationHandler,
      domainValidator,
      transitionResolver
    );
  }

  /**
   * Trả về danh sách các actions mà Actor có thẩm quyền thực hiện trên EntityType này
   */
  public static getAllowedActions(
    entityType: EntityType,
    actor: WorkflowActor
  ): WorkflowActionMetadata[] {
    const results: WorkflowActionMetadata[] = [];

    for (const actionMeta of Object.values(CANONICAL_ACTION_REGISTRY)) {
      if (actionMeta.entityType === entityType) {
        const check = WorkflowGuards.verifyRBAC(actionMeta, actor);
        if (check.passed) {
          results.push(actionMeta);
        }
      }
    }

    return results;
  }

  /**
   * Kiểm tra nhanh thẩm quyền thực thi action của Actor
   */
  public static canExecute(actionId: WorkflowActionId | string, actor: WorkflowActor): boolean {
    const actionMeta = CANONICAL_ACTION_REGISTRY[actionId as WorkflowActionId];
    if (!actionMeta) return false;
    return WorkflowGuards.verifyRBAC(actionMeta, actor).passed;
  }

  /**
   * Lấy metadata đặc tả của một Action
   */
  public static getActionMetadata(
    actionId: WorkflowActionId | string
  ): WorkflowActionMetadata | undefined {
    return CANONICAL_ACTION_REGISTRY[actionId as WorkflowActionId];
  }
}
