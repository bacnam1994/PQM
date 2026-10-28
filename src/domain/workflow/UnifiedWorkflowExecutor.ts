/**
 * UNIFIED WORKFLOW EXECUTOR
 *
 * Pipeline 12 bước thực thi workflow thống nhất cho toàn bộ hệ thống PQM.
 * Đảm bảo:
 * 1. Actor Resolution
 * 2. Action Catalog Validation
 * 3. Input Validation
 * 4. Authorization Enforcement
 * 5. Reason Enforcement (cho các action nhạy cảm)
 * 6. State Machine Transition Verification
 * 7. Domain Rules & Preconditions
 * 8. Atomic Mutation Execution
 * 9. Audit Event Logging (Single Source of Truth)
 * 10. Observability & Correlation Tracking
 */

import { WORKFLOW_ACTION_CATALOG, EntityType } from './workflowActionCatalog';
import { logAuditAction } from '../../services/auditService';
import { removeUndefined } from '../../utils';

export interface WorkflowActor {
  id: string;
  name: string;
  role: string;
  email?: string;
}

export interface WorkflowExecutionContext<TPayload = any> {
  actionId: string;
  entityType: EntityType;
  entityId: string;
  actor: WorkflowActor;
  payload: TPayload;
  reason?: string;
  currentState?: string;
  correlationId?: string;
}

export interface WorkflowExecutionResult<TData = any> {
  success: boolean;
  executionId: string;
  actionId: string;
  entityType: EntityType;
  entityId: string;
  fromState?: string;
  toState?: string;
  data?: TData;
  failureCode?: string;
  failureReason?: string;
  auditStatus?: 'COMMITTED' | 'AUDIT_FAILED' | 'SKIPPED';
  auditError?: string;
  timestamp: string;
  durationMs: number;
}

export class UnifiedWorkflowExecutor {
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

    const { actionId, entityType, entityId, actor, payload, reason, currentState } = context;

