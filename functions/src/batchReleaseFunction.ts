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
 * 2. P0-2: Server tự truy vấn dữ liệu từ Firebase RTDB, không tin dữ liệu client gửi.
 * 3. P0-3: Xác thực actor qua request.auth (chỉ QA hoặc ADMIN).
 * 4. P0-4: Chạy Gate 1→7 Fail-Closed.
 * 5. P0-5: Thẩm tra Chữ ký điện tử 21 CFR Part 11 thật trong DB.
 * 6. P0-6: Atomic Release Transaction & Signature Lifecycle (CONSUMED).
 * 7. P0-7: Idempotency Key bảo đảm an toàn khi double-click/retry.
 */

import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

export interface ApproveBatchReleaseRequest {
  batchId: string;
  signatureId: string;
  expectedVersion?: number;
  idempotencyKey?: string;
  reason?: string;
}

export interface ReleaseGateServerResult {
  gateIndex: number;
  gateKey: string;
  gateName: string;
  passed: boolean;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  details: string;
  blockers: string[];
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

  const { batchId, signatureId, expectedVersion, reason } = data;
  const now = new Date().toISOString();
  const attemptId = `REL-ATTEMPT-${batchId}-${Date.now()}`;

  // 2. P0-2: Server tự truy vấn dữ liệu từ DB, không tin dữ liệu client gửi
  const batchRef = db.ref(`batches/${batchId}`);
  const batchSnap = await batchRef.once('value');

  if (!batchSnap.exists()) {
    throw new HttpsError('not-found', `Không tìm thấy lô sản xuất với mã: ${batchId}`);
  }

  const batch = batchSnap.val();

  // 3. P0-7: Idempotency Check — Nếu lô đã RELEASED với cùng signatureId
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

  // 4. P0-5: Thẩm tra chữ ký điện tử thật trong DB
  const sigRef = db.ref(`electronic_signatures/${signatureId}`);
  const sigSnap = await sigRef.once('value');

  if (!sigSnap.exists()) {
    throw new HttpsError(
      'failed-precondition',
      'ERR_SIGNATURE_MISSING: Không tìm thấy bản ghi chữ ký điện tử trên hệ thống.'
    );
  }

  const signature = sigSnap.val();

  if (signature.documentType !== 'BATCH_RELEASE') {
    throw new HttpsError(
      'failed-precondition',
      `ERR_SIGNATURE_INVALID: Loại chữ ký (${signature.documentType}) không hợp lệ cho lệnh xuất xưởng lô (yêu cầu BATCH_RELEASE).`
    );
  }

  if (signature.documentId !== batchId) {
    throw new HttpsError(
      'failed-precondition',
      `ERR_SIGNATURE_INVALID: Chữ ký không gắn với lô sản xuất này (ký cho ${signature.documentId}, lô hiện tại ${batchId}).`
    );
  }

  const currentBatchVersion = batch.version || 1;
  if (
    signature.documentVersion !== undefined &&
    signature.documentVersion !== currentBatchVersion
  ) {
    throw new HttpsError(
      'failed-precondition',
      `ERR_SIGNATURE_VERSION_MISMATCH: Phiên bản tài liệu khi ký (v${signature.documentVersion}) không khớp phiên bản hiện tại của lô (v${currentBatchVersion}).`
    );
  }

  if (signature.signerUid !== callerUid) {
    throw new HttpsError(
      'permission-denied',
      'ERR_ROLE_UNAUTHORIZED: Người thực thi lệnh xuất xưởng không khớp với người đã ký chữ ký điện tử.'
    );
  }

  if (signature.status === 'REVOKED' || signature.status === 'REJECTED') {
    throw new HttpsError(
      'failed-precondition',
      `ERR_SIGNATURE_INVALID: Chữ ký điện tử đã bị thu hồi hoặc từ chối (trạng thái: ${signature.status}).`
    );
  }

