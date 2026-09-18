/**
 * PQM Domain - Entity Identity Model (Model 3)
 *
 * Mọi quan hệ phải được xác định bằng Technical ID chuẩn.
 *
 * Chuỗi Technical ID chuẩn:
 * Product.id
 *    ↓ productId
 * TCCS.id  (tccs.productId === product.id)
 *    ↓ tccsId
 * Batch.id (batch.productId === product.id, batch.tccsId === tccs.id)
 *    ↓ batchId (Tuyệt đối là batch.id, KHÔNG PHẢI batchNo)
 * TestResult.id
 *    ↓ (tccsId, labId, results[])
 *
 * QUY TẮC CỐT LÕI:
 * 1. Technical ID là định danh duy nhất có giá trị liên kết quan hệ.
 * 2. batchNo, tccsCode, productName, labName CHỈ LÀ THUỘC TÍNH HIỂN THỊ / TÌM KIẾM,
 *    TUYỆT ĐỐI KHÔNG DÙNG LÀM FOREIGN KEY.
 * 3. Bất kỳ tham chiếu nào sử dụng Business Key thay vì Technical ID đều bị đánh dấu
 *    LEGACY_BUSINESS_KEY và cần được chuẩn hóa (normalize).
 * 4. Phát hiện và ngăn chặn bản ghi mồ côi (Orphan) và trùng lặp ID (Duplicate ID).
 */

import { Product, Batch, TCCS, TestResult, ProductFormula, TestingLaboratory } from '../../types';

export type ReferenceClassification =
  | 'PRIMARY'
  | 'LEGACY_BUSINESS_KEY'
  | 'BROKEN_ORPHAN'
  | 'EMPTY_REFERENCE';

export interface IdentityRelationshipValidationResult {
  isValid: boolean;
  relationship: string;
  sourceEntityId: string;
  sourceEntityType: string;
  targetEntityId: string;
  targetEntityType: string;
  classification: ReferenceClassification;
  error?: string;
  isLegacyMatch?: boolean;
}

export interface IdentityChainValidationResult {
  isValid: boolean;
  testResultId: string;
  batchId: string;
  productId?: string;
  tccsId?: string;
  labId?: string;
  relationships: IdentityRelationshipValidationResult[];
  errors: string[];
  warnings: string[];
}

export interface DuplicateIdentityReport {
  entityType: string;
  hasDuplicates: boolean;
  duplicateIds: string[];
  details: { id: string; count: number }[];
}

export interface OrphanEntityReport {
  orphanTestResults: { testResultId: string; batchId: string; reason: string }[];
  orphanBatches: {
    batchId: string;
    batchNo?: string;
    productId?: string;
    tccsId?: string;
    reason: string;
  }[];
  orphanTCCS: { tccsId: string; code: string; productId: string; reason: string }[];
  hasOrphans: boolean;
  totalOrphans: number;
}

export interface BrokenReferenceItem {
  sourceEntityType: string;
  sourceEntityId: string;
  targetEntityType: string;
  referenceField: string;
  referenceValue: string;
  classification: ReferenceClassification;
  resolvedId?: string;
  description: string;
}

export interface SystemIdentityAuditSummary {
  timestamp: string;
  totalEntities: {
    products: number;
    batches: number;
    testResults: number;
    tccs: number;
    laboratories: number;
  };
  classificationCounts: {
    primary: number;
    legacyBusinessKey: number;
    brokenOrphan: number;
    emptyReference: number;
  };
  duplicates: DuplicateIdentityReport[];
  orphans: OrphanEntityReport;
  brokenReferences: BrokenReferenceItem[];
  isHealthy: boolean;
  healthScore: number; // Thang điểm 0 - 100%
}

