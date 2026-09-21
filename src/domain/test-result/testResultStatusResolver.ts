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
import { validateEvaluationSnapshot } from '../evaluation/EvaluationSnapshotBuilder';

export type CanonicalTestStatus = 'PASS' | 'FAIL' | 'PENDING' | 'UNKNOWN';

export interface ResolveQualityStatusOptions {
  boundTccs?: TCCS | null;
  allBatchResults?: TestResult[];
  skipSnapshot?: boolean;
}

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
  source?: string;
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
    criteriaSummary?: string;
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
    'SUCCESS',
    'ÂM TÍNH',
    'AM TINH',
    'NEGATIVE',
    'NEG',
  ];
  if (
    passKeywords.includes(str) ||
    str.startsWith('ĐẠT') ||
    str.startsWith('DAT') ||
    str.startsWith('ÂM TÍNH') ||
    str.startsWith('AM TINH')
  ) {
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
    'OOS',
    'OUT_OF_SPEC',
    'LOẠI',
    'BỊ LOẠI',
    'ERROR',
    'DƯƠNG TÍNH',
    'DUONG TINH',
    'POSITIVE',
    'POS',
  ];
  if (
    failKeywords.includes(str) ||
    str.includes('KHÔNG ĐẠT') ||
    str.includes('KHONG DAT') ||
    str.includes('KHONG_DAT') ||
    str.startsWith('DƯƠNG TÍNH') ||
    str.startsWith('DUONG TINH')
  ) {
    return 'FAIL';
  }

  // Nhóm CHỜ / ĐANG KIỂM NGHIỆM (PENDING)
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
    'WAITING',
    'NEW',
  ];
  if (pendingKeywords.includes(str) || str.includes('ĐANG KIỂM') || str.includes('CHƯA')) {
    return 'PENDING';
  }

  // WORKFLOW STATUS: Tuyệt đối không dùng workflow status làm quality status!
  // APPROVED != PASS, FINAL != PASS, RELEASED != PASS, REJECTED != FAIL
  const workflowKeywords = [
    'DRAFT',
    'NHÁP',
    'NHAP',
    'SUBMITTED',
    'FINAL',
    'APPROVED',
    'RELEASED',
    'REJECTED',
    'SUPERSEDED',
  ];
  if (workflowKeywords.includes(str)) {
    return 'UNKNOWN';
  }

  return 'UNKNOWN';
}

/**
 * Canonical Status Resolver (Mục 4)
 * Điểm vào chuẩn hóa trung tâm duy nhất cho trạng thái kết quả kiểm nghiệm.
 */
export const resolveCanonicalTestStatus = normalizeTestResultStatus;

/**
 * 2. Chuẩn hóa cờ đạt của từng chỉ tiêu riêng lẻ (isPass)
 * Ép kiểu dứt khoát mọi biến thể chuỗi ("Đạt", "PASS", "Không đạt", "Âm tính", boolean...)
 * về boolean hoặc null. Tuyệt đối không đánh đồng null/undefined với FAIL.
 */
export function normalizeCriterionPassStatus(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null; // Giữ null cho chỉ tiêu cảm quan
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  const str = String(value).trim().toUpperCase();

  // Nhóm tự động ép thành FALSE (kiểm tra trước để tránh 'KHÔNG ĐẠT' dính 'ĐẠT')
  const failKeywords = [
    'FAIL',
    'FAILED',
    'KHÔNG ĐẠT',
    'KHONG DAT',
    'DƯƠNG TÍNH',
    'DUONG TINH',
    'OOS',
    'POSITIVE',
  ];
  if (failKeywords.some((kw) => str.includes(kw))) return false;

  // Nhóm tự động ép thành TRUE
  const passKeywords = [
    'PASS',
    'PASSED',
    'ĐẠT',
    'ĐAT',
    'DAT',
    'OK',
    'ÂM TÍNH',
    'AM TINH',
    'KPH',
    'KHÔNG PHÁT HIỆN',
    'KHONG PHAT HIEN',
    'NEGATIVE',
    'MIỄN KIỂM',
    'MIEN KIEM',
    'EXEMPTED',
  ];
  if (passKeywords.some((kw) => str.includes(kw))) return true;

  return null;
}

