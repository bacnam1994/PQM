import { describe, it, expect } from 'vitest';
import { checkRange, evaluateCriterionWithAlternates } from './criteriaEvaluation';
import { CriterionType } from '../types';

describe('checkRange()', () => {
  describe('1. Logic Not Detected (ND) / Âm tính / Dương tính', () => {
    it('should handle ND limits correctly', () => {
      expect(checkRange('Không phát hiện', 'Âm tính')).toBe(true);
      expect(checkRange('ND', '0')).toBe(true);
      expect(checkRange('Không phát hiện', '0.5')).toBe(false);
      expect(checkRange('Âm tính', 'Dương tính')).toBe(false);
    });

    it('should handle Positive limits correctly', () => {
      expect(checkRange('Dương tính', 'Có phát hiện')).toBe(true);
      expect(checkRange('Positive', 'Detected')).toBe(true);
    });
  });

  describe('2. Logic dung sai (±) và phần trăm (%)', () => {
    it('should handle absolute tolerance', () => {
      expect(checkRange('10 ± 2', '12')).toBe(true);
      expect(checkRange('10 ± 2', '8')).toBe(true);
      expect(checkRange('10 ± 2', '13')).toBe(false);
    });

    it('should handle percentage tolerance', () => {
      expect(checkRange('100 ± 10%', '110')).toBe(true);
      expect(checkRange('100 ± 10%', '89.9')).toBe(false);
      expect(checkRange('-20 ± 10%', '-18')).toBe(true);
    });
  });

  describe('3. Logic khoảng (min - max, min ~ max)', () => {
    it('should handle tilde (~) and hyphen (-) ranges', () => {
      expect(checkRange('5.0 ~ 10.0', '7.5')).toBe(true);
      expect(checkRange('5.0 - 10.0', '10')).toBe(true);
      expect(checkRange('5.0 - 10.0', '10.1')).toBe(false);
    });

    it('should correctly handle negative ranges without breaking', () => {
      expect(checkRange('-20.0 - -10.0', '-15')).toBe(true);
      expect(checkRange('-20.0 ~ -10.0', '-15')).toBe(true);
      expect(checkRange('-20.0 - -10.0', '-5')).toBe(false);
    });
  });

  describe('4. Logic toán tử so sánh (<=, >=, <, >)', () => {
    it('should evaluate inequalities accurately', () => {
      expect(checkRange('<= 10', '10')).toBe(true);
      expect(checkRange('≤ 10', '11')).toBe(false);
      expect(checkRange('> 5', '5')).toBe(false);
      expect(checkRange('>= 5.5', '6.0')).toBe(true);
      expect(checkRange('100', '100.1')).toBe(false);
    });
  });

  describe('5. Sai số thập phân (Floating-point precision)', () => {
    it('should bypass JS float math issues with relative epsilon', () => {
      expect(checkRange('<= 0.3', '0.30000000000000004')).toBe(true);
      expect(checkRange('0.1 - 0.3', '0.30000000000000004')).toBe(true);
    });
  });

  describe('6. Giá trị nhập có tiền tố toán tử (Below Detection Limit)', () => {
    it('<10 phải ĐẠT khi giới hạn là "< 10 CFU/g" (strict less-than)', () => {
      expect(checkRange('< 10 CFU/g', '<10')).toBe(true);
      expect(checkRange('< 10', '<10')).toBe(true);
      expect(checkRange('< 10', '<5')).toBe(true);
      expect(checkRange('< 10', '<15')).toBe(false);
    });

    it('<10 phải ĐẠT khi giới hạn là "≤ 10 CFU/g" (less-than-or-equal)', () => {
      expect(checkRange('≤ 10 CFU/g', '<10')).toBe(true);
      expect(checkRange('<= 10', '<10')).toBe(true);
    });

    it('>10 phải ĐẠT khi giới hạn là "> 10" (strict greater-than)', () => {
      expect(checkRange('> 10', '>10')).toBe(true);
      expect(checkRange('>= 10', '>10')).toBe(true);
    });

    it('Số bình thường (không có tiền tố) vẫn hoạt động đúng', () => {
      expect(checkRange('< 10', '9')).toBe(true);
      expect(checkRange('< 10', '10')).toBe(false);
      expect(checkRange('≤ 10', '10')).toBe(true);
    });
  });

  describe('7. Toán tử USP/BP: NMT (Not More Than) và NLT (Not Less Than)', () => {
    it('NMT phải hoạt động như <= (Not More Than)', () => {
      expect(checkRange('NMT 10', '10')).toBe(true);
      expect(checkRange('NMT 10', '9.5')).toBe(true);
      expect(checkRange('NMT 10.0', '10.1')).toBe(false);
      expect(checkRange('nmt 0.5', '0.4')).toBe(true);
      expect(checkRange('NMT 0.5', '0.6')).toBe(false);
    });

    it('NLT phải hoạt động như >= (Not Less Than)', () => {
      expect(checkRange('NLT 95', '95')).toBe(true);
      expect(checkRange('NLT 95.0', '96')).toBe(true);
      expect(checkRange('NLT 95.0', '94.9')).toBe(false);
      expect(checkRange('nlt 90', '90')).toBe(true);
    });
  });

  describe('8. Định dạng lũy thừa & số khoa học (Probiotics / Vi sinh)', () => {
    it('Đánh giá đúng các yêu cầu và kết quả chứa 10^9, 1.5 x 10^9 CFU/g', () => {
      expect(checkRange('≥ 10^9 CFU/g', '1.5 x 10^9 CFU/g')).toBe(true);
      expect(checkRange('≥ 10^9', '1.5 x 10^9')).toBe(true);
      expect(checkRange('≥ 10^9', '8.0 x 10^8')).toBe(false);
      expect(checkRange('10^9 - 2.5 x 10^9', '1.5 x 10^9')).toBe(true);
      expect(checkRange('≥ 10⁸', '1.2 x 10⁸')).toBe(true);
    });
  });
});