export class EntityIdentityManager {
  /**
   * Xác thực liên kết giữa Batch và Product (Batch.productId === Product.id)
   */
  public static validateBatchProduct(
    batch: Batch,
    products: Product[]
  ): IdentityRelationshipValidationResult {
    if (!batch.productId || !batch.productId.trim()) {
      return {
        isValid: false,
        relationship: 'BATCH_PRODUCT',
        sourceEntityId: batch.id,
        sourceEntityType: 'BATCH',
        targetEntityId: '',
        targetEntityType: 'PRODUCT',
        classification: 'EMPTY_REFERENCE',
        error: `Lô ${batch.batchNo || batch.id} không có thông tin productId.`,
      };
    }

    const targetProduct = products.find((p) => p.id === batch.productId);
    if (targetProduct) {
      return {
        isValid: true,
        relationship: 'BATCH_PRODUCT',
        sourceEntityId: batch.id,
        sourceEntityType: 'BATCH',
        targetEntityId: batch.productId,
        targetEntityType: 'PRODUCT',
        classification: 'PRIMARY',
      };
    }

    // Kiểm tra nếu trỏ nhầm bằng mã sản phẩm (product.code hoặc product.name)
    const legacyProduct = products.find(
      (p) =>
        (p.code && p.code.toLowerCase() === batch.productId.toLowerCase()) ||
        (p.name && p.name.toLowerCase() === batch.productId.toLowerCase())
    );
    if (legacyProduct) {
      return {
        isValid: false,
        relationship: 'BATCH_PRODUCT',
        sourceEntityId: batch.id,
        sourceEntityType: 'BATCH',
        targetEntityId: batch.productId,
        targetEntityType: 'PRODUCT',
        classification: 'LEGACY_BUSINESS_KEY',
        isLegacyMatch: true,
        error: `Lô ${batch.batchNo || batch.id} trỏ productId bằng mã/tên (${batch.productId}) thay vì ID kỹ thuật (${legacyProduct.id}).`,
      };
    }

    return {
      isValid: false,
      relationship: 'BATCH_PRODUCT',
      sourceEntityId: batch.id,
      sourceEntityType: 'BATCH',
      targetEntityId: batch.productId,
      targetEntityType: 'PRODUCT',
      classification: 'BROKEN_ORPHAN',
      error: `Lô ${batch.batchNo || batch.id} trỏ đến productId không tồn tại: ${batch.productId}`,
    };
  }

  /**
   * Xác thực liên kết giữa Batch và TCCS (Batch.tccsId === TCCS.id)
   */
  public static validateBatchTCCS(
    batch: Batch,
    tccsList: TCCS[]
  ): IdentityRelationshipValidationResult {
    if (!batch.tccsId || !batch.tccsId.trim()) {
      return {
        isValid: false,
        relationship: 'BATCH_TCCS',
        sourceEntityId: batch.id,
        sourceEntityType: 'BATCH',
        targetEntityId: '',
        targetEntityType: 'TCCS',
        classification: 'EMPTY_REFERENCE',
        error: `Lô ${batch.batchNo || batch.id} không có thông tin tccsId.`,
      };
    }

    const targetTCCS = tccsList.find((t) => t.id === batch.tccsId);
    if (targetTCCS) {
      // Đảm bảo TCCS thuộc đúng Product của Batch
      if (batch.productId && targetTCCS.productId !== batch.productId) {
        return {
          isValid: false,
          relationship: 'BATCH_TCCS_CROSS_PRODUCT',
          sourceEntityId: batch.id,
          sourceEntityType: 'BATCH',
          targetEntityId: batch.tccsId,
          targetEntityType: 'TCCS',
          classification: 'PRIMARY',
          error: `TCCS ${targetTCCS.code} thuộc sản phẩm ${targetTCCS.productId}, không khớp với sản phẩm của lô: ${batch.productId}`,
        };
      }

      return {
        isValid: true,
        relationship: 'BATCH_TCCS',
        sourceEntityId: batch.id,
        sourceEntityType: 'BATCH',
        targetEntityId: batch.tccsId,
        targetEntityType: 'TCCS',
        classification: 'PRIMARY',
      };
    }

    // Kiểm tra nếu trỏ bằng số/mã TCCS (tccs.code) thay vì tccs.id
    const legacyTCCS = tccsList.find(
      (t) => t.code && t.code.toLowerCase() === batch.tccsId.toLowerCase()
    );
    if (legacyTCCS) {
      return {
        isValid: false,
        relationship: 'BATCH_TCCS',
        sourceEntityId: batch.id,
        sourceEntityType: 'BATCH',
        targetEntityId: batch.tccsId,
        targetEntityType: 'TCCS',
        classification: 'LEGACY_BUSINESS_KEY',
        isLegacyMatch: true,
        error: `Lô ${batch.batchNo || batch.id} trỏ tccsId bằng mã tiêu chuẩn (${batch.tccsId}) thay vì ID kỹ thuật (${legacyTCCS.id}).`,
      };
    }

    return {
      isValid: false,
      relationship: 'BATCH_TCCS',
      sourceEntityId: batch.id,
      sourceEntityType: 'BATCH',
      targetEntityId: batch.tccsId,
      targetEntityType: 'TCCS',
      classification: 'BROKEN_ORPHAN',
      error: `Lô ${batch.batchNo || batch.id} trỏ đến tccsId không tồn tại: ${batch.tccsId}`,
    };
  }

