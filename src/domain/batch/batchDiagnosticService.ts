/**
 * batchDiagnosticService.ts
 * ==========================
 * Dịch vụ Chẩn đoán Chất lượng Lô chuyên sâu (Batch Diagnostic Engine).
 * Cung cấp khả năng thanh tra, chẩn đoán toàn diện và xuất báo cáo cây quyết định (Decision Tree)
 * theo định dạng chuẩn mực cho bất kỳ lô sản xuất nào (ví dụ Lô 702601).
 */

import { Batch, TestResult, TCCS, QualityDeviation } from '../../types';
import {
  CanonicalStatusResolver,
  BatchQualityResolutionResult,
} from '../canonical/canonicalResolver';
import { ReleaseRules, ReleasePrerequisiteEvaluation } from '../rules/ReleaseRules';
import { CriterionEvaluationDetail } from '../canonical/canonicalStatus';

export interface BatchDiagnosticContext {
  batches: Batch[];
  testResults: TestResult[];
  tccsList?: TCCS[];
  deviations?: QualityDeviation[];
}

export interface BatchDiagnosticReport {
  batchInfo: {
    id: string;
    batchNo: string;
    productName: string;
    tccsId: string;
    tccsVersion: string;
    hasTccsSnapshot: boolean;
    tccsSnapshotHash?: string;
    workflowStatus: string;
  };
  completion: {
    requiredCriteriaCount: number;
    testedCriteriaCount: number;
    completionPercentage: number;
    isComplete: boolean;
    missingCriteria: string[];
  };
  criteria: CriterionEvaluationDetail[];
  canonicalResult: {
    status: string;
    reason: string;
  };
  releaseGate: {
    isEligible: boolean;
    score: number;
    blockers: string[];
  };
  rawTrace?: any;
  asciiTree: string;
}

export class BatchDiagnosticService {
  /**
   * Chẩn đoán Lô sản xuất theo ID hoặc Số lô (batchNo)
   */
  public static diagnoseBatch(
    batchIdentifier: string,
    context: BatchDiagnosticContext
  ): BatchDiagnosticReport {
    const term = (batchIdentifier || '').trim().toLowerCase();

    // 1. Tìm Lô sản xuất
    const matchedBatch = context.batches.find(
      (b) =>
        (b.id && b.id.toLowerCase() === term) ||
        (b.batchNo && b.batchNo.toLowerCase() === term) ||
        (b.batchNo && b.batchNo.toLowerCase().includes(term))
    );

    if (!matchedBatch) {
      const notFoundTree = [
        `BATCH [${batchIdentifier}]`,
        `└── Lỗi: Không tìm thấy Lô sản xuất trong hệ thống.`,
      ].join('\n');

      return {
        batchInfo: {
          id: batchIdentifier,
          batchNo: batchIdentifier,
          productName: 'Không xác định',
          tccsId: 'N/A',
          tccsVersion: 'N/A',
          hasTccsSnapshot: false,
          workflowStatus: 'UNKNOWN',
        },
        completion: {
          requiredCriteriaCount: 0,
          testedCriteriaCount: 0,
          completionPercentage: 0,
          isComplete: false,
          missingCriteria: [],
        },
        criteria: [],
        canonicalResult: {
          status: 'UNKNOWN',
          reason: `Không tìm thấy Lô có mã hoặc số lô [${batchIdentifier}].`,
        },
        releaseGate: {
          isEligible: false,
          score: 0,
          blockers: [`Không tìm thấy Lô [${batchIdentifier}] trong cơ sở dữ liệu.`],
        },
        asciiTree: notFoundTree,
      };
    }

    // 2. Lấy các phiếu kiểm nghiệm liên kết với Lô
    const batchTests = (context.testResults || []).filter(
      (tr) =>
        tr &&
        (tr.batchId === matchedBatch.id ||
          (tr.batchId && tr.batchId.toLowerCase() === matchedBatch.batchNo?.toLowerCase()))
    );

    // 3. Phân giải chất lượng từ CanonicalStatusResolver (SSoT)
    const qualityRes = CanonicalStatusResolver.resolveBatchQuality(
      matchedBatch,
      batchTests,
      undefined,
      context.tccsList
    );
    const trace = qualityRes.decisionTrace;

    // 4. Thẩm định điều kiện xuất xưởng từ Release Gate
    const releasePrereq = ReleaseRules.evaluateReleasePrerequisites({
      batch: matchedBatch,
      testResults: batchTests,
      boundTccs: trace?.tccsId ? context.tccsList?.find((t) => t.id === trace.tccsId) : undefined,
      deviations: context.deviations,
    });

    const criteriaList: CriterionEvaluationDetail[] = trace?.criterionEvaluations || [];
    const missingCriteria: string[] = trace?.completion.missingCriteria || [];

    const requiredCount = trace?.completion.requiredCount || 0;
    const testedCount = trace?.completion.testedCount || 0;
    const completionPercent = trace?.completion.percentage || 0;

    const report: BatchDiagnosticReport = {
      batchInfo: {
        id: matchedBatch.id,
        batchNo: matchedBatch.batchNo || matchedBatch.id,
        productName: (matchedBatch as any).product?.name || matchedBatch.productId || 'N/A',
        tccsId: trace?.tccsId || matchedBatch.tccsId || 'Chưa gán',
        tccsVersion: trace?.tccsVersion || 'N/A',
        hasTccsSnapshot: trace?.tccsResolutionStatus === 'SNAPSHOT_MATCH',
        tccsSnapshotHash: trace?.tccsSnapshotHash,
        workflowStatus: matchedBatch.status || 'PENDING',
      },
      completion: {
        requiredCriteriaCount: requiredCount,
        testedCriteriaCount: testedCount,
        completionPercentage: completionPercent,
        isComplete: trace?.completion.isComplete || false,
        missingCriteria,
      },
      criteria: criteriaList,
      canonicalResult: {
        status: qualityRes.batchQualityStatus,
        reason: qualityRes.decisionTrace?.qualityReason || qualityRes.batchQualityStatus,
      },
      releaseGate: {
        isEligible: releasePrereq.isEligibleForRelease,
        score: releasePrereq.score,
        blockers: releasePrereq.blockers,
      },
      rawTrace: trace,
      asciiTree: '',
    };

    report.asciiTree = this.renderAsciiTree(report);
    return report;
  }

