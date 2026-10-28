/**
 * BatchInspectionProgressService.ts
 * =================================
 * Single Source of Truth (SSoT) cho việc tính toán tiến độ kiểm nghiệm và trạng thái chất lượng của Lô.
 * Tách biệt hoàn toàn khỏi chu trình 7 Release Gates và Batch.status.
 *
 * NGUYÊN TẮC CỐT LÕI (ALCOA+ & GMP):
 * 1. PURE & DETERMINISTIC: Cùng đầu vào luôn cho 100% cùng đầu ra; không có side-effects; không gọi I/O.
 * 2. ĐỐI CHIẾU SỐ LƯỢNG NGUYÊN THỰC TẾ: Chuyển sang PENDING_REVIEW chỉ khi completedCount === requiredCount > 0.
 *    Tuyệt đối không dùng phần trăm làm tròn để kết luận hoàn thành.
 * 3. VALID MEASUREMENTS ONLY: Dòng kết quả rỗng hoặc không parse được số cho chỉ tiêu NUMBER không được tính.
 * 4. STALE PROTECTION: Tự động vô hiệu hóa kết luận PASS/FAIL cũ khi dữ liệu đo lường nguồn bị biến thiên.
 * 5. ALCOA+ DATA INTEGRITY: Sử dụng SHA-256 để niêm phong và phát hiện sai lệch.
 * 6. FAIL-CLOSED: Không có TCCS hoặc không có chỉ tiêu bắt buộc -> khóa chặt ở NOT_TESTED.
 */

import {
  Batch,
  BatchInspectionStatus,
  BatchInspectionEvaluation,
  BatchInspectionProgress,
} from '../../types/batch';
import { TestResult, TCCS, Criterion, TestResultEntry } from '../../types';
import { resolveAuthoritativeTestResultsForBatch } from '../test-result/testResultStatusResolver';
import { CriterionEvaluator, isExemptValue } from '../evaluation/CriterionEvaluator';
import { AlternateRuleEvaluator } from '../evaluation/AlternateRuleEvaluator';
import { calculateSha256Sync } from '../../utils/cryptoUtils';
import { ensureArray } from '../../utils';
import { isCriteriaMatch } from '../../utils/aiMapping';
import { normalizeValue } from '../evaluation/ValueNormalizer';

export interface InspectionCalculationParams {
  batch: Batch;
  testResults?: TestResult[];
  boundTccs?: TCCS | null;
  tccs?: TCCS | null;
  tccsList?: TCCS[];
}

export interface InspectionProgressCalculationResult {
  /** Trạng thái kiểm nghiệm SSoT (NOT_TESTED | IN_PROGRESS | PENDING_REVIEW | PASS | FAIL) */
  status: BatchInspectionStatus;
  /** Tiến độ số lượng và tỷ lệ % */
  progress: BatchInspectionProgress;
  /** Cờ cho biết có chỉ tiêu nào bị không đạt (OOS) hay không */
  hasFailures: boolean;
  /** Danh sách tên các chỉ tiêu bị rớt (FAIL) */
  failedCriteria: string[];
  /** Danh sách tên các chỉ tiêu đã hoàn thành hợp lệ */
  completedCriteria: string[];
  /** Danh sách tên các chỉ tiêu còn thiếu chưa hoàn thành */
  missingCriteria: string[];
  /** Đã hoàn thành toàn bộ 100% chỉ tiêu bắt buộc (completedCount === requiredCount > 0) */
  isComplete: boolean;
  /** Mã băm SHA-256 niêm phong toàn vẹn của tập dữ liệu kiểm nghiệm hiện tại */
  evaluationHash: string;
  /** Cờ cảnh báo kết luận chất lượng cũ đã bị mất hiệu lực do dữ liệu nguồn biến thiên */
  isEvaluationStale: boolean;
  /** Lý do mất hiệu lực (nếu có) */
  staleReason?: string;
  /** Bản ghi đánh giá hợp lệ còn hiệu lực (hoặc undefined nếu đã bị vô hiệu hóa) */
  evaluation?: BatchInspectionEvaluation;
}

export type BatchInspectionCalculationResult = InspectionProgressCalculationResult;

