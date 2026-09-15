/**
 * testResultStatusResolver.ts
 * ============================
 * Canonical Domain Utility giải quyết và chuẩn hóa trạng thái Đạt/Không Đạt của Phiếu kiểm nghiệm (Test Result).
 *
 * Nguyên tắc cốt lõi (ALCOA+ & GMP):
 * 1. Single Source of Truth cho việc phân giải trạng thái:
 *    - Tuyệt đối không so sánh string ngây thơ (ví dụ: `status === 'Đạt'` hay `overallStatus !== 'PASS'`).
 *    - Chuẩn hóa toàn diện mọi biến thể biểu diễn dữ liệu ("Đạt", "ĐẠT", "PASS", "Pass", "Không đạt", "FAIL", boolean, number...).
 * 2. Ngăn chặn triệt để False Positive (Cảnh báo sai lệch giả):
 *    - UNKNOWN / PENDING / DRAFT tuyệt đối KHÔNG được đánh đồng với FAIL.
 *    - Đang tải dữ liệu (Data Freshness: `isTestResultsLoading === true` hoặc `testResultsLoaded === false`) không được so sánh.
 *    - Phiếu nháp (DRAFT), phiếu hủy (CANCELLED/VOIDED) không được coi là kết quả chính thức đối đầu với Lô.
 *    - Phiếu kiểm nghiệm nhiều chỉ tiêu hoặc nhiều phiếu thành phần trong cùng 1 Lô (ví dụ: Hóa lý vs Vi sinh)
 *      được xử lý hợp nhất (Consolidated) để áp dụng đúng quy tắc điều kiện `alternateRules`.
 * 3. Bảo vệ an toàn cho Auto-Heal:
 *    - Không tự ý lật ngược kết quả thực tế (PASS <-> FAIL) khi không có chứng cứ xác thực (High Confidence).
 *    - Chỉ tự động chuẩn hóa định dạng (Format Normalization: "Đạt" -> "PASS").
 */

import { Batch, TestResult, TestResultEntry, TCCS } from '../../types';
import { TEST_RESULT_STATUS, EVALUATION_RULE } from '../../utils/constants';
import { normalizeName } from '../../services/criteriaAliasService';
import { CriterionEvaluator } from '../evaluation/CriterionEvaluator';

export type CanonicalTestStatus = 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';

export type TestResultRelationshipType =
  | 'PRIMARY'
  | 'LEGACY_BATCH_NO'
  | 'INVALID_ORPHAN'
  | 'INVALID_EMPTY_BATCH_ID';

export interface BatchFinalTestResultResolution {
  batchId: string;
  batchNo: string;
  relationshipType: 'PRIMARY' | 'LEGACY' | 'NONE';
  candidateCount: number;
  primaryCount: number;
  legacyCount: number;
  finalTestResult?: TestResult;
  status: CanonicalTestStatus;
  isConsolidated: boolean;
  hasPassTest: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  diagnostics: string[];
}

export interface TestResultMismatchDetectionOptions {
  testResult: TestResult;
  batch?: Batch;
  boundTccs?: TCCS | null;
  allTestResultsForBatch?: TestResult[];
  dataFreshness?: {
    isTestResultsLoading?: boolean;
    testResultsLoaded?: boolean;
    isError?: boolean;
  };
}

export interface TestResultMismatchDiagnostic {
  hasMismatch: boolean;
  shouldAlert: boolean;
  alertType?: 'CRITICAL' | 'WARNING' | 'INFO';
  expectedStatus: CanonicalTestStatus;
  actualStatus: CanonicalTestStatus;
  batchId?: string;
  batchNo?: string;
  testResultId: string;
  testResultLabName: string;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  isAutoHealable: boolean;
  suggestedAction?: string;
  autoHealPayload?: {
    testResultId: string;
    correctStatus: 'PASS' | 'FAIL';
  };
  diagnosticDetails: {
    storedStatusRaw: unknown;
    storedStatusCanonical: CanonicalTestStatus;
    computedStatusCanonical: CanonicalTestStatus;
    hasCriteriaFailures: boolean;
    failedCriteriaCount: number;
    totalCriteriaCount: number;
    evaluatedWithTccs: boolean;
    dataReady: boolean;
  };
}

/**
 * 1. Chuẩn hóa chuỗi hoặc giá trị bất kỳ về trạng thái kết quả kiểm nghiệm chuẩn:
 * 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN'
 */
