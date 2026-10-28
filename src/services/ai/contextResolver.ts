/**
 * contextResolver.ts
 * AI Context Resolver — Giải quyết ngữ cảnh thông minh và siêu nhẹ cho Trợ lý AI (Phase 8)
 *
 * Thay vì gửi toàn bộ Store hàng chục MB vào System Prompt, Context Resolver:
 * 1. Phân tích thực thể người dùng đang nhắc tới (Số lô, Mã/Tên sản phẩm, Chỉ tiêu, Cảnh báo).
 * 2. Giải quyết quan hệ: Batch -> Product -> Active TCCS -> Authoritative TestResult.
 * 3. Chỉ đính kèm dữ liệu tối giản cần thiết vào ngữ cảnh, giảm 90%+ kích thước prompt và token.
 */

import {
  resolveFinalTestResultForBatch,
  normalizeTestResultStatus,
} from '../../domain/test-result/testResultStatusResolver';

export interface LeanResolvedContext {
  _contextType: 'SPECIFIC_BATCH' | 'SPECIFIC_PRODUCT' | 'GENERAL_OVERVIEW';
  _summary: string;
  batch?: {
    id: string;
    batchNo: string;
    productName?: string;
    productCode?: string;
    status: string;
    mfgDate?: string;
    expDate?: string;
    actualYield?: number;
    yieldUnit?: string;
  };
  product?: {
    id: string;
    code: string;
    name: string;
    dosageForm?: string;
    status: string;
  };
  tccs?: {
    code: string;
    issueDate?: string;
    isActive: boolean;
    mainQualityCriteriaCount?: number;
    safetyCriteriaCount?: number;
  };
  testResult?: {
    id: string;
    labName?: string;
    reportNo?: string;
    testDate?: string;
    overallStatus?: string;
    canonicalStatus?: string;
    confidence?: string;
    isConsolidated?: boolean;
    candidateCount?: number;
    passedItemsCount?: number;
    totalItemsCount?: number;
    sampleResults?: Array<{ criteriaName?: string; status?: string; value?: any }>;
  };
  recentBatches?: Array<{ batchNo: string; status: string; mfgDate?: string }>;
  formula?: {
    batchSize?: number;
    batchUnit?: string;
    materialCount?: number;
  };
  relevantAlerts?: Array<{ id: string; title: string; severity: string; type?: string }>;
  systemOverview?: {
    totalProducts: number;
    totalBatches: number;
    totalTestResults: number;
  };
}

