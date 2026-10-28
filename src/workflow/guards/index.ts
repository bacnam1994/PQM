/**
 * WORKFLOW GUARDS (CANONICAL ENFORCEMENT)
 *
 * Xuất bản tập trung toàn bộ các rào chắn kiểm soát workflow:
 * 1. Authorization: RbacGuard
 * 2. Validation: ReasonGuard
 * 3. Integrity: SignatureGuard, OccGuard
 * 4. Security: DestructiveActionGuard
 * 5. State: StateMachineGuard
 */

import { WorkflowActionMetadata, WorkflowActor } from '../contracts/actions';
import { GuardResult, RbacGuard } from './authorization/rbacGuard';
import { ReasonGuard } from './validation/reasonGuard';
import { SignatureGuard } from './integrity/signatureGuard';
import { OccGuard } from './integrity/occGuard';
import { DestructiveActionGuard } from './security/destructiveActionGuard';
import { StateMachineGuard } from './state/stateMachineGuard';

export type { GuardResult };
export {
  RbacGuard,
  ReasonGuard,
  SignatureGuard,
  OccGuard,
  DestructiveActionGuard,
  StateMachineGuard,
};

/**
 * Lớp tổng hợp WorkflowGuards duy trì tính tương thích ngược toàn diện cho codebase.
 */
export class WorkflowGuards {
  public static verifyRBAC(actionMeta: WorkflowActionMetadata, actor: WorkflowActor): GuardResult {
    return RbacGuard.verify(actionMeta, actor);
  }

  public static verifyOCC(expectedVersion?: number, currentVersion?: number): GuardResult {
    return OccGuard.verify(expectedVersion, currentVersion);
  }

  public static verifyReason(actionMeta: WorkflowActionMetadata, reason?: string): GuardResult {
    return ReasonGuard.verify(actionMeta, reason);
  }

  public static verifySignature(actionMeta: WorkflowActionMetadata, signature?: any): GuardResult {
    return SignatureGuard.verify(actionMeta, signature);
  }

  public static verifyConfirmationToken(
    actionMeta: WorkflowActionMetadata,
    token?: string
  ): GuardResult {
    return DestructiveActionGuard.verify(actionMeta, token);
  }

  public static verifyTransition(
    currentState: string,
    actionId: string,
    transitionResolver?: () => { nextState: string } | null
  ): GuardResult & { nextState?: string } {
    return StateMachineGuard.verifyTransition(currentState, actionId, transitionResolver);
  }
}