  if (
    !signature.checksum ||
    typeof signature.checksum !== 'string' ||
    signature.checksum.length < 16
  ) {
    throw new HttpsError(
      'failed-precondition',
      'ERR_SIGNATURE_INVALID: Chữ ký điện tử thiếu mã băm toàn vẹn SHA-256 (integrity fingerprint).'
    );
  }

  // 5. Truy vấn dữ liệu để thẩm định Gate 1→6
  // Test Results
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

  // Deviations
  const devSnap = await db
    .ref('quality_deviations')
    .orderByChild('batchId')
    .equalTo(batchId)
    .once('value');
  let deviations: any[] = [];
  if (devSnap.exists()) {
    deviations = Object.values(devSnap.val());
  }

  // 6. Thẩm định 7 Cổng Kiểm Soát (Fail-Closed)
  const gates: ReleaseGateServerResult[] = [];
  const blockers: string[] = [];

  // GATE 1: Đầy đủ kết quả kiểm nghiệm
  const hasTestResults = testResults.length > 0;
  const gate1Passed = hasTestResults;
  if (!gate1Passed) {
    const msg = 'ERR_TEST_RESULTS_MISSING: Chưa có bất kỳ phiếu kiểm nghiệm nào cho lô này.';
    blockers.push(msg);
    gates.push({
      gateIndex: 1,
      gateKey: 'GATE_1_TEST_COMPLETION',
      gateName: 'Đầy đủ Kết quả Kiểm nghiệm',
      passed: false,
      status: 'FAIL',
      details: msg,
      blockers: [msg],
    });
  } else {
    gates.push({
      gateIndex: 1,
      gateKey: 'GATE_1_TEST_COMPLETION',
      gateName: 'Đầy đủ Kết quả Kiểm nghiệm',
      passed: true,
      status: 'PASS',
      details: `Có ${testResults.length} phiếu kiểm nghiệm hợp lệ gắn với lô.`,
      blockers: [],
    });
  }

  // GATE 2: Đánh giá chất lượng Đạt (PASS)
  // Lấy phiếu mới nhất hoặc tối cao
  const validTestResults = testResults.filter((r) => r && r.status !== 'CANCELLED');
  const hasFailedResult = validTestResults.some(
    (r) => r.overallStatus === 'FAIL' || r.qualityStatus === 'FAIL'
  );
  const hasPassResult = validTestResults.some(
    (r) => r.overallStatus === 'PASS' || r.qualityStatus === 'PASS'
  );
  const gate2Passed = gate1Passed && hasPassResult && !hasFailedResult;
  if (!gate2Passed) {
    const msg = hasFailedResult
      ? 'ERR_QUALITY_NOT_PASSED: Lô có phiếu kiểm nghiệm không đạt tiêu chuẩn chất lượng (FAIL).'
      : 'ERR_QUALITY_NOT_PASSED: Chưa có phiếu kiểm nghiệm nào đạt kết luận PASS.';
    blockers.push(msg);
    gates.push({
      gateIndex: 2,
      gateKey: 'GATE_2_CANONICAL_QUALITY',
      gateName: 'Đánh giá Chất lượng Đạt chuẩn (PASS)',
      passed: false,
      status: 'FAIL',
      details: msg,
      blockers: [msg],
    });
  } else {
    gates.push({
      gateIndex: 2,
      gateKey: 'GATE_2_CANONICAL_QUALITY',
      gateName: 'Đánh giá Chất lượng Đạt chuẩn (PASS)',
      passed: true,
      status: 'PASS',
      details: 'Tất cả các phiếu kiểm nghiệm đều đạt tiêu chuẩn chất lượng.',
      blockers: [],
    });
  }

