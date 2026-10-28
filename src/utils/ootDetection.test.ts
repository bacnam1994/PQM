import { describe, it, expect } from 'vitest';
import { detectOOTForCriterion, calculateStandardDeviation, BatchCriterionDataPoint } from './ootDetection';

describe('ootDetection Utilities', () => {
  it('calculates mean and standard deviation correctly', () => {
    const values = [10, 12, 14, 16, 18];
    const { mean, stdDev } = calculateStandardDeviation(values);
    expect(mean).toBe(14);
    expect(stdDev).toBeCloseTo(3.162, 2);
  });

  it('detects monotonic decreasing trend (4 consecutive decreasing batches)', () => {
    const dataPoints: BatchCriterionDataPoint[] = [
      { batchId: '1', batchNo: 'L01', testDate: '2026-01-01', value: 100, criteriaName: 'Hàm lượng C' },
      { batchId: '2', batchNo: 'L02', testDate: '2026-02-01', value: 95, criteriaName: 'Hàm lượng C' },
      { batchId: '3', batchNo: 'L03', testDate: '2026-03-01', value: 91, criteriaName: 'Hàm lượng C' },
      { batchId: '4', batchNo: 'L04', testDate: '2026-04-01', value: 87, criteriaName: 'Hàm lượng C' },
    ];

    const anomalies = detectOOTForCriterion('Hàm lượng C', dataPoints, { minLimit: 80, maxLimit: 120 });
    expect(anomalies.some(a => a.type === 'MONOTONIC_DRIFT')).toBe(true);
    const drift = anomalies.find(a => a.type === 'MONOTONIC_DRIFT');
    expect(drift?.consecutiveCount).toBe(4);
    expect(drift?.affectedBatches).toEqual(['L01', 'L02', 'L03', 'L04']);
  });

  it('detects near-spec limit warning when approaching boundary', () => {
    const dataPoints: BatchCriterionDataPoint[] = [
      { batchId: '1', batchNo: 'L01', testDate: '2026-01-01', value: 100, criteriaName: 'Độ ẩm' },
      { batchId: '2', batchNo: 'L02', testDate: '2026-02-01', value: 98, criteriaName: 'Độ ẩm' },
      { batchId: '3', batchNo: 'L03', testDate: '2026-03-01', value: 81.5, criteriaName: 'Độ ẩm' },
    ];

    // Spec is 80 to 120 -> lower limit 80, range 40 -> 8% buffer is 83.2. Value 81.5 is in near-spec region.
    const anomalies = detectOOTForCriterion('Độ ẩm', dataPoints, { minLimit: 80, maxLimit: 120 });
    expect(anomalies.some(a => a.type === 'NEAR_SPEC_LIMIT')).toBe(true);
    const nearLimit = anomalies.find(a => a.type === 'NEAR_SPEC_LIMIT');
    expect(nearLimit?.severity).toBe('HIGH');
  });

  it('returns no anomalies for healthy, stable batch series', () => {
    const dataPoints: BatchCriterionDataPoint[] = [
      { batchId: '1', batchNo: 'L01', testDate: '2026-01-01', value: 101, criteriaName: 'Định lượng' },
      { batchId: '2', batchNo: 'L02', testDate: '2026-02-01', value: 99, criteriaName: 'Định lượng' },
      { batchId: '3', batchNo: 'L03', testDate: '2026-03-01', value: 102, criteriaName: 'Định lượng' },
      { batchId: '4', batchNo: 'L04', testDate: '2026-04-01', value: 100, criteriaName: 'Định lượng' },
    ];

    const anomalies = detectOOTForCriterion('Định lượng', dataPoints, { minLimit: 80, maxLimit: 120 });
    expect(anomalies.length).toBe(0);
  });
});
