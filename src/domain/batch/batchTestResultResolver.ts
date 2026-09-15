/**
 * batchTestResultResolver.ts
 * ==========================
 * Canonical Domain Utility giải quyết và chuẩn hóa mối quan hệ liên kết giữa:
 * Batch (Lô sản xuất) <---> TestResult (Phiếu kiểm nghiệm)
 *
 * Nguyên tắc cốt lõi:
 * 1. Technical Relationship Key (Khóa chính thức):
 *    testResult.batchId === batch.id
 * 2. Business Key / Display Identifier:
 *    batch.batchNo chỉ là số hiệu hiển thị, KHÔNG dùng làm khóa ngoại chính.
 * 3. Phân biệt rõ ràng các kiểu quan hệ:
 *    - PRIMARY: batchId === batch.id
 *    - LEGACY_BATCH_NO: testResult liên kết bằng batchNo thay vì technical ID
 *    - INVALID_ORPHAN: testResult trỏ tới batchId không tồn tại
 *    - INVALID_EMPTY_BATCH_ID: testResult thiếu batchId
 */

import { Batch, TestResult } from '../../types';

export type RelationshipType =
  | 'PRIMARY'
  | 'LEGACY_BATCH_NO'
  | 'INVALID_ORPHAN'
  | 'INVALID_EMPTY_BATCH_ID';

export interface ResolvedTestResultItem {
  testResult: TestResult;
  relationshipType: RelationshipType;
  matchedBatchId?: string;
  isPrimary: boolean;
  isLegacy: boolean;
  isInvalid: boolean;
  mismatchReason?: string;
}

export interface BatchTestResolutionResult {
  batch: Batch;
  primaryResults: TestResult[];
  legacyResults: TestResult[];
  invalidResults: TestResult[];
  allCandidateResults: TestResult[];
  hasPrimaryMatch: boolean;
  hasLegacyMatch: boolean;
  hasInvalidMatch: boolean;
}

export interface TestResultIndexSnapshot {
  primaryMap: Map<string, TestResult[]>; // key: batch.id
  legacyMap: Map<string, TestResult[]>; // key: batch.id (test results linked only by batchNo)
  orphanResults: TestResult[];
  invalidLinkResults: ResolvedTestResultItem[];
  getBatchForTestResult: (testResult: TestResult) => {
    batch?: Batch;
    relationshipType: RelationshipType;
    reason?: string;
  };
}

/**
 * Xây dựng Index O(1) hiệu năng cao cho tập dữ liệu TestResults và Batches
 */
