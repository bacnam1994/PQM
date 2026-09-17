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
import { calculateSha256Sync } from '../../utils/cryptoUtils';

export const CURRENT_ENGINE_VERSION = '4.0.0-deterministic';

/**
 * Sinh mã băm bảo vệ toàn vẹn lịch sử đánh giá (Cryptographic SHA-256 Evaluation Hash)
 */
export function createEvaluationHash(payload: Record<string, any>): string {
  return calculateSha256Sync(payload);
}

/**
 * Hàm legacy hash cũ để tương thích ngược khi đọc dữ liệu lịch sử cũ
 */
function createLegacyEvaluationHash(payload: Record<string, any>): string {
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
 * Xây dựng payload tiêu chuẩn để tính băm bảo vệ toàn vẹn (Canonical Evaluation Hash Payload)
 */
export function buildEvaluationHashPayload(
  snapshot: Omit<EvaluationSnapshot, 'evaluationHash'>,
  testResultId: string,
  batchId?: string
): Record<string, any> {
  return {
    testResultId,
    batchId: batchId || '',
    tccsId: snapshot.tccsId || '',
    tccsVersion: snapshot.tccsVersion ?? 1,
    engineVersion: snapshot.engineVersion,
    criterionResults: snapshot.criterionResults,
    overallStatus: snapshot.overallStatus,
    alternateUsed: !!snapshot.alternateUsed,
    reasons: snapshot.reasons || [],
    warnings: snapshot.warnings || [],
    evaluatedAt: snapshot.evaluatedAt,
    evaluatedBy: snapshot.evaluatedBy,
  };
}

/**
 * Xác minh tính toàn vẹn chữ ký băm của EvaluationSnapshot (ALCOA+ Tamper Detection)
 */
export function verifyEvaluationSnapshotIntegrity(
  snapshot: EvaluationSnapshot | undefined | null,
  testResultId: string,
  batchId?: string
): boolean {
  if (!snapshot || !snapshot.evaluationHash) return false;

  // 1. Kiểm tra với chuẩn SHA-256 mới (12 trường cốt lõi)
  const fullPayload = buildEvaluationHashPayload(snapshot, testResultId, batchId);
  const calculatedSha256 = createEvaluationHash(fullPayload);
  if (snapshot.evaluationHash === calculatedSha256) {
    return true;
  }

  // 2. Tương thích ngược: Kiểm tra với legacy format (6 trường)
  const legacyPayload = {
    testResultId,
    batchId: batchId || '',
    overallStatus: snapshot.overallStatus,
    criterionResults: snapshot.criterionResults,
    evaluatedAt: snapshot.evaluatedAt,
    evaluatedBy: snapshot.evaluatedBy,
  };

  // Thử hash mới cho legacy payload
  if (snapshot.evaluationHash === createEvaluationHash(legacyPayload)) {
    return true;
  }

  // Thử legacy hash (eval_...)
  if (snapshot.evaluationHash.startsWith('eval_')) {
    return snapshot.evaluationHash === createLegacyEvaluationHash(legacyPayload);
  }

  return false;
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

  const tccsId = options?.tccs?.id || options?.batch?.tccsId;
  const tccsVersion = options?.tccs?.version || 1;

  const baseSnapshot: Omit<EvaluationSnapshot, 'evaluationHash'> = {
    engineVersion: CURRENT_ENGINE_VERSION,
    tccsId,
    tccsVersion,
    evaluatedAt,
    evaluatedBy,
    overallStatus: testResult.overallStatus,
    criterionResults,
    alternateUsed,
    reasons,
    warnings,
  };

  const hashPayload = buildEvaluationHashPayload(baseSnapshot, testResult.id, testResult.batchId);
  const evaluationHash = createEvaluationHash(hashPayload);

  return {
    ...baseSnapshot,
    evaluationHash,
  };
}
