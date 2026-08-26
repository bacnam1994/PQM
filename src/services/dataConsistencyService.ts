/**
 * dataConsistencyService.ts
 * =========================
 * Dịch vụ cốt lõi Kiểm soát & Hàn gắn Toàn vẹn Mối liên kết Dữ liệu (Data Consistency & Auto-Healing Engine).
 * 
 * Rà soát toàn bộ 8 thực thể dữ liệu trong hệ thống:
 * 1. Product (Sản phẩm)
 * 2. ProductFormula (Công thức sản phẩm)
 * 3. RawMaterial (Danh mục nguyên liệu)
 * 4. TCCS (Tiêu chuẩn cơ sở)
 * 5. Batch (Lô sản xuất)
 * 6. TestResult (Phiếu kiểm nghiệm)
 * 7. CriteriaAlias (Ánh xạ tên chỉ tiêu)
 * 8. AILearnedMapping (Học máy AI)
 */

import { Product, Batch, TCCS, TestResult, ProductFormula, RawMaterial, CriteriaAlias } from '../types';
import { normalizeName } from './criteriaAliasService';
import { calculateOverallStatus } from '../utils/evaluation';

export type ConsistencyIssueType = 
  | 'ORPHAN_BATCH'
  | 'ORPHAN_TEST_RESULT'
  | 'ORPHAN_TCCS'
  | 'ORPHAN_FORMULA'
  | 'ORPHAN_ALIAS'
  | 'CROSS_PRODUCT_TCCS_MISMATCH'
  | 'MULTIPLE_ACTIVE_TCCS'
  | 'NO_ACTIVE_TCCS'
  | 'TEST_RESULT_STATUS_MISMATCH'
  | 'RELEASED_BATCH_NO_PASSING_TEST'
  | 'REJECTED_BATCH_MISSING_REASON'
  | 'INVALID_DATE_SEQUENCE'
  | 'UNLINKED_FORMULA_MATERIAL'
  | 'FORMULA_ACTIVE_INGREDIENT_MISSING_IN_TCCS'
  | 'FORMULA_TCCS_CONTENT_MISMATCH'
  | 'DUPLICATE_PRODUCT_CODE'
  | 'DUPLICATE_BATCH_NO'
  | 'DUPLICATE_TCCS_CODE';

export type ConsistencyCategory = 
  | 'ORPHAN_RECORDS'
  | 'CROSS_ENTITY_MISMATCH'
  | 'LOGICAL_STATUS_INCONSISTENCY'
  | 'RAW_MATERIAL_LINKAGE'
  | 'FORMULA_TCCS_ALIGNMENT'
  | 'DUPLICATE_IDENTIFIERS';

export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface ConsistencyIssue {
  id: string;
  type: ConsistencyIssueType;
  category: ConsistencyCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  entityType: 'PRODUCT' | 'BATCH' | 'TCCS' | 'FORMULA' | 'RAW_MATERIAL' | 'TEST_RESULT' | 'ALIAS';
  entityId: string;
  entityName?: string;
  relatedEntityId?: string;
  relatedEntityName?: string;
  suggestedAction: string;
  autoHealable: boolean;
  autoHealAction?: 'LINK_MATERIAL' | 'FIX_TEST_STATUS' | 'FIX_ACTIVE_TCCS' | 'CLEAN_ORPHAN_ALIAS';
  healPayload?: any;
}

export interface ConsistencyReport {
  overallScore: number; // 0 - 100
  grade: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
  totalEntitiesScanned: number;
  totalIssuesCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  autoHealableCount: number;
  categoryBreakdown: {
    orphanRecords: number;
    crossEntityMismatch: number;
    logicalStatusInconsistency: number;
    rawMaterialLinkage: number;
    formulaTccsAlignment: number;
    duplicateIdentifiers: number;
  };
  issues: ConsistencyIssue[];
  scannedAt: string;
}

export interface SystemDataSnapshot {
  products: Product[];
  batches: Batch[];
  tccsList: TCCS[];
  productFormulas: ProductFormula[];
  rawMaterials: RawMaterial[];
  testResults: TestResult[];
  criteriaAliases?: CriteriaAlias[];
}

/**
 * Kiểm tra chuỗi ngày tháng ISO có hợp lệ và so sánh trước sau
 */
export const compareDates = (dateA?: string, dateB?: string): number | null => {
  if (!dateA || !dateB) return null;
  const da = new Date(dateA).getTime();
  const db = new Date(dateB).getTime();
  if (isNaN(da) || isNaN(db)) return null;
  return da - db;
};

