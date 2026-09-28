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
import { BatchTestResolutionResult, resolveTestResultsForBatch } from './batchTestResultResolver';
import { calculateOverallStatus } from '../../utils/evaluation';
import {
  resolveTestResultStatus,
  resolveAuthoritativeTestResultsForBatch,
  resolveFinalTestResultForBatch,
  calculateOverallStatusForTestResult,
} from '../test-result/testResultStatusResolver';
import { resolveCanonicalBatchQualityDecision } from './canonicalBatchQualityDecision';

export type BatchIntegrityStatus =
  | 'PASS'
  | 'MISSING_TEST_RESULT'
  | 'RELATIONSHIP_ERROR'
  | 'TEST_RESULT_INVALID_STATUS'
  | 'DATA_UNAVAILABLE'
  | 'NOT_APPLICABLE';

export type CollectionLoadState =
  | 'NOT_STARTED'
  | 'LOADING'
  | 'LOADED'
  | 'PARTIAL'
  | 'ERROR'
  | 'OFFLINE';

export interface DataFreshnessState {
  isBatchesLoading?: boolean;
  isTestResultsLoading?: boolean;
  testResultsLoaded?: boolean;
  loadState?: CollectionLoadState;
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
    authoritativeResults?: TestResult[];
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
  const statusUpper = String(
    (testResult as any).workflowStatus || (testResult as any).status || ''
  ).toUpperCase();
  if (statusUpper === 'CANCELLED' || statusUpper === 'VOIDED' || statusUpper === 'INVALID') {
    return false;
  }

  // 3. Có dữ liệu kiểm nghiệm cần thiết
  const entries =
    Array.isArray(testResult.results) && testResult.results.length > 0
      ? testResult.results
      : Array.isArray((testResult as any).criteria)
        ? (testResult as any).criteria
        : [];
  const hasResults = entries.length > 0;
  const hasOverall = Boolean(testResult.overallStatus || (testResult as any).qualityStatus);
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
 * Sử dụng Canonical Batch Quality Decision Engine làm Single Source of Truth (SSoT).
 */
export function evaluateBatchReleaseIntegrity(
  batch: Batch,
  resolutionOrResults: BatchTestResolutionResult | TestResult[],
  freshness: DataFreshnessState = {},
  boundTccs?: TCCS
): BatchIntegrityEvaluation {
  const resolution: BatchTestResolutionResult = Array.isArray(resolutionOrResults)
    ? resolveTestResultsForBatch(batch, resolutionOrResults)
    : resolutionOrResults;

  const decision = resolveCanonicalBatchQualityDecision({
    batch,
    testResults: resolution.allCandidateResults,
    boundTccs,
    dataFreshness: freshness,
  });

  const validPassCount =
    decision.qualityStatus === 'PASS' ? Math.max(decision.authoritativeCount, 1) : 0;

  return {
    batchId: decision.batchId,
    batchNo: decision.batchNo,
    releaseStatus: decision.workflowStatus,
    integrityStatus: decision.integrityStatus,
    candidateCount: decision.candidateCount,
    primaryCount: resolution.primaryResults.length,
    legacyCount: resolution.legacyResults.length,
    validPassCount,
    matchedTestIds: resolution.allCandidateResults.map((r) => r.id),
    relationshipType: resolution.hasPrimaryMatch
      ? 'PRIMARY'
      : resolution.hasLegacyMatch
        ? 'LEGACY'
        : 'NONE',
    summaryMessage: decision.decisionReason,
    shouldAlert: decision.shouldAlert,
    alertType: decision.alertType,
    suggestedAction:
      decision.integrityStatus === 'RELATIONSHIP_ERROR'
        ? 'Cập nhật khóa liên kết kỹ thuật (batchId = batch.id) cho phiếu kiểm nghiệm để đảm bảo toàn vẹn dữ liệu.'
        : decision.integrityStatus === 'MISSING_TEST_RESULT'
          ? 'Xem xét lại quyết định duyệt lô hoặc chuyển trạng thái sang ĐANG KIỂM TRA (TESTING).'
          : decision.integrityStatus === 'TEST_RESULT_INVALID_STATUS'
            ? 'Xem xét lại quyết định duyệt xuất xưởng, thực hiện kiểm nghiệm lại hoặc chuyển trạng thái sang BỊ LOẠI (REJECTED).'
            : undefined,
    debugInfo: {
      resolution,
      freshness,
      authoritativeResults: decision.authoritativeResults,
    },
  };
}
