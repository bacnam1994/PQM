/**
 * src/services/releaseCommandPort.ts
 *
 * CANONICAL RELEASE COMMAND PORT & HTTP BACKEND ADAPTER
 *
 * In accordance with Hexagonal Architecture:
 * - Production UI/Application Service calls IReleaseCommandPort.
 * - Production implementation calls external Server Authority POST /api/batch-release/approve.
 * - Preserves Firebase Spark Free tier by eliminating Cloud Functions.
 * - Test suites can inject an in-memory/mock adapter without polluting production logic.
 */

import { getAuth } from 'firebase/auth';

export interface BatchReleaseCommandInput {
  batchId: string;
  expectedVersion: number;
  signatureId: string;
  idempotencyKey: string;
  correlationId?: string;
}

export interface BatchReleaseCommandOutput {
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

export interface IReleaseCommandPort {
  executeRelease(input: BatchReleaseCommandInput): Promise<BatchReleaseCommandOutput>;
}

const BACKEND_API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_API_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_BACKEND_API_URL) ||
  'http://localhost:4000';

/**
 * Production HTTP Backend Implementation of Release Command
 */
export class HttpReleaseCommandAdapter implements IReleaseCommandPort {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || BACKEND_API_URL;
  }

  async executeRelease(input: BatchReleaseCommandInput): Promise<BatchReleaseCommandOutput> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : '';

    const correlationId =
      input.correlationId || `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const response = await fetch(`${this.baseUrl}/api/batch-release/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({
        batchId: input.batchId,
        expectedVersion: input.expectedVersion,
        signatureId: input.signatureId,
        idempotencyKey: input.idempotencyKey,
        correlationId,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'Lỗi xuất xưởng lô trên máy chủ.');
    }

    return data;
  }
}

// Backward-compatible alias
export const CloudFunctionsReleaseCommandAdapter = HttpReleaseCommandAdapter;

// Canonical Singleton for production release command execution
let activeReleaseCommandPort: IReleaseCommandPort = new HttpReleaseCommandAdapter();

export function getReleaseCommandPort(): IReleaseCommandPort {
  return activeReleaseCommandPort;
}

export function setReleaseCommandPort(port: IReleaseCommandPort): void {
  activeReleaseCommandPort = port;
}
