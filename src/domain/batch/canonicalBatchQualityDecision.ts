/**
 * canonicalBatchQualityDecision.ts
 * =================================
 * Single Source of Truth (SSoT) cho toàn bộ quyết định Chất lượng & Toàn vẹn Lô (Batch Quality & Integrity).
 *
 * Chuỗi phán quyết chuẩn:
 * Canonical Supreme Result
 *         ↓
 * finalTestResult
 *         ↓
 * canonical quality status
 *         ↓
 * Batch Integrity
 *         ↓
 * Alert
 *
 * Tuyệt đối không cho phép tồn tại nhiều thuật toán phân giải chất lượng cạnh tranh nhau.
 */

import { Batch, TestResult, TCCS, Criterion, TestResultEntry } from '../../types';
import {
  CanonicalBatchQualityStatus,
  CriterionEvaluationDetail,
  EvaluationDecisionTrace,
} from '../canonical/canonicalStatus';
import { BatchIntegrityStatus, DataFreshnessState } from './batchIntegrityValidator';
import {
  resolveFinalTestResultForBatch,
  resolveAuthoritativeTestResultsForBatch,
  resolveTestResultStatus,
} from '../test-result/testResultStatusResolver';
import { resolveTestResultsForBatch } from './batchTestResultResolver';
import { CriterionEvaluator, isExemptValue } from '../evaluation/CriterionEvaluator';
import { AlternateRuleEvaluator } from '../evaluation/AlternateRuleEvaluator';
import { ensureArray } from '../../utils';
import { isCriteriaMatch } from '../../utils/aiMapping';

export const CANONICAL_DECISION_RESOLVER_VERSION = '2.0.0-SSOT-CANONICAL-DECISION';

export interface CanonicalBatchQualityDecision {
  batchId: string;
  batchNo: string;

  workflowStatus: Batch['status'];

  supremeTestResultId?: string;
  supremeTestResultLab?: string;
  supremeTestResultVersion?: number;
  supremeTestResultWorkflowStatus?: string;

  qualityStatus: CanonicalBatchQualityStatus;

  integrityStatus: BatchIntegrityStatus;

  shouldAlert: boolean;
  alertType?: 'CRITICAL' | 'WARNING' | 'INFO';

  candidateCount: number;
  authoritativeCount: number;

  supersededTestResultIds: string[];

  failedCriteria: string[];
  pendingCriteria: string[];

  decisionReason: string;
  resolverVersion: string;

  // Chi tiết mở rộng phục vụ Adapter & Diagnostics
  supremeTestResult?: TestResult;
  authoritativeResults: TestResult[];
  boundTccs?: TCCS;
  criterionEvaluations: CriterionEvaluationDetail[];
  completion: {
    requiredCount: number;
    testedCount: number;
    percentage: number;
    isComplete: boolean;
    missingCriteria: string[];
  };
  blockers: string[];
  decisionTrace?: EvaluationDecisionTrace;
}

export interface ResolveCanonicalBatchQualityDecisionParams {
  batch: Batch;
  testResults: TestResult[];
  boundTccs?: TCCS | null;
  tccs?: TCCS | null;
  tccsList?: TCCS[];
  dataFreshness?: DataFreshnessState;
}

/**
 * Phán quyết Chất lượng & Toàn vẹn Lô chuẩn hóa duy nhất (SSoT)
 */