export interface ValidateInspectionEvaluationParams {
  batch: Batch;
  newStatus: 'PASS' | 'FAIL';
  user: {
    id: string;
    name: string;
    role: string;
  };
  reason?: string;
  progress: BatchInspectionProgress;
  hasFailures: boolean;
  evaluationHash: string;
}

export interface ValidationEvaluationResult {
  valid: boolean;
  error?: string;
  evaluation?: BatchInspectionEvaluation;
}

/**
 * Kiểm tra xem một giá trị thô có phải là số đo lường hợp lệ cho chỉ tiêu kiểu NUMBER hay không.
 * Trả về false nếu rỗng, hoặc là chuỗi ký tự không parse được số và không phải biểu thức LOD/LOQ/ND.
 */
function isValidNumericMeasurement(rawValue: unknown): boolean {
  if (rawValue === null || rawValue === undefined) return false;
  const str = String(rawValue).trim();
  if (str === '') return false;
  if (isExemptValue(str)) return true;

  const norm = normalizeValue(str);
  // Nếu là biểu thức âm tính, LOD (< 10), LOQ (> 0)
  if (norm.isND || norm.isStrictLessThan || norm.isStrictGreaterThan) return true;
  // Nếu parse ra số thực tế hợp lệ
  if (norm.numericValue !== null && !isNaN(norm.numericValue)) return true;

  return false;
}

/**
 * Phân giải TCCS gắn với Lô
 */
function resolveTccsForBatch(
  batch: Batch,
  boundTccs?: TCCS | null,
  tccsList: TCCS[] = []
): TCCS | undefined {
  if (boundTccs) return boundTccs;
  if (batch.tccsId && tccsList.length > 0) {
    const found = tccsList.find((t) => t.id === batch.tccsId);
    if (found) return found;
  }
  if ((batch as any).tccs) {
    return (batch as any).tccs;
  }
  return undefined;
}

/**
 * Trích xuất danh sách chỉ tiêu bắt buộc từ TCCS
 * Loại bỏ các chỉ tiêu rỗng và chỉ tiêu phụ không bắt buộc (isExtra: true)
 */
function getRequiredCriteria(tccs?: TCCS): Criterion[] {
  if (!tccs) return [];
  const all = [...ensureArray(tccs.mainQualityCriteria), ...ensureArray(tccs.safetyCriteria)];
  return all.filter((c) => {
    if (!c || !c.name || typeof c.name !== 'string') return false;
    if (c.name.trim() === '') return false;
    if ((c as any).isExtra === true) return false;
    return true;
  });
}

function normalizeCriterionName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/, '')
    .trim();
}

function isStrictOrSemanticCriteriaMatch(a: string, b: string): boolean {
  const normA = normalizeCriterionName(a);
  const normB = normalizeCriterionName(b);
  if (normA === normB) return true;

  // Rào chắn bảo vệ số: Nếu 2 tên có chứa số, các cụm số phải trùng khớp hoàn toàn
  // Tránh việc "Chỉ tiêu 1" bị khớp nhầm sang "Chỉ tiêu 10", "Chỉ tiêu 100", hay "Vitamin B1" sang "Vitamin B12"
  const digitsA = a.match(/\d+/g);
  const digitsB = b.match(/\d+/g);
  if (digitsA || digitsB) {
    const strA = (digitsA || []).join(',');
    const strB = (digitsB || []).join(',');
    if (strA !== strB) {
      return false;
    }
  }

  return isCriteriaMatch(a, b) || isCriteriaMatch(b, a);
}

