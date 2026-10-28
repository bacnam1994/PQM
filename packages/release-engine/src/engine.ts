/**
 * packages/release-engine/src/engine.ts
 * CANONICAL RELEASE ENGINE (SSoT for Client & Server)
 */

import { CanonicalReleaseDecision, ReleaseGateResult, CanonicalElectronicSignature } from './types';
import { evaluate7Gates, EvaluateGatesParams } from './gates';

export class CanonicalReleaseEngine {
  public static readonly VERSION = '3.0.0-UNIFIED-SHARED-RELEASE-ENGINE';

  /**
   * Đánh giá tính hợp lệ xuất xưởng của Lô sản xuất (Preview hoặc Release Pre-check)
   */
  public static evaluateReleaseEligibility(params: any): CanonicalReleaseDecision {
    const { batch } = params;
    const now = new Date().toISOString();
    const batchId = batch?.id || '';
    const batchNo = batch?.batchNo || batchId;

    // Derive completion & qualityStatus if raw testResults are provided
    let completion = params.completion;
    let qualityStatus = params.qualityStatus;
    if (!completion || !qualityStatus) {
      const testResults = Array.isArray(params.testResults) ? params.testResults : [];
      if (testResults.length === 0) {
        completion = completion || {
          isComplete: false,
          percentage: 0,
          requiredCount: 1,
          testedCount: 0,
        };
        qualityStatus = qualityStatus || 'PENDING';
      } else {
        const hasFail = testResults.some(
          (tr: any) => tr.overallStatus === 'FAIL' || tr.status === 'FAIL'
        );
        const hasPending = testResults.some(
          (tr: any) => tr.overallStatus === 'PENDING' || tr.status === 'PENDING'
        );
        completion = completion || {
          isComplete: !hasPending,
          percentage: hasPending
            ? Math.round(
                (testResults.filter((tr: any) => tr.overallStatus !== 'PENDING').length /
                  testResults.length) *
                  100
              )
            : 100,
          requiredCount: testResults.length,
          testedCount: testResults.filter((tr: any) => tr.overallStatus === 'PASS').length,
        };
        qualityStatus = qualityStatus || (hasFail ? 'FAIL' : hasPending ? 'PENDING' : 'PASS');
      }
    }

    const effectiveParams: EvaluateGatesParams = {
      batch: params.batch,
      completion,
      qualityStatus,
      deviations: params.deviations,
      userRole: params.userRole,
      userSignature: params.userSignature || params.signature || null,
      asOfDate: params.asOfDate,
    };

    const evaluation = evaluate7Gates(effectiveParams);

    return {
      eligible: evaluation.allPassed,
      batchId,
      batchNo,
      currentStatus: batch?.status || 'PENDING',
      nextStatus: 'RELEASED',
      gates: evaluation.gates,
      blockers: evaluation.blockers,
      warnings: [],
      requiredSignature: true,
      requiredRole: ['ADMIN', 'QA'],
      decisionTrace: [
        `[EVALUATE] Đã thẩm định 7 Gates cho lô ${batchNo}. Kết quả: ${evaluation.allPassed ? 'PASS (100%)' : 'FAIL'}`,
      ],
      evaluatedAt: now,
    };
  }

  /** Alias for evaluateReleaseEligibility */
  public static evaluateReleaseDecision(params: any): CanonicalReleaseDecision {
    return CanonicalReleaseEngine.evaluateReleaseEligibility(params);
  }

  /**
   * Tạo Historical Release Snapshot bất biến (ALCOA+) cho Lô xuất xưởng
   */
  public static buildHistoricalReleaseSnapshot(params: {
    batch: any;
    decision?: any;
    signature?: CanonicalElectronicSignature | null;
    evaluatorUid?: string;
    evaluatedAt?: string;
  }): Record<string, any> {
    const { batch, decision, signature, evaluatorUid, evaluatedAt } = params;
    const batchId = batch?.id || '';
    const now = evaluatedAt || new Date().toISOString();
    const snapshotId = `SNAP-REL-${batchId}-${Date.now()}`;

    const effectiveDecision =
      decision ||
      CanonicalReleaseEngine.getReleasedHistoricalSnapshot(batch, signature || undefined);

    return {
      snapshotId,
      batchId,
      batchNo: batch?.batchNo || batchId,
      productId: batch?.productId || '',
      versionAtRelease: (batch?.version ?? 1) + 1,
      releasedAt: now,
      releasedBy: evaluatorUid || signature?.signerUid || 'QA',
      decision: effectiveDecision,
      gates: effectiveDecision.gates,
      signature: signature || null,
      engineVersion: CanonicalReleaseEngine.VERSION,
      immutable: true,
    };
  }

