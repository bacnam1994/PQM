/**
 * UNIFIED WORKFLOW EXECUTOR (KERNEL V2)
 *
 * Pipeline 12 bước thực thi workflow thống nhất cho toàn bộ hệ thống PQM:
 * 1. Actor Resolution & Canonical Role Verification
 * 2. Action Catalog Metadata Resolution
 * 3. Entity Type Match Verification
 * 4. RBAC Authorization Enforcement
 * 5. Reason Enforcement (cho các action nhạy cảm)
 * 6. Signature Enforcement (21 CFR Part 11)
 * 7. Confirmation Token Enforcement (cho destructive actions)
 * 8. Optimistic Concurrency Control (OCC Guard)
 * 9. State Machine Transition Verification
 * 10. Domain Rules & Preconditions Guard
 * 11. Atomic Mutation Execution
 * 12. ALCOA+ Awaited Outbox Audit Logging (Fail-Closed)
 */

import {
  WorkflowActionId,
  WorkflowActor,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
} from './contracts/actions';
import { CANONICAL_ACTION_REGISTRY } from './definitions';
import { WORKFLOW_ACTION_CATALOG } from '../domain/workflow/workflowActionCatalog';
import { WorkflowGuards } from './guards';
import { OutboxAuditQueue } from './events/outboxAuditQueue';
import { WorkflowTelemetry } from './observability/workflowTelemetry';

export type {
  WorkflowActor,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
} from './contracts/actions';

export class UnifiedWorkflowExecutor {
  /**
   * Bộ nhớ cache Idempotency Key ngắn hạn (RAM)
   */
  private static idempotencyCache: Map<string, WorkflowExecutionResult> = new Map();

