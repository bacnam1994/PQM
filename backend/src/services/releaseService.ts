/**
 * backend/src/services/releaseService.ts
 * Server-Authoritative Batch Release Engine
 *
 * Enforces:
 * 1. Authentication & Authorization (QA / ADMIN only)
 * 2. Atomic Lease-based Idempotency Claim (PROCESSING with leaseExpiresAt -> COMPLETED / FAILED)
 * 3. Stale Processing Recovery (Detects orphaned PROCESSING and reclaims safely)
 * 4. True Atomic Optimistic Concurrency Control (OCC transaction on /batches/{batchId})
 * 5. Fresh DB reads for Batch, Signatures, TestResults, Deviations
 * 6. Single Canonical Release Engine (7 Gates + NIST SHA-256 Checksum)
 * 7. Atomic Multi-path Commit: Batch RELEASED, Signature CONSUMED, Command COMPLETED, Audit Log
 * 8. Consistent Failure Logging on /release_commands/{idempotencyKey}
 */

import crypto from 'crypto';
import * as admin from 'firebase-admin';
import {
  CanonicalReleaseEngine,
  verifyCanonicalSignatureChecksum,
  ElectronicSignature,
  Batch,
  TestResult,
  QualityDeviation,
} from '@pqm/release-engine';
import { AuthenticatedUser } from '../middleware/auth';
import {
  batchReleaseSchema,
  BatchReleaseRequestBody,
  BatchReleaseResponseBody,
} from '../types/release';
import { AppError } from '../utils/errors';

export class ServerReleaseService {
  async approveRelease(
    user: AuthenticatedUser,
    rawInput: unknown,
    correlationId: string,
    db: admin.database.Database
  ): Promise<BatchReleaseResponseBody> {
    const startTime = Date.now();
    const LEASE_DURATION_MS = 60000; // 60 seconds lease

    // 1. Role Authorization Check
    if (user.role !== 'QA' && !user.isAdmin) {
      throw new AppError(
        'PERMISSION_DENIED',
        `Chỉ bộ phận QA hoặc Quản trị viên (ADMIN) mới có thẩm quyền xuất xưởng (Role hiện tại: ${user.role}).`,
        403
      );
    }

    // 2. Strict Boundary Input Validation with Zod (Phase 12)
    const parseResult = batchReleaseSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      const message = `${firstIssue.path.join('.') || 'input'}: ${firstIssue.message}`;
      throw new AppError(
        'VALIDATION_ERROR',
        `Dữ liệu lệnh xuất xưởng không hợp lệ: ${message}`,
        400
      );
    }

    const input: BatchReleaseRequestBody = parseResult.data;
    const { idempotencyKey, batchId, expectedVersion, signatureId } = input;
    const commandRef = db.ref(`/release_commands/${idempotencyKey}`);
    const batchRef = db.ref(`/batches/${batchId}`);

    // 3. Phase 4: Transactionally Claim Idempotency Key with Lease Expiration
    let commandReclaimed = false;
    const claimResult = await commandRef.transaction((current) => {
      if (current === null) {
        return {
          commandId: idempotencyKey,
          correlationId,
          batchId,
          actorUid: user.uid,
          status: 'PROCESSING',
          processingStartedAt: startTime,
          leaseExpiresAt: startTime + LEASE_DURATION_MS,
          createdAt: startTime,
        };
      }
      return undefined;
    });