export class BatchInspectionProgressService {
  /**
   * Tính toán toàn diện tiến độ kiểm nghiệm và trạng thái SSoT của Lô.
   * Hoàn toàn pure, deterministic, không có side effects.
   */
  static calculateInspectionProgress(
    params: InspectionCalculationParams
  ): InspectionProgressCalculationResult {
    const { batch, testResults = [], tccsList = [] } = params;
    const nowIso = new Date().toISOString();

    const emptyResult = (reason: string): InspectionProgressCalculationResult => ({
      status: 'NOT_TESTED',
      progress: {
        requiredCount: 0,
        completedCount: 0,
        percentage: 0,
        missingCriteria: [],
        evaluatedAt: nowIso,
      },
      hasFailures: false,
      failedCriteria: [],
      completedCriteria: [],
      missingCriteria: [],
      isComplete: false,
      evaluationHash: '',
      isEvaluationStale: false,
      staleReason: reason,
      evaluation: undefined,
    });

    if (!batch) {
      return emptyResult('Dữ liệu Lô không tồn tại');
    }

    // 1. Phân giải TCCS gắn với Lô
    const resolvedTccs = resolveTccsForBatch(batch, params.boundTccs || params.tccs, tccsList);

    // 2. Lấy danh sách chỉ tiêu bắt buộc
    const requiredCriteria = getRequiredCriteria(resolvedTccs);
    const requiredCount = requiredCriteria.length;

    // Rào chắn Fail-Closed: Nếu không có TCCS hoặc không có chỉ tiêu bắt buộc nào -> khóa chặt NOT_TESTED
    if (!resolvedTccs || requiredCount === 0) {
      return {
        status: 'NOT_TESTED',
        progress: {
          requiredCount: 0,
          completedCount: 0,
          percentage: 0,
          missingCriteria: [],
          evaluatedAt: nowIso,
        },
        hasFailures: false,
        failedCriteria: [],
        completedCriteria: [],
        missingCriteria: [],
        isComplete: false,
        evaluationHash: calculateSha256Sync({
          batchId: batch.id,
          batchNo: batch.batchNo || batch.id,
          tccsId: resolvedTccs?.id || '',
          criteria: [],
          results: [],
        }),
        isEvaluationStale: false,
        evaluation: undefined,
      };
    }

    // 3. Phân giải các phiếu kiểm nghiệm Authoritative cho Lô
    const authoritativeResults = resolveAuthoritativeTestResultsForBatch(
      batch,
      testResults,
      resolvedTccs
    );

    // 4. Ánh xạ các kết quả đo lường authoritative theo tên chỉ tiêu
    const authoritativeMap = new Map<string, TestResultEntry>();
    authoritativeResults.forEach((tr) => {
      ensureArray(tr.results).forEach((r) => {
        if (!r.isExtra && r.criteriaName) {
          authoritativeMap.set(normalizeCriterionName(r.criteriaName), r);
        }
      });
    });

    const findAuthoritativeEntry = (targetName: string): TestResultEntry | undefined => {
      if (!targetName) return undefined;
      const targetNorm = normalizeCriterionName(targetName);
      if (authoritativeMap.has(targetNorm)) {
        return authoritativeMap.get(targetNorm);
      }
      for (const [key, val] of authoritativeMap.entries()) {
        if (isStrictOrSemanticCriteriaMatch(key, targetName)) {
          return val;
        }
      }
      return undefined;
    };

    // Chuẩn bị context cho quy tắc thay thế Alternate Rules
    const alternateRules = resolvedTccs.alternateRules || [];
    const tccsMaps = {
      rulesMap: new Map(alternateRules.map((r) => [(r.alt || '').trim().toLowerCase(), r])),
      allCriteria: requiredCriteria,
      criteriaMap: new Map(requiredCriteria.map((c) => [c.name.trim().toLowerCase(), c])),
    };

    // 5. Thẩm định từng chỉ tiêu bắt buộc
    let completedCount = 0;
    const completedCriteria: string[] = [];
    const missingCriteria: string[] = [];
    const failedCriteria: string[] = [];
    const evaluatedEntriesForHash: Array<{
      criterionName: string;
      value: string | null;
      isPass: boolean | null;
      isExempted: boolean;
    }> = [];

    for (const crit of requiredCriteria) {
      const cName = crit.name.trim();
      const entry = findAuthoritativeEntry(cName);

      // A. Kiểm tra miễn kiểm theo Alternate Rules
      let isExemptedByRule = false;
      if (alternateRules.length > 0) {
        isExemptedByRule = AlternateRuleEvaluator.checkRuleExemption(
          cName,
          (name) => {
            const e = findAuthoritativeEntry(name);
            return e ? e.value : undefined;
          },
          resolvedTccs,
          tccsMaps,
          authoritativeMap
        );
      }

      const isValueEmpty =
        !entry ||
        entry.value === null ||
        entry.value === undefined ||
        String(entry.value).trim() === '';

      const isValueExempt =
        !isValueEmpty &&
        (isExemptValue(entry.value) ||
          entry.isExempted === true ||
          (entry.isPass === true && isExemptValue(entry.value)));

      // B. Xử lý trường hợp được miễn kiểm
      if (isExemptedByRule || isValueExempt) {
        completedCount++;
        completedCriteria.push(cName);
        evaluatedEntriesForHash.push({
          criterionName: cName,
          value: isValueEmpty ? 'EXEMPTED' : String(entry?.value).trim(),
          isPass: true,
          isExempted: true,
        });
        continue;
      }

      // C. Xử lý trường hợp không có kết quả hoặc giá trị rỗng
      if (isValueEmpty) {
        missingCriteria.push(cName);
        evaluatedEntriesForHash.push({
          criterionName: cName,
          value: null,
          isPass: null,
          isExempted: false,
        });
        continue;
      }

      // D. Kiểm tra hợp lệ cho chỉ tiêu kiểu NUMBER (TC-05)
      // Dòng kết quả tồn tại nhưng giá trị chuỗi không parse được số -> coi như chưa hoàn thành
      if (crit.type === 'NUMBER' && !isValidNumericMeasurement(entry.value)) {
        missingCriteria.push(cName);
        evaluatedEntriesForHash.push({
          criterionName: cName,
          value: String(entry.value).trim(),
          isPass: null,
          isExempted: false,
        });
        continue;
      }

      // E. Đánh giá kỹ thuật qua CriterionEvaluator
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, entry.value);

      if (evalRes.isPass === null) {
        // Giá trị không thể phân giải hợp lệ -> chưa hoàn thành
        missingCriteria.push(cName);
        evaluatedEntriesForHash.push({
          criterionName: cName,
          value: String(entry.value).trim(),
          isPass: null,
          isExempted: false,
        });
      } else if (evalRes.isPass === true) {
        // Phép thử đạt chuẩn
        completedCount++;
        completedCriteria.push(cName);
        evaluatedEntriesForHash.push({
          criterionName: cName,
          value: String(entry.value).trim(),
          isPass: true,
          isExempted: false,
        });
      } else {
        // Phép thử không đạt chuẩn (FAIL / OOS)
        // Đo lường ĐÃ HOÀN THÀNH, nhưng kết quả KHÔNG ĐẠT
        completedCount++;
        completedCriteria.push(cName);
        failedCriteria.push(cName);
        evaluatedEntriesForHash.push({
          criterionName: cName,
          value: String(entry.value).trim(),
          isPass: false,
          isExempted: false,
        });
      }
    }

