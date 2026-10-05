/**
 * src/services/releaseCommandPort.ts
 *
 * CANONICAL RELEASE COMMAND PORT & CLOUD FUNCTIONS ADAPTER
 *
 * In accordance with Hexagonal Architecture:
 * - Production UI/Application Service calls IReleaseCommandPort.
 * - Production implementation calls Firebase Cloud Function `approveBatchRelease`.
 * - Test suites can inject an in-memory/mock adapter without polluting production logic.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase';

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

/**
 * Production Cloud Functions Implementation of Release Command
 */
export class CloudFunctionsReleaseCommandAdapter implements IReleaseCommandPort {
  private functionsInstance: ReturnType<typeof getFunctions>;

  constructor(region?: string) {
    this.functionsInstance = getFunctions(app, region || 'asia-southeast1');
  }

  async executeRelease(input: BatchReleaseCommandInput): Promise<BatchReleaseCommandOutput> {
    const callable = httpsCallable<BatchReleaseCommandInput, BatchReleaseCommandOutput>(
      this.functionsInstance,
      'approveBatchRelease'
    );

    const response = await callable(input);
    return response.data;
  }
}

// Canonical Singleton for production release command execution
let activeReleaseCommandPort: IReleaseCommandPort = new CloudFunctionsReleaseCommandAdapter();

export function getReleaseCommandPort(): IReleaseCommandPort {
  return activeReleaseCommandPort;
}

export function setReleaseCommandPort(port: IReleaseCommandPort): void {
  activeReleaseCommandPort = port;
}
