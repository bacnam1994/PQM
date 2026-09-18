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
 * TestResult
 *     ↓
 * validate
 *     ↓
 * select authoritative result
 *     ↓
 * evaluate criteria
 *     ↓
 * calculate canonical test status
 *     ↓
 * calculate canonical batch quality status
 *     ↓
 * compare stored derived status
 *     ↓
 * detect discrepancy
 */

import { Batch, TestResult, TestResultEntry, TCCS } from '../../types';
import {
  TestResultStatus,
  BatchStatus,
  CanonicalBatchQualityStatus,
  CriterionPassStatus,
  CanonicalQualityEvaluation,
} from './canonicalStatus';
import {
  normalizeTestResultStatus,
  normalizeCriterionPassStatus,
  resolveTestResultStatus,
  resolveAuthoritativeTestResultForBatch,
  resolveFinalTestResultForBatch,
  resolveAuthoritativeTestResultsForBatch,
  detectTestResultStatusMismatch,
  calculateOverallStatusForTestResult,
  CanonicalTestStatus,
} from '../test-result/testResultStatusResolver';
import { isValidTestResultForBatch } from '../batch/batchIntegrityValidator';

export interface BatchQualityResolutionResult {
  batchId: string;
  batchQualityStatus: CanonicalBatchQualityStatus;
  authoritativeTestResult?: TestResult;
  candidateTestCount: number;
  testStatus: TestResultStatus;
  criteriaSummary: {
    total: number;
    pass: number;
    fail: number;
    pending: number;
  };
  hasDiscrepancy: boolean;
  discrepancyDetails?: {
    expected: string;
    actual: string;
    reason: string;
  };
  evaluatedAt: string;
  resolverVersion: string;
}

export class CanonicalStatusResolver {
  public static readonly VERSION = '2.0.0-CANONICAL-PIPELINE';

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
    const validTests = testResults.filter(
      (tr) => tr.batchId === batch.id && isValidTestResultForBatch(tr, batch)
    );

    if (validTests.length === 0) {
      // Nếu không có phiếu nào nhưng batch đang ở trạng thái PENDING
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

    // Sử dụng bộ giải pháp Multi-Lab authoritative chính quy (Mục 8, 9, 10, 11)
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
   * Bước 6 & 7: Phân giải tổng thể, đối chiếu trạng thái lưu trữ & phát hiện sai lệch (Compare & Detect Discrepancy)
   */
  public static resolveBatchQuality(
    batch: Batch,
    testResults: TestResult[],
    boundTccs?: TCCS | null
  ): BatchQualityResolutionResult {
    const authoritative = this.selectAuthoritativeResult(batch, testResults);
    const batchQualityStatus = this.calculateCanonicalBatchQualityStatus(
      batch,
      testResults,
      boundTccs
    );

    let testStatus: TestResultStatus = 'PENDING';
    let criteriaSummary = { total: 0, pass: 0, fail: 0, pending: 0 };

    if (authoritative) {
      testStatus = this.calculateCanonicalTestStatus(authoritative, boundTccs, testResults);
      const evalCrit = this.evaluateCriteria(authoritative.results || []);
      criteriaSummary = {
        total: evalCrit.total,
        pass: evalCrit.pass,
        fail: evalCrit.fail,
        pending: evalCrit.pending,
      };
    }

    let hasDiscrepancy = false;
    let discrepancyDetails: { expected: string; actual: string; reason: string } | undefined;

    // Kiểm tra sai lệch: Nếu batch đã RELEASED mà quality không phải PASS
    if (batch.status === 'RELEASED' && batchQualityStatus !== 'PASS') {
      hasDiscrepancy = true;
      discrepancyDetails = {
        expected: 'PASS (Phiếu kiểm nghiệm đạt chuẩn)',
        actual: `${batchQualityStatus} (Trạng thái chất lượng thực tế)`,
        reason:
          'Lô sản xuất đã xuất xưởng nhưng không có phiếu kiểm nghiệm đạt chuẩn authoritative.',
      };
    }

    // Kiểm tra sai lệch nội bộ phiếu: Stored overallStatus !== calculated test status
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

    return {
      batchId: batch.id,
      batchQualityStatus,
      authoritativeTestResult: authoritative,
      candidateTestCount: testResults.filter((tr) => tr.batchId === batch.id).length,
      testStatus,
      criteriaSummary,
      hasDiscrepancy,
      discrepancyDetails,
      evaluatedAt: new Date().toISOString(),
      resolverVersion: this.VERSION,
    };
  }
}
