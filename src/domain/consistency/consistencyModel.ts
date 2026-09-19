/**
 * PQM Domain - Data Consistency & Reconciliation Model (Model 7)
 * Phân loại và cấu trúc chuẩn hóa sai lệch dữ liệu giữa các nguồn.
 */

import { Product, Batch, TCCS, TestResult, ProductFormula, QualityDeviation } from '../../types';
import { EntityIdentityManager } from '../identity/entityIdentity';
import { CanonicalStatusResolver } from '../canonical/canonicalResolver';
import { resolveTestResultStatus } from '../test-result/testResultStatusResolver';
import { TCCSRules } from '../rules/TCCSRules';

export type StandardConsistencyIssueType =
  | 'MISSING_REFERENCE'
  | 'INVALID_REFERENCE'
  | 'DUPLICATE_ENTITY'
  | 'STATUS_MISMATCH'
  | 'CRITERIA_MISMATCH'
  | 'AGGREGATION_MISMATCH'
  | 'STALE_DERIVED_DATA'
  | 'ORPHAN_RECORD'
  | 'INVALID_SCHEMA'
  | 'INVALID_BUSINESS_RULE'
  | 'UNKNOWN';

/**
 * 8 nhóm phân loại sai lệch chuẩn (Model 7 - Consistency & Reconciliation)
 * Tách biệt rõ ràng, không gom tất cả thành một loại FAIL.
 */
export type DiscrepancyCategory =
  | 'MISSING'
  | 'INCOMPLETE'
  | 'CONTRADICTORY'
  | 'STALE'
  | 'ORPHAN'
  | 'INVALID'
  | 'DUPLICATE'
  | 'DERIVED_MISMATCH';

export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type HealingStrategyType = 'SAFE_AUTO_HEAL' | 'CONTROLLED_HEAL' | 'NEVER_AUTO_HEAL';

export interface CanonicalConsistencyIssue {
  id: string;
  type: StandardConsistencyIssueType;
  /** Nhóm phân loại bản chất sai lệch (Model 7) */
  category?: DiscrepancyCategory;
  severity: IssueSeverity;
  entityType: string;
  entityId: string;
  field?: string;
  expected?: any;
  actual?: any;
  source: string;
  detectedAt: string;
  detectedBy: string;
  canAutoHeal: boolean;
  healingStrategy: HealingStrategyType;
  status: 'DETECTED' | 'PREVIEWED' | 'HEALED' | 'IGNORED';
  details?: Record<string, any>;
}

export interface ConsistencyMetrics {
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  safeAutoHealCount: number;
  controlledHealCount: number;
  neverAutoHealCount: number;
  byType: Record<string, number>;
  isHealthy: boolean;
  score: number; // 0 - 100
}

export interface ConsistencyReport {
  auditedAt: string;
  issues: CanonicalConsistencyIssue[];
  metrics: ConsistencyMetrics;
  isHealthy: boolean;
}

export class ConsistencyIssueFactory {
  /**
   * Tự động phân loại sai lệch vào 8 nhóm chuẩn (Model 7)
   */
  public static deriveCategory(
    type: StandardConsistencyIssueType,
    actual?: any,
    expected?: any
  ): DiscrepancyCategory {
    switch (type) {
      case 'MISSING_REFERENCE':
        return 'MISSING';
      case 'ORPHAN_RECORD':
        return 'ORPHAN';
      case 'DUPLICATE_ENTITY':
        return 'DUPLICATE';
      case 'INVALID_REFERENCE':
      case 'INVALID_SCHEMA':
      case 'INVALID_BUSINESS_RULE':
        return 'INVALID';
      case 'STALE_DERIVED_DATA':
        return 'STALE';
      case 'AGGREGATION_MISMATCH':
        return 'DERIVED_MISMATCH';
      case 'STATUS_MISMATCH':
      case 'CRITERIA_MISMATCH':
        if (
          expected === 'PENDING' ||
          actual === 'PENDING' ||
          expected === 'INCOMPLETE' ||
          actual === 'INCOMPLETE'
        ) {
          return 'INCOMPLETE';
        }
        return 'CONTRADICTORY';
      default:
        return 'DERIVED_MISMATCH';
    }
  }

