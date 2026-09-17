import { describe, it, expect } from 'vitest';
import {
  normalizeTestResultStatus,
  resolveCanonicalTestStatus,
  normalizeCriterionPassStatus,
  resolveTestResultStatus,
  calculateOverallStatusForTestResult,
  resolveFinalTestResultForBatch,
  resolveAuthoritativeTestResultForBatch,
  resolveAuthoritativeTestResultsForBatch,
  detectTestResultStatusMismatch,
} from './testResultStatusResolver';
import { CanonicalStatusResolver } from '../canonical/canonicalResolver';
import { Batch, TestResult, TCCS } from '../../types';

describe('Canonical Test Result Status Resolver & Mismatch Detector', () => {
  // =========================================================================
  // 1. NORMALIZATION TESTS (Mục 7 & 8)
  // =========================================================================
  describe('normalizeTestResultStatus & resolveCanonicalTestStatus', () => {
    it('normalizes various representations of PASS correctly', () => {
      const passVariants = [
        'PASS',
        'pass',
        'Passed',
        'passed',
        'Đạt',
        'đạt',
        'ĐẠT',
        'DAT',
        'dat',
        'OK',
        'APPROVED',
        true,
        1,
      ];
      passVariants.forEach((v) => {
        expect(normalizeTestResultStatus(v)).toBe('PASS');
        expect(resolveCanonicalTestStatus(v)).toBe('PASS');
      });
    });

    it('normalizes various representations of FAIL correctly', () => {
      const failVariants = [
        'FAIL',
        'fail',
        'Failed',
        'failed',
        'Không đạt',
        'không đạt',
        'KHÔNG ĐẠT',
        'KHONG_DAT',
        'KHONG DAT',
        'REJECTED',
        'OOS',
        false,
        0,
      ];
      failVariants.forEach((v) => {
        expect(normalizeTestResultStatus(v)).toBe('FAIL');
        expect(resolveCanonicalTestStatus(v)).toBe('FAIL');
      });
    });

    it('normalizes PENDING correctly and does NOT treat as FAIL', () => {
      const pendingVariants = [
        'PENDING',
        'pending',
        'Đang kiểm nghiệm',
        'Chưa có kết luận',
        'DRAFT',
        'nháp',
        'TESTING',
        'IN_PROGRESS',
      ];
      pendingVariants.forEach((v) => {
        expect(normalizeTestResultStatus(v)).toBe('PENDING');
        expect(resolveCanonicalTestStatus(v)).toBe('PENDING');
      });
    });

    it('returns UNKNOWN for null, undefined, empty and does NOT treat as FAIL', () => {
      expect(normalizeTestResultStatus(undefined)).toBe('UNKNOWN');
      expect(normalizeTestResultStatus(null)).toBe('UNKNOWN');
      expect(normalizeTestResultStatus('')).toBe('UNKNOWN');
      expect(normalizeTestResultStatus('   ')).toBe('UNKNOWN');
      expect(normalizeTestResultStatus('N/A')).toBe('UNKNOWN');
      expect(resolveCanonicalTestStatus(undefined)).toBe('UNKNOWN');
    });
  });

  // =========================================================================
  // 2. FIELD RESOLUTION ON TEST RESULT (Mục 3 & 4)
  // =========================================================================
  describe('resolveTestResultStatus', () => {
    it('reads overallStatus first', () => {
      const tr: any = { overallStatus: 'Đạt' };
      expect(resolveTestResultStatus(tr)).toBe('PASS');
    });

    it('falls back to status if overallStatus is absent', () => {
      const tr: any = { status: 'APPROVED' };
      expect(resolveTestResultStatus(tr)).toBe('PASS');
    });

    it('falls back to overallResult if present', () => {
      const tr: any = { overallResult: 'FAIL' };
      expect(resolveTestResultStatus(tr)).toBe('FAIL');
    });

    it('falls back to conclusion / result if present', () => {
      const tr: any = { conclusion: 'Đạt tiêu chuẩn' };
      expect(resolveTestResultStatus(tr)).toBe('PASS');
    });

    it('resolves boolean isPassed / passed', () => {
      expect(resolveTestResultStatus({ isPassed: true })).toBe('PASS');
      expect(resolveTestResultStatus({ isPassed: false })).toBe('FAIL');
    });

    it('evaluates results array if document status is missing', () => {
      const tr: any = {
        results: [
          { criteriaName: 'Độ ẩm', isPass: true },
          { criteriaName: 'Định lượng', isPass: true },
        ],
      };
      expect(resolveTestResultStatus(tr)).toBe('PASS');

      const trFail: any = {
        results: [
          { criteriaName: 'Độ ẩm', isPass: true },
          { criteriaName: 'Định lượng', isPass: false },
        ],
      };
      expect(resolveTestResultStatus(trFail)).toBe('FAIL');
    });
  });

  // =========================================================================
  // 3. REQUIRED TEST MATRIX (Mục 30)
  // =========================================================================
  describe('detectTestResultStatusMismatch - Required Test Matrix (Mục 30)', () => {
    const mockBatch: Batch = {
      id: 'b_001',
      batchNo: 'LOT-2026-001',
      productId: 'p_001',
      tccsId: 'tccs_001',
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      theoreticalYield: 1000,
      actualYield: 990,
      yieldUnit: 'viên',
      status: 'RELEASED',
      createdAt: '2026-01-01',
    };

    it('Row 1: Expected = PASS, Actual = PASS (Ready) -> NO ALERT', () => {
      const tr: TestResult = {
        id: 'tr_1',
        batchId: 'b_001',
        labName: 'Quatest 3',
        testDate: '2026-01-10',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ ẩm', value: 4.5, isPass: true }],
        createdAt: '2026-01-10',
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        batch: mockBatch,
        dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
      });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
    });

    it('Row 1b: Stored as Vietnamese "Đạt", Computed = PASS -> NO ALERT (Format normalizable)', () => {
      const tr: any = {
        id: 'tr_vietnamese',
        batchId: 'b_001',
        labName: 'Trung tâm KT 3',
        testDate: '2026-01-10',
        overallStatus: 'Đạt',
        results: [{ criteriaName: 'Độ ẩm', value: 4.5, isPass: true }],
        createdAt: '2026-01-10',
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        batch: mockBatch,
        dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
      });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
      expect(res.isAutoHealable).toBe(true);
      expect(res.autoHealPayload?.correctStatus).toBe('PASS');
    });

    it('Row 2: Expected = FAIL, Actual = FAIL (Ready) -> NO ALERT', () => {
      const tr: TestResult = {
        id: 'tr_fail',
        batchId: 'b_001',
        labName: 'Quatest 3',
        testDate: '2026-01-10',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Độ ẩm', value: 12.0, isPass: false }],
        createdAt: '2026-01-10',
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        batch: mockBatch,
        dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
      });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
    });

    it('Row 3: Stored = PASS, Computed = FAIL (Ready) -> ALERT (True Mismatch)', () => {
      const tr: TestResult = {
        id: 'tr_mismatch_1',
        batchId: 'b_001',
        labName: 'Quatest 3',
        testDate: '2026-01-10',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Định lượng', value: 50, isPass: false }],
        createdAt: '2026-01-10',
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        batch: mockBatch,
        dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
      });
      expect(res.shouldAlert).toBe(true);
      expect(res.hasMismatch).toBe(true);
      expect(res.expectedStatus).toBe('FAIL');
      expect(res.actualStatus).toBe('PASS');
    });

    it('Row 4: Stored = FAIL, Computed = PASS (Ready) -> ALERT (True Mismatch)', () => {
      const tr: TestResult = {
        id: 'tr_mismatch_2',
        batchId: 'b_001',
        labName: 'Quatest 3',
        testDate: '2026-01-10',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Định lượng', value: 100, isPass: true }],
        createdAt: '2026-01-10',
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        batch: mockBatch,
        dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
      });
      expect(res.shouldAlert).toBe(true);
      expect(res.hasMismatch).toBe(true);
      expect(res.expectedStatus).toBe('PASS');
      expect(res.actualStatus).toBe('FAIL');
    });

    it('Row 5: Stored = PASS, Computed = UNKNOWN / PENDING -> NO ALERT (Do not treat UNKNOWN as FAIL)', () => {
      const tr: any = {
        id: 'tr_draft',
        batchId: 'b_001',
        labName: 'Lab Internal',
        testDate: '2026-01-10',
        overallStatus: 'PASS',
        results: [], // empty results
        createdAt: '2026-01-10',
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        batch: mockBatch,
        dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
      });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
    });

    it('Row 6: Stored = UNKNOWN, Computed = PASS -> NO ALERT', () => {
      const tr: any = {
        id: 'tr_unkn',
        batchId: 'b_001',
        labName: 'Lab Internal',
        testDate: '2026-01-10',
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: true }],
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        batch: mockBatch,
        dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
      });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
    });

    it('Row 7: Expected = PASS, Actual = PASS (Loading) -> NO ALERT', () => {
      const tr: TestResult = {
        id: 'tr_load',
        batchId: 'b_001',
        labName: 'Lab Internal',
        testDate: '2026-01-10',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ ẩm', value: 15, isPass: false }], // would fail if evaluated
        createdAt: '2026-01-10',
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        batch: mockBatch,
        dataFreshness: { isTestResultsLoading: true, testResultsLoaded: false },
      });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
      expect(res.reason).toBe('DATA_LOADING_OR_UNAVAILABLE');
    });

    it('Row 8: Expected = PASS, Actual = PASS (Cancelled result) -> NO ALERT', () => {
      const tr: any = {
        id: 'tr_cancelled',
        batchId: 'b_001',
        status: 'CANCELLED',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ ẩm', isPass: false }],
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        batch: mockBatch,
        dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
      });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
      expect(res.reason).toBe('TEST_RESULT_CANCELLED_OR_DELETED');
    });
  });

  // =========================================================================
  // 4. MULTIPLE TEST RESULTS & REVISIONS (Mục 15, 17, 31)
  // =========================================================================
  describe('resolveFinalTestResultForBatch - Multiple Test Results & Revisions', () => {
    const mockBatch: Batch = {
      id: 'batch_multi',
      batchNo: 'LOT-MULTI-01',
      productId: 'p_1',
      tccsId: 'tccs_1',
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      theoreticalYield: 1000,
      actualYield: 1000,
      yieldUnit: 'chai',
      status: 'RELEASED',
      createdAt: '2026-01-01',
    };

    it('Mục 31: Result 1 = FAIL, Result 2 = PASS & FINAL -> NO MISMATCH (Selects Result 2)', () => {
      const res1: TestResult = {
        id: 'tr_rev1',
        batchId: 'batch_multi',
        labName: 'Lab Internal',
        testDate: '2026-01-05',
        overallStatus: 'FAIL',
        version: 1,
        results: [{ criteriaName: 'Độ hòa tan', isPass: false, value: 65 }],
        createdAt: '2026-01-05',
      };

      const res2: any = {
        id: 'tr_rev2',
        batchId: 'batch_multi',
        labName: 'Lab Internal',
        testDate: '2026-01-08',
        overallStatus: 'PASS',
        status: 'FINAL',
        version: 2,
        results: [{ criteriaName: 'Độ hòa tan', isPass: true, value: 85 }],
        createdAt: '2026-01-08',
      };

      const resolution = resolveFinalTestResultForBatch(mockBatch, [res1, res2]);
      expect(resolution.finalTestResult?.id).toBe('tr_rev2');
      expect(resolution.status).toBe('PASS');
      expect(resolution.hasPassTest).toBe(true);
    });

    it('Mục 31: Result 1 = PASS, Result 2 = FAIL & FINAL -> Status = FAIL', () => {
      const res1: TestResult = {
        id: 'tr_rev1',
        batchId: 'batch_multi',
        labName: 'Lab Internal',
        testDate: '2026-01-05',
        overallStatus: 'PASS',
        version: 1,
        results: [{ criteriaName: 'Độ hòa tan', isPass: true, value: 85 }],
        createdAt: '2026-01-05',
      };

      const res2: any = {
        id: 'tr_rev2',
        batchId: 'batch_multi',
        labName: 'Quatest 3',
        testDate: '2026-01-08',
        overallStatus: 'FAIL',
        status: 'FINAL',
        version: 2,
        results: [{ criteriaName: 'Độ ẩm', isPass: false, value: 15 }],
        createdAt: '2026-01-08',
      };

      const resolution = resolveFinalTestResultForBatch(mockBatch, [res1, res2]);
      expect(resolution.finalTestResult?.id).toBe('tr_rev2');
      expect(resolution.status).toBe('FAIL');
    });

    it('Mục 16: Prefers APPROVED / FINAL over DRAFT', () => {
      const draftTr: any = {
        id: 'tr_draft',
        batchId: 'batch_multi',
        labName: 'Lab Internal',
        status: 'DRAFT',
        overallStatus: 'FAIL',
        updatedAt: '2026-01-10', // newer timestamp, but is DRAFT!
        results: [{ criteriaName: 'Chỉ tiêu', isPass: false, value: 0 }],
      };

      const approvedTr: any = {
        id: 'tr_approved',
        batchId: 'batch_multi',
        labName: 'Pasteur',
        status: 'APPROVED',
        overallStatus: 'PASS',
        updatedAt: '2026-01-05',
        results: [{ criteriaName: 'Chỉ tiêu', isPass: true, value: 100 }],
      };

      const resolution = resolveFinalTestResultForBatch(mockBatch, [draftTr, approvedTr]);
      expect(resolution.finalTestResult?.id).toBe('tr_approved');
      expect(resolution.status).toBe('PASS');

      const authoritative = resolveAuthoritativeTestResultForBatch(mockBatch, [
        draftTr,
        approvedTr,
      ]);
      expect(authoritative?.id).toBe('tr_approved');
    });
  });

  // =========================================================================
  // 5. SPLIT CRITERIA & ALTERNATE RULES ACROSS LABS
  // =========================================================================
  describe('calculateOverallStatusForTestResult with Alternate Rules', () => {
    it('does not falsely fail an individual test when alternate rules are fulfilled across the batch', () => {
      const boundTccs: any = {
        id: 'tccs_rules',
        productId: 'p_1',
        code: 'TCCS-01',
        issueDate: '2026-01-01',
        isActive: true,
        alternateRules: [
          {
            type: 'CONDITIONAL_CHECK',
            main: 'Vi sinh vật hiếu khí',
            conditionValue: '> 1000',
            alt: 'E. coli',
          },
        ],
      };

      // Lab 1 tested Vi sinh vật hiếu khí = 500 (condition NOT triggered, so E. coli is exempted)
      const tr1: TestResult = {
        id: 'tr_chem',
        batchId: 'batch_1',
        labName: 'Lab Hóa',
        testDate: '2026-01-05',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Vi sinh vật hiếu khí', value: 500, isPass: true },
          { criteriaName: 'E. coli', value: 'Không thử nghiệm', isPass: false }, // marked false because not tested
        ],
        createdAt: '2026-01-05',
      };

      const status = calculateOverallStatusForTestResult(tr1, boundTccs);
      // Because condition > 1000 is not triggered by value 500, E. coli failure is EXEMPTED!
      expect(status).toBe('PASS');
    });
  });

  // =========================================================================
  // 6. 15 MANDATORY REGRESSION TEST CASES (Mục 17)
  // =========================================================================
  describe('15 Mandatory Regression Test Cases (Mục 17)', () => {
    const baseBatch: Batch = {
      id: 'batch_case_test',
      batchNo: 'LOT-CASE-2026',
      productId: 'p_case',
      tccsId: 'tccs_case',
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      theoreticalYield: 1000,
      actualYield: 1000,
      yieldUnit: 'chai',
      status: 'RELEASED',
      createdAt: '2026-01-01',
    };

    const baseTestResult: TestResult = {
      id: 'tr_case_1',
      batchId: 'batch_case_test',
      labName: 'Quatest 3',
      testDate: '2026-01-10',
      overallStatus: 'PASS',
      results: [],
      createdAt: '2026-01-10',
    };

    // Case 1: 3 PASS -> PASS
    it('Case 1: 3 PASS → PASS', () => {
      const tr: TestResult = {
        ...baseTestResult,
        results: [
          { criteriaName: 'Chỉ tiêu 1', isPass: true, value: '10' },
          { criteriaName: 'Chỉ tiêu 2', isPass: true, value: '20' },
          { criteriaName: 'Chỉ tiêu 3', isPass: true, value: '30' },
        ],
      };
      expect(calculateOverallStatusForTestResult(tr)).toBe('PASS');
    });

    // Case 2: 2 PASS + 1 FAIL -> FAIL
    it('Case 2: 2 PASS + 1 FAIL → FAIL', () => {
      const tr: TestResult = {
        ...baseTestResult,
        results: [
          { criteriaName: 'Chỉ tiêu 1', isPass: true, value: '10' },
          { criteriaName: 'Chỉ tiêu 2', isPass: true, value: '20' },
          { criteriaName: 'Chỉ tiêu 3', isPass: false, value: '99' },
        ],
      };
      expect(calculateOverallStatusForTestResult(tr)).toBe('FAIL');
    });

    // Case 3: 1 PASS + 1 PENDING -> PENDING
    it('Case 3: 1 PASS + 1 PENDING → PENDING', () => {
      const tr: TestResult = {
        ...baseTestResult,
        results: [
          { criteriaName: 'Chỉ tiêu 1', isPass: true, value: '10' },
          { criteriaName: 'Chỉ tiêu 2', isPass: null, value: '' },
        ],
      };
      expect(calculateOverallStatusForTestResult(tr)).toBe('PENDING');
    });

    // Case 4: Tất cả PENDING -> PENDING
    it('Case 4: Tất cả PENDING → PENDING', () => {
      const tr: TestResult = {
        ...baseTestResult,
        results: [
          { criteriaName: 'Chỉ tiêu 1', isPass: null, value: '' },
          { criteriaName: 'Chỉ tiêu 2', isPass: undefined, value: '' },
        ],
      };
      expect(calculateOverallStatusForTestResult(tr)).toBe('PENDING');
    });

    // Case 5: overallStatus = "Đạt", criteria = PASS -> PASS, no mismatch
    it('Case 5: overallStatus = "Đạt", criteria = PASS → PASS, no mismatch', () => {
      const tr: any = {
        ...baseTestResult,
        overallStatus: 'Đạt',
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: true, value: '10' }],
      };
      const res = detectTestResultStatusMismatch({ testResult: tr });
      expect(res.hasMismatch).toBe(false);
      expect(res.shouldAlert).toBe(false);
      expect(res.actualStatus).toBe('PASS');
      expect(res.expectedStatus).toBe('PASS');
      expect(res.isAutoHealable).toBe(true); // normalizable format
    });

    // Case 6: overallStatus = "PASS", criteria = all PASS -> PASS, no mismatch
    it('Case 6: overallStatus = "PASS", criteria = all PASS → PASS, no mismatch', () => {
      const tr: TestResult = {
        ...baseTestResult,
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Chỉ tiêu 1', isPass: true, value: '10' },
          { criteriaName: 'Chỉ tiêu 2', isPass: true, value: '20' },
        ],
      };
      const res = detectTestResultStatusMismatch({ testResult: tr });
      expect(res.hasMismatch).toBe(false);
      expect(res.shouldAlert).toBe(false);
      expect(res.actualStatus).toBe('PASS');
      expect(res.expectedStatus).toBe('PASS');
    });

    // Case 7: overallStatus = "PASS", criteria = one FAIL -> FAIL, REAL MISMATCH
    it('Case 7: overallStatus = "PASS", criteria = one FAIL → FAIL, REAL MISMATCH', () => {
      const tr: TestResult = {
        ...baseTestResult,
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Chỉ tiêu 1', isPass: true, value: '10' },
          { criteriaName: 'Chỉ tiêu 2', isPass: false, value: '99' },
        ],
      };
      const res = detectTestResultStatusMismatch({ testResult: tr });
      expect(res.hasMismatch).toBe(true);
      expect(res.shouldAlert).toBe(true);
      expect(res.alertType).toBe('CRITICAL');
      expect(res.actualStatus).toBe('PASS');
      expect(res.expectedStatus).toBe('FAIL');
      expect(res.isAutoHealable).toBe(true); // Auto-heal available when full failure evidence is present
      expect(res.autoHealPayload?.correctStatus).toBe('FAIL');
    });

    // Case 8: overallStatus = "FAIL", criteria = all PASS -> PASS, REAL MISMATCH
    it('Case 8: overallStatus = "FAIL", criteria = all PASS → PASS, REAL MISMATCH', () => {
      const tr: TestResult = {
        ...baseTestResult,
        overallStatus: 'FAIL',
        results: [
          { criteriaName: 'Chỉ tiêu 1', isPass: true, value: '10' },
          { criteriaName: 'Chỉ tiêu 2', isPass: true, value: '20' },
        ],
      };
      const res = detectTestResultStatusMismatch({ testResult: tr });
      expect(res.hasMismatch).toBe(true);
      expect(res.shouldAlert).toBe(true);
      expect(res.alertType).toBe('CRITICAL');
      expect(res.actualStatus).toBe('FAIL');
      expect(res.expectedStatus).toBe('PASS');
    });

    // Case 9: old FAIL + new FINAL PASS -> Batch PASS
    it('Case 9: old FAIL + new FINAL PASS → Batch PASS', () => {
      const trOld: TestResult = {
        ...baseTestResult,
        id: 'tr_old_fail',
        overallStatus: 'FAIL',
        version: 1,
        updatedAt: '2026-01-01T00:00:00Z',
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: false, value: '0' }],
      };
      const trNew: any = {
        ...baseTestResult,
        id: 'tr_new_pass',
        overallStatus: 'PASS',
        status: 'FINAL',
        version: 2,
        updatedAt: '2026-01-05T00:00:00Z',
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: true, value: '100' }],
      };

      const authTr = resolveAuthoritativeTestResultForBatch(baseBatch, [trOld, trNew]);
      expect(authTr?.id).toBe('tr_new_pass');
      expect(calculateOverallStatusForTestResult(authTr!)).toBe('PASS');

      const batchQuality = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(baseBatch, [
        trOld,
        trNew,
      ]);
      expect(batchQuality).toBe('PASS');
    });

    // Case 10: old PASS + new FINAL FAIL -> Batch FAIL
    it('Case 10: old PASS + new FINAL FAIL → Batch FAIL', () => {
      const trOld: TestResult = {
        ...baseTestResult,
        id: 'tr_old_pass',
        overallStatus: 'PASS',
        version: 1,
        updatedAt: '2026-01-01T00:00:00Z',
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: true, value: '100' }],
      };
      const trNew: any = {
        ...baseTestResult,
        id: 'tr_new_fail',
        overallStatus: 'FAIL',
        status: 'FINAL',
        version: 2,
        updatedAt: '2026-01-05T00:00:00Z',
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: false, value: '0' }],
      };

      const authTr = resolveAuthoritativeTestResultForBatch(baseBatch, [trOld, trNew]);
      expect(authTr?.id).toBe('tr_new_fail');
      expect(calculateOverallStatusForTestResult(authTr!)).toBe('FAIL');

      const batchQuality = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(baseBatch, [
        trOld,
        trNew,
      ]);
      expect(batchQuality).toBe('FAIL');
    });

    // Case 11: loading = true -> no mismatch alert
    it('Case 11: loading = true → no mismatch alert', () => {
      const tr: TestResult = {
        ...baseTestResult,
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: false, value: '0' }],
      };
      const res = detectTestResultStatusMismatch({
        testResult: tr,
        dataFreshness: { isTestResultsLoading: true, testResultsLoaded: false },
      });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
      expect(res.reason).toBe('DATA_LOADING_OR_UNAVAILABLE');
    });

    // Case 12: deleted TestResult -> ignored
    it('Case 12: deleted TestResult → ignored', () => {
      const trDeleted: any = {
        ...baseTestResult,
        overallStatus: 'PASS',
        isDeleted: true,
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: false, value: '0' }],
      };
      const res = detectTestResultStatusMismatch({ testResult: trDeleted });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
      expect(res.reason).toBe('TEST_RESULT_CANCELLED_OR_DELETED');
    });

    // Case 13: VOIDED TestResult -> ignored
    it('Case 13: VOIDED TestResult → ignored', () => {
      const trVoided: any = {
        ...baseTestResult,
        status: 'VOIDED',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: false, value: '0' }],
      };
      const res = detectTestResultStatusMismatch({ testResult: trVoided });
      expect(res.shouldAlert).toBe(false);
      expect(res.hasMismatch).toBe(false);
      expect(res.reason).toBe('TEST_RESULT_CANCELLED_OR_DELETED');
    });

    // Case 14: DRAFT FAIL + FINAL PASS -> PASS
    it('Case 14: DRAFT FAIL + FINAL PASS → PASS', () => {
      const trDraft: any = {
        ...baseTestResult,
        id: 'tr_draft_fail',
        status: 'DRAFT',
        overallStatus: 'FAIL',
        updatedAt: '2026-01-10T00:00:00Z', // newer timestamp, but is DRAFT
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: false, value: '0' }],
      };
      const trFinal: any = {
        ...baseTestResult,
        id: 'tr_final_pass',
        status: 'FINAL',
        overallStatus: 'PASS',
        updatedAt: '2026-01-05T00:00:00Z',
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: true, value: '100' }],
      };

      const authTr = resolveAuthoritativeTestResultForBatch(baseBatch, [trDraft, trFinal]);
      expect(authTr?.id).toBe('tr_final_pass');

      const batchQuality = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(baseBatch, [
        trDraft,
        trFinal,
      ]);
      expect(batchQuality).toBe('PASS');
    });

    // Case 15: historical FAIL + current PASS -> Không được false-positive
    it('Case 15: historical FAIL + current PASS → Không được false-positive', () => {
      const trHistorical: TestResult = {
        ...baseTestResult,
        id: 'tr_historical_fail',
        overallStatus: 'FAIL',
        version: 1,
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: false, value: '0' }],
      };
      const trCurrent: TestResult = {
        ...baseTestResult,
        id: 'tr_current_pass',
        overallStatus: 'PASS',
        version: 2,
        results: [{ criteriaName: 'Chỉ tiêu 1', isPass: true, value: '100' }],
      };

      const res = detectTestResultStatusMismatch({
        testResult: trCurrent,
        allTestResultsForBatch: [trHistorical, trCurrent],
      });
      expect(res.hasMismatch).toBe(false);
      expect(res.shouldAlert).toBe(false);
    });
  });
});