    // 6. Tính toán tiến độ phần trăm và điều kiện hoàn thành
    // ĐỐI CHIẾU SỐ NGUYÊN CHÍNH XÁC: isComplete chỉ bằng true khi completedCount === requiredCount
    const isComplete = requiredCount > 0 && completedCount === requiredCount;
    const hasFailures = failedCriteria.length > 0;

    // Rào chắn tỷ lệ %: Không bao giờ làm tròn thành 100% nếu completedCount < requiredCount (AC-03)
    let percentage = 0;
    if (requiredCount > 0) {
      const rawPct = Math.round((completedCount / requiredCount) * 100);
      percentage = completedCount < requiredCount ? Math.min(rawPct, 99) : 100;
    }

    const progress: BatchInspectionProgress = {
      requiredCount,
      completedCount,
      percentage,
      missingCriteria,
      evaluatedAt: nowIso,
    };

    // 7. Tạo mã băm niêm phong SHA-256 tất định cho tập kết quả kiểm nghiệm hiện tại
    const evaluationHash = calculateSha256Sync({
      batchId: batch.id,
      batchNo: batch.batchNo || batch.id,
      tccsId: resolvedTccs.id,
      criteria: requiredCriteria
        .map((c) => ({
          name: c.name.trim(),
          type: c.type || 'NUMBER',
          min: c.min,
          max: c.max,
          expectedText: c.expectedText,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      results: evaluatedEntriesForHash.sort((a, b) =>
        a.criterionName.localeCompare(b.criterionName)
      ),
    });

    // 8. Phân giải trạng thái theo chu trình State Machine
    let baseStatus: BatchInspectionStatus = 'NOT_TESTED';
    if (completedCount === 0) {
      baseStatus = 'NOT_TESTED';
    } else if (completedCount < requiredCount) {
      baseStatus = 'IN_PROGRESS';
    } else {
      baseStatus = 'PENDING_REVIEW';
    }

    // 9. Kiểm soát tính hợp lệ của bản ghi đánh giá đã có (Stale Invalidation)
    // Bảo vệ Lô đã Xuất xưởng (RELEASED): Nếu Lô đã xuất xưởng, không lùi trạng thái (Fail-Closed)
    if (batch.status === 'RELEASED') {
      return {
        status: 'PASS',
        progress,
        hasFailures,
        failedCriteria,
        completedCriteria,
        missingCriteria,
        isComplete,
        evaluationHash,
        isEvaluationStale: false,
        evaluation: batch.inspectionEvaluation,
      };
    }

    // Kiểm tra bản ghi đánh giá inspectionEvaluation hiện có
    const existingEval = batch.inspectionEvaluation;
    if (existingEval && (existingEval.status === 'PASS' || existingEval.status === 'FAIL')) {
      // Trường hợp 1: Dữ liệu bị xóa/thiếu hụt chỉ tiêu làm completedCount < requiredCount
      if (completedCount < requiredCount) {
        return {
          status: baseStatus, // 'IN_PROGRESS' hoặc 'NOT_TESTED'
          progress,
          hasFailures,
          failedCriteria,
          completedCriteria,
          missingCriteria,
          isComplete: false,
          evaluationHash,
          isEvaluationStale: true,
          staleReason:
            'Số lượng chỉ tiêu bắt buộc không còn đầy đủ 100% so với thời điểm đánh giá.',
          evaluation: undefined,
        };
      }

      // Trường hợp 2: Đủ 100% chỉ tiêu nhưng mã băm bị lệch (dữ liệu đo lường đã bị sửa đổi)
      if (existingEval.evaluationHash && existingEval.evaluationHash !== evaluationHash) {
        return {
          status: 'PENDING_REVIEW',
          progress,
          hasFailures,
          failedCriteria,
          completedCriteria,
          missingCriteria,
          isComplete: true,
          evaluationHash,
          isEvaluationStale: true,
          staleReason: 'Dữ liệu đo lường nguồn đã biến thiên so với mã băm niêm phong cũ.',
          evaluation: undefined,
        };
      }

      // Trường hợp 3: Kết luận cũ còn nguyên giá trị hiệu lực
      return {
        status: existingEval.status,
        progress,
        hasFailures,
        failedCriteria,
        completedCriteria,
        missingCriteria,
        isComplete: true,
        evaluationHash,
        isEvaluationStale: false,
        evaluation: existingEval,
      };
    }

    // Nếu không có inspectionEvaluation nhưng batch.inspectionStatus đã có giá trị
    if (batch.inspectionStatus === 'PASS' || batch.inspectionStatus === 'FAIL') {
      if (!isComplete) {
        return {
          status: baseStatus,
          progress,
          hasFailures,
          failedCriteria,
          completedCriteria,
          missingCriteria,
          isComplete,
          evaluationHash,
          isEvaluationStale: true,
          staleReason: 'Trạng thái kiểm nghiệm cũ không còn đủ 100% chỉ tiêu bắt buộc.',
          evaluation: undefined,
        };
      }
      return {
        status: batch.inspectionStatus,
        progress,
        hasFailures,
        failedCriteria,
        completedCriteria,
        missingCriteria,
        isComplete,
        evaluationHash,
        isEvaluationStale: false,
        evaluation: undefined,
      };
    }

    // Trạng thái tự động theo tiến độ (NOT_TESTED, IN_PROGRESS hoặc PENDING_REVIEW)
    return {
      status: baseStatus,
      progress,
      hasFailures,
      failedCriteria,
      completedCriteria,
      missingCriteria,
      isComplete,
      evaluationHash,
      isEvaluationStale: false,
      evaluation: undefined,
    };
  }

  /**
   * Tính mã băm niêm phong toàn vẹn của dữ liệu kiểm nghiệm (SHA-256)
   */
  static computeEvaluationHash(params: InspectionCalculationParams): string {
    return BatchInspectionProgressService.calculateInspectionProgress(params).evaluationHash;
  }

  /**
   * Thẩm tra và xác thực việc đưa ra kết luận kiểm nghiệm chất lượng (PASS / FAIL)
   * bởi người dùng có thẩm quyền (QA, QC, ADMIN).
   */
  static validateInspectionEvaluation(
    params: ValidateInspectionEvaluationParams
  ): ValidationEvaluationResult {
    const { batch, newStatus, user, reason, progress, hasFailures, evaluationHash } = params;

    // 1. Phân quyền RBAC nghiêm ngặt: Chỉ QA, QC và ADMIN được đánh giá
    const userRole = (user?.role || '').trim().toUpperCase();
    if (!['QA', 'QC', 'ADMIN'].includes(userRole)) {
      return {
        valid: false,
        error:
          'Chỉ người dùng có vai trò QA, QC hoặc ADMIN mới có thẩm quyền đánh giá kết luận kiểm nghiệm.',
      };
    }

    // 2. Thẩm định cho hành động xác nhận PASS
    if (newStatus === 'PASS') {
      // Phải hoàn thành đầy đủ 100% chỉ tiêu bắt buộc
      if (
        progress.requiredCount <= 0 ||
        progress.completedCount !== progress.requiredCount ||
        progress.missingCriteria.length > 0
      ) {
        return {
          valid: false,
          error:
            'Không thể xác nhận Đạt (PASS) khi chưa hoàn thành đầy đủ 100% chỉ tiêu bắt buộc theo TCCS.',
        };
      }

      // Tuyệt đối không được có bất kỳ chỉ tiêu nào FAIL (OOS)
      if (hasFailures) {
        return {
          valid: false,
          error:
            'Không thể xác nhận Đạt (PASS) khi tồn tại chỉ tiêu kiểm nghiệm không đạt tiêu chuẩn (OOS).',
        };
      }
    }

    // 3. Thẩm định cho hành động xác nhận FAIL
    if (newStatus === 'FAIL') {
      const trimmedReason = (reason || '').trim();
      if (!trimmedReason || trimmedReason.length < 5) {
        return {
          valid: false,
          error:
            'Bắt buộc nhập lý do giải trình kỹ thuật (tối thiểu 5 ký tự) khi đánh giá Không đạt (FAIL).',
        };
      }
    }

    // 4. Tạo bản ghi đánh giá hợp lệ
    const evaluation: BatchInspectionEvaluation = {
      status: newStatus,
      evaluatedBy: user.id,
      evaluatorName: user.name || user.id,
      evaluatorRole: userRole as 'QA' | 'QC' | 'ADMIN',
      evaluatedAt: new Date().toISOString(),
      reason: reason?.trim() || undefined,
      evaluationHash,
      versionAtEvaluation: batch.version || 1,
    };

    return {
      valid: true,
      evaluation,
    };
  }

  /**
   * Fallback adapter phân giải trạng thái an toàn cho các bản ghi lịch sử chưa có trường inspectionStatus.
   * Đảm bảo không làm gián đoạn hệ thống và không yêu cầu migration dữ liệu cưỡng bức.
   */
  static resolveInspectionStatusWithFallback(
    params: InspectionCalculationParams
  ): BatchInspectionStatus {
    const { batch } = params;
    if (!batch) return 'NOT_TESTED';

    // 1. Lô đã xuất xưởng lịch sử -> PASS (Bảo toàn lịch sử ALCOA+)
    if (batch.status === 'RELEASED') {
      return 'PASS';
    }

    // 2. Lô đã bị từ chối chính thức -> FAIL
    if (batch.status === 'REJECTED') {
      return 'FAIL';
    }

    // 3. Nếu đã có inspectionStatus và còn hiệu lực
    const res = BatchInspectionProgressService.calculateInspectionProgress(params);
    return res.status;
  }
}

export const calculateInspectionProgress =
  BatchInspectionProgressService.calculateInspectionProgress;
export const computeEvaluationHash = BatchInspectionProgressService.computeEvaluationHash;
export const validateInspectionEvaluation =
  BatchInspectionProgressService.validateInspectionEvaluation;
export const resolveInspectionStatusWithFallback =
  BatchInspectionProgressService.resolveInspectionStatusWithFallback;
