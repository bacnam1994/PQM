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
  }): ReleasePrerequisiteEvaluation {
    const { batch, testResults, deviations = [], userRole, boundTccs } = options;
    const blockers: string[] = [];

    // 1. Kiểm tra Lô
    const hasValidBatch = !!batch && !!batch.id;
    if (!hasValidBatch) {
      blockers.push('Thông tin Lô sản xuất không hợp lệ.');
    }

    // 2. Kiểm tra thẩm quyền người thực hiện
    const hasProperRole = !userRole || ['ADMIN', 'QA'].includes(userRole);
    if (!hasProperRole) {
      blockers.push(`Vai trò ${userRole} không đủ thẩm quyền xuất xưởng.`);
    }

    // 3. Phân giải chất lượng từ Canonical Status Resolver
    const qualityRes = CanonicalStatusResolver.resolveBatchQuality(batch, testResults, boundTccs);
    const hasAuthoritativeTestResult = !!qualityRes.authoritativeTestResult;
    const allTestCriteriaPassed = qualityRes.batchQualityStatus === 'PASS';

    if (!hasAuthoritativeTestResult) {
      blockers.push('Chưa có phiếu kiểm nghiệm authoritative đạt tiêu chuẩn gắn với Lô.');
    } else if (!allTestCriteriaPassed) {
      blockers.push(
        `Kết quả kiểm nghiệm chất lượng chưa đạt chuẩn PASS (${qualityRes.criteriaSummary.fail} chỉ tiêu không đạt).`
      );
    }

    // 4. Kiểm tra Sai lệch chưa đóng (Open Deviations)
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

    // Tính điểm sẵn sàng
    let points = 0;
    if (hasValidBatch) points += 20;
    if (hasProperRole) points += 20;
    if (hasAuthoritativeTestResult) points += 20;
    if (allTestCriteriaPassed) points += 20;
    if (noCriticalOpenDeviations) points += 20;

    return {
      isEligibleForRelease: blockers.length === 0,
      score: points,
      criteriaMet: {
        hasValidBatch,
        hasAuthoritativeTestResult,
        allTestCriteriaPassed,
        noCriticalOpenDeviations,
        hasProperRole,
      },
      blockers,
      recommendation:
        blockers.length === 0
          ? 'Lô đủ điều kiện xuất xưởng theo quy chuẩn GMP.'
          : `Chưa đủ điều kiện xuất xưởng: ${blockers.join('; ')}`,
    };
  }
}
