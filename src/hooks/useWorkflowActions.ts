/**
 * USE WORKFLOW ACTIONS (UI CAPABILITY & DISPATCH HOOK)
 *
 * Cung cấp khả năng truy vấn năng lực hành động và điều phối qua WorkflowFacade cho UI components:
 * 1. allowedActions: Danh sách các hành động người dùng có thẩm quyền thực hiện trên EntityType
 * 2. canExecute(actionId): Kiểm tra nhanh một hành động cụ thể có được phép hiển thị/kích hoạt
 * 3. getActionMetadata(actionId): Lấy thông tin rủi ro, yêu cầu chữ ký, lý do giải trình
 * 4. dispatchAction(actionId, options): Thực thi hành động với Correlation ID và Audit Trail
 */

import { useState, useMemo, useCallback } from 'react';
import { useAppStore, getStoreCurrentUser } from '../store/useAppStore';
import { WorkflowFacade } from '../workflow/WorkflowFacade';
import {
  WorkflowActionId,
  WorkflowActor,
  WorkflowActionMetadata,
  WorkflowExecutionResult,
  EntityType,
} from '../workflow/contracts/actions';
import { CANONICAL_ACTION_REGISTRY } from '../workflow/definitions';

export interface DispatchActionOptions<TPayload = any> {
  entityId?: string;
  payload?: TPayload;
  reason?: string;
  signature?: any;
  confirmationToken?: string;
  expectedVersion?: number;
  currentState?: string;
  correlationId?: string;
  mutationHandler?: () => Promise<any>;
}

export function useWorkflowActions(entityType: EntityType, defaultEntityId?: string) {
  const user = useAppStore((state) => state.user);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<WorkflowExecutionResult | null>(null);

  // Chuyển đổi thông tin người dùng thành WorkflowActor chuẩn
  const actor: WorkflowActor = useMemo(() => {
    const current = getStoreCurrentUser() || user;
    const rawRole = (current?.role || (current?.isAdmin ? 'ADMIN' : 'USER')).toUpperCase();
    return {
      id: current?.id || current?.uid || 'usr_anonymous',
      name: current?.displayName || current?.name || 'Anonymous User',
      role: rawRole,
      email: current?.email,
    };
  }, [user]);

  // Danh sách các hành động mà Actor có thẩm quyền thực hiện
  const allowedActions = useMemo<WorkflowActionMetadata[]>(() => {
    return WorkflowFacade.getAllowedActions(entityType, actor);
  }, [entityType, actor]);

  // Kiểm tra một action có được phép đối với actor hiện tại hay không
  const canExecute = useCallback(
    (actionId: WorkflowActionId): boolean => {
      return allowedActions.some((a) => a.actionId === actionId);
    },
    [allowedActions]
  );

  // Lấy metadata của action
  const getActionMetadata = useCallback(
    (actionId: WorkflowActionId): WorkflowActionMetadata | undefined => {
      return CANONICAL_ACTION_REGISTRY[actionId];
    },
    []
  );

  // Điều phối thực thi hành động qua WorkflowFacade
  const dispatchAction = useCallback(
    async <TPayload = any, TData = any>(
      actionId: WorkflowActionId,
      options?: DispatchActionOptions<TPayload>
    ): Promise<WorkflowExecutionResult<TData>> => {
      setIsExecuting(true);
      setError(null);

      const targetEntityId = options?.entityId || defaultEntityId || 'root';
      const correlationId =
        options?.correlationId ||
        `corr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      try {
        const handler =
          options?.mutationHandler || (async () => options?.payload as unknown as TData);

        const result = await WorkflowFacade.dispatch<TPayload, TData>(
          {
            actionId,
            entityType,
            entityId: targetEntityId,
            actor,
            payload: options?.payload,
            reason: options?.reason,
            signature: options?.signature,
            confirmationToken: options?.confirmationToken,
            expectedVersion: options?.expectedVersion,
            currentState: options?.currentState,
            correlationId,
          },
          handler
        );

        setLastResult(result);

        if (!result.success) {
          setError(result.failureReason || 'Lỗi không xác định khi thực thi Workflow Action.');
        }

        return result;
      } catch (err: any) {
        const failureReason = err?.message || 'Lỗi ngoài dự kiến khi thực thi Workflow Action.';
        setError(failureReason);
        const errorResult: WorkflowExecutionResult<TData> = {
          success: false,
          executionId: `err-${Date.now()}`,
          actionId,
          entityType,
          entityId: targetEntityId,
          failureCode: 'HOOK_EXECUTION_ERROR',
          failureReason,
          timestamp: new Date().toISOString(),
          durationMs: 0,
        };
        setLastResult(errorResult);
        return errorResult;
      } finally {
        setIsExecuting(false);
      }
    },
    [entityType, defaultEntityId, actor]
  );

  return {
    actor,
    allowedActions,
    canExecute,
    getActionMetadata,
    dispatchAction,
    isExecuting,
    error,
    lastResult,
  };
}
