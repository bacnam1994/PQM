/**
 * evaluationEdgeCases.test.ts
 * Bộ kiểm thử toàn diện 18 trường hợp biên (18 Edge Cases) cho QualityEvaluationEngine
 * Đảm bảo 100% Deterministic và độ chính xác tiêu chuẩn Dược điển.
 */

import { describe, it, expect } from 'vitest';
import { CriterionEvaluator } from './CriterionEvaluator';
import { SpecificationParser } from './SpecificationParser';
import { normalizeValue, parseNumberFromText } from './ValueNormalizer';
import { QualityEvaluationEngine } from './QualityEvaluationEngine';
import { AlternateRuleEvaluator } from './AlternateRuleEvaluator';

describe('P4 — Evaluation Engine 18 Edge Cases Test Suite', () => {
  // Case 1: ND (Not Detected / Không phát hiện)
  describe('Case 1: ND (Not Detected / Không phát hiện)', () => {
    it('đạt chuẩn khi tiêu chuẩn yêu cầu ND và giá trị là ND/KPH/Không phát hiện', () => {
      const spec = SpecificationParser.parse('Không phát hiện');
      expect(spec.type).toBe('NOT_DETECTED');

      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('ND'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('KPH'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('Không phát hiện'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('Âm tính'))).toBe(true);
    });

    it('không đạt khi tiêu chuẩn yêu cầu ND nhưng phát hiện có số dương', () => {
      const spec = SpecificationParser.parse('ND');
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('15'))).toBe(false);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('Dương tính'))).toBe(false);
    });
  });

  // Case 2: Negative (Âm tính)
  describe('Case 2: Negative (Âm tính)', () => {
    it('đạt chuẩn khi tiêu chuẩn là Âm tính và kết quả là Âm tính / Negative', () => {
      const spec = SpecificationParser.parse('Âm tính');
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('Âm tính'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('Negative'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('Dương tính'))).toBe(false);
    });
  });

  // Case 3: Positive (Dương tính)
  describe('Case 3: Positive (Dương tính)', () => {
    it('đạt chuẩn khi tiêu chuẩn là Dương tính và kết quả là Dương tính / Positive', () => {
      const spec = SpecificationParser.parse('Dương tính');
      expect(spec.type).toBe('POSITIVE');
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('Dương tính'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('Positive'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('Âm tính'))).toBe(false);
    });
  });

  // Case 4: < LOD (Nhỏ hơn giới hạn phát hiện: lab xuất < 10 CFU/g khi đĩa 0 khuẩn lạc)
  describe('Case 4: < LOD (Giới hạn phát hiện phòng kiểm nghiệm)', () => {
    it('đạt chuẩn khi tiêu chuẩn vi sinh <= 10 hoặc NMT 10 và lab trả về < 10', () => {
      const specLte = SpecificationParser.parse('<= 10');
      expect(CriterionEvaluator.evaluateParsed(specLte, normalizeValue('< 10'))).toBe(true);

      const specNmt = SpecificationParser.parse('NMT 10 CFU/g');
      expect(CriterionEvaluator.evaluateParsed(specNmt, normalizeValue('< 10 CFU/g'))).toBe(true);
    });

    it('đạt chuẩn khi tiêu chuẩn yêu cầu Không phát hiện và lab trả về < 10', () => {
      const specND = SpecificationParser.parse('Không phát hiện');
      expect(CriterionEvaluator.evaluateParsed(specND, normalizeValue('< 10'))).toBe(true);
    });
  });

  // Case 5: < LOQ (Nhỏ hơn giới hạn định lượng)
  describe('Case 5: < LOQ (Giới hạn định lượng)', () => {
    it('đạt chuẩn khi chỉ tiêu tạp chất <= 0.1% và lab trả về < 0.05%', () => {
      const spec = SpecificationParser.parse('<= 0.1%');
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('< 0.05%'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('0.08%'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('0.15%'))).toBe(false);
    });
  });

  // Case 6: 10 ± 2 (Dung sai tuyệt đối)
  describe('Case 6: 10 ± 2 (Dung sai tuyệt đối)', () => {
    it('đánh giá đúng dải từ 8.0 đến 12.0', () => {
      const spec = SpecificationParser.parse('10 ± 2');
      expect(spec.type).toBe('TOLERANCE');
      expect(spec.baseValue).toBe(10);
      expect(spec.toleranceValue).toBe(2);

      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('8'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('12'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('7.99'))).toBe(false);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('12.01'))).toBe(false);
    });
  });

  // Case 7: 100 ± 10% (Dung sai phần trăm)
  describe('Case 7: 100 ± 10% (Dung sai phần trăm)', () => {
    it('đánh giá đúng dải từ 90.0 đến 110.0%', () => {
      const spec = SpecificationParser.parse('100 ± 10%');
      expect(spec.type).toBe('TOLERANCE');
      expect(spec.isPercentageTolerance).toBe(true);

      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('100'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('90'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('110'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('89.9'))).toBe(false);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('110.1'))).toBe(false);
    });
  });

  // Case 8: 5 - 10 (Dải khoảng dấu gạch ngang)
  describe('Case 8: 5 - 10 (Dải khoảng dấu gạch ngang)', () => {
    it('đánh giá đúng dải min 5, max 10', () => {
      const spec = SpecificationParser.parse('5 - 10');
      expect(spec.type).toBe('RANGE');
      expect(spec.min).toBe(5);
      expect(spec.max).toBe(10);

      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('5'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('7.5'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('4.99'))).toBe(false);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10.01'))).toBe(false);
    });
  });

  // Case 9: 5 ~ 10 (Dải khoảng dấu ngã)
  describe('Case 9: 5 ~ 10 (Dải khoảng dấu ngã)', () => {
    it('đánh giá đúng dải min 5, max 10 với ký tự ngã', () => {
      const spec = SpecificationParser.parse('5 ~ 10');
      expect(spec.type).toBe('RANGE');
      expect(spec.min).toBe(5);
      expect(spec.max).toBe(10);

      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('5'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('8'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('4.9'))).toBe(false);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10.1'))).toBe(false);
    });
  });

  // Case 10: -20 - -10 (Dải số âm)
  describe('Case 10: -20 - -10 (Dải số âm)', () => {
    it('bóc tách và so sánh chính xác khoảng nhiệt độ bảo quản âm', () => {
      const spec = SpecificationParser.parse('-20 - -10');
      expect(spec.type).toBe('RANGE');
      expect(spec.min).toBe(-20);
      expect(spec.max).toBe(-10);

      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('-15'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('-20'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('-10'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('-21'))).toBe(false);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('-9'))).toBe(false);
    });
  });

  // Case 11: 1.25 (Dấu chấm thập phân tiêu chuẩn)
  describe('Case 11: 1.25 (Dấu chấm thập phân tiêu chuẩn)', () => {
    it('nhận diện và đánh giá chính xác số thập phân dấu chấm', () => {
      const spec = SpecificationParser.parse('1.0 - 1.5');
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('1.25'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('1.55'))).toBe(false);
    });
  });

  // Case 12: 1,25 (Dấu phẩy thập phân kiểu Việt/Âu)
  describe('Case 12: 1,25 (Dấu phẩy thập phân kiểu Việt/Âu)', () => {
    it('tự động chuẩn hóa dấu phẩy thành dấu chấm thập phân', () => {
      const norm = normalizeValue('1,25');
      expect(norm.numericValue).toBe(1.25);

      const spec = SpecificationParser.parse('1.0 - 1.5');
      expect(CriterionEvaluator.evaluateParsed(spec, norm)).toBe(true);

      const specWithComma = SpecificationParser.parse('1,0 - 1,5');
      expect(specWithComma.min).toBe(1.0);
      expect(specWithComma.max).toBe(1.5);
      expect(CriterionEvaluator.evaluateParsed(specWithComma, norm)).toBe(true);
    });
  });

  // Case 13: 1e-3 (Ký hiệu khoa học)
  describe('Case 13: 1e-3 (Ký hiệu khoa học)', () => {
    it('chuẩn hóa 1e-3 thành 0.001 và đánh giá chính xác', () => {
      const parsed = parseNumberFromText('1e-3');
      expect(parsed).toBe(0.001);

      const spec = SpecificationParser.parse('<= 0.01');
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('1e-3'))).toBe(true);

      const strictSpec = SpecificationParser.parse('<= 0.0005');
      expect(CriterionEvaluator.evaluateParsed(strictSpec, normalizeValue('1e-3'))).toBe(false);
    });
  });

  // Case 14: 0.001 (Dạng chuẩn mở rộng)
  describe('Case 14: 0.001 (Dạng chuẩn mở rộng)', () => {
    it('so sánh tương đương giữa 0.001 và 1e-3', () => {
      const spec = SpecificationParser.parse('<= 1e-2');
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('0.001'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('0.05'))).toBe(false);
    });
  });

  // Case 15: Empty string
  describe('Case 15: Chuỗi rỗng ""', () => {
    it('trả về isPass false khi giá trị rỗng', () => {
      const criterion = { name: 'Định lượng', type: 'NUMBER', min: 90, max: 110 };
      const res = CriterionEvaluator.evaluateCriterion(criterion, '');
      expect(res.isPass).toBe(false);
    });
  });

  // Case 16: Null & Undefined
  describe('Case 16: Null & Undefined', () => {
    it('xử lý an toàn khi giá trị kiểm nghiệm là null hoặc undefined', () => {
      const criterion = { name: 'Định lượng', type: 'NUMBER', min: 90, max: 110 };
      const resNull = CriterionEvaluator.evaluateCriterion(criterion, null);
      expect(resNull.isPass).toBe(false);

      const resUndef = CriterionEvaluator.evaluateCriterion(criterion, undefined);
      expect(resUndef.isPass).toBe(false);
    });
  });

  // Case 17: Invalid string format
  describe('Case 17: Giá trị không hợp lệ (Invalid string)', () => {
    it('trả về isPass false khi chuỗi không parse được số cho chỉ tiêu NUMBER', () => {
      const criterion = { name: 'Độ ẩm', type: 'NUMBER', min: 0, max: 9.0 };
      const res = CriterionEvaluator.evaluateCriterion(criterion, 'không rõ số');
      expect(res.isPass).toBe(false);
    });
  });

  // Case 18: Alternate Rule (FAIL_RETRY & CONDITIONAL_CHECK)
  describe('Case 18: Quy tắc thay thế (FAIL_RETRY & CONDITIONAL_CHECK)', () => {
    it('FAIL_RETRY: khi chỉ tiêu chính không đạt, nếu chỉ tiêu thay thế đạt điều kiện thì kết quả đạt theo rule', () => {
      const mainCriterion = {
        name: 'Độ đồng đều khối lượng',
        type: 'NUMBER',
        min: 95,
        max: 105,
      };

      const alternateRules = [
        {
          id: 'rule_retry',
          type: 'FAIL_RETRY' as const,
          main: 'Độ đồng đều khối lượng',
          alt: 'Độ đồng đều khối lượng (Lần 2)',
          conditionValue: '95 - 105',
        },
      ];

      // Chỉ tiêu chính = 92 (FAIL), nhưng Lần 2 = 98 (nằm trong 95 - 105 -> PASS)
      const res = AlternateRuleEvaluator.evaluateCriterionWithAlternates(
        mainCriterion,
        '92',
        { 'Độ đồng đều khối lượng (Lần 2)': '98' },
        alternateRules
      );

      expect(res.isPass).toBe(true);
      expect(res.usedAlternate).toBe(true);
      expect(res.ruleApplied).toBe('FAIL_RETRY');
      expect(res.alternateCriterionName).toBe('Độ đồng đều khối lượng (Lần 2)');
    });

    it('CONDITIONAL_CHECK: kiểm tra điều kiện chỉ tiêu thay thế khi chỉ tiêu chính không đạt', () => {
      const mainCriterion = {
        name: 'Độ hòa tan (Giai đoạn 1)',
        type: 'NUMBER',
        min: 80,
        max: 100,
      };

      const alternateRules = [
        {
          id: 'rule_cond',
          type: 'CONDITIONAL_CHECK' as const,
          main: 'Độ hòa tan (Giai đoạn 1)',
          alt: 'Độ hòa tan (Giai đoạn 2)',
          conditionValue: '>= 75',
        },
      ];

      // Giai đoạn 1 = 78 (FAIL), Giai đoạn 2 = 76 (>= 75 -> PASS)
      const res = AlternateRuleEvaluator.evaluateCriterionWithAlternates(
        mainCriterion,
        '78',
        { 'Độ hòa tan (Giai đoạn 2)': '76' },
        alternateRules
      );

      expect(res.isPass).toBe(true);
      expect(res.usedAlternate).toBe(true);
      expect(res.ruleApplied).toBe('CONDITIONAL_CHECK');
    });
  });
});