    if (!claimResult.committed) {
      const existingSnap = await commandRef.once('value');
      const existing = existingSnap.val();

      if (existing?.status === 'COMPLETED' && existing.result) {
        return {
          ...existing.result,
          idempotencyReplayed: true,
          durationMs: Date.now() - startTime,
        };
      }

      if (existing?.status === 'PROCESSING') {
        const isLeaseActive = startTime <= (existing.leaseExpiresAt ?? 0);
        if (isLeaseActive) {
          throw new AppError(
            'IDEMPOTENCY_CONFLICT',
            'Lệnh xuất xưởng đang được xử lý (PROCESSING). Vui lòng đợi hoặc thử lại sau.',
            409
          );
        }

        // Stale lease detected! Inspect batch status before deciding
        const staleBatchSnap = await batchRef.once('value');
        const staleBatch = staleBatchSnap.val();

        if (staleBatch?.status === 'RELEASED' && staleBatch.releaseCommandId === idempotencyKey) {
          // Batch was actually released in prior attempt: return existing result
          if (existing.result) {
            return {
              ...existing.result,
              idempotencyReplayed: true,
              durationMs: Date.now() - startTime,
            };
          }
        }

        // Batch not released: safely reclaim command with renewed lease
        commandReclaimed = true;
        await commandRef.update({
          status: 'PROCESSING',
          processingStartedAt: startTime,
          leaseExpiresAt: startTime + LEASE_DURATION_MS,
          reclaimedAt: startTime,
          reclaimedBy: user.uid,
          correlationId,
        });
      } else {
        // Status is FAILED: allow retry with renewed lease
        await commandRef.set({
          commandId: idempotencyKey,
          correlationId,
          batchId,
          actorUid: user.uid,
          status: 'PROCESSING',
          processingStartedAt: startTime,
          leaseExpiresAt: startTime + LEASE_DURATION_MS,
          createdAt: startTime,
          retryOf: existing?.failedAt || startTime,
        });
      }
    }

    let batchLockHeld = false;

