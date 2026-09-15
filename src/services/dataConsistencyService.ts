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

import {
  Product,
  Batch,
  TCCS,
  TestResult,
  ProductFormula,
  RawMaterial,
  CriteriaAlias,
  TestingLaboratory,
} from '../types';
import { normalizeName } from './criteriaAliasService';
import { calculateOverallStatus } from '../utils/evaluation';
import { matchLaboratory, DEFAULT_TESTING_LABORATORIES } from './laboratoryService';
import {
  buildTestResultIndex,
  resolveTestResultsForBatch,
  TestResultIndexSnapshot,
} from '../domain/batch/batchTestResultResolver';
import {
  evaluateBatchReleaseIntegrity,
  isValidTestResultForBatch,
  DataFreshnessState,
} from '../domain/batch/batchIntegrityValidator';
import {
  detectTestResultStatusMismatch,
  resolveTestResultStatus,
  normalizeTestResultStatus,
} from '../domain/test-result/testResultStatusResolver';

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
  | 'STATUS_MISMATCH'
  | 'RELEASED_BATCH_NO_PASSING_TEST'
  | 'MISSING_TEST_RESULT'
  | 'CRITERIA_FAIL'
  | 'TEST_RESULT_RELATIONSHIP_INVALID'
  | 'INVALID_LINK'
  | 'REJECTED_BATCH_MISSING_REASON'
  | 'INVALID_DATE_SEQUENCE'
  | 'UNLINKED_FORMULA_MATERIAL'
  | 'FORMULA_ACTIVE_INGREDIENT_MISSING_IN_TCCS'
  | 'FORMULA_TCCS_CONTENT_MISMATCH'
  | 'DUPLICATE_PRODUCT_CODE'
  | 'DUPLICATE_BATCH_NO'
  | 'DUPLICATE_TCCS_CODE'
  | 'UNNORMALIZED_TEST_LAB';

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
  code?:
    | 'MISSING_TEST_RESULT'
    | 'STATUS_MISMATCH'
    | 'CRITERIA_FAIL'
    | 'INVALID_LINK'
    | ConsistencyIssueType;
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
  autoHealAction?:
    | 'LINK_MATERIAL'
    | 'FIX_TEST_STATUS'
    | 'FIX_TEST_RELATIONSHIP'
    | 'FIX_ACTIVE_TCCS'
    | 'CLEAN_ORPHAN_ALIAS'
    | 'NORMALIZE_TEST_LAB';
  healPayload?: any;
  expected?: string;
  actual?: string;
  reason?: string;
  source?: string;
  diagnostics?: {
    batchId?: string;
    testResultId?: string;
    storedStatus?: string;
    calculatedStatus?: string;
    criteriaSummary?: string;
    failedCriteriaCount?: number;
    totalCriteriaCount?: number;
    [key: string]: any;
  };
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
  testingLaboratories?: TestingLaboratory[];
  dataFreshness?: DataFreshnessState;
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
  const productMap = new Map(products.map((p) => [p.id, p]));
  const tccsMap = new Map(tccsList.map((t) => [t.id, t]));
  const batchMap = new Map(batches.map((b) => [b.id, b]));
  const batchNoMap = new Map(batches.map((b) => [b.batchNo, b]));
  const materialMap = new Map(rawMaterials.map((m) => [m.id, m]));
  const materialNameMap = new Map<string, RawMaterial>();

  // Xây dựng Snapshot Index O(1) chuẩn hóa quan hệ giữa Batches và TestResults
  const testResultIndex = buildTestResultIndex(testResults, batches);

  // Hàm tra cứu Lô linh hoạt cho tương thích ngược
  const getBatchForTestResult = (batchId: string): Batch | undefined => {
    if (!batchId) return undefined;
    if (batchMap.has(batchId)) return batchMap.get(batchId);
    if (batchNoMap.has(batchId)) return batchNoMap.get(batchId);
    return batches.find(
      (b) =>
        (b.id && batchId.endsWith(b.id)) ||
        (batchId && b.id.endsWith(batchId)) ||
        (b.batchNo && b.batchNo.toLowerCase() === batchId.toLowerCase())
    );
  };

  rawMaterials.forEach((m) => {
    if (m.name) materialNameMap.set(normalizeName(m.name), m);
    if (Array.isArray(m.aliases)) {
      m.aliases.forEach((alias) => {
        if (alias) materialNameMap.set(normalizeName(alias), m);
      });
    }
  });

  // Gom nhóm dữ liệu theo Product ID
  const tccsByProduct = new Map<string, TCCS[]>();
  tccsList.forEach((t) => {
    const list = tccsByProduct.get(t.productId) || [];
    list.push(t);
    tccsByProduct.set(t.productId, list);
  });

  const formulasByProduct = new Map<string, ProductFormula[]>();
  productFormulas.forEach((f) => {
    const list = formulasByProduct.get(f.productId) || [];
    list.push(f);
    formulasByProduct.set(f.productId, list);
  });

  const batchesByProduct = new Map<string, Batch[]>();
  batches.forEach((b) => {
    const list = batchesByProduct.get(b.productId) || [];
    list.push(b);
    batchesByProduct.set(b.productId, list);
  });

  // =========================================================================
  // 1. KIỂM TRA BẢN GHI MỒ CÔI (ORPHAN RECORDS)
  // =========================================================================

  // 1.1 Lô hàng không có Sản phẩm tương ứng
  batches.forEach((b) => {
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

  // 1.2 Phiếu kiểm nghiệm không có Lô tương ứng (thực sự mồ côi, không khớp cả ID lẫn Số lô)
  testResultIndex.orphanResults.forEach((r) => {
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
      suggestedAction:
        'Xác minh số lô của phiếu kiểm nghiệm hoặc dọn dẹp bản ghi không còn hợp lệ.',
      autoHealable: false,
    });
  });

  // 1.3 TCCS không có Sản phẩm tương ứng
  tccsList.forEach((t) => {
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
  productFormulas.forEach((f) => {
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
  criteriaAliases.forEach((a) => {
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
  batches.forEach((b) => {
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
  products.forEach((p) => {
    const pTccs = tccsByProduct.get(p.id) || [];
    if (pTccs.length > 0) {
      const activeList = pTccs.filter((t) => t.isActive);
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
          description: `Sản phẩm "${p.name}" (${p.code}) đang có ${activeList.length} TCCS cùng đặt isActive = true (${activeList.map((t) => t.code).join(', ')}).`,
          entityType: 'PRODUCT',
          entityId: p.id,
          entityName: p.name,
          suggestedAction:
            'Chỉ giữ 1 TCCS mới nhất làm Hiện hành, chuyển các bản còn lại về Lưu trữ.',
          autoHealable: true,
          autoHealAction: 'FIX_ACTIVE_TCCS',
          healPayload: { productId: p.id, targetTccsId: sorted[0].id },
        });
      }
    }
  });

  // 2.3 Kiểm tra liên kết Phiếu kiểm nghiệm <-> Lô sản xuất sai khóa kỹ thuật (Legacy batchNo hoặc sai ID)
  testResultIndex.invalidLinkResults.forEach((item) => {
    if (item.relationshipType === 'LEGACY_BATCH_NO' && item.matchedBatchId) {
      const b = batchMap.get(item.matchedBatchId);
      issues.push({
        id: `invalid_link_test_${item.testResult.id}`,
        type: 'TEST_RESULT_RELATIONSHIP_INVALID',
        code: 'INVALID_LINK',
        category: 'CROSS_ENTITY_MISMATCH',
        severity: 'WARNING',
        title: `Phiếu kiểm nghiệm liên kết sai khóa: ${item.testResult.labName}`,
        description:
          item.mismatchReason ||
          `Phiếu kiểm nghiệm dùng số lô "${item.testResult.batchId}" thay vì ID kỹ thuật của Lô "${b?.batchNo || item.matchedBatchId}".`,
        entityType: 'TEST_RESULT',
        entityId: item.testResult.id,
        entityName: `${item.testResult.labName} (${item.testResult.testDate || 'N/A'})`,
        relatedEntityId: item.matchedBatchId,
        relatedEntityName: b?.batchNo,
        expected: `batchId = "${item.matchedBatchId}"`,
        actual: `batchId = "${item.testResult.batchId}"`,
        reason: 'INVALID_LINK',
        source: 'BatchTestResultResolver',
        suggestedAction:
          'Cập nhật khóa liên kết kỹ thuật (batchId = batch.id) cho phiếu kiểm nghiệm để đảm bảo tính toàn vẹn dữ liệu.',
        autoHealable: true,
        autoHealAction: 'FIX_TEST_RELATIONSHIP',
        healPayload: {
          batchId: item.matchedBatchId,
          testResultIds: [item.testResult.id],
        },
      });
    }
  });

  // =========================================================================
  // 3. BẤT NHẤT QUÁN TRẠNG THÁI LOGIC (LOGICAL & STATUS INCONSISTENCIES)
  // =========================================================================

  // 3.1 Trạng thái Phiếu kiểm nghiệm không khớp với kết quả đánh giá chỉ tiêu
  // Sử dụng Canonical Mismatch Detector (Data Freshness Aware + Normalization + Multi-Test Context)
  testResults.forEach((r) => {
    if (r.results && r.results.length > 0) {
      // Bỏ qua phiếu bị xóa mềm hoặc đã hủy
      if ((r as any).isDeleted || (r as any).deleted) return;
      const statusUpper = String((r as any).status || '').toUpperCase();
      if (statusUpper === 'CANCELLED' || statusUpper === 'VOIDED' || statusUpper === 'INVALID')
        return;

      const match = testResultIndex.getBatchForTestResult(r);
      // Bỏ qua phiếu mồ côi hoặc sai liên kết (đã được phân loại riêng thành ORPHAN_TEST_RESULT / INVALID_LINK)
      if (
        match.relationshipType === 'INVALID_ORPHAN' ||
        match.relationshipType === 'INVALID_EMPTY_BATCH_ID' ||
        match.relationshipType === 'LEGACY_BATCH_NO'
      ) {
        return;
      }

      const rawBatch = match.batch;
      const boundTccs = rawBatch?.tccsId ? tccsMap.get(rawBatch.tccsId) : undefined;
      const batchCandidateResults = rawBatch
        ? [
            ...(testResultIndex.primaryMap.get(rawBatch.id) || []),
            ...(testResultIndex.legacyMap.get(rawBatch.id) || []),
          ]
        : undefined;

      const mismatch = detectTestResultStatusMismatch({
        testResult: r,
        batch: rawBatch,
        boundTccs: boundTccs || null,
        allTestResultsForBatch: batchCandidateResults,
        dataFreshness: data.dataFreshness,
      });

      if (mismatch.shouldAlert && mismatch.hasMismatch) {
        issues.push({
          id: `status_mismatch_test_${r.id}`,
          type: 'TEST_RESULT_STATUS_MISMATCH',
          code: 'STATUS_MISMATCH',
          category: 'LOGICAL_STATUS_INCONSISTENCY',
          severity: mismatch.alertType || 'CRITICAL',
          title: `Sai lệch Đạt/Không Đạt phiếu kiểm nghiệm: ${r.labName}`,
          description: `Phiếu kiểm nghiệm (Lô: ${rawBatch?.batchNo || r.batchId}) đang lưu là "${mismatch.actualStatus}" nhưng tính toán theo các chỉ tiêu thực tế là "${mismatch.expectedStatus}".`,
          entityType: 'TEST_RESULT',
          entityId: r.id,
          entityName: `${r.labName} - ${rawBatch?.batchNo || ''}`,
          expected: mismatch.expectedStatus,
          actual: mismatch.actualStatus,
          reason: mismatch.reason,
          source: mismatch.source || 'TestResult',
          diagnostics: {
            batchId: rawBatch?.id || r.batchId,
            testResultId: r.id,
            storedStatus: mismatch.actualStatus,
            calculatedStatus: mismatch.expectedStatus,
            criteriaSummary: mismatch.diagnosticDetails?.criteriaSummary,
            failedCriteriaCount: mismatch.diagnosticDetails?.failedCriteriaCount,
            totalCriteriaCount: mismatch.diagnosticDetails?.totalCriteriaCount,
          },
          suggestedAction:
            mismatch.suggestedAction ||
            `Cập nhật lại trạng thái phiếu thành "${mismatch.expectedStatus}".`,
          autoHealable: mismatch.isAutoHealable,
          autoHealAction: 'FIX_TEST_STATUS',
          healPayload: mismatch.autoHealPayload,
        });
      }
    }
  });

  // 3.2 Lô hàng RELEASED: Đánh giá toàn vẹn xuất xưởng qua canonical validator
  batches.forEach((b) => {
    if (b.status === 'RELEASED') {
      const primary = testResultIndex.primaryMap.get(b.id) || [];
      const legacy = testResultIndex.legacyMap.get(b.id) || [];
      const invalid = testResultIndex.invalidLinkResults
        .filter((item) => item.matchedBatchId === b.id)
        .map((item) => item.testResult);

      const resolution = {
        batch: b,
        primaryResults: primary,
        legacyResults: legacy,
        invalidResults: invalid,
        allCandidateResults: [...primary, ...legacy],
        hasPrimaryMatch: primary.length > 0,
        hasLegacyMatch: legacy.length > 0,
        hasInvalidMatch: invalid.length > 0,
      };

      const boundTccs = b.tccsId ? tccsMap.get(b.tccsId) : undefined;
      const evaluation = evaluateBatchReleaseIntegrity(
        b,
        resolution,
        data.dataFreshness,
        boundTccs
      );

      if (evaluation.shouldAlert) {
        if (evaluation.integrityStatus === 'MISSING_TEST_RESULT') {
          issues.push({
            id: `released_no_pass_${b.id}`,
            type: 'RELEASED_BATCH_NO_PASSING_TEST',
            code: 'MISSING_TEST_RESULT',
            category: 'LOGICAL_STATUS_INCONSISTENCY',
            severity: 'CRITICAL',
            title: `Lô đã xuất xưởng nhưng chưa kiểm nghiệm: ${b.batchNo}`,
            description: evaluation.summaryMessage,
            entityType: 'BATCH',
            entityId: b.id,
            entityName: b.batchNo,
            expected: 'Phiếu kiểm nghiệm ĐẠT (PASS)',
            actual: 'Không có phiếu kiểm nghiệm',
            reason: 'MISSING_TEST_RESULT',
            source: 'BatchIntegrityValidator',
            suggestedAction:
              evaluation.suggestedAction ||
              'Xem xét lại quyết định duyệt lô hoặc chuyển trạng thái sang ĐANG KIỂM TRA (TESTING).',
            autoHealable: false,
          });
        } else if (evaluation.integrityStatus === 'RELATIONSHIP_ERROR') {
          const issueId = `relationship_err_${b.id}`;
          if (
            !issues.some(
              (i) => i.id === issueId || (i.relatedEntityId === b.id && i.code === 'INVALID_LINK')
            )
          ) {
            issues.push({
              id: issueId,
              type: 'TEST_RESULT_RELATIONSHIP_INVALID',
              code: 'INVALID_LINK',
              category: 'CROSS_ENTITY_MISMATCH',
              severity: 'WARNING',
              title: `Lỗi liên kết phiếu kiểm nghiệm: ${b.batchNo}`,
              description: evaluation.summaryMessage,
              entityType: 'BATCH',
              entityId: b.id,
              entityName: b.batchNo,
              relatedEntityId: resolution.legacyResults[0]?.id,
              expected: `Khóa liên kết batchId = "${b.id}"`,
              actual: `Khóa liên kết legacy (batchNo = "${b.batchNo}")`,
              reason: 'INVALID_LINK',
              source: 'BatchIntegrityValidator',
              suggestedAction:
                evaluation.suggestedAction ||
                'Cập nhật khóa liên kết kỹ thuật (batchId = batch.id) cho phiếu kiểm nghiệm.',
              autoHealable: true,
              autoHealAction: 'FIX_TEST_RELATIONSHIP',
              healPayload: {
                batchId: b.id,
                testResultIds: resolution.legacyResults.map((r) => r.id),
              },
            });
          }
        } else if (evaluation.integrityStatus === 'TEST_RESULT_INVALID_STATUS') {
          issues.push({
            id: `released_no_pass_${b.id}`,
            type: 'RELEASED_BATCH_NO_PASSING_TEST',
            code: 'CRITERIA_FAIL',
            category: 'LOGICAL_STATUS_INCONSISTENCY',
            severity: 'CRITICAL',
            title: `Lô đã xuất xưởng nhưng kết quả kiểm nghiệm không đạt: ${b.batchNo}`,
            description: evaluation.summaryMessage,
            entityType: 'BATCH',
            entityId: b.id,
            entityName: b.batchNo,
            expected: 'Kết quả kiểm nghiệm ĐẠT (PASS)',
            actual: 'Kết quả kiểm nghiệm KHÔNG ĐẠT (FAIL)',
            reason: 'CRITERIA_FAIL',
            source: 'BatchIntegrityValidator',
            suggestedAction:
              evaluation.suggestedAction ||
              'Xem xét lại quyết định duyệt lô, thực hiện kiểm nghiệm lại hoặc chuyển trạng thái sang BỊ LOẠI (REJECTED) / ĐANG KIỂM TRA (TESTING).',
            autoHealable: false,
          });
        }
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
        suggestedAction:
          'Bổ sung lý do loại lô để phục vụ hồ sơ điều tra OOS và báo cáo chất lượng.',
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

    // 3.6 Logic ngày sản xuất trước ngày ban hành TCCS
    if (b.mfgDate && b.tccsId) {
      const appliedTccs = tccsMap.get(b.tccsId);
      if (appliedTccs && appliedTccs.issueDate) {
        const diff = compareDates(appliedTccs.issueDate, b.mfgDate);
        if (diff !== null && diff > 0) {
          issues.push({
            id: `batch_before_tccs_issue_${b.id}`,
            type: 'INVALID_DATE_SEQUENCE',
            category: 'LOGICAL_STATUS_INCONSISTENCY',
            severity: 'WARNING',
            title: `Lô sản xuất trước ngày ban hành TCCS: ${b.batchNo}`,
            description: `Lô "${b.batchNo}" sản xuất ngày ${b.mfgDate} trước ngày ban hành ${appliedTccs.issueDate} của TCCS "${appliedTccs.code}".`,
            entityType: 'BATCH',
            entityId: b.id,
            entityName: b.batchNo,
            suggestedAction: 'Kiểm tra lại phiên bản TCCS áp dụng cho lô hàng này.',
            autoHealable: false,
          });
        }
      }
    }
  });

  // 3.5 Logic thời gian Phiếu kiểm nghiệm: testDate < mfgDate
  testResults.forEach((r) => {
    const rawBatch = getBatchForTestResult(r.batchId);
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

  // 3.6 Rà soát chuẩn hóa Đơn vị kiểm nghiệm (Testing Laboratory Normalization)
  const activeTestingLabs =
    data.testingLaboratories && data.testingLaboratories.length > 0
      ? data.testingLaboratories
      : DEFAULT_TESTING_LABORATORIES;

  testResults.forEach((r) => {
    if (!r.labName || !r.labName.trim()) return;

    const matched = matchLaboratory(r.labName, activeTestingLabs);
    if (matched) {
      const isAlreadyCanonical =
        r.labId === matched.lab.id && r.labName === matched.lab.canonicalName;
      if (!isAlreadyCanonical) {
        issues.push({
          id: `unnormalized_lab_${r.id}`,
          type: 'UNNORMALIZED_TEST_LAB',
          category: 'CROSS_ENTITY_MISMATCH',
          severity: 'INFO',
          title: `Đơn vị kiểm nghiệm chưa chuẩn hóa: ${r.labName}`,
          description: `Phiếu kiểm nghiệm có tên đơn vị "${r.labName}" tương đồng với "${matched.lab.canonicalName}" (${Math.round(matched.similarity * 100)}%). Cần gán mã chuẩn "${matched.lab.code}" để đồng bộ biểu đồ SPC.`,
          entityType: 'TEST_RESULT',
          entityId: r.id,
          entityName: `${r.labName} (${r.testDate || 'N/A'})`,
          suggestedAction: `Chuẩn hóa về "${matched.lab.canonicalName}" (Mã: ${matched.lab.code})`,
          autoHealable: true,
          autoHealAction: 'NORMALIZE_TEST_LAB',
          healPayload: {
            testResultId: r.id,
            targetLabId: matched.lab.id,
            canonicalLabName: matched.lab.canonicalName,
          },
        });
      }
    }
  });

  // =========================================================================
  // 4. MẤT LIÊN KẾT NGUYÊN LIỆU <-> CÔNG THỨC (RAW MATERIAL LINKAGE GAPS)
  // =========================================================================

  productFormulas.forEach((f) => {
    const prod = productMap.get(f.productId);
    const unlinkedItems: {
      name: string;
      isIngredient: boolean;
      index: number;
      suggestedMaterialId?: string;
    }[] = [];

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
      const matchableCount = unlinkedItems.filter((u) => u.suggestedMaterialId).length;
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

  products.forEach((p) => {
    const pFormulas = formulasByProduct.get(p.id) || [];
    const pTccs = tccsByProduct.get(p.id) || [];
    const activeTccs = pTccs.find((t) => t.isActive) || pTccs[0];
    const formula = pFormulas[0];

    if (formula && activeTccs && Array.isArray(formula.ingredients)) {
      const tccsCriteriaNames = [
        ...(activeTccs.mainQualityCriteria || []),
        ...(activeTccs.safetyCriteria || []),
      ].map((c) => normalizeName(c.name));

      // Helper trích xuất từ khóa cốt lõi của hoạt chất/chỉ tiêu
      const extractCoreTokens = (str: string): string[] => {
        const stopWords = new Set([
          'cao',
          'chiet',
          'xuat',
          'tinh',
          'chat',
          'bot',
          'dau',
          'dinh',
          'luong',
          'ham',
          'tong',
          'so',
          'cac',
          'chuan',
          'hoa',
          'extract',
          'content',
          'total',
        ]);
        return normalizeName(str)
          .replace(
            /[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g,
            ' '
          )
          .split(/\s+/)
          .filter((t) => t.length >= 2 && !stopWords.has(t));
      };

      formula.ingredients.forEach((ing) => {
        if (ing.name && ing.name.trim()) {
          const normIngName = normalizeName(ing.name);
          const ingTokens = extractCoreTokens(normIngName);

          const isPresent = tccsCriteriaNames.some((tcName) => {
            if (tcName.includes(normIngName) || normIngName.includes(tcName)) return true;
            const tcTokens = extractCoreTokens(tcName);
            if (ingTokens.length > 0 && tcTokens.length > 0) {
              const commonCount = ingTokens.filter((t) => tcTokens.includes(t)).length;
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
              suggestedAction:
                'Bổ sung chỉ tiêu định lượng hoạt chất vào TCCS hoặc cập nhật lại công thức.',
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
  products.forEach((p) => {
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
    pBatches.forEach((b) => {
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

  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
  const infoCount = issues.filter((i) => i.severity === 'INFO').length;
  const autoHealableCount = issues.filter((i) => i.autoHealable).length;

  const totalEntitiesScanned =
    products.length +
    batches.length +
    tccsList.length +
    productFormulas.length +
    rawMaterials.length +
    testResults.length +
    criteriaAliases.length +
    (data.testingLaboratories || []).length;

  // Điểm sức khỏe = 100 - (critical * 12) - (warning * 3) - (info * 1)
  const penalty = criticalCount * 12 + warningCount * 3 + infoCount * 1;
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
      orphanRecords: issues.filter((i) => i.category === 'ORPHAN_RECORDS').length,
      crossEntityMismatch: issues.filter((i) => i.category === 'CROSS_ENTITY_MISMATCH').length,
      logicalStatusInconsistency: issues.filter(
        (i) => i.category === 'LOGICAL_STATUS_INCONSISTENCY'
      ).length,
      rawMaterialLinkage: issues.filter((i) => i.category === 'RAW_MATERIAL_LINKAGE').length,
      formulaTccsAlignment: issues.filter((i) => i.category === 'FORMULA_TCCS_ALIGNMENT').length,
      duplicateIdentifiers: issues.filter((i) => i.category === 'DUPLICATE_IDENTIFIERS').length,
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
  const testResultBatchIdUpdates: Record<string, string> = {};
  const testResultLabUpdates: Record<string, { labId: string; labName: string }> = {};
  const tccsActiveUpdates: Record<string, { tccsId: string; isActive: boolean }[]> = {};
  const orphanAliasIdsToDelete: string[] = [];

  const rawMaterials = data.rawMaterials || [];
  const materialNameMap = new Map<string, RawMaterial>();
  rawMaterials.forEach((m) => {
    if (m.name) materialNameMap.set(normalizeName(m.name), m);
    if (Array.isArray(m.aliases)) {
      m.aliases.forEach((a) => {
        if (a) materialNameMap.set(normalizeName(a), m);
      });
    }
  });

  const healableIssues = report.issues.filter((i) => i.autoHealable);

  healableIssues.forEach((issue) => {
    if (issue.autoHealAction === 'LINK_MATERIAL' && issue.healPayload) {
      const { formulaId } = issue.healPayload;
      const formula = data.productFormulas.find((f) => f.id === formulaId);
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
    } else if (issue.autoHealAction === 'FIX_TEST_RELATIONSHIP' && issue.healPayload) {
      const { batchId, testResultIds } = issue.healPayload;
      if (batchId && Array.isArray(testResultIds)) {
        testResultIds.forEach((trId: string) => {
          testResultBatchIdUpdates[trId] = batchId;
        });
      }
    } else if (issue.autoHealAction === 'FIX_ACTIVE_TCCS' && issue.healPayload) {
      const { productId, targetTccsId } = issue.healPayload;
      const pTccs = data.tccsList.filter((t) => t.productId === productId);
      const updates = pTccs.map((t) => ({
        tccsId: t.id,
        isActive: t.id === targetTccsId,
      }));
      tccsActiveUpdates[productId] = updates;
    } else if (issue.autoHealAction === 'CLEAN_ORPHAN_ALIAS' && issue.healPayload) {
      orphanAliasIdsToDelete.push(issue.healPayload.aliasId);
    } else if (issue.autoHealAction === 'NORMALIZE_TEST_LAB' && issue.healPayload) {
      const { testResultId, targetLabId, canonicalLabName } = issue.healPayload;
      testResultLabUpdates[testResultId] = {
        labId: targetLabId,
        labName: canonicalLabName,
      };
    }
  });

  return {
    formulaUpdates,
    testResultStatusUpdates,
    testResultBatchIdUpdates,
    testResultLabUpdates,
    tccsActiveUpdates,
    orphanAliasIdsToDelete,
    totalActionsCount:
      Object.keys(formulaUpdates).length +
      Object.keys(testResultStatusUpdates).length +
      Object.keys(testResultBatchIdUpdates).length +
      Object.keys(testResultLabUpdates).length +
      Object.keys(tccsActiveUpdates).length +
      orphanAliasIdsToDelete.length,
  };
};

/**
 * Thực thi kế hoạch Auto-Heal lên hệ thống
 */
export const executeAutoHealPlan = async (
  plan: ReturnType<typeof generateAutoHealPlan>,
  actions: {
    updateProductFormula: (f: ProductFormula) => Promise<any> | any;
    updateTestResult: (tr: TestResult) => Promise<any> | any;
    updateTCCS: (tccs: TCCS) => Promise<any> | any;
    deleteCriteriaAlias: (id: string) => Promise<any> | any;
    testResults: TestResult[];
    tccsList: TCCS[];
  }
): Promise<number> => {
  let successCount = 0;

  // 1. Cập nhật Formulas
  for (const formulaId of Object.keys(plan.formulaUpdates)) {
    await actions.updateProductFormula(plan.formulaUpdates[formulaId]);
    successCount++;
  }

  // 2. Cập nhật Test Result Statuses
  for (const trId of Object.keys(plan.testResultStatusUpdates)) {
    const tr = actions.testResults.find((t) => t.id === trId);
    if (tr) {
      await actions.updateTestResult({ ...tr, overallStatus: plan.testResultStatusUpdates[trId] });
      successCount++;
    }
  }

  // 2b. Cập nhật Test Result Batch ID (hàn gắn quan hệ liên kết kỹ thuật chính xác)
  for (const trId of Object.keys(plan.testResultBatchIdUpdates || {})) {
    const tr = actions.testResults.find((t) => t.id === trId);
    if (tr) {
      await actions.updateTestResult({
        ...tr,
        batchId: plan.testResultBatchIdUpdates[trId],
      });
      successCount++;
    }
  }

  // 3. Cập nhật TCCS Active Flags
  for (const pId of Object.keys(plan.tccsActiveUpdates)) {
    const updates = plan.tccsActiveUpdates[pId];
    for (const u of updates) {
      const tccsItem = actions.tccsList.find((t) => t.id === u.tccsId);
      if (tccsItem && tccsItem.isActive !== u.isActive) {
        await actions.updateTCCS({ ...tccsItem, isActive: u.isActive });
      }
    }
    successCount++;
  }

  // 4. Dọn dẹp Orphan Aliases
  for (const aId of plan.orphanAliasIdsToDelete) {
    await actions.deleteCriteriaAlias(aId);
    successCount++;
  }

  // 5. Chuẩn hóa Đơn vị kiểm nghiệm cho Test Results
  for (const trId of Object.keys(plan.testResultLabUpdates)) {
    const tr = actions.testResults.find((t) => t.id === trId);
    if (tr) {
      const update = plan.testResultLabUpdates[trId];
      await actions.updateTestResult({
        ...tr,
        labId: update.labId,
        labName: update.labName,
      });
      successCount++;
    }
  }

  return successCount;
};

/**
 * Hàm gọi Auto-Heal toàn diện dành cho AI Chatbot và automation
 */
export const autoHealAllWithAI = async (storeGetState: () => any) => {
  const state = storeGetState();
  const snapshot: SystemDataSnapshot = {
    products: state.products || [],
    batches: state.batches || [],
    tccsList: state.tccsList || [],
    productFormulas: state.productFormulas || [],
    rawMaterials: state.rawMaterials || [],
    testResults: state.testResults || [],
    criteriaAliases: state.criteriaAliases || [],
    testingLaboratories: state.testingLaboratories || [],
  };

  const report = auditDataConsistency(snapshot);
  const plan = generateAutoHealPlan(report, snapshot);

  if (plan.totalActionsCount === 0) {
    return {
      success: true,
      message: `✅ Hệ thống đã được kiểm tra: Đạt ${report.overallScore}/100 điểm (${report.grade}). Không phát hiện liên kết nào cần tự động sửa chữa.`,
      healedCount: 0,
      score: report.overallScore,
    };
  }

  const healedCount = await executeAutoHealPlan(plan, {
    updateProductFormula: state.updateProductFormula,
    updateTestResult: state.updateTestResult,
    updateTCCS: state.updateTCCS,
    deleteCriteriaAlias: state.deleteCriteriaAlias,
    testResults: state.testResults || [],
    tccsList: state.tccsList || [],
  });

  return {
    success: true,
    message: `🛠️ Đã tự động hàn gắn và chuẩn hóa thành công **${healedCount} liên kết dữ liệu** trên hệ thống!\n- Điểm chất lượng dữ liệu: **${report.overallScore}/100**\n- Các tác vụ hoàn tất: Liên kết nguyên liệu vào công thức, đồng bộ trạng thái phiếu kiểm nghiệm, sửa cờ hiệu lực TCCS và dọn dẹp ánh xạ mồ côi.`,
    healedCount,
    score: report.overallScore,
  };
};
