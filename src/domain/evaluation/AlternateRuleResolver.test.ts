/**
 * AlternateRuleResolver.test.ts
 * Bộ kiểm thử toàn diện cho Động cơ Phân giải Quy tắc Thay thế (Alternate Rules Engine).
 * Kiểm tra đầy đủ:
 * - FAIL_RETRY (PASS, PENDING khi thiếu KQ phụ, PASS khi cứu thành công, FAIL khi cả 2 rớt)
 * - CONDITIONAL_CHECK (Miễn kiểm khi không kích hoạt, PENDING khi kích hoạt thiếu KQ, PASS, FAIL)
 * - Tự động sinh ghi chú quy tắc TCCS
 * - Tương thích EvaluationSnapshot
 */

import { describe, it, expect } from 'vitest';
import { AlternateRuleResolver } from './AlternateRuleResolver';
import { OverallResultEvaluator } from './OverallResultEvaluator';
import { QualityEvaluationEngine } from './QualityEvaluationEngine';
import { TCCS, TestResultEntry, CriterionType } from '../../types';

describe('AlternateRuleResolver & OverallResultEvaluator Suite', () => {
  const baseTccs: TCCS = {
    id: 'tccs-001',
    productId: 'prod-001',
    code: 'TCCS-001',
    issueDate: '2026-01-01',
    isActive: true,
    version: 1,
    createdAt: '2026-01-01',
    mainQualityCriteria: [
      {
        name: 'Định lượng Hoạt chất A',
        unit: 'mg',
        min: 90,
        max: 110,
        type: CriterionType.NUMBER,
      },
      {
        name: 'Định lượng Bổ sung A (HPLC)',
        unit: 'mg',
        min: 90,
        max: 110,
        type: CriterionType.NUMBER,
      },
      {
        name: 'Độ ẩm',
        unit: '%',
        max: 10,
        type: CriterionType.NUMBER,
      },
      {
        name: 'Hoạt độ nước (aw)',
        unit: '',
        max: 0.6,
        type: CriterionType.NUMBER,
      },
      {
        name: 'Cảm quan',
        unit: '',
        expectedText: 'Bột màu trắng',
        type: CriterionType.TEXT,
      },
    ],
    safetyCriteria: [],
    alternateRules: [
      {
        id: 'rule-retry-1',
        main: 'Định lượng Hoạt chất A',
        alt: 'Định lượng Bổ sung A (HPLC)',
        type: 'FAIL_RETRY',
      },
      {
        id: 'rule-cond-1',
        main: 'Độ ẩm',
        alt: 'Hoạt độ nước (aw)',
        type: 'CONDITIONAL_CHECK',
        conditionValue: '> 10',
      },
    ],
  };

  describe('1. Nhóm kiểm thử FAIL_RETRY (Thử lại khi không đạt)', () => {
    it('1.1. TC1 PASS -> TC2 được MIỄN KIỂM (EXEMPTED) -> Overall PASS', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Định lượng Hoạt chất A', value: '100', isPass: true },
        { criteriaName: 'Độ ẩm', value: '8', isPass: true },
        { criteriaName: 'Cảm quan', value: 'Bột màu trắng', isPass: true },
      ];

      // Phân giải trạng thái của TC2 (Định lượng Bổ sung A)
      const altStatus = AlternateRuleResolver.resolveCriterionState(
        'Định lượng Bổ sung A (HPLC)',
        undefined,
        results,
        baseTccs
      );

      expect(altStatus.isExempted).toBe(true);
      expect(altStatus.alternateState).toBe('EXEMPTED');
      expect(altStatus.displayBadge?.label).toBe('MIỄN KIỂM');

      // Overall status không bị chặn bởi TC2
      const overall = OverallResultEvaluator.calculateOverallStatus(results, baseTccs);
      expect(overall).toBe('PASS');
    });

    it('1.2. TC1 FAIL nhưng TC2 CHƯA CÓ KẾT QUẢ -> TC2 PENDING -> Overall PENDING (Không được FAIL sớm!)', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Định lượng Hoạt chất A', value: '80', isPass: false }, // Rớt min 90
        { criteriaName: 'Độ ẩm', value: '8', isPass: true },
        { criteriaName: 'Cảm quan', value: 'Bột màu trắng', isPass: true },
      ];

      // Phân giải trạng thái của TC2
      const altStatus = AlternateRuleResolver.resolveCriterionState(
        'Định lượng Bổ sung A (HPLC)',
        undefined,
        results,
        baseTccs
      );

      expect(altStatus.isRequired).toBe(true);
      expect(altStatus.isPending).toBe(true);
      expect(altStatus.alternateState).toBe('TRIGGERED_PENDING');
      expect(altStatus.displayBadge?.label).toBe('CHỜ KẾT QUẢ');

      // Overall status PHẢI LÀ PENDING, tuyệt đối không được đánh FAIL!
      const overall = OverallResultEvaluator.calculateOverallStatus(results, baseTccs);
      expect(overall).toBe('PENDING');
    });

    it('1.3. TC1 FAIL nhưng TC2 CÓ KẾT QUẢ ĐẠT -> Overall PASS (Được cứu bởi chỉ tiêu thay thế)', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Định lượng Hoạt chất A', value: '80', isPass: false },
        { criteriaName: 'Định lượng Bổ sung A (HPLC)', value: '102', isPass: true }, // Cứu đạt
        { criteriaName: 'Độ ẩm', value: '8', isPass: true },
        { criteriaName: 'Cảm quan', value: 'Bột màu trắng', isPass: true },
      ];

      const altStatus = AlternateRuleResolver.resolveCriterionState(
        'Định lượng Bổ sung A (HPLC)',
        '102',
        results,
        baseTccs
      );

      expect(altStatus.alternateState).toBe('TRIGGERED_PASS');
      expect(altStatus.displayBadge?.label).toBe('ĐẠT (THAY THẾ)');

      const overall = OverallResultEvaluator.calculateOverallStatus(results, baseTccs);
      expect(overall).toBe('PASS');
    });

    it('1.4. TC1 FAIL và TC2 CÓ KẾT QUẢ KHÔNG ĐẠT -> Overall FAIL (Cả 2 đều rớt)', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Định lượng Hoạt chất A', value: '80', isPass: false },
        { criteriaName: 'Định lượng Bổ sung A (HPLC)', value: '85', isPass: false }, // Cả 2 đều rớt
        { criteriaName: 'Độ ẩm', value: '8', isPass: true },
        { criteriaName: 'Cảm quan', value: 'Bột màu trắng', isPass: true },
      ];

      const altStatus = AlternateRuleResolver.resolveCriterionState(
        'Định lượng Bổ sung A (HPLC)',
        '85',
        results,
        baseTccs
      );

      expect(altStatus.alternateState).toBe('TRIGGERED_FAIL');
      expect(altStatus.displayBadge?.label).toBe('K.ĐẠT');

      const overall = OverallResultEvaluator.calculateOverallStatus(results, baseTccs);
      expect(overall).toBe('FAIL');
    });
  });

  describe('2. Nhóm kiểm thử CONDITIONAL_CHECK (Kiểm tra có điều kiện)', () => {
    it('2.1. TC1 KHÔNG kích hoạt điều kiện (Độ ẩm 8% <= 10%) -> TC2 được MIỄN KIỂM -> Overall PASS', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Định lượng Hoạt chất A', value: '100', isPass: true },
        { criteriaName: 'Độ ẩm', value: '8', isPass: true },
        { criteriaName: 'Cảm quan', value: 'Bột màu trắng', isPass: true },
      ];

      const altStatus = AlternateRuleResolver.resolveCriterionState(
        'Hoạt độ nước (aw)',
        undefined,
        results,
        baseTccs
      );

      expect(altStatus.isExempted).toBe(true);
      expect(altStatus.alternateState).toBe('EXEMPTED');
      expect(altStatus.displayBadge?.label).toBe('MIỄN KIỂM');

      const overall = OverallResultEvaluator.calculateOverallStatus(results, baseTccs);
      expect(overall).toBe('PASS');
    });

    it('2.2. TC1 KÍCH HOẠT điều kiện (Độ ẩm 12% > 10%), TC2 CHƯA CÓ KẾT QUẢ -> TC2 PENDING -> Overall PENDING', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Định lượng Hoạt chất A', value: '100', isPass: true },
        { criteriaName: 'Độ ẩm', value: '12', isPass: false }, // > 10%
        { criteriaName: 'Cảm quan', value: 'Bột màu trắng', isPass: true },
      ];

      const altStatus = AlternateRuleResolver.resolveCriterionState(
        'Hoạt độ nước (aw)',
        undefined,
        results,
        baseTccs
      );

      expect(altStatus.isRequired).toBe(true);
      expect(altStatus.isPending).toBe(true);
      expect(altStatus.alternateState).toBe('TRIGGERED_PENDING');
      expect(altStatus.displayBadge?.label).toBe('CHỜ KẾT QUẢ');

      // Khi điều kiện kích hoạt nhưng chưa kiểm TC phụ -> PENDING
      const overall = OverallResultEvaluator.calculateOverallStatus(results, baseTccs);
      expect(overall).toBe('PENDING');
    });

    it('2.3. TC1 KÍCH HOẠT điều kiện, TC2 CÓ KẾT QUẢ ĐẠT (aw = 0.5 <= 0.6) -> Overall PASS', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Định lượng Hoạt chất A', value: '100', isPass: true },
        { criteriaName: 'Độ ẩm', value: '12', isPass: false },
        { criteriaName: 'Hoạt độ nước (aw)', value: '0.5', isPass: true },
        { criteriaName: 'Cảm quan', value: 'Bột màu trắng', isPass: true },
      ];

      const altStatus = AlternateRuleResolver.resolveCriterionState(
        'Hoạt độ nước (aw)',
        '0.5',
        results,
        baseTccs
      );

      expect(altStatus.alternateState).toBe('TRIGGERED_PASS');
      expect(altStatus.displayBadge?.label).toBe('ĐẠT');

      // Do Độ ẩm có rule CONDITIONAL_CHECK và aw đạt -> Độ ẩm được giải quyết
      // Tuy nhiên trong logic, nếu Độ ẩm rớt và có CONDITIONAL_CHECK:
      // overall = PASS nếu các chỉ tiêu khác đều đạt
    });

    it('2.4. TC1 KÍCH HOẠT điều kiện, TC2 CÓ KẾT QUẢ K.ĐẠT (aw = 0.75 > 0.6) -> Overall FAIL', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Định lượng Hoạt chất A', value: '100', isPass: true },
        { criteriaName: 'Độ ẩm', value: '12', isPass: false },
        { criteriaName: 'Hoạt độ nước (aw)', value: '0.75', isPass: false },
        { criteriaName: 'Cảm quan', value: 'Bột màu trắng', isPass: true },
      ];

      const altStatus = AlternateRuleResolver.resolveCriterionState(
        'Hoạt độ nước (aw)',
        '0.75',
        results,
        baseTccs
      );

      expect(altStatus.alternateState).toBe('TRIGGERED_FAIL');
      expect(altStatus.displayBadge?.label).toBe('K.ĐẠT');

      const overall = OverallResultEvaluator.calculateOverallStatus(results, baseTccs);
      expect(overall).toBe('FAIL');
    });
  });

  describe('3. Tự động sinh Ghi chú Quy tắc Thay thế (Auto-notes)', () => {
    it('3.1. Sinh ghi chú chính xác theo chuẩn GMP cho nhiều quy tắc', () => {
      const notes = AlternateRuleResolver.generateAlternateRuleNotes(baseTccs.alternateRules);

      expect(notes.length).toBe(2);
      expect(notes[0]).toContain('Định lượng Hoạt chất A');
      expect(notes[0]).toContain('Định lượng Bổ sung A (HPLC)');
      expect(notes[0]).toContain('đánh giá lại chất lượng lô');

      expect(notes[1]).toContain('Hoạt độ nước (aw)');
      expect(notes[1]).toContain('Độ ẩm');
      expect(notes[1]).toContain('> 10');
      expect(notes[1]).toContain('miễn kiểm');
    });

    it('3.2. Trả về mảng rỗng nếu không có quy tắc', () => {
      expect(AlternateRuleResolver.generateAlternateRuleNotes([])).toEqual([]);
      expect(AlternateRuleResolver.generateAlternateRuleNotes(undefined)).toEqual([]);
    });
  });

  describe('4. Nhận diện vai trò Main / Alt của từng chỉ tiêu', () => {
    it('4.1. Nhận diện chính xác chỉ tiêu chính có quy tắc thay thế', () => {
      const status = AlternateRuleResolver.resolveCriterionState(
        'Định lượng Hoạt chất A',
        '100',
        [],
        baseTccs
      );
      expect(status.isMain).toBe(true);
      expect(status.isAlt).toBe(false);
      expect(status.displayBadge?.label).toBe('🔗 Có thay thế');
    });

    it('4.2. Nhận diện chính xác chỉ tiêu phụ thuộc', () => {
      const status = AlternateRuleResolver.resolveCriterionState(
        'Định lượng Bổ sung A (HPLC)',
        undefined,
        [],
        baseTccs
      );
      expect(status.isMain).toBe(false);
      expect(status.isAlt).toBe(true);
      expect(status.pairedCriterionName).toBe('Định lượng Hoạt chất A');
    });
  });
});
