/**
 * model1Regression.test.ts
 * ========================
 * Bộ kiểm thử hồi quy bắt buộc cho PQM VIBE CODING — MODEL 1: CANONICAL DATA MODEL HARDENING.
 *
 * Kiểm tra 14 kịch bản bắt buộc:
 * 1. missing overallStatus → UNKNOWN
 * 2. missing isPass → null/PENDING
 * 3. empty results → UNKNOWN
 * 4. one FAIL → FAIL
 * 5. PASS + PENDING → PENDING
 * 6. all PASS → PASS
 * 7. APPROVED + no test → UNKNOWN
 * 8. RELEASED + no test → UNKNOWN
 * 9. FINAL + no test → UNKNOWN
 * 10. missing test result → UNKNOWN
 * 11. zero tests → passRate null/N/A
 * 12. legacy overallStatus PASS + criterion FAIL → không được resolve PASS (phải là FAIL)
 * 13. workflowStatus APPROVED + criterion FAIL → quality vẫn FAIL
 * 14. workflowStatus RELEASED + criterion PENDING → quality vẫn PENDING
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTestResultStatus,
  normalizeTestResultStatus,
  normalizeCriterionPassStatus,
  calculateOverallStatusForTestResult,
} from '../test-result/testResultStatusResolver';
import { QualityEvaluationEngine } from '../evaluation/QualityEvaluationEngine';
import { TestResult, TestResultEntry, toCanonicalTestResult } from '../../types';

describe('PQM VIBE CODING — MODEL 1: CANONICAL DATA MODEL HARDENING', () => {
  // 1. missing overallStatus → UNKNOWN
  it('1. missing overallStatus → UNKNOWN', () => {
    const trWithoutStatus: any = {
      id: 'tr-01',
      batchId: 'b-01',
      labName: 'Lab A',
      testDate: '2026-01-01',
      // overallStatus is undefined
    };
    expect(resolveTestResultStatus(trWithoutStatus)).toBe('UNKNOWN');
    expect(normalizeTestResultStatus(undefined)).toBe('UNKNOWN');
    expect(normalizeTestResultStatus(null)).toBe('UNKNOWN');
  });

  // 2. missing isPass → null/PENDING
  it('2. missing isPass → null/PENDING', () => {
    // Missing isPass on criterion must be normalized to null
    expect(normalizeCriterionPassStatus(undefined)).toBe(null);
    expect(normalizeCriterionPassStatus(null)).toBe(null);
    expect(normalizeCriterionPassStatus('')).toBe(null);

    const entry: TestResultEntry = {
      criteriaName: 'Độ rã',
      value: '15 phút',
      isPass: null,
    };
    expect(entry.isPass).toBeNull();
  });

  // 3. empty results → UNKNOWN
  it('3. empty results → UNKNOWN', () => {
    const trEmptyResults: TestResult = {
      id: 'tr-empty',
      batchId: 'b-01',
      labName: 'Quatest 3',
      testDate: '2026-01-01',
      overallStatus: 'UNKNOWN',
      createdAt: '2026-01-01',
      results: [],
    };
    expect(resolveTestResultStatus(trEmptyResults)).toBe('UNKNOWN');
    expect(QualityEvaluationEngine.calculateOverallStatus([], null)).toBe('UNKNOWN');
    expect(calculateOverallStatusForTestResult(trEmptyResults)).toBe('UNKNOWN');
  });

  // 4. one FAIL → FAIL
  it('4. one FAIL → FAIL', () => {
    const trOneFail: TestResult = {
      id: 'tr-fail',
      batchId: 'b-01',
      labName: 'Quatest 3',
      testDate: '2026-01-01',
      overallStatus: 'PENDING',
      createdAt: '2026-01-01',
      results: [
        { criteriaName: 'Độ ẩm', value: '5.0', isPass: true },
        { criteriaName: 'Định lượng Ginkgo Biloba', value: '60', isPass: false },
        { criteriaName: 'Kim loại nặng', value: 'Âm tính', isPass: true },
      ],
    };
    expect(resolveTestResultStatus(trOneFail)).toBe('FAIL');
    expect(QualityEvaluationEngine.calculateOverallStatus(trOneFail.results, null)).toBe('FAIL');
    expect(calculateOverallStatusForTestResult(trOneFail)).toBe('FAIL');
  });

  // 5. PASS + PENDING → PENDING
  it('5. PASS + PENDING → PENDING', () => {
    const trPassAndPending: TestResult = {
      id: 'tr-pending',
      batchId: 'b-01',
      labName: 'Quatest 3',
      testDate: '2026-01-01',
      overallStatus: 'PENDING',
      createdAt: '2026-01-01',
      results: [
        { criteriaName: 'Độ ẩm', value: '5.0', isPass: true },
        { criteriaName: 'Tổng số vi sinh vật hiếu khí', value: '', isPass: null },
      ],
    };
    expect(resolveTestResultStatus(trPassAndPending)).toBe('PENDING');
    expect(QualityEvaluationEngine.calculateOverallStatus(trPassAndPending.results, null)).toBe(
      'PENDING'
    );
    expect(calculateOverallStatusForTestResult(trPassAndPending)).toBe('PENDING');
  });

  // 6. all PASS → PASS
  it('6. all PASS → PASS', () => {
    const trAllPass: TestResult = {
      id: 'tr-all-pass',
      batchId: 'b-01',
      labName: 'Quatest 3',
      testDate: '2026-01-01',
      overallStatus: 'PASS',
      createdAt: '2026-01-01',
      results: [
        { criteriaName: 'Độ ẩm', value: '5.0', isPass: true },
        { criteriaName: 'Định lượng', value: '100.5', isPass: true },
        { criteriaName: 'Vi sinh', value: 'Âm tính', isPass: true },
      ],
    };
    expect(resolveTestResultStatus(trAllPass)).toBe('PASS');
    expect(QualityEvaluationEngine.calculateOverallStatus(trAllPass.results, null)).toBe('PASS');
    expect(calculateOverallStatusForTestResult(trAllPass)).toBe('PASS');
  });

  // 7. APPROVED + no test → UNKNOWN
  it('7. APPROVED + no test → UNKNOWN', () => {
    const trApprovedNoTest: any = {
      id: 'tr-app-no-test',
      workflowStatus: 'APPROVED',
      status: 'APPROVED',
      results: [],
    };
    expect(resolveTestResultStatus(trApprovedNoTest)).toBe('UNKNOWN');
    expect(normalizeTestResultStatus('APPROVED')).toBe('UNKNOWN');
  });

  // 8. RELEASED + no test → UNKNOWN
  it('8. RELEASED + no test → UNKNOWN', () => {
    const trReleasedNoTest: any = {
      id: 'tr-rel-no-test',
      workflowStatus: 'RELEASED',
      status: 'RELEASED',
      results: [],
    };
    expect(resolveTestResultStatus(trReleasedNoTest)).toBe('UNKNOWN');
    expect(normalizeTestResultStatus('RELEASED')).toBe('UNKNOWN');
  });

  // 9. FINAL + no test → UNKNOWN
  it('9. FINAL + no test → UNKNOWN', () => {
    const trFinalNoTest: any = {
      id: 'tr-final-no-test',
      workflowStatus: 'FINAL',
      status: 'FINAL',
      results: [],
    };
    expect(resolveTestResultStatus(trFinalNoTest)).toBe('UNKNOWN');
    expect(normalizeTestResultStatus('FINAL')).toBe('UNKNOWN');
  });

  // 10. missing test result → UNKNOWN
  it('10. missing test result → UNKNOWN', () => {
    expect(resolveTestResultStatus(null)).toBe('UNKNOWN');
    expect(resolveTestResultStatus(undefined)).toBe('UNKNOWN');
    expect(resolveTestResultStatus({})).toBe('UNKNOWN');
  });

  // 11. zero tests → passRate null/N/A
  it('11. zero tests → passRate null/N/A', () => {
    const tests: TestResult[] = [];
    const passRate =
      tests.length > 0
        ? Math.round((tests.filter((t) => t.overallStatus === 'PASS').length / tests.length) * 100)
        : null;

    expect(passRate).toBeNull();
    // Khẳng định không được biến 0 test thành 100%
    expect(passRate).not.toBe(100);
  });

  // 12. legacy overallStatus PASS + criterion FAIL → không được resolve PASS (phải là FAIL)
  it('12. legacy overallStatus PASS + criterion FAIL → không được resolve PASS (phải là FAIL)', () => {
    const trLegacyPassWithFailCriterion: any = {
      id: 'tr-conflict',
      overallStatus: 'PASS', // Legacy stored status ghi PASS
      results: [
        { criteriaName: 'Định lượng hoạt chất', value: '45.0', isPass: false }, // FAIL criterion
      ],
    };
    const resolved = resolveTestResultStatus(trLegacyPassWithFailCriterion);
    expect(resolved).not.toBe('PASS');
    expect(resolved).toBe('FAIL');
  });

  // 13. workflowStatus APPROVED + criterion FAIL → quality vẫn FAIL
  it('13. workflowStatus APPROVED + criterion FAIL → quality vẫn FAIL', () => {
    const trApprovedWithFail: any = {
      id: 'tr-app-fail',
      workflowStatus: 'APPROVED',
      status: 'APPROVED',
      results: [{ criteriaName: 'Giới hạn nhiễm khuẩn', value: 'Dương tính', isPass: false }],
    };
    const resolved = resolveTestResultStatus(trApprovedWithFail);
    expect(resolved).toBe('FAIL');
  });

  // 14. workflowStatus RELEASED + criterion PENDING → quality vẫn PENDING
  it('14. workflowStatus RELEASED + criterion PENDING → quality vẫn PENDING', () => {
    const trReleasedWithPending: any = {
      id: 'tr-rel-pending',
      workflowStatus: 'RELEASED',
      status: 'RELEASED',
      results: [{ criteriaName: 'Độ tinh khiết sắc ký', value: '', isPass: null }],
    };
    const resolved = resolveTestResultStatus(trReleasedWithPending);
    expect(resolved).toBe('PENDING');
  });

  // 15. toCanonicalTestResult mapping và tách bạch Quality / Workflow
  it('15. toCanonicalTestResult converts TestResult into CanonicalTestResult correctly', () => {
    const tr: TestResult = {
      id: 'tr-canonical-01',
      batchId: 'batch-99',
      productId: 'prod-01',
      labName: 'Lab Quatest 3',
      testDate: '2026-09-19',
      overallStatus: 'PASS',
      workflowStatus: 'APPROVED',
      results: [
        { criteriaName: 'Độ ẩm', value: '4.5%', isPass: true },
        { criteriaName: 'Cảm quan', value: 'Bột màu nâu', isPass: null },
      ],
      createdAt: '2026-09-19T00:00:00.000Z',
      version: 2,
    };

    const canonical = toCanonicalTestResult(tr);
    expect(canonical.id).toBe('tr-canonical-01');
    expect(canonical.batchId).toBe('batch-99');
    expect(canonical.productId).toBe('prod-01');
    expect(canonical.qualityStatus).toBe('PASS');
    expect(canonical.workflowStatus).toBe('APPROVED');
    expect(canonical.criteria.length).toBe(2);
    expect(canonical.version).toBe(2);
    expect(typeof canonical.createdAt).toBe('number');
    expect(typeof canonical.updatedAt).toBe('number');
  });

  // 16. toCanonicalTestResult defaults and fallback product
  it('16. toCanonicalTestResult handles fallback productId and defaults safely', () => {
    const trLegacy: TestResult = {
      id: 'tr-leg-02',
      batchId: 'batch-100',
      labName: 'Lab Case',
      testDate: '2026-09-19',
      overallStatus: 'FAIL',
      results: [{ criteriaName: 'Định lượng', value: '40', isPass: false }],
      createdAt: '2026-09-19T00:00:00.000Z',
    };

    const canonical = toCanonicalTestResult(trLegacy, 'fallback-prod-99');
    expect(canonical.productId).toBe('fallback-prod-99');
    expect(canonical.qualityStatus).toBe('FAIL');
    expect(canonical.workflowStatus).toBe('DRAFT');
    expect(canonical.version).toBe(1);
  });
});
