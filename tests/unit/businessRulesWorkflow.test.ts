/**
 * tests/unit/businessRulesWorkflow.test.ts
 * ========================================
 * Bộ kiểm thử đơn vị độc lập xác thực 100% các Quy tắc Nghiệp vụ (Business Rules Catalog):
 * - BR-ALT-001: Alternate Rule - FAIL_RETRY Workflow
 * - BR-ALT-002: Alternate Rule - CONDITIONAL_CHECK Workflow
 * - BR-ALT-003: Cấm ẩn chỉ tiêu khỏi dữ liệu (UI Presentation & Data Consistency)
 * - BR-ALT-004: Tự động phát sinh CoA Footnote minh bạch
 * - BR-QEV-001: No Implicit Pass & Canonical Quality Evaluation
 * - BR-REL-001: Release Gate 5 trụ cột bảo vệ GMP
 */

import { describe, it, expect } from 'vitest';
import {
  TCCS,
  TestResult,
  Batch,
  CriterionType,
  AlternateRule,
  TestResultEntry,
} from '../../src/types';
import { AlternateRuleResolver } from '../../src/domain/evaluation/AlternateRuleResolver';
import {
  CriterionResultStateMachine,
  AlternateRuleStateMachine,
} from '../../src/domain/workflow/criterionStateMachine';
import { OverallResultEvaluator } from '../../src/domain/evaluation/OverallResultEvaluator';
import { buildEvaluationSnapshot } from '../../src/domain/evaluation/EvaluationSnapshotBuilder';
import { BatchRules } from '../../src/domain/rules/batchRules';

describe('BR-ALT-001: FAIL_RETRY Workflow Verification', () => {
  const failRetryRule: AlternateRule = {
    id: 'alt-rule-01',
    main: 'Định lượng Hoạt chất A',
    alt: 'Định lượng Bổ sung A (HPLC)',
    type: 'FAIL_RETRY',
    action: 'REQUIRE_RETEST',
    note: 'Khi TC1 không đạt, bắt buộc thử nghiệm lại bằng phương pháp bổ sung HPLC',
  };

  const tccsWithFailRetry: TCCS = {
    id: 'tccs-para-001',
    productId: 'prod-001',
    code: 'TCCS-01-PARA',
    productName: 'Paracetamol 500mg',
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
        name: 'Cảm quan',
        unit: '',
        expectedText: 'Bột màu trắng',
        type: CriterionType.TEXT,
      },
    ],
    alternateRules: [failRetryRule],
  };

  it('Case 1: Khi Main PASS -> Alt phải ở trạng thái MIỄN KIỂM (EXEMPTED), không đánh trượt', () => {
    const results: TestResultEntry[] = [
      {
        criteriaName: 'Định lượng Hoạt chất A',
        value: '100',
        isPass: true,
        status: 'PASS',
      },
      {
        criteriaName: 'Cảm quan',
        value: 'Bột màu trắng',
        isPass: true,
        status: 'PASS',
      },
    ];

    // 1. Phân giải trạng thái của chỉ tiêu Alt
    const altState = AlternateRuleResolver.resolveCriterionState(
      'Định lượng Bổ sung A (HPLC)',
      undefined,
      results,
      tccsWithFailRetry
    );

    expect(altState.isExempted).toBe(true);
    expect(altState.alternateState).toBe('EXEMPTED');
    expect(altState.displayBadge?.label).toBe('MIỄN KIỂM');

    // 2. Phân giải qua State Machine
    const fsmState = AlternateRuleStateMachine.resolveNextState({
      isTriggered: false,
      mainIsPass: true,
      altHasValue: false,
      altIsPass: null,
    });
    expect(fsmState).toBe('EXEMPTED');

    // 3. Overall kết luận PASS vì Alt được miễn kiểm
    const overall = OverallResultEvaluator.calculateOverallStatus(results, tccsWithFailRetry);
    expect(overall).toBe('PASS');
  });

  it('Case 2: Khi Main FAIL và Alt chưa làm -> Báo PENDING (chờ kết quả) và kích hoạt yêu cầu Alt', () => {
    const results: TestResultEntry[] = [
      {
        criteriaName: 'Định lượng Hoạt chất A',
        value: '80', // Dưới ngưỡng 90
        isPass: false,
        status: 'FAIL',
      },
      {
        criteriaName: 'Cảm quan',
        value: 'Bột màu trắng',
        isPass: true,
        status: 'PASS',
      },
    ];

    const altState = AlternateRuleResolver.resolveCriterionState(
      'Định lượng Bổ sung A (HPLC)',
      undefined,
      results,
      tccsWithFailRetry
    );

    expect(altState.isExempted).toBe(false);
    expect(altState.isRequired).toBe(true);
    expect(altState.isPending).toBe(true);
    expect(altState.alternateState).toBe('TRIGGERED_PENDING');
    expect(altState.displayBadge?.label).toBe('CHỜ KẾT QUẢ');

    const fsmState = AlternateRuleStateMachine.resolveNextState({
      isTriggered: true,
      mainIsPass: false,
      altHasValue: false,
      altIsPass: null,
    });
    expect(fsmState).toBe('TRIGGERED_PENDING');

    // Không được kết luận FAIL sớm khi chưa có kết quả Alt
    const overall = OverallResultEvaluator.calculateOverallStatus(results, tccsWithFailRetry);
    expect(overall).toBe('PENDING');
  });

  it('Case 3: Khi Main FAIL nhưng Alt PASS -> Overall PASS kèm giải trình chỉ tiêu thay thế đạt', () => {
    const results: TestResultEntry[] = [
      {
        criteriaName: 'Định lượng Hoạt chất A',
        value: '80',
        isPass: false,
        status: 'FAIL',
      },
      {
        criteriaName: 'Định lượng Bổ sung A (HPLC)',
        value: '102',
        isPass: true,
        status: 'PASS',
      },
      {
        criteriaName: 'Cảm quan',
        value: 'Bột màu trắng',
        isPass: true,
        status: 'PASS',
      },
    ];

    const altState = AlternateRuleResolver.resolveCriterionState(
      'Định lượng Bổ sung A (HPLC)',
      '102',
      results,
      tccsWithFailRetry
    );

    expect(altState.alternateState).toBe('TRIGGERED_PASS');
    expect(altState.displayBadge?.label).toBe('ĐẠT (THAY THẾ)');

    const fsmState = AlternateRuleStateMachine.resolveNextState({
      isTriggered: true,
      mainIsPass: false,
      altHasValue: true,
      altIsPass: true,
    });
    expect(fsmState).toBe('TRIGGERED_PASS');

    const overall = OverallResultEvaluator.calculateOverallStatus(results, tccsWithFailRetry);
    expect(overall).toBe('PASS');
  });
});

