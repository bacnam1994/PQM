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
import { AlternateRuleResolver } from './AlternateRuleResolver';

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

export interface SnapshotValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface SnapshotStaleCheckResult {
  stale: boolean;
  reason?: string;
}

/**
 * Tạo mã fingerprint canonical cho dữ liệu ảnh hưởng đến evaluation
 * Phase 1 - Canonical Evaluation Fingerprint
 */
export function buildEvaluationFingerprint(
  testResult: TestResult,
  boundTccs?: TCCS | null
): string {
  const sourceResults = testResult.results || [];
  const targetTccs = boundTccs || (testResult.batch as any)?.tccs;
  const tccsId = targetTccs?.id || testResult.tccsId || (testResult.batch as any)?.tccsId || '';
  const tccsVersion = targetTccs?.version ?? 1;

  const criterionItems = sourceResults.map((r, index) => ({
    order: index,
    criterionId: r.criterionId || '',
    criteriaName: (r.criteriaName || '').trim().toLowerCase(),
    value: r.value !== undefined && r.value !== null ? String(r.value).trim() : '',
    isPass: r.isPass === null || r.isPass === undefined ? null : Boolean(r.isPass),
    alternateState: r.alternateState || 'NONE',
    alternateRuleId: r.alternateRuleId || '',
    alternateSourceCriterion: r.alternateSourceCriterion || '',
    usedAlternate: Boolean((r as any).usedAlternate),
  }));

  const payload = {
    testResultId: testResult.id || '',
    batchId: testResult.batchId || '',
    tccsId: String(tccsId),
    tccsVersion: String(tccsVersion),
    engineVersion: CURRENT_ENGINE_VERSION,
    overallStatus: testResult.overallStatus || 'UNKNOWN',
    alternateUsed: Boolean(
      sourceResults.some((r: any) => r.usedAlternate) ||
      sourceResults.some((c) => c.alternateState && c.alternateState !== 'NONE')
    ),
    criterionCount: sourceResults.length,
    criterionResults: criterionItems,
  };

  return calculateSha256Sync(payload);
}

/**
 * Kiểm tra xem EvaluationSnapshot có bị lỗi thời (STALE) so với dữ liệu nguồn TestResult hay không.
 * Phase 2 - ALCOA+ Snapshot Stale Detection
 */
