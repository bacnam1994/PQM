/**
 * packages/release-engine/src/gates.ts
 * CANONICAL 7 RELEASE GATES IMPLEMENTATION (SSoT for Client Preview & Server Command)
 *
 * Principle: FAIL-CLOSED.
 * No bypass flags, no mock fallbacks, deterministic evaluation.
 */

import { ReleaseGateResult, CanonicalElectronicSignature } from './types';
import { verifyCanonicalSignatureChecksum } from './checksum';

export interface EvaluateGatesParams {
  batch: {
    id: string;
    batchNo?: string;
    status?: string;
    version?: number;
    expDate?: string;
    hasActiveOOS?: boolean;
    bprReviewStatus?: string;
    bprReviewedBy?: string;
    bprReviewComment?: string;
  };
  completion: {
    isComplete: boolean;
    percentage: number;
    requiredCount: number;
    testedCount: number;
  };
  qualityStatus: 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';
  deviations?: Array<{
    id?: string;
    batchId?: string;
    batchNo?: string;
    type?: string;
    category?: string;
    isOos?: boolean;
    severity?: string;
    status?: string;
    capaRequired?: boolean;
    capaCompleted?: boolean;
    capaStatus?: string;
    capaItems?: Array<{ status?: string }>;
  }>;
  userRole?: string;
  userSignature?: CanonicalElectronicSignature | null;
  asOfDate?: string | Date;
  isPreview?: boolean;
  isDataUnavailable?: boolean;
}

