import { describe, it, expect } from 'vitest';
import {
  resolveCanonicalBatchQualityDecision,
  CANONICAL_DECISION_RESOLVER_VERSION,
} from '../canonicalBatchQualityDecision';
import { evaluateBatchReleaseIntegrity } from '../batchIntegrityValidator';
import { CanonicalStatusResolver } from '../../canonical/canonicalResolver';
import { resolveTestResultsForBatch } from '../batchTestResultResolver';
import { Batch, TestResult, TCCS } from '../../../types';

function createMockBatch(overrides: Partial<Batch>): Batch {
  return {
    id: 'batch-362605',
    batchNo: '362605',
    productId: 'prod-001',
    status: 'RELEASED',
    mfgDate: '2026-06-20',
    expDate: '2028-06-20',
    theoreticalYield: 1000,
    actualYield: 990,
    yieldUnit: 'chai',
    tccsId: 'tccs-001',
    createdAt: '2026-06-20T00:00:00Z',
    ...overrides,
  } as Batch;
}

function createMockTestResult(overrides: Partial<TestResult>): TestResult {
  return {
    id: 'tr-default',
    batchId: 'batch-362605',
    labName: 'Phòng Kiểm nghiệm Nội bộ',
    testDate: '2026-06-24',
    version: 1,
    workflowStatus: 'APPROVED',
    status: 'APPROVED',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Độ ẩm', value: '4.5', isPass: true, unit: '%' },
      { criteriaName: 'Vi sinh', value: 'Âm tính', isPass: true, unit: '' },
    ],
    createdAt: '2026-06-24T00:00:00Z',
    ...overrides,
  } as TestResult;
}