export function resolveLeanContext(
  message: string,
  data: {
    products?: any[];
    batches?: any[];
    tccsList?: any[];
    testResults?: any[];
    productFormulas?: any[];
    rawMaterials?: any[];
    qualityAlerts?: any[];
  }
): LeanResolvedContext {
  const msgLower = (message || '').toLowerCase();
  const products = data.products || [];
  const batches = data.batches || [];
  const tccsList = data.tccsList || [];
  const testResults = data.testResults || [];
  const qualityAlerts = data.qualityAlerts || [];

  // 1. Nhận diện Số Lô trong tin nhắn (Ví dụ: "lô 362605", "362605", "lo 292605")
  let matchedBatch = batches.find(
    (b) => b?.batchNo && msgLower.includes(String(b.batchNo).toLowerCase())
  );

  // Thử regex tìm các mã lô dạng số liền nhau
  if (!matchedBatch) {
    const batchMatches = msgLower.match(/\b\d{4,8}\b/g);
    if (batchMatches && batchMatches.length > 0) {
      for (const m of batchMatches) {
        const found = batches.find(
          (b) => b?.batchNo && String(b.batchNo).toLowerCase().includes(m)
        );
        if (found) {
          matchedBatch = found;
          break;
        }
      }
    }
  }

  // TRƯỜNG HỢP 1: TÌM THẤY SỐ LÔ CỤ THỂ
  if (matchedBatch) {
    const product = products.find((p) => p.id === matchedBatch.productId);
    const activeTccs =
      tccsList.find((t) => t.productId === matchedBatch.productId && t.isActive) ||
      tccsList.find((t) => t.productId === matchedBatch.productId);

    // Phân giải kết quả kiểm nghiệm thẩm quyền theo Canonical Domain Resolver (Phase 4 Hardening)
    // Tuyệt đối không tự chọn testResult chỉ bằng latest testDate hoặc tự đoán PASS/FAIL
    const resolution = resolveFinalTestResultForBatch(matchedBatch, testResults, activeTccs);
    const authoritativeTest = resolution.finalTestResult || null;
    const canonicalStatus = resolution.status;

    const alerts = qualityAlerts.filter(
      (a) =>
        (a.batchId && a.batchId === matchedBatch.id) ||
        (a.batchNo &&
          String(a.batchNo).toLowerCase() === String(matchedBatch.batchNo).toLowerCase())
    );

    return {
      _contextType: 'SPECIFIC_BATCH',
      _summary: `Ngữ cảnh mục tiêu: Lô ${matchedBatch.batchNo} của sản phẩm ${product?.name || 'N/A'}. Trạng thái kiểm nghiệm thẩm quyền: ${canonicalStatus}.`,
      batch: {
        id: matchedBatch.id,
        batchNo: matchedBatch.batchNo,
        productName: product?.name,
        productCode: product?.code,
        status: matchedBatch.status,
        mfgDate: matchedBatch.mfgDate,
        expDate: matchedBatch.expDate,
        actualYield: matchedBatch.actualYield,
        yieldUnit: matchedBatch.yieldUnit,
      },
      product: product
        ? {
            id: product.id,
            code: product.code,
            name: product.name,
            dosageForm: product.dosageForm,
            status: product.status,
          }
        : undefined,
      tccs: activeTccs
        ? {
            code: activeTccs.code,
            issueDate: activeTccs.issueDate,
            isActive: activeTccs.isActive,
            mainQualityCriteriaCount: activeTccs.mainQualityCriteria?.length || 0,
            safetyCriteriaCount: activeTccs.safetyCriteria?.length || 0,
          }
        : undefined,
      testResult: authoritativeTest
        ? {
            id: authoritativeTest.id,
            labName: authoritativeTest.labName,
            reportNo: (authoritativeTest as any).reportNo || authoritativeTest.id,
            testDate: authoritativeTest.testDate,
            overallStatus: authoritativeTest.overallStatus || canonicalStatus,
            canonicalStatus,
            confidence: resolution.confidence,
            isConsolidated: resolution.isConsolidated,
            candidateCount: resolution.candidateCount,
            passedItemsCount: Array.isArray(
              (authoritativeTest as any).results || (authoritativeTest as any).testResults
            )
              ? (
                  (authoritativeTest as any).results || (authoritativeTest as any).testResults
                ).filter(
                  (r: any) =>
                    normalizeTestResultStatus(r.status || r.resultStatus || r.isPassed) === 'PASS'
                ).length
              : undefined,
            totalItemsCount: Array.isArray(
              (authoritativeTest as any).results || (authoritativeTest as any).testResults
            )
              ? ((authoritativeTest as any).results || (authoritativeTest as any).testResults)
                  .length
              : undefined,
            sampleResults: (
              ((authoritativeTest as any).results ||
                (authoritativeTest as any).testResults ||
                []) as any[]
            )
              .slice(0, 8)
              .map((r: any) => ({
                criteriaName: r.criteriaName || r.name,
                status: normalizeTestResultStatus(r.status || r.resultStatus || r.isPassed),
                value: r.value,
              })),
          }
        : undefined,
      relevantAlerts: alerts.map((a) => ({
        id: a.id,
        title: a.title || a.message,
        severity: a.severity,
        type: a.type,
      })),
    };
  }

  // TRƯỜNG HỢP 2: TÌM THẤY SẢN PHẨM CỤ THỂ
  const matchedProduct = products.find(
    (p) =>
      (p?.name && msgLower.includes(String(p.name).toLowerCase())) ||
      (p?.code && msgLower.includes(String(p.code).toLowerCase()))
  );

  if (matchedProduct) {
    const productBatches = batches.filter((b) => b.productId === matchedProduct.id).slice(0, 5);
    const activeTccs =
      tccsList.find((t) => t.productId === matchedProduct.id && t.isActive) ||
      tccsList.find((t) => t.productId === matchedProduct.id);

    return {
      _contextType: 'SPECIFIC_PRODUCT',
      _summary: `Ngữ cảnh mục tiêu: Sản phẩm ${matchedProduct.name} (${matchedProduct.code}).`,
      product: {
        id: matchedProduct.id,
        code: matchedProduct.code,
        name: matchedProduct.name,
        dosageForm: matchedProduct.dosageForm,
        status: matchedProduct.status,
      },
      tccs: activeTccs
        ? {
            code: activeTccs.code,
            issueDate: activeTccs.issueDate,
            isActive: activeTccs.isActive,
          }
        : undefined,
      recentBatches: productBatches.map((b) => ({
        batchNo: b.batchNo,
        status: b.status,
        mfgDate: b.mfgDate,
      })),
    };
  }

  // TRƯỜNG HỢP 3: CÂU HỎI TỔNG QUAN HỆ THỐNG
  return {
    _contextType: 'GENERAL_OVERVIEW',
    _summary: 'Ngữ cảnh tổng quan: Không có số lô hoặc sản phẩm cụ thể được nhắc tới.',
    systemOverview: {
      totalProducts: products.length,
      totalBatches: batches.length,
      totalTestResults: testResults.length,
    },
    recentBatches: batches.slice(0, 5).map((b) => ({
      batchNo: b.batchNo,
      status: b.status,
      mfgDate: b.mfgDate,
    })),
    relevantAlerts: qualityAlerts.slice(0, 3).map((a) => ({
      id: a.id,
      title: a.title || a.message,
      severity: a.severity,
      type: a.type,
    })),
  };
}
