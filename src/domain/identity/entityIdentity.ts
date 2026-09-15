/**
 * PQM Domain - Entity Identity Model (Model 3)
 *
 * Mọi quan hệ phải được xác định bằng ID chuẩn.
 * Ví dụ:
 *  Batch.id
 *  TestResult.batchId
 *
 * KHÔNG ĐƯỢC DÙNG:
 *  batchNo
 *  productName
 *  labName
 * để xác định quan hệ chính. Có thể dùng các trường này để tìm kiếm,
 * nhưng KHÔNG dùng làm foreign key logic.
 *
 * Chuẩn quan hệ:
 * Product.id
 *    ↓ productId
 * TCCS.id
 *    ↓ tccsId
 * Batch.id
 *    ↓ batchId
 * TestResult.id
 *    ↓
 * TestResult.criteria[]
 */

import { Product, Batch, TCCS, TestResult, ProductFormula } from '../../types';

export interface IdentityRelationshipValidationResult {
  isValid: boolean;
  relationship: string;
  sourceEntityId: string;
  sourceEntityType: string;
  targetEntityId: string;
  targetEntityType: string;
  error?: string;
  isLegacyMatch?: boolean;
}

export class EntityIdentityManager {
  /**
   * Xác thực liên kết giữa Batch và Product (Batch.productId === Product.id)
   */
  public static validateBatchProduct(
    batch: Batch,
    products: Product[]
  ): IdentityRelationshipValidationResult {
    const targetProduct = products.find((p) => p.id === batch.productId);
    if (!targetProduct) {
      return {
        isValid: false,
        relationship: 'BATCH_PRODUCT',
        sourceEntityId: batch.id,
        sourceEntityType: 'BATCH',
        targetEntityId: batch.productId,
        targetEntityType: 'PRODUCT',
        error: `Lô ${batch.batchNo || batch.id} trỏ đến productId không tồn tại: ${batch.productId}`,
      };
    }
    return {
      isValid: true,
      relationship: 'BATCH_PRODUCT',
      sourceEntityId: batch.id,
      sourceEntityType: 'BATCH',
      targetEntityId: batch.productId,
      targetEntityType: 'PRODUCT',
    };
  }

  /**
   * Xác thực liên kết giữa Batch và TCCS (Batch.tccsId === TCCS.id)
   */
  public static validateBatchTCCS(
    batch: Batch,
    tccsList: TCCS[]
  ): IdentityRelationshipValidationResult {
    const targetTCCS = tccsList.find((t) => t.id === batch.tccsId);
    if (!targetTCCS) {
      return {
        isValid: false,
        relationship: 'BATCH_TCCS',
        sourceEntityId: batch.id,
        sourceEntityType: 'BATCH',
        targetEntityId: batch.tccsId,
        targetEntityType: 'TCCS',
        error: `Lô ${batch.batchNo || batch.id} trỏ đến tccsId không tồn tại: ${batch.tccsId}`,
      };
    }

    // Đảm bảo TCCS thuộc đúng Product của Batch
    if (targetTCCS.productId !== batch.productId) {
      return {
        isValid: false,
        relationship: 'BATCH_TCCS_CROSS_PRODUCT',
        sourceEntityId: batch.id,
        sourceEntityType: 'BATCH',
        targetEntityId: batch.tccsId,
        targetEntityType: 'TCCS',
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
      error: `Phiếu kiểm nghiệm ${testResult.id} có batchId (${testResult.batchId}) không tồn tại trong danh mục Lô.`,
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
    };
  }
}
