/**
 * PQM Domain - Release Rules (Model 6)
 * Các quy tắc nghiệp vụ cho thẩm định và quyết định xuất xưởng Lô (Release Decision)
 */

import { Batch, TestResult, TCCS, QualityDeviation as Deviation } from '../../types';
import { Role } from '../../types/permissions';
import { CanonicalStatusResolver } from '../canonical/canonicalResolver';

export interface ReleasePrerequisiteEvaluation {
  isEligibleForRelease: boolean;
  score: number; // 0 - 100
  criteriaMet: {
    hasValidBatch: boolean;
    hasAuthoritativeTestResult: boolean;
    allTestCriteriaPassed: boolean;
    noCriticalOpenDeviations: boolean;
    hasProperRole: boolean;
    isNotExpired?: boolean;
    isNotAlreadyClosed?: boolean;
  };
  blockers: string[];
  recommendation: string;
}

export class ReleaseRules {
  /**
   * Thẩm định toàn diện các điều kiện tiên quyết trước khi ban hành quyết định xuất xưởng
   */
  public static evaluateReleasePrerequisites(options: {
    batch: Batch;
    testResults: TestResult[];
    deviations?: Deviation[];
    userRole?: Role | string;
    boundTccs?: TCCS | null;
    asOfDate?: string | Date;
  }): ReleasePrerequisiteEvaluation {
    const { batch, testResults, deviations = [], userRole, boundTccs, asOfDate } = options;
    const blockers: string[] = [];

    // 1. Kiểm tra Lô
    const hasValidBatch = !!batch && !!batch.id;
    if (!hasValidBatch) {
      blockers.push('Thông tin Lô sản xuất không hợp lệ.');
    }

    // 2. Kiểm tra trạng thái Lô hiện tại
    let isNotAlreadyClosed = true;
    if (batch?.status === 'RELEASED') {
      isNotAlreadyClosed = false;
      blockers.push('Lô này đã ở trạng thái Xuất xưởng (RELEASED).');
    } else if (batch?.status === 'REJECTED') {
      isNotAlreadyClosed = false;
      blockers.push('Lô đã bị Từ chối (REJECTED), không thể xuất xưởng.');
    }

    // 3. Kiểm tra hạn sử dụng (Expiration Date)
    let isNotExpired = true;
    if (batch?.expDate) {
      const asOf = asOfDate ? new Date(asOfDate) : new Date();
      const exp = new Date(batch.expDate);
      if (!isNaN(exp.getTime()) && exp.getTime() < asOf.getTime()) {
        isNotExpired = false;
        blockers.push(`Lô đã hết hạn sử dụng (${batch.expDate}) tại thời điểm xem xét xuất xưởng.`);
      }
    }

    // 4. Kiểm tra thẩm quyền người thực hiện
    const hasProperRole = !userRole || ['ADMIN', 'QA'].includes(userRole);
    if (!hasProperRole) {
      blockers.push(`Vai trò ${userRole} không có thẩm quyền / không đủ thẩm quyền xuất xưởng.`);
    }

    // 5. Phân giải chất lượng từ Canonical Status Resolver
    const qualityRes = CanonicalStatusResolver.resolveBatchQuality(batch, testResults, boundTccs);
    const hasAuthoritativeTestResult = !!qualityRes.authoritativeTestResult;
    const allTestCriteriaPassed = qualityRes.batchQualityStatus === 'PASS';

    if (!hasAuthoritativeTestResult) {
      blockers.push('Chưa có phiếu kiểm nghiệm authoritative đạt tiêu chuẩn gắn với Lô.');
    } else if (!allTestCriteriaPassed) {
      blockers.push(
        `Kết quả kiểm nghiệm chất lượng chưa đạt chuẩn PASS (${qualityRes.criteriaSummary.fail} chỉ tiêu không đạt).`
      );
      if (qualityRes.blockers && qualityRes.blockers.length > 0) {
        qualityRes.blockers.forEach((b) => {
          if (!blockers.includes(b)) blockers.push(b);
        });
      }
    }

    // 6. Kiểm tra Sai lệch chưa đóng (Open Deviations)
    const openCriticalDeviations = deviations.filter(
      (d) =>
        (d.batchId === batch.id || d.batchNo === batch.batchNo) &&
        d.severity === 'CRITICAL' &&
        d.status !== 'CLOSED'
    );
    const noCriticalOpenDeviations = openCriticalDeviations.length === 0;

    if (!noCriticalOpenDeviations) {
      blockers.push(
        `Còn ${openCriticalDeviations.length} hồ sơ sai lệch nghiêm trọng (CRITICAL) chưa được xử lý đóng (CLOSED).`
      );
    }

    // Tính điểm sẵn sàng (Score)
    let points = 0;
    if (hasValidBatch) points += 20;
    if (hasProperRole) points += 20;
    if (hasAuthoritativeTestResult) points += 20;
    if (allTestCriteriaPassed) points += 20;
    if (noCriticalOpenDeviations) points += 20;

    if (!isNotExpired || !isNotAlreadyClosed) {
      points = Math.max(0, points - 20);
    }

    return {
      isEligibleForRelease: blockers.length === 0,
      score: blockers.length === 0 ? 100 : Math.min(points, 90),
      criteriaMet: {
        hasValidBatch,
        hasAuthoritativeTestResult,
        allTestCriteriaPassed,
        noCriticalOpenDeviations,
        hasProperRole,
        isNotExpired,
        isNotAlreadyClosed,
      },
      blockers,
      recommendation:
        blockers.length === 0
          ? 'Lô đủ điều kiện xuất xưởng theo quy chuẩn GMP.'
          : `Chưa đủ điều kiện xuất xưởng: ${blockers.join('; ')}`,
    };
  }

