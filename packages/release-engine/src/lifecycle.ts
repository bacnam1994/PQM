/**
 * packages/release-engine/src/lifecycle.ts
 * ELECTRONIC SIGNATURE LIFECYCLE STATE MACHINE (Phase 4.5)
 *
 * ALLOWED TRANSITIONS:
 * CREATED -> CONSUMED
 * CREATED -> REJECTED
 * CREATED -> REVOKED
 * CREATED -> SUPERSEDED
 *
 * FORBIDDEN TRANSITIONS:
 * CONSUMED -> ANY
 * REVOKED -> ANY
 * REJECTED -> ANY
 * SUPERSEDED -> ANY
 */

import { SignatureStatus } from './types';

const VALID_TRANSITIONS: Record<SignatureStatus, SignatureStatus[]> = {
  CREATED: ['CONSUMED', 'REJECTED', 'REVOKED', 'SUPERSEDED'],
  CONSUMED: [],
  REJECTED: [],
  REVOKED: [],
  SUPERSEDED: [],
};

export function canTransitionSignature(
  fromStatus: SignatureStatus = 'CREATED',
  toStatus: SignatureStatus
): boolean {
  const allowedNext = VALID_TRANSITIONS[fromStatus] || [];
  return allowedNext.includes(toStatus);
}

export function assertValidSignatureTransition(
  signatureId: string,
  fromStatus: SignatureStatus = 'CREATED',
  toStatus: SignatureStatus
): void {
  if (!canTransitionSignature(fromStatus, toStatus)) {
    throw new Error(
      `ERR_SIGNATURE_LIFECYCLE_VIOLATION: Chữ ký (${signatureId}) không thể chuyển từ '${fromStatus}' sang '${toStatus}'. Trạng thái hiện tại đã bị niêm phong.`
    );
  }
}
