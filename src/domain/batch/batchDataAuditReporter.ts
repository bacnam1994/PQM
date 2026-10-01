/**
 * batchDataAuditReporter.ts
 * ==========================
 * Báo cáo kiểm toán toàn vẹn dữ liệu Lô & Phiếu kiểm nghiệm (Phase 13).
 *
 * Phân loại chi tiết và xuất báo cáo ALCOA+ trước khi thực hiện bất kỳ thao tác sửa chữa nào:
 * - totalTestResults
 * - primaryMatches
 * - legacyMatches
 * - trueOrphans
 * - falseOrphans
 * - ambiguous
 * - unresolved
 *
 * Tuyệt đối không tự động sửa AMBIGUOUS.
 */

import { Batch, TestResult } from '../../types';
import {
  BatchTestRelationshipType,
  buildTestResultIndex,
  resolveBatchTestRelationship,
} from './batchTestResultResolver';
import { DataFreshnessState } from './batchIntegrityValidator';

export interface DataAuditRecordItem {
  testResultId: string;
  currentBatchId?: string;
  currentBatchNo?: string;
  resolvedBatchId?: string;
  resolutionType: BatchTestRelationshipType;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reason: string;
}

export interface DataAuditReport {
  totalTestResults: number;
  primaryMatches: number;
  legacyMatches: number;
  trueOrphans: number;
  falseOrphans: number;
  ambiguous: number;
  unresolved: number;
  records: DataAuditRecordItem[];
  generatedAt: string;
}

export function generateBatchDataAuditReport(
  testResults: TestResult[] = [],
  batches: Batch[] = [],
  dataFreshness?: DataFreshnessState
): DataAuditReport {
  const index = buildTestResultIndex(testResults, batches, dataFreshness);
  const records: DataAuditRecordItem[] = [];

  let primaryMatches = 0;
  let legacyMatches = 0;
  let trueOrphans = 0;
  let falseOrphans = 0;
  let ambiguous = 0;
  let unresolved = 0;

  testResults.forEach((tr) => {
    if (!tr) return;
    const lookup = index.getBatchForTestResult(tr);
    const rawBatchId = tr.batchId || '';
    const rawBatchNo = (tr as any).batchNo || '';

    let resType: BatchTestRelationshipType = 'UNRESOLVED';
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE';

    if (lookup.relationshipType === 'PRIMARY') {
      resType = 'PRIMARY_MATCH';
      confidence = 'HIGH';
      primaryMatches++;
    } else if (
      lookup.relationshipType === 'LEGACY_BATCH_NO' ||
      lookup.relationshipType === 'EXPLICIT_RELATIONSHIP_MATCH'
    ) {
      resType = 'LEGACY_BATCHNO_MATCH';
      confidence = 'MEDIUM';
      legacyMatches++;
    } else if (lookup.relationshipType === 'AMBIGUOUS_MATCH') {
      resType = 'AMBIGUOUS_MATCH';
      confidence = 'LOW';
      ambiguous++;
    } else if (lookup.relationshipType === 'FALSE_ORPHAN_PARTIAL_SNAPSHOT') {
      resType = 'FALSE_ORPHAN_PARTIAL_SNAPSHOT';
      confidence = 'LOW';
      falseOrphans++;
    } else if (lookup.relationshipType === 'INVALID_ORPHAN') {
      resType = 'TRUE_ORPHAN';
      confidence = 'HIGH';
      trueOrphans++;
    } else {
      resType = 'UNRESOLVED';
      confidence = 'NONE';
      unresolved++;
    }

    records.push({
      testResultId: tr.id,
      currentBatchId: rawBatchId,
      currentBatchNo: rawBatchNo,
      resolvedBatchId: lookup.batch?.id,
      resolutionType: resType,
      confidence,
      reason: lookup.reason || lookup.diagnosticWarning || 'Không xác định',
    });
  });

  return {
    totalTestResults: testResults.length,
    primaryMatches,
    legacyMatches,
    trueOrphans,
    falseOrphans,
    ambiguous,
    unresolved,
    records,
    generatedAt: new Date().toISOString(),
  };
}