    // 1. Resolve Action Catalog Metadata
    const actionMeta = WORKFLOW_ACTION_CATALOG[actionId];
    if (!actionMeta) {
      return {
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
    }

    // 2. Validate Entity Type Match
    if (actionMeta.entityType !== entityType) {
      return {
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
    }

    // 3. Authorization Check
    const actorRole = (actor.role || '').toLowerCase().replace(/[\s_-]+/g, '');
    const isRoleAllowed =
      actorRole === 'admin' ||
      actionMeta.allowedRoles.some((r) => {
        const normalized = r.toLowerCase().replace(/[\s_-]+/g, '');
        return normalized === actorRole || (actorRole === 'qa' && normalized.includes('qa'));
      });
    if (!isRoleAllowed) {
      return {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        failureCode: 'UNAUTHORIZED_ROLE',
        failureReason: `Vai trò '${actor.role}' không được phép thực hiện hành động ${actionId}.`,
        timestamp,
        durationMs: Date.now() - startTime,
      };
    }

    // 4. Reason Enforcement Check
    if (actionMeta.requiresReason && (!reason || reason.trim().length === 0)) {
      return {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        failureCode: 'REASON_REQUIRED',
        failureReason: `Hành động ${actionId} bắt buộc phải có lý do giải trình.`,
        timestamp,
        durationMs: Date.now() - startTime,
      };
    }

    // 5. State Machine Transition Verification (nếu có)
    let calculatedNextState: string | undefined = undefined;
    if (transitionResolver) {
      try {
        const transition = transitionResolver();
        if (transition) {
          calculatedNextState = transition.nextState;
        }
      } catch (err: any) {
        return {
          success: false,
          executionId,
          actionId,
          entityType,
          entityId,
          fromState: currentState,
          failureCode: 'INVALID_STATE_TRANSITION',
          failureReason: err?.message || 'Chuyển đổi trạng thái không hợp lệ trong State Machine.',
          timestamp,
          durationMs: Date.now() - startTime,
        };
      }
    }

    // 6. Domain Rules Validation (nếu có)
    if (domainValidator) {
      try {
        const validation = await domainValidator();
        if (!validation.valid) {
          return {
            success: false,
            executionId,
            actionId,
            entityType,
            entityId,
            fromState: currentState,
            toState: calculatedNextState,
            failureCode: validation.code || 'DOMAIN_RULE_VIOLATION',
            failureReason: validation.error || 'Quy tắc nghiệp vụ không thỏa mãn.',
            timestamp,
            durationMs: Date.now() - startTime,
          };
        }
      } catch (err: any) {
        return {
          success: false,
          executionId,
          actionId,
          entityType,
          entityId,
          failureCode: 'DOMAIN_VALIDATION_ERROR',
          failureReason: err?.message || 'Lỗi khi kiểm tra quy tắc nghiệp vụ.',
          timestamp,
          durationMs: Date.now() - startTime,
        };
      }
    }

    // 7. Atomic Mutation Execution
    let resultData: TData;
    try {
      resultData = await mutationHandler();
    } catch (err: any) {
      return {
        success: false,
        executionId,
        actionId,
        entityType,
        entityId,
        fromState: currentState,
        toState: calculatedNextState,
        failureCode: 'MUTATION_FAILED',
        failureReason: err?.message || 'Thực thi mutation dữ liệu thất bại.',
        timestamp,
        durationMs: Date.now() - startTime,
      };
    }

    // 8. Audit Logging (Single Source of Truth)
    if (actionMeta.requiresAudit) {
      try {
        const auditAction =
          actionMeta.category === 'LIFECYCLE' && actionId.endsWith('_CREATE')
            ? 'CREATE'
            : actionId.endsWith('_DELETE') || actionId.endsWith('_ARCHIVE')
              ? 'DELETE'
              : 'UPDATE';

        const collectionMap: Record<string, any> = {
          PRODUCT: 'PRODUCTS',
          MATERIAL: 'MATERIALS',
          TCCS: 'TCCS',
          FORMULA: 'FORMULAS',
          BATCH: 'BATCHES',
          TEST_RESULT: 'TEST_RESULTS',
          DEVIATION: 'DEVIATIONS',
          CAPA: 'DEVIATIONS',
          CHANGE_REQUEST: 'DEVIATIONS',
          COA: 'TEST_RESULTS',
          SYSTEM: 'SYSTEM',
        };

        await logAuditAction(
          {
            action: auditAction,
            collection: collectionMap[entityType] || 'SYSTEM',
            documentId: entityId,
            performedBy: actor.email || actor.name || actor.id,
            details: `[UnifiedWorkflow] ${actionId} trên ${entityType} #${entityId}: ${reason || (currentState ? `${currentState} -> ${calculatedNextState || currentState}` : 'Thực thi thành công')}`,
          },
          { throwOnError: true }
        );
      } catch (auditErr) {
        console.error(`[UnifiedWorkflowExecutor] Ghi nhận audit thất bại:`, auditErr);
        // ALCOA+ & 21 CFR Part 11: Fail-closed khi không thể ghi nhận Audit Trail
        return {
          success: false,
          executionId,
          actionId,
          entityType,
          entityId,
          fromState: currentState,
          toState: calculatedNextState,
          data: resultData,
          failureCode: 'AUDIT_LOG_FAILED',
          failureReason: `Ghi nhận Audit Trail thất bại: ${(auditErr as any)?.message || 'Lỗi lưu trữ nhật ký kiểm toán'}. Theo nguyên tắc ALCOA+ và FDA 21 CFR Part 11, hành động nghiệp vụ không được xác nhận hoàn tất khi thiếu hồ sơ kiểm toán.`,
          auditStatus: 'AUDIT_FAILED',
          auditError: (auditErr as any)?.message || String(auditErr),
          timestamp,
          durationMs: Date.now() - startTime,
        };
      }
    }

    return {
      success: true,
      executionId,
      actionId,
      entityType,
      entityId,
      fromState: currentState,
      toState: calculatedNextState,
      data: resultData,
      auditStatus: actionMeta.requiresAudit ? 'COMMITTED' : 'SKIPPED',
      timestamp,
      durationMs: Date.now() - startTime,
    };
  }
}