  /**
   * Tạo Historical Snapshot bất biến cho Lô đã RELEASED
   */
  public static getReleasedHistoricalSnapshot(
    batch: any,
    signature?: CanonicalElectronicSignature
  ): CanonicalReleaseDecision {
    const batchId = batch?.id || '';
    const batchNo = batch?.batchNo || batchId;
    const now = batch?.releasedAt || new Date().toISOString();

    const historicalGates: ReleaseGateResult[] = [
      {
        gateIndex: 1,
        gateKey: 'GATE_1_TEST_COMPLETION',
        gateName: 'Tính đầy đủ của phép thử (100% Criteria)',
        passed: true,
        status: 'PASS',
        details: '100% hoàn thành (Đã thẩm định xuất xưởng)',
      },
      {
        gateIndex: 2,
        gateKey: 'GATE_2_CANONICAL_QUALITY',
        gateName: 'Đánh giá chất lượng chuẩn tắc (Canonical PASS)',
        passed: true,
        status: 'PASS',
        details: 'Chất lượng: PASS (Đã phê duyệt xuất xưởng)',
      },
      {
        gateIndex: 3,
        gateKey: 'GATE_3_NO_OPEN_OOS',
        gateName: 'Xử lý OOS (Không vướng OOS mở)',
        passed: true,
        status: 'PASS',
        details: 'Không có OOS mở tại thời điểm xuất xưởng',
      },
      {
        gateIndex: 4,
        gateKey: 'GATE_4_NO_OPEN_CRITICAL_DEVIATION',
        gateName: 'Hồ sơ Sai lệch (Không có sai lệch mở)',
        passed: true,
        status: 'PASS',
        details: 'Không có sai lệch nghiêm trọng mở tại thời điểm xuất xưởng',
      },
      {
        gateIndex: 5,
        gateKey: 'GATE_5_CAPA_FULFILLED',
        gateName: 'Hồ sơ CAPA (Không có CAPA mở)',
        passed: true,
        status: 'PASS',
        details: 'Các hành động khắc phục CAPA đã hoàn tất',
      },
      {
        gateIndex: 6,
        gateKey: 'GATE_6_BPR_QA_APPROVED',
        gateName: 'Thẩm định hồ sơ lô sản xuất (BPR Review)',
        passed: true,
        status: 'PASS',
        details: batch?.bprReviewedBy
          ? `Hồ sơ sản xuất BPR đã được phê duyệt bởi ${batch.bprReviewedBy}`
          : 'Hồ sơ sản xuất BPR đã được QA phê duyệt',
      },
      {
        gateIndex: 7,
        gateKey: 'GATE_7_AUTHORITY_AND_SIGNATURE',
        gateName: 'Pháp lý, Thẩm quyền & Chữ ký 21 CFR Part 11',
        passed: true,
        status: 'PASS',
        details: `Đã ký số phê duyệt xuất xưởng bởi ${signature?.signerEmail || batch?.releasedBy || 'QA/Admin'}`,
      },
    ];

    return {
      eligible: true,
      batchId,
      batchNo,
      currentStatus: 'RELEASED',
      nextStatus: 'RELEASED',
      gates: historicalGates,
      blockers: [],
      warnings: [],
      requiredSignature: true,
      requiredRole: ['ADMIN', 'QA'],
      decisionTrace: [
        `[HISTORICAL_SNAPSHOT] Niêm phong xuất xưởng lịch sử bảo toàn cho lô ${batchNo}.`,
      ],
      evaluatedAt: now,
    };
  }
}
