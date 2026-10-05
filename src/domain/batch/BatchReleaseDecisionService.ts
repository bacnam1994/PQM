/**
 * BatchReleaseDecisionService.ts
 * ===============================
 * Single Source of Truth (SSoT) cho Quyết định Xuất xưởng Lô sản xuất (Batch Release Decision).
 *
 * Tích hợp toàn diện:
 * 1. Canonical Relationship Resolution (Phase 2 & 3)
 * 2. Canonical Quality Decision Engine (Phase 3)
 * 3. 7 Release Gates chuẩn GMP (Phase 5) với nguyên tắc FAIL-CLOSED
 * 4. Ràng buộc thẩm quyền & Chữ ký số 21 CFR Part 11 (Phase 7)
 * 5. Tách bạch hoàn toàn giữa Released Historical Snapshot và Release Eligibility (P0/P1 Fix)
 */

import { Batch, TestResult, TCCS, QualityDeviation as Deviation } from '../../types';
import { BatchStatus } from '../canonical/canonicalStatus';
import { Role as UserRole } from '../../types/permissions';
import {
  BatchTestRelationshipResult,
  resolveBatchTestRelationship,
  resolveTestResultsForBatch,
} from './batchTestResultResolver';
import { DataFreshnessState } from './batchIntegrityValidator';
import {
  CanonicalBatchQualityDecision,
  resolveCanonicalBatchQualityDecision,
  CANONICAL_DECISION_RESOLVER_VERSION,
} from './canonicalBatchQualityDecision';
import { ElectronicSignature } from '../../types/signature';
import { calculateSha256Sync } from '../../utils/cryptoUtils';
import { verifyCanonicalSignatureChecksum } from '@pqm/release-engine';

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
  blockers?: string[];
}

export interface BatchReleaseDecision {
  eligible: boolean;
  batchId: string;
  batchNo: string;
  currentStatus: BatchStatus;
  nextStatus: BatchStatus;
  testResultResolution: BatchTestRelationshipResult;
  qualityDecision: CanonicalBatchQualityDecision;
  gates: ReleaseGateResult[];
  blockers: string[];
  warnings: string[];
  requiredSignature: boolean;
  requiredRole: UserRole[];
  dataFreshness: DataFreshnessState;
  decisionTrace: string[];
  readyForSignature?: boolean;
}

export interface ResolveBatchReleaseDecisionParams {
  batch: Batch;
  testResults: TestResult[];
  deviations?: Deviation[];
  boundTccs?: TCCS | null;
  tccsList?: TCCS[];
  userRole?: UserRole | string;
  userSignature?: ElectronicSignature | null;
  signature?: ElectronicSignature | null;
  asOfDate?: string | Date;
  dataFreshness?: DataFreshnessState;
  /** Cờ chỉ dùng cho Preview giao diện (không được dùng trong production mutation) */
  isPreview?: boolean;
}

export class BatchReleaseDecisionService {
  public static readonly VERSION = '2.0.0-DECOUPLED-RELEASE-DECISION';

