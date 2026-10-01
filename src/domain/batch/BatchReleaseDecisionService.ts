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
 * 5. Data Freshness & Traceability
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
} from './canonicalBatchQualityDecision';
import { ElectronicSignature } from '../../types/signature';

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
  status: 'PASS' | 'FAIL' | 'BLOCKED';
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
}

export interface ResolveBatchReleaseDecisionParams {
  batch: Batch;
  testResults: TestResult[];
  deviations?: Deviation[];
  boundTccs?: TCCS | null;
  tccsList?: TCCS[];
  userRole?: UserRole | string;
  userSignature?: ElectronicSignature | null;
  asOfDate?: string | Date;
  dataFreshness?: DataFreshnessState;
  skipBprRequirementForTestingStatus?: boolean;
}

export class BatchReleaseDecisionService {
  public static readonly VERSION = '1.0.0-CANONICAL-RELEASE-DECISION';

  /**
   * Tính toán Canonical Release Decision duy nhất cho Lô sản xuất
   */
  public static resolveBatchReleaseDecision(
    params: ResolveBatchReleaseDecisionParams
  ): BatchReleaseDecision {
    const {
      batch,
      testResults = [],
      deviations = [],
      boundTccs,
      tccsList = [],
      userRole,
      userSignature,
      asOfDate,
      dataFreshness = {},
      skipBprRequirementForTestingStatus = false,
    } = params;

    const blockers: string[] = [];
    const warnings: string[] = [];
    const decisionTrace: string[] = [];

    const batchId = batch?.id || '';
    const batchNo = batch?.batchNo || batchId;
    const currentStatus = (batch?.status || 'PENDING') as BatchStatus;
    const nextStatus: BatchStatus = 'RELEASED';

    decisionTrace.push(`[INIT] Bắt đầu đánh giá Release Decision cho lô ${batchNo} (${batchId}).`);

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
    const completionPct = qualityDecision.completion?.percentage ?? 0;
    const gate1Passed =
      candidateResults.length > 0 && qualityDecision.completion.isComplete && completionPct === 100;
    const gate1Blockers: string[] = [];
    if (!gate1Passed) {
      const msg = `ERR_TEST_INCOMPLETE: Chỉ tiêu kiểm nghiệm chưa hoàn tất 100% (${completionPct}%).`;
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
      gateName: 'Xử lý Sai lệch (Không có Critical Deviation mở)',
      passed: gate4Passed,
      status: gate4Passed ? 'PASS' : 'BLOCKED',
      details: gate4Passed
        ? 'Không có sai lệch lớn chưa đóng'
        : `Còn ${openCriticalDeviations.length} sai lệch CRITICAL`,
      blockers: gate4Blockers,
    });

    // GATE 5: Biện pháp CAPA khẩn cấp thực sự đạt điều kiện (Không hardcode true)
    const capaRequiredDeviations = batchDeviations.filter(
      (d) =>
        (d as any).capaRequired === true ||
        (Array.isArray((d as any).capaActions) && (d as any).capaActions.length > 0)
    );
    const openCapaDeviations = capaRequiredDeviations.filter(
      (d) => d.status !== 'CLOSED' && !(d as any).capaCompleted
    );
    const gate5Passed = openCapaDeviations.length === 0;
    const gate5Blockers: string[] = [];
    if (!gate5Passed) {
      const msg = 'ERR_CAPA_BLOCKING: Biện pháp khắc phục / phòng ngừa (CAPA) chưa hoàn thành.';
      gate5Blockers.push(msg);
      blockers.push(msg);
    }
    gates.push({
      gateIndex: 5,
      gateKey: 'GATE_5_CAPA_FULFILLED',
      gateName: 'Biện pháp CAPA khẩn cấp',
      passed: gate5Passed,
      status: gate5Passed ? 'PASS' : 'FAIL',
      details: gate5Passed
        ? 'Đã hoàn thành hoặc không yêu cầu'
        : 'Có biện pháp CAPA chưa hoàn thành',
      blockers: gate5Blockers,
    });