export function normalizeTestResultStatus(value: unknown): CanonicalTestStatus {
  if (value === null || value === undefined) {
    return 'UNKNOWN';
  }

  // Xử lý kiểu boolean
  if (typeof value === 'boolean') {
    return value ? 'PASS' : 'FAIL';
  }

  // Xử lý kiểu số
  if (typeof value === 'number') {
    if (value === 1) return 'PASS';
    if (value === 0) return 'FAIL';
    return 'UNKNOWN';
  }

  // Xử lý chuỗi
  const str = String(value).trim().toUpperCase();
  if (!str) return 'UNKNOWN';

  // Nhóm ĐẠT (PASS)
  const passKeywords = [
    'PASS',
    'PASSED',
    'PASSING',
    'ĐẠT',
    'ĐAT',
    'DAT',
    'OK',
    'MEETS_SPEC',
    'MEET_SPEC',
    'CONFORMS',
    'CONFORMING',
    'HOÀN THÀNH',
    'APPROVED',
    'SUCCESS',
  ];
  if (passKeywords.includes(str) || str.startsWith('ĐẠT') || str.startsWith('DAT')) {
    return 'PASS';
  }

  // Nhóm KHÔNG ĐẠT (FAIL)
  const failKeywords = [
    'FAIL',
    'FAILED',
    'FAILING',
    'KHÔNG ĐẠT',
    'KHONG ĐAT',
    'KHONG DAT',
    'KHONG_DAT',
    'NOT_PASSED',
    'NOT PASSED',
    'REJECTED',
    'OOS',
    'OUT_OF_SPEC',
    'LOẠI',
    'BỊ LOẠI',
    'ERROR',
  ];
  if (
    failKeywords.includes(str) ||
    str.includes('KHÔNG ĐẠT') ||
    str.includes('KHONG DAT') ||
    str.includes('KHONG_DAT')
  ) {
    return 'FAIL';
  }

  // Nhóm CHỜ / ĐANG KIỂM NGHIỆM / NHÁP (PENDING)
  const pendingKeywords = [
    'PENDING',
    'TESTING',
    'IN_PROGRESS',
    'IN PROGRESS',
    'PROCESSING',
    'ĐANG KIỂM NGHIỆM',
    'DANG KIEM NGHIEM',
    'CHƯA CÓ KẾT LUẬN',
    'CHUA CO KET LUAN',
    'DRAFT',
    'NHÁP',
    'NHAP',
    'WAITING',
    'NEW',
  ];
  if (
    pendingKeywords.includes(str) ||
    str.includes('ĐANG KIỂM') ||
    str.includes('CHƯA') ||
    str.includes('DRAFT')
  ) {
    return 'PENDING';
  }

  return 'UNKNOWN';
}

/**
 * 2. Chuẩn hóa cờ đạt của từng chỉ tiêu riêng lẻ (isPass)
 */
export function normalizeCriterionPassStatus(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  const norm = normalizeTestResultStatus(value);
  if (norm === 'PASS') return true;
  if (norm === 'FAIL') return false;
  return null;
}

/**
 * 3. Thẩm định và trích xuất trạng thái được lưu (Stored Status) của Phiếu kiểm nghiệm
 * Quét qua danh sách các thuộc tính khả dĩ theo thứ tự ưu tiên ALCOA+:
 * 1. overallStatus
 * 2. status
 * 3. overallResult
 * 4. result
 * 5. resultStatus
 * 6. conclusion
 * 7. conclusionStatus
 * 8. evaluationSnapshot.overallStatus
 * 9. isPassed / passed / pass
 */
export function resolveTestResultStatus(testResult: unknown): CanonicalTestStatus {
  if (!testResult || typeof testResult !== 'object') {
    return 'UNKNOWN';
  }

  const tr = testResult as Record<string, any>;

  // 1. Quét các trường status cấp tài liệu
  const candidateFields = [
    tr.overallStatus,
    tr.overallResult,
    tr.status,
    tr.resultStatus,
    tr.result,
    tr.conclusion,
    tr.conclusionStatus,
    tr.qualityStatus,
    tr.evaluationSnapshot?.overallStatus,
  ];

  for (const field of candidateFields) {
    if (field !== undefined && field !== null && String(field).trim() !== '') {
      const normalized = normalizeTestResultStatus(field);
      if (normalized !== 'UNKNOWN') {
        return normalized;
      }
    }
  }

  // 2. Quét các trường boolean
  if (typeof tr.isPassed === 'boolean') return tr.isPassed ? 'PASS' : 'FAIL';
  if (typeof tr.passed === 'boolean') return tr.passed ? 'PASS' : 'FAIL';
  if (typeof tr.pass === 'boolean') return tr.pass ? 'PASS' : 'FAIL';

  // 3. Nếu không có trường tổng thể, kiểm tra mảng kết quả results
  if (Array.isArray(tr.results) && tr.results.length > 0) {
    let hasFail = false;
    let hasPass = false;

    for (const r of tr.results) {
      if (!r) continue;
      const criterionPass = normalizeCriterionPassStatus(r.isPass);
      if (criterionPass === false) {
        hasFail = true;
      } else if (criterionPass === true) {
        hasPass = true;
      }
    }

    if (hasFail) return 'FAIL';
    if (hasPass) return 'PASS';
    return 'PENDING';
  }

  return 'UNKNOWN';
}

