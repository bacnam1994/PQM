/**
 * PQM Domain - Canonical Status Resolver (Model 2)
 *
 * Chỉ Canonical Resolver được quyền quyết định trạng thái nghiệp vụ.
 * UI không được tự tính.
 * Repository không được tự tính.
 * Hook không được tự tính.
 * Service không được có một công thức khác.
 *
 * Đường ống chuẩn mực:
 * TCCS Snapshot
 *       ↓
 * CriterionEvaluator
 *       ↓
 * Test Result Evaluation
 *       ↓
 * OverallResultEvaluator
 *       ↓
 * Canonical Test Result Status
 *       ↓
 * CanonicalStatusResolver
 *       ↓
 * Canonical Batch Quality Status
 *       ↓
 * ReleaseRules / Release Gate
 *       ↓
 * QA Authorization
 *       ↓
 * State Machine
 *       ↓
 * Workflow Status
 */

import { Batch, TestResult, TestResultEntry, TCCS, Criterion } from '../../types';
import {
  TestResultStatus,
  BatchStatus,
  CanonicalBatchQualityStatus,
  CriterionPassStatus,
  CanonicalQualityEvaluation,
  CriterionEvaluationDetail,
  EvaluationDecisionTrace,
} from './canonicalStatus';
import {
  normalizeTestResultStatus,
  normalizeCriterionPassStatus,
  resolveTestResultStatus,
  resolveQualityStatus,
  resolveAuthoritativeTestResultForBatch,
  resolveFinalTestResultForBatch,
  resolveAuthoritativeTestResultsForBatch,
  detectTestResultStatusMismatch,
  calculateOverallStatusForTestResult,
  CanonicalTestStatus,
} from '../test-result/testResultStatusResolver';
import { isValidTestResultForBatch } from '../batch/batchIntegrityValidator';
import { CriterionEvaluator, isExemptValue } from '../evaluation/CriterionEvaluator';
import { AlternateRuleEvaluator } from '../evaluation/AlternateRuleEvaluator';
import { ensureArray } from '../../utils';
import { isCriteriaMatch } from '../../utils/aiMapping';

export { resolveQualityStatus, normalizeCriterionPassStatus };
export type { CriterionEvaluationDetail, EvaluationDecisionTrace };

export interface BatchQualityResolutionResult {
  batchId: string;
  batchQualityStatus: CanonicalBatchQualityStatus;
  authoritativeTestResult?: TestResult;
  authoritativeTestResults?: TestResult[];
  candidateTestCount: number;
  testStatus: TestResultStatus;
  criteriaSummary: {
    total: number;
    pass: number;
    fail: number;
    pending: number;
    unknown: number;
  };
  hasDiscrepancy: boolean;
  discrepancyDetails?: {
    expected: string;
    actual: string;
    reason: string;
  };
  evaluatedAt: string;
  resolverVersion: string;
  decisionTrace?: EvaluationDecisionTrace;
  completion?: {
    required: number;
    completed: number;
    percentage: number;
  };
  failedCriteria?: CriterionEvaluationDetail[];
  pendingCriteria?: CriterionEvaluationDetail[];
  unknownCriteria?: CriterionEvaluationDetail[];
  blockers?: string[];
}

export class CanonicalStatusResolver {
  public static readonly VERSION = '2.1.0-DECISION-TRACE-SSOT';