  /**
   * Thực thi một Workflow Action có kiểm soát qua 12 bước quy chuẩn.
   *
   * @param context Thông tin ngữ cảnh thực thi
   * @param mutationHandler Callback thực hiện mutation dữ liệu thực tế
   * @param domainValidator Callback kiểm tra điều kiện nghiệp vụ bổ sung (nếu có)
   * @param transitionResolver Callback tính toán trạng thái tiếp theo (nếu có FSM)
   */
  public static async execute<TPayload = any, TData = any>(
    context: WorkflowExecutionContext<TPayload>,
    mutationHandler: () => Promise<TData>,
    domainValidator?: () => Promise<{ valid: boolean; error?: string; code?: string }>,
    transitionResolver?: () => { nextState: string } | null
  ): Promise<WorkflowExecutionResult<TData>> {
    const startTime = Date.now();
    const executionId = `WF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    const {
      actionId,
      entityType,
      entityId,
      actor,
      payload,
      reason,
      signature,
      confirmationToken,
      expectedVersion,
      currentState,
      correlationId,
      idempotencyKey,
    } = context;

    // Bắt đầu đo lường Telemetry
    WorkflowTelemetry.startExecution(
      executionId,
      actionId,
      entityType,
      entityId,
      actor?.role || 'UNKNOWN',
      correlationId
    );

    // 0. Idempotency Check
    if (idempotencyKey && this.idempotencyCache.has(idempotencyKey)) {
      const cached = this.idempotencyCache.get(idempotencyKey)! as WorkflowExecutionResult<TData>;
      return {
        ...cached,
        durationMs: Date.now() - startTime,
      };
    }

    // 1. Resolve Action Catalog Metadata
    const actionMeta =
      CANONICAL_ACTION_REGISTRY[actionId as WorkflowActionId] ||
      (typeof WORKFLOW_ACTION_CATALOG !== 'undefined'
        ? (WORKFLOW_ACTION_CATALOG as any)[actionId]
        : undefined);

    if (!actionMeta) {
      const result: WorkflowExecutionResult<TData> = {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        failureCode: 'UNKNOWN_WORKFLOW_ACTION',
        failureReason: `Hành động ${actionId} không tồn tại trong Workflow Action Catalog.`,
        timestamp,
        durationMs: Date.now() - startTime,
      };
      WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
      return result;
    }

    // 2. Validate Entity Type Match
    if (actionMeta.entityType !== entityType) {
      const result: WorkflowExecutionResult<TData> = {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        failureCode: 'ENTITY_TYPE_MISMATCH',
        failureReason: `Hành động ${actionId} áp dụng cho ${actionMeta.entityType}, không thể dùng cho ${entityType}.`,
        timestamp,
        durationMs: Date.now() - startTime,
      };
      WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
      return result;
    }

    // 3. Authorization Check (RBAC Guard)
    const rbacCheck = WorkflowGuards.verifyRBAC(actionMeta, actor);
    if (!rbacCheck.passed) {
      const result: WorkflowExecutionResult<TData> = {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        failureCode: rbacCheck.code || 'UNAUTHORIZED_ROLE',
        failureReason: rbacCheck.reason,
        timestamp,
        durationMs: Date.now() - startTime,
      };
      WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
      return result;
    }

    // 4. Reason Enforcement Check
    const reasonCheck = WorkflowGuards.verifyReason(actionMeta, reason);
    if (!reasonCheck.passed) {
      const result: WorkflowExecutionResult<TData> = {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        failureCode: reasonCheck.code || 'REASON_REQUIRED',
        failureReason: reasonCheck.reason,
        timestamp,
        durationMs: Date.now() - startTime,
      };
      WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
      return result;
    }

    // 5. Signature Enforcement Check (21 CFR Part 11)
    const sigCheck = WorkflowGuards.verifySignature(actionMeta, signature);
    if (!sigCheck.passed) {
      const result: WorkflowExecutionResult<TData> = {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        failureCode: sigCheck.code || 'SIGNATURE_REQUIRED',
        failureReason: sigCheck.reason,
        timestamp,
        durationMs: Date.now() - startTime,
      };
      WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
      return result;
    }

    // 6. Confirmation Token Check (Destructive Actions)
    const tokenCheck = WorkflowGuards.verifyConfirmationToken(actionMeta, confirmationToken);
    if (!tokenCheck.passed) {
      const result: WorkflowExecutionResult<TData> = {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        failureCode: tokenCheck.code || 'INVALID_CONFIRMATION_TOKEN',
        failureReason: tokenCheck.reason,
        timestamp,
        durationMs: Date.now() - startTime,
      };
      WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
      return result;
    }

    // 7. OCC Concurrency Check
    if (expectedVersion != null && (payload as any)?.version != null) {
      const occCheck = WorkflowGuards.verifyOCC(expectedVersion, (payload as any).version);
      if (!occCheck.passed) {
        const result: WorkflowExecutionResult<TData> = {
          success: false,
          executionId,
          actionId,
          entityType,
          entityId,
          failureCode: occCheck.code || 'CONCURRENCY_CONFLICT',
          failureReason: occCheck.reason,
          timestamp,
          durationMs: Date.now() - startTime,
        };
        WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
        return result;
      }
    }

    // 8. State Machine Transition Verification (nếu có)
    let calculatedNextState: string | undefined = undefined;
    if (transitionResolver) {
      try {
        const transition = transitionResolver();
        if (!transition) {
          const result: WorkflowExecutionResult<TData> = {
            success: false,
            executionId,
            actionId,
            entityType,
            entityId,
            fromState: currentState,
            failureCode: 'INVALID_STATE_TRANSITION',
            failureReason: `Chuyển trạng thái từ '${currentState}' cho hành động '${actionId}' không hợp lệ theo State Machine.`,
            timestamp,
            durationMs: Date.now() - startTime,
          };
          WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
          return result;
        }
        calculatedNextState = transition.nextState;
      } catch (err: any) {
        const result: WorkflowExecutionResult<TData> = {
          success: false,
          executionId,
          actionId,
          entityType,
          entityId,
          fromState: currentState,
          failureCode: 'TRANSITION_EVALUATION_ERROR',
          failureReason: err?.message || 'Lỗi đánh giá chuyển trạng thái State Machine.',
          timestamp,
          durationMs: Date.now() - startTime,
        };
        WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
        return result;
      }
    }

    // 9. Domain Rules & Preconditions (Domain Validator)
    if (domainValidator) {
      try {
        const validation = await domainValidator();
        if (!validation.valid) {
          const result: WorkflowExecutionResult<TData> = {
            success: false,
            executionId,
            actionId,
            entityType,
            entityId,
            fromState: currentState,
            toState: calculatedNextState,
            failureCode: validation.code || 'DOMAIN_VALIDATION_FAILED',
            failureReason: validation.error || 'Quy chuẩn nghiệp vụ (Domain Rule) không thỏa mãn.',
            timestamp,
            durationMs: Date.now() - startTime,
          };
          WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
          return result;
        }
      } catch (err: any) {
        const result: WorkflowExecutionResult<TData> = {
          success: false,
          executionId,
          actionId,
          entityType,
          entityId,
          fromState: currentState,
          toState: calculatedNextState,
          failureCode: 'VALIDATION_EXECUTION_ERROR',
          failureReason: err?.message || 'Lỗi trong quá trình kiểm tra quy chuẩn nghiệp vụ.',
          timestamp,
          durationMs: Date.now() - startTime,
        };
        WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
        return result;
      }
    }

    // 10. Atomic Mutation Execution
    let mutationData: TData;
    try {
      mutationData = await mutationHandler();
    } catch (err: any) {
      const result: WorkflowExecutionResult<TData> = {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        fromState: currentState,
        toState: calculatedNextState,
        failureCode: 'MUTATION_FAILED',
        failureReason: err?.message || 'Thao tác thay đổi dữ liệu (Mutation) thất bại.',
        timestamp,
        durationMs: Date.now() - startTime,
      };
      WorkflowTelemetry.recordFailure(executionId, result.failureCode!, result.failureReason!);
      return result;
    }

    // 11. ALCOA+ Awaited Outbox Audit Logging (Fail-Closed)
    let auditStatus: 'COMMITTED' | 'AUDIT_FAILED' | 'SKIPPED' = 'SKIPPED';
    let auditError: string | undefined = undefined;

    if (actionMeta.requiresAudit) {
      const auditResult = await OutboxAuditQueue.dispatchAudit({
        eventId: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        executionId,
        actionId,
        entityType,
        entityId,
        actor: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
          email: actor.email,
        },
        details: `${actionMeta.description} cho ${entityType} #${entityId}${reason ? ` [Lý do: ${reason}]` : ''}`,
        timestamp,
        correlationId,
      });

      if (auditResult.success) {
        auditStatus = 'COMMITTED';
      } else {
        auditStatus = 'AUDIT_FAILED';
        auditError = auditResult.error;

        // ALCOA+ Fail-Closed Rule: Nếu audit thất bại thì action không được xem là thành công
        const failClosedResult: WorkflowExecutionResult<TData> = {
          success: false,
          executionId,
          actionId,
          entityType,
          entityId,
          fromState: currentState,
          toState: calculatedNextState,
          data: mutationData,
          failureCode: 'AUDIT_LOG_FAILED',
          failureReason: `Nguyên tắc ALCOA+ (Fail-Closed): Giao dịch bị từ chối do không thể lưu vết kiểm toán: ${auditError}`,
          auditStatus: 'AUDIT_FAILED',
          auditError,
          timestamp,
          durationMs: Date.now() - startTime,
        };
        WorkflowTelemetry.recordFailure(
          executionId,
          failClosedResult.failureCode!,
          failClosedResult.failureReason!
        );
        return failClosedResult;
      }
    }

    // 12. Thành công toàn diện (Committed)
    const successResult: WorkflowExecutionResult<TData> = {
      success: true,
      executionId,
      actionId,
      entityType,
      entityId,
      fromState: currentState,
      toState: calculatedNextState,
      data: mutationData,
      auditStatus,
      auditError,
      timestamp,
      durationMs: Date.now() - startTime,
    };

    if (idempotencyKey) {
      this.idempotencyCache.set(idempotencyKey, successResult);
    }

    WorkflowTelemetry.recordSuccess(executionId, calculatedNextState);
    return successResult;
  }
}