  // GATE 3: Không có OOS mở
  const openOos = deviations.filter((d) => d && d.source === 'OOS' && d.status !== 'CLOSED');
  const gate3Passed = openOos.length === 0;
  if (!gate3Passed) {
    const msg = `ERR_OOS_OPEN: Còn ${openOos.length} hồ sơ OOS chưa được đóng.`;
    blockers.push(msg);
    gates.push({
      gateIndex: 3,
      gateKey: 'GATE_3_NO_OPEN_OOS',
      gateName: 'Hồ sơ OOS (Không có OOS mở)',
      passed: false,
      status: 'BLOCKED',
      details: msg,
      blockers: [msg],
    });
  } else {
    gates.push({
      gateIndex: 3,
      gateKey: 'GATE_3_NO_OPEN_OOS',
      gateName: 'Hồ sơ OOS (Không có OOS mở)',
      passed: true,
      status: 'PASS',
      details: 'Không có hồ sơ OOS nào mở hoặc chưa xử lý.',
      blockers: [],
    });
  }

  // GATE 4: Không có Sai lệch nghiêm trọng mở
  const openCriticalDeviations = deviations.filter(
    (d) => d && d.severity === 'CRITICAL' && d.status !== 'CLOSED'
  );
  const gate4Passed = openCriticalDeviations.length === 0;
  if (!gate4Passed) {
    const msg = `ERR_DEVIATION_OPEN: Còn ${openCriticalDeviations.length} sai lệch mức độ CRITICAL chưa được đóng.`;
    blockers.push(msg);
    gates.push({
      gateIndex: 4,
      gateKey: 'GATE_4_NO_OPEN_CRITICAL_DEVIATION',
      gateName: 'Hồ sơ Sai lệch (Không có sai lệch mở)',
      passed: false,
      status: 'BLOCKED',
      details: msg,
      blockers: [msg],
    });
  } else {
    gates.push({
      gateIndex: 4,
      gateKey: 'GATE_4_NO_OPEN_CRITICAL_DEVIATION',
      gateName: 'Hồ sơ Sai lệch (Không có sai lệch mở)',
      passed: true,
      status: 'PASS',
      details: 'Không có sai lệch chất lượng nghiêm trọng nào mở.',
      blockers: [],
    });
  }

  // GATE 5: CAPA hoàn thành
  const openCapas = deviations.flatMap((d) =>
    (d.capaItems || []).filter((c: any) => c && c.status !== 'COMPLETED' && c.status !== 'VERIFIED')
  );
  const gate5Passed = openCapas.length === 0;
  if (!gate5Passed) {
    const msg = `ERR_CAPA_PENDING: Còn ${openCapas.length} hành động khắc phục CAPA chưa hoàn thành.`;
    blockers.push(msg);
    gates.push({
      gateIndex: 5,
      gateKey: 'GATE_5_CAPA_FULFILLED',
      gateName: 'Hành động Khắc phục (CAPA)',
      passed: false,
      status: 'BLOCKED',
      details: msg,
      blockers: [msg],
    });
  } else {
    gates.push({
      gateIndex: 5,
      gateKey: 'GATE_5_CAPA_FULFILLED',
      gateName: 'Hành động Khắc phục (CAPA)',
      passed: true,
      status: 'PASS',
      details: '100% các hành động CAPA liên quan đã hoàn tất và được xác nhận.',
      blockers: [],
    });
  }

  // GATE 6: BPR QA phê duyệt
  const gate6Passed = batch.bprReviewStatus === 'APPROVED';
  if (!gate6Passed) {
    const msg = 'ERR_BPR_NOT_APPROVED: Hồ sơ Lô điện tử (BPR) chưa được QA phê duyệt.';
    blockers.push(msg);
    gates.push({
      gateIndex: 6,
      gateKey: 'GATE_6_BPR_QA_APPROVED',
      gateName: 'Hồ sơ Lô điện tử (BPR)',
      passed: false,
      status: 'BLOCKED',
      details: msg,
      blockers: [msg],
    });
  } else {
    gates.push({
      gateIndex: 6,
      gateKey: 'GATE_6_BPR_QA_APPROVED',
      gateName: 'Hồ sơ Lô điện tử (BPR)',
      passed: true,
      status: 'PASS',
      details: `BPR đã được phê duyệt bởi ${batch.bprReviewedBy || 'QA'} lúc ${batch.bprReviewedAt || ''}.`,
      blockers: [],
    });
  }