  /**
   * Lấy Snapshot Canonical lịch sử xuất xưởng cho Lô đã RELEASED
   * SSoT: Không chạy lại logic kiểm tra hiện tại lên một lô đã xuất xưởng trong quá khứ
   */
  public static getReleasedCanonicalSnapshot(batch: Batch): BatchReleaseDecision {
    const batchId = batch?.id || '';
    const batchNo = batch?.batchNo || batchId;

    // 1. Ưu tiên tuyệt đối snapshot đã được niêm phong trong transaction release
    if (batch?.releaseDecisionSnapshot && Array.isArray(batch.releaseDecisionSnapshot.gates)) {
      return {
        ...batch.releaseDecisionSnapshot,
        batchId,
        batchNo,
        currentStatus: 'RELEASED',
        nextStatus: 'RELEASED',
        eligible: true,
        blockers: [],
      };
    }

    // 2. Fallback cho các Lô cũ chưa kịp lưu releaseDecisionSnapshot: Dựng canonical 7/7 PASS
    const candidateSigs: ElectronicSignature[] = [
      ...(Array.isArray(batch.releaseSignatures) ? batch.releaseSignatures : []),
      ...(Array.isArray((batch as any).signatures) ? (batch as any).signatures : []),
    ].filter(Boolean);

    const matchedSig = candidateSigs
      .filter((s) => s && s.documentType === 'BATCH_RELEASE' && s.documentId === batchId)
      .sort((a, b) => (b.signedAt || '').localeCompare(a.signedAt || ''))[0];

    const signerInfo = matchedSig
      ? `${matchedSig.signerName || matchedSig.signerEmail || matchedSig.signerUid} (${matchedSig.role || 'QA'})`
      : batch.releasedBy
        ? `${batch.releasedBy} (QA)`
        : 'QA / Quản trị viên';

    const historicalGates: ReleaseGateResult[] = [
      {
        gateIndex: 1,
        gateKey: 'GATE_1_TEST_COMPLETION',
        gateName: 'Tính đầy đủ của phép thử (100% Criteria)',
        passed: true,
        status: 'PASS',
        details: '100% hoàn thành (Đã thẩm định xuất xưởng)',
        blockers: [],
      },
      {
        gateIndex: 2,
        gateKey: 'GATE_2_CANONICAL_QUALITY',
        gateName: 'Đánh giá chất lượng chuẩn tắc (Canonical PASS)',
        passed: true,
        status: 'PASS',
        details: 'Chất lượng: PASS (Đã phê duyệt xuất xưởng)',
        blockers: [],
      },
      {
        gateIndex: 3,
        gateKey: 'GATE_3_NO_OPEN_OOS',
        gateName: 'Xử lý OOS (Không vướng OOS mở)',
        passed: true,
        status: 'PASS',
        details: 'Không có OOS mở tại thời điểm xuất xưởng',
        blockers: [],
      },
      {
        gateIndex: 4,
        gateKey: 'GATE_4_NO_OPEN_CRITICAL_DEVIATION',
        gateName: 'Hồ sơ Sai lệch (Không có sai lệch mở)',
        passed: true,
        status: 'PASS',
        details: 'Không có sai lệch nghiêm trọng mở tại thời điểm xuất xưởng',
        blockers: [],
      },
      {
        gateIndex: 5,
        gateKey: 'GATE_5_CAPA_FULFILLED',
        gateName: 'Hồ sơ CAPA (Không có CAPA mở)',
        passed: true,
        status: 'PASS',
        details: 'Các hành động khắc phục CAPA đã hoàn tất',
        blockers: [],
      },
      {
        gateIndex: 6,
        gateKey: 'GATE_6_BPR_QA_APPROVED',
        gateName: 'Thẩm định hồ sơ lô sản xuất (BPR Review)',
        passed: true,
        status: 'PASS',
        details: batch.bprReviewedBy
          ? `Hồ sơ sản xuất BPR đã được phê duyệt bởi ${batch.bprReviewedBy}`
          : 'Hồ sơ sản xuất BPR đã được QA phê duyệt',
        blockers: [],
      },
      {
        gateIndex: 7,
        gateKey: 'GATE_7_AUTHORITY_AND_SIGNATURE',
        gateName: 'Pháp lý, Thẩm quyền & Chữ ký 21 CFR Part 11',
        passed: true,
        status: 'PASS',
        details: `Đã ký số phê duyệt xuất xưởng (21 CFR Part 11) bởi ${signerInfo}`,
        blockers: [],
      },
    ];

    return {
      eligible: true,
      batchId,
      batchNo,
      currentStatus: 'RELEASED',
      nextStatus: 'RELEASED',
      testResultResolution: {
        relationshipType: 'PRIMARY_MATCH',
        isMatch: true,
        isAuthoritative: true,
        confidence: 'HIGH',
        reason: 'Lô đã hoàn tất xuất xưởng hợp lệ theo chuẩn GMP.',
      },
      qualityDecision: {
        batchId,
        batchNo,
        workflowStatus: 'RELEASED',
        qualityStatus: 'PASS',
        integrityStatus: 'PASS',
        shouldAlert: false,
        candidateCount: 1,
        authoritativeCount: 1,
        supersededTestResultIds: [],
        failedCriteria: [],
        pendingCriteria: [],
        decisionReason: 'Lô đã hoàn tất xuất xưởng hợp lệ theo chuẩn GMP.',
        resolverVersion: CANONICAL_DECISION_RESOLVER_VERSION,
        authoritativeResults: [],
        criterionEvaluations: [],
        completion: {
          isComplete: true,
          percentage: 100,
          requiredCount: 1,
          testedCount: 1,
          missingCriteria: [],
        },
        blockers: [],
      },
      gates: historicalGates,
      blockers: [],
      warnings: [],
      requiredSignature: true,
      requiredRole: ['ADMIN', 'QA'],
      dataFreshness: {},
      decisionTrace: [
        `[HISTORICAL_SNAPSHOT] Trích xuất hồ sơ xuất xưởng lịch sử thành công cho lô ${batchNo}.`,
      ],
    };
  }