export function resolveCanonicalBatchQualityDecision(
  params: ResolveCanonicalBatchQualityDecisionParams
): CanonicalBatchQualityDecision {
  const { batch, testResults = [], tccsList = [], dataFreshness = {} } = params;
  const boundTccs = params.boundTccs ?? params.tccs ?? null;

  const emptyCompletion = {
    requiredCount: 0,
    testedCount: 0,
    percentage: 0,
    isComplete: false,
    missingCriteria: [] as string[],
  };

  if (!batch) {
    return {
      batchId: '',
      batchNo: '',
      workflowStatus: 'PENDING',
      qualityStatus: 'INVALID',
      integrityStatus: 'DATA_UNAVAILABLE',
      shouldAlert: false,
      candidateCount: 0,
      authoritativeCount: 0,
      supersededTestResultIds: [],
      failedCriteria: [],
      pendingCriteria: [],
      decisionReason: 'Dữ liệu Lô sản xuất không hợp lệ (null/undefined).',
      resolverVersion: CANONICAL_DECISION_RESOLVER_VERSION,
      authoritativeResults: [],
      criterionEvaluations: [],
      completion: emptyCompletion,
      blockers: ['Dữ liệu Lô sản xuất không tồn tại.'],
    };
  }

  const batchId = batch.id;
  const batchNo = batch.batchNo || batch.id;
  const workflowStatus = batch.status || 'PENDING';

  // 1. Phân giải TCCS gắn với Lô
  let resolvedTccs: TCCS | undefined = boundTccs || undefined;
  if (!resolvedTccs && batch.tccsId && tccsList.length > 0) {
    resolvedTccs = tccsList.find((t) => t.id === batch.tccsId);
  }
  if (!resolvedTccs && (batch as any).tccs) {
    resolvedTccs = (batch as any).tccs;
  }

  // 2. Phân giải danh sách Phiếu kiểm nghiệm liên kết (Primary vs Legacy)
  const resolution = resolveTestResultsForBatch(batch, testResults);
  const primaryCandidates = resolution.primaryResults.filter(
    (tr) =>
      tr &&
      !(tr as any).isDeleted &&
      !(tr as any).deleted &&
      !['CANCELLED', 'VOIDED', 'INVALID'].includes(
        String((tr as any).workflowStatus || (tr as any).status || '').toUpperCase()
      )
  );
  const legacyCandidates = resolution.legacyResults.filter(
    (tr) =>
      tr &&
      !(tr as any).isDeleted &&
      !(tr as any).deleted &&
      !['CANCELLED', 'VOIDED', 'INVALID'].includes(
        String((tr as any).workflowStatus || (tr as any).status || '').toUpperCase()
      )
  );
  const candidateCount = primaryCandidates.length + legacyCandidates.length;

  // 3. Xử lý trạng thái nạp dữ liệu (Data Freshness Aware)
  const { isTestResultsLoading = false, testResultsLoaded = true, isError = false } = dataFreshness;

  if (isError) {
    return {
      batchId,
      batchNo,
      workflowStatus,
      qualityStatus: 'NOT_TESTED',
      integrityStatus: 'DATA_UNAVAILABLE',
      shouldAlert: false,
      candidateCount,
      authoritativeCount: 0,
      supersededTestResultIds: [],
      failedCriteria: [],
      pendingCriteria: [],
      decisionReason: `Không thể kết nối CSDL để kiểm tra lô "${batchNo}".`,
      resolverVersion: CANONICAL_DECISION_RESOLVER_VERSION,
      authoritativeResults: [],
      boundTccs: resolvedTccs,
      criterionEvaluations: [],
      completion: emptyCompletion,
      blockers: ['Lỗi kết nối CSDL.'],
    };
  }

  if (isTestResultsLoading || (!testResultsLoaded && candidateCount === 0)) {
    return {
      batchId,
      batchNo,
      workflowStatus,
      qualityStatus: 'NOT_TESTED',
      integrityStatus: 'DATA_UNAVAILABLE',
      shouldAlert: false,
      candidateCount: 0,
      authoritativeCount: 0,
      supersededTestResultIds: [],
      failedCriteria: [],
      pendingCriteria: [],
      decisionReason: `Đang nạp dữ liệu kiểm nghiệm từ máy chủ cho lô "${batchNo}".`,
      resolverVersion: CANONICAL_DECISION_RESOLVER_VERSION,
      authoritativeResults: [],
      boundTccs: resolvedTccs,
      criterionEvaluations: [],
      completion: emptyCompletion,
      blockers: ['Đang nạp dữ liệu kiểm nghiệm.'],
    };
  }

  // 4. Trường hợp không có bất kỳ phiếu kiểm nghiệm nào
  if (primaryCandidates.length === 0 && legacyCandidates.length === 0) {
    const isReleased = workflowStatus === 'RELEASED';
    return {
      batchId,
      batchNo,
      workflowStatus,
      qualityStatus: workflowStatus === 'TESTING' ? 'TESTING' : 'NOT_TESTED',
      integrityStatus: isReleased ? 'MISSING_TEST_RESULT' : 'NOT_APPLICABLE',
      shouldAlert: isReleased,
      alertType: isReleased ? 'CRITICAL' : undefined,
      candidateCount: 0,
      authoritativeCount: 0,
      supersededTestResultIds: [],
      failedCriteria: [],
      pendingCriteria: [],
      decisionReason: isReleased
        ? `Lô "${batchNo}" đã xuất xưởng nhưng chưa có phiếu kiểm nghiệm nào.`
        : `Lô "${batchNo}" ở trạng thái ${workflowStatus}, chưa có phiếu kiểm nghiệm.`,
      resolverVersion: CANONICAL_DECISION_RESOLVER_VERSION,
      authoritativeResults: [],
      boundTccs: resolvedTccs,
      criterionEvaluations: [],
      completion: emptyCompletion,
      blockers: ['Chưa có kết quả kiểm nghiệm.'],
    };
  }

  // 5. Thống nhất danh sách ứng viên (Primary Candidates hoặc Legacy Candidates)
  const isLegacyOnly = primaryCandidates.length === 0 && legacyCandidates.length > 0;
  const candidates = primaryCandidates.length > 0 ? primaryCandidates : legacyCandidates;

  // 6. Chọn Canonical Supreme Test Result từ tập candidates
  const finalResolution = resolveFinalTestResultForBatch(batch, candidates, resolvedTccs);
  const supremeResult = finalResolution.finalTestResult;

  if (!supremeResult) {
    const isReleased = workflowStatus === 'RELEASED';
    return {
      batchId,
      batchNo,
      workflowStatus,
      qualityStatus: 'INCOMPLETE',
      integrityStatus: isReleased
        ? isLegacyOnly
          ? 'RELATIONSHIP_ERROR'
          : 'TEST_RESULT_INVALID_STATUS'
        : 'NOT_APPLICABLE',
      shouldAlert: isReleased,
      alertType: isReleased ? (isLegacyOnly ? 'WARNING' : 'CRITICAL') : undefined,
      candidateCount: candidates.length,
      authoritativeCount: 0,
      supersededTestResultIds: [],
      failedCriteria: [],
      pendingCriteria: [],
      decisionReason: isLegacyOnly
        ? `Lô "${batchNo}" có ${legacyCandidates.length} phiếu liên kết qua số lô (Legacy) nhưng không thể xác định phiếu tối cao.`
        : `Không thể xác định phiếu kiểm nghiệm tối cao cho lô "${batchNo}".`,
      resolverVersion: CANONICAL_DECISION_RESOLVER_VERSION,
      authoritativeResults: [],
      boundTccs: resolvedTccs,
      criterionEvaluations: [],
      completion: emptyCompletion,
      blockers: [
        isLegacyOnly
          ? 'Phiếu kiểm nghiệm liên kết sai khóa kỹ thuật.'
          : 'Không thể phân giải phiếu kiểm nghiệm tối cao.',
      ],
    };
  }

  const supremeTestResultId = supremeResult.id;
  const supremeTestResultLab = supremeResult.labName;
  const supremeTestResultVersion =
    (supremeResult as any).version || (supremeResult as any).revision || 1;
  const supremeTestResultWorkflowStatus =
    String(
      (supremeResult as any).workflowStatus || (supremeResult as any).status || ''
    ).toUpperCase() || 'APPROVED';

  // 7. Lấy danh sách phiếu authoritative và loại bỏ các phiếu đã bị thay thế (superseded)
  const activeAuthoritative = resolveAuthoritativeTestResultsForBatch(
    batch,
    candidates,
    resolvedTccs
  );
  const authoritativeCount = activeAuthoritative.length > 0 ? activeAuthoritative.length : 1;
  const authoritativeIds = new Set(activeAuthoritative.map((r) => r.id));
  authoritativeIds.add(supremeResult.id);

  const supersededTestResultIds = candidates
    .filter((tr) => !authoritativeIds.has(tr.id))
    .map((tr) => tr.id);

  // 8. Đánh giá chi tiết chỉ tiêu dựa trên các phiếu Authoritative
  const requiredCriteria: Criterion[] = resolvedTccs
    ? [
        ...ensureArray(resolvedTccs.mainQualityCriteria),
        ...ensureArray(resolvedTccs.safetyCriteria),
      ].filter((c) => c && c.name && c.name.trim() !== '')
    : [];

  const criterionEvaluations: CriterionEvaluationDetail[] = [];
  const failedCriteriaList: CriterionEvaluationDetail[] = [];
  const pendingCriteriaList: CriterionEvaluationDetail[] = [];
  const unknownCriteriaList: CriterionEvaluationDetail[] = [];

  const authoritativeMap = new Map<string, TestResultEntry>();
  // Sắp xếp các phiếu authoritative theo thứ tự ưu tiên (supremeResult được ghi đè cuối cùng)
  const sortedAuth = [...activeAuthoritative].sort((a: any, b: any) => {
    if (a.id === supremeResult.id) return 1;
    if (b.id === supremeResult.id) return -1;
    const vA = a.version || a.revision || 0;
    const vB = b.version || b.revision || 0;
    if (vA !== vB) return vA - vB;
    const dateA = a.updatedAt || a.testDate || a.createdAt || '';
    const dateB = b.updatedAt || b.testDate || b.createdAt || '';
    return dateA.localeCompare(dateB);
  });

  sortedAuth.forEach((tr) => {
    ensureArray(tr.results).forEach((r) => {
      if (!r.isExtra && r.criteriaName) {
        authoritativeMap.set(r.criteriaName.trim().toLowerCase(), r);
      }
    });
  });

  const findAuthoritativeEntry = (targetName: string): TestResultEntry | undefined => {
    if (!targetName) return undefined;
    const lower = targetName.trim().toLowerCase();
    if (authoritativeMap.has(lower)) {
      return authoritativeMap.get(lower);
    }
    for (const [key, val] of authoritativeMap.entries()) {
      if (isCriteriaMatch(key, targetName) || isCriteriaMatch(targetName, key)) {
        return val;
      }
    }
    return undefined;
  };

  const missingCriteriaNames: string[] = [];

  requiredCriteria.forEach((crit) => {
    const cName = crit.name.trim();
    const entry = findAuthoritativeEntry(cName);

    const minNum = crit.min !== undefined && crit.min !== null ? Number(crit.min) : undefined;
    const maxNum = crit.max !== undefined && crit.max !== null ? Number(crit.max) : undefined;
    const limitText =
      minNum !== undefined && maxNum !== undefined
        ? `${minNum} ~ ${maxNum}`
        : minNum !== undefined
          ? `≥ ${minNum}`
          : maxNum !== undefined
            ? `≤ ${maxNum}`
            : crit.expectedText || 'Theo TCCS';

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

    let isExemptedByRule = false;
    if (resolvedTccs?.alternateRules && requiredCriteria.length > 0) {
      isExemptedByRule = AlternateRuleEvaluator.checkRuleExemption(
        cName,
        (name) => {
          const e = findAuthoritativeEntry(name);
          return e ? e.value : undefined;
        },
        resolvedTccs,
        {
          rulesMap: new Map(
            (resolvedTccs.alternateRules || []).map((r) => [(r.alt || '').trim().toLowerCase(), r])
          ),
          allCriteria: requiredCriteria,
          criteriaMap: new Map(requiredCriteria.map((c) => [c.name.trim().toLowerCase(), c])),
        },
        authoritativeMap
      );
    }

    if (isValueEmpty && !isValueExempt && !isExemptedByRule) {
      missingCriteriaNames.push(cName);
      const pendingDetail: CriterionEvaluationDetail = {
        criterionName: cName,
        expectedLimit: limitText,
        actualValue: '',
        unit: crit.unit,
        isPass: null,
        status: 'PENDING',
        evaluationMethod: crit.type === 'NUMBER' ? 'NUMERIC' : 'TEXT',
        note: 'Chưa có kết quả kiểm nghiệm cho chỉ tiêu này',
      };
      criterionEvaluations.push(pendingDetail);
      pendingCriteriaList.push(pendingDetail);
    } else {
      const evalRes = CriterionEvaluator.evaluateCriterion(crit, entry?.value);
      const isPass = evalRes.isPass === true || isExemptedByRule;
      const detail: CriterionEvaluationDetail = {
        criterionName: cName,
        expectedLimit: limitText,
        actualValue: entry?.value,
        unit: crit.unit || entry?.unit,
        isPass,
        status: isPass ? 'PASS' : evalRes.isPass === false ? 'FAIL' : 'UNKNOWN',
        evaluationMethod: isExemptedByRule
          ? 'EXEMPTION'
          : crit.type === 'NUMBER'
            ? 'NUMERIC'
            : 'TEXT',
        isExempted: isExemptedByRule || undefined,
        storedIsPass: entry?.isPass,
        recalculatedIsPass: evalRes.isPass,
        note: isExemptedByRule ? 'Miễn kiểm theo quy tắc thay thế' : evalRes.reason,
      };
      criterionEvaluations.push(detail);

      if (detail.status === 'FAIL') {
        failedCriteriaList.push(detail);
      } else if (detail.status === 'UNKNOWN') {
        unknownCriteriaList.push(detail);
      }
    }
  });

  if (requiredCriteria.length === 0 && supremeResult && Array.isArray(supremeResult.results)) {
    supremeResult.results.forEach((r) => {
      const detail: CriterionEvaluationDetail = {
        criterionName: r.criteriaName || '',
        expectedLimit: (r as any).limit || 'N/A',
        actualValue: r.value,
        unit: r.unit,
        isPass: r.isPass,
        status: r.isPass === true ? 'PASS' : r.isPass === false ? 'FAIL' : 'UNKNOWN',
        storedIsPass: r.isPass,
        recalculatedIsPass: r.isPass,
      };
      criterionEvaluations.push(detail);
      if (detail.status === 'FAIL') {
        failedCriteriaList.push(detail);
      } else if (detail.status === 'UNKNOWN') {
        unknownCriteriaList.push(detail);
      }
    });
  }

  const requiredCount =
    requiredCriteria.length > 0 ? requiredCriteria.length : criterionEvaluations.length;
  const completedCount =
    requiredCriteria.length > 0
      ? requiredCount - pendingCriteriaList.length
      : criterionEvaluations.length;
  const completionPercentage =
    requiredCount > 0
      ? Math.round((completedCount / requiredCount) * 100)
      : primaryCandidates.length > 0
        ? 100
        : 0;
  const isComplete =
    requiredCount > 0 ? pendingCriteriaList.length === 0 : primaryCandidates.length > 0;

  const completion = {
    requiredCount,
    testedCount: completedCount,
    percentage: completionPercentage,
    isComplete,
    missingCriteria: missingCriteriaNames,
  };

  // 9. Xác định Trạng thái Chất lượng Chuẩn (Canonical Quality Status)
  // SSoT Precedence:
  // supremeResult status là Single Source of Truth
  const finalStatus = finalResolution.status;
  let qualityStatus: CanonicalBatchQualityStatus = 'NOT_TESTED';
  const blockers: string[] = [];

  if (finalStatus === 'PASS') {
    qualityStatus = 'PASS';
  } else if (finalStatus === 'FAIL') {
    qualityStatus = 'FAIL';
    blockers.push(
      `Có ${failedCriteriaList.length > 0 ? failedCriteriaList.length : 1} chỉ tiêu không đạt chuẩn quy định.`
    );
  } else if (finalStatus === 'PENDING') {
    qualityStatus = 'TESTING';
    blockers.push(`Còn ${pendingCriteriaList.length} chỉ tiêu chưa kiểm nghiệm hoàn tất.`);
  } else {
    qualityStatus = 'INCOMPLETE';
    blockers.push('Dữ liệu kiểm nghiệm chưa hoàn chỉnh.');
  }

  // 10. Xác định Tính Toàn vẹn Lô (Batch Integrity Status) & Cảnh báo (Alert)
  const isReleased = workflowStatus === 'RELEASED';
  let integrityStatus: BatchIntegrityStatus = 'NOT_APPLICABLE';
  let shouldAlert = false;
  let alertType: 'CRITICAL' | 'WARNING' | 'INFO' | undefined = undefined;
  let decisionReason = '';

  if (!isReleased) {
    integrityStatus = 'NOT_APPLICABLE';
    shouldAlert = false;
    decisionReason = `Lô ở trạng thái ${workflowStatus}, không yêu cầu kiểm tra toàn vẹn xuất xưởng.`;
  } else {
    if (isLegacyOnly) {
      integrityStatus = 'RELATIONSHIP_ERROR';
      shouldAlert = true;
      alertType = 'WARNING';
      decisionReason = `Lô "${batchNo}" đã xuất xưởng và có hồ sơ kiểm nghiệm (${candidates.length} phiếu), nhưng liên kết qua số hiệu Lô (Legacy) thay vì ID kỹ thuật.`;
    } else if (qualityStatus === 'PASS') {
      integrityStatus = 'PASS';
      shouldAlert = false;
      alertType = undefined;
      decisionReason = `✓ Lô đã xuất xưởng và đã có hồ sơ kiểm nghiệm hợp lệ (${primaryCandidates.length} phiếu, Supreme: ${supremeTestResultLab}).`;
    } else {
      integrityStatus = 'TEST_RESULT_INVALID_STATUS';
      shouldAlert = true;
      alertType = 'CRITICAL';
      decisionReason =
        qualityStatus === 'TESTING'
          ? `Lô "${batchNo}" đã xuất xưởng nhưng phiếu kiểm nghiệm hiện hành chưa hoàn tất kiểm nghiệm (PENDING).`
          : `Lô "${batchNo}" đã xuất xưởng nhưng kết quả kiểm nghiệm tối cao là KHÔNG ĐẠT (FAIL).`;
    }
  }

  const failedCriteria = failedCriteriaList.map((c) => c.criterionName);
  const pendingCriteria = pendingCriteriaList.map((c) => c.criterionName);

  return {
    batchId,
    batchNo,
    workflowStatus,

    supremeTestResultId,
    supremeTestResultLab,
    supremeTestResultVersion,
    supremeTestResultWorkflowStatus,

    qualityStatus,

    integrityStatus,

    shouldAlert,
    alertType,

    candidateCount: primaryCandidates.length,
    authoritativeCount,

    supersededTestResultIds,

    failedCriteria,
    pendingCriteria,

    decisionReason,
    resolverVersion: CANONICAL_DECISION_RESOLVER_VERSION,

    supremeTestResult: supremeResult,
    authoritativeResults: activeAuthoritative,
    boundTccs: resolvedTccs,
    criterionEvaluations,
    completion,
    blockers,
  };
}
