/**
 * LEGACY SERVICE ADAPTER
 *
 * Cầu nối chuyển tiếp giữa các App Services cũ và WorkflowFacade:
 * - Bảo toàn 100% chữ ký hàm, đối số và phản hồi cũ
 * - Chuyển đường dẫn thực thi ngầm qua WorkflowFacade.dispatch()
 * - Đảm bảo mọi mutation đều được kiểm soát RBAC, OCC, Reason và ALCOA+ Audit
 */

import { WorkflowFacade } from '../WorkflowFacade';
import { WorkflowActionId, EntityType, WorkflowActor } from '../contracts/actions';

export class LegacyServiceAdapter {
  /**
   * Bọc một thao tác mutation cũ để điều phối qua WorkflowFacade
   */
  public static async executeWithWorkflow<TData = any>(
    actionId: WorkflowActionId,
    entityType: EntityType,
    entityId: string,
    currentUser: any,
    mutationHandler: () => Promise<TData>,
    options?: {
      reason?: string;
      signature?: any;
      confirmationToken?: string;
      expectedVersion?: number;
      currentState?: string;
      domainValidator?: () => Promise<{ valid: boolean; error?: string; code?: string }>;
      transitionResolver?: () => { nextState: string } | null;
    }
  ): Promise<TData> {
    const actor: WorkflowActor = {
      id: currentUser?.id || currentUser?.uid || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || 'Unknown User',
      role: (currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'USER')).toUpperCase(),
      email: currentUser?.email,
    };

    const result = await WorkflowFacade.dispatch(
      {
        actionId,
        entityType,
        entityId,
        actor,
        payload: {},
        reason: options?.reason,
        signature: options?.signature,
        confirmationToken: options?.confirmationToken,
        expectedVersion: options?.expectedVersion,
        currentState: options?.currentState,
      },
      mutationHandler,
      options?.domainValidator,
      options?.transitionResolver
    );

    if (!result.success) {
      throw new Error(result.failureReason || `Thao tác ${actionId} thất bại qua Workflow Kernel.`);
    }

    return result.data as TData;
  }
}