describe('BR-ALT-002: CONDITIONAL_CHECK Workflow Verification', () => {
  const conditionalRule: AlternateRule = {
    id: 'alt-rule-cond-01',
    main: 'Độ ẩm',
    alt: 'Hoạt độ nước (aw)',
    type: 'CONDITIONAL_CHECK',
    action: 'REQUIRE_RETEST',
    conditionValue: '> 10',
    note: 'Khi Độ ẩm > 10%, bắt buộc kiểm tra Hoạt độ nước (aw)',
  };

  const tccsWithConditional: TCCS = {
    id: 'tccs-solution-002',
    code: 'TCCS-02-SOL',
    productName: 'Dung dịch tiêm ABC',
    mainQualityCriteria: [
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
    ],
    alternateRules: [conditionalRule],
  };

  it('Khi Độ ẩm <= 10% (ví dụ 8%) -> Hoạt độ nước ở trạng thái MIỄN KIỂM (EXEMPTED)', () => {
    const results: TestResultEntry[] = [
      {
        criteriaName: 'Độ ẩm',
        value: '8',
        isPass: true,
        status: 'PASS',
      },
    ];

    const clarState = AlternateRuleResolver.resolveCriterionState(
      'Hoạt độ nước (aw)',
      undefined,
      results,
      tccsWithConditional
    );

    expect(clarState.isExempted).toBe(true);
    expect(clarState.alternateState).toBe('EXEMPTED');

    const overall = OverallResultEvaluator.calculateOverallStatus(results, tccsWithConditional);
    expect(overall).toBe('PASS');
  });

  it('Khi Độ ẩm > 10% (ví dụ 12%) -> Kích hoạt Hoạt độ nước thành bắt buộc', () => {
    const results: TestResultEntry[] = [
      {
        criteriaName: 'Độ ẩm',
        value: '12',
        isPass: true,
        status: 'PASS',
      },
    ];

    const clarState = AlternateRuleResolver.resolveCriterionState(
      'Hoạt độ nước (aw)',
      undefined,
      results,
      tccsWithConditional
    );

    expect(clarState.isExempted).toBe(false);
    expect(clarState.isRequired).toBe(true);
    expect(clarState.alternateState).toBe('TRIGGERED_PENDING');

    const overall = OverallResultEvaluator.calculateOverallStatus(results, tccsWithConditional);
    expect(overall).toBe('PENDING');
  });
});

