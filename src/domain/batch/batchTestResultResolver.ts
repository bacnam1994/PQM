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

export type BatchTestRelationshipType =
  | 'TRUE_ORPHAN'
  | 'FALSE_ORPHAN_PARTIAL_SNAPSHOT'
  | 'PRIMARY_MATCH'
  | 'LEGACY_BATCHNO_MATCH'
  | 'EXPLICIT_RELATIONSHIP_MATCH'
  | 'AMBIGUOUS_MATCH'
  | 'UNRESOLVED';

export type RelationshipType =
  | 'PRIMARY'
  | 'LEGACY_BATCH_NO'
  | 'INVALID_ORPHAN'
  | 'INVALID_EMPTY_BATCH_ID'
  | BatchTestRelationshipType;

export interface BatchTestRelationshipResult {
  relationshipType: BatchTestRelationshipType;
  isMatch: boolean;
  isAuthoritative: boolean;
  batchId?: string;
  batchNo?: string;
  testResultId?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reason?: string;
  diagnosticWarning?: string;
}

export interface ResolvedTestResultItem {
  testResult: TestResult;
  relationshipType: RelationshipType;
  matchedBatchId?: string;
  isPrimary: boolean;
  isLegacy: boolean;
  isInvalid: boolean;
  isExplicit?: boolean;
  isAmbiguous?: boolean;
  isTrueOrphan?: boolean;
  isFalseOrphan?: boolean;
  mismatchReason?: string;
  diagnosticWarning?: string;
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
  legacyMap: Map<string, TestResult[]>; // key: batch.id (test results linked only by batchNo or explicit)
  orphanResults: TestResult[];
  falseOrphanResults: TestResult[];
  ambiguousResults: TestResult[];
  invalidLinkResults: ResolvedTestResultItem[];
  getBatchForTestResult: (testResult: TestResult) => {
    batch?: Batch;
    relationshipType: RelationshipType;
    reason?: string;
    diagnosticWarning?: string;
  };
}

/**
 * Canonical SSoT API: Phân giải mối quan hệ giữa một Batch và một TestResult
 * Tuân thủ thứ tự ưu tiên bắt buộc:
 * 1. PRIMARY: testResult.batchId === batch.id
 * 2. EXPLICIT: explicit targetBatchId / linkedBatchId khớp batch.id
 * 3. LEGACY_BATCH_NO: testResult.batchId === batch.batchNo hoặc testResult.batchNo === batch.batchNo
 * 4. Suffix matching: CHỈ DÙNG CHO DIAGNOSTIC/CẢNH BÁO, TUYỆT ĐỐI KHÔNG làm authoritative relationship
 * 5. UNRESOLVED
 */