/**
 * Rà soát toàn diện tính liên kết và nhất quán dữ liệu của toàn bộ hệ thống
 */
export const auditDataConsistency = (data: SystemDataSnapshot): ConsistencyReport => {
  const issues: ConsistencyIssue[] = [];
  const products = data.products || [];
  const batches = data.batches || [];
  const tccsList = data.tccsList || [];
  const productFormulas = data.productFormulas || [];
  const rawMaterials = data.rawMaterials || [];
  const testResults = data.testResults || [];
  const criteriaAliases = data.criteriaAliases || [];

  // Tạo các Map tra cứu O(1)
  const productMap = new Map(products.map(p => [p.id, p]));
  const tccsMap = new Map(tccsList.map(t => [t.id, t]));
  const batchMap = new Map(batches.map(b => [b.id, b]));
  const materialMap = new Map(rawMaterials.map(m => [m.id, m]));
  const materialNameMap = new Map<string, RawMaterial>();

  rawMaterials.forEach(m => {
    if (m.name) materialNameMap.set(normalizeName(m.name), m);
    if (Array.isArray(m.aliases)) {
      m.aliases.forEach(alias => {
        if (alias) materialNameMap.set(normalizeName(alias), m);
      });
    }
  });

  // Gom nhóm dữ liệu theo Product ID
  const tccsByProduct = new Map<string, TCCS[]>();
  tccsList.forEach(t => {
    const list = tccsByProduct.get(t.productId) || [];
    list.push(t);
    tccsByProduct.set(t.productId, list);
  });

  const formulasByProduct = new Map<string, ProductFormula[]>();
  productFormulas.forEach(f => {
    const list = formulasByProduct.get(f.productId) || [];
    list.push(f);
    formulasByProduct.set(f.productId, list);
  });

  const batchesByProduct = new Map<string, Batch[]>();
  batches.forEach(b => {
    const list = batchesByProduct.get(b.productId) || [];
    list.push(b);
    batchesByProduct.set(b.productId, list);
  });

  const testResultsByBatch = new Map<string, TestResult[]>();
  testResults.forEach(r => {
    const list = testResultsByBatch.get(r.batchId) || [];
    list.push(r);
    testResultsByBatch.set(r.batchId, list);
  });

  // =========================================================================
  // 1. KIỂM TRA BẢN GHI MỒ CÔI (ORPHAN RECORDS)
  // =========================================================================

  // 1.1 Lô hàng không có Sản phẩm tương ứng
  batches.forEach(b => {
    if (!productMap.has(b.productId)) {
      issues.push({
        id: `orphan_batch_${b.id}`,
        type: 'ORPHAN_BATCH',
        category: 'ORPHAN_RECORDS',
        severity: 'CRITICAL',
        title: `Lô hàng mồ côi: ${b.batchNo}`,
        description: `Lô hàng "${b.batchNo}" tham chiếu đến Product ID "${b.productId}" không tồn tại trong danh mục Sản phẩm.`,
        entityType: 'BATCH',
        entityId: b.id,
        entityName: b.batchNo,
        suggestedAction: 'Gán lại Lô hàng cho Sản phẩm tương ứng hoặc xóa lô nếu dữ liệu rác.',
        autoHealable: false,
      });
    }
  });

  // 1.2 Phiếu kiểm nghiệm không có Lô tương ứng
  testResults.forEach(r => {
    if (!batchMap.has(r.batchId)) {
      issues.push({
        id: `orphan_test_${r.id}`,
        type: 'ORPHAN_TEST_RESULT',
        category: 'ORPHAN_RECORDS',
        severity: 'CRITICAL',
        title: `Phiếu kiểm nghiệm mồ côi: ${r.id}`,
        description: `Phiếu kiểm nghiệm ngày ${r.testDate || 'N/A'} (Lab: ${r.labName}) tham chiếu đến Batch ID "${r.batchId}" không tồn tại.`,
        entityType: 'TEST_RESULT',
        entityId: r.id,
        entityName: `${r.labName} (${r.testDate})`,
        suggestedAction: 'Xác minh số lô của phiếu kiểm nghiệm hoặc dọn dẹp bản ghi không còn hợp lệ.',
        autoHealable: false,
      });
    }
  });

  // 1.3 TCCS không có Sản phẩm tương ứng
  tccsList.forEach(t => {
    if (!productMap.has(t.productId)) {
      issues.push({
        id: `orphan_tccs_${t.id}`,
        type: 'ORPHAN_TCCS',
        category: 'ORPHAN_RECORDS',
        severity: 'CRITICAL',
        title: `TCCS mồ côi: ${t.code}`,
        description: `TCCS mã "${t.code}" tham chiếu đến Product ID "${t.productId}" không tồn tại trong hệ thống.`,
        entityType: 'TCCS',
        entityId: t.id,
        entityName: t.code,
        suggestedAction: 'Gán TCCS này vào sản phẩm thích hợp hoặc xóa nếu là bản thảo cũ.',
        autoHealable: false,
      });
    }
  });

  // 1.4 Công thức không có Sản phẩm tương ứng
  productFormulas.forEach(f => {
    if (!productMap.has(f.productId)) {
      issues.push({
        id: `orphan_formula_${f.id}`,
        type: 'ORPHAN_FORMULA',
        category: 'ORPHAN_RECORDS',
        severity: 'CRITICAL',
        title: `Công thức mồ côi: ${f.id}`,
        description: `Công thức sản phẩm tham chiếu đến Product ID "${f.productId}" không tồn tại.`,
        entityType: 'FORMULA',
        entityId: f.id,
        entityName: f.id,
        suggestedAction: 'Gán công thức cho sản phẩm tương ứng hoặc xóa bỏ.',
        autoHealable: false,
      });
    }
  });

  // 1.5 Alias không có TCCS tương ứng
  criteriaAliases.forEach(a => {
    if (!tccsMap.has(a.tccsId)) {
      issues.push({
        id: `orphan_alias_${a.id}`,
        type: 'ORPHAN_ALIAS',
        category: 'ORPHAN_RECORDS',
        severity: 'WARNING',
        title: `Criteria Alias mồ côi: "${a.canonicalName}"`,
        description: `Bản ghi alias cho chỉ tiêu "${a.canonicalName}" gắn với TCCS ID "${a.tccsId}" đã bị xóa.`,
        entityType: 'ALIAS',
        entityId: a.id,
        entityName: a.canonicalName,
        suggestedAction: 'Dọn dẹp alias mồ côi để tránh rác cơ sở dữ liệu.',
        autoHealable: true,
        autoHealAction: 'CLEAN_ORPHAN_ALIAS',
        healPayload: { aliasId: a.id },
      });
    }
  });

  // =========================================================================
  // 2. SAI LỆCH LIÊN KẾT CHÉO (CROSS-ENTITY MISMATCHES)
  // =========================================================================

  // 2.1 Lô hàng gắn TCCS của một Sản phẩm KHÁC
  batches.forEach(b => {
    if (b.tccsId && tccsMap.has(b.tccsId)) {
      const boundTccs = tccsMap.get(b.tccsId)!;
      if (boundTccs.productId !== b.productId) {
        const prod = productMap.get(b.productId);
        const wrongProd = productMap.get(boundTccs.productId);
        issues.push({
          id: `mismatch_batch_tccs_${b.id}`,
          type: 'CROSS_PRODUCT_TCCS_MISMATCH',
          category: 'CROSS_ENTITY_MISMATCH',
          severity: 'CRITICAL',
          title: `Lô hàng gán sai TCCS sản phẩm khác: ${b.batchNo}`,
          description: `Lô "${b.batchNo}" thuộc sản phẩm "${prod?.name || b.productId}" nhưng đang dùng TCCS "${boundTccs.code}" của sản phẩm "${wrongProd?.name || boundTccs.productId}".`,
          entityType: 'BATCH',
          entityId: b.id,
          entityName: b.batchNo,
          relatedEntityId: b.tccsId,
          relatedEntityName: boundTccs.code,
          suggestedAction: 'Chọn lại đúng TCCS thuộc về sản phẩm của lô này.',
          autoHealable: false,
        });
      }
    }
  });

  // 2.2 Kiểm tra trạng thái isActive của TCCS theo từng Sản phẩm
  products.forEach(p => {
    const pTccs = tccsByProduct.get(p.id) || [];
    if (pTccs.length > 0) {
      const activeList = pTccs.filter(t => t.isActive);
      if (activeList.length === 0) {
        // Không có TCCS nào active
        const sorted = [...pTccs].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
        issues.push({
          id: `no_active_tccs_${p.id}`,
          type: 'NO_ACTIVE_TCCS',
          category: 'CROSS_ENTITY_MISMATCH',
          severity: 'WARNING',
          title: `Sản phẩm chưa kích hoạt TCCS: ${p.name}`,
          description: `Sản phẩm "${p.name}" (${p.code}) có ${pTccs.length} phiên bản TCCS nhưng chưa có phiên bản nào được đặt là Hiện hành (isActive = true).`,
          entityType: 'PRODUCT',
          entityId: p.id,
          entityName: p.name,
          suggestedAction: 'Kích hoạt phiên bản TCCS mới nhất làm tiêu chuẩn áp dụng.',
          autoHealable: true,
          autoHealAction: 'FIX_ACTIVE_TCCS',
          healPayload: { productId: p.id, targetTccsId: sorted[0].id },
        });
      } else if (activeList.length > 1) {
        // Có nhiều hơn 1 TCCS active
        const sorted = [...activeList].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
        issues.push({
          id: `multi_active_tccs_${p.id}`,
          type: 'MULTIPLE_ACTIVE_TCCS',
          category: 'CROSS_ENTITY_MISMATCH',
          severity: 'WARNING',
          title: `Trùng lặp TCCS hiện hành: ${p.name}`,
          description: `Sản phẩm "${p.name}" (${p.code}) đang có ${activeList.length} TCCS cùng đặt isActive = true (${activeList.map(t => t.code).join(', ')}).`,
          entityType: 'PRODUCT',
          entityId: p.id,
          entityName: p.name,
          suggestedAction: 'Chỉ giữ 1 TCCS mới nhất làm Hiện hành, chuyển các bản còn lại về Lưu trữ.',
          autoHealable: true,
          autoHealAction: 'FIX_ACTIVE_TCCS',
          healPayload: { productId: p.id, targetTccsId: sorted[0].id },
        });
      }
    }
  });

  // =========================================================================
  // 3. BẤT NHẤT QUÁN TRẠNG THÁI LOGIC (LOGICAL & STATUS INCONSISTENCIES)
  // =========================================================================

  // 3.1 Trạng thái Phiếu kiểm nghiệm không khớp với kết quả đánh giá chỉ tiêu
  testResults.forEach(r => {
    if (r.results && r.results.length > 0) {
      const rawBatch = batchMap.get(r.batchId);
      const boundTccs = rawBatch?.tccsId ? tccsMap.get(rawBatch.tccsId) : undefined;
      const computedStatus = calculateOverallStatus(r.results, boundTccs || null);
      
      if (r.overallStatus !== computedStatus) {
        issues.push({
          id: `status_mismatch_test_${r.id}`,
          type: 'TEST_RESULT_STATUS_MISMATCH',
          category: 'LOGICAL_STATUS_INCONSISTENCY',
          severity: 'CRITICAL',
          title: `Sai lệch Đạt/Không Đạt phiếu kiểm nghiệm: ${r.labName}`,
          description: `Phiếu kiểm nghiệm (Lô: ${rawBatch?.batchNo || r.batchId}) đang lưu là "${r.overallStatus}" nhưng tính toán theo các chỉ tiêu thực tế là "${computedStatus}".`,
          entityType: 'TEST_RESULT',
          entityId: r.id,
          entityName: `${r.labName} - ${rawBatch?.batchNo || ''}`,
          suggestedAction: `Cập nhật lại trạng thái phiếu thành "${computedStatus}".`,
          autoHealable: true,
          autoHealAction: 'FIX_TEST_STATUS',
          healPayload: { testResultId: r.id, correctStatus: computedStatus },
        });
      }
    }
  });

  // 3.2 Lô hàng RELEASED nhưng không có phiếu kiểm nghiệm PASS
  batches.forEach(b => {
    if (b.status === 'RELEASED') {
      const batchTests = testResultsByBatch.get(b.id) || [];
      const hasPassTest = batchTests.some(t => t.overallStatus === 'PASS');
      const hasFailTest = batchTests.some(t => t.overallStatus === 'FAIL');

      if (batchTests.length === 0 || !hasPassTest || hasFailTest) {
        issues.push({
          id: `released_no_pass_${b.id}`,
          type: 'RELEASED_BATCH_NO_PASSING_TEST',
          category: 'LOGICAL_STATUS_INCONSISTENCY',
          severity: 'CRITICAL',
          title: `Lô đã xuất xưởng nhưng thiếu chứng nhận Đạt: ${b.batchNo}`,
          description: batchTests.length === 0
            ? `Lô "${b.batchNo}" ở trạng thái ĐÃ XUẤT XƯỞNG (RELEASED) nhưng chưa có bất kỳ phiếu kiểm nghiệm nào.`
            : hasFailTest
            ? `Lô "${b.batchNo}" ở trạng thái ĐÃ XUẤT XƯỞNG (RELEASED) nhưng có phiếu kiểm nghiệm KHÔNG ĐẠT (FAIL).`
            : `Lô "${b.batchNo}" ở trạng thái ĐÃ XUẤT XƯỞNG (RELEASED) nhưng không có phiếu kiểm nghiệm ĐẠT hợp lệ.`,
          entityType: 'BATCH',
          entityId: b.id,
          entityName: b.batchNo,
          suggestedAction: 'Xem xét lại quyết định duyệt lô hoặc chuyển trạng thái sang ĐANG KIỂM TRA (TESTING).',
          autoHealable: false,
        });
      }
    } else if (b.status === 'REJECTED' && (!b.rejectReason || b.rejectReason.trim() === '')) {
      // 3.3 Lô bị từ chối nhưng thiếu lý do loại
      issues.push({
        id: `rejected_missing_reason_${b.id}`,
        type: 'REJECTED_BATCH_MISSING_REASON',
        category: 'LOGICAL_STATUS_INCONSISTENCY',
        severity: 'WARNING',
        title: `Lô bị loại thiếu lý do từ chối: ${b.batchNo}`,
        description: `Lô "${b.batchNo}" ở trạng thái BỊ LOẠI (REJECTED) nhưng chưa nhập lý do từ chối (rejectReason).`,
        entityType: 'BATCH',
        entityId: b.id,
        entityName: b.batchNo,
        suggestedAction: 'Bổ sung lý do loại lô để phục vụ hồ sơ điều tra OOS và báo cáo chất lượng.',
        autoHealable: false,
      });
    }

    // 3.4 Logic thời gian Lô: expDate <= mfgDate
    if (b.mfgDate && b.expDate) {
      const diff = compareDates(b.mfgDate, b.expDate);
      if (diff !== null && diff >= 0) {
        issues.push({
          id: `invalid_batch_dates_${b.id}`,
          type: 'INVALID_DATE_SEQUENCE',
          category: 'LOGICAL_STATUS_INCONSISTENCY',
          severity: 'CRITICAL',
          title: `Lỗi hạn dùng trước ngày sản xuất: ${b.batchNo}`,
          description: `Lô "${b.batchNo}" có Ngày SX (${b.mfgDate}) muộn hơn hoặc trùng với Hạn dùng (${b.expDate}).`,
          entityType: 'BATCH',
          entityId: b.id,
          entityName: b.batchNo,
          suggestedAction: 'Chỉnh sửa lại Hạn dùng hoặc Ngày sản xuất cho chính xác.',
          autoHealable: false,
        });
      }
    }
  });

  // 3.5 Logic thời gian Phiếu kiểm nghiệm: testDate < mfgDate
  testResults.forEach(r => {
    const rawBatch = batchMap.get(r.batchId);
    if (rawBatch && rawBatch.mfgDate && r.testDate) {
      const diff = compareDates(rawBatch.mfgDate, r.testDate);
      if (diff !== null && diff > 0) {
        issues.push({
          id: `invalid_test_date_${r.id}`,
          type: 'INVALID_DATE_SEQUENCE',
          category: 'LOGICAL_STATUS_INCONSISTENCY',
          severity: 'WARNING',
          title: `Ngày kiểm nghiệm trước ngày sản xuất: ${r.labName}`,
          description: `Phiếu kiểm nghiệm Lô "${rawBatch.batchNo}" có ngày thử nghiệm (${r.testDate}) trước ngày sản xuất của lô (${rawBatch.mfgDate}).`,
          entityType: 'TEST_RESULT',
          entityId: r.id,
          entityName: `${r.labName} (${rawBatch.batchNo})`,
          suggestedAction: 'Kiểm tra lại ngày trên phiếu kiểm nghiệm gốc.',
          autoHealable: false,
        });
      }
    }
  });

  // =========================================================================
  // 4. MẤT LIÊN KẾT NGUYÊN LIỆU <-> CÔNG THỨC (RAW MATERIAL LINKAGE GAPS)
  // =========================================================================

  productFormulas.forEach(f => {
    const prod = productMap.get(f.productId);
    const unlinkedItems: { name: string; isIngredient: boolean; index: number; suggestedMaterialId?: string }[] = [];

    // Kiểm tra hoạt chất
    (f.ingredients || []).forEach((ing, idx) => {
      if (!ing.materialId || !materialMap.has(ing.materialId)) {
        const matchedMat = ing.name ? materialNameMap.get(normalizeName(ing.name)) : undefined;
        unlinkedItems.push({
          name: ing.name,
          isIngredient: true,
          index: idx,
          suggestedMaterialId: matchedMat?.id,
        });
      }
    });

    // Kiểm tra tá dược
    (f.excipients || []).forEach((exc, idx) => {
      if (!exc.materialId || !materialMap.has(exc.materialId)) {
        const matchedMat = exc.name ? materialNameMap.get(normalizeName(exc.name)) : undefined;
        unlinkedItems.push({
          name: exc.name,
          isIngredient: false,
          index: idx,
          suggestedMaterialId: matchedMat?.id,
        });
      }
    });

    if (unlinkedItems.length > 0) {
      const matchableCount = unlinkedItems.filter(u => u.suggestedMaterialId).length;
      issues.push({
        id: `unlinked_material_formula_${f.id}`,
        type: 'UNLINKED_FORMULA_MATERIAL',
        category: 'RAW_MATERIAL_LINKAGE',
        severity: 'WARNING',
        title: `Công thức chưa liên kết Kho nguyên liệu: ${prod?.name || f.id}`,
        description: `Công thức sản phẩm "${prod?.name || f.productId}" có ${unlinkedItems.length} thành phần chưa được gắn mã Nguyên liệu (Trong đó ${matchableCount} thành phần có thể tự động ánh xạ).`,
        entityType: 'FORMULA',
        entityId: f.id,
        entityName: prod?.name || f.id,
        suggestedAction: 'Tự động liên kết các thành phần với Danh mục Nguyên liệu chuẩn.',
        autoHealable: matchableCount > 0,
        autoHealAction: 'LINK_MATERIAL',
        healPayload: { formulaId: f.id, unlinkedItems },
      });
    }
  });

  // =========================================================================
  // 5. ĐỐI SOÁT CÔNG THỨC <-> TCCS (FORMULA <-> TCCS ALIGNMENT)
  // =========================================================================

  products.forEach(p => {
    const pFormulas = formulasByProduct.get(p.id) || [];
    const pTccs = tccsByProduct.get(p.id) || [];
    const activeTccs = pTccs.find(t => t.isActive) || pTccs[0];
    const formula = pFormulas[0];

    if (formula && activeTccs && Array.isArray(formula.ingredients)) {
      const tccsCriteriaNames = [
        ...(activeTccs.mainQualityCriteria || []),
        ...(activeTccs.safetyCriteria || []),
      ].map(c => normalizeName(c.name));

      // Helper trích xuất từ khóa cốt lõi của hoạt chất/chỉ tiêu
      const extractCoreTokens = (str: string): string[] => {
        const stopWords = new Set(['cao', 'chiet', 'xuat', 'tinh', 'chat', 'bot', 'dau', 'dinh', 'luong', 'ham', 'tong', 'so', 'cac', 'chuan', 'hoa', 'extract', 'content', 'total']);
        return normalizeName(str)
          .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g, ' ')
          .split(/\s+/)
          .filter(t => t.length >= 2 && !stopWords.has(t));
      };

      formula.ingredients.forEach(ing => {
        if (ing.name && ing.name.trim()) {
          const normIngName = normalizeName(ing.name);
          const ingTokens = extractCoreTokens(normIngName);
          
          const isPresent = tccsCriteriaNames.some(tcName => {
            if (tcName.includes(normIngName) || normIngName.includes(tcName)) return true;
            const tcTokens = extractCoreTokens(tcName);
            if (ingTokens.length > 0 && tcTokens.length > 0) {
              const commonCount = ingTokens.filter(t => tcTokens.includes(t)).length;
              if (commonCount >= Math.min(2, ingTokens.length)) return true;
              if (ingTokens.length === 1 && tcTokens.includes(ingTokens[0])) return true;
            }
            return false;
          });
          
          if (!isPresent) {
            issues.push({
              id: `missing_criteria_formula_${p.id}_${ing.id || normIngName}`,
              type: 'FORMULA_ACTIVE_INGREDIENT_MISSING_IN_TCCS',
              category: 'FORMULA_TCCS_ALIGNMENT',
              severity: 'WARNING',
              title: `Hoạt chất công thức thiếu trong TCCS: "${ing.name}"`,
              description: `Sản phẩm "${p.name}" có hoạt chất "${ing.name}" trong công thức nhưng chưa có chỉ tiêu kiểm nghiệm tương ứng trong TCCS "${activeTccs.code}".`,
              entityType: 'TCCS',
              entityId: activeTccs.id,
              entityName: activeTccs.code,
              relatedEntityId: p.id,
              relatedEntityName: p.name,
              suggestedAction: 'Bổ sung chỉ tiêu định lượng hoạt chất vào TCCS hoặc cập nhật lại công thức.',
              autoHealable: false,
            });
          }
        }
      });
    }
  });

  // =========================================================================
  // 6. TRÙNG LẶP MÃ ĐỊNH DANH (DUPLICATE UNIQUE IDENTIFIERS)
  // =========================================================================

  // 6.1 Trùng mã sản phẩm
  const productCodeMap = new Map<string, string[]>();
  products.forEach(p => {
    if (p.code) {
      const norm = p.code.trim().toUpperCase();
      const list = productCodeMap.get(norm) || [];
      list.push(p.id);
      productCodeMap.set(norm, list);
    }
  });

  productCodeMap.forEach((ids, code) => {
    if (ids.length > 1) {
      issues.push({
        id: `dup_product_code_${code}`,
        type: 'DUPLICATE_PRODUCT_CODE',
        category: 'DUPLICATE_IDENTIFIERS',
        severity: 'CRITICAL',
        title: `Trùng lặp Mã sản phẩm: ${code}`,
        description: `Có ${ids.length} sản phẩm cùng sử dụng mã "${code}". Mã sản phẩm phải là duy nhất.`,
        entityType: 'PRODUCT',
        entityId: ids[0],
        entityName: code,
        suggestedAction: 'Đổi mã cho các sản phẩm bị trùng để tránh nhầm lẫn dữ liệu.',
        autoHealable: false,
      });
    }
  });

  // 6.2 Trùng số lô trong cùng 1 sản phẩm
  batchesByProduct.forEach((pBatches, prodId) => {
    const batchNoMap = new Map<string, string[]>();
    pBatches.forEach(b => {
      if (b.batchNo) {
        const norm = b.batchNo.trim().toUpperCase();
        const list = batchNoMap.get(norm) || [];
        list.push(b.id);
        batchNoMap.set(norm, list);
      }
    });

    batchNoMap.forEach((bIds, bNo) => {
      if (bIds.length > 1) {
        const prod = productMap.get(prodId);
        issues.push({
          id: `dup_batch_no_${prodId}_${bNo}`,
          type: 'DUPLICATE_BATCH_NO',
          category: 'DUPLICATE_IDENTIFIERS',
          severity: 'CRITICAL',
          title: `Trùng số lô cho cùng sản phẩm: ${bNo}`,
          description: `Sản phẩm "${prod?.name || prodId}" có ${bIds.length} bản ghi lô trùng số lô "${bNo}".`,
          entityType: 'BATCH',
          entityId: bIds[0],
          entityName: bNo,
          suggestedAction: 'Hợp nhất các bản ghi hoặc chỉnh sửa số lô bị trùng.',
          autoHealable: false,
        });
      }
    });
  });

  // =========================================================================
  // TỔNG HỢP VÀ TÍNH ĐIỂM SỨC KHỎE DỮ LIỆU
  // =========================================================================

  const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
  const warningCount = issues.filter(i => i.severity === 'WARNING').length;
  const infoCount = issues.filter(i => i.severity === 'INFO').length;
  const autoHealableCount = issues.filter(i => i.autoHealable).length;

  const totalEntitiesScanned = products.length + batches.length + tccsList.length + productFormulas.length + rawMaterials.length + testResults.length + criteriaAliases.length;

  // Điểm sức khỏe = 100 - (critical * 12) - (warning * 3) - (info * 1)
  const penalty = (criticalCount * 12) + (warningCount * 3) + (infoCount * 1);
  const overallScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  let grade: ConsistencyReport['grade'] = 'EXCELLENT';
  if (overallScore >= 90 && criticalCount === 0) grade = 'EXCELLENT';
  else if (overallScore >= 75 && criticalCount === 0) grade = 'GOOD';
  else if (overallScore >= 50) grade = 'WARNING';
  else grade = 'CRITICAL';

  return {
    overallScore,
    grade,
    totalEntitiesScanned,
    totalIssuesCount: issues.length,
    criticalCount,
    warningCount,
    infoCount,
    autoHealableCount,
    categoryBreakdown: {
      orphanRecords: issues.filter(i => i.category === 'ORPHAN_RECORDS').length,
      crossEntityMismatch: issues.filter(i => i.category === 'CROSS_ENTITY_MISMATCH').length,
      logicalStatusInconsistency: issues.filter(i => i.category === 'LOGICAL_STATUS_INCONSISTENCY').length,
      rawMaterialLinkage: issues.filter(i => i.category === 'RAW_MATERIAL_LINKAGE').length,
      formulaTccsAlignment: issues.filter(i => i.category === 'FORMULA_TCCS_ALIGNMENT').length,
      duplicateIdentifiers: issues.filter(i => i.category === 'DUPLICATE_IDENTIFIERS').length,
    },
    issues,
    scannedAt: new Date().toISOString(),
  };
};

