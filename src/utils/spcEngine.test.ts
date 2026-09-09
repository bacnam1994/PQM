import { describe, it, expect } from 'vitest';
import { 
  calcMean, 
  calcStdDev, 
  calcWithinStdDev, 
  calcProcessCapability, 
  detectNelsonRules 
} from './spcEngine';

describe('Advanced SPC Engine (ISO 22514 / AIAG)', () => {
  const sampleData = [10.2, 10.5, 9.8, 10.1, 10.4, 9.9, 10.0, 10.3, 10.1, 9.7];

  it('tính toán Mean, Overall StdDev và Within StdDev chính xác', () => {
    const mean = calcMean(sampleData);
    const overallStd = calcStdDev(sampleData, mean);
    const withinStd = calcWithinStdDev(sampleData);

    expect(mean).toBeCloseTo(10.1, 1);
    expect(overallStd).toBeGreaterThan(0);
    expect(withinStd).toBeGreaterThan(0);
  });

  it('tính toán chỉ số năng lực quy trình Cp, Cpk, Pp, Ppk khi có giới hạn 2 phía', () => {
    // Với dữ liệu chuẩn tâm quanh 10, USL = 11.5, LSL = 8.5
    const res = calcProcessCapability(sampleData, 11.5, 8.5);

    expect(res.cp).not.toBeNull();
    expect(res.cpk).not.toBeNull();
    expect(res.pp).not.toBeNull();
    expect(res.ppk).not.toBeNull();
    expect(res.status).toBe('CAPABLE');
    expect(res.cpk!).toBeGreaterThanOrEqual(1.33);
  });

  it('tính toán Cpk một phía (chỉ có LSL)', () => {
    const res = calcProcessCapability(sampleData, undefined, 8.5);
    expect(res.cp).toBeNull(); // Không có USL thì không có Cp 2 phía
    expect(res.cpk).not.toBeNull();
    expect(res.cpk!).toBeGreaterThan(0);
  });

  describe('8 Quy tắc Nelson (Nelson Rules for SPC)', () => {
    it('phát hiện Rule 1: 1 điểm đột biến ngoài 3-Sigma (Outlier)', () => {
      // Mean = 10, sigma = 1. Đưa vào điểm 15 (> 13)
      const data = [10, 10, 10.1, 9.9, 10, 10.2, 15, 9.8, 10];
      const violations = detectNelsonRules(data, 10, 1);

      expect(violations.some(v => v.ruleNumber === 1)).toBe(true);
      const r1 = violations.find(v => v.ruleNumber === 1);
      expect(r1!.violationIndices).toContain(6); // Vị trí số 15
    });

    it('phát hiện Rule 2: 9 điểm liên tiếp cùng 1 phía đường trung bình (Mean Shift)', () => {
      // Mean = 10. 9 điểm liên tiếp > 10
      const data = [10.5, 10.6, 10.4, 10.8, 10.3, 10.7, 10.5, 10.9, 10.6];
      const violations = detectNelsonRules(data, 10, 1);

      expect(violations.some(v => v.ruleNumber === 2)).toBe(true);
    });

    it('phát hiện Rule 3: 6 điểm liên tiếp tăng dần đều (Trend)', () => {
      const data = [10.0, 10.2, 10.4, 10.6, 10.8, 11.0];
      const violations = detectNelsonRules(data, 10, 1);

      expect(violations.some(v => v.ruleNumber === 3)).toBe(true);
    });

    it('phát hiện Rule 4: 14 điểm liên tiếp đan xen lên xuống (Oscillation)', () => {
      const data = [
        10.5, 9.5, 10.4, 9.6, 10.5, 9.5, 10.4, 9.6,
        10.5, 9.5, 10.4, 9.6, 10.5, 9.5
      ];
      const violations = detectNelsonRules(data, 10, 1);

      expect(violations.some(v => v.ruleNumber === 4)).toBe(true);
    });

    it('phát hiện Rule 5: 2 trong 3 điểm liên tiếp ngoài 2-Sigma cùng phía', () => {
      // Mean = 10, Sigma = 1. 2 điểm > 12
      const data = [10, 10, 12.5, 10.2, 12.3, 10];
      const violations = detectNelsonRules(data, 10, 1);

      expect(violations.some(v => v.ruleNumber === 5)).toBe(true);
    });

    it('phát hiện Rule 7: 15 điểm liên tiếp nằm trong 1-Sigma (Stratification)', () => {
      // Mean = 10, Sigma = 2. Tất cả các điểm nằm trong [9.5, 10.5] (rất sát tâm)
      const data = Array(15).fill(10.1);
      const violations = detectNelsonRules(data, 10, 2);

      expect(violations.some(v => v.ruleNumber === 7)).toBe(true);
    });
  });
});
