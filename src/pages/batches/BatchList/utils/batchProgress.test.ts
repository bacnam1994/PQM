import { describe, it, expect } from 'vitest';
import { calculateBatchProgress } from './batchProgress';
import { TestResult } from '../../../../types';

describe('Batch Progress Calculator', () => {
  const mockBatch = {
    id: 'batch-001',
    productId: 'prod-001',
    tccs: {
      id: 'tccs-001',
      mainQualityCriteria: [
        { name: 'Định lượng Paracetamol', standard: '95 - 105%' },
        { name: 'Độ hòa tan', standard: '≥ 75%' }
      ],
      safetyCriteria: [
        { name: 'Tạp chất liên quan', standard: '≤ 0.5%' }
      ]
    }
  };

  it('trả về 0% khi chưa có kết quả kiểm nghiệm nào', () => {
    const { progressPercent, missingCriteria } = calculateBatchProgress(mockBatch, []);
    expect(progressPercent).toBe(0);
    expect(missingCriteria).toHaveLength(3);
  });

  it('tính toán đúng tiến độ khi đã kiểm một phần chỉ tiêu', () => {
    const mockResults: TestResult[] = [
      {
        id: 'tr-001',
        batchId: 'batch-001',
        testDate: '2026-01-01',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Định lượng Paracetamol', value: '100.2%', isPass: true }
        ]
      } as any
    ];

    const { progressPercent, missingCriteria } = calculateBatchProgress(mockBatch, mockResults);
    expect(progressPercent).toBe(33);
    expect(missingCriteria).toHaveLength(2);
    expect(missingCriteria.map(c => c.name)).not.toContain('Định lượng Paracetamol');
  });

  it('đạt 100% khi tất cả chỉ tiêu chính và an toàn đều đã kiểm', () => {
    const mockResults: TestResult[] = [
      {
        id: 'tr-001',
        batchId: 'batch-001',
        testDate: '2026-01-01',
        overallStatus: 'PASS',
        results: [
          { criteriaName: 'Định lượng Paracetamol', value: '100.2%', isPass: true },
          { criteriaName: 'Độ hòa tan', value: '88%', isPass: true },
          { criteriaName: 'Tạp chất liên quan', value: '0.1%', isPass: true }
        ]
      } as any
    ];

    const { progressPercent, missingCriteria } = calculateBatchProgress(mockBatch, mockResults);
    expect(progressPercent).toBe(100);
    expect(missingCriteria).toHaveLength(0);
  });
});
