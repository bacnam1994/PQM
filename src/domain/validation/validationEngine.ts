/**
 * PQM Domain - 3-Tier Validation Model (Model 5)
 * Xác định dữ liệu hợp lệ trước khi sử dụng.
 *
 * Tầng 1: Schema validation (cấu trúc, trường bắt buộc, kiểu dữ liệu)
 * Tầng 2: Referential validation (tính toàn vẹn tham chiếu, tồn tại khóa ngoại)
 * Tầng 3: Business validation (quy tắc nghiệp vụ, tính nhất quán logic)
 */

import { Product, Batch, TCCS, TestResult, TestResultEntry } from '../../types';
import { EntityIdentityManager } from '../identity/entityIdentity';
import { CanonicalStatusResolver } from '../canonical/canonicalResolver';
import { resolveTestResultStatus } from '../test-result/testResultStatusResolver';

export type ValidationTier = 'TIER_1_SCHEMA' | 'TIER_2_REFERENTIAL' | 'TIER_3_BUSINESS';

export interface ValidationErrorItem {
  tier: ValidationTier;
  field: string;
  message: string;
  code: string;
  expected?: any;
  actual?: any;
}

export interface TieredValidationResult {
  isValid: boolean;
  tier1Passed: boolean;
  tier2Passed: boolean;
  tier3Passed: boolean;
  errors: ValidationErrorItem[];
  warnings: string[];
  validatedAt: string;
}