describe('SSoT Canonical Batch Quality Decision & Alert Contract Tests (Phase 8 & 9)', () => {
  const baseBatch = createMockBatch({});

  const boundTccs = {
    id: 'tccs-001',
    productId: 'prod-001',
    code: 'TCCS-001',
    name: 'Tiêu chuẩn viên nén',
    status: 'ACTIVE',
    effectiveDate: '2025-01-01',
    version: 1,
    criteria: [
      { id: 'crit-1', name: 'Độ ẩm', standard: '<= 5.0%', unit: '%' },
      { id: 'crit-2', name: 'Vi sinh', standard: 'Âm tính', unit: '' },
    ],
  } as unknown as TCCS;

  // Case 1: 362605 Internal QC FAIL (v1) + Pasteur PASS (v5, APPROVED)
  it('Case 1: 362605 — Internal QC FAIL (v1) + Pasteur PASS (v5, APPROVED) -> supreme=Pasteur, quality=PASS, integrity=PASS, shouldAlert=false', () => {
    const internalQcFail = createMockTestResult({
      id: 'res-qc-fail',
      batchId: 'batch-362605',
      labName: 'Phòng Kiểm nghiệm Nội bộ',
      testDate: '2026-06-24',
      version: 1,
      workflowStatus: 'REJECTED',
      status: 'REJECTED',
      overallStatus: 'FAIL',
      results: [
        { criteriaName: 'Độ ẩm', value: '7.5', isPass: false, unit: '%' },
        { criteriaName: 'Vi sinh', value: 'Âm tính', isPass: true, unit: '' },
      ],
    });

    const pasteurPass = createMockTestResult({
      id: 'res-pasteur-pass',
      batchId: 'batch-362605',
      labName: 'Viện Pasteur TP.HCM',
      testDate: '2026-06-28',
      version: 5,
      workflowStatus: 'APPROVED',
      status: 'APPROVED',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Độ ẩm', value: '4.2', isPass: true, unit: '%' },
        { criteriaName: 'Vi sinh', value: 'Âm tính', isPass: true, unit: '' },
      ],
    });

    const testResults = [internalQcFail, pasteurPass];
    const decision = resolveCanonicalBatchQualityDecision({
      batch: baseBatch,
      testResults,
      tccs: boundTccs,
      dataFreshness: { testResultsLoaded: true, isTestResultsLoading: false },
    });

    expect(decision.supremeTestResultId).toBe('res-pasteur-pass');
    expect(decision.supremeTestResultLab).toBe('Viện Pasteur TP.HCM');
    expect(decision.qualityStatus).toBe('PASS');
    expect(decision.integrityStatus).toBe('PASS');
    expect(decision.shouldAlert).toBe(false);
    expect(decision.alertType).toBeUndefined();
    expect(decision.supersededTestResultIds).toContain('res-qc-fail');

    // Verify consistency with CanonicalStatusResolver and evaluateBatchReleaseIntegrity
    const canonicalQuality = CanonicalStatusResolver.calculateCanonicalBatchQualityStatus(
      baseBatch,
      testResults,
      boundTccs
    );
    expect(canonicalQuality).toBe('PASS');

    const resolution = resolveTestResultsForBatch(baseBatch, testResults, [baseBatch]);
    const integrityEval = evaluateBatchReleaseIntegrity(
      baseBatch,
      resolution,
      { testResultsLoaded: true, isTestResultsLoading: false },
      boundTccs
    );
    expect(integrityEval.integrityStatus).toBe('PASS');
    expect(integrityEval.shouldAlert).toBe(false);
  });

  // Case 2: 332605 — Multiple re-tests resulting in latest PASS
  it('Case 2: 332605 — Superseded test history with final APPROVED PASS -> PASS / false', () => {
    const testResults: TestResult[] = [
      createMockTestResult({
        id: 'res-332605-1',
        batchId: 'batch-332605',
        labName: 'QC Nội bộ',
        testDate: '2026-05-10',
        version: 1,
        workflowStatus: 'DRAFT',
        overallStatus: 'FAIL',
      }),
      createMockTestResult({
        id: 'res-332605-2',
        batchId: 'batch-332605',
        labName: 'Viện Kiểm nghiệm',
        testDate: '2026-05-20',
        version: 2,
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
      }),
    ];

    const batch332605 = createMockBatch({ id: 'batch-332605', batchNo: '332605' });
    const decision = resolveCanonicalBatchQualityDecision({
      batch: batch332605,
      testResults,
      tccs: boundTccs,
    });

    expect(decision.qualityStatus).toBe('PASS');
    expect(decision.integrityStatus).toBe('PASS');
    expect(decision.shouldAlert).toBe(false);
  });

  // Case 3: 292605 — Standard compliant batch
  it('Case 3: 292605 — Standard compliant batch with APPROVED PASS -> PASS / false', () => {
    const testResults: TestResult[] = [
      createMockTestResult({
        id: 'res-292605-1',
        batchId: 'batch-292605',
        labName: 'Phòng Kiểm nghiệm',
        testDate: '2026-04-15',
        version: 1,
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
      }),
    ];

    const batch292605 = createMockBatch({ id: 'batch-292605', batchNo: '292605' });
    const decision = resolveCanonicalBatchQualityDecision({
      batch: batch292605,
      testResults,
      tccs: boundTccs,
    });

    expect(decision.qualityStatus).toBe('PASS');
    expect(decision.integrityStatus).toBe('PASS');
    expect(decision.shouldAlert).toBe(false);
  });

  // Case 4: Genuine FAIL — Only authoritative result is FAIL
  it('Case 4: Genuine FAIL — Only authoritative result is FAIL -> TEST_RESULT_INVALID_STATUS, shouldAlert=true', () => {
    const testResults: TestResult[] = [
      createMockTestResult({
        id: 'res-genuine-fail',
        batchId: 'batch-fail',
        labName: 'Trung tâm Phân tích',
        testDate: '2026-07-01',
        version: 1,
        workflowStatus: 'APPROVED',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Độ ẩm', value: '10.0', isPass: false, unit: '%' }],
      }),
    ];

    const batchFail = createMockBatch({ id: 'batch-fail', batchNo: 'FAIL-01' });
    const decision = resolveCanonicalBatchQualityDecision({
      batch: batchFail,
      testResults,
      tccs: boundTccs,
    });

    expect(decision.qualityStatus).toBe('FAIL');
    expect(decision.integrityStatus).toBe('TEST_RESULT_INVALID_STATUS');
    expect(decision.shouldAlert).toBe(true);
    expect(decision.alertType).toBe('CRITICAL');
  });

  // Case 5: Old FAIL + New PASS
  it('Case 5: Old FAIL + New PASS -> PASS, shouldAlert=false', () => {
    const testResults: TestResult[] = [
      createMockTestResult({
        id: 'res-old-fail',
        batchId: 'batch-retest',
        labName: 'Lab A',
        testDate: '2026-01-01',
        version: 1,
        workflowStatus: 'REJECTED',
        overallStatus: 'FAIL',
      }),
      createMockTestResult({
        id: 'res-new-pass',
        batchId: 'batch-retest',
        labName: 'Lab A',
        testDate: '2026-01-10',
        version: 2,
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
      }),
    ];

    const batchRetest = createMockBatch({ id: 'batch-retest', batchNo: 'RETEST-01' });
    const decision = resolveCanonicalBatchQualityDecision({
      batch: batchRetest,
      testResults,
      tccs: boundTccs,
    });

    expect(decision.qualityStatus).toBe('PASS');
    expect(decision.integrityStatus).toBe('PASS');
    expect(decision.shouldAlert).toBe(false);
  });

  // Case 6: Duplicate reportNo empty / duplicates deduplicated deterministically
  it('Case 7: Duplicate reportNo empty / duplicates -> deduplicated deterministically', () => {
    const testResults: TestResult[] = [
      createMockTestResult({
        id: 'res-dup-1',
        batchId: 'batch-dup',
        labName: 'Lab A',
        testDate: '2026-01-01',
        version: 1,
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
      }),
      createMockTestResult({
        id: 'res-dup-2',
        batchId: 'batch-dup',
        labName: 'Lab A',
        testDate: '2026-01-01',
        version: 1,
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
      }),
    ];

    const batchDup = createMockBatch({ id: 'batch-dup', batchNo: 'DUP-01' });
    const decision = resolveCanonicalBatchQualityDecision({
      batch: batchDup,
      testResults,
      tccs: boundTccs,
    });

    expect(decision.qualityStatus).toBe('PASS');
    expect(decision.authoritativeCount).toBe(1);
  });

  // Case 8: workflowStatus APPROVED + overallStatus PASS
  it('Case 8: workflowStatus APPROVED + overallStatus PASS -> quality PASS', () => {
    const testResults: TestResult[] = [
      createMockTestResult({
        id: 'res-wf-pass',
        batchId: 'batch-wf',
        labName: 'Lab A',
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
      }),
    ];

    const decision = resolveCanonicalBatchQualityDecision({
      batch: createMockBatch({ id: 'batch-wf' }),
      testResults,
      tccs: boundTccs,
    });

    expect(decision.qualityStatus).toBe('PASS');
  });

  // Case 9: workflowStatus APPROVED + overallStatus FAIL must NOT become PASS
  it('Case 9: workflowStatus APPROVED + overallStatus FAIL -> must NOT become PASS', () => {
    const testResults: TestResult[] = [
      createMockTestResult({
        id: 'res-wf-fail',
        batchId: 'batch-wffail',
        labName: 'Lab A',
        workflowStatus: 'APPROVED',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Độ ẩm', value: '12.0', isPass: false, unit: '%' }],
      }),
    ];

    const decision = resolveCanonicalBatchQualityDecision({
      batch: createMockBatch({ id: 'batch-wffail' }),
      testResults,
      tccs: boundTccs,
    });

    expect(decision.qualityStatus).toBe('FAIL');
    expect(decision.shouldAlert).toBe(true);
  });

  // Case 10: Data loading / not loaded
  it('Case 10: Data loading / not loaded -> DATA_UNAVAILABLE, shouldAlert=false', () => {
    const decision = resolveCanonicalBatchQualityDecision({
      batch: baseBatch,
      testResults: [],
      dataFreshness: { testResultsLoaded: false, isTestResultsLoading: true },
    });

    expect(decision.integrityStatus).toBe('DATA_UNAVAILABLE');
    expect(decision.shouldAlert).toBe(false);
  });

  // Phase 9: Alert Contract Verification
  it('Phase 9 Alert Contract: Batch 362605 has 0 alerts, while Genuine FAIL Batch triggers TEST_RESULT_INVALID_STATUS', () => {
    // 1. Batch 362605
    const batch362605Results: TestResult[] = [
      createMockTestResult({
        id: 'qc_fail',
        batchId: 'b-362605',
        labName: 'QC',
        version: 1,
        testDate: '2026-06-24',
        workflowStatus: 'REJECTED',
        overallStatus: 'FAIL',
        results: [
          { criteriaName: 'Độ ẩm', value: '7.5', isPass: false, unit: '%' },
          { criteriaName: 'Vi sinh', value: 'Âm tính', isPass: true, unit: '' },
        ],
      }),
      createMockTestResult({
        id: 'pasteur_pass',
        batchId: 'b-362605',
        labName: 'Pasteur',
        version: 5,
        testDate: '2026-06-28',
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Độ ẩm', value: '4.2', isPass: true, unit: '%' },
          { criteriaName: 'Vi sinh', value: 'Âm tính', isPass: true, unit: '' },
        ],
      }),
    ];
    const b362605 = createMockBatch({ id: 'b-362605', batchNo: '362605' });
    const res362605 = resolveTestResultsForBatch(b362605, batch362605Results, [b362605]);
    const eval362605 = evaluateBatchReleaseIntegrity(
      b362605,
      res362605,
      { testResultsLoaded: true, isTestResultsLoading: false },
      boundTccs
    );

    expect(eval362605.integrityStatus).toBe('PASS');
    expect(eval362605.shouldAlert).toBe(false);
    expect(eval362605.alertType).toBeFalsy();

    // 2. Genuine FAIL
    const genuineFailResults: TestResult[] = [
      createMockTestResult({
        id: 'fail_only',
        batchId: 'b-fail-only',
        labName: 'QC',
        version: 1,
        testDate: '2026-06-24',
        workflowStatus: 'APPROVED',
        overallStatus: 'FAIL',
        results: [
          { criteriaName: 'Độ ẩm', value: '12.0', isPass: false, unit: '%' },
          { criteriaName: 'Vi sinh', value: 'Dương tính', isPass: false, unit: '' },
        ],
      }),
    ];
    const bFailOnly = createMockBatch({ id: 'b-fail-only', batchNo: 'FAIL_ONLY' });
    const resFail = resolveTestResultsForBatch(bFailOnly, genuineFailResults, [bFailOnly]);
    const evalFail = evaluateBatchReleaseIntegrity(
      bFailOnly,
      resFail,
      { testResultsLoaded: true, isTestResultsLoading: false },
      boundTccs
    );

    expect(evalFail.integrityStatus).toBe('TEST_RESULT_INVALID_STATUS');
    expect(evalFail.shouldAlert).toBe(true);
    expect(evalFail.alertType).toBe('CRITICAL');
  });
});