  /**
   * Phân giải Tiêu chuẩn cơ sở (TCCS) chính thức cho Lô sản xuất.
   * Thứ tự ưu tiên bắt buộc:
   * 1. batch.tccsSnapshot (đã đóng băng bất biến)
   * 2. boundTccs (khớp batch.tccsId)
   * 3. Tra cứu theo batch.tccsId từ allTccsList
   * 4. batch.tccs
   * TUYỆT ĐỐI KHÔNG TỰ ĐỘNG FALLBACK THEO productId!
   */
  public static resolveTccsForBatch(
    batch: Batch,
    boundTccs?: TCCS | null,
    allTccsList?: TCCS[]
  ): {
    tccs: TCCS | null;
    resolutionStatus:
      | 'SNAPSHOT_MATCH'
      | 'EXACT_ID_MATCH'
      | 'TCCS_RESOLUTION_ERROR'
      | 'TCCS_NOT_PROVIDED';
    errorReason?: string;
  } {
    if (!batch) {
      return {
        tccs: null,
        resolutionStatus: 'TCCS_RESOLUTION_ERROR',
        errorReason: 'Lô sản xuất không tồn tại hoặc không hợp lệ.',
      };
    }

    // 1. Ưu tiên số 1: TCCS Snapshot đã đóng băng trên Lô
    if ((batch as any).tccsSnapshot && typeof (batch as any).tccsSnapshot === 'object') {
      return {
        tccs: (batch as any).tccsSnapshot,
        resolutionStatus: 'SNAPSHOT_MATCH',
      };
    }

    // 2. Bound TCCS truyền vào trực tiếp nếu khớp batch.tccsId
    if (boundTccs && (!batch.tccsId || boundTccs.id === batch.tccsId)) {
      return {
        tccs: boundTccs,
        resolutionStatus: 'EXACT_ID_MATCH',
      };
    }

    // 3. Tra cứu theo batch.tccsId trong danh sách TCCS (allTccsList)
    if (batch.tccsId && Array.isArray(allTccsList) && allTccsList.length > 0) {
      const found = allTccsList.find((t) => t.id === batch.tccsId);
      if (found) {
        return {
          tccs: found,
          resolutionStatus: 'EXACT_ID_MATCH',
        };
      } else {
        // Có danh sách TCCS nhưng không tìm thấy TCCS khớp batch.tccsId -> CẤM fallback theo productId!
        return {
          tccs: null,
          resolutionStatus: 'TCCS_RESOLUTION_ERROR',
          errorReason: `Không tìm thấy TCCS có mã ID [${batch.tccsId}] tương ứng với Lô trong danh mục.`,
        };
      }
    }

    // 4. Batch có trường tccs nhúng sẵn
    if ((batch as any).tccs && (!batch.tccsId || (batch as any).tccs.id === batch.tccsId)) {
      return {
        tccs: (batch as any).tccs,
        resolutionStatus: 'EXACT_ID_MATCH',
      };
    }

    // Nếu không có batch.tccsId và boundTccs được truyền vào tường minh
    if (boundTccs) {
      return {
        tccs: boundTccs,
        resolutionStatus: 'EXACT_ID_MATCH',
      };
    }

    // Khi không có danh sách TCCS hay boundTccs truyền vào (ví dụ kiểm thử hoặc môi trường chỉ có phiếu)
    return {
      tccs: null,
      resolutionStatus: 'TCCS_NOT_PROVIDED',
      errorReason: 'Chưa có thông tin TCCS.',
    };
  }

  /**
   * Quyết định chất lượng chính thức cho Phiếu kiểm nghiệm (Model 2 Single Source of Truth).
   * Thứ tự ưu tiên: 1. Snapshot hợp lệ -> 2. Re-evaluate từ criteria/TCCS -> 3. Legacy status.
   */
  public static resolveQualityStatus(
    testResult: TestResult | null | undefined,
    boundTccs?: TCCS | null
  ): CanonicalTestStatus {
    return resolveQualityStatus(testResult, boundTccs);
  }

  /**
   * Bước 1: Validate TestResult tính toàn vẹn cơ bản
   */
  public static validateTestResult(testResult: TestResult | null | undefined): {
    isValid: boolean;
    reason?: string;
  } {
    if (!testResult) {
      return { isValid: false, reason: 'Phiếu kiểm nghiệm không tồn tại (null/undefined)' };
    }
    if (!testResult.id || typeof testResult.id !== 'string') {
      return { isValid: false, reason: 'Thiếu ID phiếu kiểm nghiệm hợp lệ' };
    }
    if (!testResult.batchId || typeof testResult.batchId !== 'string') {
      return { isValid: false, reason: 'Thiếu batchId liên kết lô sản xuất' };
    }
    if (!Array.isArray(testResult.results)) {
      return {
        isValid: false,
        reason: 'Danh sách kết quả chỉ tiêu không hợp lệ (không phải mảng)',
      };
    }
    return { isValid: true };
  }