export class ValidationEngine {
  /**
   * Tầng 1: Schema Validation cho TestResult
   */
  public static validateTestResultSchema(testResult: any): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];

    if (!testResult || typeof testResult !== 'object') {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'root',
        message: 'Đối tượng TestResult không hợp lệ (null/undefined hoặc không phải object)',
        code: 'SCHEMA_INVALID_OBJECT',
      });
      return errors;
    }

    if (!testResult.id || typeof testResult.id !== 'string') {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'id',
        message: 'Trường id là bắt buộc và phải là chuỗi',
        code: 'SCHEMA_MISSING_ID',
      });
    }

    if (!testResult.batchId || typeof testResult.batchId !== 'string') {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'batchId',
        message: 'Trường batchId là bắt buộc và phải là chuỗi',
        code: 'SCHEMA_MISSING_BATCH_ID',
      });
    }

    if (!testResult.overallStatus) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'overallStatus',
        message: 'Trường overallStatus là bắt buộc',
        code: 'SCHEMA_MISSING_OVERALL_STATUS',
      });
    }

    if (!Array.isArray(testResult.results)) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'results',
        message: 'Trường results phải là mảng chỉ tiêu',
        code: 'SCHEMA_INVALID_RESULTS_ARRAY',
      });
    }

    return errors;
  }

  /**
   * Tầng 2: Referential Validation cho TestResult (đối chiếu Batch)
   */
  public static validateTestResultReferential(
    testResult: TestResult,
    batches: Batch[]
  ): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    const relationCheck = EntityIdentityManager.validateTestResultBatch(testResult, batches);

    if (!relationCheck.isValid) {
      errors.push({
        tier: 'TIER_2_REFERENTIAL',
        field: 'batchId',
        message: relationCheck.error || 'Khóa ngoại batchId không hợp lệ',
        code: relationCheck.isLegacyMatch ? 'REF_LEGACY_BATCH_NO' : 'REF_ORPHAN_FOREIGN_KEY',
        expected: 'Batch.id hợp lệ',
        actual: testResult.batchId,
      });
    }

    return errors;
  }

  /**
   * Tầng 3: Business Validation cho TestResult (tính nhất quán logic chỉ tiêu vs overallStatus)
   */
  public static validateTestResultBusiness(
    testResult: TestResult,
    boundTccs?: TCCS | null
  ): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    const storedStatus = resolveTestResultStatus(testResult);
    const calculatedTestStatus = CanonicalStatusResolver.calculateCanonicalTestStatus(
      testResult,
      boundTccs
    );

    // Business Rule 1: Nếu tính toán chỉ tiêu là FAIL nhưng storedStatus là PASS
    if (calculatedTestStatus === 'FAIL' && storedStatus === 'PASS') {
      errors.push({
        tier: 'TIER_3_BUSINESS',
        field: 'overallStatus',
        message:
          'Sai lệch nghiệp vụ: overallStatus là PASS nhưng các chỉ tiêu thực tế đánh giá là FAIL',
        code: 'BIZ_STATUS_CRITERIA_MISMATCH',
        expected: 'FAIL',
        actual: testResult.overallStatus,
      });
    }

    // Business Rule 2: Nếu tính toán chỉ tiêu là PASS nhưng storedStatus là FAIL
    if (calculatedTestStatus === 'PASS' && storedStatus === 'FAIL') {
      errors.push({
        tier: 'TIER_3_BUSINESS',
        field: 'overallStatus',
        message:
          'Sai lệch nghiệp vụ: Tất cả chỉ tiêu đều ĐẠT nhưng overallStatus lại ghi nhận FAIL',
        code: 'BIZ_ALL_PASS_BUT_STATUS_FAIL',
        expected: 'PASS',
        actual: testResult.overallStatus,
      });
    }

    return errors;
  }

  /**
   * Thực hiện đầy đủ 3 Tầng Validation cho một Phiếu kiểm nghiệm
   */
  public static validateTestResult(
    testResult: any,
    batches: Batch[],
    boundTccs?: TCCS | null
  ): TieredValidationResult {
    const allErrors: ValidationErrorItem[] = [];
    const warnings: string[] = [];

    // Tầng 1
    const tier1Errors = this.validateTestResultSchema(testResult);
    allErrors.push(...tier1Errors);
    const tier1Passed = tier1Errors.length === 0;

    let tier2Passed = false;
    let tier3Passed = false;

    if (tier1Passed) {
      // Tầng 2
      const tier2Errors = this.validateTestResultReferential(testResult as TestResult, batches);
      allErrors.push(...tier2Errors);
      tier2Passed = tier2Errors.length === 0;

      // Tầng 3
      const tier3Errors = this.validateTestResultBusiness(testResult as TestResult, boundTccs);
      allErrors.push(...tier3Errors);
      tier3Passed = tier3Errors.length === 0;
    }

    return {
      isValid: allErrors.length === 0,
      tier1Passed,
      tier2Passed,
      tier3Passed,
      errors: allErrors,
      warnings,
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * 3 Tầng Validation cho Lô sản xuất (Batch)
   */
  public static validateBatch(
    batch: any,
    products: Product[],
    tccsList: TCCS[],
    testResults: TestResult[]
  ): TieredValidationResult {
    const errors: ValidationErrorItem[] = [];
    const warnings: string[] = [];

    // Tầng 1: Schema
    if (!batch || typeof batch !== 'object') {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'root',
        message: 'Đối tượng Batch không hợp lệ',
        code: 'SCHEMA_INVALID_OBJECT',
      });
      return {
        isValid: false,
        tier1Passed: false,
        tier2Passed: false,
        tier3Passed: false,
        errors,
        warnings,
        validatedAt: new Date().toISOString(),
      };
    }

    if (!batch.id)
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'id',
        message: 'Thiếu id lô',
        code: 'SCHEMA_MISSING_ID',
      });
    if (!batch.productId)
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'productId',
        message: 'Thiếu productId',
        code: 'SCHEMA_MISSING_PRODUCT_ID',
      });
    if (!batch.tccsId)
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'tccsId',
        message: 'Thiếu tccsId',
        code: 'SCHEMA_MISSING_TCCS_ID',
      });
    if (!batch.batchNo)
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'batchNo',
        message: 'Thiếu batchNo',
        code: 'SCHEMA_MISSING_BATCH_NO',
      });

    const tier1Passed = errors.length === 0;
    let tier2Passed = false;
    let tier3Passed = false;

    if (tier1Passed) {
      // Tầng 2: Referential
      const productCheck = EntityIdentityManager.validateBatchProduct(batch as Batch, products);
      if (!productCheck.isValid) {
        errors.push({
          tier: 'TIER_2_REFERENTIAL',
          field: 'productId',
          message: productCheck.error || 'Khóa ngoại productId không tồn tại',
          code: 'REF_PRODUCT_NOT_FOUND',
        });
      }

      const tccsCheck = EntityIdentityManager.validateBatchTCCS(batch as Batch, tccsList);
      if (!tccsCheck.isValid) {
        errors.push({
          tier: 'TIER_2_REFERENTIAL',
          field: 'tccsId',
          message: tccsCheck.error || 'Khóa ngoại tccsId không hợp lệ',
          code: 'REF_TCCS_INVALID',
        });
      }

      tier2Passed = errors.filter((e) => e.tier === 'TIER_2_REFERENTIAL').length === 0;

      // Tầng 3: Business
      // Nếu Batch RELEASED thì phải có phiếu kiểm nghiệm PASS
      if (batch.status === 'RELEASED') {
        const qualityRes = CanonicalStatusResolver.resolveBatchQuality(
          batch as Batch,
          testResults,
          tccsList.find((t) => t.id === batch.tccsId)
        );
        if (qualityRes.batchQualityStatus !== 'PASS') {
          errors.push({
            tier: 'TIER_3_BUSINESS',
            field: 'status',
            message: 'Lô đã xuất xưởng (RELEASED) nhưng kết quả kiểm nghiệm không đạt chuẩn PASS.',
            code: 'BIZ_RELEASED_WITHOUT_PASSING_TEST',
            expected: 'PASS',
            actual: qualityRes.batchQualityStatus,
          });
        }
      }

      // Nếu Batch REJECTED mà không có lý do
      if (
        batch.status === 'REJECTED' &&
        (!batch.rejectReason || batch.rejectReason.trim() === '')
      ) {
        warnings.push('Lô bị từ chối (REJECTED) nhưng chưa ghi rõ lý do từ chối.');
      }

      tier3Passed = errors.filter((e) => e.tier === 'TIER_3_BUSINESS').length === 0;
    }

    return {
      isValid: errors.length === 0,
      tier1Passed,
      tier2Passed,
      tier3Passed,
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
    };
  }
}