  public static createIssue(params: {
    type: StandardConsistencyIssueType;
    category?: DiscrepancyCategory;
    severity: IssueSeverity;
    entityType: string;
    entityId: string;
    field?: string;
    expected?: any;
    actual?: any;
    source: string;
    healingStrategy: HealingStrategyType;
    detectedBy?: string;
    details?: Record<string, any>;
  }): CanonicalConsistencyIssue {
    const canAutoHeal =
      params.healingStrategy === 'SAFE_AUTO_HEAL' || params.healingStrategy === 'CONTROLLED_HEAL';
    const category =
      params.category || this.deriveCategory(params.type, params.actual, params.expected);

    return {
      id: `ISSUE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      type: params.type,
      category,
      severity: params.severity,
      entityType: params.entityType,
      entityId: params.entityId,
      field: params.field,
      expected: params.expected,
      actual: params.actual,
      source: params.source,
      detectedAt: new Date().toISOString(),
      detectedBy: params.detectedBy || 'CanonicalConsistencyEngine',
      canAutoHeal,
      healingStrategy: params.healingStrategy,
      status: 'DETECTED',
      details: params.details,
    };
  }

  public static createOrphanIssue(params: {
    entityType: string;
    entityId: string;
    missingParentType: string;
    foreignKeyField: string;
    foreignKeyValue: string;
    source?: string;
  }): CanonicalConsistencyIssue {
    return this.createIssue({
      type: 'ORPHAN_RECORD',
      severity: 'CRITICAL',
      entityType: params.entityType,
      entityId: params.entityId,
      field: params.foreignKeyField,
      expected: `Hợp lệ trỏ tới ${params.missingParentType}`,
      actual: params.foreignKeyValue,
      source: params.source || 'EntityIdentityManager',
      healingStrategy: 'CONTROLLED_HEAL',
      details: {
        missingParentType: params.missingParentType,
        foreignKeyValue: params.foreignKeyValue,
      },
    });
  }

  public static createStatusMismatchIssue(params: {
    entityType: string;
    entityId: string;
    expectedStatus: string;
    actualStatus: string;
    source?: string;
    severity?: IssueSeverity;
    category?: DiscrepancyCategory;
    details?: Record<string, any>;
  }): CanonicalConsistencyIssue {
    const isQualityFailure = params.expectedStatus === 'FAIL';
    const isPending =
      params.expectedStatus === 'PENDING' ||
      params.expectedStatus === 'UNKNOWN' ||
      params.actualStatus === 'PENDING';
    const defaultSeverity: IssueSeverity = isQualityFailure
      ? 'CRITICAL'
      : isPending
        ? 'INFO'
        : 'WARNING';

    const defaultCategory: DiscrepancyCategory = isPending ? 'INCOMPLETE' : 'CONTRADICTORY';

    return this.createIssue({
      type: 'STATUS_MISMATCH',
      category: params.category || defaultCategory,
      severity: params.severity || defaultSeverity,
      entityType: params.entityType,
      entityId: params.entityId,
      field: 'status',
      expected: params.expectedStatus,
      actual: params.actualStatus,
      source: params.source || 'CanonicalStatusResolver',
      healingStrategy: isQualityFailure ? 'NEVER_AUTO_HEAL' : 'CONTROLLED_HEAL',
      details: params.details,
    });
  }

  public static createReferenceIssue(params: {
    entityType: string;
    entityId: string;
    field: string;
    expected: string;
    actual: string;
    issueType?: 'INVALID_REFERENCE' | 'MISSING_REFERENCE';
    severity?: IssueSeverity;
    healingStrategy?: HealingStrategyType;
    source?: string;
  }): CanonicalConsistencyIssue {
    return this.createIssue({
      type: params.issueType || 'INVALID_REFERENCE',
      severity: params.severity || 'WARNING',
      entityType: params.entityType,
      entityId: params.entityId,
      field: params.field,
      expected: params.expected,
      actual: params.actual,
      source: params.source || 'EntityIdentityManager',
      healingStrategy: params.healingStrategy || 'CONTROLLED_HEAL',
    });
  }
}

/**
 * Động cơ Kiểm toán & Đối chiếu Toàn vẹn Dữ liệu (Consistency Auditor & Reconciler)
 */
export class ConsistencyAuditor {
  /**
   * 1. Kiểm toán Toàn vẹn Định danh & Mối quan hệ (Identity & Relationship Audit)
   */
  public static auditEntityIdentities(dataset: {
    products?: Product[];
    batches?: Batch[];
    tccsList?: TCCS[];
    testResults?: TestResult[];
  }): CanonicalConsistencyIssue[] {
    const issues: CanonicalConsistencyIssue[] = [];
    const { products = [], batches = [], tccsList = [], testResults = [] } = dataset;

    // A. Kiểm tra bản ghi mồ côi (Orphans)
    const orphans = EntityIdentityManager.detectOrphanEntities({
      testResults,
      batches,
      products,
      tccsList,
    });

    orphans.orphanTestResults.forEach((tr) => {
      issues.push(
        ConsistencyIssueFactory.createOrphanIssue({
          entityType: 'TEST_RESULT',
          entityId: tr.testResultId,
          missingParentType: 'BATCH',
          foreignKeyField: 'batchId',
          foreignKeyValue: tr.batchId,
        })
      );
    });

    orphans.orphanBatches.forEach((b) => {
      issues.push(
        ConsistencyIssueFactory.createOrphanIssue({
          entityType: 'BATCH',
          entityId: b.batchId,
          missingParentType: b.reason.includes('TCCS') ? 'TCCS' : 'PRODUCT',
          foreignKeyField: b.reason.includes('TCCS') ? 'tccsId' : 'productId',
          foreignKeyValue: b.reason.includes('TCCS') ? b.tccsId || '' : b.productId || '',
        })
      );
    });

    orphans.orphanTCCS.forEach((t) => {
      issues.push(
        ConsistencyIssueFactory.createOrphanIssue({
          entityType: 'TCCS',
          entityId: t.tccsId,
          missingParentType: 'PRODUCT',
          foreignKeyField: 'productId',
          foreignKeyValue: t.productId,
        })
      );
    });

    // B. Kiểm tra trùng lặp mã sản phẩm & số lô
    const productCodeMap = new Map<string, string[]>();
    products.forEach((p) => {
      if (p.code) {
        const list = productCodeMap.get(p.code) || [];
        list.push(p.id);
        productCodeMap.set(p.code, list);
      }
    });
    for (const [code, ids] of productCodeMap.entries()) {
      if (ids.length > 1) {
        issues.push(
          ConsistencyIssueFactory.createIssue({
            type: 'DUPLICATE_ENTITY',
            severity: 'WARNING',
            entityType: 'PRODUCT',
            entityId: ids[1],
            field: 'code',
            actual: code,
            source: 'EntityIdentityManager',
            healingStrategy: 'CONTROLLED_HEAL',
            details: { message: `Trùng lặp mã sản phẩm: ${code}`, duplicateIds: ids },
          })
        );
      }
    }

    // C. Kiểm tra tham chiếu khóa ngoại bị trỏ bằng số lô legacy (batchNo)
    const refCheck = EntityIdentityManager.detectBrokenReferences({
      testResults,
      batches,
      products,
      tccsList,
    });
    refCheck.forEach((ref) => {
      if (ref.classification === 'LEGACY_BUSINESS_KEY') {
        issues.push(
          ConsistencyIssueFactory.createReferenceIssue({
            entityType: ref.sourceEntityType,
            entityId: ref.sourceEntityId,
            field: ref.referenceField,
            expected: `Khóa chính ${ref.targetEntityType}.id`,
            actual: String(ref.referenceValue),
            issueType: 'INVALID_REFERENCE',
            severity: 'WARNING',
            healingStrategy: 'CONTROLLED_HEAL',
          })
        );
      }
    });

    return issues;
  }

  /**
   * 2. Kiểm toán Tính Nhất quán Trạng thái Nghiệp vụ (Status Consistency Audit)
   */
  public static auditStatusConsistency(dataset: {
    testResults?: TestResult[];
    batches?: Batch[];
    tccsList?: TCCS[];
    deviations?: QualityDeviation[];
  }): CanonicalConsistencyIssue[] {
    const issues: CanonicalConsistencyIssue[] = [];
    const { testResults = [], batches = [], tccsList = [], deviations = [] } = dataset;

    // A. Kiểm toán trạng thái Phiếu kiểm nghiệm (Stored vs Canonical computed)
    testResults.forEach((tr) => {
      const boundBatch = batches.find((b) => b.id === tr.batchId);
      const boundTccs =
        tccsList.find((t) => t.id === tr.tccsId) ||
        tccsList.find((t) => t.id === boundBatch?.tccsId) ||
        tccsList.find((t) => t.id === tr.evaluationSnapshot?.tccsId);

      const computedStatus = resolveTestResultStatus(tr, boundTccs);

      // Nếu không có stored status hoặc đã khớp hoàn toàn -> Không có sai lệch
      if (!tr.overallStatus || tr.overallStatus === computedStatus) {
        return;
      }

      // Phân loại bản chất: Chỉ tiêu FAIL đối đầu với Stored PASS mới là CRITICAL CONTRADICTORY
      const isCriticalFail = tr.overallStatus === 'PASS' && computedStatus === 'FAIL';
      const isPendingMismatch = computedStatus === 'PENDING' || computedStatus === 'UNKNOWN';

      issues.push(
        ConsistencyIssueFactory.createStatusMismatchIssue({
          entityType: 'TEST_RESULT',
          entityId: tr.id,
          expectedStatus: computedStatus,
          actualStatus: tr.overallStatus,
          severity: isCriticalFail ? 'CRITICAL' : isPendingMismatch ? 'INFO' : 'WARNING',
          category: isPendingMismatch ? 'INCOMPLETE' : 'CONTRADICTORY',
          source: 'CanonicalStatusResolver',
          details: {
            computedFromCriteria: true,
            totalCriteria: tr.results?.length || 0,
            boundTccsId: boundTccs?.id,
          },
        })
      );
    });

    // B. Kiểm toán Lô đã xuất xưởng (RELEASED Batch Integrity)
    batches.forEach((b) => {
      if (b.status === 'RELEASED') {
        const batchResults = testResults.filter((tr) => tr.batchId === b.id);
        const boundTccs = tccsList.find((t) => t.id === b.tccsId);
        const qualityRes = CanonicalStatusResolver.resolveBatchQuality(b, batchResults, boundTccs);

        if (qualityRes.batchQualityStatus !== 'PASS') {
          issues.push(
            ConsistencyIssueFactory.createIssue({
              type: 'STATUS_MISMATCH',
              severity: 'CRITICAL',
              entityType: 'BATCH',
              entityId: b.id,
              field: 'status',
              expected: 'PASS',
              actual: qualityRes.batchQualityStatus,
              source: 'CanonicalStatusResolver',
              healingStrategy: 'NEVER_AUTO_HEAL',
              details: {
                reason: 'Lô đã xuất xưởng nhưng kết quả kiểm nghiệm chất lượng chưa đạt PASS.',
                failingCriteria: qualityRes.criteriaSummary.fail,
              },
            })
          );
        }

        // C. Kiểm tra sai lệch nghiêm trọng chưa đóng (Open Critical Deviations)
        const openCritical = deviations.filter(
          (d) =>
            (d.batchId === b.id || d.batchNo === b.batchNo) &&
            d.severity === 'CRITICAL' &&
            d.status !== 'CLOSED'
        );

        if (openCritical.length > 0) {
          issues.push(
            ConsistencyIssueFactory.createIssue({
              type: 'INVALID_BUSINESS_RULE',
              severity: 'CRITICAL',
              entityType: 'BATCH',
              entityId: b.id,
              field: 'status',
              source: 'BatchRules',
              healingStrategy: 'NEVER_AUTO_HEAL',
              details: {
                reason: `Lô đã xuất xưởng nhưng còn ${openCritical.length} hồ sơ sai lệch nghiêm trọng (CRITICAL) chưa đóng.`,
                openDeviationIds: openCritical.map((d) => d.id),
              },
            })
          );
        }
      }
    });

    return issues;
  }

  /**
   * 3. Kiểm toán Tính Toàn vẹn Tiêu chuẩn Kỹ thuật (TCCS Specification Integrity)
   */
  public static auditSpecificationIntegrity(dataset: {
    products?: Product[];
    tccsList?: TCCS[];
  }): CanonicalConsistencyIssue[] {
    const issues: CanonicalConsistencyIssue[] = [];
    const { products = [], tccsList = [] } = dataset;

    // A. Kiểm tra hiệu lực duy nhất của TCCS theo từng sản phẩm
    products.forEach((p) => {
      const activeCheck = TCCSRules.validateActiveStatus(p.id, tccsList);
      if (!activeCheck.isValid) {
        if (activeCheck.issue === 'MULTIPLE_ACTIVE_TCCS') {
          issues.push(
            ConsistencyIssueFactory.createIssue({
              type: 'DUPLICATE_ENTITY',
              severity: 'CRITICAL',
              entityType: 'TCCS',
              entityId: p.id,
              field: 'isActive',
              source: 'TCCSRules',
              healingStrategy: 'CONTROLLED_HEAL',
              details: { message: activeCheck.description },
            })
          );
        } else if (activeCheck.issue === 'NO_ACTIVE_TCCS') {
          issues.push(
            ConsistencyIssueFactory.createIssue({
              type: 'MISSING_REFERENCE',
              severity: 'WARNING',
              entityType: 'PRODUCT',
              entityId: p.id,
              field: 'tccsId',
              source: 'TCCSRules',
              healingStrategy: 'CONTROLLED_HEAL',
              details: { message: activeCheck.description },
            })
          );
        }
      }
    });

    // B. Kiểm tra cấu trúc định nghĩa chỉ tiêu trong từng TCCS
    tccsList.forEach((t) => {
      const defCheck = TCCSRules.validateCriteriaDefinitions(t);
      if (!defCheck.isValid) {
        issues.push(
          ConsistencyIssueFactory.createIssue({
            type: 'INVALID_SCHEMA',
            severity: 'CRITICAL',
            entityType: 'TCCS',
            entityId: t.id,
            field: 'mainQualityCriteria',
            source: 'TCCSRules',
            healingStrategy: 'CONTROLLED_HEAL',
            details: { errors: defCheck.errors },
          })
        );
      }
    });

    return issues;
  }

  /**
   * 4. Kiểm toán Ngày tháng Sinh học (Biological Date Audit)
   */
  public static auditBatchDates(batches: Batch[]): CanonicalConsistencyIssue[] {
    const issues: CanonicalConsistencyIssue[] = [];

    batches.forEach((b) => {
      if (b.mfgDate && b.expDate) {
        const mfg = new Date(b.mfgDate);
        const exp = new Date(b.expDate);
        if (!isNaN(mfg.getTime()) && !isNaN(exp.getTime()) && exp.getTime() < mfg.getTime()) {
          issues.push(
            ConsistencyIssueFactory.createIssue({
              type: 'INVALID_SCHEMA',
              severity: 'CRITICAL',
              entityType: 'BATCH',
              entityId: b.id,
              field: 'expDate',
              expected: `>= ${b.mfgDate}`,
              actual: b.expDate,
              source: 'ValidationEngine',
              healingStrategy: 'CONTROLLED_HEAL',
              details: {
                reason: `Hạn dùng (${b.expDate}) đứng trước ngày sản xuất (${b.mfgDate}).`,
              },
            })
          );
        }
      }
    });

    return issues;
  }

  /**
   * Tính toán các chỉ số sức khỏe nhất quán dữ liệu (Consistency Metrics)
   */
  public static calculateMetrics(issues: CanonicalConsistencyIssue[]): ConsistencyMetrics {
    const totalIssues = issues.length;
    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
    const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
    const infoCount = issues.filter((i) => i.severity === 'INFO').length;

    const safeAutoHealCount = issues.filter((i) => i.healingStrategy === 'SAFE_AUTO_HEAL').length;
    const controlledHealCount = issues.filter(
      (i) => i.healingStrategy === 'CONTROLLED_HEAL'
    ).length;
    const neverAutoHealCount = issues.filter((i) => i.healingStrategy === 'NEVER_AUTO_HEAL').length;

    const byType: Record<string, number> = {};
    issues.forEach((i) => {
      byType[i.type] = (byType[i.type] || 0) + 1;
    });

    const isHealthy = criticalCount === 0 && totalIssues <= 2;
    const penalty = criticalCount * 25 + warningCount * 5 + infoCount * 1;
    const score = Math.max(0, 100 - penalty);

    return {
      totalIssues,
      criticalCount,
      warningCount,
      infoCount,
      safeAutoHealCount,
      controlledHealCount,
      neverAutoHealCount,
      byType,
      isHealthy,
      score,
    };
  }

  /**
   * Kiểm toán toàn diện tất cả các khía cạnh và xuất báo cáo nhất quán (Consistency Report)
   */
  public static auditComprehensive(dataset: {
    products?: Product[];
    batches?: Batch[];
    tccsList?: TCCS[];
    testResults?: TestResult[];
    formulas?: ProductFormula[];
    deviations?: QualityDeviation[];
  }): ConsistencyReport {
    const identityIssues = this.auditEntityIdentities(dataset);
    const statusIssues = this.auditStatusConsistency(dataset);
    const specIssues = this.auditSpecificationIntegrity(dataset);
    const dateIssues = this.auditBatchDates(dataset.batches || []);

    const allIssues = [...identityIssues, ...statusIssues, ...specIssues, ...dateIssues];
    const metrics = this.calculateMetrics(allIssues);

    return {
      auditedAt: new Date().toISOString(),
      issues: allIssues,
      metrics,
      isHealthy: metrics.isHealthy,
    };
  }

  /**
   * Lọc sai lệch theo mức độ nghiêm trọng
   */
  public static filterBySeverity(
    issues: CanonicalConsistencyIssue[],
    severity: IssueSeverity
  ): CanonicalConsistencyIssue[] {
    return issues.filter((i) => i.severity === severity);
  }

  /**
   * Lọc sai lệch theo chiến lược hàn gắn
   */
  public static filterByStrategy(
    issues: CanonicalConsistencyIssue[],
    strategy: HealingStrategyType
  ): CanonicalConsistencyIssue[] {
    return issues.filter((i) => i.healingStrategy === strategy);
  }

  /**
   * Nhóm sai lệch theo nhóm loại chuẩn hóa
   */
  public static groupIssuesByType(
    issues: CanonicalConsistencyIssue[]
  ): Record<StandardConsistencyIssueType, CanonicalConsistencyIssue[]> {
    const map: Partial<Record<StandardConsistencyIssueType, CanonicalConsistencyIssue[]>> = {};
    issues.forEach((i) => {
      if (!map[i.type]) {
        map[i.type] = [];
      }
      map[i.type]!.push(i);
    });
    return map as Record<StandardConsistencyIssueType, CanonicalConsistencyIssue[]>;
  }
}