  /**
   * Bước 2: Chọn phiếu authoritative cho lô (Authoritative Test Result Selection)
   */
  public static selectAuthoritativeResult(
    batch: Batch,
    candidateTestResults: TestResult[]
  ): TestResult | undefined {
    return resolveAuthoritativeTestResultForBatch(batch, candidateTestResults);
  }

  /**
   * Bước 3: Đánh giá danh sách chỉ tiêu (Evaluate Criteria)
   */
  public static evaluateCriteria(results: TestResultEntry[]): {
    total: number;
    pass: number;
    fail: number;
    pending: number;
    allPass: boolean;
  } {
    if (!Array.isArray(results) || results.length === 0) {
      return { total: 0, pass: 0, fail: 0, pending: 0, allPass: false };
    }

    let pass = 0;
    let fail = 0;
    let pending = 0;

    for (const r of results) {
      const status = normalizeCriterionPassStatus(r.isPass);
      if (status === true) {
        pass++;
      } else if (status === false) {
        fail++;
      } else {
        pending++;
      }
    }

    const total = results.length;
    const allPass = total > 0 && fail === 0 && pending === 0 && pass === total;

    return { total, pass, fail, pending, allPass };
  }

  /**
   * Bước 4: Tính trạng thái chuẩn của Phiếu kiểm nghiệm (Calculate Canonical Test Status)
   * Tôn trọng Source-of-Truth Precedence 3 tầng (Snapshot -> Re-evaluation -> Stored).
   */
  public static calculateCanonicalTestStatus(
    testResult: TestResult,
    boundTccs?: TCCS | null,
    allBatchResults?: TestResult[]
  ): TestResultStatus {
    const resolved = resolveTestResultStatus(testResult, { boundTccs, allBatchResults });
    if (resolved === 'PASS') return 'PASS';
    if (resolved === 'FAIL') return 'FAIL';
    if (resolved === 'PENDING') return 'PENDING';
    return 'INVALID';
  }

  /**
   * Bước 5: Tính trạng thái chất lượng chuẩn của Lô sản xuất (Calculate Canonical Batch Quality Status)
   * Hỗ trợ hợp nhất đa phiếu (Multi-Lab, Hóa lý vs Vi sinh) và độc lập với phiếu lịch sử cũ
   */
  public static calculateCanonicalBatchQualityStatus(
    batch: Batch,
    testResults: TestResult[],
    boundTccs?: TCCS | null
  ): CanonicalBatchQualityStatus {
    if (!batch) return 'INVALID';

    // Tìm các phiếu liên kết chính thức với batch
    const validTests = (testResults || []).filter(
      (tr) => tr && tr.batchId === batch.id && isValidTestResultForBatch(tr, batch)
    );

    if (validTests.length === 0) {
      if (batch.status === 'PENDING') {
        return 'NOT_TESTED';
      }
      if (batch.status === 'TESTING') {
        return 'TESTING';
      }
      return 'NOT_TESTED';
    }

    // Chọn phiếu authoritative chính thức cho batch
    const resolution = resolveFinalTestResultForBatch(batch, validTests, boundTccs);
    const authoritative = resolution.finalTestResult;
    if (!authoritative) {
      return 'INCOMPLETE';
    }

    // Sử dụng bộ giải pháp Multi-Lab authoritative chính quy
    const labAuthResults = resolveAuthoritativeTestResultsForBatch(batch, validTests, boundTccs);
    if (labAuthResults.length === 0) {
      return 'INCOMPLETE';
    }

    const labStatuses = labAuthResults.map((tr) =>
      this.calculateCanonicalTestStatus(tr, boundTccs, labAuthResults)
    );

    if (labStatuses.some((s) => s === 'FAIL')) {
      return 'FAIL';
    }
    if (labStatuses.some((s) => s === 'PENDING')) {
      return 'TESTING';
    }
    if (labStatuses.length > 0 && labStatuses.every((s) => s === 'PASS')) {
      return 'PASS';
    }

    return resolution.status === 'PASS'
      ? 'PASS'
      : resolution.status === 'FAIL'
        ? 'FAIL'
        : 'INCOMPLETE';
  }

