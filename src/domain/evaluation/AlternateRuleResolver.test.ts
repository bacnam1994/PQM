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
        max: 15,
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
        { criteriaName: 'Độ ẩm', value: '12', isPass: true }, // <= 15% (ĐẠT) nhưng > 10% (kích hoạt)
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
        { criteriaName: 'Độ ẩm', value: '12', isPass: true },
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

      const overall = OverallResultEvaluator.calculateOverallStatus(results, baseTccs);
      expect(overall).toBe('PASS');
    });

    it('2.4. TC1 KÍCH HOẠT điều kiện, TC2 CÓ KẾT QUẢ K.ĐẠT (aw = 0.75 > 0.6) -> Overall FAIL', () => {
      const results: TestResultEntry[] = [
        { criteriaName: 'Định lượng Hoạt chất A', value: '100', isPass: true },
        { criteriaName: 'Độ ẩm', value: '12', isPass: true },
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

  describe('5. Quy trình tự động chuẩn: Arsen tổng số (TC1) & Arsen vô cơ (TC2)', () => {
    const arsenicTCCS: TCCS = {
      id: 'tccs-arsenic',
      productId: 'prod-arsenic',
      code: 'TCCS-ARSENIC',
      issueDate: '2026-01-01',
      isActive: true,
      version: 1,
      createdAt: '2026-01-01',
      mainQualityCriteria: [
        {
          name: 'Arsen (As) tổng số',
          unit: 'mg/kg',
          max: 5,
          type: CriterionType.NUMBER,
        },
        {
          name: 'Arsen vô cơ',
          unit: 'mg/kg',
          max: 1.5,
          type: CriterionType.NUMBER,
        },
      ],
      safetyCriteria: [],
      alternateRules: [
        {
          id: 'rule-arsenic',
          main: 'Arsen (As) tổng số',
          alt: 'Arsen vô cơ',
          type: 'CONDITIONAL_CHECK',
          conditionValue: '1.5', // UI nhập số 1.5
        },
      ],
    };

    it('5.1. Arsen tổng số (TC1) KHÔNG ĐẠT (> 5 mg/kg) -> Phiếu lập tức FAIL độc lập với mọi điều kiện thay thế', () => {
      // 5.1a. TC1 rớt (6 mg/kg), TC2 chưa có kết quả -> Vẫn FAIL ngay lập tức, KHÔNG bị giữ ở PENDING
      const resultsWithoutTc2: TestResultEntry[] = [
        { criteriaName: 'Arsen (As) tổng số', value: '6', isPass: false },
      ];
      expect(OverallResultEvaluator.calculateOverallStatus(resultsWithoutTc2, arsenicTCCS)).toBe(
        'FAIL'
      );

      // 5.1b. TC1 rớt (6 mg/kg), ngay cả khi TC2 đạt (1.0 mg/kg) -> Vẫn FAIL (CONDITIONAL_CHECK không thể cứu TC1)
      const resultsWithPassingTc2: TestResultEntry[] = [
        { criteriaName: 'Arsen (As) tổng số', value: '6', isPass: false },
        { criteriaName: 'Arsen vô cơ', value: '1.0', isPass: true },
      ];
      expect(
        OverallResultEvaluator.calculateOverallStatus(resultsWithPassingTc2, arsenicTCCS)
      ).toBe('FAIL');

      // TC2 được giải quyết trạng thái là NOT_TRIGGERED do TC1 không đạt
      const tc2Status = AlternateRuleResolver.resolveCriterionState(
        'Arsen vô cơ',
        undefined,
        resultsWithoutTc2,
        arsenicTCCS
      );
      expect(tc2Status.alternateState).toBe('NOT_TRIGGERED');
    });

    it('5.2. Arsen tổng số (TC1) ĐẠT và <= 1.5 mg/kg -> TC2 MIỄN KIỂM, bỏ qua lỗi TC2, Overall ĐẠT (PASS)', () => {
      // 5.2a. TC1 = 1.2 mg/kg (<= 1.5), TC2 bỏ trống -> TC2 được MIỄN KIỂM -> Overall PASS
      const resultsEmptyTc2: TestResultEntry[] = [
        { criteriaName: 'Arsen (As) tổng số', value: '1.2', isPass: true },
      ];
      const tc2StatusEmpty = AlternateRuleResolver.resolveCriterionState(
        'Arsen vô cơ',
        undefined,
        resultsEmptyTc2,
        arsenicTCCS
      );
      expect(tc2StatusEmpty.isExempted).toBe(true);
      expect(tc2StatusEmpty.alternateState).toBe('EXEMPTED');
      expect(tc2StatusEmpty.displayBadge?.label).toBe('MIỄN KIỂM');
      expect(OverallResultEvaluator.calculateOverallStatus(resultsEmptyTc2, arsenicTCCS)).toBe(
        'PASS'
      );

      // 5.2b. TC1 = 1.5 mg/kg (chính xác bằng 1.5, <= 1.5) -> TC2 được MIỄN KIỂM
      const resultsExact15: TestResultEntry[] = [
        { criteriaName: 'Arsen (As) tổng số', value: '1.5', isPass: true },
      ];
      const tc2Status15 = AlternateRuleResolver.resolveCriterionState(
        'Arsen vô cơ',
        undefined,
        resultsExact15,
        arsenicTCCS
      );
      expect(tc2Status15.isExempted).toBe(true);
      expect(tc2Status15.alternateState).toBe('EXEMPTED');
      expect(OverallResultEvaluator.calculateOverallStatus(resultsExact15, arsenicTCCS)).toBe(
        'PASS'
      );

      // 5.2c. TC1 = 1.2 mg/kg ĐẠT, nhưng TC2 bị nhập kết quả không đạt (2.0 > 1.5) -> Hệ thống vẫn bỏ qua lỗi của TC2 -> Overall PASS
      const resultsFailedTc2: TestResultEntry[] = [
        { criteriaName: 'Arsen (As) tổng số', value: '1.2', isPass: true },
        { criteriaName: 'Arsen vô cơ', value: '2.0', isPass: false },
      ];
      const tc2StatusFailed = AlternateRuleResolver.resolveCriterionState(
        'Arsen vô cơ',
        '2.0',
        resultsFailedTc2,
        arsenicTCCS
      );
      expect(tc2StatusFailed.isExempted).toBe(true);
      expect(tc2StatusFailed.alternateState).toBe('EXEMPTED');
      expect(OverallResultEvaluator.calculateOverallStatus(resultsFailedTc2, arsenicTCCS)).toBe(
        'PASS'
      );
    });

    it('5.3. Arsen tổng số (TC1) ĐẠT và > 1.5 mg/kg -> Bắt buộc kiểm tra TC2', () => {
      // 5.3a. TC1 = 2.0 mg/kg (> 1.5 và <= 5), TC2 ĐẠT (1.0 mg/kg <= 1.5) -> Overall ĐẠT (PASS)
      const resultsPassBoth: TestResultEntry[] = [
        { criteriaName: 'Arsen (As) tổng số', value: '2.0', isPass: true },
        { criteriaName: 'Arsen vô cơ', value: '1.0', isPass: true },
      ];
      const tc2StatusPass = AlternateRuleResolver.resolveCriterionState(
        'Arsen vô cơ',
        '1.0',
        resultsPassBoth,
        arsenicTCCS
      );
      expect(tc2StatusPass.isRequired).toBe(true);
      expect(tc2StatusPass.alternateState).toBe('TRIGGERED_PASS');
      expect(tc2StatusPass.displayBadge?.label).toBe('ĐẠT');
      expect(OverallResultEvaluator.calculateOverallStatus(resultsPassBoth, arsenicTCCS)).toBe(
        'PASS'
      );

      // 5.3b. TC1 = 2.0 mg/kg, TC2 KHÔNG ĐẠT (2.0 mg/kg > 1.5) -> Overall KHÔNG ĐẠT (FAIL)
      const resultsFailTc2: TestResultEntry[] = [
        { criteriaName: 'Arsen (As) tổng số', value: '2.0', isPass: true },
        { criteriaName: 'Arsen vô cơ', value: '2.0', isPass: false },
      ];
      const tc2StatusFail = AlternateRuleResolver.resolveCriterionState(
        'Arsen vô cơ',
        '2.0',
        resultsFailTc2,
        arsenicTCCS
      );
      expect(tc2StatusFail.isRequired).toBe(true);
      expect(tc2StatusFail.alternateState).toBe('TRIGGERED_FAIL');
      expect(tc2StatusFail.displayBadge?.label).toBe('K.ĐẠT');
      expect(OverallResultEvaluator.calculateOverallStatus(resultsFailTc2, arsenicTCCS)).toBe(
        'FAIL'
      );

      // 5.3c. TC1 = 2.0 mg/kg, TC2 BỎ TRỐNG (chưa có kết quả) -> Giữ ở mức PENDING
      const resultsPendingTc2: TestResultEntry[] = [
        { criteriaName: 'Arsen (As) tổng số', value: '2.0', isPass: true },
        { criteriaName: 'Arsen vô cơ', value: '', isPass: null },
      ];
      const tc2StatusPending = AlternateRuleResolver.resolveCriterionState(
        'Arsen vô cơ',
        '',
        resultsPendingTc2,
        arsenicTCCS
      );
      expect(tc2StatusPending.isRequired).toBe(true);
      expect(tc2StatusPending.isPending).toBe(true);
      expect(tc2StatusPending.alternateState).toBe('TRIGGERED_PENDING');
      expect(tc2StatusPending.displayBadge?.label).toBe('CHỜ KẾT QUẢ');
      expect(OverallResultEvaluator.calculateOverallStatus(resultsPendingTc2, arsenicTCCS)).toBe(
        'PENDING'
      );
    });
  });
});
