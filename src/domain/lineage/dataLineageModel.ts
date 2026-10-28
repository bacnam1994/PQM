/**
 * PQM Domain - Data Lineage Model (Model 4)
 * =========================================
 * Biết dữ liệu sinh ra từ đâu, tính toán như thế nào, bằng chứng kỹ thuật nào,
 * và giải trình đầy đủ phục vụ ALCOA+ Audit Trail, Regulatory Inspection (GMP / 21 CFR Part 11)
 * và Data Integrity Center.
 *
 * Cây phả hệ dữ liệu chuẩn:
 * Batch (Technical ID)
 *  ├── Product (Master Data: code, name, registrationNo, group)
 *  ├── TCCS (Tiêu chuẩn cơ sở: code, version, criteria)
 *  ├── Formula (Công thức sản xuất)
 *  │    └── Raw Materials (Nguyên liệu, hàm lượng công bố, đơn vị)
 *  ├── Test Results (Các phiếu kiểm nghiệm)
 *  │    ├── Authoritative Test Result (Phiếu đại diện chính thức)
 *  │    │    ├── Evaluation Snapshot (Mã băm SHA-256 niêm phong ALCOA+)
 *  │    │    └── Criteria Evidence (Chi tiết từng chỉ tiêu: value, isPass (boolean | null), limit)
 *  │    └── Supporting / Retest Test Results (Phiếu bổ sung / kiểm nghiệm lại)
 *  ├── Deviations (Hồ sơ sai lệch OOS/OOT nếu có)
 *  └── Quality Release Explanation (Giải trình nguồn gốc quyết định chất lượng)
 */

import {
  Product,
  Batch,
  TCCS,
  TestResult,
  ProductFormula,
  RawMaterial,
  QualityDeviation,
  EvaluationSnapshot,
} from '../../types';
import { CanonicalStatusResolver } from '../canonical/canonicalResolver';

export interface CriterionOrigin {
  criteriaName: string;
  value: string | number | null;
  /**
   * isPass: boolean | null
   * Tuân thủ triệt để Model 1 Canonical Quality Status:
   * true = PASS, false = FAIL, null = Informational / Sensory / Unresolved.
   * Tuyệt đối không ép null thành true.
   */
  isPass: boolean | null;
  unit?: string;
  limit?: string;
  analysisMethod?: string;
  confidence?: string;
  ruleApplied?: string;
}