export function resolveBatchTestRelationship(
  batch: Batch | null | undefined,
  testResult: TestResult | null | undefined
): BatchTestRelationshipResult {
  if (!batch || !testResult) {
    return {
      relationshipType: 'UNRESOLVED',
      isMatch: false,
      isAuthoritative: false,
      confidence: 'NONE',
      reason: 'Thiếu thông tin Lô sản xuất hoặc Phiếu kiểm nghiệm.',
    };
  }

  const rawBatchId = (testResult.batchId || '').trim();
  const rawBatchNo = ((testResult as any).batchNo || '').trim();
  const batchId = (batch.id || '').trim();
  const batchNo = (batch.batchNo || '').trim();

  // 1. PRIMARY MATCH: testResult.batchId === batch.id
  if (rawBatchId && batchId && rawBatchId === batchId) {
    return {
      relationshipType: 'PRIMARY_MATCH',
      isMatch: true,
      isAuthoritative: true,
      batchId,
      batchNo,
      testResultId: testResult.id,
      confidence: 'HIGH',
      reason: `Phiếu kiểm nghiệm liên kết trực tiếp bằng ID kỹ thuật (${batchId}).`,
    };
  }

  // 2. EXPLICIT RELATIONSHIP MATCH: explicit targetBatchId / linkedBatchId khớp batch.id
  const explicitTargetId = (
    (testResult as any).targetBatchId ||
    (testResult as any).linkedBatchId ||
    ''
  ).trim();
  if (explicitTargetId && batchId && explicitTargetId === batchId) {
    return {
      relationshipType: 'EXPLICIT_RELATIONSHIP_MATCH',
      isMatch: true,
      isAuthoritative: true,
      batchId,
      batchNo,
      testResultId: testResult.id,
      confidence: 'HIGH',
      reason: `Phiếu kiểm nghiệm liên kết qua khóa quan hệ tường minh (${explicitTargetId}).`,
    };
  }

  // 3. LEGACY BATCH NO MATCH: testResult.batchId === batch.batchNo hoặc testResult.batchNo === batch.batchNo
  const normBatchNo = batchNo.toLowerCase();
  const isMatchByBatchIdAsBatchNo =
    rawBatchId && normBatchNo && rawBatchId.toLowerCase() === normBatchNo;
  const isMatchByFieldBatchNo =
    rawBatchNo && normBatchNo && rawBatchNo.toLowerCase() === normBatchNo;

  if (isMatchByBatchIdAsBatchNo || isMatchByFieldBatchNo) {
    return {
      relationshipType: 'LEGACY_BATCHNO_MATCH',
      isMatch: true,
      isAuthoritative: true,
      batchId,
      batchNo,
      testResultId: testResult.id,
      confidence: 'MEDIUM',
      reason: isMatchByBatchIdAsBatchNo
        ? `Phiếu kiểm nghiệm dùng số lô (${rawBatchId}) làm batchId thay vì ID kỹ thuật (${batchId}).`
        : `Phiếu kiểm nghiệm có số lô (${rawBatchNo}) khớp với số hiệu lô (${batchNo}).`,
    };
  }

  // 4. Suffix matching: CHỈ DÙNG CHO DIAGNOSTIC/CẢNH BÁO, tuyệt đối KHÔNG làm authoritative relationship
  const isSuffixMatched =
    rawBatchId &&
    batchId &&
    rawBatchId !== batchId &&
    (rawBatchId.endsWith(batchId) || batchId.endsWith(rawBatchId));

  if (isSuffixMatched) {
    return {
      relationshipType: 'UNRESOLVED',
      isMatch: false,
      isAuthoritative: false,
      batchId,
      batchNo,
      testResultId: testResult.id,
      confidence: 'LOW',
      reason: `Khớp hậu tố chuỗi giữa batchId "${rawBatchId}" và "${batchId}".`,
      diagnosticWarning:
        'Cảnh báo: Phát hiện trùng khớp hậu tố (suffix match), nhưng quy chuẩn SSoT không công nhận đây là liên kết chính thức.',
    };
  }

  // 5. UNRESOLVED
  return {
    relationshipType: 'UNRESOLVED',
    isMatch: false,
    isAuthoritative: false,
    confidence: 'NONE',
    reason: `Phiếu kiểm nghiệm không khớp với Lô sản xuất ${batchNo} (${batchId}).`,
  };
}

/**
 * Xây dựng Index O(1) hiệu năng cao cho tập dữ liệu TestResults và Batches
 * Hỗ trợ Data Freshness để phân biệt rõ TRUE_ORPHAN vs FALSE_ORPHAN_PARTIAL_SNAPSHOT
 */
