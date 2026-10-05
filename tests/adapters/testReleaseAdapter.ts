/**
 * tests/adapters/testReleaseAdapter.ts
 *
 * TEST ADAPTER FOR IReleaseCommandPort
 *
 * Allows test suites to execute release command simulation in-memory
 * without network requests to Firebase Cloud Functions, preserving the
 * exact rule: "Production code không được biết Vitest".
 */

import {
  IReleaseCommandPort,
  BatchReleaseCommandInput,
  BatchReleaseCommandOutput,
} from '../../src/services/releaseCommandPort';
import { IBatchRepository } from '../../src/repositories/BatchRepository';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';

export class InMemoryTestReleaseCommandAdapter implements IReleaseCommandPort {
  private repo: IBatchRepository;
  private handlers: BatchWorkflowHandlers;

  constructor(repo: IBatchRepository) {
    this.repo = repo;
    this.handlers = new BatchWorkflowHandlers(repo);
  }

  async executeRelease(input: BatchReleaseCommandInput): Promise<BatchReleaseCommandOutput> {
    const currentBatch = await this.repo.findById(input.batchId);
    if (!currentBatch) {
      throw new Error(`Không tìm thấy Lô sản xuất ID: ${input.batchId}`);
    }

    const testResults =
      typeof (this.repo as any).findTestResultsByBatchId === 'function'
        ? await (this.repo as any).findTestResultsByBatchId(input.batchId)
        : [];

    const mockActor = {
      id: 'test-qa-user',
      name: 'QA Tester',
      email: 'qa@pqm.com',
      role: 'QA',
    };

    const released = await this.handlers.handleStatusTransition(
      input.batchId,
      'RELEASED',
      mockActor,
      {
        currentBatch,
        batchTestResults: testResults,
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
      }
    );

    return {
      success: true,
      batchId: input.batchId,
      newVersion: released.version ?? input.expectedVersion + 1,
      status: 'RELEASED',
      releasedAt: released.releasedAt || new Date().toISOString(),
      correlationId: input.correlationId || 'test-corr',
      commandId: input.idempotencyKey,
    };
  }
}