export interface ValueOriginExplanation {
  field: string;
  derivedValue: any;
  sourceType: 'TEST_RESULT' | 'BATCH_LIFECYCLE' | 'FORMULA' | 'TCCS' | 'EVALUATION_SNAPSHOT';
  sourceId: string;
  sourceDescription: string;
  criteriaEvidence?: {
    totalCriteria: number;
    passedCriteria: number;
    failedCriteria: number;
    unresolvedCriteria: number;
    summary: string;
  };
  tccsReference?: {
    tccsId: string;
    code: string;
    version?: string | number;
  };
  evaluationSnapshotHash?: string;
  /**
   * Chuỗi truy vết ID kỹ thuật hoàn chỉnh:
   * [productId, tccsId, formulaId, batchId, testResultId]
   */
  traceabilityChain: string[];
  calculatedAt: string;
  resolver: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface BatchDataLineage {
  batch: {
    id: string;
    batchNo: string;
    mfgDate: string;
    expDate: string;
    status: string;
    progressPercent?: number;
  };
  product?: {
    id: string;
    code: string;
    name: string;
    registrationNo?: string;
    group?: string;
  };
  tccs?: {
    id: string;
    code: string;
    issueDate?: string;
    isActive?: boolean;
    totalCriteria: number;
  };
  formula?: {
    id: string;
    ingredientCount: number;
    materials: {
      id?: string;
      name: string;
      content: string | number;
      unit: string;
      materialId?: string;
    }[];
  };
  testResults: {
    id: string;
    labName: string;
    testDate: string;
    overallStatus: string;
    isAuthoritative: boolean;
    criteria: CriterionOrigin[];
    evaluationSnapshot?: EvaluationSnapshot;
  }[];
  deviations?: {
    id: string;
    deviationNo: string;
    title: string;
    severity: string;
    status: string;
    source: string;
  }[];
  qualityExplanation: ValueOriginExplanation;
  timestamp: string;
}

export interface RawMaterialImpactAnalysis {
  materialId: string;
  materialName?: string;
  impactedFormulas: { formulaId: string; productId: string }[];
  impactedBatches: {
    batchId: string;
    batchNo: string;
    productId: string;
    mfgDate: string;
    status: string;
  }[];
  totalBatchesImpacted: number;
}

export interface LineageCompletenessCheck {
  isComplete: boolean;
  missingNodes: string[];
  warnings: string[];
}

export class DataLineageManager {
  /**
   * Xây dựng cây phả hệ đầy đủ cho một Lô sản xuất
   */
  public static buildBatchLineage(options: {
    batch: Batch;
    products: Product[];
    tccsList: TCCS[];
    formulas: ProductFormula[];
    testResults: TestResult[];
    deviations?: QualityDeviation[];
  }): BatchDataLineage {
    const { batch, products, tccsList, formulas, testResults, deviations = [] } = options;

    const product = products.find((p) => p.id === batch.productId);
    const tccs = tccsList.find((t) => t.id === batch.tccsId);
    const formula = formulas.find((f) => f.productId === batch.productId);
    const relatedTests = testResults.filter((tr) => tr.batchId === batch.id);
    const relatedDeviations = deviations.filter(
      (d) => d.batchId === batch.id || (d.batchNo && d.batchNo === batch.batchNo)
    );

    const authoritative = CanonicalStatusResolver.selectAuthoritativeResult(batch, relatedTests);
    const qualityRes = CanonicalStatusResolver.resolveBatchQuality(batch, relatedTests, tccs);

    // Tính toán số lượng chỉ tiêu chưa giải quyết (null / informational)
    let unresolvedCriteria = 0;
    if (authoritative && authoritative.results) {
      unresolvedCriteria = authoritative.results.filter(
        (r) => r.isPass === null || r.isPass === undefined
      ).length;
    }

    // Xây dựng chuỗi truy vết Technical ID: [Product, TCCS, Formula, Batch, TestResult]
    const traceabilityChain: string[] = [
      product?.id,
      tccs?.id,
      formula?.id,
      batch.id,
      authoritative?.id,
    ].filter((id): id is string => !!id && typeof id === 'string');

    // Giải trình nguồn gốc giá trị chất lượng (Value Origin Explanation)
    const qualityExplanation: ValueOriginExplanation = {
      field: 'qualityStatus',
      derivedValue: qualityRes.batchQualityStatus,
      sourceType: authoritative
        ? authoritative.evaluationSnapshot
          ? 'EVALUATION_SNAPSHOT'
          : 'TEST_RESULT'
        : 'BATCH_LIFECYCLE',
      sourceId: authoritative ? authoritative.id : batch.id,
      sourceDescription: authoritative
        ? `Phiếu kiểm nghiệm ${authoritative.id} (${authoritative.labName || 'Chưa rõ lab'}) ngày ${authoritative.testDate}`
        : 'Chưa có phiếu kiểm nghiệm authoritative liên kết',
      criteriaEvidence: authoritative
        ? {
            totalCriteria: qualityRes.criteriaSummary.total,
            passedCriteria: qualityRes.criteriaSummary.pass,
            failedCriteria: qualityRes.criteriaSummary.fail,
            unresolvedCriteria,
            summary: `${qualityRes.criteriaSummary.pass}/${qualityRes.criteriaSummary.total} chỉ tiêu ĐẠT`,
          }
        : undefined,
      tccsReference: tccs
        ? {
            tccsId: tccs.id,
            code: tccs.code,
            version: tccs.version,
          }
        : undefined,
      evaluationSnapshotHash: authoritative?.evaluationSnapshot?.evaluationHash,
      traceabilityChain,
      calculatedAt: qualityRes.evaluatedAt,
      resolver: CanonicalStatusResolver.VERSION,
      confidence: authoritative ? 'HIGH' : 'LOW',
    };

    return {
      batch: {
        id: batch.id,
        batchNo: batch.batchNo,
        mfgDate: batch.mfgDate,
        expDate: batch.expDate,
        status: batch.status,
        progressPercent: batch.progressPercent,
      },
      product: product
        ? {
            id: product.id,
            code: product.code,
            name: product.name,
            registrationNo: product.registrationNo,
            group: product.group,
          }
        : undefined,
      tccs: tccs
        ? {
            id: tccs.id,
            code: tccs.code,
            issueDate: tccs.issueDate,
            isActive: tccs.isActive,
            totalCriteria:
              (tccs.mainQualityCriteria?.length || 0) + (tccs.safetyCriteria?.length || 0),
          }
        : undefined,
      formula: formula
        ? {
            id: formula.id,
            ingredientCount: (formula.ingredients?.length || 0) + (formula.excipients?.length || 0),
            materials: [
              ...(formula.ingredients || []).map((i) => ({
                id: i.materialId,
                name: i.name,
                content: i.declaredContent,
                unit: i.unit,
                materialId: i.materialId,
              })),
              ...(formula.excipients || []).map((e) => ({
                id: e.materialId,
                name: e.name,
                content: e.declaredContent,
                unit: e.unit,
                materialId: e.materialId,
              })),
            ],
          }
        : undefined,
      testResults: relatedTests.map((tr) => ({
        id: tr.id,
        labName: tr.labName,
        testDate: tr.testDate,
        overallStatus: tr.overallStatus,
        isAuthoritative: authoritative?.id === tr.id,
        criteria: (tr.results || []).map((r) => ({
          criteriaName: r.criteriaName,
          value: r.value,
          isPass: r.isPass,
          unit: r.unit,
          limit: r.limit,
          analysisMethod: r.analysisMethod,
          confidence: r.confidence,
        })),
        evaluationSnapshot: tr.evaluationSnapshot,
      })),
      deviations: relatedDeviations.map((d) => ({
        id: d.id,
        deviationNo: d.deviationNo,
        title: d.title,
        severity: d.severity,
        status: d.status,
        source: d.source,
      })),
      qualityExplanation,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Giải trình nguồn gốc một trường cụ thể của Lô sản xuất (On-demand Field Explainability)
   */
  public static explainFieldOrigin(
    batch: Batch,
    field: string,
    options: {
      products: Product[];
      tccsList: TCCS[];
      formulas: ProductFormula[];
      testResults: TestResult[];
    }
  ): ValueOriginExplanation {
    const lineage = this.buildBatchLineage({
      batch,
      products: options.products,
      tccsList: options.tccsList,
      formulas: options.formulas,
      testResults: options.testResults,
    });

    if (field === 'qualityStatus' || field === 'batchQualityStatus') {
      return lineage.qualityExplanation;
    }

    if (field === 'releaseDecision' || field === 'status') {
      return {
        field,
        derivedValue: batch.status,
        sourceType: 'BATCH_LIFECYCLE',
        sourceId: batch.id,
        sourceDescription: `Trạng thái quy trình sản xuất của Lô ${batch.batchNo}: ${batch.status}`,
        traceabilityChain: [batch.id],
        calculatedAt: new Date().toISOString(),
        resolver: 'BatchWorkflowEngine',
        confidence: 'HIGH',
      };
    }

    if (field === 'tccs') {
      return {
        field,
        derivedValue: lineage.tccs?.code || 'CHƯA_GẮN_TCCS',
        sourceType: 'TCCS',
        sourceId: batch.tccsId || '',
        sourceDescription: lineage.tccs
          ? `Tiêu chuẩn cơ sở ${lineage.tccs.code} (${lineage.tccs.totalCriteria} chỉ tiêu)`
          : `Lô chưa liên kết TCCS hợp lệ`,
        traceabilityChain: [batch.tccsId, batch.id].filter(Boolean),
        calculatedAt: new Date().toISOString(),
        resolver: 'TCCSRules',
        confidence: lineage.tccs ? 'HIGH' : 'LOW',
      };
    }

    // Mặc định cho các trường khác
    return {
      field,
      derivedValue: (batch as any)[field],
      sourceType: 'BATCH_LIFECYCLE',
      sourceId: batch.id,
      sourceDescription: `Thuộc tính ${field} của bản ghi Lô ${batch.id}`,
      traceabilityChain: [batch.id],
      calculatedAt: new Date().toISOString(),
      resolver: 'BatchEntity',
      confidence: 'HIGH',
    };
  }

  /**
   * Truy vết xuôi ảnh hưởng của Nguyên liệu (Forward Raw Material Traceability):
   * Từ một nguyên liệu (materialId) -> tìm tất cả công thức & các lô sản xuất liên quan.
   */
  public static traceRawMaterialImpact(
    materialId: string,
    options: {
      formulas: ProductFormula[];
      batches: Batch[];
      materials?: RawMaterial[];
    }
  ): RawMaterialImpactAnalysis {
    const { formulas, batches, materials = [] } = options;
    const cleanMatId = materialId.trim().toLowerCase();

    const targetMaterial = materials.find(
      (m) => m.id.toLowerCase() === cleanMatId || (m.code && m.code.toLowerCase() === cleanMatId)
    );
    const materialName = targetMaterial?.name;

    // Tìm các công thức có chứa nguyên liệu này
    const impactedFormulas: { formulaId: string; productId: string }[] = [];
    for (const f of formulas) {
      const allItems = [...(f.ingredients || []), ...(f.excipients || [])];
      const hasMaterial = allItems.some(
        (item) =>
          (item.materialId && item.materialId.toLowerCase() === cleanMatId) ||
          (item.name && cleanMatId && item.name.toLowerCase().includes(cleanMatId))
      );
      if (hasMaterial) {
        impactedFormulas.push({
          formulaId: f.id,
          productId: f.productId,
        });
      }
    }

    const impactedProductIds = new Set(impactedFormulas.map((f) => f.productId));

    // Tìm các lô thuộc sản phẩm bị ảnh hưởng
    const impactedBatches: {
      batchId: string;
      batchNo: string;
      productId: string;
      mfgDate: string;
      status: string;
    }[] = [];

    for (const b of batches) {
      if (impactedProductIds.has(b.productId)) {
        impactedBatches.push({
          batchId: b.id,
          batchNo: b.batchNo,
          productId: b.productId,
          mfgDate: b.mfgDate,
          status: b.status,
        });
      }
    }

    return {
      materialId,
      materialName,
      impactedFormulas,
      impactedBatches,
      totalBatchesImpacted: impactedBatches.length,
    };
  }

  /**
   * Kiểm tra tính hoàn thiện của cây phả hệ Lô sản xuất (Lineage Completeness Verification)
   */
  public static verifyLineageCompleteness(lineage: BatchDataLineage): LineageCompletenessCheck {
    const missingNodes: string[] = [];
    const warnings: string[] = [];

    if (!lineage.batch || !lineage.batch.id) {
      missingNodes.push('BATCH');
    }

    if (!lineage.product) {
      missingNodes.push('PRODUCT');
    }

    if (!lineage.tccs) {
      missingNodes.push('TCCS');
    }

    if (!lineage.formula) {
      warnings.push('BATCH_NO_FORMULA: Lô sản xuất chưa có công thức định mức liên kết.');
    }

    const hasAuthoritativeTest = lineage.testResults.some((tr) => tr.isAuthoritative);
    if (!hasAuthoritativeTest) {
      warnings.push(
        'NO_AUTHORITATIVE_TEST: Lô sản xuất chưa có phiếu kiểm nghiệm đạt chuẩn authoritative.'
      );
    }

    return {
      isComplete: missingNodes.length === 0,
      missingNodes,
      warnings,
    };
  }
}
