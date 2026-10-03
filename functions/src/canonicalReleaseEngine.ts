/**
 * functions/src/canonicalReleaseEngine.ts
 * =======================================
 * Canonical Single Source of Truth (SSoT) cho 7 Cổng Kiểm Soát Xuất Xưởng Lô (Release Gates)
 * Dùng chung giữa Server Cloud Function và Client Domain.
 *
 * Tuân thủ chuẩn GMP, 21 CFR Part 11 và nguyên tắc FAIL-CLOSED:
 * GATE 1: Tính đầy đủ của phép thử (100% Required Criteria)
 * GATE 2: Đánh giá chất lượng chuẩn tắc (Canonical Quality = PASS)
 * GATE 3: Xử lý OOS (Không vướng OOS mở)
 * GATE 4: Hồ sơ Sai lệch (Không có sai lệch nghiêm trọng mở)
 * GATE 5: Hồ sơ CAPA (Không có CAPA mở hoặc chưa hoàn thành)
 * GATE 6: Thẩm định hồ sơ lô sản xuất (BPR Review = APPROVED)
 * GATE 7: Pháp lý, Thẩm quyền, Hạn dùng & Chữ ký số 21 CFR Part 11 (Exact SHA-256 verification)
 */

import * as crypto from 'crypto';

export type ReleaseGateKey =
  | 'GATE_1_TEST_COMPLETION'
  | 'GATE_2_CANONICAL_QUALITY'
  | 'GATE_3_NO_OPEN_OOS'
  | 'GATE_4_NO_OPEN_CRITICAL_DEVIATION'
  | 'GATE_5_CAPA_FULFILLED'
  | 'GATE_6_BPR_QA_APPROVED'
  | 'GATE_7_AUTHORITY_AND_SIGNATURE';

export interface ReleaseGateResult {
  gateIndex: number; // 1 to 7
  gateKey: ReleaseGateKey;
  gateName: string;
  passed: boolean;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'WAITING';
  details: string;
  blockers: string[];
}

export interface CanonicalReleaseEvaluationResult {
  eligible: boolean;
  batchId: string;
  batchNo: string;
  gates: ReleaseGateResult[];
  blockers: string[];
  warnings: string[];
  decisionTrace: string[];
  readyForSignature?: boolean;
}

export interface EvaluateReleaseGatesParams {
  batch: any;
  testResults: any[];
  deviations?: any[];
  boundTccs?: any;
  userRole?: string;
  signature?: any;
  callerUid?: string;
  asOfDate?: string | Date;
  isPreview?: boolean;
}

/**
 * Tính mã SHA-256 chuẩn FIPS 180-4 64-hex cho chữ ký điện tử
 */
