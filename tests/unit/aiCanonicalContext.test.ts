import { describe, it, expect } from 'vitest';
import { resolveLeanContext } from '../../src/services/ai/contextResolver';
import { resolveFinalTestResultForBatch } from '../../src/domain/test-result/testResultStatusResolver';

describe('Phase 4 — Canonical AI Context & Domain Authority Tests', () => {
  const baseProduct = {
    id: 'prod_1',
    code: 'SP-PARA',
    name: 'Paracetamol 500mg',
    status: 'ACTIVE',
  };

  const baseBatch = {
    id: 'b_362605',
    batchNo: '362605',
    productId: 'prod_1',
    status: 'RELEASED',
  };

  const baseTccs = {
    id: 'tccs_1',
    code: 'TCCS-01/2026',
    productId: 'prod_1',
    isActive: true,
    mainQualityCriteria: [
      { name: 'Định lượng', min: 95, max: 105 },
      { name: 'Độ rã', max: 15 },
    ],
  };

  it('P4-AC1: Khi có nhiều TestResult (DRAFT + FINAL/APPROVED) -> AI Context chọn đúng kết quả chính thức đã duyệt thay vì draft mới hơn', () => {
    const testResults = [
      // Phiếu cũ hơn nhưng đã APPROVED
      {
        id: 'tr_approved',
        batchId: 'b_362605',
        reportNo: 'KN-2026-FINAL',
        testDate: '2026-05-01',
        createdAt: '2026-05-01T08:00:00Z',
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
        testResults: [
          { criteriaName: 'Định lượng', value: 100, status: 'PASS' },
          { criteriaName: 'Độ rã', value: 10, status: 'PASS' },
        ],
      },
      // Phiếu mới hơn về timestamp nhưng chỉ là DRAFT chưa hoàn tất
      {
        id: 'tr_draft_latest',
        batchId: 'b_362605',
        reportNo: 'KN-2026-DRAFT',
        testDate: '2026-05-20',
        createdAt: '2026-05-20T10:00:00Z',
        workflowStatus: 'DRAFT',
        overallStatus: 'PENDING',
        testResults: [{ criteriaName: 'Định lượng', value: 98, status: 'PENDING' }],
      },
    ];

    const storeData = {
      products: [baseProduct],
      batches: [baseBatch],
      tccsList: [baseTccs],
      testResults,
      qualityAlerts: [],
    };

    const context = resolveLeanContext(
      'Cho tôi biết kết quả kiểm nghiệm của lô 362605?',
      storeData
    );

    // AI Context bắt buộc phải chọn phiếu chính thức theo Canonical Domain Resolver
    const canonicalResolution = resolveFinalTestResultForBatch(
      baseBatch as any,
      testResults as any,
      baseTccs as any
    );

    expect(context.testResult?.id).toBe(canonicalResolution.finalTestResult?.id);
    expect(context.testResult?.reportNo).toBe('KN-2026-FINAL');
    expect(context.testResult?.canonicalStatus).toBe('PASS');
  });

  it('P4-AC2: Superseded / Retest Result — Chọn phiếu kiểm nghiệm tái kiểm thẩm quyền cuối cùng', () => {
    const testResults = [
      // Phiếu kiểm nghiệm lần 1 bị Không đạt
      {
        id: 'tr_original_fail',
        batchId: 'b_362605',
        reportNo: 'KN-2026-001',
        testDate: '2026-05-01',
        workflowStatus: 'SUPERSEDED',
        overallStatus: 'FAIL',
        testResults: [{ criteriaName: 'Định lượng', value: 90, status: 'FAIL' }],
      },
      // Phiếu tái kiểm (Retest/Revision) đạt chuẩn
      {
        id: 'tr_retest_pass',
        batchId: 'b_362605',
        reportNo: 'KN-2026-001-REV1',
        testDate: '2026-05-05',
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
        testResults: [{ criteriaName: 'Định lượng', value: 99.5, status: 'PASS' }],
      },
    ];

    const storeData = {
      products: [baseProduct],
      batches: [baseBatch],
      tccsList: [baseTccs],
      testResults,
      qualityAlerts: [],
    };

    const context = resolveLeanContext('Đánh giá chất lượng lô 362605', storeData);

    expect(context.testResult?.reportNo).toBe('KN-2026-001-REV1');
    expect(context.testResult?.canonicalStatus).toBe('PASS');
  });

  it('P4-AC3: Nhiều phòng lab (Nội bộ & Ngoại kiểm) — AI Context phản ánh đúng canonical resolution', () => {
    const testResults = [
      {
        id: 'tr_internal',
        batchId: 'b_362605',
        labName: 'Lab Nội bộ V-Biotech',
        reportNo: 'KN-INTERNAL-01',
        testDate: '2026-05-02',
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
        testResults: [{ criteriaName: 'Độ rã', value: 8, status: 'PASS' }],
      },
      {
        id: 'tr_external',
        batchId: 'b_362605',
        labName: 'Viện Kiểm nghiệm Trung Ương',
        reportNo: 'KN-VKN-01',
        testDate: '2026-05-08',
        workflowStatus: 'APPROVED',
        overallStatus: 'PASS',
        testResults: [{ criteriaName: 'Định lượng', value: 101.2, status: 'PASS' }],
      },
    ];

    const storeData = {
      products: [baseProduct],
      batches: [baseBatch],
      tccsList: [baseTccs],
      testResults,
      qualityAlerts: [],
    };

    const context = resolveLeanContext('Lô 362605 có đạt chuẩn không?', storeData);
    const canonical = resolveFinalTestResultForBatch(
      baseBatch as any,
      testResults as any,
      baseTccs as any
    );

    expect(context.testResult?.id).toBe(canonical.finalTestResult?.id);
    expect(context.testResult?.canonicalStatus).toBe(canonical.status);
  });
});
