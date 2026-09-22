/**
 * tests/integration/stateMachineSnapshot.test.ts
 * ================================================
 * Bộ kiểm thử tích hợp liên chuỗi (State Machine & Snapshot Engine Integration):
 * 1. BatchStateMachine (PENDING -> TESTING -> RELEASED)
 * 2. TestResultStateMachine (PENDING -> PASS)
 * 3. CriterionResultStateMachine & AlternateRuleStateMachine
 * 4. Niêm phong EvaluationSnapshot có chữ ký SHA-256 ALCOA+
 * 5. Thẩm tra 7 Release Gates xuyên suốt vòng đời lô sản xuất
 */

import { describe, it, expect } from 'vitest';
import { BatchStateMachine, TestResultStateMachine } from '../../src/domain/workflow/stateMachine';
import { CriterionResultStateMachine } from '../../src/domain/workflow/criterionStateMachine';
import { buildEvaluationSnapshot } from '../../src/domain/evaluation/EvaluationSnapshotBuilder';
import { ReleaseRules } from '../../src/domain/rules/ReleaseRules';
import { TCCS, Batch, TestResult, CriterionType } from '../../src/types';

describe('Integration Test: State Machine Pipeline & Snapshot Sealed Release', () => {
  const tccs: TCCS = {
    id: 'tccs-amox-500',
    code: 'TCCS-AMOX-500',
    productId: 'prod-amox',
    productName: 'Amoxicillin 500mg',
    version: 1,
    isActive: true,
    mainQualityCriteria: [
      {
        id: 'crit-c1',
        name: 'Định lượng',
        unit: '%',
        min: 90,
        max: 110,
        type: CriterionType.NUMBER,
      },
      {
        id: 'crit-c2',
        name: 'Độ ẩm',
        unit: '%',
        max: 5.0,
        type: CriterionType.NUMBER,
      },
    ],
  };

  it('Luồng hoàn chỉnh: Batch (PENDING) -> TestResult (PENDING -> PASS) -> Snapshot Niêm Phong -> Release Gates 7 Cổng PASS -> Batch RELEASED', () => {
    // 1. Khởi tạo Lô ở PENDING
    let batchStatus: any = 'PENDING';
    const canStart = BatchStateMachine.canTransition(batchStatus, 'TESTING');
    expect(canStart.allowed).toBe(true);

    // Chuyển sang TESTING
    const tr1 = BatchStateMachine.transition(batchStatus, 'TESTING', 'START_TESTING');
    expect(tr1.success).toBe(true);
    batchStatus = tr1.toState;
    expect(batchStatus).toBe('TESTING');

    // 2. Khởi tạo Phiếu kiểm nghiệm ở PENDING
    let trStatus: any = 'PENDING';
    const canPass = TestResultStateMachine.canTransition(trStatus, 'PASS', { actorRole: 'QA' });
    expect(canPass.allowed).toBe(true);

    // 3. Tiến hành kiểm nghiệm từng chỉ tiêu (CriterionResultStateMachine)
    expect(CriterionResultStateMachine.canTransition('PENDING', 'PASS').allowed).toBe(true);
    const c1State = CriterionResultStateMachine.transition('PENDING', 'PASS');
    expect(c1State).toBe('PASS');

    expect(CriterionResultStateMachine.canTransition('PENDING', 'PASS').allowed).toBe(true);
    const c2State = CriterionResultStateMachine.transition('PENDING', 'PASS');
    expect(c2State).toBe('PASS');

    // 4. Tạo kết quả kiểm nghiệm thực tế và Đóng băng EvaluationSnapshot
    const testResult: TestResult = {
      id: 'tr-001',
      batchId: 'batch-001',
      productId: 'prod-amox',
      tccsId: tccs.id,
      overallStatus: 'PASS',
      results: [
        {
          criterionId: 'crit-c1',
          criteriaName: 'Định lượng',
          value: '98.5',
          isPass: true,
          status: 'PASS',
        },
        {
          criterionId: 'crit-c2',
          criteriaName: 'Độ ẩm',
          value: '3.1',
          isPass: true,
          status: 'PASS',
        },
      ],
    } as any;

    const snapshot = buildEvaluationSnapshot(testResult, { email: 'qc_lead_01' }, { tccs });

    expect(snapshot.overallStatus).toBe('PASS');
    expect(snapshot.evaluationHash).toBeDefined();
    expect(snapshot.evaluationHash.length).toBe(64); // SHA-256 hex string

    // Gắn snapshot vào TestResult và cập nhật trạng thái
    testResult.evaluationSnapshot = snapshot;
    const trRes = TestResultStateMachine.transition(trStatus, 'PASS', 'APPROVE', {
      actorRole: 'QA',
    });
    expect(trRes.success).toBe(true);
    trStatus = trRes.toState;
    expect(trStatus).toBe('PASS');

    // 5. Kiểm tra 7 Release Gates
    const batch: Batch = {
      id: 'batch-001',
      batchNumber: 'AMOX-2026-001',
      productId: 'prod-amox',
      productName: 'Amoxicillin 500mg',
      tccsId: tccs.id,
      status: batchStatus,
      createdAt: new Date().toISOString(),
      manufacturingDate: '2026-01-01',
      expiryDate: '2028-01-01',
    } as any;

    const prereq = ReleaseRules.evaluateReleasePrerequisites({
      batch,
      testResults: [testResult],
      userRole: 'QA',
      boundTccs: tccs,
    });

    expect(prereq.isEligibleForRelease).toBe(true);
    expect(prereq.blockers).toHaveLength(0);

    // Kiểm tra chi tiết 7 gates
    const gatesRes = ReleaseRules.evaluate7ReleaseGates({
      batch,
      testResults: [testResult],
      userRole: 'QA',
      boundTccs: tccs,
    });

    expect(gatesRes.allGatesPassed).toBe(true);
    expect(gatesRes.gates).toHaveLength(7);
    expect(gatesRes.gates[0].passed).toBe(true); // Gate 1: 100% Criteria
    expect(gatesRes.gates[1].passed).toBe(true); // Gate 2: Canonical PASS
    expect(gatesRes.gates[2].passed).toBe(true); // Gate 3: Không OOS
    expect(gatesRes.gates[3].passed).toBe(true); // Gate 4: Không sai lệch CRITICAL
    expect(gatesRes.gates[4].passed).toBe(true); // Gate 5: CAPA
    expect(gatesRes.gates[5].passed).toBe(true); // Gate 6: BPR
    expect(gatesRes.gates[6].passed).toBe(true); // Gate 7: Pháp lý & Thẩm quyền

    // 6. Cho phép chuyển Batch sang RELEASED
    const canReleaseBatch = BatchStateMachine.canTransition(batchStatus, 'RELEASED', {
      actorRole: 'QA',
      conditionsMet: prereq.isEligibleForRelease,
    });
    expect(canReleaseBatch.allowed).toBe(true);

    const releaseTr = BatchStateMachine.transition(batchStatus, 'RELEASED', 'RELEASE', {
      actorRole: 'QA',
      conditionsMet: prereq.isEligibleForRelease,
    });
    expect(releaseTr.success).toBe(true);
    expect(releaseTr.toState).toBe('RELEASED');
  });

  it('Bị chặn bởi Release Gates nếu Lô có sự cố OOS chưa đóng hoặc vai trò người duyệt không hợp lệ', () => {
    const batchWithOOS: Batch = {
      id: 'batch-002',
      batchNumber: 'AMOX-2026-002',
      productId: 'prod-amox',
      productName: 'Amoxicillin 500mg',
      tccsId: tccs.id,
      status: 'TESTING',
      hasActiveOOS: true, // Có sự cố OOS mở
      createdAt: new Date().toISOString(),
      manufacturingDate: '2026-01-01',
      expiryDate: '2028-01-01',
    } as any;

    const testResult: TestResult = {
      id: 'tr-002',
      batchId: 'batch-002',
      productId: 'prod-amox',
      tccsId: tccs.id,
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Định lượng', value: '98.5', isPass: true, status: 'PASS' },
        { criteriaName: 'Độ ẩm', value: '3.1', isPass: true, status: 'PASS' },
      ],
    } as any;

    // 1. Kiểm tra 7 Release Gates chặn vì Gate 3 (OOS mở)
    const gatesRes = ReleaseRules.evaluate7ReleaseGates({
      batch: batchWithOOS,
      testResults: [testResult],
      userRole: 'QA',
      boundTccs: tccs,
    });
    expect(gatesRes.allGatesPassed).toBe(false);
    expect(gatesRes.gates[2].passed).toBe(false); // Gate 3 failed
    expect(gatesRes.gates[2].details).toBe('Có OOS mở');

    // 2. Chặn xuất xưởng nếu vai trò là LAB (không có thẩm quyền QA/ADMIN)
    const prereqLab = ReleaseRules.evaluateReleasePrerequisites({
      batch: { ...batchWithOOS, hasActiveOOS: false },
      testResults: [testResult],
      userRole: 'LAB',
      boundTccs: tccs,
    });
    expect(prereqLab.isEligibleForRelease).toBe(false);
    expect(prereqLab.blockers.some((b) => b.includes('thẩm quyền'))).toBe(true);
  });
});