/**
 * Tạo payload sửa chữa tự động cho các vấn đề có thể Auto-Heal
 */
export const generateAutoHealPlan = (report: ConsistencyReport, data: SystemDataSnapshot) => {
  const formulaUpdates: Record<string, ProductFormula> = {};
  const testResultStatusUpdates: Record<string, 'PASS' | 'FAIL'> = {};
  const tccsActiveUpdates: Record<string, { tccsId: string; isActive: boolean }[]> = {};
  const orphanAliasIdsToDelete: string[] = [];

  const rawMaterials = data.rawMaterials || [];
  const materialNameMap = new Map<string, RawMaterial>();
  rawMaterials.forEach(m => {
    if (m.name) materialNameMap.set(normalizeName(m.name), m);
    if (Array.isArray(m.aliases)) {
      m.aliases.forEach(a => { if (a) materialNameMap.set(normalizeName(a), m); });
    }
  });

  const healableIssues = report.issues.filter(i => i.autoHealable);

  healableIssues.forEach(issue => {
    if (issue.autoHealAction === 'LINK_MATERIAL' && issue.healPayload) {
      const { formulaId } = issue.healPayload;
      const formula = data.productFormulas.find(f => f.id === formulaId);
      if (formula) {
        const updated = formulaUpdates[formulaId] || JSON.parse(JSON.stringify(formula));
        
        // Link ingredients
        if (Array.isArray(updated.ingredients)) {
          updated.ingredients.forEach((ing: any) => {
            if (!ing.materialId && ing.name) {
              const matched = materialNameMap.get(normalizeName(ing.name));
              if (matched) ing.materialId = matched.id;
            }
          });
        }
        // Link excipients
        if (Array.isArray(updated.excipients)) {
          updated.excipients.forEach((exc: any) => {
            if (!exc.materialId && exc.name) {
              const matched = materialNameMap.get(normalizeName(exc.name));
              if (matched) exc.materialId = matched.id;
            }
          });
        }
        updated.updatedAt = new Date().toISOString();
        formulaUpdates[formulaId] = updated;
      }
    } else if (issue.autoHealAction === 'FIX_TEST_STATUS' && issue.healPayload) {
      const { testResultId, correctStatus } = issue.healPayload;
      testResultStatusUpdates[testResultId] = correctStatus;
    } else if (issue.autoHealAction === 'FIX_ACTIVE_TCCS' && issue.healPayload) {
      const { productId, targetTccsId } = issue.healPayload;
      const pTccs = data.tccsList.filter(t => t.productId === productId);
      const updates = pTccs.map(t => ({
        tccsId: t.id,
        isActive: t.id === targetTccsId,
      }));
      tccsActiveUpdates[productId] = updates;
    } else if (issue.autoHealAction === 'CLEAN_ORPHAN_ALIAS' && issue.healPayload) {
      orphanAliasIdsToDelete.push(issue.healPayload.aliasId);
    }
  });

  return {
    formulaUpdates,
    testResultStatusUpdates,
    tccsActiveUpdates,
    orphanAliasIdsToDelete,
    totalActionsCount: Object.keys(formulaUpdates).length + Object.keys(testResultStatusUpdates).length + Object.keys(tccsActiveUpdates).length + orphanAliasIdsToDelete.length,
  };
};
