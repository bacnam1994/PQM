import { describe, it, expect } from 'vitest';
import { calcMean, calcStdDev, calcCpk, removeVietnameseTones, parseCriterionBound } from './spcHelpers';

describe('spcHelpers - SPC Calculation & Utilities', () => {
  it('tính toán chính xác giá trị Mean và Standard Deviation', () => {
    const data = [10, 12, 14, 16, 18];
    const mean = calcMean(data);
    expect(mean).toBe(14);

    const std = calcStdDev(data, mean);
    expect(Math.round(std * 100) / 100).toBe(3.16);
  });

  it('tính toán chính xác chỉ số năng lực quy trình Cpk', () => {
    const mean = 100;
    const std = 2;
    const usl = 110;
    const lsl = 90;

    // Cpk = min((110-100)/(3*2), (100-90)/(3*2)) = 10 / 6 = 1.666...
    const cpk = calcCpk(mean, std, usl, lsl);
    expect(cpk).not.toBeNull();
    expect(Math.round(cpk! * 100) / 100).toBe(1.67);
  });

  it('xử lý các trường hợp giới hạn một phía (chỉ có USL hoặc LSL)', () => {
    const mean = 50;
    const std = 1;
    const usl = 55;
    const cpkUpperOnly = calcCpk(mean, std, usl, undefined);
    expect(Math.round(cpkUpperOnly! * 100) / 100).toBe(1.67);

    const lsl = 45;
    const cpkLowerOnly = calcCpk(mean, std, undefined, lsl);
    expect(Math.round(cpkLowerOnly! * 100) / 100).toBe(1.67);
  });

  it('bỏ dấu tiếng Việt chuẩn xác cho tìm kiếm', () => {
    expect(removeVietnameseTones('Paracetamol 500mg Dược Phẩm')).toBe('paracetamol 500mg duoc pham');
    expect(removeVietnameseTones('Định lượng Hoạt chất')).toBe('dinh luong hoat chat');
  });

  it('parseCriterionBound trích xuất đúng số', () => {
    expect(parseCriterionBound('100')).toBe(100);
    expect(parseCriterionBound(95.5)).toBe(95.5);
    expect(parseCriterionBound('≥ 90.0%')).toBe(90);
    expect(parseCriterionBound(null)).toBeUndefined();
  });
});