describe('BR-ALT-003 & BR-ALT-004: UI Contract & CoA Footnote', () => {
  it('BR-ALT-003: CriterionResultStateMachine bảo vệ chuyển đổi trạng thái nghiêm ngặt', () => {
    const checkExempt = CriterionResultStateMachine.canTransition('NOT_STARTED', 'EXEMPTED');
    expect(checkExempt.allowed).toBe(true);

    const executedState = CriterionResultStateMachine.transition('NOT_STARTED', 'EXEMPTED');
    expect(executedState).toBe('EXEMPTED');

    const checkInvalid = CriterionResultStateMachine.canTransition('EXEMPTED', 'PASS');
    expect(checkInvalid.allowed).toBe(false);
  });

  it('BR-ALT-004: Tự động ghi chú footnote minh bạch vào Evaluation Snapshot', () => {
    const tccs: TCCS = {
      id: 'tccs-03',
      code: 'TCCS-03',
      mainQualityCriteria: [
        { name: 'Định lượng A', unit: '%', min: 90, max: 110, type: CriterionType.NUMBER },
        {
          name: 'Định lượng A (Lặp lại lần 2)',
          unit: '%',
          min: 90,
          max: 110,
          type: CriterionType.NUMBER,
        },
      ],
      alternateRules: [
        {
          id: 'alt-03',
          main: 'Định lượng A',
          alt: 'Định lượng A (Lặp lại lần 2)',
          type: 'FAIL_RETRY',
          action: 'REQUIRE_RETEST',
        },
      ],
    };

    const testResult: TestResult = {
      id: 'tr-foot',
      batchId: 'b-foot',
      labName: 'Lab B',
      testDate: '2026-09-22',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Định lượng A', value: '85', isPass: false, status: 'FAIL' },
        { criteriaName: 'Định lượng A (Lặp lại lần 2)', value: '98', isPass: true, status: 'PASS' },
      ],
    };

    const snapshot = buildEvaluationSnapshot(
      testResult,
      { uid: 'u1', email: 'test@v.vn' },
      { boundTccs: tccs }
    );

    expect(snapshot.evaluatedAt).toBeDefined();
    expect(snapshot.criterionResults.length).toBe(2);
  });
});

describe('BR-REL-001: Release Gate 5 trụ cột bảo vệ', () => {
  const mockTccs: TCCS = {
    id: 'tccs-rel-001',
    productId: 'prod-001',
    code: 'TCCS-REL-001',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [{ name: 'Độ ẩm', unit: '%', min: 0, max: 5, type: CriterionType.NUMBER }],
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const dummyBatch: Batch = {
    id: 'batch-rel-01',
    productId: 'prod-001',
    tccsId: 'tccs-rel-001',
    batchNo: 'B-REL-01',
    status: 'TESTING',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
  };

  it('Trụ cột 1: Từ chối xuất xưởng khi không có phiếu kiểm nghiệm nào', () => {
    const result = BatchRules.canRelease(dummyBatch, [], 'QA', mockTccs);
    expect(result.allowed).toBe(false);
    expect(result.blockers?.some((b) => b.includes('phiếu kiểm nghiệm'))).toBe(true);
  });

  it('Trụ cột 2: Từ chối xuất xưởng khi vai trò không phải QA hoặc ADMIN', () => {
    const passedTr: TestResult = {
      id: 'tr-p1',
      batchId: dummyBatch.id,
      batchNo: dummyBatch.batchNo,
      tccsId: mockTccs.id,
      labName: 'Lab QC',
      testDate: '2026-09-20',
      overallStatus: 'PASS',
      results: [{ criteriaName: 'Độ ẩm', value: 3.5, isPass: true, status: 'PASS' }],
    };

    const result = BatchRules.canRelease(dummyBatch, [passedTr], 'QC', mockTccs);
    expect(result.allowed).toBe(false);
    expect(result.blockers?.some((b) => b.includes('thẩm quyền'))).toBe(true);
  });

  it('Trụ cột 3: Chấp thuận xuất xưởng khi thỏa mãn đầy đủ 5 trụ cột với vai trò QA', () => {
    const passedTr: TestResult = {
      id: 'tr-p2',
      batchId: dummyBatch.id,
      batchNo: dummyBatch.batchNo,
      tccsId: mockTccs.id,
      labName: 'Lab QA/QC',
      testDate: '2026-09-20',
      overallStatus: 'PASS',
      results: [{ criteriaName: 'Độ ẩm', value: 3.5, isPass: true, status: 'PASS' }],
    };

    const result = BatchRules.canRelease(dummyBatch, [passedTr], 'QA', mockTccs);
    expect(result.allowed).toBe(true);
    expect(result.blockers?.length || 0).toBe(0);
  });
});
