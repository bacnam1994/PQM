import { describe, it, expect } from 'vitest';
import { formatDate, calcPercentile, getCriterionLimitText } from './reportHelpers';
import { Criterion, CriterionType } from '../../../../types';

describe('reportHelpers - Summary Report Utilities', () => {
  it('formatDate chuyển đổi ngày ISO sang DD/MM/YYYY chuẩn', () => {
    expect(formatDate('2026-09-09')).toBe('09/09/2026');
    expect(formatDate('')).toBe('---');
    expect(formatDate('invalid')).toBe('invalid');
  });

  it('calcPercentile tính phân vị chính xác', () => {
    const data = [10, 20, 30, 40, 50];
    expect(calcPercentile(data, 0)).toBe(10);
    expect(calcPercentile(data, 50)).toBe(30);
    expect(calcPercentile(data, 100)).toBe(50);
  });

  it('getCriterionLimitText hiển thị chính xác giới hạn tiêu chuẩn', () => {
    const critRange: Criterion = {
      name: 'Độ hòa tan',
      min: 75,
      max: 100,
      unit: '%',
      type: CriterionType.NUMBER
    };
    expect(getCriterionLimitText(critRange)).toBe('75 – 100 %');

    const critMaxOnly: Criterion = {
      name: 'Tạp chất',
      max: 0.5,
      unit: '%',
      type: CriterionType.NUMBER
    };
    expect(getCriterionLimitText(critMaxOnly)).toBe('≤ 0.5 %');

    const critMinOnly: Criterion = {
      name: 'Hàm lượng',
      min: 95,
      unit: '%',
      type: CriterionType.NUMBER
    };
    expect(getCriterionLimitText(critMinOnly)).toBe('≥ 95 %');
  });
});