  /**
   * Định dạng kết quả chẩn đoán thành Cây ASCII chuẩn quy định
   */
  public static renderAsciiTree(report: BatchDiagnosticReport): string {
    const lines: string[] = [];

    // 1. BATCH
    lines.push('BATCH');
    lines.push(`├── ID: ${report.batchInfo.id}`);
    lines.push(`├── Product: ${report.batchInfo.productName}`);
    lines.push(`├── TCCS ID: ${report.batchInfo.tccsId}`);
    lines.push(`├── TCCS Version: ${report.batchInfo.tccsVersion}`);
    lines.push(
      `├── TCCS Snapshot: ${report.batchInfo.hasTccsSnapshot ? `FROZEN (${report.batchInfo.tccsSnapshotHash || 'VALID'})` : 'NONE (Live resolution)'}`
    );
    lines.push(`└── Workflow Status: ${report.batchInfo.workflowStatus}`);
    lines.push('');

    // 2. COMPLETION
    lines.push('COMPLETION');
    lines.push(`├── Required criteria: ${report.completion.requiredCriteriaCount}`);
    lines.push(`├── Tested criteria: ${report.completion.testedCriteriaCount}`);
    lines.push(`└── Completion %: ${report.completion.completionPercentage}%`);
    lines.push('');

    // 3. QUALITY
    lines.push('QUALITY');
    if (report.criteria.length === 0) {
      lines.push('└── (Không có dữ liệu chỉ tiêu kiểm nghiệm)');
    } else {
      report.criteria.forEach((crit, index) => {
        const isLastCrit = index === report.criteria.length - 1;
        const critPrefix = isLastCrit ? '└── ' : '├── ';
        const childIndent = isLastCrit ? '    ' : '│   ';

        lines.push(`${critPrefix}${crit.criterionName}`);
        lines.push(
          `${childIndent}├── Value: ${crit.actualValue}${crit.unit ? ` ${crit.unit}` : ''}`
        );
        lines.push(`${childIndent}├── Specification: ${crit.expectedLimit}`);
        lines.push(
          `${childIndent}├── Stored isPass: ${crit.storedIsPass !== undefined ? crit.storedIsPass : 'N/A'}`
        );
        lines.push(
          `${childIndent}├── Recalculated isPass: ${crit.recalculatedIsPass !== undefined ? crit.recalculatedIsPass : 'N/A'}`
        );
        lines.push(`${childIndent}└── Canonical status: ${crit.status}`);
      });
    }
    lines.push('');

    // 4. CANONICAL RESULT
    lines.push('CANONICAL RESULT');
    lines.push(`├── Status: ${report.canonicalResult.status}`);
    lines.push(`└── Reason: ${report.canonicalResult.reason}`);
    lines.push('');

    // 5. RELEASE GATE
    lines.push('RELEASE GATE');
    lines.push(`├── Eligible: ${report.releaseGate.isEligible ? 'YES' : 'NO'}`);
    if (report.releaseGate.blockers.length === 0) {
      lines.push('└── Blockers: None (Đủ điều kiện xuất xưởng)');
    } else {
      lines.push(`└── Blockers:`);
      report.releaseGate.blockers.forEach((blocker, bIdx) => {
        const isLastBlocker = bIdx === report.releaseGate.blockers.length - 1;
        lines.push(`    ${isLastBlocker ? '└──' : '├──'} ${blocker}`);
      });
    }

    return lines.join('\n');
  }
}
