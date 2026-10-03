/**
 * functions/src/batchReleaseFunction.ts
 * =====================================
 * Canonical Server-Side Release Command: approveBatchRelease
 *
 * Thực thi thẩm định toàn diện 7 Cổng Kiểm Soát Xuất Xưởng Lô (Release Gates)
 * và chuyển trạng thái nguyên tử sang RELEASED trên Server (Firebase Admin SDK).
 *
 * Nguyên tắc kiến trúc:
 * 1. P0-1: Client cấm tự ghi trực tiếp status = RELEASED (khóa tại database.rules.json).
 * 2. P0-2: Single Release Path: Chỉ Cloud Function approveBatchRelease được phép tạo RELEASED.
 * 3. P0-3: Server SSoT: Dùng chung Canonical Release Decision Engine (evaluateCanonicalReleaseGates).
 * 4. P0-4: Gate 7 Signature Integrity: Exact SHA-256 recalculation, role check, status check.
 * 5. P0-5: Atomic Multi-Location Commit (Batch + Signature CONSUMED + Release Command + Audit Log).
 * 6. P0-6: Idempotency Key persistence (release_commands/{idempotencyKey}).
 */

import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import {
  evaluateCanonicalReleaseGates,
  computeSignatureSha256,
  ReleaseGateResult,
} from './canonicalReleaseEngine';

export interface ApproveBatchReleaseRequest {
  batchId: string;
  signatureId: string;
  expectedVersion?: number;
  idempotencyKey?: string;
  reason?: string;
}

