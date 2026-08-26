import { describe, it, expect } from 'vitest';
import { evaluateBatchQualityClearance } from './batchClearanceService';
import { TestResult, TCCS, CriterionType } from '../../types';

describe('batchClearanceService - AI Batch Quality Clearance Dossier', () => {
  const mockBatch = {
    id: 'batch-001',
    batchNo: 'LOT-2026-001',
    mfgDate: '2026-01-15',
    expDate: '2028-01-15',
    product: { id: 'p-1', name: 'Paracetamol 500mg' }
  };

  const mockTccs: TCCS = {
    id: 'tccs-001',
    productId: 'p-1',
    code: 'TCCS 01:2026/VB',
    issueDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    isActive: true,
    mainQualityCriteria: [
      { name: 'Cảm quan', type: CriterionType.TEXT, expectedText: 'Viên nén màu trắng', unit: '' },
      { name: 'Độ rã', type: CriterionType.NUMBER, min: undefined, max: 15, unit: 'phút' },
      { name: 'Định lượng Paracetamol', type: CriterionType.NUMBER, min: 475, max: 525, unit: 'mg' }
    ],
    safetyCriteria: [
      { name: 'Giới hạn vi sinh vật', type: CriterionType.TEXT, expectedText: 'Đạt', unit: '' }
    ]
  };

  it('should grant READY_FOR_RELEASE when all required criteria are tested and within limits', () => {
    const testResults: TestResult[] = [
      {
        id: 'tr-001',
        batchId: 'batch-001',
        labName: 'QC Lab',
        testDate: '2026-01-20',
        createdAt: '2026-01-20T08:00:00Z',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Cảm quan', value: 'Viên nén màu trắng', isPass: true },
          { criteriaName: 'Độ rã', value: '8', isPass: true, unit: 'phút' },
          { criteriaName: 'Định lượng Paracetamol', value: '500', isPass: true, unit: 'mg' },
          { criteriaName: 'Giới hạn vi sinh vật', value: 'Đạt', isPass: true }
        ]
      }
    ];

    const dossier = evaluateBatchQualityClearance(mockBatch, testResults, mockTccs);
    expect(dossier.verdict).toBe('READY_FOR_RELEASE');
    expect(dossier.readinessScore).toBe(100);
    expect(dossier.missingCriteria.length).toBe(0);
    expect(dossier.failedCount).toBe(0);
    expect(dossier.nearLimitItems.length).toBe(0);
  });

  it('should flag HOLD_FOR_INVESTIGATION when there is an OOS failed criterion', () => {
    const testResults: TestResult[] = [
      {
        id: 'tr-002',
        batchId: 'batch-001',
        labName: 'QC Lab',
        testDate: '2026-01-20',
        createdAt: '2026-01-20T08:00:00Z',
        overallStatus: 'FAIL',
        results: [
          { criteriaName: 'Cảm quan', value: 'Viên nén màu trắng', isPass: true },
          { criteriaName: 'Độ rã', value: '25', isPass: false, unit: 'phút' },
          { criteriaName: 'Định lượng Paracetamol', value: '500', isPass: true, unit: 'mg' },
          { criteriaName: 'Giới hạn vi sinh vật', value: 'Đạt', isPass: true }
        ]
      }
    ];

    const dossier = evaluateBatchQualityClearance(mockBatch, testResults, mockTccs);
    expect(dossier.verdict).toBe('HOLD_FOR_INVESTIGATION');
    expect(dossier.failedCount).toBe(1);
    expect(dossier.readinessScore).toBeLessThan(80);
    expect(dossier.riskFactors.some(r => r.includes('KHÔNG ĐẠT'))).toBe(true);
  });

  it('should detect near-limit edge criteria and recommend caution', () => {
    const testResults: TestResult[] = [
      {
        id: 'tr-003',
        batchId: 'batch-001',
        labName: 'QC Lab',
        testDate: '2026-01-20',
        createdAt: '2026-01-20T08:00:00Z',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Cảm quan', value: 'Viên nén màu trắng', isPass: true },
          { criteriaName: 'Độ rã', value: '14.8', isPass: true, unit: 'phút' },
          { criteriaName: 'Định lượng Paracetamol', value: '476', isPass: true, unit: 'mg' },
          { criteriaName: 'Giới hạn vi sinh vật', value: 'Đạt', isPass: true }
        ]
      }
    ];

    const dossier = evaluateBatchQualityClearance(mockBatch, testResults, mockTccs);
    expect(dossier.nearLimitItems.length).toBeGreaterThan(0);
    expect(dossier.verdict).toBe('CONDITIONAL_RELEASE');
  });

  it('should identify missing criteria if batch has incomplete test results', () => {
    const testResults: TestResult[] = [
      {
        id: 'tr-004',
        batchId: 'batch-001',
        labName: 'QC Lab',
        testDate: '2026-01-20',
        createdAt: '2026-01-20T08:00:00Z',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Cảm quan', value: 'Viên nén màu trắng', isPass: true }
        ]
      }
    ];

    const dossier = evaluateBatchQualityClearance(mockBatch, testResults, mockTccs);
    expect(dossier.missingCriteria).toContain('Độ rã');
    expect(dossier.missingCriteria).toContain('Định lượng Paracetamol');
    expect(dossier.readinessScore).toBeLessThan(90);
  });
});
