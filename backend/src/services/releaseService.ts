/**
 * backend/src/services/releaseService.ts
 * Server-Authoritative Batch Release Engine
 *
 * Enforces:
 * 1. Authentication & Authorization (QA / ADMIN only)
 * 2. Transactional Idempotency Claim (PROCESSING -> COMPLETED / FAILED)
 * 3. Optimistic Concurrency Control (OCC) against expectedVersion
 * 4. Fresh DB reads for Batch, Signatures, TestResults, Deviations
 * 5. Single Canonical Release Engine (7 Gates + NIST SHA-256 Checksum)
 * 6. Atomic Multi-path Commit: Batch RELEASED, Signature CONSUMED, Command COMPLETED, Audit Log
 * 7. Immutable ALCOA+ Historical Release Snapshot
 */

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
import { BatchReleaseRequestBody, BatchReleaseResponseBody } from '../types/release';
import { AppError } from '../utils/errors';

export class ServerReleaseService {
  async approveRelease(
    user: AuthenticatedUser,
    input: BatchReleaseRequestBody,
    correlationId: string,
    db: admin.database.Database
  ): Promise<BatchReleaseResponseBody> {
    const startTime = Date.now();

    // 1. Role Authorization Check
    if (user.role !== 'QA' && !user.isAdmin) {
      throw new AppError(
        'PERMISSION_DENIED',
        `Chỉ bộ phận QA hoặc Quản trị viên (ADMIN) mới có thẩm quyền xuất xưởng (Role hiện tại: ${user.role}).`,
        403
      );
    }

    // 2. Input Validation
    const { idempotencyKey, batchId, expectedVersion, signatureId } = input;
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Thiếu idempotencyKey hợp lệ.', 400);
    }
    if (!batchId || typeof batchId !== 'string' || !batchId.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Thiếu batchId hợp lệ.', 400);
    }
    if (typeof expectedVersion !== 'number' || expectedVersion < 1) {
      throw new AppError(
        'VALIDATION_ERROR',
        'expectedVersion không hợp lệ (phải là số nguyên >= 1).',
        400
      );
    }
    if (!signatureId || typeof signatureId !== 'string' || !signatureId.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Thiếu signatureId hợp lệ.', 400);
    }

    const commandRef = db.ref(`/release_commands/${idempotencyKey}`);

    // 3. Transactionally Claim Idempotency Key
    const claimResult = await commandRef.transaction((current) => {
      if (current === null) {
        return {
          commandId: idempotencyKey,
          correlationId,
          batchId,
          actorUid: user.uid,
          status: 'PROCESSING',
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
        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          'Lệnh xuất xưởng đang được xử lý (PROCESSING). Vui lòng đợi hoặc thử lại sau.',
          409
        );
      }

      // If FAILED, mark as new attempt
      await commandRef.set({
        commandId: idempotencyKey,
        correlationId,
        batchId,
        actorUid: user.uid,
        status: 'PROCESSING',
        createdAt: startTime,
        retryOf: existing?.failedAt || startTime,
      });
    }

    try {
      // 4. Fresh Database Reads
      const [batchSnap, sigSnap, testResultsSnap, deviationsSnap] = await Promise.all([
        db.ref(`/batches/${batchId}`).once('value'),
        db.ref(`/electronic_signatures/${signatureId}`).once('value'),
        db.ref('/testResults').orderByChild('batchId').equalTo(batchId).once('value'),
        db.ref('/quality_deviations').orderByChild('batchId').equalTo(batchId).once('value'),
      ]);

      const batch = batchSnap.val() as Batch | null;
      if (!batch) {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'BATCH_NOT_FOUND',
          failedAt: Date.now(),
        });
        throw new AppError(
          'BATCH_NOT_FOUND',
          `Không tìm thấy thông tin Lô sản xuất với ID: ${batchId}`,
          404
        );
      }

      // 5. Optimistic Concurrency Control (OCC)
      const currentVersion = batch.version ?? 1;
      if (currentVersion !== expectedVersion) {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'OCC_CONFLICT',
          failedAt: Date.now(),
          expectedVersion,
          actualVersion: currentVersion,
        });
        throw new AppError(
          'VERSION_CONFLICT',
          `CONCURRENCY_CONFLICT: Phiên bản lô không khớp (mong đợi: v${expectedVersion}, hiện tại trên server: v${currentVersion}). Vui lòng tải lại dữ liệu mới nhất.`,
          409
        );
      }

      // State Machine Check
      if (batch.status === 'RELEASED') {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'ALREADY_RELEASED',
          failedAt: Date.now(),
        });
        throw new AppError('BATCH_STATE_INVALID', 'Lô sản xuất đã ở trạng thái RELEASED.', 400);
      }
      if (batch.status !== 'TESTING') {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'INVALID_STATUS',
          failedAt: Date.now(),
        });
        throw new AppError(
          'BATCH_STATE_INVALID',
          `Lô phải ở trạng thái TESTING trước khi xuất xưởng (trạng thái hiện tại: ${batch.status}).`,
          400
        );
      }

      // 6. Signature Validation
      const signature = sigSnap.val() as ElectronicSignature | null;
      if (!signature) {
        await commandRef.update({
          status: 'FAILED',
          failureCode: 'SIGNATURE_NOT_FOUND',
          failedAt: Date.now(),
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
        });
        throw new AppError(
          'VALIDATION_ERROR',
          `Quy chuẩn GMP & Release Guard: ${releaseDecision.blockers.join('; ')}`,
          400
        );
      }

      // 8. Build ALCOA+ Immutable Snapshot
      const commitTimestamp = new Date().toISOString();
      const newVersion = currentVersion + 1;
      const releaseSnapshot = CanonicalReleaseEngine.buildHistoricalReleaseSnapshot({
        batch,
        decision: releaseDecision,
        signature,
        evaluatorUid: user.uid,
        evaluatedAt: commitTimestamp,
      });

      const auditId = `AUD-BATCH-${batchId}-RELEASE-${Date.now()}`;

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

      // Batch updates
      updates[`/batches/${batchId}/status`] = 'RELEASED';
      updates[`/batches/${batchId}/version`] = newVersion;
      updates[`/batches/${batchId}/releasedAt`] = commitTimestamp;
      updates[`/batches/${batchId}/releasedBy`] = user.uid;
      updates[`/batches/${batchId}/releaseSnapshot`] = releaseSnapshot;
      updates[`/batches/${batchId}/releaseCommandId`] = idempotencyKey;
      updates[`/batches/${batchId}/updatedAt`] = commitTimestamp;

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
          version: currentVersion,
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

      // ATOMIC WRITE
      await db.ref().update(updates);

      return {
        ...commandResponse,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }

      await commandRef
        .update({
          status: 'FAILED',
          failureCode: 'DATABASE_FAILURE',
          failedAt: Date.now(),
          errorMessage: err?.message || 'Lỗi hệ thống khi commit xuất xưởng',
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
