import { describe, it, expect } from 'vitest';
import {
  normalizeTestResultStatus,
  normalizeCriterionPassStatus,
  resolveTestResultStatus,
  calculateOverallStatusForTestResult,
  resolveFinalTestResultForBatch,
  detectTestResultStatusMismatch,
} from './testResultStatusResolver';
import { Batch, TestResult, TCCS } from '../../types';

describe('Canonical Test Result Status Resolver & Mismatch Detector', () => {
  // =========================================================================
  // 1. NORMALIZATION TESTS (Mục 7 & 8)
  // =========================================================================
  describe('normalizeTestResultStatus', () => {
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
      });
    });

    it('returns UNKNOWN for null, undefined, empty and does NOT treat as FAIL', () => {
      expect(normalizeTestResultStatus(undefined)).toBe('UNKNOWN');
      expect(normalizeTestResultStatus(null)).toBe('UNKNOWN');
      expect(normalizeTestResultStatus('')).toBe('UNKNOWN');
      expect(normalizeTestResultStatus('   ')).toBe('UNKNOWN');
      expect(normalizeTestResultStatus('N/A')).toBe('UNKNOWN');
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
});
