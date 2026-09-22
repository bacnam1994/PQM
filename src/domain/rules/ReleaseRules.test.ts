import { describe, it, expect } from 'vitest';
import { ReleaseRules } from './ReleaseRules';
import { Batch, TestResult, TCCS } from '../../types';

describe('ReleaseRules - 7 Mandatory Release Gates (BR-REL-001)', () => {
  const mockTccs: TCCS = {
    id: 'tccs-01',
    productId: 'prod-01',
    code: 'TCCS-01',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      { id: 'c1', name: 'Định lượng', min: 90, max: 110, unit: '%', type: 'NUMBER' as any },
      { id: 'c2', name: 'Độ rã', max: 15, unit: 'phút', type: 'NUMBER' as any },
    ],
    safetyCriteria: [],
    createdAt: '2026-01-01',
  };

  const mockBatch: Batch = {
    id: 'batch-01',
    batchNo: 'B202601',
    productId: 'prod-01',
    tccsId: 'tccs-01',
    status: 'TESTING',
    mfgDate: '2026-01-01',
    expDate: '2029-01-01',
    theoreticalYield: 100000,
    actualYield: 99500,
    yieldUnit: 'viên',
    createdAt: '2026-01-01',
  };

  it('nên chặn xuất xưởng khi kết quả kiểm nghiệm chưa hoàn thành 100%', () => {
    const incompleteTestResult: TestResult = {
      id: 'tr-01',
      batchId: 'batch-01',
      status: 'APPROVED',
      overallStatus: 'PENDING',
      labName: 'Lab QC',
      testDate: '2026-01-02',
      results: [
        { criteriaName: 'Định lượng', value: 99.5, isPass: true },
        // Thiếu chỉ tiêu Độ rã
      ],
      createdAt: '2026-01-02',
    };

    const res = ReleaseRules.evaluate7ReleaseGates({
      batch: mockBatch,
      testResults: [incompleteTestResult],
      boundTccs: mockTccs,
      userRole: 'QA',
    });

    expect(res.allGatesPassed).toBe(false);
    expect(res.gates[0].gateIndex).toBe(1);
    expect(res.gates[0].passed).toBe(false); // Gate 1: Completeness failed
  });

  it('nên cho phép xuất xưởng khi thỏa mãn đồng thời cả 7 Release Gates', () => {
    const passingTestResult: TestResult = {
      id: 'tr-01',
      batchId: 'batch-01',
      status: 'APPROVED',
      overallStatus: 'PASS',
      labName: 'Lab QC',
      testDate: '2026-01-02',
      results: [
        { criteriaName: 'Định lượng', value: 100.2, isPass: true },
        { criteriaName: 'Độ rã', value: 8, isPass: true },
      ],
      createdAt: '2026-01-02',
    };

    const res = ReleaseRules.evaluate7ReleaseGates({
      batch: mockBatch,
      testResults: [passingTestResult],
      boundTccs: mockTccs,
      userRole: 'QA',
      deviations: [],
    });

    expect(res.allGatesPassed).toBe(true);
    expect(res.gates.every((g) => g.passed)).toBe(true);
    expect(res.blockers.length).toBe(0);
  });

  it('nên chặn Gate 3 khi lô có cờ hasActiveOOS', () => {
    const passingTestResult: TestResult = {
      id: 'tr-01',
      batchId: 'batch-01',
      status: 'APPROVED',
      overallStatus: 'PASS',
      labName: 'Lab QC',
      testDate: '2026-01-02',
      results: [
        { criteriaName: 'Định lượng', value: 100.2, isPass: true },
        { criteriaName: 'Độ rã', value: 8, isPass: true },
      ],
      createdAt: '2026-01-02',
    };

    const res = ReleaseRules.evaluate7ReleaseGates({
      batch: { ...mockBatch, hasActiveOOS: true },
      testResults: [passingTestResult],
      boundTccs: mockTccs,
      userRole: 'QA',
    });

    expect(res.allGatesPassed).toBe(false);
    expect(res.gates[2].gateIndex).toBe(3);
    expect(res.gates[2].passed).toBe(false); // Gate 3: OOS failed
  });
});