/**
 * Helper so khớp tên chỉ tiêu không phân biệt dấu và khoảng trắng
 */
function isCriteriaNameMatch(nameA?: string, nameB?: string): boolean {
  if (!nameA || !nameB) return false;
  return normalizeName(nameA) === normalizeName(nameB);
}

/**
 * 4. Tính toán kết quả thực tế của Phiếu kiểm nghiệm dựa trên các chỉ tiêu thực tế
 * Có hỗ trợ đầy đủ quy tắc thay thế (Alternate Rules: FAIL_RETRY & CONDITIONAL_CHECK)
 * và hợp nhất chỉ tiêu nếu cùng một Lô có nhiều phiếu kiểm nghiệm chia theo lab.
 */
export function calculateOverallStatusForTestResult(
  testResult: TestResult,
  boundTccs?: TCCS | null,
  allBatchResults?: TestResult[]
): CanonicalTestStatus {
  if (!testResult || !Array.isArray(testResult.results) || testResult.results.length === 0) {
    return 'UNKNOWN';
  }

  const currentResults = testResult.results;

  // Hợp nhất các chỉ tiêu của tất cả phiếu thuộc lô (nếu có) để phục vụ tra cứu quy tắc thay thế
  const consolidatedCriteriaMap = new Map<string, TestResultEntry>();
  if (Array.isArray(allBatchResults) && allBatchResults.length > 0) {
    allBatchResults.forEach((tr) => {
      (tr.results || []).forEach((entry) => {
        if (entry && entry.criteriaName) {
          const key = normalizeName(entry.criteriaName);
          consolidatedCriteriaMap.set(key, entry);
        }
      });
    });
  } else {
    currentResults.forEach((entry) => {
      if (entry && entry.criteriaName) {
        const key = normalizeName(entry.criteriaName);
        consolidatedCriteriaMap.set(key, entry);
      }
    });
  }

  const rules = boundTccs?.alternateRules || [];

  // Lọc các chỉ tiêu rớt trong phiếu hiện tại
  const failures = currentResults.filter((r) => normalizeCriterionPassStatus(r.isPass) === false);

  for (const fail of failures) {
    // 1. CONDITIONAL_CHECK: Kiểm tra xem chỉ tiêu rớt này có thuộc chỉ tiêu phụ được miễn kiểm không?
    const condRuleWhereThisIsAlt = rules.find(
      (r) =>
        r.type === EVALUATION_RULE.CONDITIONAL_CHECK &&
        isCriteriaNameMatch(r.alt, fail.criteriaName)
    );

    if (condRuleWhereThisIsAlt) {
      const mainResult = consolidatedCriteriaMap.get(normalizeName(condRuleWhereThisIsAlt.main));
      if (mainResult && mainResult.value !== undefined && mainResult.value !== '') {
        const isTriggered = CriterionEvaluator.checkRange(
          condRuleWhereThisIsAlt.conditionValue || '',
          String(mainResult.value)
        );
        // Nếu điều kiện KHÔNG bị kích hoạt -> chỉ tiêu phụ này được MIỄN KIỂM -> Bỏ qua lỗi
        if (isTriggered !== true) continue;
      }
    }

    // 2. FAIL_RETRY: Kiểm tra xem có quy tắc thử lại cứu chỉ tiêu rớt này không
    const retryRule = rules.find(
      (r: any) =>
        isCriteriaNameMatch(r.main, fail.criteriaName) &&
        (!r.type || r.type === EVALUATION_RULE.FAIL_RETRY)
    );

    if (retryRule) {
      const altResult = consolidatedCriteriaMap.get(normalizeName(retryRule.alt));
      if (
        altResult &&
        altResult.value !== undefined &&
        altResult.value !== '' &&
        normalizeCriterionPassStatus(altResult.isPass) === true
      ) {
        // Đã được cứu bởi chỉ tiêu thử lại đạt
        continue;
      }
    }

    // Không được miễn và không có luật cứu -> Thất bại
    return 'FAIL';
  }

  // 3. CONDITIONAL_CHECK bị kích hoạt: Chỉ áp dụng nếu chỉ tiêu chính nằm trong phiếu này
  const conditionalRules = rules.filter((r: any) => r.type === EVALUATION_RULE.CONDITIONAL_CHECK);
  for (const rule of conditionalRules) {
    const mainResult = currentResults.find((r) => isCriteriaNameMatch(r.criteriaName, rule.main));
    if (mainResult && mainResult.value !== undefined && mainResult.value !== '') {
      const isTriggered = CriterionEvaluator.checkRange(
        rule.conditionValue || '',
        String(mainResult.value)
      );

      if (isTriggered === true) {
        const altResult = consolidatedCriteriaMap.get(normalizeName(rule.alt));
        if (
          !altResult ||
          altResult.value === undefined ||
          altResult.value === '' ||
          normalizeCriterionPassStatus(altResult.isPass) === false
        ) {
          // Bị kích hoạt nhưng chỉ tiêu phụ chưa làm hoặc không đạt
          return 'FAIL';
        }
      }
    }
  }

  // Kiểm tra xem có ít nhất một chỉ tiêu đạt hợp lệ không
  const hasValidPass = currentResults.some((r) => normalizeCriterionPassStatus(r.isPass) === true);
  if (hasValidPass) return 'PASS';

  // Nếu toàn bộ đều null/undefined/rỗng -> PENDING
  return 'PENDING';
}

