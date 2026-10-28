/**
 * PQM Domain - 3-Tier Validation Model (Model 5)
 * ===============================================
 * Xác định tính hợp lệ của dữ liệu trước khi lưu trữ hoặc sử dụng.
 * Triển khai theo kiến trúc Fail-Fast:
 *
 * Tầng 1: Schema Validation (Cấu trúc, trường bắt buộc, kiểu dữ liệu, tính hợp lý của ngày tháng)
 * Tầng 2: Referential Integrity Validation (Tính toàn vẹn tham chiếu, chuẩn Technical ID, không mồ côi)
 * Tầng 3: Business & GMP Consistency Validation (Quy tắc nghiệp vụ, tính nhất quán chỉ tiêu vs trạng thái, niêm phong ALCOA+)
 */

import {
  Product,
  Batch,
  TCCS,
  TestResult,
  TestResultEntry,
  QualityDeviation,
  TestingLaboratory,
  CriterionType,
} from '../../types';
import { EntityIdentityManager } from '../identity/entityIdentity';
import { CanonicalStatusResolver } from '../canonical/canonicalResolver';
import {
  resolveTestResultStatus,
  extractStoredDocumentStatus,
} from '../test-result/testResultStatusResolver';
import { validateEvaluationSnapshot } from '../evaluation/EvaluationSnapshotBuilder';

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

export interface DatasetValidationSummary {
  totalEntities: number;
  validEntities: number;
  invalidEntities: number;
  tier1Failures: number;
  tier2Failures: number;
  tier3Failures: number;
  passRate: number; // 0 - 100%
  isCompliant: boolean;
}

export class ValidationEngine {
  // ===========================================================================
  // TẦNG 1: SCHEMA VALIDATION (Cấu trúc & Định dạng)
  // ===========================================================================

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