  /**
   * Xác thực liên kết giữa TestResult và Batch (TestResult.batchId === Batch.id)
   * Tuyệt đối không chấp nhận liên kết bằng batchNo.
   */
  public static validateTestResultBatch(
    testResult: TestResult,
    batches: Batch[]
  ): IdentityRelationshipValidationResult {
    if (!testResult.batchId || !testResult.batchId.trim()) {
      return {
        isValid: false,
        relationship: 'TEST_RESULT_BATCH',
        sourceEntityId: testResult.id,
        sourceEntityType: 'TEST_RESULT',
        targetEntityId: '',
        targetEntityType: 'BATCH',
        classification: 'EMPTY_REFERENCE',
        error: `Phiếu kiểm nghiệm ${testResult.id} không có batchId.`,
      };
    }

    // 1. Kiểm tra khóa ngoại chính xác bằng Technical ID
    const primaryBatch = batches.find((b) => b.id === testResult.batchId);
    if (primaryBatch) {
      return {
        isValid: true,
        relationship: 'TEST_RESULT_BATCH_PRIMARY',
        sourceEntityId: testResult.id,
        sourceEntityType: 'TEST_RESULT',
        targetEntityId: testResult.batchId,
        targetEntityType: 'BATCH',
        classification: 'PRIMARY',
      };
    }

    // 2. Phát hiện lỗi trỏ bằng batchNo (Legacy Pattern cần chuẩn hóa)
    const legacyBatch = batches.find((b) => b.batchNo === testResult.batchId);
    if (legacyBatch) {
      return {
        isValid: false,
        isLegacyMatch: true,
        relationship: 'TEST_RESULT_BATCH_LEGACY_MATCH',
        sourceEntityId: testResult.id,
        sourceEntityType: 'TEST_RESULT',
        targetEntityId: testResult.batchId,
        targetEntityType: 'BATCH',
        classification: 'LEGACY_BUSINESS_KEY',
        error: `Phiếu kiểm nghiệm ${testResult.id} trỏ batchId bằng số lô (${testResult.batchId}) thay vì technical ID (${legacyBatch.id}).`,
      };
    }

    // 3. Mồ côi hoàn toàn
    return {
      isValid: false,
      relationship: 'TEST_RESULT_BATCH_ORPHAN',
      sourceEntityId: testResult.id,
      sourceEntityType: 'TEST_RESULT',
      targetEntityId: testResult.batchId,
      targetEntityType: 'BATCH',
      classification: 'BROKEN_ORPHAN',
      error: `Phiếu kiểm nghiệm ${testResult.id} có batchId (${testResult.batchId}) không tồn tại trong danh mục Lô.`,
    };
  }

  /**
   * Xác thực liên kết giữa TestResult và TCCS (TestResult.tccsId === TCCS.id)
   */
  public static validateTestResultTCCS(
    testResult: TestResult,
    tccsList: TCCS[],
    associatedBatch?: Batch
  ): IdentityRelationshipValidationResult {
    const tccsIdToTest = testResult.tccsId || associatedBatch?.tccsId;

    if (!tccsIdToTest || !tccsIdToTest.trim()) {
      return {
        isValid: false,
        relationship: 'TEST_RESULT_TCCS',
        sourceEntityId: testResult.id,
        sourceEntityType: 'TEST_RESULT',
        targetEntityId: '',
        targetEntityType: 'TCCS',
        classification: 'EMPTY_REFERENCE',
        error: `Phiếu kiểm nghiệm ${testResult.id} không có thông tin tccsId (cả trực tiếp và qua lô).`,
      };
    }

    const targetTCCS = tccsList.find((t) => t.id === tccsIdToTest);
    if (targetTCCS) {
      // Nếu có thông tin Batch và Batch có TCCS khác với TestResult -> cảnh báo không nhất quán
      if (
        testResult.tccsId &&
        associatedBatch?.tccsId &&
        testResult.tccsId !== associatedBatch.tccsId
      ) {
        return {
          isValid: false,
          relationship: 'TEST_RESULT_TCCS_BATCH_MISMATCH',
          sourceEntityId: testResult.id,
          sourceEntityType: 'TEST_RESULT',
          targetEntityId: testResult.tccsId,
          targetEntityType: 'TCCS',
          classification: 'PRIMARY',
          error: `Phiếu kiểm nghiệm ${testResult.id} chỉ định TCCS (${testResult.tccsId}) khác với TCCS của lô (${associatedBatch.tccsId}).`,
        };
      }

      return {
        isValid: true,
        relationship: 'TEST_RESULT_TCCS',
        sourceEntityId: testResult.id,
        sourceEntityType: 'TEST_RESULT',
        targetEntityId: tccsIdToTest,
        targetEntityType: 'TCCS',
        classification: 'PRIMARY',
      };
    }

    // Kiểm tra nếu trỏ bằng tccs.code thay vì tccs.id
    const legacyTCCS = tccsList.find(
      (t) => t.code && t.code.toLowerCase() === tccsIdToTest.toLowerCase()
    );
    if (legacyTCCS) {
      return {
        isValid: false,
        relationship: 'TEST_RESULT_TCCS',
        sourceEntityId: testResult.id,
        sourceEntityType: 'TEST_RESULT',
        targetEntityId: tccsIdToTest,
        targetEntityType: 'TCCS',
        classification: 'LEGACY_BUSINESS_KEY',
        isLegacyMatch: true,
        error: `Phiếu kiểm nghiệm ${testResult.id} trỏ tccsId bằng mã TCCS (${tccsIdToTest}) thay vì ID kỹ thuật (${legacyTCCS.id}).`,
      };
    }

    return {
      isValid: false,
      relationship: 'TEST_RESULT_TCCS',
      sourceEntityId: testResult.id,
      sourceEntityType: 'TEST_RESULT',
      targetEntityId: tccsIdToTest,
      targetEntityType: 'TCCS',
      classification: 'BROKEN_ORPHAN',
      error: `Phiếu kiểm nghiệm ${testResult.id} trỏ đến tccsId không tồn tại: ${tccsIdToTest}`,
    };
  }