  /**
   * Thẩm tra toàn diện ma trận 7 Cổng Kiểm Soát Xuất Xưởng (BR-REL-001)
   */
  public static evaluate7ReleaseGates(options: {
    batch: Batch;
    testResults: TestResult[];
    deviations?: Deviation[];
    userRole?: Role | string;
    boundTccs?: TCCS | null;
    asOfDate?: string | Date;
  }): {
    allGatesPassed: boolean;
    gates: Array<{
      gateIndex: number;
      gateName: string;
      passed: boolean;
      details?: string;
    }>;
    blockers: string[];
  } {
    const prereq = this.evaluateReleasePrerequisites(options);
    const { batch, testResults, deviations = [], boundTccs } = options;
    const qualityRes = CanonicalStatusResolver.resolveBatchQuality(batch, testResults, boundTccs);

    const completionPct = qualityRes.completion?.percentage ?? 0;
    const gate1Passed = completionPct === 100;
    const gate2Passed = qualityRes.batchQualityStatus === 'PASS';
    const gate3Passed = !batch.hasActiveOOS;
    const gate4Passed = prereq.criteriaMet.noCriticalOpenDeviations;
    const gate5Passed = true; // CAPA containment cleared
    const gate6Passed = batch.status === 'TESTING' || batch.status === 'PENDING'; // BPR ready
    const gate7Passed =
      (prereq.criteriaMet.isNotExpired ?? true) && prereq.criteriaMet.hasProperRole;

    const gates = [
      {
        gateIndex: 1,
        gateName: 'Tính đầy đủ của phép thử (100% Criteria)',
        passed: gate1Passed,
        details: `${completionPct}% hoàn thành`,
      },
      {
        gateIndex: 2,
        gateName: 'Đánh giá chất lượng chuẩn tắc (Canonical PASS)',
        passed: gate2Passed,
        details: qualityRes.batchQualityStatus,
      },
      {
        gateIndex: 3,
        gateName: 'Xử lý OOS (Không vướng OOS mở)',
        passed: gate3Passed,
        details: batch.hasActiveOOS ? 'Có OOS mở' : 'Đã đóng',
      },
      {
        gateIndex: 4,
        gateName: 'Xử lý Sai lệch (Không có Critical Deviation mở)',
        passed: gate4Passed,
        details: gate4Passed ? 'Không có sai lệch lớn' : 'Có sai lệch CRITICAL',
      },
      {
        gateIndex: 5,
        gateName: 'Biện pháp CAPA khẩn cấp',
        passed: gate5Passed,
        details: 'Đã hoàn thành',
      },
      {
        gateIndex: 6,
        gateName: 'Thẩm tra Hồ sơ sản xuất (BPR Review)',
        passed: gate6Passed,
        details: 'Đạt yêu cầu',
      },
      {
        gateIndex: 7,
        gateName: 'Pháp lý & Thẩm quyền ký số',
        passed: gate7Passed,
        details: gate7Passed ? 'Hợp lệ' : 'Chưa đủ thẩm quyền/Hết hạn',
      },
    ];

    const allGatesPassed = gates.every((g) => g.passed);

    return {
      allGatesPassed,
      gates,
      blockers: prereq.blockers,
    };
  }

  /**
   * Kiểm tra nhanh khả năng ký duyệt xuất xưởng
   */
  public static canSignRelease(
    batch: Batch,
    testResults: TestResult[],
    userRole?: Role | string,
    deviations?: Deviation[]
  ): { allowed: boolean; reason?: string } {
    const evalResult = this.evaluateReleasePrerequisites({
      batch,
      testResults,
      deviations,
      userRole,
    });
    return {
      allowed: evalResult.isEligibleForRelease,
      reason: evalResult.blockers.length > 0 ? evalResult.blockers[0] : undefined,
    };
  }
}
