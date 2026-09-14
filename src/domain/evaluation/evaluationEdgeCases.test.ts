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
import { OverallResultEvaluator } from './OverallResultEvaluator';

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

    it('không đạt chuẩn khi lab trả về < 10 nhưng tiêu chuẩn <= 3 (sửa lỗi LOD hardcode 10)', () => {
      const specLte3 = SpecificationParser.parse('<= 3');
      expect(CriterionEvaluator.evaluateParsed(specLte3, normalizeValue('< 10'))).toBe(false);
      // Ngược lại < 2 thỏa mãn tiêu chuẩn <= 3 vì 2 <= 3
      expect(CriterionEvaluator.evaluateParsed(specLte3, normalizeValue('< 2'))).toBe(true);
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
    it('đánh giá đúng dải min 5, max 10 kèm quy tắc làm tròn số nguyên khi tiêu chuẩn không có phần thập phân', () => {
      const spec = SpecificationParser.parse('5 - 10');
      expect(spec.type).toBe('RANGE');
      expect(spec.min).toBe(5);
      expect(spec.max).toBe(10);

      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('5'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('7.5'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10'))).toBe(true);
      // Làm tròn số nguyên theo tiêu chuẩn không có phần thập phân (4.99 -> 5, 10.01 -> 10)
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('4.99'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10.01'))).toBe(true);
      // Ngoài khoảng sau khi làm tròn
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('4.4'))).toBe(false);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10.6'))).toBe(false);

      // Với tiêu chuẩn có chữ số thập phân (5.00 - 10.00), 4.99 không được làm tròn lên 5
      const specDec = SpecificationParser.parse('5.00 - 10.00');
      expect(CriterionEvaluator.evaluateParsed(specDec, normalizeValue('4.99'))).toBe(false);
      expect(CriterionEvaluator.evaluateParsed(specDec, normalizeValue('10.01'))).toBe(false);
    });

    it('bóc tách chính xác dải khoảng liền kề số dạng 5.0-10.0 và -20.0--10.0', () => {
      const specAdjacent = SpecificationParser.parse('5.0-10.0');
      expect(specAdjacent.type).toBe('RANGE');
      expect(specAdjacent.min).toBe(5.0);
      expect(specAdjacent.max).toBe(10.0);

      const specNegative = SpecificationParser.parse('-20.0--10.0');
      expect(specNegative.type).toBe('RANGE');
      expect(specNegative.min).toBe(-20.0);
      expect(specNegative.max).toBe(-10.0);
    });
  });

  // Case 9: 5 ~ 10 (Dải khoảng dấu ngã)
  describe('Case 9: 5 ~ 10 (Dải khoảng dấu ngã)', () => {
    it('đánh giá đúng dải min 5, max 10 với ký tự ngã kèm quy tắc làm tròn', () => {
      const spec = SpecificationParser.parse('5 ~ 10');
      expect(spec.type).toBe('RANGE');
      expect(spec.min).toBe(5);
      expect(spec.max).toBe(10);

      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('5'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('8'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10'))).toBe(true);
      // Làm tròn số nguyên (4.9 -> 5, 10.1 -> 10)
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('4.9'))).toBe(true);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10.1'))).toBe(true);
      // Ngoài khoảng sau khi làm tròn
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('4.4'))).toBe(false);
      expect(CriterionEvaluator.evaluateParsed(spec, normalizeValue('10.6'))).toBe(false);
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

    it('nhận diện siêu linh hoạt các biến thể khoa học (1.5 x 10^8, 1.5*10^8, 1.5 × 10⁸, 1.5x10 8) mà không làm hỏng số nguyên thường (100, 1000)', () => {
      expect(parseNumberFromText('1.5 x 10^8')).toBe(150000000);
      expect(parseNumberFromText('1.5*10^8')).toBe(150000000);
      expect(parseNumberFromText('1.5 × 10⁸')).toBe(150000000);
      expect(parseNumberFromText('1.5x10 8')).toBe(150000000);
      expect(parseNumberFromText('10^3')).toBe(1000);
      expect(parseNumberFromText('10³')).toBe(1000);
      expect(parseNumberFromText('100')).toBe(100);
      expect(parseNumberFromText('1000')).toBe(1000);
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

    it('CONDITIONAL_CHECK: tại cấp chỉ tiêu không làm thay đổi isPass của chỉ tiêu Main, quyết định tổng thể thuộc về OverallResultEvaluator', () => {
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

      // Với CONDITIONAL_CHECK, evaluateCriterionWithAlternates trả về isPass: false cho Main
      const res = AlternateRuleEvaluator.evaluateCriterionWithAlternates(
        mainCriterion,
        '78',
        { 'Độ hòa tan (Giai đoạn 2)': '76' },
        alternateRules
      );

      expect(res.isPass).toBe(false);
      expect(res.usedAlternate).toBe(false);

      // Thẩm định tổng thể qua OverallResultEvaluator:
      const tccs: any = { alternateRules };

      // 1. Khi điều kiện được kích hoạt và chỉ tiêu alt đạt -> PASS
      const resultsTriggeredPass: any[] = [
        { criteriaName: 'Độ hòa tan (Giai đoạn 1)', value: '78', isPass: true },
        { criteriaName: 'Độ hòa tan (Giai đoạn 2)', value: '76', isPass: true },
      ];
      expect(OverallResultEvaluator.calculateOverallStatus(resultsTriggeredPass, tccs)).toBe(
        'PASS'
      );

      // 2. Khi điều kiện được kích hoạt mà chỉ tiêu alt không đạt/thiếu -> FAIL
      const resultsTriggeredFail: any[] = [
        { criteriaName: 'Độ hòa tan (Giai đoạn 1)', value: '78', isPass: true },
        { criteriaName: 'Độ hòa tan (Giai đoạn 2)', value: '', isPass: false },
      ];
      expect(OverallResultEvaluator.calculateOverallStatus(resultsTriggeredFail, tccs)).toBe(
        'FAIL'
      );

      // 3. VÁ BUG 3 (Tránh chết chùm): Khi điều kiện KHÔNG kích hoạt (< 75), alt bị FAIL nhưng vẫn được MIỄN KIỂM -> PASS
      const microbialTCCS: any = {
        alternateRules: [
          {
            id: 'rule_micro',
            type: 'CONDITIONAL_CHECK',
            main: 'Tổng số vi sinh vật',
            alt: 'E.coli',
            conditionValue: '> 1000',
          },
        ],
      };
      const resultsExempted: any[] = [
        { criteriaName: 'Tổng số vi sinh vật', value: '500', isPass: true }, // <= 1000 -> không kích hoạt
        { criteriaName: 'E.coli', value: '', isPass: false }, // không làm / đánh rớt
      ];
      expect(OverallResultEvaluator.calculateOverallStatus(resultsExempted, microbialTCCS)).toBe(
        'PASS'
      );
    });

    it('checkRuleExemption: kiểm tra chính xác toán tử của điều kiện qua CriterionEvaluator', () => {
      const activeTCCS = { id: 'tccs1' };
      const tccsMaps = {
        rulesMap: new Map([
          [
            'e.coli',
            { type: 'CONDITIONAL_CHECK', main: 'Tổng số vi sinh vật', conditionValue: '> 1000' },
          ],
        ]),
        criteriaMap: new Map([
          ['tổng số vi sinh vật', { name: 'Tổng số vi sinh vật', type: 'NUMBER', max: 5000 }],
        ]),
      };

      // TH1: Vi sinh vật = 500 (không kích hoạt điều kiện > 1000) -> Được miễn kiểm E.coli
      const isExempted500 = AlternateRuleEvaluator.checkRuleExemption(
        'e.coli',
        (name) => (name === 'tổng số vi sinh vật' ? '500' : undefined),
        activeTCCS,
        tccsMaps,
        new Map()
      );
      expect(isExempted500).toBe(true);

      // TH2: Vi sinh vật = 1500 (kích hoạt điều kiện > 1000) -> Bắt buộc kiểm tra, KHÔNG được miễn kiểm
      const isExempted1500 = AlternateRuleEvaluator.checkRuleExemption(
        'e.coli',
        (name) => (name === 'tổng số vi sinh vật' ? '1500' : undefined),
        activeTCCS,
        tccsMaps,
        new Map()
      );
      expect(isExempted1500).toBe(false);
    });
  });
});
