import { describe, it, expect } from 'vitest';
import { buildTestResultIndex, resolveTestResultsForBatch } from './batchTestResultResolver';
import {
  evaluateBatchReleaseIntegrity,
  isValidTestResultForBatch,
} from './batchIntegrityValidator';
import { Batch, TestResult } from '../../types';

describe('Batch Integrity & Relationship Validation Engine', () => {
  const sampleBatch: Batch = {
    id: 'batch_uuid_101',
    productId: 'prod_1',
    tccsId: 'tccs_1',
    batchNo: 'L240101',
    mfgDate: '2024-01-01',
    expDate: '2026-01-01',
    theoreticalYield: 1000,
    actualYield: 990,
    yieldUnit: 'chai',
    status: 'RELEASED',
    createdAt: '2024-01-01T00:00:00Z',
  };

  const samplePassingTest: TestResult = {
    id: 'test_uuid_201',
    batchId: 'batch_uuid_101',
    labName: 'Trung tâm Kiểm nghiệm Quốc gia',
    testDate: '2024-01-05',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Độ ẩm', value: '4.5', isPass: true, unit: '%' },
      { criteriaName: 'Định lượng hoạt chất', value: '99.5', isPass: true, unit: '%' },
    ],
    createdAt: '2024-01-05T00:00:00Z',
  };

  it('Test 1: Batch đã xuất xưởng + TestResult đúng batchId -> PASS, NO ALERT', () => {
    const resolution = resolveTestResultsForBatch(sampleBatch, [samplePassingTest], [sampleBatch]);
    const evaluation = evaluateBatchReleaseIntegrity(sampleBatch, resolution);

    expect(evaluation.integrityStatus).toBe('PASS');
    expect(evaluation.shouldAlert).toBe(false);
    expect(evaluation.relationshipType).toBe('PRIMARY');
    expect(evaluation.validPassCount).toBe(1);
  });

  it('Test 2: Batch đã xuất xưởng + Không có TestResult -> FAIL, MISSING_TEST_RESULT', () => {
    const resolution = resolveTestResultsForBatch(sampleBatch, [], [sampleBatch]);
    const evaluation = evaluateBatchReleaseIntegrity(sampleBatch, resolution);

    expect(evaluation.integrityStatus).toBe('MISSING_TEST_RESULT');
    expect(evaluation.shouldAlert).toBe(true);
    expect(evaluation.alertType).toBe('CRITICAL');
  });

  it('Test 3: Batch đã xuất xưởng + TestResult của Batch khác -> FAIL cho Batch hiện tại', () => {
    const otherBatchTest: TestResult = {
      ...samplePassingTest,
      id: 'test_other_batch',
      batchId: 'batch_different_999',
    };

    const resolution = resolveTestResultsForBatch(sampleBatch, [otherBatchTest], [sampleBatch]);
    const evaluation = evaluateBatchReleaseIntegrity(sampleBatch, resolution);

    expect(evaluation.integrityStatus).toBe('MISSING_TEST_RESULT');
    expect(evaluation.shouldAlert).toBe(true);
  });

  it('Test 4: Batch đã xuất xưởng + TestResult đúng batchId nhưng status invalid/FAIL -> FAIL', () => {
    const failedTest: TestResult = {
      ...samplePassingTest,
      id: 'test_failed',
      overallStatus: 'FAIL',
      results: [{ criteriaName: 'Độ ẩm', value: '9.5', isPass: false, unit: '%' }],
    };

    const resolution = resolveTestResultsForBatch(sampleBatch, [failedTest], [sampleBatch]);
    const evaluation = evaluateBatchReleaseIntegrity(sampleBatch, resolution);

    expect(evaluation.integrityStatus).toBe('TEST_RESULT_INVALID_STATUS');
    expect(evaluation.shouldAlert).toBe(true);
    expect(evaluation.alertType).toBe('CRITICAL');
  });

  it('Test 5: Batch đã xuất xưởng + Nhiều TestResult + Ít nhất một result hợp lệ PASS -> PASS', () => {
    const initialFailTest: TestResult = {
      ...samplePassingTest,
      id: 'test_1_fail',
      testDate: '2024-01-02',
      overallStatus: 'FAIL',
    };
    const retestPassTest: TestResult = {
      ...samplePassingTest,
      id: 'test_2_pass',
      testDate: '2024-01-06',
      overallStatus: 'PASS',
    };

    const resolution = resolveTestResultsForBatch(
      sampleBatch,
      [initialFailTest, retestPassTest],
      [sampleBatch]
    );
    const evaluation = evaluateBatchReleaseIntegrity(sampleBatch, resolution);

    expect(evaluation.integrityStatus).toBe('PASS');
    expect(evaluation.shouldAlert).toBe(false);
  });

  it('Test 6: Batch chưa xuất xưởng (PENDING, TESTING, REJECTED) -> NOT_APPLICABLE, NO ALERT', () => {
    const pendingBatch: Batch = { ...sampleBatch, status: 'PENDING' };
    const testingBatch: Batch = { ...sampleBatch, status: 'TESTING' };
    const rejectedBatch: Batch = { ...sampleBatch, status: 'REJECTED' };

    const resPending = resolveTestResultsForBatch(pendingBatch, [], [pendingBatch]);
    const resTesting = resolveTestResultsForBatch(testingBatch, [], [testingBatch]);
    const resRejected = resolveTestResultsForBatch(rejectedBatch, [], [rejectedBatch]);

    expect(evaluateBatchReleaseIntegrity(pendingBatch, resPending).integrityStatus).toBe(
      'NOT_APPLICABLE'
    );
    expect(evaluateBatchReleaseIntegrity(pendingBatch, resPending).shouldAlert).toBe(false);

    expect(evaluateBatchReleaseIntegrity(testingBatch, resTesting).integrityStatus).toBe(
      'NOT_APPLICABLE'
    );
    expect(evaluateBatchReleaseIntegrity(rejectedBatch, resRejected).integrityStatus).toBe(
      'NOT_APPLICABLE'
    );
  });

  it('Test 7: TestResult tồn tại nhưng orphan -> Phát hiện trong index', () => {
    const orphanTest: TestResult = {
      ...samplePassingTest,
      id: 'test_orphan',
      batchId: 'non_existent_batch_id',
    };

    const index = buildTestResultIndex([orphanTest], [sampleBatch]);
    expect(index.orphanResults.length).toBe(1);
    expect(index.orphanResults[0].id).toBe('test_orphan');
  });

  it('Test 8: Legacy data: batchNo khớp nhưng batchId không khớp -> RELATIONSHIP_ERROR (không coi là missing test)', () => {
    // Phiếu kiểm nghiệm chỉ mang số lô L240101 ở trường batchId hoặc batchNo
    const legacyTest: TestResult = {
      ...samplePassingTest,
      id: 'test_legacy',
      batchId: 'L240101', // dùng batchNo thay vì batch_uuid_101
    };

    const resolution = resolveTestResultsForBatch(sampleBatch, [legacyTest], [sampleBatch]);
    const evaluation = evaluateBatchReleaseIntegrity(sampleBatch, resolution);

    expect(evaluation.integrityStatus).toBe('RELATIONSHIP_ERROR');
    expect(evaluation.shouldAlert).toBe(true);
    expect(evaluation.alertType).toBe('WARNING');
    expect(evaluation.relationshipType).toBe('LEGACY');
  });

  it('Test 9: TestResult chưa load xong (Data Freshness: isTestResultsLoading = true) -> DATA_UNAVAILABLE, KHÔNG tạo alert', () => {
    const resolution = resolveTestResultsForBatch(sampleBatch, [], [sampleBatch]);
    const evaluation = evaluateBatchReleaseIntegrity(sampleBatch, resolution, {
      isTestResultsLoading: true,
      testResultsLoaded: false,
    });

    expect(evaluation.integrityStatus).toBe('DATA_UNAVAILABLE');
    expect(evaluation.shouldAlert).toBe(false);
  });

  it('Test 10: Firebase error -> DATA_UNAVAILABLE, KHÔNG tạo alert', () => {
    const resolution = resolveTestResultsForBatch(sampleBatch, [], [sampleBatch]);
    const evaluation = evaluateBatchReleaseIntegrity(sampleBatch, resolution, {
      isError: true,
    });

    expect(evaluation.integrityStatus).toBe('DATA_UNAVAILABLE');
    expect(evaluation.shouldAlert).toBe(false);
  });

  it('Test Case 272501 (Regression Test Đặc Biệt): Batch 272501 có TestResult hợp lệ liên kết batchId -> KHÔNG BỊ FALSE POSITIVE ALERT', () => {
    const batch272501: Batch = {
      id: '-Nx_batch_272501_real_key',
      productId: 'prod_ginkgo',
      tccsId: 'tccs_standard_01',
      batchNo: '272501',
      mfgDate: '2025-01-15',
      expDate: '2028-01-15',
      theoreticalYield: 50000,
      actualYield: 49500,
      yieldUnit: 'viên',
      status: 'RELEASED',
      createdAt: '2025-01-15T08:00:00Z',
    };

    const testResult272501: TestResult = {
      id: '-Ny_test_result_for_272501',
      batchId: '-Nx_batch_272501_real_key', // Primary Key liên kết đúng Batch.id
      labName: 'Phòng Thử nghiệm V-Biotech QA',
      testDate: '2025-01-20',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Cảm quan', value: 'Viên nén bao phim màu nâu, đồng đều', isPass: true },
        { criteriaName: 'Độ đồng đều khối lượng', value: 'Đạt', isPass: true },
        { criteriaName: 'Định lượng hoạt chất chính', value: 101.2, isPass: true, unit: '%' },
        { criteriaName: 'Giới hạn vi sinh vật', value: 'Âm tính', isPass: true },
      ],
      createdAt: '2025-01-20T10:30:00Z',
    };

    const resolution = resolveTestResultsForBatch(batch272501, [testResult272501], [batch272501]);
    const evaluation = evaluateBatchReleaseIntegrity(batch272501, resolution, {
      testResultsLoaded: true,
      isTestResultsLoading: false,
    });

    expect(evaluation.integrityStatus).toBe('PASS');
    expect(evaluation.shouldAlert).toBe(false);
    expect(evaluation.validPassCount).toBe(1);
    expect(evaluation.relationshipType).toBe('PRIMARY');
    expect(evaluation.matchedTestIds).toContain('-Ny_test_result_for_272501');
  });
});