  /**
   * Xác thực liên kết giữa TestResult và Phòng kiểm nghiệm (TestResult.labId === TestingLaboratory.id)
   */
  public static validateTestResultLab(
    testResult: TestResult,
    laboratories: TestingLaboratory[] = []
  ): IdentityRelationshipValidationResult {
    if (!testResult.labId || !testResult.labId.trim()) {
      // Trường hợp không có labId nhưng có labName -> kiểm tra xem labName có khớp với lab chuẩn nào không
      if (testResult.labName && testResult.labName.trim()) {
        const matchedLab = laboratories.find(
          (l) =>
            l.canonicalName.toLowerCase() === testResult.labName.trim().toLowerCase() ||
            l.code.toLowerCase() === testResult.labName.trim().toLowerCase() ||
            (l.aliases &&
              l.aliases.some((a) => a.toLowerCase() === testResult.labName.trim().toLowerCase()))
        );
        if (matchedLab) {
          return {
            isValid: false,
            relationship: 'TEST_RESULT_LAB',
            sourceEntityId: testResult.id,
            sourceEntityType: 'TEST_RESULT',
            targetEntityId: testResult.labName,
            targetEntityType: 'LABORATORY',
            classification: 'LEGACY_BUSINESS_KEY',
            isLegacyMatch: true,
            error: `Phiếu kiểm nghiệm ${testResult.id} chưa có labId kỹ thuật, chỉ có tên phòng lab (${testResult.labName}). Khớp với phòng lab ID: ${matchedLab.id}.`,
          };
        }
      }

      return {
        isValid: false,
        relationship: 'TEST_RESULT_LAB',
        sourceEntityId: testResult.id,
        sourceEntityType: 'TEST_RESULT',
        targetEntityId: '',
        targetEntityType: 'LABORATORY',
        classification: 'EMPTY_REFERENCE',
        error: `Phiếu kiểm nghiệm ${testResult.id} không có thông tin labId.`,
      };
    }

    // Khóa ngoại labId được cung cấp
    const targetLab = laboratories.find((l) => l.id === testResult.labId);
    if (targetLab) {
      return {
        isValid: true,
        relationship: 'TEST_RESULT_LAB',
        sourceEntityId: testResult.id,
        sourceEntityType: 'TEST_RESULT',
        targetEntityId: testResult.labId,
        targetEntityType: 'LABORATORY',
        classification: 'PRIMARY',
      };
    }

    // Kiểm tra nếu trỏ bằng code thay vì id
    const legacyLab = laboratories.find(
      (l) =>
        l.code.toLowerCase() === testResult.labId?.toLowerCase() ||
        l.canonicalName.toLowerCase() === testResult.labId?.toLowerCase()
    );
    if (legacyLab) {
      return {
        isValid: false,
        relationship: 'TEST_RESULT_LAB',
        sourceEntityId: testResult.id,
        sourceEntityType: 'TEST_RESULT',
        targetEntityId: testResult.labId,
        targetEntityType: 'LABORATORY',
        classification: 'LEGACY_BUSINESS_KEY',
        isLegacyMatch: true,
        error: `Phiếu kiểm nghiệm ${testResult.id} trỏ labId bằng mã/tên (${testResult.labId}) thay vì ID kỹ thuật (${legacyLab.id}).`,
      };
    }

    return {
      isValid: false,
      relationship: 'TEST_RESULT_LAB',
      sourceEntityId: testResult.id,
      sourceEntityType: 'TEST_RESULT',
      targetEntityId: testResult.labId,
      targetEntityType: 'LABORATORY',
      classification: 'BROKEN_ORPHAN',
      error: `Phiếu kiểm nghiệm ${testResult.id} trỏ đến labId không tồn tại: ${testResult.labId}`,
    };
  }