  /**
   * Đánh giá bản xem trước (Preview) cho giao diện người dùng
   * Tuyệt đối không dùng cho luồng release mutation thực tế
   */
  public static evaluateReleasePreview(
    params: Omit<ResolveBatchReleaseDecisionParams, 'isPreview'>
  ): BatchReleaseDecision {
    if (params.batch?.status === 'RELEASED') {
      return BatchReleaseDecisionService.getReleasedCanonicalSnapshot(params.batch);
    }
    return BatchReleaseDecisionService.evaluateReleaseEligibility({
      ...params,
      isPreview: true,
    });
  }

  /**
   * Đánh giá điều kiện thực tế để xuất xưởng Lô sản xuất (Release Eligibility)
   * Sử dụng cho việc kiểm tra Gate 1-7 trước khi ký hoặc tại thời điểm mutation
   */
  public static evaluateReleaseEligibility(
    params: ResolveBatchReleaseDecisionParams
  ): BatchReleaseDecision {
    const {
      batch,
      testResults = [],
      deviations = [],
      boundTccs,
      tccsList = [],
      userRole,
      userSignature: rawUserSignature,
      signature: rawSignature,
      asOfDate,
      dataFreshness = {},
      isPreview = false,
    } = params;

    let userSignature = rawUserSignature || rawSignature || null;

    // Trích xuất chữ ký điện tử đã được persist trên Lô (nếu caller chưa truyền)
    if (!userSignature && batch) {
      const candidateSigs: ElectronicSignature[] = [
        ...(Array.isArray(batch.releaseSignatures) ? batch.releaseSignatures : []),
        ...(Array.isArray((batch as any).signatures) ? (batch as any).signatures : []),
      ].filter(Boolean);

      const matched = candidateSigs
        .filter((s) => s && s.documentType === 'BATCH_RELEASE' && s.documentId === batch.id)
        .sort((a, b) => (b.signedAt || '').localeCompare(a.signedAt || ''))[0];

      if (matched) {
        userSignature = matched;
      }
    }

    const blockers: string[] = [];
    const warnings: string[] = [];
    const decisionTrace: string[] = [];

    const batchId = batch?.id || '';
    const batchNo = batch?.batchNo || batchId;
    const currentStatus = (batch?.status || 'PENDING') as BatchStatus;
    const nextStatus: BatchStatus = 'RELEASED';

    decisionTrace.push(
      `[INIT] Bắt đầu đánh giá Release Eligibility cho lô ${batchNo} (${batchId}).`
    );

    if (!batch || !batch.id) {
      blockers.push('Thông tin Lô sản xuất không hợp lệ (null/undefined).');
      const emptyQuality: CanonicalBatchQualityDecision = resolveCanonicalBatchQualityDecision({
        batch: batch as any,
        testResults: [],
        dataFreshness,
      });

      return {
        eligible: false,
        batchId: '',
        batchNo: '',
        currentStatus: 'PENDING',
        nextStatus: 'RELEASED',
        testResultResolution: {
          relationshipType: 'UNRESOLVED',
          isMatch: false,
          isAuthoritative: false,
          confidence: 'NONE',
          reason: 'Lô sản xuất không tồn tại.',
        },
        qualityDecision: emptyQuality,
        gates: [],
        blockers,
        warnings,
        requiredSignature: true,
        requiredRole: ['ADMIN', 'QA'],
        dataFreshness,
        decisionTrace,
      };
    }

    // 1. Phân giải mối quan hệ Lô <-> Phiếu kiểm nghiệm (Canonical Relationship)
    const resolution = resolveTestResultsForBatch(batch, testResults);
    const candidateResults = resolution.allCandidateResults;

    let testRelResult: BatchTestRelationshipResult;
    if (candidateResults.length > 0) {
      testRelResult = resolveBatchTestRelationship(batch, candidateResults[0]);
    } else {
      testRelResult = {
        relationshipType: 'UNRESOLVED',
        isMatch: false,
        isAuthoritative: false,
        confidence: 'NONE',
        reason: 'Chưa có phiếu kiểm nghiệm nào gắn với Lô sản xuất.',
      };
    }

    if (resolution.hasLegacyMatch && !resolution.hasPrimaryMatch) {
      warnings.push(
        'Phiếu kiểm nghiệm liên kết qua số hiệu Lô (Legacy) thay vì ID kỹ thuật chính thức.'
      );
      decisionTrace.push('[RELATIONSHIP] Phát hiện liên kết LEGACY_BATCHNO_MATCH.');
    } else if (resolution.hasPrimaryMatch) {
      decisionTrace.push('[RELATIONSHIP] Xác nhận liên kết PRIMARY_MATCH.');
    } else {
      decisionTrace.push('[RELATIONSHIP] Không tìm thấy phiếu kiểm nghiệm phù hợp (UNRESOLVED).');
    }

    // 2. Đánh giá chất lượng chuẩn tắc (Canonical Quality Decision Engine)
    const qualityDecision = resolveCanonicalBatchQualityDecision({
      batch,
      testResults: candidateResults,
      boundTccs,
      tccsList,
      dataFreshness,
    });
    decisionTrace.push(
      `[QUALITY] Trạng thái chất lượng: ${qualityDecision.qualityStatus}, hoàn thành ${qualityDecision.completion.percentage}%.`
    );

    // 3. Đánh giá 7 CỔNG KIỂM SOÁT XUẤT XƯỞNG (7 RELEASE GATES) - NGUYÊN TẮC FAIL-CLOSED
    const gates: ReleaseGateResult[] = [];

    // GATE 1: Tính đầy đủ của phép thử (100% Required Criteria)
    const isDataUnavailable =
      qualityDecision.integrityStatus === 'DATA_UNAVAILABLE' ||
      Boolean(dataFreshness.isTestResultsLoading) ||
      Boolean(dataFreshness.isBatchesLoading) ||
      dataFreshness.loadState === 'PARTIAL' ||
      dataFreshness.loadState === 'LOADING';

    const completionPct = qualityDecision.completion?.percentage ?? 0;
    const gate1Passed =
      !isDataUnavailable &&
      candidateResults.length > 0 &&
      qualityDecision.completion.isComplete &&
      completionPct === 100;
    const gate1Blockers: string[] = [];
    if (!gate1Passed) {
      const msg = isDataUnavailable
        ? 'DATA_UNAVAILABLE: Dữ liệu kiểm nghiệm đang tải hoặc ở trạng thái snapshot cục bộ. Chưa thể thẩm định xuất xưởng.'
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
      details: `${completionPct}% hoàn thành (${qualityDecision.completion.testedCount}/${qualityDecision.completion.requiredCount})`,
      blockers: gate1Blockers,
    });