    try {
      // 4. Phase 3: True Atomic Optimistic Concurrency Control (OCC) Claim on /batches/{batchId}
      let versionConflictDetected = false;
      let actualVersionOnServer = 1;
      let batchNotFound = false;
      let batchStatusInvalid: string | null = null;
      let activeLockHeldByOther = false;

      const claimBatchResult = await batchRef.transaction((currentBatch) => {
        if (currentBatch === null) {
          batchNotFound = true;
          return undefined;
        }

        const currentVersion = currentBatch.version ?? 1;
        if (currentVersion !== expectedVersion) {
          versionConflictDetected = true;
          actualVersionOnServer = currentVersion;
          return undefined;
        }

        if (currentBatch.status === 'RELEASED') {
          versionConflictDetected = true;
          actualVersionOnServer = currentVersion;
          return undefined;
        }

        if (currentBatch.status !== 'TESTING') {
          batchStatusInvalid = currentBatch.status;
          return undefined;
        }

        // Check if an active release lock is held by another command
        if (currentBatch.releaseLock) {
          const lock = currentBatch.releaseLock;
          const isLockActive = startTime <= (lock.leaseExpiresAt ?? 0);
          if (isLockActive && lock.commandId !== idempotencyKey) {
            activeLockHeldByOther = true;
            return undefined;
          }
        }

        // Atomically claim release lock on batch
        currentBatch.releaseLock = {
          commandId: idempotencyKey,
          claimedBy: user.uid,
          claimedAt: startTime,
          leaseExpiresAt: startTime + LEASE_DURATION_MS,
          expectedVersion,
        };

        return currentBatch;
      });

      if (!claimBatchResult.committed) {
        if (versionConflictDetected || activeLockHeldByOther) {
          await commandRef.update({
            status: 'FAILED',
            failureCode: 'OCC_CONFLICT',
            failedAt: Date.now(),
            expectedVersion,
            actualVersion: actualVersionOnServer,
            correlationId,
          });
          throw new AppError(
            'VERSION_CONFLICT',
            `CONCURRENCY_CONFLICT: Phiên bản lô không khớp hoặc đang có lệnh xuất xưởng đồng thời (mong đợi: v${expectedVersion}, hiện tại trên server: v${actualVersionOnServer}). Vui lòng tải lại dữ liệu mới nhất.`,
            409
          );
        }

        if (batchNotFound) {
          await commandRef.update({
            status: 'FAILED',
            failureCode: 'BATCH_NOT_FOUND',
            failedAt: Date.now(),
            correlationId,
          });
          throw new AppError(
            'BATCH_NOT_FOUND',
            `Không tìm thấy thông tin Lô sản xuất với ID: ${batchId}`,
            404
          );
        }

        if (batchStatusInvalid === 'RELEASED') {
          await commandRef.update({
            status: 'FAILED',
            failureCode: 'ALREADY_RELEASED',
            failedAt: Date.now(),
            correlationId,
          });
          throw new AppError('BATCH_STATE_INVALID', 'Lô sản xuất đã ở trạng thái RELEASED.', 400);
        }

        if (batchStatusInvalid) {
          await commandRef.update({
            status: 'FAILED',
            failureCode: 'INVALID_STATUS',
            failedAt: Date.now(),
            correlationId,
          });
          throw new AppError(
            'BATCH_STATE_INVALID',
            `Lô phải ở trạng thái TESTING trước khi xuất xưởng (trạng thái hiện tại: ${batchStatusInvalid}).`,
            400
          );
        }

        // Generic OCC conflict fallback
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'OCC_CONFLICT',
          failedAt: Date.now(),
          correlationId,
        });
        throw new AppError(
          'VERSION_CONFLICT',
          `CONCURRENCY_CONFLICT: Không thể khóa Lô xuất xưởng. Vui lòng tải lại dữ liệu mới nhất.`,
          409
        );
      }

      batchLockHeld = true;

      // 5. Fresh Database Reads for Related Records
      const [batchSnap, sigSnap, testResultsSnap, deviationsSnap] = await Promise.all([
        batchRef.once('value'),
        db.ref(`/electronic_signatures/${signatureId}`).once('value'),
        db.ref('/testResults').orderByChild('batchId').equalTo(batchId).once('value'),
        db.ref('/quality_deviations').orderByChild('batchId').equalTo(batchId).once('value'),
      ]);

      const batch = batchSnap.val() as Batch;

      // 6. Signature Validation
      const signature = sigSnap.val() as ElectronicSignature | null;
      if (!signature) {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'SIGNATURE_NOT_FOUND',
          failedAt: Date.now(),
          correlationId,
        });
        throw new AppError(
          'SIGNATURE_INVALID',
          'ERR_SIGNATURE_MISSING: Không tìm thấy bản ghi chữ ký số trên hệ thống.',
          400
        );
      }

      if (signature.status && signature.status !== 'CREATED') {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'SIGNATURE_NOT_CREATED',
          failedAt: Date.now(),
          correlationId,
        });
        throw new AppError(
          'SIGNATURE_CONSUMED',
          `ERR_SIGNATURE_NOT_ACTIVE: Chữ ký số không ở trạng thái sẵn sàng (trạng thái: ${signature.status}).`,
          400
        );
      }

      if (signature.documentId !== batchId) {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'ERR_SIGNATURE_MISMATCH',
          failedAt: Date.now(),
          correlationId,
        });
        throw new AppError(
          'SIGNATURE_INVALID',
          'ERR_SIGNATURE_MISMATCH: ID tài liệu ký không khớp với ID lô sản xuất.',
          400
        );
      }

      if (signature.signerUid && signature.signerUid !== user.uid) {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'ERR_SIGNATURE_ACTOR_MISMATCH',
          failedAt: Date.now(),
          correlationId,
        });
        throw new AppError(
          'PERMISSION_DENIED',
          'ERR_SIGNATURE_ACTOR_MISMATCH: Người ký chữ ký số không khớp với người gửi lệnh xuất xưởng.',
          403
        );
      }

      // Exact Canonical SHA-256 Checksum Verification
      const isChecksumValid = verifyCanonicalSignatureChecksum(signature);
      if (!isChecksumValid) {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'ERR_SIGNATURE_TAMPERED',
          failedAt: Date.now(),
          correlationId,
        });
        throw new AppError(
          'CHECKSUM_MISMATCH',
          'ERR_SIGNATURE_TAMPERED: Mã băm chữ ký điện tử không khớp với nội dung ký (Signature Integrity Verification Failed).',
          400
        );
      }

      // Collect related records
      const testResults: TestResult[] = [];
      if (testResultsSnap.exists()) {
        testResultsSnap.forEach((child) => {
          testResults.push({ ...child.val(), id: child.key });
        });
      }

      const deviations: QualityDeviation[] = [];
      if (deviationsSnap.exists()) {
        deviationsSnap.forEach((child) => {
          deviations.push({ ...child.val(), id: child.key });
        });
      }

      // 7. Canonical 7 Release Gates Evaluation
      const releaseDecision = CanonicalReleaseEngine.evaluateReleaseDecision({
        batch,
        testResults,
        deviations,
        signature,
        userRole: user.role,
      });

      if (!releaseDecision.eligible) {
        const primaryBlocker = releaseDecision.blockers[0] || 'ERR_RELEASE_GATE_FAILED';
        await commandRef.update({
          status: 'FAILED',
          failureCode: primaryBlocker,
          failedAt: Date.now(),
          blockers: releaseDecision.blockers,
          gates: releaseDecision.gates,
          correlationId,
        });
        throw new AppError(
          'VALIDATION_ERROR',
          `Quy chuẩn GMP & Release Guard: ${releaseDecision.blockers.join('; ')}`,
          400
        );
      }

      // 8. Build ALCOA+ Immutable Snapshot
      const commitTimestamp = new Date().toISOString();
      const newVersion = expectedVersion + 1;
      const releaseSnapshot = CanonicalReleaseEngine.buildHistoricalReleaseSnapshot({
        batch,
        decision: releaseDecision,
        signature,
        evaluatorUid: user.uid,
        evaluatedAt: commitTimestamp,
      });

      // Phase 13: Collision-safe UUID for audit
      const auditId = `AUD-BATCH-${batchId}-RELEASE-${crypto.randomUUID()}`;

      const commandResponse: BatchReleaseResponseBody = {
        success: true,
        batchId,
        newVersion,
        status: 'RELEASED',
        releasedAt: commitTimestamp,
        correlationId,
        commandId: idempotencyKey,
      };

      // 9. Atomic Multi-path Commit
      const updates: Record<string, any> = {};

      // Batch updates (Releases the batch, updates version, and clears releaseLock)
      updates[`/batches/${batchId}/status`] = 'RELEASED';
      updates[`/batches/${batchId}/version`] = newVersion;
      updates[`/batches/${batchId}/releasedAt`] = commitTimestamp;
      updates[`/batches/${batchId}/releasedBy`] = user.uid;
      updates[`/batches/${batchId}/releaseSnapshot`] = releaseSnapshot;
      updates[`/batches/${batchId}/releaseCommandId`] = idempotencyKey;
      updates[`/batches/${batchId}/updatedAt`] = commitTimestamp;
      updates[`/batches/${batchId}/releaseLock`] = null;

      // Signature consumed
      updates[`/electronic_signatures/${signatureId}/status`] = 'CONSUMED';
      updates[`/electronic_signatures/${signatureId}/consumedAt`] = commitTimestamp;
      updates[`/electronic_signatures/${signatureId}/consumedBy`] = user.uid;
      updates[`/electronic_signatures/${signatureId}/consumedInBatchVersion`] = newVersion;

      // Release command completed
      updates[`/release_commands/${idempotencyKey}`] = {
        commandId: idempotencyKey,
        correlationId,
        batchId,
        actorUid: user.uid,
        status: 'COMPLETED',
        expectedVersion,
        actualVersion: newVersion,
        completedAt: Date.now(),
        durationMs: Date.now() - startTime,
        result: commandResponse,
        gateResults: releaseDecision.gates,
      };

      // Server-only Audit Log
      updates[`/audit_logs/${auditId}`] = {
        eventId: auditId,
        timestamp: commitTimestamp,
        actorUid: user.uid,
        actorRole: user.role,
        actorEmail: user.email || 'system',
        action: 'BATCH_RELEASE_APPROVE',
        entityType: 'BATCH',
        entityId: batchId,
        previousState: {
          status: batch.status,
          version: expectedVersion,
        },
        newState: {
          status: 'RELEASED',
          version: newVersion,
          releaseSnapshotId: releaseSnapshot.snapshotId,
        },
        reason: 'Phê duyệt xuất xưởng Lô sản phẩm qua Server Release Engine',
        correlationId,
        commandId: idempotencyKey,
        signatureId,
      };

      // ATOMIC MULTI-LOCATION WRITE
      await db.ref().update(updates);

      return {
        ...commandResponse,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      // Phase 14: Release Error Consistency & Lock Cleanup
      if (batchLockHeld) {
        // Clear lock on batch so subsequent requests are not blocked
        await batchRef
          .child('releaseLock')
          .remove()
          .catch(() => {});
      }

      if (err instanceof AppError) {
        throw err;
      }

      await commandRef
        .update({
          status: 'FAILED',
          failureCode: 'DATABASE_FAILURE',
          failedAt: Date.now(),
          errorMessage: err?.message || 'Lỗi hệ thống khi commit xuất xưởng',
          correlationId,
        })
        .catch(() => {});

      console.error(`[ServerReleaseService][${correlationId}] Unexpected release error:`, err);
      throw new AppError(
        'INTERNAL',
        err?.message || 'Lỗi giao dịch máy chủ khi xử lý xuất xưởng Lô.',
        500
      );
    }
  }
}

export const serverReleaseService = new ServerReleaseService();