export async function handleApproveBatchRelease(
  request: CallableRequest<ApproveBatchReleaseRequest>,
  db: admin.database.Database
) {
  // 1. P0-3: Xác thực Actor & Role
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Yêu cầu đăng nhập để thực hiện xuất xưởng lô.');
  }

  const callerUid = request.auth.uid;
  const token = request.auth.token || {};

  // Xác định role từ custom claims hoặc đọc /users/{uid}
  let userRole = (token.role as string) || '';
  const isAdmin = token.isAdmin === true || userRole === 'ADMIN';

  if (!userRole) {
    const userSnap = await db.ref(`users/${callerUid}`).once('value');
    if (userSnap.exists()) {
      const userData = userSnap.val();
      userRole = userData.role || '';
    }
  }

  const isAuthorized = isAdmin || userRole === 'ADMIN' || userRole === 'QA';
  if (!isAuthorized) {
    throw new HttpsError(
      'permission-denied',
      'Chỉ nhân sự có vai trò QA hoặc ADMIN mới có thẩm quyền xuất xưởng lô sản xuất.'
    );
  }

  const data = request.data;
  if (!data || !data.batchId || !data.signatureId) {
    throw new HttpsError('invalid-argument', 'Thiếu thông tin bắt buộc: batchId hoặc signatureId.');
  }

  const { batchId, signatureId, expectedVersion, reason, idempotencyKey } = data;
  const now = new Date().toISOString();
  const attemptId = `REL-ATTEMPT-${batchId}-${Date.now()}`;
  const effectiveIdempotencyKey = idempotencyKey || `idemp_${batchId}_${signatureId}`;

  // 2. P0-6: Idempotency Check — Kiểm tra bảng release_commands persisted
  const idempSnap = await db.ref(`release_commands/${effectiveIdempotencyKey}`).once('value');
  if (idempSnap.exists()) {
    const cachedCommand = idempSnap.val();
    return {
      ...(cachedCommand.response || {}),
      isIdempotent: true,
      message: 'Lô sản xuất đã được xuất xưởng thành công trước đó (Idempotent replay).',
    };
  }

  // 3. P0-2: Server tự truy vấn dữ liệu từ DB, không tin dữ liệu client gửi
  const batchRef = db.ref(`batches/${batchId}`);
  const batchSnap = await batchRef.once('value');

  if (!batchSnap.exists()) {
    throw new HttpsError('not-found', `Không tìm thấy lô sản xuất với mã: ${batchId}`);
  }

  const batch = batchSnap.val();

  // Kiểm tra trạng thái Lô hiện tại
  if (batch.status === 'RELEASED') {
    if (
      batch.releaseSignatureId === signatureId ||
      (batch.releaseSignatures &&
        Array.isArray(batch.releaseSignatures) &&
        batch.releaseSignatures.some((s: any) => s.id === signatureId))
    ) {
      return {
        success: true,
        message: 'Lô sản xuất đã được xuất xưởng thành công trước đó (Idempotent replay).',
        batchId,
        status: 'RELEASED',
        releaseStage: 'RELEASED',
        releaseGateProgress: batch.releaseGateProgress || {
          completed: 7,
          total: 7,
          percentage: 100,
          currentGate: 8,
        },
        releasedAt: batch.releasedAt,
        releasedBy: batch.releasedBy,
        version: batch.version,
        isIdempotent: true,
      };
    }
    throw new HttpsError(
      'failed-precondition',
      'Lô sản xuất đã ở trạng thái xuất xưởng (RELEASED).'
    );
  }

  // Chặn xuất xưởng khi Lô chưa ở trạng thái TESTING
  if (batch.status === 'PENDING') {
    throw new HttpsError(
      'failed-precondition',
      'Lô sản xuất đang ở trạng thái PENDING. Vui lòng chuyển sang TESTING và hoàn thành kiểm nghiệm trước khi duyệt xuất xưởng.'
    );
  }

  if (batch.status === 'REJECTED' || batch.status === 'BLOCKED') {
    throw new HttpsError(
      'failed-precondition',
      `Không thể xuất xưởng lô sản xuất đang ở trạng thái ${batch.status}.`
    );
  }

  // OCC Check
  if (
    expectedVersion !== undefined &&
    batch.version !== undefined &&
    batch.version !== expectedVersion
  ) {
    throw new HttpsError(
      'aborted',
      `ERR_CONCURRENCY_CONFLICT: Phiên bản Lô đã thay đổi (hiện tại v${batch.version}, yêu cầu v${expectedVersion}). Vui lòng tải lại trang.`
    );
  }

  // 4. P0-4 & P0-5: Thẩm tra chữ ký điện tử thật trong DB
  const sigRef = db.ref(`electronic_signatures/${signatureId}`);
  const sigSnap = await sigRef.once('value');

  if (!sigSnap.exists()) {
    throw new HttpsError(
      'failed-precondition',
      'ERR_SIGNATURE_MISSING: Không tìm thấy bản ghi chữ ký điện tử trên hệ thống.'
    );
  }

  const signature = sigSnap.val();

  // 5. Truy vấn dữ liệu đầy đủ cho Canonical Gates (TestResults, Deviations, Bound TCCS)
  const testResultsSnap = await db
    .ref('testResults')
    .orderByChild('batchId')
    .equalTo(batchId)
    .once('value');
  let testResults: any[] = [];
  if (testResultsSnap.exists()) {
    testResults = Object.values(testResultsSnap.val());
  } else if (batch.batchNo) {
    const trByNoSnap = await db
      .ref('testResults')
      .orderByChild('batchNo')
      .equalTo(batch.batchNo)
      .once('value');
    if (trByNoSnap.exists()) {
      testResults = Object.values(trByNoSnap.val());
    }
  }

  const devSnap = await db
    .ref('quality_deviations')
    .orderByChild('batchId')
    .equalTo(batchId)
    .once('value');
  let deviations: any[] = [];
  if (devSnap.exists()) {
    deviations = Object.values(devSnap.val());
  }

  // Bound TCCS (ưu tiên tccsSnapshot đã niêm phong trên lô)
  let boundTccs = batch.tccsSnapshot || null;
  if (!boundTccs && batch.tccsId) {
    const tccsSnap = await db.ref(`tccs/${batch.tccsId}`).once('value');
    if (tccsSnap.exists()) {
      boundTccs = tccsSnap.val();
    }
  }

  // 6. P0-3: Thẩm định 7 Cổng Kiểm Soát qua Canonical SSoT Engine (Fail-Closed)
  const evaluation = evaluateCanonicalReleaseGates({
    batch,
    testResults,
    deviations,
    boundTccs,
    userRole: userRole || (isAdmin ? 'ADMIN' : 'QA'),
    signature,
    callerUid,
    asOfDate: now,
    isPreview: false,
  });

  if (!evaluation.eligible) {
    // Ghi audit failure attempt
    const auditLogId = `audit_fail_${Date.now()}`;
    await db.ref(`audit_logs/${auditLogId}`).set({
      action: 'BATCH_RELEASE_REJECTED',
      batchId,
      actorUid: callerUid,
      actorRole: userRole,
      signatureId,
      failureCode: evaluation.blockers[0] || 'ERR_GATES_NOT_MET',
      blockers: evaluation.blockers,
      attemptId,
      timestamp: now,
    });

    throw new HttpsError(
      'failed-precondition',
      `Không đủ điều kiện xuất xưởng: ${evaluation.blockers.join('; ')}`
    );
  }

  // 7. P0-5: Atomic Multi-Location Commit trên RTDB
  const releaseDecisionSnapshot = {
    eligible: true,
    overallConclusion: 'ĐẠT TIÊU CHUẨN XUẤT XƯỞNG',
    evaluatedAt: now,
    evaluatorUid: callerUid,
    evaluatorRole: userRole,
    gates: evaluation.gates,
    blockers: [],
  };

  const releaseProgress = {
    completed: 7,
    total: 7,
    percentage: 100,
    currentGate: 8,
    evaluatedAt: now,
  };

  const currentBatchVersion = batch.version || 1;
  const updatedVersion = currentBatchVersion + 1;

  const finalResponse = {
    success: true,
    message: 'Lô sản xuất đã được phê duyệt xuất xưởng thành công (7/7 Cổng đạt chuẩn GMP).',
    batchId,
    status: 'RELEASED',
    releaseStage: 'RELEASED',
    releaseGateProgress: releaseProgress,
    releasedAt: now,
    releasedBy: callerUid,
    version: updatedVersion,
    signatureId,
  };

  // Chuẩn bị payload Multi-Location Atomic Update
  const updates: Record<string, any> = {};

  // 1. Batch State Transition sang RELEASED
  updates[`batches/${batchId}/status`] = 'RELEASED';
  updates[`batches/${batchId}/releaseStage`] = 'RELEASED';
  updates[`batches/${batchId}/releaseGateProgress`] = releaseProgress;
  updates[`batches/${batchId}/releaseDecisionSnapshot`] = releaseDecisionSnapshot;
  updates[`batches/${batchId}/releaseSignatureId`] = signatureId;
  updates[`batches/${batchId}/releaseSignatures`] = [
    ...(batch.releaseSignatures || []),
    {
      ...signature,
      status: 'CONSUMED',
      consumedAt: now,
    },
  ];
  updates[`batches/${batchId}/releasedAt`] = now;
  updates[`batches/${batchId}/releasedBy`] = callerUid;
  updates[`batches/${batchId}/releaseNotes`] =
    reason || batch.releaseNotes || 'Xuất xưởng thành công theo quy chuẩn GMP.';
  updates[`batches/${batchId}/version`] = updatedVersion;
  updates[`batches/${batchId}/updatedAt`] = now;

  // 2. Signature Lifecycle Transition sang CONSUMED
  updates[`electronic_signatures/${signatureId}/status`] = 'CONSUMED';
  updates[`electronic_signatures/${signatureId}/consumedAt`] = now;
  updates[`electronic_signatures/${signatureId}/releaseAttemptId`] = attemptId;
  updates[`electronic_signatures/${signatureId}/releasedBatchId`] = batchId;

  // 3. Idempotency Key Record
  updates[`release_commands/${effectiveIdempotencyKey}`] = {
    commandId: attemptId,
    idempotencyKey: effectiveIdempotencyKey,
    batchId,
    signatureId,
    callerUid,
    executedAt: now,
    response: finalResponse,
  };

  // 4. ALCOA+ Audit Trail
  const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  updates[`audit_logs/${auditLogId}`] = {
    action: 'BATCH_RELEASE_APPROVE',
    entityType: 'BATCH',
    entityId: batchId,
    batchId,
    batchNo: batch.batchNo || batchId,
    actorUid: callerUid,
    actorEmail: token.email || signature.signerEmail || '',
    actorRole: userRole,
    signatureId,
    documentVersion: currentBatchVersion,
    newBatchVersion: updatedVersion,
    decision: 'APPROVED',
    result: 'RELEASED',
    gatesCompleted: '7/7',
    attemptId,
    timestamp: now,
    createdAt: now,
  };

  // THỰC THI NGUYÊN TỬ MULTI-LOCATION
  // Nếu môi trường mock không hỗ trợ update ở root, fallback về các updates từng nhánh
  if (typeof db.ref().update === 'function') {
    await db.ref().update(updates);
  } else {
    // Mock environment support
    await batchRef.update(
      updates[`batches/${batchId}`] || {
        status: 'RELEASED',
        version: updatedVersion,
        releaseStage: 'RELEASED',
        releaseGateProgress: releaseProgress,
        releaseDecisionSnapshot,
        releaseSignatureId: signatureId,
      }
    );
    await sigRef.update({
      status: 'CONSUMED',
      consumedAt: now,
      releaseAttemptId: attemptId,
      releasedBatchId: batchId,
    });
    await db
      .ref(`release_commands/${effectiveIdempotencyKey}`)
      .set(updates[`release_commands/${effectiveIdempotencyKey}`]);
    await db.ref(`audit_logs/${auditLogId}`).set(updates[`audit_logs/${auditLogId}`]);
  }

  return finalResponse;
}