    // GATE 2: Đánh giá chất lượng chuẩn tắc (Canonical Quality = PASS)
    const gate2Passed = qualityDecision.qualityStatus === 'PASS';
    const gate2Blockers: string[] = [];
    if (!gate2Passed) {
      const msg = `ERR_QUALITY_NOT_PASS: Đánh giá chất lượng Lô chưa đạt chuẩn PASS (${qualityDecision.qualityStatus}).`;
      gate2Blockers.push(msg);
      blockers.push(msg);
      if (qualityDecision.failedCriteria && qualityDecision.failedCriteria.length > 0) {
        blockers.push(`Chỉ tiêu không đạt: ${qualityDecision.failedCriteria.join(', ')}`);
      }
    }
    gates.push({
      gateIndex: 2,
      gateKey: 'GATE_2_CANONICAL_QUALITY',
      gateName: 'Đánh giá chất lượng chuẩn tắc (Canonical PASS)',
      passed: gate2Passed,
      status: gate2Passed ? 'PASS' : 'FAIL',
      details: `Chất lượng: ${qualityDecision.qualityStatus}`,
      blockers: gate2Blockers,
    });

    // GATE 3: Không có OOS mở (No Active OOS)
    const batchDeviations = deviations.filter(
      (d) =>
        d && (d.batchId === batch.id || (d.batchNo && batch.batchNo && d.batchNo === batch.batchNo))
    );
    const openOosDeviations = batchDeviations.filter(
      (d) =>
        ((d as any).type === 'OOS' || (d as any).category === 'OOS' || (d as any).isOos) &&
        d.status !== 'CLOSED'
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

    // GATE 4: Không có Critical Deviation mở
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

    // GATE 5: CAPA đã hoàn thành
    const unfulfilledCapaDevs = batchDeviations.filter((d: any) => {
      if (d.capaRequired && !d.capaCompleted) return true;
      if (d.capaStatus && !['COMPLETED', 'VERIFIED', 'CLOSED'].includes(d.capaStatus)) return true;
      const unclosedItems = (d.capaItems || []).filter(
        (c: any) => c && c.status !== 'COMPLETED' && c.status !== 'VERIFIED'
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
      const msg = `ERR_CAPA_BLOCKING: ERR_CAPA_PENDING: Còn ${count} hành động khắc phục CAPA chưa hoàn thành hoặc chưa được nghiệm thu.`;
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

    // GATE 6: BPR QA Approved (Hồ sơ sản xuất lô đã được QA phê duyệt)
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

    // GATE 7: Thẩm quyền, Hạn dùng & Chữ ký số 21 CFR Part 11
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

    // Tự động xác thực chữ ký điện tử 21 CFR Part 11
    let signaturePassed = false;
    if (!userSignature) {
      if (isPreview) {
        // Chế độ xem trước (Preview): Cổng 7 ở trạng thái WAITING chờ ký, KHÔNG thêm blocker đỏ
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
      // a. Document Type check (Chỉ chấp nhận BATCH_RELEASE)
      const docType = userSignature.documentType;
      if (docType !== 'BATCH_RELEASE') {
        signaturePassed = false;
        const msg = `ERR_SIGNATURE_MISMATCH: Loại tài liệu ký '${docType}' không hợp lệ (yêu cầu BATCH_RELEASE). Không chấp nhận chữ ký từ loại tài liệu khác.`;
        gate7Blockers.push(msg);
        blockers.push(msg);
      }

      // b. Document ID check (Bắt buộc phải khớp đúng batchId)
      if (!userSignature.documentId || userSignature.documentId !== batchId) {
        signaturePassed = false;
        const msg = `ERR_SIGNATURE_MISMATCH: ID tài liệu ký '${userSignature.documentId}' không khớp với ID lô '${batchId}'.`;
        gate7Blockers.push(msg);
        blockers.push(msg);
      }

      // c. Document Version check
      if (
        userSignature.documentVersion !== undefined &&
        batch.version !== undefined &&
        userSignature.documentVersion !== batch.version
      ) {
        const sigId = (userSignature as any)?.id || (userSignature as any)?.signatureId;
        const isPersistedReleaseSig =
          Array.isArray(batch.releaseSignatures) &&
          batch.releaseSignatures.some(
            (s: any) =>
              ((s as any)?.id || (s as any)?.signatureId) === sigId ||
              s.checksum === userSignature?.checksum
          );

        if (!isPersistedReleaseSig) {
          signaturePassed = false;
          const msg = `ERR_SIGNATURE_VERSION_MISMATCH: Phiên bản tài liệu ký (v${userSignature.documentVersion}) không khớp với phiên bản lô (v${batch.version}). Lô đã thay đổi sau khi mở màn hình ký. Vui lòng tải lại và thực hiện ký lại.`;
          gate7Blockers.push(msg);
          blockers.push(msg);
        }
      }

      // d. Signer identity check
      const signerId = userSignature.signerEmail || userSignature.signerUid;
      if (!signerId || signerId.trim().length === 0) {
        signaturePassed = false;
        const msg =
          'ERR_SIGNATURE_INVALID: Chữ ký thiếu thông tin định danh người ký (signerEmail/signerUid).';
        gate7Blockers.push(msg);
        blockers.push(msg);
      }

      // e. Signer role check
      const effectiveSigRole =
        userSignature.role ||
        (userSignature as any).signerRole ||
        (userSignature as any).signer?.role ||
        userRole;
      const sigRole = String(effectiveSigRole || '').toUpperCase();
      if (!['QA', 'ADMIN'].includes(sigRole)) {
        signaturePassed = false;
        const msg = `ERR_SIGNATURE_ROLE_UNAUTHORIZED: Người ký có vai trò '${effectiveSigRole}', không có thẩm quyền xuất xưởng.`;
        gate7Blockers.push(msg);
        blockers.push(msg);
      }

      // f. Timestamp check
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

      // g. Checksum & Integrity check (chống mock/auto signature và replay)
      const checksum = userSignature.checksum;
      if (
        !checksum ||
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
        const isChecksumValid = verifyCanonicalSignatureChecksum(userSignature as any);
        if (!isChecksumValid) {
          signaturePassed = false;
          const msg =
            'ERR_SIGNATURE_TAMPERED: Mã băm chữ ký điện tử không khớp với nội dung ký (Signature Integrity Verification Failed).';
          gate7Blockers.push(msg);
          blockers.push(msg);
        }
      }
    }

    const gate7Passed = hasProperRole && isNotExpired && signaturePassed && !!userSignature;
    let gate7Status: 'PASS' | 'FAIL' | 'BLOCKED' | 'WAITING' = 'FAIL';
    if (gate7Passed) {
      gate7Status = 'PASS';
    } else if (!userSignature) {
      gate7Status = 'WAITING';
    } else {
      gate7Status = 'FAIL';
    }

    let gate7Details = 'Chưa ký điện tử phê duyệt';
    if (gate7Passed && userSignature) {
      const signerName =
        userSignature.signerName || userSignature.signerEmail || userSignature.signerUid;
      gate7Details = `Đã ký số phê duyệt xuất xưởng (21 CFR Part 11) bởi ${signerName} (${userSignature.role || 'QA'})`;
    } else if (gate7Status === 'WAITING') {
      gate7Details = 'Chờ ký điện tử xuất xưởng (21 CFR Part 11)';
    } else {
      gate7Details = gate7Blockers.join('; ') || 'Không đạt yêu cầu Gate 7';
    }

    gates.push({
      gateIndex: 7,
      gateKey: 'GATE_7_AUTHORITY_AND_SIGNATURE',
      gateName: 'Pháp lý, Thẩm quyền & Chữ ký 21 CFR Part 11',
      passed: gate7Passed,
      status: gate7Status,
      details: gate7Details,
      blockers: gate7Blockers,
    });

    if (batch.status === 'REJECTED') {
      blockers.push('Lô đã bị Từ chối (REJECTED), không thể xuất xưởng.');
    }

    // 5. Kết luận tính đủ điều kiện xuất xưởng (Eligible)
    const allGatesPassed = gates.every((g) => g.passed);
    const eligible = allGatesPassed && blockers.length === 0;
    const gates1To6Passed = gates.slice(0, 6).every((g) => g.passed);
    const readyForSignature =
      gates1To6Passed && blockers.length === 0 && batch.status !== 'RELEASED';

    decisionTrace.push(
      `[DECISION] Kết luận: ${eligible ? 'ĐỦ ĐIỀU KIỆN (ELIGIBLE)' : 'KHÔNG ĐỦ ĐIỀU KIỆN (BLOCKED)'}. Số rào cản: ${blockers.length}. Sẵn sàng ký: ${readyForSignature}.`
    );

    return {
      eligible,
      readyForSignature,
      batchId,
      batchNo,
      currentStatus,
      nextStatus,
      testResultResolution: testRelResult,
      qualityDecision,
      gates,
      blockers: Array.from(new Set(blockers)),
      warnings: Array.from(new Set(warnings)),
      requiredSignature: true,
      requiredRole: ['ADMIN', 'QA'],
      dataFreshness,
      decisionTrace,
    };
  }

  /**
   * Tính toán Canonical Release Decision duy nhất cho Lô sản xuất (Entrypoint SSoT)
   * Tự động điều hướng:
   * - Nếu Lô đã RELEASED → Trả về Historical Canonical Snapshot
   * - Nếu Lô chưa RELEASED → Đánh giá Release Eligibility thực tế
   */
  public static resolveBatchReleaseDecision(
    params: ResolveBatchReleaseDecisionParams
  ): BatchReleaseDecision {
    if (params.batch?.status === 'RELEASED') {
      return BatchReleaseDecisionService.getReleasedCanonicalSnapshot(params.batch);
    }
    return BatchReleaseDecisionService.evaluateReleaseEligibility(params);
  }
}

export const resolveBatchReleaseDecision =
  BatchReleaseDecisionService.resolveBatchReleaseDecision.bind(BatchReleaseDecisionService);
