/**
 * batchIntegrityValidator.ts
 * ==========================
 * Canonical Domain Validator kiểm định tính toàn vẹn chất lượng & liên kết
 * cho Lô sản xuất xuất xưởng (RELEASED Batches).
 *
 * Tiêu chí chuẩn mực ALCOA+ & GMP:
 * 1. Data Freshness Aware: Không bao giờ cảnh báo "chưa kiểm nghiệm" khi dữ liệu đang tải hoặc chưa nạp.
 * 2. Phân loại chuẩn xác:
 *    - PASS: Lô xuất xưởng có phiếu kiểm nghiệm hợp lệ đạt chuẩn.
 *    - MISSING_TEST_RESULT: Lô xuất xưởng nhưng thực sự không có phiếu kiểm nghiệm nào.
 *    - RELATIONSHIP_ERROR: Có phiếu kiểm nghiệm nhưng liên kết ID bị sai / legacy.
 *    - TEST_RESULT_INVALID_STATUS: Phiếu kiểm nghiệm không đạt hoặc bị hủy.
 *    - DATA_UNAVAILABLE: Dữ liệu chưa tải xong hoặc mạng lỗi.
 *    - NOT_APPLICABLE: Lô chưa xuất xưởng (PENDING, TESTING, REJECTED).
 */

import { Batch, TestResult, TCCS } from '../../types';
import { BatchTestResolutionResult } from './batchTestResultResolver';
import { calculateOverallStatus } from '../../utils/evaluation';
import { resolveTestResultStatus } from '../test-result/testResultStatusResolver';

export type BatchIntegrityStatus =
  | 'PASS'
  | 'MISSING_TEST_RESULT'
  | 'RELATIONSHIP_ERROR'
  | 'TEST_RESULT_INVALID_STATUS'
  | 'DATA_UNAVAILABLE'
  | 'NOT_APPLICABLE';

export interface DataFreshnessState {
  isBatchesLoading?: boolean;
  isTestResultsLoading?: boolean;
  testResultsLoaded?: boolean;
  isOffline?: boolean;
  isError?: boolean;
}

export interface BatchIntegrityEvaluation {
  batchId: string;
  batchNo: string;
  releaseStatus: Batch['status'];
  integrityStatus: BatchIntegrityStatus;
  candidateCount: number;
  primaryCount: number;
  legacyCount: number;
  validPassCount: number;
  matchedTestIds: string[];
  relationshipType: 'PRIMARY' | 'LEGACY' | 'INVALID' | 'NONE';
  summaryMessage: string;
  shouldAlert: boolean;
  alertType?: 'CRITICAL' | 'WARNING' | 'INFO';
  suggestedAction?: string;
  debugInfo: {
    resolution: BatchTestResolutionResult;
    freshness: DataFreshnessState;
  };
}

/**
 * Xác định 1 Phiếu kiểm nghiệm có hợp lệ về mặt cấu trúc và dữ liệu cho Lô sản xuất hay không
 */
export function isValidTestResultForBatch(testResult: TestResult, batch?: Batch): boolean {
  if (!testResult) return false;

  // 1. Bản ghi không bị xóa mềm
  if ((testResult as any).isDeleted || (testResult as any).deleted) return false;

  // 2. Không ở trạng thái vô hiệu / bị hủy
  const statusUpper = String((testResult as any).status || '').toUpperCase();
  if (statusUpper === 'CANCELLED' || statusUpper === 'VOIDED' || statusUpper === 'INVALID') {
    return false;
  }

  // 3. Có dữ liệu kiểm nghiệm cần thiết
  const hasResults = Array.isArray(testResult.results) && testResult.results.length > 0;
  const hasOverall = Boolean(testResult.overallStatus);
  if (!hasResults && !hasOverall) return false;

  // 4. Nếu có truyền batch, đối chiếu ID kỹ thuật
  if (batch) {
    const rawBatchId = (testResult.batchId || '').trim();
    if (!rawBatchId || rawBatchId !== batch.id) {
      return false;
    }
  }

  return true;
}

/**
 * Đánh giá tính toàn vẹn xuất xưởng của Lô (RELEASED Batch Integrity Evaluation)
 */