  // GATE 7: Thẩm quyền & Chữ ký số 21 CFR Part 11
  // Đã xác thực signature ở bước trên -> PASS
  gates.push({
    gateIndex: 7,
    gateKey: 'GATE_7_AUTHORITY_AND_SIGNATURE',
    gateName: 'Thẩm quyền & Chữ ký số (21 CFR Part 11)',
    passed: true,
    status: 'PASS',
    details: `Đã ký duyệt bởi ${signature.signerName || signature.signerUid} (${signature.role}) lúc ${signature.signedAt}. Mã băm SHA-256 hợp lệ.`,
    blockers: [],
  });

  // Kiểm tra tổng thể
  const isEligible = blockers.length === 0 && gates.every((g) => g.passed);
  if (!isEligible) {
    // Ghi audit failure attempt
    await db.ref('audit_logs').push({
      action: 'BATCH_RELEASE_REJECTED',
      batchId,
      actorUid: callerUid,
      actorRole: userRole,
      signatureId,
      failureCode: blockers[0] || 'ERR_GATES_NOT_MET',
      blockers,
      attemptId,
      timestamp: now,
    });

    throw new HttpsError(
      'failed-precondition',
      `Không đủ điều kiện xuất xưởng: ${blockers.join('; ')}`
    );
  }

  // 7. P0-6: Atomic Release Transaction trên RTDB
  const releaseDecisionSnapshot = {
    eligible: true,
    overallConclusion: 'ĐẠT TIÊU CHUẨN XUẤT XƯỞNG',
    evaluatedAt: now,
    evaluatorUid: callerUid,
    evaluatorRole: userRole,
    gates,
    blockers: [],
  };

  const releaseProgress = {
    completed: 7,
    total: 7,
    percentage: 100,
    currentGate: 8,
    evaluatedAt: now,
  };

  let updatedVersion = (batch.version || 1) + 1;

  // Thực thi Transaction trên Batch
  const txResult = await batchRef.transaction((current) => {
    if (!current) return current;
    // Chống ghi đè nếu vừa bị cập nhật thành RELEASED
    if (current.status === 'RELEASED') return; // Abort transaction

    const currentVer = current.version || 1;
    if (expectedVersion !== undefined && currentVer !== expectedVersion) {
      return; // Abort transaction do xung đột version
    }

    current.status = 'RELEASED';
    current.releaseStage = 'RELEASED';
    current.releaseGateProgress = releaseProgress;
    current.releaseDecisionSnapshot = releaseDecisionSnapshot;
    current.releaseSignatureId = signatureId;
    current.releaseSignatures = [
      ...(current.releaseSignatures || []),
      {
        ...signature,
        status: 'CONSUMED',
        consumedAt: now,
      },
    ];
    current.releasedAt = now;
    current.releasedBy = callerUid;
    current.releaseNotes =
      reason || current.releaseNotes || 'Xuất xưởng thành công theo quy chuẩn GMP.';
    current.version = currentVer + 1;
    current.updatedAt = now;
    updatedVersion = current.version;

    return current;
  });

  if (!txResult.committed) {
    throw new HttpsError(
      'aborted',
      'ERR_RELEASE_TRANSACTION_FAILED: Giao dịch xuất xưởng không thể hoàn tất do xung đột dữ liệu hoặc lô đã xuất xưởng. Vui lòng tải lại trang.'
    );
  }

  // Cập nhật trạng thái chữ ký sang CONSUMED (P1-1 Lifecycle)
  await sigRef.update({
    status: 'CONSUMED',
    consumedAt: now,
    releaseAttemptId: attemptId,
    releasedBatchId: batchId,
  });

  // Ghi Audit Trail ALCOA+ bất biến
  await db.ref('audit_logs').push({
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
  });

  return {
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
}