export function isEvaluationSnapshotStale(
  snapshot: EvaluationSnapshot | undefined | null,
  testResult: TestResult,
  boundTccs?: TCCS | null
): SnapshotStaleCheckResult {
  if (!snapshot) {
    return { stale: true, reason: 'Snapshot không tồn tại' };
  }

  // 1. Cờ vô hiệu hóa (Invalidated flag)
  if ((snapshot as any).isInvalidated === true) {
    return {
      stale: true,
      reason: 'Snapshot đã bị đánh dấu vô hiệu hóa (isInvalidated: true)',
    };
  }

  // 2. Khóa ngoại testResultId
  const snapshotTrId = snapshot.testResultId || (snapshot as any).testResultId;
  if (snapshotTrId && testResult.id && snapshotTrId !== testResult.id) {
    return {
      stale: true,
      reason: `Snapshot gắn sai testResultId (snapshot: ${snapshotTrId}, testResult: ${testResult.id})`,
    };
  }

  // 3. Khóa ngoại batchId
  const snapshotBatchId = snapshot.batchId || (snapshot as any).batchId;
  if (snapshotBatchId && testResult.batchId && snapshotBatchId !== testResult.batchId) {
    return {
      stale: true,
      reason: `Snapshot gắn sai batchId (snapshot: ${snapshotBatchId}, testResult: ${testResult.batchId})`,
    };
  }

  // 4. Case 10: Engine version khác
  if (snapshot.engineVersion && snapshot.engineVersion !== CURRENT_ENGINE_VERSION) {
    return {
      stale: true,
      reason: `Phiên bản engine trong snapshot (${snapshot.engineVersion}) khác với phiên bản hiện tại (${CURRENT_ENGINE_VERSION})`,
    };
  }

  // 5. Trạng thái overallStatus
  if (
    testResult.overallStatus &&
    snapshot.overallStatus &&
    snapshot.overallStatus !== testResult.overallStatus
  ) {
    return {
      stale: true,
      reason: `Trạng thái overallStatus đã thay đổi (${snapshot.overallStatus} so với hiện tại: ${testResult.overallStatus})`,
    };
  }

  // 6. Case 8 & 9: TCCS context check
  const targetTccs = boundTccs || (testResult.batch as any)?.tccs;
  if (targetTccs) {
    if (snapshot.tccsId && targetTccs.id && snapshot.tccsId !== targetTccs.id) {
      return {
        stale: true,
        reason: `Snapshot áp dụng sai TCCS (${snapshot.tccsId} so với hiện tại: ${targetTccs.id})`,
      };
    }
    if (snapshot.tccsVersion !== undefined && targetTccs.version !== undefined) {
      if (String(snapshot.tccsVersion) !== String(targetTccs.version)) {
        return {
          stale: true,
          reason: `Snapshot dùng phiên bản TCCS cũ (v${snapshot.tccsVersion} so với v${targetTccs.version}) - Cần re-evaluate`,
        };
      }
    }
  } else if (testResult.tccsId && snapshot.tccsId && testResult.tccsId !== snapshot.tccsId) {
    return {
      stale: true,
      reason: `TCCS ID của phiếu (${testResult.tccsId}) khác với TCCS ID trong snapshot (${snapshot.tccsId})`,
    };
  }

  // 7. Case 1, 2, 3: Số lượng chỉ tiêu thay đổi
  const sourceResults = testResult.results || [];
  const snapResults = snapshot.criterionResults || [];

  if (sourceResults.length !== snapResults.length) {
    return {
      stale: true,
      reason: `Số lượng chỉ tiêu hiện tại (${sourceResults.length}) khác với số lượng chỉ tiêu trong snapshot (${snapResults.length})`,
    };
  }

  // 8. Case 4, 5, 6, 7: Kiểm tra từng chỉ tiêu theo thứ tự
  for (let i = 0; i < sourceResults.length; i++) {
    const sourceCrit = sourceResults[i];
    const snapCrit = snapResults[i];
    if (!sourceCrit || !snapCrit) {
      return { stale: true, reason: `Chỉ tiêu thứ ${i + 1} không tồn tại` };
    }

    // Case 4 & 7: Tên chỉ tiêu & thứ tự
    const sourceName = (sourceCrit.criteriaName || '').trim().toLowerCase();
    const snapName = (snapCrit.criteriaName || '').trim().toLowerCase();
    if (sourceName !== snapName) {
      return {
        stale: true,
        reason: `Tên chỉ tiêu thứ ${i + 1} không khớp ("${sourceCrit.criteriaName}" vs "${snapCrit.criteriaName}")`,
      };
    }

    // Criterion ID (nếu cả hai đều có)
    if (
      sourceCrit.criterionId &&
      snapCrit.criterionId &&
      sourceCrit.criterionId !== snapCrit.criterionId
    ) {
      return {
        stale: true,
        reason: `Định danh chỉ tiêu "${sourceCrit.criteriaName}" không khớp (${sourceCrit.criterionId} vs ${snapCrit.criterionId})`,
      };
    }

    // Case 6: Trạng thái Đạt/Không đạt (isPass)
    if (sourceCrit.isPass !== snapCrit.isPass) {
      return {
        stale: true,
        reason: `Trạng thái đạt chỉ tiêu "${sourceCrit.criteriaName}" đã thay đổi (${sourceCrit.isPass} so với snapshot: ${snapCrit.isPass})`,
      };
    }

    // Case 5: Giá trị value
    const sourceVal =
      sourceCrit.value !== undefined && sourceCrit.value !== null
        ? String(sourceCrit.value).trim()
        : '';
    const snapVal =
      snapCrit.value !== undefined && snapCrit.value !== null
        ? String(snapCrit.value).trim()
        : (snapCrit as any).actualValue !== undefined && (snapCrit as any).actualValue !== null
          ? String((snapCrit as any).actualValue).trim()
          : '';
    if (sourceVal !== snapVal) {
      return {
        stale: true,
        reason: `Giá trị chỉ tiêu "${sourceCrit.criteriaName}" đã thay đổi ("${sourceVal}" so với snapshot: "${snapVal}")`,
      };
    }

    // Alternate state & rule
    if (
      sourceCrit.alternateState &&
      snapCrit.alternateState &&
      sourceCrit.alternateState !== snapCrit.alternateState
    ) {
      return {
        stale: true,
        reason: `Trạng thái quy tắc thay thế của chỉ tiêu "${sourceCrit.criteriaName}" đã thay đổi`,
      };
    }

    if (
      sourceCrit.alternateRuleId &&
      snapCrit.alternateRuleId &&
      sourceCrit.alternateRuleId !== snapCrit.alternateRuleId
    ) {
      return {
        stale: true,
        reason: `Quy tắc thay thế của chỉ tiêu "${sourceCrit.criteriaName}" đã thay đổi`,
      };
    }

    if (Boolean((sourceCrit as any).usedAlternate) !== Boolean((snapCrit as any).usedAlternate)) {
      return {
        stale: true,
        reason: `Cờ usedAlternate của chỉ tiêu "${sourceCrit.criteriaName}" đã thay đổi`,
      };
    }
  }

  return { stale: false };
}

