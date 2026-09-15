/**
 * PQM Domain - Data Lineage Model (Model 4)
 * Biết dữ liệu sinh ra từ đâu. Nền tảng để Data Integrity Center và ALCOA+ Audit giải trình.
 *
 * Cây phả hệ:
 * Batch
 *  ├── Product
 *  ├── TCCS
 *  ├── Formula
 *  │    └── Raw Materials
 *  ├── Test Results
 *  │    ├── Criterion 1
 *  │    ├── Criterion 2
 *  │    └── Criterion N
 *  ├── Deviations
 *  ├── Approvals
 *  └── Release decision
 */

import { Product, Batch, TCCS, TestResult, ProductFormula, RawMaterial } from '../../types';
import { CanonicalStatusResolver } from '../canonical/canonicalResolver';

export interface CriterionOrigin {
  criteriaName: string;
  value: string | number;
  isPass: boolean;
  unit?: string;
  limit?: string;
}

export interface ValueOriginExplanation {
  field: string;
  derivedValue: any;
  sourceType: string;
  sourceId: string;
  sourceDescription: string;
  criteriaEvidence?: {
    totalCriteria: number;
    passedCriteria: number;
    failedCriteria: number;
    summary: string;
  };
  tccsReference?: {
    tccsId: string;
    code: string;
    version?: string | number;
  };
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
    }[];
  };
  testResults: {
    id: string;
    labName: string;
    testDate: string;
    overallStatus: string;
    isAuthoritative: boolean;
    criteria: CriterionOrigin[];
  }[];
  qualityExplanation: ValueOriginExplanation;
  timestamp: string;
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
  }): BatchDataLineage {
    const { batch, products, tccsList, formulas, testResults } = options;

    const product = products.find((p) => p.id === batch.productId);
    const tccs = tccsList.find((t) => t.id === batch.tccsId);
    const formula = formulas.find((f) => f.productId === batch.productId);
    const relatedTests = testResults.filter((tr) => tr.batchId === batch.id);

    const authoritative = CanonicalStatusResolver.selectAuthoritativeResult(batch, relatedTests);
    const qualityRes = CanonicalStatusResolver.resolveBatchQuality(batch, relatedTests, tccs);

    // Giải trình nguồn gốc giá trị chất lượng (Value Origin Explanation)
    const qualityExplanation: ValueOriginExplanation = {
      field: 'qualityStatus',
      derivedValue: qualityRes.batchQualityStatus,
      sourceType: authoritative ? 'TEST_RESULT' : 'BATCH_LIFECYCLE',
      sourceId: authoritative ? authoritative.id : batch.id,
      sourceDescription: authoritative
        ? `Phiếu kiểm nghiệm ${authoritative.id} (${authoritative.labName || 'Chưa rõ lab'}) ngày ${authoritative.testDate}`
        : 'Chưa có phiếu kiểm nghiệm authoritative liên kết',
      criteriaEvidence: authoritative
        ? {
            totalCriteria: qualityRes.criteriaSummary.total,
            passedCriteria: qualityRes.criteriaSummary.pass,
            failedCriteria: qualityRes.criteriaSummary.fail,
            summary: `${qualityRes.criteriaSummary.pass}/${qualityRes.criteriaSummary.total} chỉ tiêu ĐẠT`,
          }
        : undefined,
      tccsReference: tccs
        ? {
            tccsId: tccs.id,
            code: tccs.code,
          }
        : undefined,
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
              })),
              ...(formula.excipients || []).map((e) => ({
                id: e.materialId,
                name: e.name,
                content: e.declaredContent,
                unit: e.unit,
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
        })),
      })),
      qualityExplanation,
      timestamp: new Date().toISOString(),
    };
  }
}