  /**
   * Bước 6 & 7: Phân giải tổng thể, xây dựng Decision Trace, đối chiếu sai lệch (Full SSoT Resolution & Decision Trace)
   */
  public static resolveBatchQuality(
    batch: Batch,
    testResults: TestResult[],
    boundTccs?: TCCS | null,
    allTccsList?: TCCS[]
  ): BatchQualityResolutionResult {
    // 1. Phân giải TCCS chuẩn mực
    const tccsResolution = this.resolveTccsForBatch(batch, boundTccs, allTccsList);
    const resolvedTccs = tccsResolution.tccs;

    // 2. Lấy các phiếu hợp lệ
    const validTests = (testResults || []).filter(
      (tr) => tr && tr.batchId === batch?.id && isValidTestResultForBatch(tr, batch)
    );

    // 3. Chọn các phiếu authoritative
    const authoritative = this.selectAuthoritativeResult(batch, validTests);
    const authoritativeResults = resolveAuthoritativeTestResultsForBatch(
      batch,
      validTests,
      resolvedTccs
    );

    // 4. Đánh giá trạng thái chất lượng chuẩn hóa của Lô
    let batchQualityStatus: CanonicalBatchQualityStatus = 'NOT_TESTED';
    let qualityReason = '';
    const blockers: string[] = [];

    if (tccsResolution.resolutionStatus === 'TCCS_RESOLUTION_ERROR') {
      batchQualityStatus = 'INVALID';
      qualityReason = `TCCS_RESOLUTION_ERROR: ${tccsResolution.errorReason}`;
      blockers.push(qualityReason);
    } else if (validTests.length === 0) {
      batchQualityStatus = batch?.status === 'TESTING' ? 'TESTING' : 'NOT_TESTED';
      qualityReason = 'Chưa có phiếu kiểm nghiệm nào được ghi nhận cho Lô.';
      blockers.push('Chưa có kết quả kiểm nghiệm.');
    } else {
      batchQualityStatus = this.calculateCanonicalBatchQualityStatus(
        batch,
        validTests,
        resolvedTccs
      );
    }

    // 5. Chi tiết từng chỉ tiêu (CriterionEvaluations & Decision Trace)
    const requiredCriteria: Criterion[] = resolvedTccs
      ? [
          ...ensureArray(resolvedTccs.mainQualityCriteria),
          ...ensureArray(resolvedTccs.safetyCriteria),
        ].filter((c) => c && c.name && c.name.trim() !== '')
      : [];

    const criterionEvaluations: CriterionEvaluationDetail[] = [];
    const failedCriteria: CriterionEvaluationDetail[] = [];
    const pendingCriteria: CriterionEvaluationDetail[] = [];
    const unknownCriteria: CriterionEvaluationDetail[] = [];

    // Lập bản đồ các kết quả authoritative theo tên chỉ tiêu
    const authoritativeMap = new Map<string, TestResultEntry>();
    const sortedAuth = [...authoritativeResults].sort((a: any, b: any) => {
      const vA = a.version || a.revision || 0;
      const vB = b.version || b.revision || 0;
      if (vA !== vB) return vA - vB;
      const dateA = a.updatedAt || a.testDate || a.createdAt || '';
      const dateB = b.updatedAt || b.testDate || b.createdAt || '';
      return dateA.localeCompare(dateB);
    });

    sortedAuth.forEach((tr) => {
      ensureArray(tr.results).forEach((r) => {
        if (!r.isExtra && r.criteriaName) {
          authoritativeMap.set(r.criteriaName.trim().toLowerCase(), r);
        }
      });
    });

    const missingCriteriaNames: string[] = [];

    // Helper tra cứu kết quả chỉ tiêu hỗ trợ cả Exact match O(1) và Ngữ nghĩa dược khoa (isCriteriaMatch)
    const findAuthoritativeEntry = (targetName: string): TestResultEntry | undefined => {
      if (!targetName) return undefined;
      const lower = targetName.trim().toLowerCase();
      // 1. Ưu tiên tra cứu chính xác O(1)
      if (authoritativeMap.has(lower)) {
        return authoritativeMap.get(lower);
      }
      // 2. Tra cứu đối chiếu ngữ nghĩa dược khoa (từ điển hoạt chất, nguyên tố, alias)
      for (const [key, val] of authoritativeMap.entries()) {
        if (isCriteriaMatch(key, targetName) || isCriteriaMatch(targetName, key)) {
          return val;
        }
      }
      return undefined;
    };

    requiredCriteria.forEach((crit) => {
      const cName = crit.name.trim();
      const entry = findAuthoritativeEntry(cName);

      const minNum = crit.min !== undefined && crit.min !== null ? Number(crit.min) : undefined;
      const maxNum = crit.max !== undefined && crit.max !== null ? Number(crit.max) : undefined;
      const limitText =
        minNum !== undefined && maxNum !== undefined
          ? `${minNum} ~ ${maxNum}`
          : minNum !== undefined
            ? `≥ ${minNum}`
            : maxNum !== undefined
              ? `≤ ${maxNum}`
              : crit.expectedText || 'Theo TCCS';

      const isValueEmpty =
        !entry ||
        entry.value === null ||
        entry.value === undefined ||
        String(entry.value).trim() === '';

      const isValueExempt =
        !isValueEmpty &&
        (isExemptValue(entry.value) ||
          entry.isExempted === true ||
          (normalizeCriterionPassStatus(entry.isPass) === true && isExemptValue(entry.value)));

      // Kiểm tra miễn kiểm theo Alternate Rules
      let isExemptedByRule = false;
      if (resolvedTccs?.alternateRules) {
        isExemptedByRule = AlternateRuleEvaluator.checkRuleExemption(
          cName,
          (name) => {
            const e = findAuthoritativeEntry(name);
            return e ? e.value : undefined;
          },
          resolvedTccs,
          {
            rulesMap: new Map(
              (resolvedTccs.alternateRules || []).map((r) => [
                (r.alt || '').trim().toLowerCase(),
                r,
              ])
            ),
            allCriteria: requiredCriteria,
            criteriaMap: new Map(requiredCriteria.map((c) => [c.name.trim().toLowerCase(), c])),
          },
          authoritativeMap
        );
      }

      if (isValueExempt || (isValueEmpty && isExemptedByRule)) {
        const exemptedDetail: CriterionEvaluationDetail = {
          criterionName: cName,
          expectedLimit: limitText,
          actualValue: isValueExempt ? String(entry?.value) : 'Miễn kiểm (quy tắc thay thế)',
          unit: crit.unit,
          isPass: true,
          status: 'PASS',
          evaluationMethod: 'EXEMPTION',
          isExempted: true,
        };
        criterionEvaluations.push(exemptedDetail);
      } else if (isValueEmpty) {
        missingCriteriaNames.push(cName);
        const pendingDetail: CriterionEvaluationDetail = {
          criterionName: cName,
          expectedLimit: limitText,
          actualValue: 'Chưa kiểm',
          unit: crit.unit,
          isPass: null,
          status: 'PENDING',
          evaluationMethod: 'TEXT',
        };
        criterionEvaluations.push(pendingDetail);
        pendingCriteria.push(pendingDetail);
      } else {
        const evalRes = CriterionEvaluator.evaluateCriterion(crit, entry.value);
        // Nếu chỉ tiêu này được miễn kiểm theo quy tắc thay thế nhưng vẫn nhập giá trị thử nghiệm,
        // và giá trị thử nghiệm không đạt (FAIL), theo logic CONDITIONAL_CHECK của GMP, chỉ tiêu phụ này vẫn được miễn kiểm
        const isPass = evalRes.isPass === true || isExemptedByRule;
        const detail: CriterionEvaluationDetail = {
          criterionName: cName,
          expectedLimit: limitText,
          actualValue: entry.value,
          unit: crit.unit || entry.unit,
          isPass,
          status: isPass ? 'PASS' : evalRes.isPass === false ? 'FAIL' : 'UNKNOWN',
          evaluationMethod: isExemptedByRule
            ? 'EXEMPTION'
            : crit.type === 'NUMBER'
              ? 'NUMERIC'
              : 'TEXT',
          isExempted: isExemptedByRule || undefined,
          storedIsPass: entry.isPass,
          recalculatedIsPass: evalRes.isPass,
          note: isExemptedByRule ? 'Miễn kiểm theo quy tắc thay thế' : evalRes.reason,
        };
        criterionEvaluations.push(detail);

        if (detail.status === 'FAIL') {
          failedCriteria.push(detail);
        } else if (detail.status === 'UNKNOWN') {
          unknownCriteria.push(detail);
        }
      }
    });

    if (requiredCriteria.length === 0 && authoritative && Array.isArray(authoritative.results)) {
      authoritative.results.forEach((r) => {
        const detail: CriterionEvaluationDetail = {
          criterionName: r.criteriaName || '',
          expectedLimit: (r as any).limit || 'N/A',
          actualValue: r.value,
          unit: r.unit,
          isPass: r.isPass,
          status: r.isPass === true ? 'PASS' : r.isPass === false ? 'FAIL' : 'UNKNOWN',
          storedIsPass: r.isPass,
          recalculatedIsPass: r.isPass,
        };
        criterionEvaluations.push(detail);
        if (detail.status === 'FAIL') {
          failedCriteria.push(detail);
        } else if (detail.status === 'UNKNOWN') {
          unknownCriteria.push(detail);
        }
      });
    }

    const requiredCount =
      requiredCriteria.length > 0 ? requiredCriteria.length : criterionEvaluations.length;
    const completedCount =
      requiredCriteria.length > 0
        ? requiredCount - pendingCriteria.length
        : criterionEvaluations.length;
    const completionPercentage =
      requiredCount > 0
        ? Math.round((completedCount / requiredCount) * 100)
        : validTests.length > 0
          ? 100
          : 0;
    const isComplete = requiredCount > 0 ? pendingCriteria.length === 0 : validTests.length > 0;

    // 6. Trạng thái chất lượng chính thức từ calculateCanonicalBatchQualityStatus
    batchQualityStatus = this.calculateCanonicalBatchQualityStatus(batch, validTests, resolvedTccs);

    // Nếu calculateCanonicalBatchQualityStatus là PASS nhưng còn chỉ tiêu bắt buộc chưa kiểm và không có snapshot hợp lệ
    const isSnapshotPass = authoritative?.evaluationSnapshot?.overallStatus === 'PASS';
    if (
      batchQualityStatus === 'PASS' &&
      requiredCriteria.length > 0 &&
      pendingCriteria.length > 0 &&
      !isSnapshotPass
    ) {
      batchQualityStatus = 'INCOMPLETE';
      blockers.push(`Còn ${pendingCriteria.length} chỉ tiêu chưa kiểm nghiệm hoàn tất.`);
      if (!qualityReason) {
        qualityReason = `Chưa hoàn thành kiểm nghiệm đầy đủ (${completedCount}/${requiredCount} chỉ tiêu).`;
      }
    } else if (batchQualityStatus === 'FAIL') {
      blockers.push(
        `Có ${failedCriteria.length > 0 ? failedCriteria.length : 1} chỉ tiêu không đạt chuẩn quy định.`
      );
      if (!qualityReason) {
        qualityReason = `Phát hiện chỉ tiêu không đạt chuẩn quy định.`;
      }
    } else if (batchQualityStatus === 'PASS') {
      qualityReason = 'Tất cả các chỉ tiêu đều đạt chuẩn quy định.';
    }

    // 7. Tính toán điều kiện Release Gate độc lập
    const isEligibleForRelease =
      batchQualityStatus === 'PASS' &&
      isComplete &&
      batch?.status !== 'RELEASED' &&
      batch?.status !== 'REJECTED' &&
      blockers.length === 0;

    let testStatus: TestResultStatus = 'PENDING';
    let criteriaSummary = {
      total: criterionEvaluations.length,
      pass: criterionEvaluations.filter((c) => c.status === 'PASS').length,
      fail: failedCriteria.length,
      pending: pendingCriteria.length,
      unknown: unknownCriteria.length,
    };

    if (authoritative) {
      testStatus = this.calculateCanonicalTestStatus(authoritative, resolvedTccs, validTests);
      if (requiredCriteria.length === 0) {
        const evalCrit = this.evaluateCriteria(authoritative.results || []);
        criteriaSummary = {
          total: evalCrit.total,
          pass: evalCrit.pass,
          fail: evalCrit.fail,
          pending: evalCrit.pending,
          unknown: 0,
        };
      }
    }

    // 7. Phát hiện sai lệch (Discrepancy Detection)
    let hasDiscrepancy = false;
    let discrepancyDetails: { expected: string; actual: string; reason: string } | undefined;

    if (batch?.status === 'RELEASED' && batchQualityStatus !== 'PASS') {
      hasDiscrepancy = true;
      discrepancyDetails = {
        expected: 'PASS (Phiếu kiểm nghiệm đạt chuẩn)',
        actual: `${batchQualityStatus} (Trạng thái chất lượng thực tế)`,
        reason:
          'Lô sản xuất đã xuất xưởng nhưng không có phiếu kiểm nghiệm đạt chuẩn authoritative.',
      };
    }

    if (authoritative) {
      const storedNorm = normalizeTestResultStatus(authoritative.overallStatus);
      if (storedNorm === 'PASS' && testStatus === 'FAIL') {
        hasDiscrepancy = true;
        discrepancyDetails = {
          expected: 'FAIL',
          actual: 'PASS',
          reason: `Phiếu ghi nhận ĐẠT nhưng có ${criteriaSummary.fail} chỉ tiêu không đạt.`,
        };
      } else if (storedNorm === 'FAIL' && testStatus === 'PASS') {
        hasDiscrepancy = true;
        discrepancyDetails = {
          expected: 'PASS',
          actual: 'FAIL',
          reason: 'Phiếu ghi nhận KHÔNG ĐẠT nhưng tất cả chỉ tiêu đều đạt.',
        };
      }
    }

    // 8. Đóng gói Decision Trace hoàn chỉnh
    const decisionTrace: EvaluationDecisionTrace = {
      batchId: batch?.id || '',
      batchNo: batch?.batchNo || '',
      productId: batch?.productId || '',
      productName: (batch as any)?.product?.name,
      tccsId: resolvedTccs?.id || batch?.tccsId,
      tccsVersion: (resolvedTccs as any)?.version || (resolvedTccs as any)?.code,
      tccsSnapshotHash:
        (batch as any)?.tccsSnapshotHash || (batch as any)?.evaluationSnapshot?.evaluationHash,
      tccsResolutionStatus: tccsResolution.resolutionStatus,
      evaluationVersion: this.VERSION,
      completion: {
        requiredCount,
        testedCount: completedCount,
        percentage: completionPercentage,
        isComplete,
        missingCriteria: missingCriteriaNames,
      },
      authoritativeTestResults: authoritativeResults.map((tr) => ({
        id: tr.id,
        labName: tr.labName || '',
        testDate: tr.testDate || '',
        status: String((tr as any).status || ''),
        overallStatus: String(tr.overallStatus || ''),
        isFinal: (tr as any).isFinal,
      })),
      criterionEvaluations,
      failedCriteria,
      pendingCriteria,
      unknownCriteria,
      qualityStatus: batchQualityStatus,
      canonicalQualityStatus: batchQualityStatus,
      qualityReason:
        qualityReason ||
        (batchQualityStatus === 'PASS' ? 'Tất cả các chỉ tiêu đều đạt chuẩn quy định.' : ''),
      releaseEligibility: {
        isEligible: isEligibleForRelease,
        score: isEligibleForRelease
          ? 100
          : Math.max(0, 100 - failedCriteria.length * 30 - pendingCriteria.length * 10),
        blockers,
        recommendation: isEligibleForRelease
          ? 'Lô đủ điều kiện kỹ thuật để QA xem xét xuất xưởng.'
          : `Chưa đủ điều kiện xuất xưởng: ${blockers.join('; ')}`,
      },
      workflowStatus: batch?.status || 'PENDING',
      timestamp: new Date().toISOString(),
    };

    return {
      batchId: batch?.id || '',
      batchQualityStatus,
      authoritativeTestResult: authoritative,
      authoritativeTestResults: authoritativeResults,
      candidateTestCount: validTests.length,
      testStatus,
      criteriaSummary,
      hasDiscrepancy,
      discrepancyDetails,
      evaluatedAt: new Date().toISOString(),
      resolverVersion: this.VERSION,
      decisionTrace,
      completion: {
        required: requiredCount,
        completed: completedCount,
        percentage: completionPercentage,
      },
      failedCriteria,
      pendingCriteria,
      unknownCriteria,
      blockers,
    };
  }
}