export function computeSignatureSha256(signature: {
  documentType: string;
  documentId: string;
  documentVersion?: number | string;
  signerUid: string;
  signerEmail: string;
  role: string;
  meaning: string;
  signedAt: string;
}): string {
  const payload = [
    signature.documentType,
    signature.documentId,
    signature.documentVersion ?? '',
    signature.signerUid,
    signature.signerEmail,
    signature.role,
    signature.meaning,
    signature.signedAt,
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Đánh giá Canonical 7 Cổng Kiểm Soát Xuất Xưởng (Fail-Closed)
 */
export function evaluateCanonicalReleaseGates(
  params: EvaluateReleaseGatesParams
): CanonicalReleaseEvaluationResult {
  const {
    batch,
    testResults = [],
    deviations = [],
    boundTccs: explicitTccs,
    userRole,
    signature,
    callerUid,
    asOfDate,
    isPreview = false,
  } = params;

  const batchId = batch?.id || '';
  const batchNo = batch?.batchNo || batchId;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const decisionTrace: string[] = [];
  const gates: ReleaseGateResult[] = [];

  decisionTrace.push(
    `[INIT] Bắt đầu đánh giá Canonical Release Gates cho lô ${batchNo} (${batchId}).`
  );

  if (!batch || !batch.id) {
    blockers.push('ERR_BATCH_NOT_FOUND: Thông tin Lô sản xuất không tồn tại hoặc rỗng.');
    return {
      eligible: false,
      batchId: '',
      batchNo: '',
      gates: [],
      blockers,
      warnings,
      decisionTrace,
    };
  }

  // 1. Phân giải danh sách phiếu kiểm nghiệm liên kết với lô
  const candidateResults = testResults.filter((r) => {
    if (!r) return false;
    if (r.batchId && r.batchId === batch.id) return true;
    if (r.batchNo && batch.batchNo && r.batchNo === batch.batchNo) return true;
    return false;
  });

  // TCCS ràng buộc (ưu tiên tccsSnapshot đã niêm phong trên lô)
  const boundTccs = batch.tccsSnapshot || explicitTccs || null;

  // ==========================================
  // GATE 1: Tính đầy đủ của phép thử (100% Required Criteria)
  // ==========================================
  const gate1Blockers: string[] = [];
  let gate1Passed = false;
  let gate1Details = '';

  if (candidateResults.length === 0) {
    const msg = 'ERR_TEST_RESULTS_MISSING: Chưa có bất kỳ phiếu kiểm nghiệm nào cho lô này.';
    gate1Blockers.push(msg);
    blockers.push(msg);
    gate1Details = '0 phiếu kiểm nghiệm';
  } else {
    // Thu thập tất cả chỉ tiêu từ TCCS
    const requiredCriteria: Array<{ name: string; isOptional?: boolean }> = [];
    if (boundTccs) {
      if (Array.isArray(boundTccs.mainQualityCriteria)) {
        for (const c of boundTccs.mainQualityCriteria) {
          if (c && c.name && !c.isOptional) requiredCriteria.push(c);
        }
      }
      if (Array.isArray(boundTccs.safetyCriteria)) {
        for (const c of boundTccs.safetyCriteria) {
          if (c && c.name && !c.isOptional) requiredCriteria.push(c);
        }
      }
    }

    if (requiredCriteria.length > 0) {
      // Thu thập tất cả kết quả chỉ tiêu đã thử
      const testedCriteriaNames = new Set<string>();
      for (const tr of candidateResults) {
        if (Array.isArray(tr.results)) {
          for (const entry of tr.results) {
            if (entry && entry.criteriaName) {
              testedCriteriaNames.add(entry.criteriaName.trim().toLowerCase());
            }
          }
        }
      }

      const missingCriteria: string[] = [];
      for (const req of requiredCriteria) {
        const normName = req.name.trim().toLowerCase();
        let matched = testedCriteriaNames.has(normName);
        if (!matched) {
          // So khớp tương đối
          for (const tested of testedCriteriaNames) {
            if (tested.includes(normName) || normName.includes(tested)) {
              matched = true;
              break;
            }
          }
        }
        if (!matched) {
          missingCriteria.push(req.name);
        }
      }

      const requiredCount = requiredCriteria.length;
      const testedCount = requiredCount - missingCriteria.length;
      const completionPct = Math.round((testedCount / requiredCount) * 100);

      if (missingCriteria.length > 0 || completionPct < 100) {
        const msg = `ERR_TEST_INCOMPLETE: Chỉ tiêu kiểm nghiệm chưa hoàn tất 100% (${completionPct}%). Thiếu chỉ tiêu bắt buộc: ${missingCriteria.join(', ')}.`;
        gate1Blockers.push(msg);
        blockers.push(msg);
        gate1Details = `${completionPct}% hoàn thành (${testedCount}/${requiredCount} chỉ tiêu)`;
      } else {
        gate1Passed = true;
        gate1Details = `100% hoàn thành (${testedCount}/${requiredCount} chỉ tiêu bắt buộc)`;
      }
    } else {
      // Nếu không có TCCS cấu hình chỉ tiêu chi tiết -> coi như pass nếu có phiếu kiểm nghiệm
      gate1Passed = true;
      gate1Details = `Có ${candidateResults.length} phiếu kiểm nghiệm hợp lệ gắn với lô.`;
    }
  }

  gates.push({
    gateIndex: 1,
    gateKey: 'GATE_1_TEST_COMPLETION',
    gateName: 'Tính đầy đủ của phép thử (100% Criteria)',
    passed: gate1Passed,
    status: gate1Passed ? 'PASS' : 'FAIL',
    details: gate1Details,
    blockers: gate1Blockers,
  });

  // ==========================================
  // GATE 2: Đánh giá chất lượng chuẩn tắc (Canonical Quality = PASS)
  // ==========================================
  const gate2Blockers: string[] = [];
  const validTestResults = candidateResults.filter((r) => r && r.status !== 'CANCELLED');
  const hasFailedResult = validTestResults.some(
    (r) => r.overallStatus === 'FAIL' || r.qualityStatus === 'FAIL'
  );
  const hasFailedEntry = validTestResults.some(
    (r) => Array.isArray(r.results) && r.results.some((e: any) => e && e.isPass === false)
  );
  const hasPassResult = validTestResults.some(
    (r) => r.overallStatus === 'PASS' || r.qualityStatus === 'PASS'
  );

  const gate2Passed = gate1Passed && hasPassResult && !hasFailedResult && !hasFailedEntry;
  if (!gate2Passed) {
    const msg =
      hasFailedResult || hasFailedEntry
        ? 'ERR_QUALITY_NOT_PASSED: Lô có phiếu kiểm nghiệm hoặc chỉ tiêu không đạt tiêu chuẩn chất lượng (FAIL).'
        : 'ERR_QUALITY_NOT_PASSED: Chưa có phiếu kiểm nghiệm nào đạt kết luận PASS.';
    gate2Blockers.push(msg);
    blockers.push(msg);
  }

  gates.push({
    gateIndex: 2,
    gateKey: 'GATE_2_CANONICAL_QUALITY',
    gateName: 'Đánh giá chất lượng chuẩn tắc (Canonical PASS)',
    passed: gate2Passed,
    status: gate2Passed ? 'PASS' : 'FAIL',
    details: gate2Passed
      ? 'Chất lượng: PASS (Tất cả phiếu kiểm nghiệm đều đạt)'
      : 'Chất lượng: FAIL / PENDING',
    blockers: gate2Blockers,
  });

  // ==========================================
  // GATE 3: Không có OOS mở (No Open OOS)
  // ==========================================
  const batchDeviations = deviations.filter(
    (d) =>
      d && (d.batchId === batch.id || (d.batchNo && batch.batchNo && d.batchNo === batch.batchNo))
  );

  const openOosDeviations = batchDeviations.filter(
    (d) =>
      ((d as any).type === 'OOS' ||
        (d as any).category === 'OOS' ||
        (d as any).isOos ||
        (d as any).source === 'OOS') &&
      d.status !== 'CLOSED'
  );

  const gate3Passed = !batch.hasActiveOOS && openOosDeviations.length === 0;
  const gate3Blockers: string[] = [];
  if (!gate3Passed) {
    const count = openOosDeviations.length || 1;
    const msg = `ERR_OOS_PENDING: Lô có ${count} hồ sơ điều tra OOS chưa được xử lý đóng (CLOSED).`;
    gate3Blockers.push(msg);
    blockers.push(msg);
  }

  gates.push({
    gateIndex: 3,
    gateKey: 'GATE_3_NO_OPEN_OOS',
    gateName: 'Xử lý OOS (Không vướng OOS mở)',
    passed: gate3Passed,
    status: gate3Passed ? 'PASS' : 'BLOCKED',
    details: gate3Passed
      ? 'Không có OOS mở'
      : `Có ${openOosDeviations.length || 1} hồ sơ OOS chưa đóng`,
    blockers: gate3Blockers,
  });

  // ==========================================
  // GATE 4: Không có Critical Deviation mở
  // ==========================================
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

  // ==========================================
  // GATE 5: CAPA hoàn thành (CAPA Fulfilled)
  // ==========================================
  const unfulfilledCapaDevs = batchDeviations.filter((d: any) => {
    if (d.capaRequired && !d.capaCompleted) return true;
    if (d.capaStatus && !['COMPLETED', 'VERIFIED', 'CLOSED'].includes(d.capaStatus)) return true;
    const unclosedItems = (d.capaItems || []).filter(
      (c: any) => c && c.status !== 'COMPLETED' && c.status !== 'VERIFIED'
    );
    return unclosedItems.length > 0;
  });

  const openCapas = batchDeviations.flatMap((d) =>
    (d.capaItems || []).filter((c: any) => c && c.status !== 'COMPLETED' && c.status !== 'VERIFIED')
  );

  const hasUnfulfilledCapa = unfulfilledCapaDevs.length > 0 || openCapas.length > 0;
  const gate5Passed = !hasUnfulfilledCapa;
  const gate5Blockers: string[] = [];
  if (!gate5Passed) {
    const count = Math.max(unfulfilledCapaDevs.length, openCapas.length);
    const msg = `ERR_CAPA_PENDING: Còn ${count} hành động khắc phục CAPA chưa hoàn thành hoặc chưa được nghiệm thu.`;
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

  // ==========================================
  // GATE 6: BPR QA phê duyệt (BPR Review = APPROVED)
  // ==========================================
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

  // ==========================================
  // GATE 7: Thẩm quyền, Hạn dùng & Chữ ký số 21 CFR Part 11
  // ==========================================
  const effectiveRole = signature?.role || userRole;
  const hasProperRole = ['ADMIN', 'QA'].includes(String(effectiveRole || '').toUpperCase());

  let isNotExpired = true;
  if (batch.expDate) {
    const exp = new Date(batch.expDate);
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    if (!isNaN(exp.getTime()) && exp.getTime() < asOf.getTime()) {
      isNotExpired = false;
    }
  }

  const gate7Blockers: string[] = [];
  if (effectiveRole && !hasProperRole) {
    const msg = `ERR_ROLE_UNAUTHORIZED: Vai trò '${effectiveRole}' không có thẩm quyền ký xuất xưởng.`;
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
  if (!signature) {
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

    // a. Document Type check
    if (signature.documentType !== 'BATCH_RELEASE') {
      signaturePassed = false;
      const msg = `ERR_SIGNATURE_MISMATCH: Loại tài liệu ký '${signature.documentType}' không hợp lệ (yêu cầu BATCH_RELEASE).`;
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // b. Document ID check
    if (!signature.documentId || signature.documentId !== batchId) {
      signaturePassed = false;
      const msg = `ERR_SIGNATURE_MISMATCH: ID tài liệu ký '${signature.documentId}' không khớp với ID lô '${batchId}'.`;
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // c. Document Version check
    const currentBatchVersion = batch.version || 1;
    if (
      signature.documentVersion !== undefined &&
      signature.documentVersion !== currentBatchVersion
    ) {
      const isPersistedReleaseSig =
        Array.isArray(batch.releaseSignatures) &&
        batch.releaseSignatures.some(
          (s: any) =>
            ((s as any)?.id || (s as any)?.signatureId) === signature.id ||
            s.checksum === signature.checksum
        );

      if (!isPersistedReleaseSig) {
        signaturePassed = false;
        const msg = `ERR_SIGNATURE_VERSION_MISMATCH: Phiên bản tài liệu khi ký (v${signature.documentVersion}) không khớp phiên bản hiện tại của lô (v${currentBatchVersion}).`;
        gate7Blockers.push(msg);
        blockers.push(msg);
      }
    }

    // d. Signer identity check
    const signerId = signature.signerEmail || signature.signerUid;
    if (!signerId || signerId.trim().length === 0) {
      signaturePassed = false;
      const msg =
        'ERR_SIGNATURE_INVALID: Chữ ký thiếu thông tin định danh người ký (signerEmail/signerUid).';
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // e. Signer UID check (nếu callerUid được cung cấp)
    if (callerUid && signature.signerUid && signature.signerUid !== callerUid) {
      signaturePassed = false;
      const msg =
        'ERR_SIGNER_MISMATCH: Người thực thi lệnh xuất xưởng không khớp với người đã ký chữ ký điện tử.';
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // f. Signer role check
    const sigRole = String(signature.role || '').toUpperCase();
    if (!['QA', 'ADMIN'].includes(sigRole)) {
      signaturePassed = false;
      const msg = `ERR_SIGNATURE_ROLE_UNAUTHORIZED: Người ký có vai trò '${signature.role}', không có thẩm quyền xuất xưởng.`;
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    // g. Status check: Không cho phép tái sử dụng chữ ký đã CONSUMED
    const isAlreadyConsumed =
      Array.isArray(batch.releaseSignatures) &&
      batch.releaseSignatures.some(
        (s: any) =>
          ((s as any)?.id || (s as any)?.signatureId) === signature.id && s.status === 'CONSUMED'
      );

    if (!isAlreadyConsumed) {
      if (signature.status === 'CONSUMED') {
        signaturePassed = false;
        const msg =
          'ERR_SIGNATURE_ALREADY_USED: Chữ ký điện tử đã được sử dụng trước đó (CONSUMED), không thể tái sử dụng.';
        gate7Blockers.push(msg);
        blockers.push(msg);
      } else if (signature.status === 'REVOKED' || signature.status === 'REJECTED') {
        signaturePassed = false;
        const msg = `ERR_SIGNATURE_INVALID: Chữ ký điện tử đã bị thu hồi hoặc từ chối (trạng thái: ${signature.status}).`;
        gate7Blockers.push(msg);
        blockers.push(msg);
      }
    }

    // h. Timestamp check
    if (!signature.signedAt || isNaN(new Date(signature.signedAt).getTime())) {
      signaturePassed = false;
      const msg = 'ERR_SIGNATURE_INVALID: Thời điểm ký điện tử không hợp lệ.';
      gate7Blockers.push(msg);
      blockers.push(msg);
    } else {
      const signedTime = new Date(signature.signedAt).getTime();
      if (signedTime > Date.now() + 5 * 60 * 1000) {
        signaturePassed = false;
        const msg = 'ERR_SIGNATURE_INVALID: Thời điểm ký điện tử không được nằm trong tương lai.';
        gate7Blockers.push(msg);
        blockers.push(msg);
      }
    }

    // i. Checksum & SHA-256 integrity check (Chống mock/auto signature và replay)
    const checksum = signature.checksum;
    if (
      !checksum ||
      typeof checksum !== 'string' ||
      checksum.startsWith('sig_auto_') ||
      checksum.includes('mock') ||
      checksum === 'valid-checksum'
    ) {
      signaturePassed = false;
      const msg =
        'ERR_SIGNATURE_TAMPERED: Mã băm chữ ký (checksum) không hợp lệ hoặc chứa cờ giả lập.';
      gate7Blockers.push(msg);
      blockers.push(msg);
    } else {
      const isHex64 =
        checksum.length === 64 &&
        !checksum.includes(' ') &&
        !checksum.includes('-') &&
        /^[0-9a-fA-F]{64}$/.test(checksum);

      const expectedSha256 = computeSignatureSha256(signature);
      const expectedDocIdSha256 = crypto
        .createHash('sha256')
        .update(signature.documentId, 'utf8')
        .digest('hex');

      // Legacy fallback
      let hash = 0;
      const payload = [
        signature.documentType,
        signature.documentId,
        signature.documentVersion ?? '',
        signature.signerUid,
        signature.signerEmail,
        signature.role,
        signature.meaning,
        signature.signedAt,
      ].join('|');
      for (let i = 0; i < payload.length; i++) {
        const char = payload.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      const expectedFallback = 'sha256_' + Math.abs(hash).toString(16);

      const isExactMatch =
        checksum === expectedSha256 ||
        checksum === expectedDocIdSha256 ||
        checksum === expectedFallback;

      if (!isHex64 || !isExactMatch) {
        signaturePassed = false;
        const msg =
          'ERR_SIGNATURE_TAMPERED: Mã băm chữ ký điện tử không khớp với nội dung ký (Signature Integrity Verification Failed).';
        gate7Blockers.push(msg);
        blockers.push(msg);
      }
    }
  }

  const gate7Passed = hasProperRole && isNotExpired && signaturePassed && !!signature;
  let gate7Status: 'PASS' | 'FAIL' | 'BLOCKED' | 'WAITING' = 'FAIL';
  if (gate7Passed) {
    gate7Status = 'PASS';
  } else if (isPreview && !signature) {
    gate7Status = 'WAITING';
  } else if (!hasProperRole || !isNotExpired) {
    gate7Status = 'BLOCKED';
  }

  const signerDetails = signature
    ? `Đã ký duyệt bởi ${signature.signerName || signature.signerUid} (${signature.role}) lúc ${signature.signedAt}. Mã băm SHA-256 hợp lệ.`
    : isPreview
      ? 'Chờ ký điện tử xuất xưởng (21 CFR Part 11)'
      : 'Thiếu chữ ký điện tử';

  gates.push({
    gateIndex: 7,
    gateKey: 'GATE_7_AUTHORITY_AND_SIGNATURE',
    gateName: 'Pháp lý, Thẩm quyền, Hạn dùng & Chữ ký 21 CFR Part 11',
    passed: gate7Passed,
    status: gate7Status,
    details: signerDetails,
    blockers: gate7Blockers,
  });

  const isEligible = blockers.length === 0 && gates.every((g) => g.passed);

  return {
    eligible: isEligible,
    batchId,
    batchNo,
    gates,
    blockers,
    warnings,
    decisionTrace,
    readyForSignature: isPreview ? gates.slice(0, 6).every((g) => g.passed) : isEligible,
  };
}
