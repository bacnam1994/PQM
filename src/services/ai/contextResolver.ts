/**
 * contextResolver.ts
 * AI Context Resolver — Giải quyết ngữ cảnh thông minh và siêu nhẹ cho Trợ lý AI (Phase 8)
 *
 * Thay vì gửi toàn bộ Store hàng chục MB vào System Prompt, Context Resolver:
 * 1. Phân tích thực thể người dùng đang nhắc tới (Số lô, Mã/Tên sản phẩm, Chỉ tiêu, Cảnh báo).
 * 2. Giải quyết quan hệ: Batch -> Product -> Active TCCS -> Authoritative TestResult.
 * 3. Chỉ đính kèm dữ liệu tối giản cần thiết vào ngữ cảnh, giảm 90%+ kích thước prompt và token.
 */

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
    passedItemsCount?: number;
    totalItemsCount?: number;
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

    // Lấy test result mới nhất / chính thống của lô này
    const batchTestResults = testResults.filter((tr) => tr.batchId === matchedBatch.id);
    const latestTest =
      batchTestResults.sort(
        (a, b) =>
          new Date(b.testDate || b.createdAt || 0).getTime() -
          new Date(a.testDate || a.createdAt || 0).getTime()
      )[0] || null;

    const alerts = qualityAlerts.filter(
      (a) =>
        (a.batchId && a.batchId === matchedBatch.id) ||
        (a.batchNo &&
          String(a.batchNo).toLowerCase() === String(matchedBatch.batchNo).toLowerCase())
    );

    return {
      _contextType: 'SPECIFIC_BATCH',
      _summary: `Ngữ cảnh mục tiêu: Lô ${matchedBatch.batchNo} của sản phẩm ${product?.name || 'N/A'}.`,
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
      testResult: latestTest
        ? {
            id: latestTest.id,
            labName: latestTest.labName,
            reportNo: latestTest.reportNo,
            testDate: latestTest.testDate,
            overallStatus: latestTest.overallStatus,
            passedItemsCount: Array.isArray(latestTest.testResults)
              ? latestTest.testResults.filter((r: any) => r.status === 'PASSED').length
              : undefined,
            totalItemsCount: Array.isArray(latestTest.testResults)
              ? latestTest.testResults.length
              : undefined,
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