/**
 * Kiểm tra tính hợp lệ toàn diện của EvaluationSnapshot (Model 2 - ALCOA+ Snapshot Gate)
 * Chỉ dùng evaluationSnapshot nếu:
 * - hash hợp lệ (verifyEvaluationSnapshotIntegrity)
 * - snapshot schema hợp lệ (overallStatus, criterionResults, engineVersion)
 * - snapshot chưa bị stale (isEvaluationSnapshotStale)
 * Nếu bất kỳ điều kiện nào không thỏa mãn -> isValid = false (cần re-evaluate).
 */
export function validateEvaluationSnapshot(
  snapshot: EvaluationSnapshot | undefined | null,
  testResult: TestResult,
  boundTccs?: TCCS | null
): SnapshotValidationResult {
  if (!snapshot) {
    return { isValid: false, reason: 'Snapshot không tồn tại' };
  }

  // 1. Schema check
  if (!snapshot.evaluationHash || typeof snapshot.evaluationHash !== 'string') {
    return { isValid: false, reason: 'Snapshot thiếu evaluationHash' };
  }
  if (
    !snapshot.overallStatus ||
    !['PASS', 'FAIL', 'PENDING', 'UNKNOWN'].includes(snapshot.overallStatus)
  ) {
    return { isValid: false, reason: 'Snapshot overallStatus không hợp lệ' };
  }
  if (!Array.isArray(snapshot.criterionResults)) {
    return { isValid: false, reason: 'Snapshot criterionResults không phải là mảng' };
  }
  if (!snapshot.engineVersion) {
    return { isValid: false, reason: 'Snapshot thiếu engineVersion' };
  }

  // 2. Cryptographic hash integrity check (ALCOA+ Tamper Detection)
  // Xác thực xem chính bản thân snapshot có bị can thiệp trái phép (tampered) hay không
  const isHashValid = verifyEvaluationSnapshotIntegrity(
    snapshot,
    snapshot.testResultId || testResult.id,
    snapshot.batchId || testResult.batchId
  );
  if (!isHashValid) {
    return {
      isValid: false,
      reason: 'Mã băm SHA-256 không hợp lệ hoặc dữ liệu snapshot bị sửa đổi (Hash Mismatch)',
    };
  }

  // 3. Stale check (Parity, TCCS version, overallStatus, foreign keys)
  // Nếu snapshot nguyên vẹn, đối chiếu xem snapshot có còn đồng nhất với dữ liệu nguồn mới nhất hay không
  const staleCheck = isEvaluationSnapshotStale(snapshot, testResult, boundTccs);
  if (staleCheck.stale) {
    return {
      isValid: false,
      reason:
        staleCheck.reason ||
        'Snapshot không còn đồng nhất với dữ liệu Phiếu kiểm nghiệm mới nhất (STALE)',
    };
  }

  return { isValid: true };
}

/**
 * Khởi tạo Snapshot đóng băng kết quả thẩm định cho phiếu kiểm nghiệm
 */
export function buildEvaluationSnapshot(
  testResult: TestResult,
  currentUser: any,
  options?: { batch?: Batch; tccs?: TCCS; boundTccs?: TCCS }
): EvaluationSnapshot {
  const evaluatedAt = new Date().toISOString();
  const evaluatedBy = currentUser?.email || 'system';

  const targetTccs = options?.tccs || options?.boundTccs;
  const criterionResults: EvaluationSnapshotCriterionResult[] = (testResult.results || []).map(
    (entry) => {
      let altState = entry.alternateState;
      let altRuleId = entry.alternateRuleId;
      let altSource = entry.alternateSourceCriterion;
      let altNote = entry.alternateNote;

      if (!altState && targetTccs) {
        const resolved = AlternateRuleResolver.resolveCriterionState(
          entry.criteriaName,
          entry.value,
          testResult.results || [],
          targetTccs
        );
        altState = resolved.alternateState;
        altRuleId = resolved.rule?.id;
        altSource = resolved.pairedCriterionName;
        altNote = resolved.displayNote;
      }

      return {
        criterionId: entry.criterionId,
        criteriaName: entry.criteriaName,
        value: entry.value,
        isPass: entry.isPass,
        note: entry.limit ? `Giới hạn: ${entry.limit}` : undefined,
        alternateState: altState,
        alternateRuleId: altRuleId,
        alternateSourceCriterion: altSource,
        alternateNote: altNote,
        usedAlternate: (entry as any).usedAlternate,
      };
    }
  );

  const alternateUsed =
    (testResult.results || []).some((r: any) => r.usedAlternate) ||
    criterionResults.some((c) => c.alternateState && c.alternateState !== 'NONE');
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

  const tccsId = targetTccs?.id || options?.batch?.tccsId || testResult.tccsId;
  const tccsVersion = targetTccs?.version || 1;

  const baseSnapshot: Omit<EvaluationSnapshot, 'evaluationHash'> = {
    engineVersion: CURRENT_ENGINE_VERSION,
    testResultId: testResult.id,
    batchId: testResult.batchId,
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