/**
 * 5. Canonical Batch Result Resolver:
 * Xác định phiếu kiểm nghiệm chính thức / hiện hành cho Lô sản xuất
 */
export function resolveFinalTestResultForBatch(
  batch: Batch,
  testResults: TestResult[] = [],
  boundTccs?: TCCS | null
): BatchFinalTestResultResolution {
  const diagnostics: string[] = [];

  if (!batch) {
    return {
      batchId: '',
      batchNo: '',
      relationshipType: 'NONE',
      candidateCount: 0,
      primaryCount: 0,
      legacyCount: 0,
      status: 'UNKNOWN',
      isConsolidated: false,
      hasPassTest: false,
      confidence: 'LOW',
      diagnostics: ['Batch object is undefined or empty.'],
    };
  }

  // 1. Phân loại quan hệ theo Technical ID (PRIMARY) và Legacy (batchNo)
  const normalizedBatchNo = (batch.batchNo || '').trim().toLowerCase();
  const primaryCandidates: TestResult[] = [];
  const legacyCandidates: TestResult[] = [];

  testResults.forEach((tr) => {
    if (!tr) return;
    // Bỏ qua bản ghi đã bị xóa mềm
    if ((tr as any).isDeleted || (tr as any).deleted) return;

    // Bỏ qua bản ghi bị hủy / vô hiệu
    const trStatusUpper = String((tr as any).status || '').toUpperCase();
    if (
      trStatusUpper === 'CANCELLED' ||
      trStatusUpper === 'VOIDED' ||
      trStatusUpper === 'INVALID'
    ) {
      return;
    }

    const trBatchId = (tr.batchId || '').trim();
    const trBatchNo = ((tr as any).batchNo || '').trim().toLowerCase();

    if (trBatchId === batch.id) {
      primaryCandidates.push(tr);
    } else if (
      (trBatchId && trBatchId.toLowerCase() === normalizedBatchNo) ||
      (trBatchNo && trBatchNo === normalizedBatchNo)
    ) {
      legacyCandidates.push(tr);
    }
  });

  const candidates = primaryCandidates.length > 0 ? primaryCandidates : legacyCandidates;
  const relationshipType =
    primaryCandidates.length > 0 ? 'PRIMARY' : legacyCandidates.length > 0 ? 'LEGACY' : 'NONE';

  if (candidates.length === 0) {
    diagnostics.push(`Lô "${batch.batchNo}" (${batch.id}) không có phiếu kiểm nghiệm nào.`);
    return {
      batchId: batch.id,
      batchNo: batch.batchNo,
      relationshipType: 'NONE',
      candidateCount: 0,
      primaryCount: 0,
      legacyCount: 0,
      status: 'UNKNOWN',
      isConsolidated: false,
      hasPassTest: false,
      confidence: 'HIGH',
      diagnostics,
    };
  }

  // 2. Ưu tiên phiếu APPROVED / FINAL hơn DRAFT / TESTING
  const finalizedCandidates = candidates.filter((tr) => {
    const s = String((tr as any).status || '').toUpperCase();
    return s === 'APPROVED' || s === 'FINAL' || s === 'RELEASED' || (tr as any).isFinal === true;
  });

  const workingCandidates = finalizedCandidates.length > 0 ? finalizedCandidates : candidates;

  // 3. Sắp xếp tìm bản ghi hiện hành (ưu tiên version cao hơn, ngày test hoặc updatedAt mới hơn)
  const sorted = [...workingCandidates].sort((a, b) => {
    const vA = (a as any).version || (a as any).revision || 0;
    const vB = (b as any).version || (b as any).revision || 0;
    if (vA !== vB) return vB - vA;

    const dateA = a.updatedAt || a.testDate || a.createdAt || '';
    const dateB = b.updatedAt || b.testDate || b.createdAt || '';
    return dateB.localeCompare(dateA);
  });

  const finalTestResult = sorted[0];

  // 4. Đánh giá trạng thái
  const hasPassTest = candidates.some((tr) => resolveTestResultStatus(tr) === 'PASS');

  // Tính trạng thái hợp nhất
  const consolidatedMap = new Map<string, TestResultEntry>();
  candidates.forEach((tr) => {
    (tr.results || []).forEach((r) => {
      if (r && r.criteriaName) {
        consolidatedMap.set(normalizeName(r.criteriaName), r);
      }
    });
  });
  const consolidatedList = Array.from(consolidatedMap.values());
  const isConsolidated = candidates.length > 1;

  let computedStatus: CanonicalTestStatus = resolveTestResultStatus(finalTestResult);

  if (computedStatus === 'UNKNOWN' || computedStatus === 'PENDING') {
    computedStatus = calculateOverallStatusForTestResult(finalTestResult, boundTccs, candidates);
  }

  const confidence = relationshipType === 'PRIMARY' ? 'HIGH' : 'MEDIUM';
  diagnostics.push(
    `Đã chọn phiếu kiểm nghiệm [${finalTestResult.id}] (${finalTestResult.labName}) với trạng thái ${computedStatus}.`
  );

  return {
    batchId: batch.id,
    batchNo: batch.batchNo,
    relationshipType,
    candidateCount: candidates.length,
    primaryCount: primaryCandidates.length,
    legacyCount: legacyCandidates.length,
    finalTestResult,
    status: computedStatus,
    isConsolidated,
    hasPassTest,
    confidence,
    diagnostics,
  };
}