export function buildTestResultIndex(
  testResults: TestResult[] = [],
  batches: Batch[] = []
): TestResultIndexSnapshot {
  const batchIdMap = new Map<string, Batch>();
  const batchNoMap = new Map<string, Batch>();

  batches.forEach((b) => {
    if (b && b.id) {
      batchIdMap.set(b.id, b);
    }
    if (b && b.batchNo) {
      batchNoMap.set(b.batchNo.trim().toLowerCase(), b);
    }
  });

  const primaryMap = new Map<string, TestResult[]>();
  const legacyMap = new Map<string, TestResult[]>();
  const orphanResults: TestResult[] = [];
  const invalidLinkResults: ResolvedTestResultItem[] = [];

  const getBatchForTestResult = (
    r: TestResult
  ): { batch?: Batch; relationshipType: RelationshipType; reason?: string } => {
    if (!r) {
      return { relationshipType: 'INVALID_EMPTY_BATCH_ID', reason: 'TestResult record is empty' };
    }

    const rawBatchId = (r.batchId || '').trim();
    const rawBatchNo = ((r as any).batchNo || '').trim();

    // 1. Kiểm tra Technical Relationship (PRIMARY)
    if (rawBatchId && batchIdMap.has(rawBatchId)) {
      return {
        batch: batchIdMap.get(rawBatchId),
        relationshipType: 'PRIMARY',
      };
    }

    // 2. Kiểm tra nếu batchId thực chất đang chứa số lô (batchNo) thay vì batch.id
    if (rawBatchId && batchNoMap.has(rawBatchId.toLowerCase())) {
      const matched = batchNoMap.get(rawBatchId.toLowerCase())!;
      return {
        batch: matched,
        relationshipType: 'LEGACY_BATCH_NO',
        reason: `Phiếu kiểm nghiệm dùng số lô (${rawBatchId}) làm batchId thay vì ID kỹ thuật (${matched.id})`,
      };
    }

    // 3. Kiểm tra trường hợp testResult có trường batchNo riêng khớp với số lô
    if (rawBatchNo && batchNoMap.has(rawBatchNo.toLowerCase())) {
      const matched = batchNoMap.get(rawBatchNo.toLowerCase())!;
      return {
        batch: matched,
        relationshipType: 'LEGACY_BATCH_NO',
        reason: `Phiếu kiểm nghiệm có số lô ${rawBatchNo} khớp với lô ${matched.batchNo}, nhưng batchId là "${rawBatchId}"`,
      };
    }

    // 4. Nếu không có batchId
    if (!rawBatchId) {
      return {
        relationshipType: 'INVALID_EMPTY_BATCH_ID',
        reason: 'Phiếu kiểm nghiệm không có thuộc tính batchId',
      };
    }

    // 5. Trỏ tới batchId không tồn tại -> ORPHAN
    return {
      relationshipType: 'INVALID_ORPHAN',
      reason: `Batch ID "${rawBatchId}" không tồn tại trong danh sách Lô sản xuất`,
    };
  };

  testResults.forEach((r) => {
    const res = getBatchForTestResult(r);

    if (res.relationshipType === 'PRIMARY' && res.batch) {
      const list = primaryMap.get(res.batch.id) || [];
      list.push(r);
      primaryMap.set(res.batch.id, list);
    } else if (res.relationshipType === 'LEGACY_BATCH_NO' && res.batch) {
      const list = legacyMap.get(res.batch.id) || [];
      list.push(r);
      legacyMap.set(res.batch.id, list);

      invalidLinkResults.push({
        testResult: r,
        relationshipType: 'LEGACY_BATCH_NO',
        matchedBatchId: res.batch.id,
        isPrimary: false,
        isLegacy: true,
        isInvalid: false,
        mismatchReason: res.reason,
      });
    } else if (res.relationshipType === 'INVALID_ORPHAN') {
      orphanResults.push(r);
      invalidLinkResults.push({
        testResult: r,
        relationshipType: 'INVALID_ORPHAN',
        isPrimary: false,
        isLegacy: false,
        isInvalid: true,
        mismatchReason: res.reason,
      });
    } else {
      orphanResults.push(r);
      invalidLinkResults.push({
        testResult: r,
        relationshipType: 'INVALID_EMPTY_BATCH_ID',
        isPrimary: false,
        isLegacy: false,
        isInvalid: true,
        mismatchReason: res.reason,
      });
    }
  });

  return {
    primaryMap,
    legacyMap,
    orphanResults,
    invalidLinkResults,
    getBatchForTestResult,
  };
}

/**
 * Tra cứu toàn bộ phiếu kiểm nghiệm liên quan cho 1 Batch cụ thể
 */
export function resolveTestResultsForBatch(
  batch: Batch,
  testResults: TestResult[] = [],
  batches: Batch[] = []
): BatchTestResolutionResult {
  if (!batch) {
    throw new Error('Yêu cầu thông tin Batch hợp lệ để phân giải phiếu kiểm nghiệm.');
  }

  // Nếu batches không có batch hiện tại, gộp vào
  const allBatches = batches.some((b) => b.id === batch.id) ? batches : [batch, ...batches];
  const index = buildTestResultIndex(testResults, allBatches);

  const primary = index.primaryMap.get(batch.id) || [];
  const legacy = index.legacyMap.get(batch.id) || [];
  const invalid = index.invalidLinkResults
    .filter((item) => item.matchedBatchId === batch.id)
    .map((item) => item.testResult);

  return {
    batch,
    primaryResults: primary,
    legacyResults: legacy,
    invalidResults: invalid,
    allCandidateResults: [...primary, ...legacy],
    hasPrimaryMatch: primary.length > 0,
    hasLegacyMatch: legacy.length > 0,
    hasInvalidMatch: invalid.length > 0,
  };
}

/**
 * Truy vấn trực tiếp Firebase RTDB theo batchId (O(1) Indexed Query)
 * Dùng cho chế độ Xác minh sâu (Deep Verification) hoặc khi nghi ngờ in-memory cache chưa tải đủ
 */
export async function fetchOnlineTestResultsForBatch(batch: Batch): Promise<TestResult[]> {
  if (!batch || !batch.id) return [];
  try {
    const { testResultRepository } =
      await import('../../repositories/firebase/FirebaseTestResultRepository');
    const results = await testResultRepository.findByBatchId(batch.id);
    if (results && results.length > 0) return results;

    // Fallback: nếu dữ liệu cũ lưu số lô (batchNo) vào trường batchId
    if (batch.batchNo && batch.batchNo !== batch.id) {
      const legacyResults = await testResultRepository.findByBatchId(batch.batchNo);
      if (legacyResults && legacyResults.length > 0) return legacyResults;
    }
  } catch (error) {
    console.warn(
      `[BatchTestResultResolver] Không thể truy vấn trực tiếp Firebase cho lô ${batch.batchNo}:`,
      error
    );
  }
  return [];
}