  /**
   * Xác thực toàn diện chuỗi Technical ID của một Phiếu kiểm nghiệm:
   * testResultId -> batchId -> tccsId -> labId
   * batchId -> productId
   * tccsId -> productId (kiểm tra tính nhất quán liên kết)
   */
  public static validateEntityIdentityChain(params: {
    testResult: TestResult;
    batches: Batch[];
    products: Product[];
    tccsList: TCCS[];
    laboratories?: TestingLaboratory[];
  }): IdentityChainValidationResult {
    const { testResult, batches, products, tccsList, laboratories = [] } = params;
    const relationships: IdentityRelationshipValidationResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Kiểm tra TestResult -> Batch
    const batchRel = this.validateTestResultBatch(testResult, batches);
    relationships.push(batchRel);
    if (!batchRel.isValid) {
      errors.push(batchRel.error || 'Lỗi liên kết TestResult -> Batch');
    }

    const associatedBatch = batches.find(
      (b) => b.id === testResult.batchId || b.batchNo === testResult.batchId
    );

    let productId: string | undefined;
    let tccsId: string | undefined;

    // 2. Kiểm tra Batch -> Product & Batch -> TCCS nếu có batch
    if (associatedBatch) {
      productId = associatedBatch.productId;
      const prodRel = this.validateBatchProduct(associatedBatch, products);
      relationships.push(prodRel);
      if (!prodRel.isValid) {
        errors.push(prodRel.error || 'Lỗi liên kết Batch -> Product');
      }

      const tccsRel = this.validateBatchTCCS(associatedBatch, tccsList);
      relationships.push(tccsRel);
      if (!tccsRel.isValid) {
        errors.push(tccsRel.error || 'Lỗi liên kết Batch -> TCCS');
      } else {
        tccsId = associatedBatch.tccsId;
      }
    }

    // 3. Kiểm tra TestResult -> TCCS
    const trTccsRel = this.validateTestResultTCCS(testResult, tccsList, associatedBatch);
    relationships.push(trTccsRel);
    if (!trTccsRel.isValid) {
      // Nếu phiếu kiểm nghiệm chưa có tccsId riêng nhưng lô đã có thì chỉ là cảnh báo
      if (trTccsRel.classification === 'EMPTY_REFERENCE' && associatedBatch?.tccsId) {
        warnings.push(
          `Phiếu KN ${testResult.id} không khai báo tccsId trực tiếp (kế thừa từ Lô: ${associatedBatch.tccsId}).`
        );
      } else {
        errors.push(trTccsRel.error || 'Lỗi liên kết TestResult -> TCCS');
      }
    } else {
      tccsId = testResult.tccsId || tccsId;
    }

    // 4. Kiểm tra TestResult -> Lab
    if (laboratories.length > 0) {
      const labRel = this.validateTestResultLab(testResult, laboratories);
      relationships.push(labRel);
      if (!labRel.isValid) {
        if (
          labRel.classification === 'EMPTY_REFERENCE' ||
          labRel.classification === 'LEGACY_BUSINESS_KEY'
        ) {
          warnings.push(labRel.error || `Phiếu KN ${testResult.id} chưa chuẩn hóa labId.`);
        } else {
          errors.push(labRel.error || 'Lỗi liên kết TestResult -> Laboratory');
        }
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      testResultId: testResult.id,
      batchId: testResult.batchId,
      productId,
      tccsId,
      labId: testResult.labId,
      relationships,
      errors,
      warnings,
    };
  }

  /**
   * Phát hiện các bản ghi có Technical ID trùng lặp
   */
  public static detectDuplicateIdentities<T extends { id: string }>(
    entities: T[],
    entityType: string
  ): DuplicateIdentityReport {
    const idMap = new Map<string, number>();
    for (const entity of entities) {
      if (entity && entity.id) {
        const count = idMap.get(entity.id) || 0;
        idMap.set(entity.id, count + 1);
      }
    }

    const duplicates: { id: string; count: number }[] = [];
    for (const [id, count] of idMap.entries()) {
      if (count > 1) {
        duplicates.push({ id, count });
      }
    }

    return {
      entityType,
      hasDuplicates: duplicates.length > 0,
      duplicateIds: duplicates.map((d) => d.id),
      details: duplicates,
    };
  }

  /**
   * Phát hiện toàn diện các thực thể mồ côi (Orphans):
   * - TestResult không có Batch
   * - Batch không có Product hoặc TCCS không tồn tại
   * - TCCS không có Product
   */
  public static detectOrphanEntities(params: {
    testResults: TestResult[];
    batches: Batch[];
    products: Product[];
    tccsList: TCCS[];
  }): OrphanEntityReport {
    const { testResults, batches, products, tccsList } = params;

    const productIds = new Set(products.map((p) => p.id));
    const batchIds = new Set(batches.map((b) => b.id));
    const tccsIds = new Set(tccsList.map((t) => t.id));

    const orphanTestResults: { testResultId: string; batchId: string; reason: string }[] = [];
    for (const tr of testResults) {
      if (!tr.batchId || !tr.batchId.trim()) {
        orphanTestResults.push({
          testResultId: tr.id,
          batchId: '',
          reason: 'Thiếu batchId',
        });
      } else if (!batchIds.has(tr.batchId)) {
        orphanTestResults.push({
          testResultId: tr.id,
          batchId: tr.batchId,
          reason: `batchId ${tr.batchId} không tồn tại trong danh mục Lô`,
        });
      }
    }

    const orphanBatches: {
      batchId: string;
      batchNo?: string;
      productId?: string;
      tccsId?: string;
      reason: string;
    }[] = [];
    for (const b of batches) {
      if (!b.productId || !productIds.has(b.productId)) {
        orphanBatches.push({
          batchId: b.id,
          batchNo: b.batchNo,
          productId: b.productId,
          tccsId: b.tccsId,
          reason: `productId ${b.productId || 'trống'} không tồn tại trong danh mục Sản phẩm`,
        });
      } else if (b.tccsId && !tccsIds.has(b.tccsId)) {
        orphanBatches.push({
          batchId: b.id,
          batchNo: b.batchNo,
          productId: b.productId,
          tccsId: b.tccsId,
          reason: `tccsId ${b.tccsId} không tồn tại trong danh mục TCCS`,
        });
      }
    }

    const orphanTCCS: { tccsId: string; code: string; productId: string; reason: string }[] = [];
    for (const t of tccsList) {
      if (!t.productId || !productIds.has(t.productId)) {
        orphanTCCS.push({
          tccsId: t.id,
          code: t.code,
          productId: t.productId,
          reason: `productId ${t.productId || 'trống'} không tồn tại trong danh mục Sản phẩm`,
        });
      }
    }

    const totalOrphans = orphanTestResults.length + orphanBatches.length + orphanTCCS.length;

    return {
      orphanTestResults,
      orphanBatches,
      orphanTCCS,
      hasOrphans: totalOrphans > 0,
      totalOrphans,
    };
  }

  /**
   * Phát hiện và phân loại chi tiết các tham chiếu hỏng (Broken References)
   */
  public static detectBrokenReferences(params: {
    testResults: TestResult[];
    batches: Batch[];
    products: Product[];
    tccsList: TCCS[];
    laboratories?: TestingLaboratory[];
  }): BrokenReferenceItem[] {
    const { testResults, batches, products, tccsList, laboratories = [] } = params;
    const brokenItems: BrokenReferenceItem[] = [];

    // 1. Kiểm tra tham chiếu từ Batch
    for (const batch of batches) {
      const prodCheck = this.validateBatchProduct(batch, products);
      if (!prodCheck.isValid) {
        brokenItems.push({
          sourceEntityType: 'BATCH',
          sourceEntityId: batch.id,
          targetEntityType: 'PRODUCT',
          referenceField: 'productId',
          referenceValue: batch.productId,
          classification: prodCheck.classification,
          description: prodCheck.error || 'Lỗi tham chiếu Product từ Batch',
        });
      }

      if (batch.tccsId) {
        const tccsCheck = this.validateBatchTCCS(batch, tccsList);
        if (!tccsCheck.isValid) {
          brokenItems.push({
            sourceEntityType: 'BATCH',
            sourceEntityId: batch.id,
            targetEntityType: 'TCCS',
            referenceField: 'tccsId',
            referenceValue: batch.tccsId,
            classification: tccsCheck.classification,
            description: tccsCheck.error || 'Lỗi tham chiếu TCCS từ Batch',
          });
        }
      }
    }

    // 2. Kiểm tra tham chiếu từ TestResult
    for (const tr of testResults) {
      const batchCheck = this.validateTestResultBatch(tr, batches);
      if (!batchCheck.isValid) {
        let resolvedId: string | undefined;
        if (batchCheck.isLegacyMatch) {
          const match = batches.find((b) => b.batchNo === tr.batchId);
          if (match) resolvedId = match.id;
        }
        brokenItems.push({
          sourceEntityType: 'TEST_RESULT',
          sourceEntityId: tr.id,
          targetEntityType: 'BATCH',
          referenceField: 'batchId',
          referenceValue: tr.batchId,
          classification: batchCheck.classification,
          resolvedId,
          description: batchCheck.error || 'Lỗi tham chiếu Batch từ TestResult',
        });
      }

      if (tr.tccsId) {
        const tccsCheck = this.validateTestResultTCCS(tr, tccsList);
        if (!tccsCheck.isValid) {
          brokenItems.push({
            sourceEntityType: 'TEST_RESULT',
            sourceEntityId: tr.id,
            targetEntityType: 'TCCS',
            referenceField: 'tccsId',
            referenceValue: tr.tccsId,
            classification: tccsCheck.classification,
            description: tccsCheck.error || 'Lỗi tham chiếu TCCS từ TestResult',
          });
        }
      }

      if (tr.labId && laboratories.length > 0) {
        const labCheck = this.validateTestResultLab(tr, laboratories);
        if (!labCheck.isValid) {
          brokenItems.push({
            sourceEntityType: 'TEST_RESULT',
            sourceEntityId: tr.id,
            targetEntityType: 'LABORATORY',
            referenceField: 'labId',
            referenceValue: tr.labId,
            classification: labCheck.classification,
            description: labCheck.error || 'Lỗi tham chiếu Lab từ TestResult',
          });
        }
      }
    }

    return brokenItems;
  }

  /**
   * Chuẩn hóa thực thể Phiếu kiểm nghiệm:
   * - Tự động sửa batchId nếu đang dùng batchNo sang technical ID của Batch.
   * - Kế thừa tccsId từ Batch nếu phiếu chưa có.
   * - Tự động gán labId nếu chỉ có labName khớp với TestingLaboratory.
   */
  public static normalizeTestResultIdentity(
    testResult: TestResult,
    batches: Batch[],
    tccsList: TCCS[] = [],
    laboratories: TestingLaboratory[] = []
  ): { normalized: TestResult; modifications: string[] } {
    const modifications: string[] = [];
    const normalized: TestResult = { ...testResult };

    // 1. Chuẩn hóa batchId: Nếu trỏ bằng batchNo, đổi sang batch.id
    const primaryBatch = batches.find((b) => b.id === normalized.batchId);
    let matchedBatch = primaryBatch;

    if (!primaryBatch) {
      const legacyBatch = batches.find((b) => b.batchNo === normalized.batchId);
      if (legacyBatch) {
        normalized.batchId = legacyBatch.id;
        matchedBatch = legacyBatch;
        modifications.push(
          `Chuyển đổi batchId từ số lô business key (${testResult.batchId}) sang Technical ID (${legacyBatch.id}).`
        );
      }
    }

    // 2. Kế thừa tccsId nếu phiếu chưa có nhưng lô đã có
    if (!normalized.tccsId && matchedBatch?.tccsId) {
      normalized.tccsId = matchedBatch.tccsId;
      modifications.push(
        `Kế thừa tccsId (${matchedBatch.tccsId}) từ Lô sản xuất ${matchedBatch.id}.`
      );
    } else if (normalized.tccsId && tccsList.length > 0) {
      // Nếu tccsId đang trỏ bằng code thay vì id
      const legacyTccs = tccsList.find((t) => t.code === normalized.tccsId);
      if (legacyTccs && legacyTccs.id !== normalized.tccsId) {
        normalized.tccsId = legacyTccs.id;
        modifications.push(
          `Chuyển đổi tccsId từ mã (${testResult.tccsId}) sang Technical ID (${legacyTccs.id}).`
        );
      }
    }

    // 3. Chuẩn hóa labId nếu có Master Data phòng lab
    if (laboratories.length > 0) {
      if (!normalized.labId && normalized.labName) {
        const found = laboratories.find(
          (l) =>
            l.canonicalName.toLowerCase() === normalized.labName.trim().toLowerCase() ||
            l.code.toLowerCase() === normalized.labName.trim().toLowerCase() ||
            (l.aliases &&
              l.aliases.some((a) => a.toLowerCase() === normalized.labName.trim().toLowerCase()))
        );
        if (found) {
          normalized.labId = found.id;
          modifications.push(
            `Chuẩn hóa labId thành '${found.id}' dựa trên tên '${normalized.labName}'.`
          );
        }
      } else if (normalized.labId) {
        const legacyLab = laboratories.find(
          (l) =>
            l.code.toLowerCase() === normalized.labId?.toLowerCase() ||
            l.canonicalName.toLowerCase() === normalized.labId?.toLowerCase()
        );
        if (legacyLab && legacyLab.id !== normalized.labId) {
          normalized.labId = legacyLab.id;
          modifications.push(
            `Chuyển đổi labId từ '${testResult.labId}' sang Technical ID '${legacyLab.id}'.`
          );
        }
      }
    }

    return { normalized, modifications };
  }

  /**
   * Kiểm tra và kiểm toán toàn bộ trạng thái tính toàn vẹn định danh của hệ thống (Master Identity Audit)
   */
  public static auditSystemEntityIdentities(data: {
    testResults: TestResult[];
    batches: Batch[];
    products: Product[];
    tccsList: TCCS[];
    laboratories?: TestingLaboratory[];
  }): SystemIdentityAuditSummary {
    const { testResults, batches, products, tccsList, laboratories = [] } = data;

    // 1. Kiểm tra trùng lặp ID
    const duplicates: DuplicateIdentityReport[] = [
      this.detectDuplicateIdentities(products, 'PRODUCT'),
      this.detectDuplicateIdentities(batches, 'BATCH'),
      this.detectDuplicateIdentities(testResults, 'TEST_RESULT'),
      this.detectDuplicateIdentities(tccsList, 'TCCS'),
      this.detectDuplicateIdentities(laboratories, 'LABORATORY'),
    ];

    // 2. Kiểm tra mồ côi
    const orphans = this.detectOrphanEntities({
      testResults,
      batches,
      products,
      tccsList,
    });

    // 3. Kiểm tra liên kết hỏng
    const brokenReferences = this.detectBrokenReferences({
      testResults,
      batches,
      products,
      tccsList,
      laboratories,
    });

    // Phân loại đếm
    let primaryCount = 0;
    let legacyBusinessKeyCount = 0;
    let brokenOrphanCount = 0;
    let emptyReferenceCount = 0;

    for (const b of brokenReferences) {
      if (b.classification === 'PRIMARY') primaryCount++;
      else if (b.classification === 'LEGACY_BUSINESS_KEY') legacyBusinessKeyCount++;
      else if (b.classification === 'BROKEN_ORPHAN') brokenOrphanCount++;
      else if (b.classification === 'EMPTY_REFERENCE') emptyReferenceCount++;
    }

    // Tính điểm sức khỏe hệ thống (Health Score)
    const hasAnyDuplicate = duplicates.some((d) => d.hasDuplicates);
    let penalty = 0;
    if (hasAnyDuplicate) penalty += 30;
    penalty += Math.min(40, brokenOrphanCount * 5);
    penalty += Math.min(20, legacyBusinessKeyCount * 2);
    penalty += Math.min(10, emptyReferenceCount * 1);

    const healthScore = Math.max(0, 100 - penalty);
    const isHealthy = healthScore >= 95 && brokenOrphanCount === 0 && !hasAnyDuplicate;

    return {
      timestamp: new Date().toISOString(),
      totalEntities: {
        products: products.length,
        batches: batches.length,
        testResults: testResults.length,
        tccs: tccsList.length,
        laboratories: laboratories.length,
      },
      classificationCounts: {
        primary: primaryCount,
        legacyBusinessKey: legacyBusinessKeyCount,
        brokenOrphan: brokenOrphanCount,
        emptyReference: emptyReferenceCount,
      },
      duplicates,
      orphans,
      brokenReferences,
      isHealthy,
      healthScore,
    };
  }

  /**
   * Xác thực liên kết Formula và Product (Formula.productId === Product.id)
   */
  public static validateFormulaProduct(
    formula: ProductFormula,
    products: Product[]
  ): IdentityRelationshipValidationResult {
    const targetProduct = products.find((p) => p.id === formula.productId);
    if (!targetProduct) {
      return {
        isValid: false,
        relationship: 'FORMULA_PRODUCT',
        sourceEntityId: formula.id,
        sourceEntityType: 'FORMULA',
        targetEntityId: formula.productId,
        targetEntityType: 'PRODUCT',
        classification: 'BROKEN_ORPHAN',
        error: `Công thức ${formula.id} trỏ đến productId không tồn tại: ${formula.productId}`,
      };
    }
    return {
      isValid: true,
      relationship: 'FORMULA_PRODUCT',
      sourceEntityId: formula.id,
      sourceEntityType: 'FORMULA',
      targetEntityId: formula.productId,
      targetEntityType: 'PRODUCT',
      classification: 'PRIMARY',
    };
  }
}