export function evaluateBatchReleaseIntegrity(
  batch: Batch,
  resolution: BatchTestResolutionResult,
  freshness: DataFreshnessState = {},
  boundTccs?: TCCS
): BatchIntegrityEvaluation {
  const { isTestResultsLoading = false, testResultsLoaded = true, isError = false } = freshness;

  // 1. Guard: Lô chưa xuất xưởng thì không áp dụng luật bắt buộc có phiếu PASS xuất xưởng
  if (batch.status !== 'RELEASED') {
    return {
      batchId: batch.id,
      batchNo: batch.batchNo,
      releaseStatus: batch.status,
      integrityStatus: 'NOT_APPLICABLE',
      candidateCount: resolution.allCandidateResults.length,
      primaryCount: resolution.primaryResults.length,
      legacyCount: resolution.legacyResults.length,
      validPassCount: 0,
      matchedTestIds: resolution.allCandidateResults.map((r) => r.id),
      relationshipType: resolution.hasPrimaryMatch
        ? 'PRIMARY'
        : resolution.hasLegacyMatch
          ? 'LEGACY'
          : 'NONE',
      summaryMessage: `Lô ở trạng thái ${batch.status}, không yêu cầu kiểm tra toàn vẹn xuất xưởng.`,
      shouldAlert: false,
      debugInfo: { resolution, freshness },
    };
  }

  // 2. Guard: Data Freshness - Đang nạp dữ liệu hoặc lỗi kết nối
  if (isError) {
    return {
      batchId: batch.id,
      batchNo: batch.batchNo,
      releaseStatus: batch.status,
      integrityStatus: 'DATA_UNAVAILABLE',
      candidateCount: 0,
      primaryCount: 0,
      legacyCount: 0,
      validPassCount: 0,
      matchedTestIds: [],
      relationshipType: 'NONE',
      summaryMessage: `Không thể xác minh dữ liệu kiểm nghiệm cho lô "${batch.batchNo}" do lỗi kết nối CSDL.`,
      shouldAlert: false,
      debugInfo: { resolution, freshness },
    };
  }

  if (isTestResultsLoading || (!testResultsLoaded && resolution.allCandidateResults.length === 0)) {
    return {
      batchId: batch.id,
      batchNo: batch.batchNo,
      releaseStatus: batch.status,
      integrityStatus: 'DATA_UNAVAILABLE',
      candidateCount: 0,
      primaryCount: 0,
      legacyCount: 0,
      validPassCount: 0,
      matchedTestIds: [],
      relationshipType: 'NONE',
      summaryMessage: `Đang tải dữ liệu kiểm nghiệm từ máy chủ... Chưa đủ dữ liệu để kết luận lô "${batch.batchNo}".`,
      shouldAlert: false,
      debugInfo: { resolution, freshness },
    };
  }

  // 3. Trường hợp A: Có kết quả Primary hợp lệ
  const validPrimary = resolution.primaryResults.filter((r) => isValidTestResultForBatch(r, batch));

  if (validPrimary.length > 0) {
    // Sắp xếp theo ngày kiểm nghiệm tăng dần (phiếu mới nhất ở cuối)
    const sorted = [...validPrimary].sort((a, b) =>
      (a.testDate || '').localeCompare(b.testDate || '')
    );
    const latestTest = sorted[sorted.length - 1];

    // Hợp nhất kết quả kiểm nghiệm các lần
    const consolidatedMap = new Map<string, any>();
    sorted.forEach((t) => {
      (t.results || []).forEach((r) => {
        if (r && r.criteriaName) {
          consolidatedMap.set(r.criteriaName.trim().toLowerCase(), r);
        }
      });
    });
    const consolidatedResults = Array.from(consolidatedMap.values());
    const consolidatedStatus =
      consolidatedResults.length > 0
        ? calculateOverallStatus(consolidatedResults, boundTccs || null)
        : undefined;

    const hasPassTest = validPrimary.some((t) => resolveTestResultStatus(t) === 'PASS');
    const isLatestPass =
      resolveTestResultStatus(latestTest) === 'PASS' || consolidatedStatus === 'PASS';

    if (hasPassTest || isLatestPass) {
      // ĐẠT: Có ít nhất 1 phiếu kiểm nghiệm đạt hoặc hợp nhất đạt
      const validPassCount = validPrimary.filter(
        (t) => resolveTestResultStatus(t) === 'PASS'
      ).length;
      return {
        batchId: batch.id,
        batchNo: batch.batchNo,
        releaseStatus: batch.status,
        integrityStatus: 'PASS',
        candidateCount: validPrimary.length,
        primaryCount: validPrimary.length,
        legacyCount: 0,
        validPassCount,
        matchedTestIds: validPrimary.map((r) => r.id),
        relationshipType: 'PRIMARY',
        summaryMessage: `✓ Lô đã xuất xưởng và đã có hồ sơ kiểm nghiệm hợp lệ (${validPrimary.length} phiếu).`,
        shouldAlert: false,
        debugInfo: { resolution, freshness },
      };
    } else {
      // Có phiếu kiểm nghiệm nhưng tất cả đều FAIL
      return {
        batchId: batch.id,
        batchNo: batch.batchNo,
        releaseStatus: batch.status,
        integrityStatus: 'TEST_RESULT_INVALID_STATUS',
        candidateCount: validPrimary.length,
        primaryCount: validPrimary.length,
        legacyCount: 0,
        validPassCount: 0,
        matchedTestIds: validPrimary.map((r) => r.id),
        relationshipType: 'PRIMARY',
        summaryMessage: `Lô "${batch.batchNo}" đã xuất xưởng nhưng kết quả kiểm nghiệm cuối cùng là KHÔNG ĐẠT (FAIL).`,
        shouldAlert: true,
        alertType: 'CRITICAL',
        suggestedAction:
          'Xem xét lại quyết định duyệt xuất xưởng, thực hiện kiểm nghiệm lại hoặc chuyển trạng thái sang BỊ LOẠI (REJECTED).',
        debugInfo: { resolution, freshness },
      };
    }
  }

  // 4. Trường hợp C: Có TestResult khớp số lô nhưng sai khóa ID kỹ thuật (Legacy / Relationship Error)
  if (resolution.legacyResults.length > 0) {
    const legacyValid = resolution.legacyResults.filter((r) => isValidTestResultForBatch(r));
    return {
      batchId: batch.id,
      batchNo: batch.batchNo,
      releaseStatus: batch.status,
      integrityStatus: 'RELATIONSHIP_ERROR',
      candidateCount: resolution.legacyResults.length,
      primaryCount: 0,
      legacyCount: resolution.legacyResults.length,
      validPassCount: legacyValid.filter((r) => resolveTestResultStatus(r) === 'PASS').length,
      matchedTestIds: resolution.legacyResults.map((r) => r.id),
      relationshipType: 'LEGACY',
      summaryMessage: `Lô "${batch.batchNo}" đã có ${resolution.legacyResults.length} phiếu kiểm nghiệm nhưng liên kết qua số lô (Legacy) thay vì ID kỹ thuật.`,
      shouldAlert: true,
      alertType: 'WARNING',
      suggestedAction:
        'Cập nhật khóa liên kết kỹ thuật (batchId = batch.id) cho phiếu kiểm nghiệm để đảm bảo toàn vẹn dữ liệu.',
      debugInfo: { resolution, freshness },
    };
  }

  // 5. Trường hợp B: Hoàn toàn không có TestResult nào (thực sự thiếu kiểm nghiệm)
  return {
    batchId: batch.id,
    batchNo: batch.batchNo,
    releaseStatus: batch.status,
    integrityStatus: 'MISSING_TEST_RESULT',
    candidateCount: 0,
    primaryCount: 0,
    legacyCount: 0,
    validPassCount: 0,
    matchedTestIds: [],
    relationshipType: 'NONE',
    summaryMessage: `Lô "${batch.batchNo}" ở trạng thái ĐÃ XUẤT XƯỞNG (RELEASED) nhưng chưa có bất kỳ phiếu kiểm nghiệm nào.`,
    shouldAlert: true,
    alertType: 'CRITICAL',
    suggestedAction:
      'Xem xét lại quyết định duyệt lô hoặc chuyển trạng thái sang ĐANG KIỂM TRA (TESTING).',
    debugInfo: { resolution, freshness },
  };
}
