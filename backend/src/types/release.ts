/**
 * backend/src/types/release.ts
 * Type definitions for batch release operations
 */

export interface BatchReleaseRequestBody {
  batchId: string;
  signatureId: string;
  expectedVersion: number;
  idempotencyKey: string;
  correlationId?: string;
}

export interface BatchReleaseResponseBody {
  success: boolean;
  batchId: string;
  newVersion: number;
  status: 'RELEASED';
  releasedAt: string;
  idempotencyReplayed?: boolean;
  durationMs?: number;
  correlationId: string;
  commandId: string;
}