export function evaluate7Gates(params: EvaluateGatesParams): {
  gates: ReleaseGateResult[];
  allPassed: boolean;
  blockers: string[];
} {
  const {
    batch,
    completion,
    qualityStatus,
    deviations = [],
    userRole,
    userSignature,
    asOfDate,
    isPreview = false,
    isDataUnavailable = false,
  } = params;

  const gates: ReleaseGateResult[] = [];
  const blockers: string[] = [];

  // =========================================================================
  // GATE 1: Tính đầy đủ của phép thử (100% Required Criteria)
  // =========================================================================
  const completionPct = completion?.percentage ?? 0;
  const gate1Passed =
    !isDataUnavailable &&
    completion.isComplete &&
    completionPct === 100 &&
    completion.requiredCount > 0 &&
    completion.testedCount >= completion.requiredCount;

  const gate1Blockers: string[] = [];
  if (!gate1Passed) {
    const msg = isDataUnavailable
      ? 'ERR_DATA_UNAVAILABLE: Dữ liệu kiểm nghiệm đang tải hoặc chưa đầy đủ. Fail-closed: Không thể thẩm định xuất xưởng.'
      : `ERR_TEST_INCOMPLETE: Chỉ tiêu kiểm nghiệm chưa hoàn tất 100% (${completionPct}%).`;
    gate1Blockers.push(msg);
    blockers.push(msg);
  }

  gates.push({
    gateIndex: 1,
    gateKey: 'GATE_1_TEST_COMPLETION',
    gateName: 'Tính đầy đủ của phép thử (100% Criteria)',
    passed: gate1Passed,
    status: gate1Passed ? 'PASS' : 'FAIL',
    details: `${completionPct}% hoàn thành (${completion.testedCount}/${completion.requiredCount})`,
    blockers: gate1Blockers,
  });

  // =========================================================================
  // GATE 2: Đánh giá chất lượng chuẩn tắc (Canonical Quality = PASS)
  // =========================================================================
  const gate2Passed = qualityStatus === 'PASS';
  const gate2Blockers: string[] = [];
  if (!gate2Passed) {
    const msg = `ERR_QUALITY_NOT_PASS: Đánh giá chất lượng Lô chưa đạt chuẩn PASS (${qualityStatus}).`;
    gate2Blockers.push(msg);
    blockers.push(msg);
  }

  gates.push({
    gateIndex: 2,
    gateKey: 'GATE_2_CANONICAL_QUALITY',
    gateName: 'Đánh giá chất lượng chuẩn tắc (Canonical PASS)',
    passed: gate2Passed,
    status: gate2Passed ? 'PASS' : 'FAIL',
    details: `Chất lượng: ${qualityStatus}`,
    blockers: gate2Blockers,
  });

  // =========================================================================
  // GATE 3: Không có OOS mở (No Active OOS)
  // =========================================================================
  const batchDeviations = deviations.filter(
    (d) =>
      d && (d.batchId === batch.id || (d.batchNo && batch.batchNo && d.batchNo === batch.batchNo))
  );

  const openOosDeviations = batchDeviations.filter(
    (d) => (d.type === 'OOS' || d.category === 'OOS' || d.isOos) && d.status !== 'CLOSED'
  );

  const gate3Passed = !batch.hasActiveOOS && openOosDeviations.length === 0;
  const gate3Blockers: string[] = [];
  if (!gate3Passed) {
    const msg = 'ERR_OOS_PENDING: Lô có hồ sơ điều tra OOS chưa được xử lý đóng (CLOSED).';
    gate3Blockers.push(msg);
    blockers.push(msg);
  }

  gates.push({
    gateIndex: 3,
    gateKey: 'GATE_3_NO_OPEN_OOS',
    gateName: 'Xử lý OOS (Không vướng OOS mở)',
    passed: gate3Passed,
    status: gate3Passed ? 'PASS' : 'BLOCKED',
    details: gate3Passed ? 'Không có OOS mở' : 'Có OOS mở',
    blockers: gate3Blockers,
  });

  // =========================================================================
  // GATE 4: Không có Critical Deviation mở
  // =========================================================================
  const openCriticalDeviations = batchDeviations.filter(
    (d) => d.severity === 'CRITICAL' && d.status !== 'CLOSED'
  );

  const gate4Passed = openCriticalDeviations.length === 0;
  const gate4Blockers: string[] = [];
  if (!gate4Passed) {
    const msg = `ERR_DEV_PENDING: Còn ${openCriticalDeviations.length} hồ sơ sai lệch nghiêm trọng (CRITICAL) chưa đóng.`;
    gate4Blockers.push(msg);
    blockers.push(msg);
  }

  gates.push({
    gateIndex: 4,
    gateKey: 'GATE_4_NO_OPEN_CRITICAL_DEVIATION',
    gateName: 'Hồ sơ Sai lệch (Không có sai lệch mở)',
    passed: gate4Passed,
    status: gate4Passed ? 'PASS' : 'BLOCKED',
    details: gate4Passed
      ? 'Không có sai lệch nghiêm trọng mở'
      : `Có ${openCriticalDeviations.length} sai lệch nghiêm trọng mở`,
    blockers: gate4Blockers,
  });

  // =========================================================================
  // GATE 5: CAPA đã hoàn thành
  // =========================================================================
  const unfulfilledCapaDevs = batchDeviations.filter((d) => {
    if (d.capaRequired && !d.capaCompleted) return true;
    if (d.capaStatus && !['COMPLETED', 'VERIFIED', 'CLOSED'].includes(d.capaStatus)) return true;
    const unclosedItems = (d.capaItems || []).filter(
      (c) => c && c.status !== 'COMPLETED' && c.status !== 'VERIFIED'
    );
    return unclosedItems.length > 0;
  });

  const openCapas = batchDeviations.flatMap((d) =>
    (d.capaItems || []).filter((c) => c && c.status !== 'COMPLETED' && c.status !== 'VERIFIED')
  );

  const hasUnfulfilledCapa = unfulfilledCapaDevs.length > 0 || openCapas.length > 0;
  const gate5Passed = !hasUnfulfilledCapa;
  const gate5Blockers: string[] = [];
  if (!gate5Passed) {
    const count = Math.max(unfulfilledCapaDevs.length, openCapas.length);
    const msg = `ERR_CAPA_BLOCKING: Còn ${count} hành động khắc phục CAPA chưa hoàn thành hoặc chưa được nghiệm thu.`;
    gate5Blockers.push(msg);
    blockers.push(msg);
  }

  gates.push({
    gateIndex: 5,
    gateKey: 'GATE_5_CAPA_FULFILLED',
    gateName: 'Hồ sơ CAPA (Không có CAPA mở)',
    passed: gate5Passed,
    status: gate5Passed ? 'PASS' : 'BLOCKED',
    details: gate5Passed
      ? 'Không có CAPA mở'
      : `Còn ${Math.max(unfulfilledCapaDevs.length, openCapas.length)} CAPA mở`,
    blockers: gate5Blockers,
  });

  // =========================================================================
  // GATE 6: BPR QA Approved (Hồ sơ sản xuất lô đã được QA phê duyệt)
  // =========================================================================
  const bprStatus = batch.bprReviewStatus;
  const gate6Passed = bprStatus === 'APPROVED';
  const gate6Blockers: string[] = [];
  if (!gate6Passed) {
    const msg =
      bprStatus === 'REJECTED'
        ? `ERR_BPR_NOT_APPROVED: ERR_BPR_REJECTED - Hồ sơ sản xuất (BPR) đã bị từ chối (${batch.bprReviewComment || 'Không có lý do'}).`
        : bprStatus === 'UNDER_REVIEW'
          ? 'ERR_BPR_NOT_APPROVED: ERR_BPR_UNDER_REVIEW - Hồ sơ sản xuất (BPR) đang trong quá trình thẩm định của QA, chưa được phê duyệt.'
          : bprStatus === 'SUBMITTED'
            ? 'ERR_BPR_NOT_APPROVED: ERR_BPR_NOT_REVIEWED - Hồ sơ sản xuất (BPR) đã nộp nhưng chưa được QA bắt đầu thẩm định.'
            : 'ERR_BPR_NOT_APPROVED: ERR_BPR_NOT_SUBMITTED - Hồ sơ sản xuất (BPR) chưa được nộp hoặc chưa được QA phê duyệt.';
    gate6Blockers.push(msg);
    blockers.push(msg);
  }

  gates.push({
    gateIndex: 6,
    gateKey: 'GATE_6_BPR_QA_APPROVED',
    gateName: 'Thẩm định hồ sơ lô sản xuất (BPR Review)',
    passed: gate6Passed,
    status: gate6Passed ? 'PASS' : bprStatus === 'UNDER_REVIEW' ? 'WAITING' : 'FAIL',
    details: gate6Passed
      ? `BPR đã duyệt bởi ${batch.bprReviewedBy || 'QA'}`
      : bprStatus === 'UNDER_REVIEW'
        ? 'Đang thẩm định BPR (ERR_BPR_UNDER_REVIEW)'
        : 'BPR chưa được phê duyệt (ERR_BPR_NOT_APPROVED)',
    blockers: gate6Blockers,
  });

  // =========================================================================
  // GATE 7: Thẩm quyền, Hạn dùng & Chữ ký số 21 CFR Part 11
  // =========================================================================
  const effectiveRole = userSignature?.role || userRole;
  const hasProperRole = ['ADMIN', 'QA'].includes(effectiveRole || '');

  let isNotExpired = true;
  if (batch.expDate) {
    const exp = new Date(batch.expDate);
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    if (!isNaN(exp.getTime()) && exp.getTime() < asOf.getTime()) {
      isNotExpired = false;
    }
  }

  const gate7Blockers: string[] = [];
  if (effectiveRole && !['ADMIN', 'QA'].includes(effectiveRole)) {
    const msg = `ERR_ROLE_UNAUTHORIZED: Vai trò ${effectiveRole} không có thẩm quyền ký xuất xưởng.`;
    gate7Blockers.push(msg);
    blockers.push(msg);
  } else if (!effectiveRole && !isPreview) {
    const msg = 'ERR_ROLE_UNAUTHORIZED: Không xác định được vai trò người phê duyệt xuất xưởng.';
    gate7Blockers.push(msg);
    blockers.push(msg);
  }

  if (!isNotExpired) {
    const msg = `ERR_EXPIRED: Lô đã hết hạn sử dụng (${batch.expDate}).`;
    gate7Blockers.push(msg);
    blockers.push(msg);
  }

  let signaturePassed = false;
  if (!userSignature) {
    if (isPreview) {
      signaturePassed = false;
    } else {
      signaturePassed = false;
      const msg =
        'ERR_SIGNATURE_MISSING: Thiếu chữ ký điện tử 21 CFR Part 11 của QA/Admin phê duyệt xuất xưởng.';
      gate7Blockers.push(msg);
      blockers.push(msg);
    }
  } else {
    signaturePassed = true;

    // Document Type check
    if (userSignature.documentType !== 'BATCH_RELEASE') {
      signaturePassed = false;
      const msg = `ERR_SIGNATURE_MISMATCH: Loại tài liệu ký '${userSignature.documentType}' không hợp lệ (yêu cầu BATCH_RELEASE).`;
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // Document ID check
    if (!userSignature.documentId || userSignature.documentId !== batch.id) {
      signaturePassed = false;
      const msg = `ERR_SIGNATURE_MISMATCH: ID tài liệu ký '${userSignature.documentId}' không khớp với ID lô '${batch.id}'.`;
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // Document Version check
    if (
      userSignature.documentVersion !== undefined &&
      batch.version !== undefined &&
      userSignature.documentVersion !== batch.version
    ) {
      signaturePassed = false;
      const msg = `ERR_SIGNATURE_VERSION_MISMATCH: Phiên bản tài liệu ký (v${userSignature.documentVersion}) không khớp với phiên bản lô (v${batch.version}).`;
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // Signer Identity check
    const signerId = userSignature.signerEmail || userSignature.signerUid;
    if (!signerId || signerId.trim().length === 0) {
      signaturePassed = false;
      const msg =
        'ERR_SIGNATURE_INVALID: Chữ ký thiếu thông tin định danh người ký (signerEmail/signerUid).';
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // Signer Role check
    const sigRole = String(userSignature.role || '').toUpperCase();
    if (!['QA', 'ADMIN'].includes(sigRole)) {
      signaturePassed = false;
      const msg = `ERR_SIGNATURE_ROLE_UNAUTHORIZED: Người ký có vai trò '${userSignature.role}', không có thẩm quyền xuất xưởng.`;
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // Timestamp check
    if (!userSignature.signedAt || isNaN(new Date(userSignature.signedAt).getTime())) {
      signaturePassed = false;
      const msg = 'ERR_SIGNATURE_INVALID: Thời điểm ký điện tử không hợp lệ.';
      gate7Blockers.push(msg);
      blockers.push(msg);
    } else {
      const signedTime = new Date(userSignature.signedAt).getTime();
      if (signedTime > Date.now() + 5 * 60 * 1000) {
        signaturePassed = false;
        const msg = 'ERR_SIGNATURE_INVALID: Thời điểm ký điện tử không được nằm trong tương lai.';
        gate7Blockers.push(msg);
        blockers.push(msg);
      }
    }

    // Strict Checksum check (Exact match SHA256 only)
    const isChecksumValid = verifyCanonicalSignatureChecksum(userSignature);
    if (!isChecksumValid) {
      signaturePassed = false;
      const msg =
        'ERR_SIGNATURE_TAMPERED: Mã băm chữ ký điện tử không khớp với nội dung ký (Signature Integrity Verification Failed).';
      gate7Blockers.push(msg);
      blockers.push(msg);
    }
  }

  const gate7Passed = hasProperRole && isNotExpired && signaturePassed && !!userSignature;
  let gate7Status: 'PASS' | 'FAIL' | 'BLOCKED' | 'WAITING' = 'FAIL';
  if (gate7Passed) {
    gate7Status = 'PASS';
  } else if (!userSignature && isPreview) {
    gate7Status = 'WAITING';
  } else {
    gate7Status = 'FAIL';
  }

  gates.push({
    gateIndex: 7,
    gateKey: 'GATE_7_AUTHORITY_AND_SIGNATURE',
    gateName: 'Pháp lý, Thẩm quyền & Chữ ký 21 CFR Part 11',
    passed: gate7Passed,
    status: gate7Status,
    details: gate7Passed
      ? `Đã ký số bởi ${userSignature?.signerEmail || 'QA/Admin'}`
      : isPreview && !userSignature
        ? 'Chờ chữ ký điện tử của QA/Admin'
        : 'Chưa đạt điều kiện thẩm quyền & chữ ký số',
    blockers: gate7Blockers,
  });

  const allPassed = gates.every((g) => g.passed);

  return {
    gates,
    allPassed,
    blockers,
  };
}
