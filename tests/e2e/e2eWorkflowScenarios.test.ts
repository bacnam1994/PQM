/**
 * tests/e2e/e2eWorkflowScenarios.test.ts
 * =====================================
 * Bộ kiểm thử E2E Workflow Scenarios (Mô phỏng 6 kịch bản nghiệp vụ theo SPEC-E2E-SCENARIOS-01):
 * - SCENARIO S-001: Happy Path - Lô đạt chuẩn, ký duyệt xuất xưởng & khóa dữ liệu
 * - SCENARIO S-002: Alternate Rule FAIL_RETRY cứu phiếu thành công -> PASS
 * - SCENARIO S-003: Chỉ tiêu phụ chưa làm -> PENDING -> Chặn xuất xưởng
 * - SCENARIO S-004: Chỉ tiêu phụ rớt -> FAIL -> Lô bị từ chối (REJECTED)
 * - SCENARIO S-005: Thu hồi / Phong tỏa khẩn cấp (Emergency Block)
 * - SCENARIO S-006: CoA Single Source of Truth (Đọc trực tiếp từ Frozen Snapshot)
 */

import { describe, it, expect } from 'vitest';
import { TCCS, TestResult, Batch, CriterionType, AlternateRule } from '../../src/types';
import { OverallResultEvaluator } from '../../src/domain/evaluation/OverallResultEvaluator';
import { AlternateRuleResolver } from '../../src/domain/evaluation/AlternateRuleResolver';
import {
  buildEvaluationSnapshot,
  validateEvaluationSnapshot,
} from '../../src/domain/evaluation/EvaluationSnapshotBuilder';
import { BatchRules } from '../../src/domain/rules/batchRules';
import { BatchStateMachine } from '../../src/domain/workflow/stateMachine';

