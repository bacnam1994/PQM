import { describe, it, expect } from 'vitest';
import { calculateSPCMetricsRemote } from './cloudFunctionsService';

describe('Cloud Functions Service Gateway & Hybrid Fallback', () => {
  it('tự động fallback về SPC Engine cục bộ khi tính toán mảng dữ liệu', async () => {
    const values = [98.5, 99.2, 100.1, 99.8, 100.5, 99.1, 100.2, 99.9, 100.4, 99.7];
    const result = await calculateSPCMetricsRemote({
      values,
      usl: 105,
      lsl: 95,
      target: 100
    });

    expect(result).toBeDefined();
    expect(result.parameters).toBeDefined();
    expect(result.parameters.mean).toBeCloseTo(99.74, 1);
    expect(result.capability).toBeDefined();
    expect(result.capability.status).toBe('CAPABLE');
    expect(Array.isArray(result.nelsonViolations)).toBe(true);
  });

  it('xử lý an toàn khi mảng dữ liệu rỗng hoặc dưới 2 điểm', async () => {
    const result = await calculateSPCMetricsRemote({
      values: [100],
      usl: 105,
      lsl: 95
    });

    expect(result).toBeDefined();
    expect(result.capability.cp).toBeNull();
    expect(result.capability.cpk).toBeNull();
    expect(result.nelsonViolations).toHaveLength(0);
  });
});