/**
 * Trích xuất trạng thái được lưu trữ trên văn bản/database (Stored Document Status).
 * Chỉ đọc các trường cấp tài liệu, không suy luận lại từ criteria.
 * Dùng cho audit, đối soát sai lệch (Reconciliation) và fallback migration.
 */
export function extractStoredDocumentStatus(testResult: unknown): CanonicalTestStatus {
  if (!testResult || typeof testResult !== 'object') {
    return 'UNKNOWN';
  }

  const tr = testResult as Record<string, any>;

  const candidateFields = [
    tr.overallStatus,
    tr.overallResult,
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

  // Quét các trường boolean legacy
  if (typeof tr.isPassed === 'boolean') return tr.isPassed ? 'PASS' : 'FAIL';
  if (typeof tr.passed === 'boolean') return tr.passed ? 'PASS' : 'FAIL';
  if (typeof tr.pass === 'boolean') return tr.pass ? 'PASS' : 'FAIL';

  return 'UNKNOWN';
}

/**
 * 3. Canonical Quality Status Resolver (Model 2 - Single Source of Truth)
 * Thẩm định và trích xuất trạng thái chất lượng của Phiếu kiểm nghiệm.
 *
 * SOURCE-OF-TRUTH PRECEDENCE (3 TẦNG):
 * Tầng 1: Evaluation Snapshot hợp lệ và integrity verified (SHA-256 + schema + context match + parity).
 * Tầng 2: Re-evaluation từ source data hiện tại (results[] và boundTccs):
 *         - results rỗng -> UNKNOWN
 *         - có bất kỳ criterion FAIL -> FAIL (stored PASS / APPROVED không bao giờ được override)
 *         - còn criterion unresolved -> PENDING
 *         - tất cả criterion PASS -> PASS
 * Tầng 3: Legacy stored status chỉ dùng cho compatibility/diagnostic khi record không có mảng results.
 */
export function resolveTestResultStatus(
  testResult: unknown,
  boundTccsOrOptions?: TCCS | null | ResolveQualityStatusOptions
): CanonicalTestStatus {
  if (!testResult || typeof testResult !== 'object') {
    return 'UNKNOWN';
  }

  const tr = testResult as Record<string, any>;

  // Bóc tách options/context
  let boundTccs: TCCS | null | undefined;
  let allBatchResults: TestResult[] | undefined;
  let skipSnapshot = false;

  if (boundTccsOrOptions) {
    if (
      'mainQualityCriteria' in boundTccsOrOptions ||
      'safetyCriteria' in boundTccsOrOptions ||
      'productId' in boundTccsOrOptions ||
      ('id' in boundTccsOrOptions && !('boundTccs' in boundTccsOrOptions))
    ) {
      boundTccs = boundTccsOrOptions as TCCS;
    } else {
      const opts = boundTccsOrOptions as ResolveQualityStatusOptions;
      boundTccs = opts.boundTccs;
      allBatchResults = opts.allBatchResults;
      skipSnapshot = !!opts.skipSnapshot;
    }
  }

  // =========================================================================
  // TẦNG 1: EVALUATION SNAPSHOT RESOLUTION (ALCOA+ Frozen State)
  // =========================================================================
  if (!skipSnapshot && tr.evaluationSnapshot) {
    const snapValidation = validateEvaluationSnapshot(
      tr.evaluationSnapshot,
      tr as TestResult,
      boundTccs
    );
    if (snapValidation.isValid) {
      return normalizeTestResultStatus(tr.evaluationSnapshot.overallStatus);
    }
    // Nếu snapshot không hợp lệ (sai hash, sai tccsVersion, sai batch, hoặc results đã bị sửa đổi)
    // -> BỎ QUA snapshot, bắt buộc rơi xuống Tầng 2 để Re-evaluate!
  }

  // =========================================================================
  // TẦNG 2: RE-EVALUATION TỪ SOURCE DATA HIỆN TẠI (Evidence-First)
  // =========================================================================
  const rawCriteria = (tr as any).criteria || tr.results;
  if (Array.isArray(rawCriteria)) {
    // Không có kết quả kiểm nghiệm -> UNKNOWN
    if (rawCriteria.length === 0) {
      return 'UNKNOWN';
    }

    // Đảm bảo tr.results có dữ liệu đồng bộ khi chạy calculateOverallStatusForTestResult
    const normalizedTr = {
      ...tr,
      results: rawCriteria,
    } as TestResult;

    // Đánh giá đầy đủ qua calculateOverallStatusForTestResult (hỗ trợ alternateRules và multi-lab lookup)
    const calculated = calculateOverallStatusForTestResult(
      normalizedTr,
      boundTccs,
      allBatchResults
    );

    if (calculated !== 'UNKNOWN') {
      return calculated;
    }

    // Nếu calculateOverallStatusForTestResult trả về UNKNOWN nhưng có phần tử trong results,
    // ta chạy fallback kiểm tra trực diện criteria
    let hasFail = false;
    let hasPending = false;
    let passCount = 0;

    for (const r of rawCriteria) {
      if (!r) continue;
      const criterionPass = normalizeCriterionPassStatus(r.isPass);
      if (criterionPass === false) {
        hasFail = true;
      } else if (criterionPass === null) {
        hasPending = true;
      } else if (criterionPass === true) {
        passCount++;
      }
    }

    if (hasFail) return 'FAIL';
    if (hasPending) return 'PENDING';
    if (passCount > 0) return 'PASS';

    return 'UNKNOWN';
  }

  // =========================================================================
  // TẦNG 3: LEGACY STORED STATUS (Chỉ dùng cho metadata-only record không có results[])
  // =========================================================================
  return extractStoredDocumentStatus(testResult);
}

/**
 * Canonical Status Resolver chính thức cho Quality Status (Model 2).
 * UI, Hooks, và Services bắt buộc gọi hàm này thay vì so sánh overallStatus trực tiếp.
 */
export const resolveQualityStatus = resolveTestResultStatus;

/**
 * Helper so khớp tên chỉ tiêu không phân biệt dấu và khoảng trắng
 */
function isCriteriaNameMatch(nameA?: string, nameB?: string): boolean {
  if (!nameA || !nameB) return false;
  return normalizeName(nameA) === normalizeName(nameB);
}

/**
 * 4. Tính toán kết quả thực tế của Phiếu kiểm nghiệm dựa trên các chỉ tiêu thực tế
 * Tuân thủ nghiêm ngặt thứ tự ưu tiên: FAIL > PENDING > PASS.
 * Có hỗ trợ đầy đủ quy tắc thay thế (Alternate Rules: FAIL_RETRY & CONDITIONAL_CHECK).
 * Tuyệt đối không để một chỉ tiêu PASS tự động kéo cả phiếu thành PASS.
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

  // Lọc các kết quả chỉ tiêu có hiệu lực trong phiếu hiện tại
  // Xây dựng map chỉ tiêu trong phiếu hiện tại (ưu tiên hàng đầu)
  const currentCriteriaMap = new Map<string, TestResultEntry>();
  currentResults.forEach((entry) => {
    if (entry && entry.criteriaName) {
      currentCriteriaMap.set(normalizeName(entry.criteriaName), entry);
    }
  });

  // Hợp nhất các phiếu hợp lệ của lô (nếu có) nhưng loại bỏ các phiếu bị hủy / xóa mềm
  // và chỉ dùng để tra cứu quy tắc thay thế liên phiếu hợp lệ
  const validBatchResultsMap = new Map<string, TestResultEntry>();
  if (Array.isArray(allBatchResults) && allBatchResults.length > 0) {
    allBatchResults.forEach((tr) => {
      if (!tr) return;
      if ((tr as any).isDeleted || (tr as any).deleted) return;
      const s = String((tr as any).status || '').toUpperCase();
      if (s === 'CANCELLED' || s === 'VOIDED' || s === 'INVALID') return;

      (tr.results || []).forEach((entry) => {
        if (entry && entry.criteriaName) {
          const key = normalizeName(entry.criteriaName);
          // Không ghi đè nếu phiếu hiện tại đã có chỉ tiêu này
          if (!validBatchResultsMap.has(key)) {
            validBatchResultsMap.set(key, entry);
          }
        }
      });
    });
  }

  // Nguồn tra cứu tổng hợp: ưu tiên currentResults, fallback sang validBatchResults
  const getLookupEntry = (name: string): TestResultEntry | undefined => {
    const key = normalizeName(name);
    return currentCriteriaMap.get(key) || validBatchResultsMap.get(key);
  };

  const rules = boundTccs?.alternateRules || [];

  let hasPendingRetry = false;

  // 1. Xác định các chỉ tiêu áp dụng (Applicable Criteria)
  // và phát hiện các lỗi không thể cứu (Unrescued Failures)
  const failures = currentResults.filter((r) => normalizeCriterionPassStatus(r.isPass) === false);

  for (const fail of failures) {
    // a. CONDITIONAL_CHECK: Kiểm tra xem chỉ tiêu rớt này có thuộc chỉ tiêu phụ được miễn kiểm không?
    const condRuleWhereThisIsAlt = rules.find(
      (r) =>
        r.type === EVALUATION_RULE.CONDITIONAL_CHECK &&
        isCriteriaNameMatch(r.alt, fail.criteriaName)
    );

    if (condRuleWhereThisIsAlt) {
      const mainResult = getLookupEntry(condRuleWhereThisIsAlt.main);
      if (mainResult && mainResult.value !== undefined && mainResult.value !== '') {
        const isTriggered = CriterionEvaluator.checkRange(
          condRuleWhereThisIsAlt.conditionValue || '',
          String(mainResult.value)
        );
        // Nếu điều kiện KHÔNG bị kích hoạt -> chỉ tiêu phụ này được MIỄN KIỂM -> Bỏ qua lỗi
        if (isTriggered !== true) continue;
      }
    }

    // b. CONDITIONAL_CHECK: Nếu chỉ tiêu rớt này là chỉ tiêu CHÍNH kích hoạt kiểm tra chỉ tiêu phụ
    const condRuleWhereThisIsMain = rules.find(
      (r) =>
        r.type === EVALUATION_RULE.CONDITIONAL_CHECK &&
        isCriteriaNameMatch(r.main, fail.criteriaName)
    );

    if (condRuleWhereThisIsMain) {
      const isTriggered = CriterionEvaluator.checkRange(
        condRuleWhereThisIsMain.conditionValue || '',
        String(fail.value)
      );

      if (isTriggered === true) {
        const altResult = getLookupEntry(condRuleWhereThisIsMain.alt);
        const altValStr =
          altResult?.value !== undefined && altResult?.value !== null
            ? String(altResult.value).trim()
            : '';

        // Nếu chỉ tiêu phụ chưa có kết quả -> Đang chờ kết quả phụ (PENDING), không kết luận FAIL
        if (
          !altResult ||
          altValStr === '' ||
          normalizeCriterionPassStatus(altResult.isPass) === null
        ) {
          hasPendingRetry = true;
          continue;
        }

        if (normalizeCriterionPassStatus(altResult.isPass) === true) {
          // Đã được cứu bởi chỉ tiêu phụ đạt
          continue;
        }

        return 'FAIL';
      }
    }

    // c. FAIL_RETRY: Kiểm tra xem có quy tắc thử lại cứu chỉ tiêu rớt này không
    const retryRule = rules.find(
      (r: any) =>
        isCriteriaNameMatch(r.main, fail.criteriaName) &&
        (!r.type || r.type === EVALUATION_RULE.FAIL_RETRY)
    );

    if (retryRule) {
      const altResult = getLookupEntry(retryRule.alt);
      const altValStr =
        altResult?.value !== undefined && altResult?.value !== null
          ? String(altResult.value).trim()
          : '';

      // Nếu chỉ tiêu phụ chưa có kết quả -> Đang chờ kết quả phụ (PENDING), không kết luận FAIL
      if (
        !altResult ||
        altValStr === '' ||
        normalizeCriterionPassStatus(altResult.isPass) === null
      ) {
        hasPendingRetry = true;
        continue;
      }

      if (normalizeCriterionPassStatus(altResult.isPass) === true) {
        // Đã được cứu bởi chỉ tiêu thử lại đạt có kết quả thực tế
        continue;
      }

      return 'FAIL';
    }

    // Không được miễn và không có luật cứu hợp lệ -> THẤT BẠI
    return 'FAIL';
  }

  // 2. CONDITIONAL_CHECK bị kích hoạt: Chỉ tiêu phụ bắt buộc phải có và đạt
  const conditionalRules = rules.filter((r: any) => r.type === EVALUATION_RULE.CONDITIONAL_CHECK);
  for (const rule of conditionalRules) {
    const mainResult = currentResults.find((r) => isCriteriaNameMatch(r.criteriaName, rule.main));
    if (mainResult && mainResult.value !== undefined && mainResult.value !== '') {
      const isTriggered = CriterionEvaluator.checkRange(
        rule.conditionValue || '',
        String(mainResult.value)
      );

      if (isTriggered === true) {
        const altResult = getLookupEntry(rule.alt);
        if (!altResult || altResult.value === undefined || altResult.value === '') {
          // Bị kích hoạt nhưng chưa có kết quả chỉ tiêu phụ -> PENDING
          return 'PENDING';
        }
        if (normalizeCriterionPassStatus(altResult.isPass) === false) {
          // Bị kích hoạt nhưng chỉ tiêu phụ không đạt -> FAIL
          return 'FAIL';
        }
      }
    }
  }

  // 3. Kiểm tra các chỉ tiêu bắt buộc chưa giải quyết xong (Unresolved / Pending Required Criteria)
  // Chỉ tiêu chưa nhập kết quả (value rỗng) mà không được miễn kiểm
  const pendingCriteria = currentResults.filter((r) => {
    const passStatus = normalizeCriterionPassStatus(r.isPass);
    if (passStatus === true) return false;
    if (passStatus === false) return false; // Failures are handled above

    // passStatus is null or undefined
    const valStr = r.value !== undefined && r.value !== null ? String(r.value).trim() : '';

    // Nếu đã nhập kết quả (ví dụ chỉ tiêu cảm quan / text dạng 'Bột màu trắng', 'Đạt yêu cầu') -> không tính là pending
    if (valStr !== '') {
      return false;
    }

    // Giá trị rỗng: Kiểm tra xem chỉ tiêu chưa có kết quả này có được miễn kiểm theo CONDITIONAL_CHECK không
    const condRule = rules.find(
      (rule) =>
        rule.type === EVALUATION_RULE.CONDITIONAL_CHECK &&
        isCriteriaNameMatch(rule.alt, r.criteriaName)
    );
    if (condRule) {
      const mainResult = getLookupEntry(condRule.main);
      if (mainResult && mainResult.value !== undefined && mainResult.value !== '') {
        const isTriggered = CriterionEvaluator.checkRange(
          condRule.conditionValue || '',
          String(mainResult.value)
        );
        if (isTriggered !== true) {
          return false; // Được miễn kiểm -> không bắt buộc
        }
      }
    }

    // Kiểm tra xem có được miễn kiểm theo FAIL_RETRY không (nếu chỉ tiêu chính đã đạt)
    const retryRule = rules.find(
      (rule: any) =>
        (!rule.type || rule.type === EVALUATION_RULE.FAIL_RETRY) &&
        isCriteriaNameMatch(rule.alt, r.criteriaName)
    );
    if (retryRule) {
      const mainResult = getLookupEntry(retryRule.main);
      if (mainResult && normalizeCriterionPassStatus(mainResult.isPass) === true) {
        return false; // Chỉ tiêu chính đạt -> chỉ tiêu phụ được miễn kiểm
      }
    }

    // Nếu là chỉ tiêu phụ tự do không có giới hạn (isExtra và không có limit) -> không bắt buộc
    if (r.isExtra && (!r.limit || r.limit.trim() === '')) {
      return false;
    }

    return true; // Không có kết quả -> PENDING
  });

  if (pendingCriteria.length > 0 || hasPendingRetry) {
    return 'PENDING';
  }

  // 4. Nếu tất cả chỉ tiêu áp dụng đều đạt (All Applicable Criteria Pass)
  const applicablePassedCriteria = currentResults.filter((r) => {
    return normalizeCriterionPassStatus(r.isPass) === true;
  });

  if (applicablePassedCriteria.length > 0) {
    return 'PASS';
  }

  // Mặc định: Nếu không có chỉ tiêu nào đạt -> PENDING
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

  // 2. Formal Precedence Matrix:
  // Cấp độ: APPROVED (40) > FINAL (30) > RELEASED (20) > DRAFT/PENDING (10)
  // Kết hợp: version > updatedAt/testDate > id deterministic tie-breaker
  function getStatusPrecedenceScore(tr: TestResult): number {
    const s = String((tr as any).status || '').toUpperCase();
    if (s === 'APPROVED') return 40;
    if (s === 'FINAL' || (tr as any).isFinal === true) return 30;
    if (s === 'RELEASED') return 20;
    if (s === 'DRAFT' || s === 'PENDING' || s === 'TESTING') return 10;
    return 15; // default working status
  }

  // 3. Sắp xếp tìm bản ghi hiện hành theo thang điểm ưu tiên chính thức
  const sorted = [...candidates].sort((a, b) => {
    // 1. Trạng thái phê duyệt
    const scoreA = getStatusPrecedenceScore(a);
    const scoreB = getStatusPrecedenceScore(b);
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 2. Version / revision
    const vA = (a as any).version || (a as any).revision || 0;
    const vB = (b as any).version || (b as any).revision || 0;
    if (vA !== vB) return vB - vA;

    // 3. Timestamp mới hơn
    const dateA = a.updatedAt || a.testDate || a.createdAt || '';
    const dateB = b.updatedAt || b.testDate || b.createdAt || '';
    const dateDiff = dateB.localeCompare(dateA);
    if (dateDiff !== 0) return dateDiff;

    // 4. Deterministic tie-breaker bằng ID
    return (b.id || '').localeCompare(a.id || '');
  });

  const finalTestResult = sorted[0];

  // 4. Đánh giá trạng thái Authoritative Test Result
  // Ưu tiên tính toán từ các chỉ tiêu thực tế, fallback sang stored status
  let computedStatus: CanonicalTestStatus = 'UNKNOWN';
  if (Array.isArray(finalTestResult.results) && finalTestResult.results.length > 0) {
    computedStatus = calculateOverallStatusForTestResult(finalTestResult, boundTccs, candidates);
  }
  if (computedStatus === 'UNKNOWN') {
    computedStatus = resolveTestResultStatus(finalTestResult);
  }

  const hasPassTest = computedStatus === 'PASS';

  // Tính trạng thái hợp nhất
  const consolidatedMap = new Map<string, TestResultEntry>();
  candidates.forEach((tr) => {
    (tr.results || []).forEach((r) => {
      if (r && r.criteriaName) {
        consolidatedMap.set(normalizeName(r.criteriaName), r);
      }
    });
  });
  const isConsolidated = candidates.length > 1;

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
 * Canonical Authoritative Test Result Resolver (Mục 8 & 9)
 * Chọn phiếu kiểm nghiệm chính thức / hiện hành cho Lô sản xuất.
 */
export function resolveAuthoritativeTestResultForBatch(
  batch: Batch,
  testResults: TestResult[] = [],
  boundTccs?: TCCS | null
): TestResult | undefined {
  const res = resolveFinalTestResultForBatch(batch, testResults, boundTccs);
  return res.finalTestResult;
}

/**
 * Multi-Lab Authoritative Test Results Resolver (Mục 11)
 * Chọn danh sách phiếu kiểm nghiệm authoritative cho Lô sản xuất, phân tách theo từng phòng kiểm nghiệm (Lab).
 */
export function resolveAuthoritativeTestResultsForBatch(
  batch: Batch,
  testResults: TestResult[] = [],
  boundTccs?: TCCS | null
): TestResult[] {
  if (!batch || !Array.isArray(testResults) || testResults.length === 0) {
    return [];
  }

  const normalizedBatchNo = (batch.batchNo || '').trim().toLowerCase();
  const primaryCandidates: TestResult[] = [];
  const legacyCandidates: TestResult[] = [];

  testResults.forEach((tr) => {
    if (!tr) return;
    if ((tr as any).isDeleted || (tr as any).deleted) return;

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
  if (candidates.length === 0) return [];

  // Helper kiểm tra phiếu đã hoàn tất phê duyệt
  const isFinalized = (tr: TestResult): boolean => {
    const s = String((tr as any).workflowStatus || (tr as any).status || '').toUpperCase();
    return ['APPROVED', 'FINAL', 'RELEASED'].includes(s) || (tr as any).isFinal === true;
  };

  // 1. Gom nhóm theo chuỗi sửa đổi (Revision / Report Chain)
  // Nếu các phiếu có cùng reportNo/code hoặc quan hệ supersedesId/originalResultId -> cùng 1 chuỗi sửa đổi
  const chainMap = new Map<string, TestResult[]>();
  candidates.forEach((tr) => {
    const reportCode = ((tr as any).reportNo || (tr as any).code || '').trim().toLowerCase();
    const parentId = ((tr as any).supersedesId || (tr as any).originalResultId || '').trim();

    const chainKey = reportCode
      ? `code:${reportCode}`
      : parentId
        ? `parent:${parentId}`
        : `id:${tr.id}`;

    if (!chainMap.has(chainKey)) {
      chainMap.set(chainKey, []);
    }
    chainMap.get(chainKey)!.push(tr);
  });

  // Với mỗi chuỗi sửa đổi, chỉ chọn 1 bản ghi tối ưu nhất (phiếu đã duyệt > version cao > ngày mới)
  const dedupedByChain: TestResult[] = [];
  chainMap.forEach((group) => {
    if (group.length === 1) {
      dedupedByChain.push(group[0]);
      return;
    }

    const finalized = group.filter(isFinalized);
    const pool = finalized.length > 0 ? finalized : group;

    const sorted = [...pool].sort((a, b) => {
      const vA = (a as any).version || (a as any).revision || 0;
      const vB = (b as any).version || (b as any).revision || 0;
      if (vA !== vB) return vB - vA;

      const dateA = a.updatedAt || a.testDate || a.createdAt || '';
      const dateB = b.updatedAt || b.testDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    dedupedByChain.push(sorted[0]);
  });

  // 2. Xác định phiếu supremeAuth cho Lô (để bảo toàn quy tắc re-test superseded)
  const finalRes = resolveFinalTestResultForBatch(batch, dedupedByChain, boundTccs);
  const supremeAuth = finalRes.finalTestResult;
  if (!supremeAuth) return dedupedByChain;

  const supremeCanonicalStatus = resolveTestResultStatus(supremeAuth);
  const supremeDate = supremeAuth.updatedAt || supremeAuth.testDate || supremeAuth.createdAt || '';
  const isSupremeFinal = isFinalized(supremeAuth);

  // 3. Lọc bỏ các phiếu cũ bị thay thế toàn diện bởi Re-test hoặc Revision (Mục 9, 11)
  const authoritativeResults: TestResult[] = dedupedByChain.filter((tr) => {
    if (tr.id === supremeAuth.id) return true;

    // Trích xuất tập chỉ tiêu của tr và supremeAuth
    const trCriteria = (tr.results || [])
      .map((r) => (r.criteriaName || '').trim().toLowerCase())
      .filter(Boolean);
    const supremeCriteria = new Set(
      (supremeAuth.results || [])
        .map((r) => (r.criteriaName || '').trim().toLowerCase())
        .filter(Boolean)
    );

    // Nếu tr không có chỉ tiêu nào thì bỏ qua
    if (trCriteria.length === 0) return false;

    // Kiểm tra xem tất cả chỉ tiêu của tr có nằm trong supremeAuth hay không
    const isSubsetOfSupreme = trCriteria.every((c) => supremeCriteria.has(c));

    // Nếu tr là tập con của supremeAuth (cùng kiểm các chỉ tiêu đó) và cũ hơn supremeAuth:
    const trDate = tr.updatedAt || tr.testDate || tr.createdAt || '';
    if (isSubsetOfSupreme && trDate && supremeDate && trDate <= supremeDate) {
      const trStatus = resolveTestResultStatus(tr);
      // Nếu tr FAIL và supremeAuth PASS -> tr là phiếu re-test cũ bị thay thế -> loại
      if (trStatus === 'FAIL' && supremeCanonicalStatus === 'PASS') {
        return false;
      }
      // Nếu supremeAuth đã APPROVED/FINAL mà tr chỉ là DRAFT/PENDING -> loại tr
      if (isSupremeFinal && !isFinalized(tr)) {
        return false;
      }
      // Nếu cả hai đều FINAL/APPROVED và supremeAuth có version cao hơn tr -> tr là bản cũ -> loại
      const vTr = (tr as any).version || (tr as any).revision || 0;
      const vSup = (supremeAuth as any).version || (supremeAuth as any).revision || 0;
      if (vSup > vTr) {
        return false;
      }
    }

    // Nếu supremeAuth đã duyệt (APPROVED/FINAL) và tr là DRAFT không chứa chỉ tiêu mới nào so với các phiếu đã duyệt
    if (isSupremeFinal && !isFinalized(tr) && isSubsetOfSupreme) {
      return false;
    }

    // Các phiếu kiểm tra các chỉ tiêu độc lập hoặc bổ sung cho nhau BẮT BUỘC ĐƯỢC GIỮ LẠI
    return true;
  });

  return authoritativeResults;
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
    source: 'TestResult',
    confidence: 'HIGH',
    isAutoHealable: false,
    diagnosticDetails: {
      storedStatusRaw: testResult?.overallStatus,
      storedStatusCanonical: 'UNKNOWN',
      computedStatusCanonical: 'UNKNOWN',
      hasCriteriaFailures: false,
      failedCriteriaCount: 0,
      totalCriteriaCount: 0,
      criteriaSummary: '',
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
    (testResult as any).isDeleted ||
    (testResult as any).deleted
  ) {
    return {
      ...defaultDiagnostic,
      reason: 'TEST_RESULT_CANCELLED_OR_DELETED',
    };
  }

  // 3. Chuẩn hóa trạng thái lưu (Stored Status)
  const storedCanonical = extractStoredDocumentStatus(testResult);

  // 4. Tính toán trạng thái thực tế theo chỉ tiêu (Computed Status)
  const computedCanonical = calculateOverallStatusForTestResult(
    testResult,
    boundTccs,
    allTestResultsForBatch
  );

  const results = testResult.results || [];
  const failures = results.filter((r) => normalizeCriterionPassStatus(r.isPass) === false);
  const passCount = results.filter((r) => normalizeCriterionPassStatus(r.isPass) === true).length;
  const criteriaSummary = `${passCount}/${results.length} chỉ tiêu đạt`;

  defaultDiagnostic.diagnosticDetails.storedStatusCanonical = storedCanonical;
  defaultDiagnostic.diagnosticDetails.computedStatusCanonical = computedCanonical;
  defaultDiagnostic.diagnosticDetails.hasCriteriaFailures = failures.length > 0;
  defaultDiagnostic.diagnosticDetails.failedCriteriaCount = failures.length;
  defaultDiagnostic.diagnosticDetails.totalCriteriaCount = results.length;
  defaultDiagnostic.diagnosticDetails.criteriaSummary = criteriaSummary;

  // 5. UNKNOWN / PENDING Guard (Mục 12):
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

  // 7. PHÁT HIỆN SAI LỆCH THỰC SỰ (REAL MISMATCH - Mục 12):
  // storedCanonical là PASS nhưng computedCanonical là FAIL (hoặc ngược lại)
  const shouldAlert = true;
  const reason =
    storedCanonical === 'PASS' && computedCanonical === 'FAIL'
      ? 'STORED_PASS_BUT_COMPUTED_FAIL'
      : 'STORED_FAIL_BUT_COMPUTED_PASS';

  const isFinalized =
    statusUpper === 'APPROVED' ||
    statusUpper === 'FINAL' ||
    statusUpper === 'RELEASED' ||
    (testResult as any).isFinal === true;

  // Mục 15: Chỉ Auto-Heal khi deterministic, chưa bị khóa duyệt (không phải APPROVED/FINAL/RELEASED)
  const isSafeToAutoHeal =
    !isFinalized &&
    results.length > 0 &&
    (computedCanonical === 'FAIL'
      ? failures.length > 0
      : computedCanonical === 'PASS' &&
        (failures.length === 0 ||
          (boundTccs?.alternateRules && boundTccs.alternateRules.length > 0))); // Cho phép PASS an toàn nếu có alternateRules

  return {
    ...defaultDiagnostic,
    hasMismatch: true,
    shouldAlert,
    alertType: 'CRITICAL',
    expectedStatus: computedCanonical,
    actualStatus: storedCanonical,
    reason,
    source: 'TestResult',
    confidence: 'HIGH',
    isAutoHealable: isSafeToAutoHeal,
    autoHealPayload: isSafeToAutoHeal
      ? {
          testResultId: testResult.id,
          correctStatus: computedCanonical,
        }
      : undefined,
    suggestedAction: isFinalized
      ? `Phiếu kiểm nghiệm đã được Phê duyệt/Khóa sổ (${statusUpper || 'FINAL'}). Cần tạo phiếu Sai lệch (Deviation) hoặc Yêu cầu Thay đổi (Change Control) để Reopen trước khi chỉnh sửa.`
      : `Cập nhật lại trạng thái phiếu thành "${computedCanonical}" theo kết quả đánh giá các chỉ tiêu.`,
  };
}