    if (!testResult.id || typeof testResult.id !== 'string' || !testResult.id.trim()) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'id',
        message: 'Trường id là bắt buộc và phải là chuỗi không rỗng',
        code: 'SCHEMA_MISSING_ID',
      });
    }

    if (
      !testResult.batchId ||
      typeof testResult.batchId !== 'string' ||
      !testResult.batchId.trim()
    ) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'batchId',
        message: 'Trường batchId là bắt buộc và phải là chuỗi không rỗng',
        code: 'SCHEMA_MISSING_BATCH_ID',
      });
    }

    const validStatuses = ['PASS', 'FAIL', 'PENDING', 'UNKNOWN'];
    if (!testResult.overallStatus || !validStatuses.includes(testResult.overallStatus)) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'overallStatus',
        message: `Trường overallStatus là bắt buộc và phải thuộc [${validStatuses.join(', ')}]`,
        code: 'SCHEMA_INVALID_OVERALL_STATUS',
        expected: validStatuses,
        actual: testResult.overallStatus,
      });
    }

    if (!Array.isArray(testResult.results)) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'results',
        message: 'Trường results phải là mảng chỉ tiêu',
        code: 'SCHEMA_INVALID_RESULTS_ARRAY',
      });
    } else {
      testResult.results.forEach((entry: any, index: number) => {
        if (!entry || typeof entry !== 'object') {
          errors.push({
            tier: 'TIER_1_SCHEMA',
            field: `results[${index}]`,
            message: `Chỉ tiêu thứ ${index + 1} không phải là object hợp lệ`,
            code: 'SCHEMA_INVALID_CRITERION_OBJECT',
          });
          return;
        }

        if (
          !entry.criteriaName ||
          typeof entry.criteriaName !== 'string' ||
          !entry.criteriaName.trim()
        ) {
          errors.push({
            tier: 'TIER_1_SCHEMA',
            field: `results[${index}].criteriaName`,
            message: `Chỉ tiêu thứ ${index + 1} thiếu tên chỉ tiêu (criteriaName)`,
            code: 'SCHEMA_MISSING_CRITERIA_NAME',
          });
        }

        if (
          entry.isPass !== null &&
          entry.isPass !== undefined &&
          typeof entry.isPass !== 'boolean'
        ) {
          errors.push({
            tier: 'TIER_1_SCHEMA',
            field: `results[${index}].isPass`,
            message: `Trường isPass của chỉ tiêu '${entry.criteriaName || index}' phải là boolean hoặc null`,
            code: 'SCHEMA_INVALID_IS_PASS_TYPE',
            expected: 'boolean | null',
            actual: typeof entry.isPass,
          });
        }
      });
    }

    return errors;
  }

  /**
   * Tầng 1: Schema Validation cho Batch (Lô sản xuất)
   */
  public static validateBatchSchema(batch: any): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];

    if (!batch || typeof batch !== 'object') {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'root',
        message: 'Đối tượng Batch không hợp lệ',
        code: 'SCHEMA_INVALID_OBJECT',
      });
      return errors;
    }

    if (!batch.id || typeof batch.id !== 'string' || !batch.id.trim()) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'id',
        message: 'Thiếu id lô sản xuất',
        code: 'SCHEMA_MISSING_ID',
      });
    }

    if (!batch.productId || typeof batch.productId !== 'string' || !batch.productId.trim()) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'productId',
        message: 'Thiếu productId',
        code: 'SCHEMA_MISSING_PRODUCT_ID',
      });
    }

    if (!batch.tccsId || typeof batch.tccsId !== 'string' || !batch.tccsId.trim()) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'tccsId',
        message: 'Thiếu tccsId',
        code: 'SCHEMA_MISSING_TCCS_ID',
      });
    }

    if (!batch.batchNo || typeof batch.batchNo !== 'string' || !batch.batchNo.trim()) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'batchNo',
        message: 'Thiếu số lô sản xuất (batchNo)',
        code: 'SCHEMA_MISSING_BATCH_NO',
      });
    }

    if (!batch.mfgDate || typeof batch.mfgDate !== 'string') {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'mfgDate',
        message: 'Thiếu ngày sản xuất (mfgDate)',
        code: 'SCHEMA_MISSING_MFG_DATE',
      });
    }

    if (!batch.expDate || typeof batch.expDate !== 'string') {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'expDate',
        message: 'Thiếu hạn dùng (expDate)',
        code: 'SCHEMA_MISSING_EXP_DATE',
      });
    }

    // Kiểm tra tính hợp lý của thời gian (expDate >= mfgDate)
    if (batch.mfgDate && batch.expDate) {
      const mfg = new Date(batch.mfgDate).getTime();
      const exp = new Date(batch.expDate).getTime();
      if (!isNaN(mfg) && !isNaN(exp) && exp < mfg) {
        errors.push({
          tier: 'TIER_1_SCHEMA',
          field: 'expDate',
          message: `Hạn dùng (${batch.expDate}) không thể trước ngày sản xuất (${batch.mfgDate})`,
          code: 'SCHEMA_EXP_BEFORE_MFG',
          expected: `>= ${batch.mfgDate}`,
          actual: batch.expDate,
        });
      }
    }

    return errors;
  }

  /**
   * Tầng 1: Schema Validation cho TCCS
   */
  public static validateTCCSSchema(tccs: any): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];

    if (!tccs || typeof tccs !== 'object') {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'root',
        message: 'Đối tượng TCCS không hợp lệ',
        code: 'SCHEMA_INVALID_OBJECT',
      });
      return errors;
    }

    if (!tccs.id || typeof tccs.id !== 'string' || !tccs.id.trim()) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'id',
        message: 'Thiếu id TCCS',
        code: 'SCHEMA_MISSING_ID',
      });
    }

    if (!tccs.productId || typeof tccs.productId !== 'string' || !tccs.productId.trim()) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'productId',
        message: 'Thiếu productId trong TCCS',
        code: 'SCHEMA_MISSING_PRODUCT_ID',
      });
    }

    if (!tccs.code || typeof tccs.code !== 'string' || !tccs.code.trim()) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'code',
        message: 'Thiếu mã tiêu chuẩn (code)',
        code: 'SCHEMA_MISSING_CODE',
      });
    }

    if (!Array.isArray(tccs.mainQualityCriteria)) {
      errors.push({
        tier: 'TIER_1_SCHEMA',
        field: 'mainQualityCriteria',
        message: 'Trường mainQualityCriteria phải là mảng chỉ tiêu chất lượng chính',
        code: 'SCHEMA_INVALID_CRITERIA_ARRAY',
      });
    }

    return errors;
  }

  // ===========================================================================
  // TẦNG 2: REFERENTIAL INTEGRITY VALIDATION (Tính Toàn Vẹn Tham Chiếu)
  // ===========================================================================

  /**
   * Tầng 2: Referential Validation cho TestResult
   */
  public static validateTestResultReferential(
    testResult: TestResult,
    batches: Batch[],
    tccsList: TCCS[] = [],
    laboratories: TestingLaboratory[] = []
  ): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];

    // 1. Kiểm tra khóa ngoại batchId (Technical ID Primary)
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

    // 2. Kiểm tra khóa ngoại tccsId nếu có
    if (testResult.tccsId && tccsList.length > 0) {
      const tccsCheck = EntityIdentityManager.validateTestResultTCCS(testResult, tccsList);
      if (!tccsCheck.isValid) {
        errors.push({
          tier: 'TIER_2_REFERENTIAL',
          field: 'tccsId',
          message: tccsCheck.error || 'Khóa ngoại tccsId không tồn tại',
          code: tccsCheck.isLegacyMatch ? 'REF_LEGACY_TCCS_CODE' : 'REF_ORPHAN_TCCS',
          expected: 'TCCS.id hợp lệ',
          actual: testResult.tccsId,
        });
      }
    }

    // 3. Kiểm tra khóa ngoại labId nếu có
    if (testResult.labId && laboratories.length > 0) {
      const labCheck = EntityIdentityManager.validateTestResultLab(testResult, laboratories);
      if (!labCheck.isValid && labCheck.classification === 'BROKEN_ORPHAN') {
        errors.push({
          tier: 'TIER_2_REFERENTIAL',
          field: 'labId',
          message: labCheck.error || 'Khóa ngoại labId không tồn tại',
          code: 'REF_ORPHAN_LAB_ID',
          expected: 'TestingLaboratory.id hợp lệ',
          actual: testResult.labId,
        });
      }
    }

    return errors;
  }

  /**
   * Tầng 2: Referential Validation cho Batch (Lô sản xuất)
   */
  public static validateBatchReferential(
    batch: Batch,
    products: Product[],
    tccsList: TCCS[]
  ): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];

    // 1. Đối chiếu Product
    const productCheck = EntityIdentityManager.validateBatchProduct(batch, products);
    if (!productCheck.isValid) {
      errors.push({
        tier: 'TIER_2_REFERENTIAL',
        field: 'productId',
        message: productCheck.error || 'Khóa ngoại productId không tồn tại',
        code: productCheck.isLegacyMatch ? 'REF_LEGACY_PRODUCT_CODE' : 'REF_PRODUCT_NOT_FOUND',
        expected: 'Product.id hợp lệ',
        actual: batch.productId,
      });
    }

    // 2. Đối chiếu TCCS
    const tccsCheck = EntityIdentityManager.validateBatchTCCS(batch, tccsList);
    if (!tccsCheck.isValid) {
      const isCross = tccsCheck.relationship === 'BATCH_TCCS_CROSS_PRODUCT';
      errors.push({
        tier: 'TIER_2_REFERENTIAL',
        field: 'tccsId',
        message: tccsCheck.error || 'Khóa ngoại tccsId không hợp lệ',
        code: isCross
          ? 'REF_CROSS_PRODUCT_TCCS'
          : tccsCheck.isLegacyMatch
            ? 'REF_LEGACY_TCCS_CODE'
            : 'REF_TCCS_INVALID',
        expected: isCross ? `TCCS thuộc Product ${batch.productId}` : 'TCCS.id hợp lệ',
        actual: batch.tccsId,
      });
    }

    return errors;
  }

  /**
   * Tầng 2: Referential Validation cho TCCS
   */
  public static validateTCCSReferential(tccs: TCCS, products: Product[]): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    const targetProduct = products.find((p) => p.id === tccs.productId);
    if (!targetProduct) {
      errors.push({
        tier: 'TIER_2_REFERENTIAL',
        field: 'productId',
        message: `TCCS ${tccs.code} trỏ đến productId không tồn tại: ${tccs.productId}`,
        code: 'REF_PRODUCT_NOT_FOUND',
        expected: 'Product.id hợp lệ',
        actual: tccs.productId,
      });
    }
    return errors;
  }

  // ===========================================================================
  // TẦNG 3: BUSINESS & GMP CONSISTENCY VALIDATION (Quy Tắc Nghiệp Vụ)
  // ===========================================================================

  /**
   * Tầng 3: Business Validation cho TestResult (tính nhất quán logic chỉ tiêu vs overallStatus & snapshot)
   */
  public static validateTestResultBusiness(
    testResult: TestResult,
    boundTccs?: TCCS | null
  ): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    const storedStatus = extractStoredDocumentStatus(testResult);
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

    // Business Rule 3: Kiểm tra tính toàn vẹn ALCOA+ Evaluation Snapshot (nếu có)
    if (testResult.evaluationSnapshot) {
      const snapCheck = validateEvaluationSnapshot(
        testResult.evaluationSnapshot,
        testResult,
        boundTccs
      );
      if (!snapCheck.isValid) {
        errors.push({
          tier: 'TIER_3_BUSINESS',
          field: 'evaluationSnapshot',
          message: `Evaluation Snapshot không hợp lệ hoặc đã bị thay đổi dữ liệu: ${snapCheck.reason}`,
          code: 'BIZ_SNAPSHOT_INVALID',
          expected: 'Valid SHA-256 sealed snapshot',
          actual: snapCheck.reason,
        });
      }
    }

    return errors;
  }

  /**
   * Tầng 3: Business Validation cho Batch (Lô sản xuất)
   */
  public static validateBatchBusiness(
    batch: Batch,
    testResults: TestResult[],
    tccs?: TCCS,
    deviations: QualityDeviation[] = []
  ): { errors: ValidationErrorItem[]; warnings: string[] } {
    const errors: ValidationErrorItem[] = [];
    const warnings: string[] = [];

    // Business Rule 1: Nếu Batch RELEASED thì bắt buộc phải có kết quả kiểm nghiệm PASS
    if (batch.status === 'RELEASED') {
      const qualityRes = CanonicalStatusResolver.resolveBatchQuality(batch, testResults, tccs);
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

      // Business Rule 2: Lô xuất xưởng không được có hồ sơ sai lệch CRITICAL đang mở
      const openCriticalDev = deviations.find(
        (d) =>
          (d.batchId === batch.id || (d.batchNo && d.batchNo === batch.batchNo)) &&
          d.severity === 'CRITICAL' &&
          d.status !== 'CLOSED'
      );
      if (openCriticalDev) {
        errors.push({
          tier: 'TIER_3_BUSINESS',
          field: 'status',
          message: `Lô đã xuất xưởng nhưng vẫn tồn tại hồ sơ sai lệch CRITICAL chưa đóng: ${openCriticalDev.deviationNo} (${openCriticalDev.title})`,
          code: 'BIZ_RELEASE_BLOCKED_BY_OPEN_DEVIATION',
          expected: 'CLOSED',
          actual: openCriticalDev.status,
        });
      }
    }

    // Business Rule 3: Lô REJECTED nên có lý do từ chối
    if (batch.status === 'REJECTED' && (!batch.rejectReason || batch.rejectReason.trim() === '')) {
      warnings.push('Lô bị từ chối (REJECTED) nhưng chưa ghi rõ lý do từ chối.');
    }

    return { errors, warnings };
  }

  /**
   * Tầng 3: Business Validation cho TCCS
   */
  public static validateTCCSBusiness(tccs: TCCS): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    const allCriteria = [...(tccs.mainQualityCriteria || []), ...(tccs.safetyCriteria || [])];

    // Kiểm tra trùng lặp tên chỉ tiêu
    const nameMap = new Set<string>();
    allCriteria.forEach((c, index) => {
      if (c && c.name) {
        const norm = c.name.trim().toLowerCase();
        if (nameMap.has(norm)) {
          errors.push({
            tier: 'TIER_3_BUSINESS',
            field: `criteria[${index}].name`,
            message: `TCCS có chỉ tiêu bị trùng lặp tên: '${c.name}'`,
            code: 'BIZ_DUPLICATE_CRITERIA_NAME',
          });
        }
        nameMap.add(norm);
      }

      // Kiểm tra min <= max cho chỉ tiêu số
      if (
        c &&
        c.min !== undefined &&
        c.max !== undefined &&
        c.min !== null &&
        c.max !== null &&
        c.min > c.max
      ) {
        errors.push({
          tier: 'TIER_3_BUSINESS',
          field: `criteria[${index}].min`,
          message: `Chỉ tiêu '${c.name}' có giới hạn dưới (${c.min}) lớn hơn giới hạn trên (${c.max})`,
          code: 'BIZ_CRITERIA_MIN_GT_MAX',
          expected: `min <= ${c.max}`,
          actual: `min = ${c.min}`,
        });
      }
    });

    return errors;
  }

  // ===========================================================================
  // UNIFIED 3-TIER ORCHESTRATION (Điều Phối Toàn Diện)
  // ===========================================================================

  /**
   * Thực hiện đầy đủ 3 Tầng Validation cho Phiếu kiểm nghiệm (Fail-Fast)
   */
  public static validateTestResult(
    testResult: any,
    batches: Batch[],
    boundTccs?: TCCS | null,
    laboratories?: TestingLaboratory[]
  ): TieredValidationResult {
    const allErrors: ValidationErrorItem[] = [];
    const warnings: string[] = [];

    // Tầng 1: Schema
    const tier1Errors = this.validateTestResultSchema(testResult);
    allErrors.push(...tier1Errors);
    const tier1Passed = tier1Errors.length === 0;

    let tier2Passed = false;
    let tier3Passed = false;

    // Fail-fast: Chỉ kiểm tra tầng tiếp theo nếu tầng trước đạt chuẩn
    if (tier1Passed) {
      // Tầng 2: Referential
      const tier2Errors = this.validateTestResultReferential(
        testResult as TestResult,
        batches,
        boundTccs ? [boundTccs] : [],
        laboratories
      );
      allErrors.push(...tier2Errors);
      tier2Passed = tier2Errors.length === 0;

      if (tier2Passed) {
        // Tầng 3: Business
        const tier3Errors = this.validateTestResultBusiness(testResult as TestResult, boundTccs);
        allErrors.push(...tier3Errors);
        tier3Passed = tier3Errors.length === 0;
      }
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
   * Thực hiện đầy đủ 3 Tầng Validation cho Lô sản xuất (Batch)
   */
  public static validateBatch(
    batch: any,
    products: Product[],
    tccsList: TCCS[],
    testResults: TestResult[],
    deviations?: QualityDeviation[]
  ): TieredValidationResult {
    const allErrors: ValidationErrorItem[] = [];
    const warnings: string[] = [];

    // Tầng 1: Schema
    const tier1Errors = this.validateBatchSchema(batch);
    allErrors.push(...tier1Errors);
    const tier1Passed = tier1Errors.length === 0;

    let tier2Passed = false;
    let tier3Passed = false;

    if (tier1Passed) {
      // Tầng 2: Referential
      const tier2Errors = this.validateBatchReferential(batch as Batch, products, tccsList);
      allErrors.push(...tier2Errors);
      tier2Passed = tier2Errors.length === 0;

      if (tier2Passed) {
        // Tầng 3: Business
        const boundTccs = tccsList.find((t) => t.id === batch.tccsId);
        const { errors: tier3Errors, warnings: tier3Warnings } = this.validateBatchBusiness(
          batch as Batch,
          testResults,
          boundTccs,
          deviations
        );
        allErrors.push(...tier3Errors);
        warnings.push(...tier3Warnings);
        tier3Passed = tier3Errors.length === 0;
      }
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
   * Thực hiện đầy đủ 3 Tầng Validation cho Tiêu chuẩn cơ sở (TCCS)
   */
  public static validateTCCS(tccs: any, products: Product[]): TieredValidationResult {
    const allErrors: ValidationErrorItem[] = [];
    const warnings: string[] = [];

    // Tầng 1: Schema
    const tier1Errors = this.validateTCCSSchema(tccs);
    allErrors.push(...tier1Errors);
    const tier1Passed = tier1Errors.length === 0;

    let tier2Passed = false;
    let tier3Passed = false;

    if (tier1Passed) {
      // Tầng 2: Referential
      const tier2Errors = this.validateTCCSReferential(tccs as TCCS, products);
      allErrors.push(...tier2Errors);
      tier2Passed = tier2Errors.length === 0;

      if (tier2Passed) {
        // Tầng 3: Business
        const tier3Errors = this.validateTCCSBusiness(tccs as TCCS);
        allErrors.push(...tier3Errors);
        tier3Passed = tier3Errors.length === 0;
      }
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
   * Kiểm toán tính hợp lệ toàn diện của toàn bộ cơ sở dữ liệu (Complete Dataset Validation)
   */
  public static validateCompleteDataset(dataset: {
    products: Product[];
    batches: Batch[];
    tccsList: TCCS[];
    testResults: TestResult[];
    deviations?: QualityDeviation[];
    laboratories?: TestingLaboratory[];
  }): DatasetValidationSummary {
    const {
      products,
      batches,
      tccsList,
      testResults,
      deviations = [],
      laboratories = [],
    } = dataset;

    let totalEntities = 0;
    let validEntities = 0;
    let tier1Failures = 0;
    let tier2Failures = 0;
    let tier3Failures = 0;

    // 1. Kiểm tra toàn bộ Lô
    for (const b of batches) {
      totalEntities++;
      const res = this.validateBatch(b, products, tccsList, testResults, deviations);
      if (res.isValid) {
        validEntities++;
      } else {
        if (!res.tier1Passed) tier1Failures++;
        else if (!res.tier2Passed) tier2Failures++;
        else if (!res.tier3Passed) tier3Failures++;
      }
    }

    // 2. Kiểm tra toàn bộ Phiếu kiểm nghiệm
    for (const tr of testResults) {
      totalEntities++;
      const boundTccs = tccsList.find((t) => t.id === tr.tccsId);
      const res = this.validateTestResult(tr, batches, boundTccs, laboratories);
      if (res.isValid) {
        validEntities++;
      } else {
        if (!res.tier1Passed) tier1Failures++;
        else if (!res.tier2Passed) tier2Failures++;
        else if (!res.tier3Passed) tier3Failures++;
      }
    }

    // 3. Kiểm tra toàn bộ TCCS
    for (const t of tccsList) {
      totalEntities++;
      const res = this.validateTCCS(t, products);
      if (res.isValid) {
        validEntities++;
      } else {
        if (!res.tier1Passed) tier1Failures++;
        else if (!res.tier2Passed) tier2Failures++;
        else if (!res.tier3Passed) tier3Failures++;
      }
    }

    const passRate = totalEntities > 0 ? (validEntities / totalEntities) * 100 : 100;
    const isCompliant = passRate >= 98 && tier1Failures === 0 && tier2Failures === 0;

    return {
      totalEntities,
      validEntities,
      invalidEntities: totalEntities - validEntities,
      tier1Failures,
      tier2Failures,
      tier3Failures,
      passRate: Math.round(passRate * 10) / 10,
      isCompliant,
    };
  }
}
