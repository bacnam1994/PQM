/**
 * functions/src/releaseFunction.ts
 *
 * CANONICAL SERVER BATCH RELEASE COMMAND (Phase 5)
 *
 * Enforces:
 * 1. Authentication & Authorization (QA / ADMIN only)
 * 2. Transactional Idempotency Claim (PROCESSING -> COMPLETED / FAILED)
 * 3. Optimistic Concurrency Control (OCC) against expectedVersion
 * 4. Fresh DB reads for Batch, Signatures, TestResults, Deviations
 * 5. Single Canonical Release Engine (7 Gates + Canonical SHA-256 Checksum)
 * 6. Atomic Commit: Batch RELEASED, Signature CONSUMED, Command COMPLETED, Audit Log created
 * 7. Immutable ALCOA+ Historical Release Snapshot
 */

import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  CanonicalReleaseEngine,
  verifyCanonicalSignatureChecksum,
  ElectronicSignature,
  Batch,
  TestResult,
  QualityDeviation,
} from './canonicalReleaseEngine';

export interface BatchReleaseCommandRequest {
  idempotencyKey: string;
  batchId: string;
  expectedVersion: number;
  signatureId: string;
  correlationId?: string;
}

export interface BatchReleaseCommandResponse {
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

/**
 * Execute server-authoritative Batch Release Command
 */
export async function executeBatchReleaseBackend(
  data: BatchReleaseCommandRequest,
  authContext: { uid: string; token?: any },
  db: admin.database.Database
): Promise<BatchReleaseCommandResponse> {
  const startTime = Date.now();
  const correlationId =
    data.correlationId || `rel-corr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // 1. Authentication & Authorization
  if (!authContext || !authContext.uid) {
    throw new HttpsError('unauthenticated', 'Yêu cầu đăng nhập trước khi thực hiện xuất xưởng.');
  }

  const callerUid = authContext.uid;

  // Retrieve user role
  let callerRole = authContext.token?.role;
  let callerEmail = authContext.token?.email;
  if (!callerRole) {
    const userSnap = await db.ref(`/users/${callerUid}`).once('value');
    const userData = userSnap.val();
    callerRole = userData?.role;
    callerEmail = callerEmail || userData?.email;
  }

  if (callerRole !== 'QA' && callerRole !== 'ADMIN') {
    throw new HttpsError(
      'permission-denied',
      `Chỉ bộ phận QA hoặc Quản trị viên (ADMIN) mới có thẩm quyền xuất xưởng (Role hiện tại: ${callerRole || 'UNKNOWN'}).`
    );
  }

  // 2. Validate Input
  const { idempotencyKey, batchId, expectedVersion, signatureId } = data;
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new HttpsError('invalid-argument', 'Thiếu idempotencyKey hợp lệ.');
  }
  if (!batchId || typeof batchId !== 'string') {
    throw new HttpsError('invalid-argument', 'Thiếu batchId hợp lệ.');
  }
  if (typeof expectedVersion !== 'number' || expectedVersion < 1) {
    throw new HttpsError('invalid-argument', 'expectedVersion không hợp lệ.');
  }
  if (!signatureId || typeof signatureId !== 'string') {
    throw new HttpsError('invalid-argument', 'Thiếu signatureId hợp lệ.');
  }

  const commandRef = db.ref(`/release_commands/${idempotencyKey}`);

  // 3. Transactionally Claim Idempotency Key
  const claimResult = await commandRef.transaction((current) => {
    if (current === null) {
      return {
        commandId: idempotencyKey,
        correlationId,
        batchId,
        actorUid: callerUid,
        status: 'PROCESSING',
        createdAt: startTime,
      };
    }
    // Record already exists; abort mutation inside transaction
    return undefined;
  });

  if (!claimResult.committed) {
    // Read existing record to decide between replay or in-progress conflict
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
      throw new HttpsError(
        'already-exists',
        'Lệnh xuất xưởng đang được xử lý (PROCESSING). Vui lòng đợi hoặc thử lại sau.'
      );
    }

    // If FAILED, record new attempt
    await commandRef.set({
      commandId: idempotencyKey,
      correlationId,
      batchId,
      actorUid: callerUid,
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
      throw new HttpsError('not-found', `Không tìm thấy thông tin Lô sản xuất với ID: ${batchId}`);
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
      throw new HttpsError(
        'aborted',
        `CONCURRENCY_CONFLICT: Phiên bản lô không khớp (mong đợi: v${expectedVersion}, hiện tại trên server: v${currentVersion}). Vui lòng tải lại dữ liệu mới nhất.`
      );
    }

    // State Machine Check
    if (batch.status === 'RELEASED') {
      await commandRef.update({
        status: 'FAILED',
        failureCode: 'ALREADY_RELEASED',
        failedAt: Date.now(),
      });
      throw new HttpsError('failed-precondition', 'Lô sản xuất đã ở trạng thái RELEASED.');
    }
    if (batch.status !== 'TESTING') {
      await commandRef.update({
        status: 'FAILED',
        failureCode: 'INVALID_STATUS',
        failedAt: Date.now(),
      });
      throw new HttpsError(
        'failed-precondition',
        `Lô phải ở trạng thái TESTING trước khi xuất xưởng (trạng thái hiện tại: ${batch.status}).`
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
      throw new HttpsError(
        'failed-precondition',
        'ERR_SIGNATURE_MISSING: Không tìm thấy bản ghi chữ ký số trên hệ thống.'
      );
    }

    if (signature.status && signature.status !== 'CREATED') {
      await commandRef.update({
        status: 'FAILED',
        failureCode: 'SIGNATURE_NOT_CREATED',
        failedAt: Date.now(),
      });
      throw new HttpsError(
        'failed-precondition',
        `ERR_SIGNATURE_NOT_ACTIVE: Chữ ký số không ở trạng thái sẵn sàng (trạng thái: ${signature.status}).`
      );
    }

    if (signature.documentId !== batchId) {
      await commandRef.update({
        status: 'FAILED',
        failureCode: 'ERR_SIGNATURE_MISMATCH',
        failedAt: Date.now(),
      });
      throw new HttpsError(
        'invalid-argument',
        'ERR_SIGNATURE_MISMATCH: ID tài liệu ký không khớp với ID lô sản xuất.'
      );
    }

    if (signature.signerUid && signature.signerUid !== callerUid) {
      await commandRef.update({
        status: 'FAILED',
        failureCode: 'ERR_SIGNATURE_ACTOR_MISMATCH',
        failedAt: Date.now(),
      });
      throw new HttpsError(
        'permission-denied',
        'ERR_SIGNATURE_ACTOR_MISMATCH: Người ký chữ ký số không khớp với người gửi lệnh xuất xưởng.'
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
      throw new HttpsError(
        'invalid-argument',
        'ERR_SIGNATURE_TAMPERED: Mã băm chữ ký điện tử không khớp với nội dung ký (Signature Integrity Verification Failed).'
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
      userRole: callerRole,
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
      throw new HttpsError(
        'failed-precondition',
        `Quy chuẩn GMP & Release Guard: ${releaseDecision.blockers.join('; ')}`
      );
    }

    // 8. Build ALCOA+ Immutable Snapshot
    const commitTimestamp = new Date().toISOString();
    const newVersion = currentVersion + 1;
    const releaseSnapshot = CanonicalReleaseEngine.buildHistoricalReleaseSnapshot({
      batch,
      decision: releaseDecision,
      signature,
      evaluatorUid: callerUid,
      evaluatedAt: commitTimestamp,
    });

    const auditId = `AUD-BATCH-${batchId}-RELEASE-${Date.now()}`;

    const commandResponse: BatchReleaseCommandResponse = {
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
    updates[`/batches/${batchId}/releasedBy`] = callerUid;
    updates[`/batches/${batchId}/releaseSnapshot`] = releaseSnapshot;
    updates[`/batches/${batchId}/releaseCommandId`] = idempotencyKey;
    updates[`/batches/${batchId}/updatedAt`] = commitTimestamp;

    // Signature consumed
    updates[`/electronic_signatures/${signatureId}/status`] = 'CONSUMED';
    updates[`/electronic_signatures/${signatureId}/consumedAt`] = commitTimestamp;
    updates[`/electronic_signatures/${signatureId}/consumedBy`] = callerUid;
    updates[`/electronic_signatures/${signatureId}/consumedInBatchVersion`] = newVersion;

    // Release command completed
    updates[`/release_commands/${idempotencyKey}`] = {
      commandId: idempotencyKey,
      correlationId,
      batchId,
      actorUid: callerUid,
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
      actorUid: callerUid,
      actorRole: callerRole,
      actorEmail: callerEmail || 'system',
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
    if (err instanceof HttpsError) {
      throw err;
    }
    // Update command record as FAILED on unexpected DB or system errors
    await commandRef
      .update({
        status: 'FAILED',
        failureCode: 'DATABASE_FAILURE',
        failedAt: Date.now(),
        errorMessage: err?.message || 'Lỗi hệ thống khi commit xuất xưởng',
      })
      .catch(() => {});

    console.error(`[executeBatchReleaseBackend] Error:`, err);
    throw new HttpsError(
      'internal',
      err?.message || 'Lỗi giao dịch máy chủ khi xử lý xuất xưởng Lô.'
    );
  }
}