/**
 * 6. Canonical Mismatch Detector:
 * Đối chiếu phát hiện sai lệch giữa kết quả lưu trên phiếu và kết quả tính toán theo chỉ tiêu thực tế
 */
export function detectTestResultStatusMismatch(
  options: TestResultMismatchDetectionOptions
): TestResultMismatchDiagnostic {
  const { testResult, batch, boundTccs, allTestResultsForBatch, dataFreshness = {} } = options;

  const { isTestResultsLoading = false, testResultsLoaded = true, isError = false } = dataFreshness;

  const defaultDiagnostic: TestResultMismatchDiagnostic = {
    hasMismatch: false,
    shouldAlert: false,
    expectedStatus: 'UNKNOWN',
    actualStatus: 'UNKNOWN',
    batchId: batch?.id || testResult?.batchId,
    batchNo: batch?.batchNo,
    testResultId: testResult?.id || '',
    testResultLabName: testResult?.labName || '',
    reason: 'NO_MISMATCH',
    confidence: 'HIGH',
    isAutoHealable: false,
    diagnosticDetails: {
      storedStatusRaw: testResult?.overallStatus,
      storedStatusCanonical: 'UNKNOWN',
      computedStatusCanonical: 'UNKNOWN',
      hasCriteriaFailures: false,
      failedCriteriaCount: 0,
      totalCriteriaCount: 0,
      evaluatedWithTccs: Boolean(boundTccs),
      dataReady: !isTestResultsLoading && testResultsLoaded && !isError,
    },
  };

  if (!testResult) return defaultDiagnostic;

  // 1. Guard: Data Freshness - Nếu dữ liệu đang tải hoặc mất kết nối thì KHÔNG BÁO LỖI
  if (isError || isTestResultsLoading || !testResultsLoaded) {
    return {
      ...defaultDiagnostic,
      reason: 'DATA_LOADING_OR_UNAVAILABLE',
      confidence: 'LOW',
    };
  }

  // 2. Guard: Bỏ qua phiếu bị hủy hoặc xóa mềm
  const statusUpper = String((testResult as any).status || '').toUpperCase();
  if (
    statusUpper === 'CANCELLED' ||
    statusUpper === 'VOIDED' ||
    statusUpper === 'INVALID' ||
    (testResult as any).isDeleted
  ) {
    return {
      ...defaultDiagnostic,
      reason: 'TEST_RESULT_CANCELLED_OR_DELETED',
    };
  }

  // 3. Chuẩn hóa trạng thái lưu (Stored Status)
  const storedCanonical = resolveTestResultStatus(testResult);

  // 4. Tính toán trạng thái thực tế theo chỉ tiêu (Computed Status)
  const computedCanonical = calculateOverallStatusForTestResult(
    testResult,
    boundTccs,
    allTestResultsForBatch
  );

  const results = testResult.results || [];
  const failures = results.filter((r) => normalizeCriterionPassStatus(r.isPass) === false);
  defaultDiagnostic.diagnosticDetails.storedStatusCanonical = storedCanonical;
  defaultDiagnostic.diagnosticDetails.computedStatusCanonical = computedCanonical;
  defaultDiagnostic.diagnosticDetails.hasCriteriaFailures = failures.length > 0;
  defaultDiagnostic.diagnosticDetails.failedCriteriaCount = failures.length;
  defaultDiagnostic.diagnosticDetails.totalCriteriaCount = results.length;

  // 5. UNKNOWN / PENDING Guard:
  // Nếu trạng thái đang là UNKNOWN hoặc PENDING, tuyệt đối không tạo alert mismatch
  if (
    storedCanonical === 'UNKNOWN' ||
    storedCanonical === 'PENDING' ||
    computedCanonical === 'UNKNOWN' ||
    computedCanonical === 'PENDING'
  ) {
    return {
      ...defaultDiagnostic,
      expectedStatus: computedCanonical,
      actualStatus: storedCanonical,
      reason: 'STATUS_PENDING_OR_UNKNOWN',
      confidence: 'MEDIUM',
    };
  }

  // 6. Đối chiếu: Nếu cả 2 đều là PASS hoặc đều là FAIL -> KHÔNG SAI LỆCH
  if (storedCanonical === computedCanonical) {
    // Kiểm tra xem có cần chuẩn hóa format không (ví dụ: đang lưu "Đạt" thay vì "PASS")
    const isRawMismatchedWithCanonical =
      typeof testResult.overallStatus === 'string' &&
      testResult.overallStatus !== storedCanonical &&
      (storedCanonical === 'PASS' || storedCanonical === 'FAIL');

    return {
      ...defaultDiagnostic,
      expectedStatus: computedCanonical,
      actualStatus: storedCanonical,
      reason: 'MATCHES_CANONICAL',
      isAutoHealable: isRawMismatchedWithCanonical,
      autoHealPayload: isRawMismatchedWithCanonical
        ? { testResultId: testResult.id, correctStatus: storedCanonical }
        : undefined,
      suggestedAction: isRawMismatchedWithCanonical
        ? `Chuẩn hóa định dạng chuỗi của phiếu thành "${storedCanonical}".`
        : undefined,
    };
  }

  // 7. PHÁT HIỆN SAI LỆCH THỰC SỰ:
  // storedCanonical là PASS nhưng computedCanonical là FAIL (hoặc ngược lại)
  const shouldAlert = true;
  const reason =
    storedCanonical === 'PASS' && computedCanonical === 'FAIL'
      ? 'STORED_PASS_BUT_COMPUTED_FAIL'
      : 'STORED_FAIL_BUT_COMPUTED_PASS';

  return {
    ...defaultDiagnostic,
    hasMismatch: true,
    shouldAlert,
    alertType: 'CRITICAL',
    expectedStatus: computedCanonical,
    actualStatus: storedCanonical,
    reason,
    confidence: 'HIGH',
    isAutoHealable: true,
    autoHealPayload: {
      testResultId: testResult.id,
      correctStatus: computedCanonical,
    },
    suggestedAction: `Cập nhật lại trạng thái phiếu thành "${computedCanonical}" theo kết quả đánh giá các chỉ tiêu.`,
  };
}