describe('End-to-End Business Scenarios (S-001 -> S-006)', () => {
  const tccsWithAlternateRule: TCCS = {
    id: 'tccs-paracetamol-500',
    productId: 'prod-para-500',
    code: 'TCCS-PARA-500',
    productName: 'Paracetamol Viên Nén 500mg',
    version: 1,
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      {
        id: 'crit-tan-ra-1',
        name: 'Độ tan rã lần 1',
        unit: 'phút',
        max: 15,
        type: CriterionType.NUMBER,
      },
      {
        id: 'crit-tan-ra-2',
        name: 'Độ tan rã lần 2 (thử thêm 12 viên)',
        unit: 'phút',
        max: 15,
        type: CriterionType.NUMBER,
      },
      {
        id: 'crit-dinh-luong',
        name: 'Định lượng Paracetamol',
        unit: '%',
        min: 95.0,
        max: 105.0,
        type: CriterionType.NUMBER,
      },
    ],
    alternateRules: [
      {
        id: 'alt-rule-tan-ra',
        main: 'Độ tan rã lần 1',
        mainCriterionId: 'crit-tan-ra-1',
        alt: 'Độ tan rã lần 2 (thử thêm 12 viên)',
        altCriterionId: 'crit-tan-ra-2',
        type: 'FAIL_RETRY',
        action: 'REQUIRE_RETEST',
        note: 'Khi độ rã lần 1 không đạt, bắt buộc thử lại lần 2 với 12 viên',
      },
    ],
  };

  it('SCENARIO S-001: Luồng chuẩn Lô đạt yêu cầu (Happy Pass Flow)', () => {
    // 1. Tạo Lô sản xuất với TCCS Snapshot
    const batchS001: Batch = {
      id: 'batch-240901',
      batchNo: '240901',
      productId: 'prod-para-500',
      tccsId: tccsWithAlternateRule.id,
      tccsSnapshot: tccsWithAlternateRule,
      status: 'TESTING',
      mfgDate: '2026-09-01',
      expDate: '2028-09-01',
    };

    // 2. Nhập kết quả kiểm nghiệm: 100% đạt yêu cầu (Main đạt -> Alt miễn kiểm)
    const testResultS001: TestResult = {
      id: 'tr-240901',
      batchId: batchS001.id,
      batchNo: batchS001.batchNo,
      tccsId: tccsWithAlternateRule.id,
      labName: 'Phòng Kiểm Nghiệm Trung Tâm',
      testDate: '2026-09-05',
      overallStatus: 'PASS',
      results: [
        {
          criterionId: 'crit-tan-ra-1',
          criteriaName: 'Độ tan rã lần 1',
          value: '10', // Đạt (max 15)
          isPass: true,
          status: 'PASS',
        },
        {
          criterionId: 'crit-dinh-luong',
          criteriaName: 'Định lượng Paracetamol',
          value: '100.5', // Đạt (95 - 105)
          isPass: true,
          status: 'PASS',
        },
      ],
    };

    // 3. Động cơ đánh giá Overall Result
    const overall = OverallResultEvaluator.calculateOverallStatus(
      testResultS001.results!,
      tccsWithAlternateRule
    );
    expect(overall).toBe('PASS');

    // 4. Sinh Frozen Snapshot
    const snapshot = buildEvaluationSnapshot(
      testResultS001,
      { uid: 'qa-01', email: 'qa@v-biotech.vn', role: 'QA' },
      { boundTccs: tccsWithAlternateRule }
    );
    expect(snapshot.overallStatus).toBe('PASS');
    expect(snapshot.evaluationHash.length).toBe(64);

    // 5. Thẩm định điều kiện xuất xưởng Release Gate
    const releaseDecision = BatchRules.canRelease(
      batchS001,
      [{ ...testResultS001, evaluationSnapshot: snapshot }],
      'QA',
      tccsWithAlternateRule
    );
    expect(releaseDecision.allowed).toBe(true);

    // 6. Chuyển trạng thái Lô sang RELEASED
    const transition = BatchStateMachine.canTransition(batchS001.status, 'RELEASED', {
      actorRole: 'QA',
      conditionsMet: true,
    });
    expect(transition.allowed).toBe(true);
  });

  it('SCENARIO S-002: Chỉ tiêu chính FAIL -> Kích hoạt chỉ tiêu thay thế đạt -> Overall PASS', () => {
    // 1. Chỉ tiêu chính rớt (18 phút > 15 phút), chỉ tiêu phụ cứu (12 phút <= 15 phút)
    const results = [
      {
        criterionId: 'crit-tan-ra-1',
        criteriaName: 'Độ tan rã lần 1',
        value: '18',
        isPass: false,
        status: 'FAIL' as const,
      },
      {
        criterionId: 'crit-tan-ra-2',
        criteriaName: 'Độ tan rã lần 2 (thử thêm 12 viên)',
        value: '12',
        isPass: true,
        status: 'PASS' as const,
      },
      {
        criterionId: 'crit-dinh-luong',
        criteriaName: 'Định lượng Paracetamol',
        value: '100.0',
        isPass: true,
        status: 'PASS' as const,
      },
    ];

    // Trạng thái của chỉ tiêu thay thế
    const altState = AlternateRuleResolver.resolveCriterionState(
      'Độ tan rã lần 2 (thử thêm 12 viên)',
      '12',
      results,
      tccsWithAlternateRule
    );
    expect(altState.alternateState).toBe('TRIGGERED_PASS');

    // Động cơ đánh giá cứu phiếu thành công
    const overall = OverallResultEvaluator.calculateOverallStatus(results, tccsWithAlternateRule);
    expect(overall).toBe('PASS');
  });

  it('SCENARIO S-003: Chỉ tiêu phụ chưa có kết quả -> PENDING -> Chặn xuất xưởng', () => {
    const batchS003: Batch = {
      id: 'batch-s003',
      batchNo: 'B-S003',
      productId: 'prod-para-500',
      tccsId: tccsWithAlternateRule.id,
      status: 'TESTING',
      mfgDate: '2026-09-01',
      expDate: '2028-09-01',
    };

    // Chỉ tiêu chính rớt nhưng chỉ tiêu phụ chưa có kết quả (PENDING)
    const pendingResults = [
      {
        criterionId: 'crit-tan-ra-1',
        criteriaName: 'Độ tan rã lần 1',
        value: '18',
        isPass: false,
        status: 'FAIL' as const,
      },
      {
        criterionId: 'crit-dinh-luong',
        criteriaName: 'Định lượng Paracetamol',
        value: '100.0',
        isPass: true,
        status: 'PASS' as const,
      },
    ];

    const overall = OverallResultEvaluator.calculateOverallStatus(
      pendingResults,
      tccsWithAlternateRule
    );
    expect(overall).toBe('PENDING');

    const pendingTr: TestResult = {
      id: 'tr-s003',
      batchId: batchS003.id,
      batchNo: batchS003.batchNo,
      tccsId: tccsWithAlternateRule.id,
      labName: 'Lab QC',
      testDate: '2026-09-22',
      overallStatus: 'PENDING',
      results: pendingResults,
    };

    // Release Gate phải chặn đứng xuất xưởng
    const releaseDecision = BatchRules.canRelease(
      batchS003,
      [pendingTr],
      'QA',
      tccsWithAlternateRule
    );
    expect(releaseDecision.allowed).toBe(false);
    expect(releaseDecision.blockers?.some((b) => b.includes('chưa đạt chuẩn PASS'))).toBe(true);
  });

  it('SCENARIO S-004: Xử lý kết quả OOS không thể cứu -> FAIL -> Lô bị REJECTED', () => {
    // Cả lần 1 và lần 2 đều rớt
    const failResults = [
      {
        criterionId: 'crit-tan-ra-1',
        criteriaName: 'Độ tan rã lần 1',
        value: '18',
        isPass: false,
        status: 'FAIL' as const,
      },
      {
        criterionId: 'crit-tan-ra-2',
        criteriaName: 'Độ tan rã lần 2 (thử thêm 12 viên)',
        value: '19', // Vẫn rớt
        isPass: false,
        status: 'FAIL' as const,
      },
    ];

    const overall = OverallResultEvaluator.calculateOverallStatus(
      failResults,
      tccsWithAlternateRule
    );
    expect(overall).toBe('FAIL');

    // Chuyển trạng thái Lô sang REJECTED
    const rejectCheck = BatchStateMachine.canTransition('TESTING', 'REJECTED', {
      actorRole: 'QA',
      reason: 'OOS độ tan rã không đạt cả 2 lần thử nghiệm',
    });
    expect(rejectCheck.allowed).toBe(true);
  });

  it('SCENARIO S-005: Phong tỏa khẩn cấp Lô đã xuất xưởng (Emergency Block)', () => {
    // Lô đang RELEASED
    const currentStatus = 'RELEASED';

    // QA phong tỏa khẩn cấp sang BLOCKED kèm lý do bắt buộc
    const blockCheck = BatchStateMachine.canTransition(currentStatus, 'BLOCKED', {
      actorRole: 'QA',
      reason: 'Nghi ngờ nhiễm vi sinh theo cảnh báo từ thị trường',
    });
    expect(blockCheck.allowed).toBe(true);

    // Không được phong tỏa nếu thiếu lý do giải trình
    const blockWithoutReason = BatchStateMachine.canTransition(currentStatus, 'BLOCKED', {
      actorRole: 'QA',
      reason: '',
    });
    expect(blockWithoutReason.allowed).toBe(false);
  });

  it('SCENARIO S-006: CoA Single Source of Truth (Đọc trực tiếp từ Frozen Snapshot)', () => {
    const testResult: TestResult = {
      id: 'tr-s006',
      batchId: 'b-s006',
      batchNo: 'B-006',
      tccsId: tccsWithAlternateRule.id,
      labName: 'Lab QC',
      testDate: '2026-09-22',
      overallStatus: 'PASS',
      results: [
        {
          criterionId: 'crit-dinh-luong',
          criteriaName: 'Định lượng Paracetamol',
          value: '99.2',
          isPass: true,
          status: 'PASS',
        },
      ],
    };

    // Sinh snapshot
    const snapshot = buildEvaluationSnapshot(
      testResult,
      { uid: 'qa-user' },
      { boundTccs: tccsWithAlternateRule }
    );

    // CoA phải đọc trực tiếp từ snapshot, dữ liệu snapshot đã được khóa bằng SHA-256
    const validation = validateEvaluationSnapshot(snapshot, testResult, tccsWithAlternateRule);
    expect(validation.isValid).toBe(true);
    expect(snapshot.criterionResults[0].value).toBe('99.2');
    expect(snapshot.criterionResults[0].isPass).toBe(true);
  });
});
