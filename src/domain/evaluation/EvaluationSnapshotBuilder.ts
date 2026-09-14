/**
 * EvaluationSnapshotBuilder.ts
 * Xây dựng EvaluationSnapshot đóng băng lịch sử kiểm nghiệm (Phase 4).
 * Tuân thủ chuẩn ALCOA+ Data Integrity trong kiểm nghiệm Dược:
 * - engineVersion: Phiên bản thuật toán đánh giá
 * - tccsId & tccsVersion: Định danh và phiên bản tiêu chuẩn áp dụng tại thời điểm ký duyệt
 * - evaluatedAt & evaluatedBy: Thời gian và danh tính người thực hiện
 * - overallStatus: PASS / FAIL
 * - criterionResults: Danh sách đánh giá chi tiết từng chỉ tiêu
 * - evaluationHash: Mã băm toàn vẹn dữ liệu
 */

import {
  TestResult,
  EvaluationSnapshot,
  EvaluationSnapshotCriterionResult,
  Batch,
  TCCS,
} from '../../types';

export const CURRENT_ENGINE_VERSION = '4.0.0-deterministic';

/**
 * Sinh mã băm bảo vệ toàn vẹn lịch sử đánh giá (Deterministic Evaluation Hash)
 */
export function createEvaluationHash(payload: Record<string, any>): string {
  const str = JSON.stringify(payload);
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c64e6d ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'eval_' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Khởi tạo Snapshot đóng băng kết quả thẩm định cho phiếu kiểm nghiệm
 */
export function buildEvaluationSnapshot(
  testResult: TestResult,
  currentUser: any,
  options?: { batch?: Batch; tccs?: TCCS }
): EvaluationSnapshot {
  const evaluatedAt = new Date().toISOString();
  const evaluatedBy = currentUser?.email || 'system';

  const criterionResults: EvaluationSnapshotCriterionResult[] = (testResult.results || []).map(
    (entry) => ({
      criteriaName: entry.criteriaName,
      value: entry.value,
      isPass: entry.isPass,
      note: entry.limit ? `Giới hạn: ${entry.limit}` : undefined,
    })
  );

  const alternateUsed = (testResult.results || []).some((r: any) => r.usedAlternate);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (testResult.overallStatus === 'FAIL') {
    const failedNames = (testResult.results || [])
      .filter((r) => r.isPass === false)
      .map((r) => r.criteriaName);
    if (failedNames.length > 0) {
      reasons.push(`Chỉ tiêu không đạt: ${failedNames.join(', ')}`);
    }
  }

  const hashPayload = {
    testResultId: testResult.id,
    batchId: testResult.batchId,
    overallStatus: testResult.overallStatus,
    criterionResults,
    evaluatedAt,
    evaluatedBy,
  };

  const evaluationHash = createEvaluationHash(hashPayload);

  return {
    engineVersion: CURRENT_ENGINE_VERSION,
    tccsId: options?.tccs?.id || options?.batch?.tccsId,
    tccsVersion: options?.tccs?.version || 1,
    evaluatedAt,
    evaluatedBy,
    overallStatus: testResult.overallStatus,
    criterionResults,
    alternateUsed,
    reasons,
    warnings,
    evaluationHash,
  };
}