describe('evaluateCriterionWithAlternates()', () => {
  const baseCriterion = { name: 'Độ hòa tan', type: CriterionType.NUMBER, max: 80 };

  it('Trả về isPass=true, usedAlternate=false khi chỉ tiêu chính đạt', () => {
    const result = evaluateCriterionWithAlternates(baseCriterion, '75', {}, []);
    expect(result.isPass).toBe(true);
    expect(result.usedAlternate).toBe(false);
  });

  it('Trả về isPass=false khi chỉ tiêu chính không đạt và không có rule', () => {
    const result = evaluateCriterionWithAlternates(baseCriterion, '85', {}, []);
    expect(result.isPass).toBe(false);
    expect(result.usedAlternate).toBe(false);
  });

  it('FAIL_RETRY: Trả về isPass=true khi alt đạt điều kiện', () => {
    const allValues = { 'Độ hòa tan stage 2': '79' };
    const rules = [{ main: 'Độ hòa tan', alt: 'Độ hòa tan stage 2', type: 'FAIL_RETRY' as const, conditionValue: '<= 80' }];
    const result = evaluateCriterionWithAlternates(baseCriterion, '85', allValues, rules);
    expect(result.isPass).toBe(true);
    expect(result.usedAlternate).toBe(true);
  });

  it('FAIL_RETRY: Trả về isPass=false khi alt không đạt điều kiện', () => {
    const allValues = { 'Độ hòa tan stage 2': '82' };
    const rules = [{ main: 'Độ hòa tan', alt: 'Độ hòa tan stage 2', type: 'FAIL_RETRY' as const, conditionValue: '<= 80' }];
    const result = evaluateCriterionWithAlternates(baseCriterion, '85', allValues, rules);
    expect(result.isPass).toBe(false);
    expect(result.usedAlternate).toBe(false);
  });
});