export function buildTestResultIndex(
  testResults: TestResult[] = [],
  batches: Batch[] = [],
  dataFreshness?: {
    isBatchesLoading?: boolean;
    isTestResultsLoading?: boolean;
    testResultsLoaded?: boolean;
    loadState?: string;
    isOffline?: boolean;
  }
): TestResultIndexSnapshot {
  const batchIdMap = new Map<string, Batch>();
  const batchNoGroupMap = new Map<string, Batch[]>();

  batches.forEach((b) => {
    if (b && b.id) {
      batchIdMap.set(b.id, b);
    }
    if (b && b.batchNo) {
      const key = b.batchNo.trim().toLowerCase();
      const list = batchNoGroupMap.get(key) || [];
      list.push(b);
      batchNoGroupMap.set(key, list);
    }
  });

  const primaryMap = new Map<string, TestResult[]>();
  const legacyMap = new Map<string, TestResult[]>();
  const orphanResults: TestResult[] = [];
  const falseOrphanResults: TestResult[] = [];
  const ambiguousResults: TestResult[] = [];
  const invalidLinkResults: ResolvedTestResultItem[] = [];

  const trIdMap = new Map<string, TestResult>();
  testResults.forEach((tr) => {
    if (tr && tr.id) trIdMap.set(tr.id, tr);
  });

  const isDataIncomplete = Boolean(
    dataFreshness?.isBatchesLoading ||
    dataFreshness?.isTestResultsLoading ||
    dataFreshness?.loadState === 'PARTIAL' ||
    dataFreshness?.loadState === 'LOADING' ||
    dataFreshness?.isOffline ||
    (dataFreshness?.testResultsLoaded === false && testResults.length === 0)
  );

  const getBatchForTestResult = (
    r: TestResult
  ): {
    batch?: Batch;
    relationshipType: RelationshipType;
    reason?: string;
    diagnosticWarning?: string;
  } => {
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

    // 2. Explicit targetId
    const explicitTargetId = ((r as any).targetBatchId || (r as any).linkedBatchId || '').trim();
    if (explicitTargetId && batchIdMap.has(explicitTargetId)) {
      return {
        batch: batchIdMap.get(explicitTargetId),
        relationshipType: 'EXPLICIT_RELATIONSHIP_MATCH',
        reason: `Phiếu kiểm nghiệm liên kết qua khóa quan hệ tường minh (${explicitTargetId})`,
      };
    }

    // 3. Kiểm tra nếu batchId hoặc r.batchNo chứa số lô (batchNo)
    const checkBatchNoMatch = (candidateBatchNo: string) => {
      const matchedList = batchNoGroupMap.get(candidateBatchNo.toLowerCase());
      if (matchedList && matchedList.length > 0) {
        if (matchedList.length > 1) {
          // Trùng lặp số lô -> AMBIGUOUS_MATCH
          return {
            isAmbiguous: true,
            batches: matchedList,
          };
        }
        return {
          batch: matchedList[0],
          isAmbiguous: false,
        };
      }
      return null;
    };

    if (rawBatchId) {
      const match = checkBatchNoMatch(rawBatchId);
      if (match?.isAmbiguous) {
        return {
          relationshipType: 'AMBIGUOUS_MATCH',
          reason: `Phát hiện nhiều Lô có cùng số hiệu "${rawBatchId}". Không thể xác định chính thức.`,
        };
      }
      if (match?.batch) {
        return {
          batch: match.batch,
          relationshipType: 'LEGACY_BATCH_NO',
          reason: `Phiếu kiểm nghiệm dùng số lô (${rawBatchId}) làm batchId thay vì ID kỹ thuật (${match.batch.id})`,
        };
      }
    }

    if (rawBatchNo) {
      const match = checkBatchNoMatch(rawBatchNo);
      if (match?.isAmbiguous) {
        return {
          relationshipType: 'AMBIGUOUS_MATCH',
          reason: `Phát hiện nhiều Lô có cùng số hiệu "${rawBatchNo}". Không thể xác định chính thức.`,
        };
      }
      if (match?.batch) {
        return {
          batch: match.batch,
          relationshipType: 'LEGACY_BATCH_NO',
          reason: `Phiếu kiểm nghiệm có số lô ${rawBatchNo} khớp với lô ${match.batch.batchNo}, nhưng batchId là "${rawBatchId}"`,
        };
      }
    }

    // 4. Kế thừa liên kết từ chuỗi sửa đổi (Retest / Revision Chain: originalResultId / supersedesId)
    const parentId = (
      (r as any).originalResultId ||
      (r as any).supersedesId ||
      (r as any).retestOfId ||
      ''
    ).trim();
    if (parentId && trIdMap.has(parentId) && parentId !== r.id) {
      const parent = trIdMap.get(parentId)!;
      const parentBatchId = (parent.batchId || '').trim();
      const parentBatchNo = ((parent as any).batchNo || '').trim().toLowerCase();
      const parentBatch =
        (parentBatchId && batchIdMap.get(parentBatchId)) ||
        (parentBatchId && batchNoGroupMap.get(parentBatchId.toLowerCase())?.[0]) ||
        (parentBatchNo && batchNoGroupMap.get(parentBatchNo)?.[0]);

      if (parentBatch) {
        return {
          batch: parentBatch,
          relationshipType: 'PRIMARY',
          reason: `Phiếu kiểm nghiệm kế thừa liên kết Lô từ phiếu gốc (${parentId})`,
        };
      }
    }

    // 5. Khôi phục liên kết qua số phiếu báo cáo (reportNo peer match)
    const reportCode = ((r as any).reportNo || (r as any).reportNumber || (r as any).code || '')
      .trim()
      .toLowerCase();
    if (reportCode) {
      const peer = testResults.find(
        (other) =>
          other &&
          other.id !== r.id &&
          ((other as any).reportNo || (other as any).reportNumber || (other as any).code || '')
            .trim()
            .toLowerCase() === reportCode &&
          ((other.batchId && batchIdMap.has(other.batchId.trim())) ||
            (other.batchId && batchNoGroupMap.has(other.batchId.trim().toLowerCase())))
      );
      if (peer) {
        const peerBatchId = (peer.batchId || '').trim();
        const peerBatch =
          batchIdMap.get(peerBatchId) || batchNoGroupMap.get(peerBatchId.toLowerCase())?.[0];
        if (peerBatch) {
          return {
            batch: peerBatch,
            relationshipType: 'PRIMARY',
            reason: `Phiếu kiểm nghiệm khôi phục liên kết Lô qua số phiếu ${reportCode} từ phiếu đồng cấp (${peer.id})`,
          };
        }
      }
    }

    // 6. Kiểm tra so khớp hậu tố (Suffix match) - CHỈ CẢNH BÁO, KHÔNG GÁN BATCH
    if (rawBatchId) {
      const partialBatch = batches.find(
        (b) => b.id && (rawBatchId.endsWith(b.id) || b.id.endsWith(rawBatchId))
      );
      if (partialBatch) {
        return {
          relationshipType: 'UNRESOLVED',
          diagnosticWarning: `Phát hiện khớp hậu tố chuỗi với Lô ${partialBatch.batchNo} (${partialBatch.id}), nhưng không được công nhận là liên kết chính thức.`,
          reason: `Phiếu kiểm nghiệm khớp hậu tố với ${partialBatch.batchNo} (${partialBatch.id}) nhưng không đủ cơ sở authoritative.`,
        };
      }
    }

    // 7. Nếu không có batchId và không có batchNo
    if (!rawBatchId && !rawBatchNo) {
      return {
        relationshipType: 'INVALID_EMPTY_BATCH_ID',
        reason: 'Phiếu kiểm nghiệm không có thuộc tính batchId hoặc batchNo',
      };
    }

    // 8. Trỏ tới batchId không tồn tại -> Kiểm tra Data Freshness
    if (isDataIncomplete) {
      return {
        relationshipType: 'FALSE_ORPHAN_PARTIAL_SNAPSHOT',
        reason: `Dữ liệu Lô sản xuất đang tải hoặc ở trạng thái cục bộ/partial. Chưa thể kết luận mồ côi.`,
      };
    }

    return {
      relationshipType: 'INVALID_ORPHAN',
      reason: `Batch ID "${rawBatchId}" không tồn tại trong danh mục Lô sản xuất đã nạp đầy đủ.`,
    };
  };

  testResults.forEach((r) => {
    const res = getBatchForTestResult(r);

    if (res.relationshipType === 'PRIMARY' && res.batch) {
      const list = primaryMap.get(res.batch.id) || [];
      list.push(r);
      primaryMap.set(res.batch.id, list);
    } else if (
      (res.relationshipType === 'LEGACY_BATCH_NO' ||
        res.relationshipType === 'EXPLICIT_RELATIONSHIP_MATCH') &&
      res.batch
    ) {
      const list = legacyMap.get(res.batch.id) || [];
      list.push(r);
      legacyMap.set(res.batch.id, list);

      invalidLinkResults.push({
        testResult: r,
        relationshipType: res.relationshipType,
        matchedBatchId: res.batch.id,
        isPrimary: false,
        isLegacy: true,
        isInvalid: false,
        mismatchReason: res.reason,
      });
    } else if (res.relationshipType === 'AMBIGUOUS_MATCH') {
      ambiguousResults.push(r);
      invalidLinkResults.push({
        testResult: r,
        relationshipType: 'AMBIGUOUS_MATCH',
        isPrimary: false,
        isLegacy: false,
        isInvalid: true,
        isAmbiguous: true,
        mismatchReason: res.reason,
      });
    } else if (res.relationshipType === 'FALSE_ORPHAN_PARTIAL_SNAPSHOT') {
      falseOrphanResults.push(r);
    } else if (res.relationshipType === 'INVALID_ORPHAN') {
      orphanResults.push(r);
      invalidLinkResults.push({
        testResult: r,
        relationshipType: 'INVALID_ORPHAN',
        isPrimary: false,
        isLegacy: false,
        isInvalid: true,
        isTrueOrphan: true,
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
        diagnosticWarning: res.diagnosticWarning,
      });
    }
  });

  return {
    primaryMap,
    legacyMap,
    orphanResults,
    falseOrphanResults,
    ambiguousResults,
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