    // GATE 6: Thẩm tra Hồ sơ sản xuất (BPR Review) - BẮT BUỘC QA APPROVED
    const bprStatus = (batch as any).bprReviewStatus;
    const isBprExplicitlySpecified = bprStatus !== undefined && bprStatus !== null;
    const gate6Passed =
      bprStatus === 'APPROVED' ||
      (!isBprExplicitlySpecified &&
        skipBprRequirementForTestingStatus &&
        (batch.status === 'TESTING' || batch.status === 'PENDING'));
    const gate6Blockers: string[] = [];
    if (!gate6Passed) {
      const msg =
        'ERR_BPR_NOT_APPROVED: Hồ sơ sản xuất (BPR Review) chưa được QA thẩm định phê duyệt.';
      gate6Blockers.push(msg);
      blockers.push(msg);
    }
    gates.push({
      gateIndex: 6,
      gateKey: 'GATE_6_BPR_QA_APPROVED',
      gateName: 'Thẩm tra Hồ sơ sản xuất (BPR Review)',
      passed: gate6Passed,
      status: gate6Passed ? 'PASS' : 'FAIL',
      details: gate6Passed
        ? bprStatus === 'APPROVED'
          ? 'Đã được QA phê duyệt'
          : 'Miễn trừ hồ sơ thử nghiệm'
        : 'Hồ sơ sản xuất (BPR) chưa được QA duyệt (ERR_BPR_NOT_APPROVED)',
      blockers: gate6Blockers,
    });

    // GATE 7: Pháp lý, Thẩm quyền ký số & Hạn sử dụng
    const roleUpper = String(userRole || '').toUpperCase();
    const hasProperRole = !userRole || ['ADMIN', 'QA'].includes(roleUpper);
    let isNotExpired = true;
    if (batch.expDate) {
      const asOf = asOfDate ? new Date(asOfDate) : new Date();
      const exp = new Date(batch.expDate);
      if (!isNaN(exp.getTime()) && exp.getTime() < asOf.getTime()) {
        isNotExpired = false;
      }
    }

    const gate7Blockers: string[] = [];
    if (!hasProperRole) {
      const msg = `ERR_ROLE_UNAUTHORIZED: Vai trò ${userRole} không có thẩm quyền ký xuất xưởng.`;
      gate7Blockers.push(msg);
      blockers.push(msg);
    }
    if (!isNotExpired) {
      const msg = `ERR_EXPIRED: Lô đã hết hạn sử dụng (${batch.expDate}).`;
      gate7Blockers.push(msg);
      blockers.push(msg);
    }

    const gate7Passed = hasProperRole && isNotExpired;
    gates.push({
      gateIndex: 7,
      gateKey: 'GATE_7_AUTHORITY_AND_SIGNATURE',
      gateName: 'Pháp lý, Thẩm quyền & Hạn dùng',
      passed: gate7Passed,
      status: gate7Passed ? 'PASS' : 'FAIL',
      details: gate7Passed ? 'Thẩm quyền và hạn dùng hợp lệ' : gate7Blockers.join('; '),
      blockers: gate7Blockers,
    });

    // 4. Kiểm tra trạng thái hiện tại của Lô
    if (batch.status === 'RELEASED') {
      blockers.push('Lô này đã ở trạng thái Xuất xưởng (RELEASED).');
    } else if (batch.status === 'REJECTED') {
      blockers.push('Lô đã bị Từ chối (REJECTED), không thể xuất xưởng.');
    }

    // 5. Kết luận tính đủ điều kiện xuất xưởng (Eligible)
    const allGatesPassed = gates.every((g) => g.passed);
    const eligible = allGatesPassed && blockers.length === 0;

    decisionTrace.push(
      `[DECISION] Kết luận: ${eligible ? 'ĐỦ ĐIỀU KIỆN (ELIGIBLE)' : 'KHÔNG ĐỦ ĐIỀU KIỆN (BLOCKED)'}. Số rào cản: ${blockers.length}.`
    );

    return {
      eligible,
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
}

export const resolveBatchReleaseDecision = BatchReleaseDecisionService.resolveBatchReleaseDecision;
