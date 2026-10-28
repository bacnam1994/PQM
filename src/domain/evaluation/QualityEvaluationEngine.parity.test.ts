import { describe, it, expect } from 'vitest';
import { QualityEvaluationEngine } from './QualityEvaluationEngine';
import { CriterionEvaluator } from './CriterionEvaluator';
import {
  checkRange as legacyCheckRange,
  evaluateCriterionSmart as legacyEvaluateCriterionSmart,
  evaluateCriterionWithAlternates as legacyEvaluateCriterionWithAlternates,
} from '../../utils/criteriaEvaluation';
import { calculateOverallStatus as legacyCalculateOverallStatus } from '../../utils/evaluation';
import { CriterionType, TestResultEntry } from '../../types';

describe('Phase 3 — QualityEvaluationEngine 100% Parity Test Suite', () => {
  describe('1. Parity: checkRange vs QualityEvaluationEngine.checkRange', () => {
    const testCases: Array<{ limit: string; value: string; desc: string }> = [
      // ND & Qualitative
      { limit: 'Không phát hiện', value: 'Âm tính', desc: 'ND limit vs Negative value' },
      { limit: 'ND', value: '0', desc: 'ND vs 0' },
      { limit: 'Không phát hiện', value: '0.5', desc: 'ND vs positive decimal' },
      { limit: 'Âm tính', value: 'Dương tính', desc: 'Negative vs Positive' },
      { limit: 'Dương tính', value: 'Có phát hiện', desc: 'Positive vs Detected' },
      { limit: 'Positive', value: 'Detected', desc: 'English Positive' },

      // Tolerance
      { limit: '10 ± 2', value: '12', desc: 'Tolerance upper limit' },
      { limit: '10 ± 2', value: '8', desc: 'Tolerance lower limit' },
      { limit: '10 ± 2', value: '13', desc: 'Tolerance out of bounds' },
      { limit: '100 ± 10%', value: '110', desc: 'Percentage tolerance max' },
      { limit: '100 ± 10%', value: '89.9', desc: 'Percentage tolerance min fail' },
      { limit: '-20 ± 10%', value: '-18', desc: 'Negative base percentage tolerance' },

      // Range
      { limit: '5.0 ~ 10.0', value: '7.5', desc: 'Tilde range midpoint' },
      { limit: '5.0 - 10.0', value: '10', desc: 'Hyphen range boundary' },
      { limit: '5.0 - 10.0', value: '10.1', desc: 'Hyphen range exceed' },
      { limit: '-20.0 - -10.0', value: '-15', desc: 'Negative range midpoint' },
      { limit: '-20.0 ~ -10.0', value: '-15', desc: 'Negative range tilde' },
      { limit: '-20.0 - -10.0', value: '-5', desc: 'Negative range exceed' },

      // Inequalities
      { limit: '<= 10', value: '10', desc: 'Less than or equal boundary' },
      { limit: '≤ 10', value: '11', desc: 'Unicode less than or equal exceed' },
      { limit: '> 5', value: '5', desc: 'Strict greater than boundary fail' },
      { limit: '>= 5.5', value: '6.0', desc: 'Greater than or equal pass' },
      { limit: '100', value: '100.1', desc: 'Single number upper limit fail' },
      { limit: 'NMT 10', value: '10', desc: 'USP NMT boundary pass' },
      { limit: 'NMT 10', value: '10.1', desc: 'USP NMT exceed fail' },
      { limit: 'NLT 95', value: '95', desc: 'USP NLT boundary pass' },
      { limit: 'NLT 95', value: '94.9', desc: 'USP NLT lower fail' },

      // Floating-point precision
      { limit: '<= 0.3', value: '0.30000000000000004', desc: 'JS float relative epsilon' },
      { limit: '0.1 - 0.3', value: '0.30000000000000004', desc: 'Range JS float epsilon' },

      // Below detection limit / LOD
      { limit: '< 10 CFU/g', value: '<10', desc: 'LOD strict less than' },
      { limit: '< 10', value: '<10', desc: 'LOD matching boundary' },
      { limit: '< 10', value: '<5', desc: 'LOD below limit' },
      { limit: '< 10', value: '<15', desc: 'LOD above limit fail' },
      { limit: '≤ 10 CFU/g', value: '<10', desc: 'LOD vs less equal' },
      { limit: '≤ 3', value: '< 10', desc: 'Plate count dilution LOD zero CFU' },
      { limit: '≤ 3 CFU/g', value: '< 10 CFU/g', desc: 'Plate count with units' },
      { limit: '≤ 3', value: '< 10^1', desc: 'Plate count scientific' },
      { limit: '≤ 3', value: '< 3', desc: 'Plate count <3' },
      { limit: '≤ 3', value: '< 0.1', desc: 'Plate count trace' },
      { limit: '< 3', value: '< 10', desc: 'Strict less 3 vs <10' },
      { limit: 'NMT 3', value: '< 10', desc: 'NMT vs <10' },
      { limit: '0 - 3', value: '< 10', desc: '0-3 vs <10' },
      { limit: 'Không được có', value: '< 10', desc: 'Qualitative zero vs <10' },
      { limit: 'Âm tính', value: '< 10', desc: 'Negative vs <10' },
      { limit: '≤ 3', value: '4', desc: 'Positive exceed fail' },
      { limit: '≤ 3', value: '10', desc: 'Positive 10 exceed fail' },
      { limit: '90 - 110', value: '< 10', desc: 'Quantitative min fail vs <10' },
      { limit: '≥ 80', value: '< 10', desc: 'Quantitative min bound vs <10' },
      { limit: '> 10', value: '>10', desc: 'Strict greater than matching' },
      { limit: '> 10', value: '>15', desc: 'Strict greater than above' },
      { limit: '> 10', value: '>5', desc: 'Strict greater than below fail' },
    ];

    testCases.forEach(({ limit, value, desc }) => {
      it(`Parity: ${desc} ("${limit}" vs "${value}")`, () => {
        const legacyResult = legacyCheckRange(limit, value);
        const newResult = QualityEvaluationEngine.checkRange(limit, value);
        expect(newResult).toBe(legacyResult);
      });
    });
  });

  describe('2. Parity: evaluateCriterionSmart vs QualityEvaluationEngine.evaluateCriterionSmart', () => {
    const criteriaList = [
      { name: 'Độ ẩm', type: CriterionType.NUMBER, max: 9.0 },
      { name: 'pH', type: CriterionType.NUMBER, min: 4.0, max: 6.5 },
      { name: 'Định lượng', type: CriterionType.NUMBER, min: 90.0, max: 110.0 },
      { name: 'Tổng số vi sinh vật hiếu khí', type: CriterionType.NUMBER, max: 1000 },
      { name: 'E. coli', type: CriterionType.TEXT, expectedText: 'Không được có' },
      { name: 'Cảm quan', type: CriterionType.TEXT, expectedText: 'Viên nang cứng màu nâu' },
    ];

    const values = [
      { criterion: criteriaList[0], val: '8.5' },
      { criterion: criteriaList[0], val: '9.0' },
      { criterion: criteriaList[0], val: '9.2' },
      { criterion: criteriaList[1], val: '5.2' },
      { criterion: criteriaList[1], val: '3.9' },
      { criterion: criteriaList[2], val: '105' },
      { criterion: criteriaList[2], val: '85' },
      { criterion: criteriaList[3], val: '1.5x10^2' },
      { criterion: criteriaList[3], val: '< 10' },
      { criterion: criteriaList[3], val: '2.5x10^3' },
      { criterion: criteriaList[4], val: 'Âm tính' },
      { criterion: criteriaList[4], val: 'Dương tính' },
      { criterion: criteriaList[5], val: 'Viên nang cứng màu nâu' },
      { criterion: criteriaList[5], val: 'Bột vón cục' },
    ];

    values.forEach(({ criterion, val }) => {
      it(`Parity Smart: ${criterion.name} = "${val}"`, () => {
        const legacyResult = legacyEvaluateCriterionSmart(criterion, val);
        const newResult = QualityEvaluationEngine.evaluateCriterionSmart(criterion, val);
        expect(newResult).toBe(legacyResult);
      });
    });
  });

  describe('3. Parity: evaluateCriterionWithAlternates vs QualityEvaluationEngine', () => {
    const criterion = { name: 'Độ hòa tan Stage 1', type: CriterionType.NUMBER, min: 80 };
    const alternateRules = [
      {
        main: 'Độ hòa tan Stage 1',
        alt: 'Độ hòa tan Stage 2',
        type: 'FAIL_RETRY' as const,
        conditionValue: '>= 75',
      },
    ];

    it('Parity: Pass ngay ở chỉ tiêu chính', () => {
      const legacyRes = legacyEvaluateCriterionWithAlternates(criterion, '85', {}, alternateRules);
      const newRes = QualityEvaluationEngine.evaluateCriterionWithAlternates(
        criterion,
        '85',
        {},
        alternateRules
      );
      expect(newRes.isPass).toBe(legacyRes.isPass);
      expect(newRes.usedAlternate).toBe(legacyRes.usedAlternate);
    });

    it('Parity: Fail chỉ tiêu chính nhưng Pass ở Stage 2 (FAIL_RETRY)', () => {
      const allValues = { 'Độ hòa tan Stage 2': '78' };
      const legacyRes = legacyEvaluateCriterionWithAlternates(
        criterion,
        '70',
        allValues,
        alternateRules
      );
      const newRes = QualityEvaluationEngine.evaluateCriterionWithAlternates(
        criterion,
        '70',
        allValues,
        alternateRules
      );
      expect(newRes.isPass).toBe(legacyRes.isPass);
      expect(newRes.usedAlternate).toBe(legacyRes.usedAlternate);
    });

    it('Parity: Fail cả chỉ tiêu chính lẫn Stage 2', () => {
      const allValues = { 'Độ hòa tan Stage 2': '65' };
      const legacyRes = legacyEvaluateCriterionWithAlternates(
        criterion,
        '70',
        allValues,
        alternateRules
      );
      const newRes = QualityEvaluationEngine.evaluateCriterionWithAlternates(
        criterion,
        '70',
        allValues,
        alternateRules
      );
      expect(newRes.isPass).toBe(legacyRes.isPass);
      expect(newRes.usedAlternate).toBe(legacyRes.usedAlternate);
    });
  });

  describe('4. Parity: calculateOverallStatus vs QualityEvaluationEngine.calculateOverallStatus', () => {
    it('Parity: Tất cả chỉ tiêu PASS -> PASS', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Độ ẩm', value: '8.0', isPass: true },
        { criteriaName: 'Định lượng', value: '100', isPass: true },
      ];
      expect(QualityEvaluationEngine.calculateOverallStatus(results, null)).toBe(
        legacyCalculateOverallStatus(results, null)
      );
    });

    it('Parity: Một chỉ tiêu FAIL không có alternate rule -> FAIL', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Độ ẩm', value: '12.0', isPass: false },
        { criteriaName: 'Định lượng', value: '100', isPass: true },
      ];
      expect(QualityEvaluationEngine.calculateOverallStatus(results, null)).toBe(
        legacyCalculateOverallStatus(results, null)
      );
    });

    it('Parity: Phiếu rỗng -> FAIL', () => {
      expect(QualityEvaluationEngine.calculateOverallStatus([], null)).toBe(
        legacyCalculateOverallStatus([], null)
      );
    });

    it('Parity: Số 0 CFU không bị nhầm với rỗng', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Nấm mốc', value: 0, isPass: true },
        { criteriaName: 'Coliforms', value: '0', isPass: true },
      ];
      expect(QualityEvaluationEngine.calculateOverallStatus(results, null)).toBe('PASS');
      expect(QualityEvaluationEngine.calculateOverallStatus(results, null)).toBe(
        legacyCalculateOverallStatus(results, null)
      );
    });
  });
});
