import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchInspectionProgressService } from '../../src/domain/batch/BatchInspectionProgressService';
import { Batch, TestResult, TCCS } from '../../src/types';
import { useAppStore } from '../../src/store/useAppStore';
import { batchAppService } from '../../src/services/app/BatchAppService';

describe('STATE-04 — Batch List Inspection Filtering & Decoupled Status Display Tests', () => {
  const mockTccs: TCCS = {
    id: 'tccs-demo-1',
    code: 'TCCS-01',
    productId: 'prod-01',
    mainQualityCriteria: [
      { name: 'Độ ẩm', min: 0, max: 10, type: 'NUMBER' },
      { name: 'Định lượng hoạt chất', min: 90, max: 110, type: 'NUMBER' },
    ],
    safetyCriteria: [{ name: 'Vi sinh vật tổng số', min: 0, max: 1000, type: 'NUMBER' }],
    status: 'ACTIVE',
    effectiveDate: '2026-01-01',
  };

  const batchNotTested: Batch = {
    id: 'batch-not-tested',
    batchNo: 'LOT-NT-001',
    productId: 'prod-01',
    tccsId: 'tccs-demo-1',
    status: 'TESTING',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    version: 1,
  };

  const batchInProgress: Batch = {
    id: 'batch-in-progress',
    batchNo: 'LOT-IP-002',
    productId: 'prod-01',
    tccsId: 'tccs-demo-1',
    status: 'TESTING',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    version: 1,
  };

  const batchPendingReview: Batch = {
    id: 'batch-pending-review',
    batchNo: 'LOT-PR-003',
    productId: 'prod-01',
    tccsId: 'tccs-demo-1',
    status: 'TESTING',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    version: 1,
  };

  const batchPassEvaluated: Batch = {
    id: 'batch-pass-evaluated',
    batchNo: 'LOT-PASS-004',
    productId: 'prod-01',
    tccsId: 'tccs-demo-1',
    status: 'TESTING',
    inspectionStatus: 'PASS',
    inspectionEvaluation: {
      status: 'PASS',
      evaluatedBy: 'usr-qa-01',
      evaluatorName: 'QA Manager',
      evaluatorRole: 'QA',
      evaluatedAt: '2026-02-01T10:00:00Z',
    },
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    version: 1,
  };

  const batchFailEvaluated: Batch = {
    id: 'batch-fail-evaluated',
    batchNo: 'LOT-FAIL-005',
    productId: 'prod-01',
    tccsId: 'tccs-demo-1',
    status: 'TESTING',
    inspectionStatus: 'FAIL',
    inspectionEvaluation: {
      status: 'FAIL',
      evaluatedBy: 'usr-qc-01',
      evaluatorName: 'QC Analyst',
      evaluatorRole: 'QC',
      evaluatedAt: '2026-02-01T11:00:00Z',
      reason: 'OOS chỉ tiêu Định lượng hoạt chất',
    },
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    version: 1,
  };

  const batchReleasedHistorical: Batch = {
    id: 'batch-released-hist',
    batchNo: 'LOT-REL-006',
    productId: 'prod-01',
    tccsId: 'tccs-demo-1',
    status: 'RELEASED',
    mfgDate: '2025-01-01',
    expDate: '2027-01-01',
    version: 1,
  };

  const batchRejectedHistorical: Batch = {
    id: 'batch-rejected-hist',
    batchNo: 'LOT-REJ-007',
    productId: 'prod-01',
    tccsId: 'tccs-demo-1',
    status: 'REJECTED',
    mfgDate: '2025-01-01',
    expDate: '2027-01-01',
    version: 1,
  };

  // Test Results
  const testResults: TestResult[] = [
    // batchInProgress: có 1/3 chỉ tiêu
    {
      id: 'tr-ip-1',
      batchId: 'batch-in-progress',
      testDate: '2026-01-05',
      results: [{ criteriaName: 'Độ ẩm', value: '5.2', isPass: true }],
      overallStatus: 'PASS',
    },
    // batchPendingReview: có 3/3 chỉ tiêu (đủ 100%)
    {
      id: 'tr-pr-1',
      batchId: 'batch-pending-review',
      testDate: '2026-01-05',
      results: [
        { criteriaName: 'Độ ẩm', value: '4.8', isPass: true },
        { criteriaName: 'Định lượng hoạt chất', value: '100.2', isPass: true },
        { criteriaName: 'Vi sinh vật tổng số', value: '250', isPass: true },
      ],
      overallStatus: 'PASS',
    },
    // batchPassEvaluated: có 3/3 chỉ tiêu
    {
      id: 'tr-pass-1',
      batchId: 'batch-pass-evaluated',
      testDate: '2026-01-05',
      results: [
        { criteriaName: 'Độ ẩm', value: '5.0', isPass: true },
        { criteriaName: 'Định lượng hoạt chất', value: '98.5', isPass: true },
        { criteriaName: 'Vi sinh vật tổng số', value: '150', isPass: true },
      ],
      overallStatus: 'PASS',
    },
    // batchFailEvaluated: có 3/3 chỉ tiêu với 1 OOS
    {
      id: 'tr-fail-1',
      batchId: 'batch-fail-evaluated',
      testDate: '2026-01-05',
      results: [
        { criteriaName: 'Độ ẩm', value: '5.0', isPass: true },
        { criteriaName: 'Định lượng hoạt chất', value: '85.0', isPass: false },
        { criteriaName: 'Vi sinh vật tổng số', value: '150', isPass: true },
      ],
      overallStatus: 'FAIL',
    },
  ];

  const allBatches = [
    batchNotTested,
    batchInProgress,
    batchPendingReview,
    batchPassEvaluated,
    batchFailEvaluated,
    batchReleasedHistorical,
    batchRejectedHistorical,
  ];

  const tccsList = [mockTccs];

  // Helper hàm lọc giống logic trong useBatchList
  function applyFilter(filterStatus: string, batches: Batch[]): Batch[] {
    return batches.filter((batch) => {
      if (filterStatus === 'ALL') return true;

      const isInspectionFilter = [
        'NOT_TESTED',
        'IN_PROGRESS',
        'PENDING_REVIEW',
        'PASS',
        'FAIL',
      ].includes(filterStatus);

      if (isInspectionFilter) {
        const resolvedInspection =
          BatchInspectionProgressService.resolveInspectionStatusWithFallback({
            batch,
            testResults,
            tccs: tccsList.find((t) => t.id === batch.tccsId),
            tccsList,
          });
        return resolvedInspection === filterStatus;
      } else {
        return batch.status === filterStatus;
      }
    });
  }

  describe('1. Phân loại và Lọc theo Inspection Status', () => {
    it('Lọc "NOT_TESTED": Chỉ trả về lô chưa có chỉ tiêu nào hoàn thành', () => {
      const results = applyFilter('NOT_TESTED', allBatches);
      expect(results.map((b) => b.id)).toEqual(['batch-not-tested']);
    });

    it('Lọc "IN_PROGRESS": Chỉ trả về lô đang kiểm (0 < completed < required)', () => {
      const results = applyFilter('IN_PROGRESS', allBatches);
      expect(results.map((b) => b.id)).toEqual(['batch-in-progress']);
    });

    it('Lọc "PENDING_REVIEW": Chỉ trả về lô đã đủ 100% chỉ tiêu và chưa đánh giá', () => {
      const results = applyFilter('PENDING_REVIEW', allBatches);
      expect(results.map((b) => b.id)).toEqual(['batch-pending-review']);
    });

    it('Lọc "PASS": Trả về lô đã đánh giá PASS và lô RELEASED lịch sử (fallback)', () => {
      const results = applyFilter('PASS', allBatches);
      expect(results.map((b) => b.id)).toContain('batch-pass-evaluated');
      expect(results.map((b) => b.id)).toContain('batch-released-hist');
      expect(results.map((b) => b.id)).not.toContain('batch-fail-evaluated');
      expect(results.map((b) => b.id)).not.toContain('batch-pending-review');
    });

    it('Lọc "FAIL": Trả về lô đã đánh giá FAIL và lô REJECTED lịch sử (fallback)', () => {
      const results = applyFilter('FAIL', allBatches);
      expect(results.map((b) => b.id)).toContain('batch-fail-evaluated');
      expect(results.map((b) => b.id)).toContain('batch-rejected-hist');
      expect(results.map((b) => b.id)).not.toContain('batch-pass-evaluated');
    });
  });

  describe('2. Khả năng tương thích ngược với Workflow Statuses', () => {
    it('Lọc "RELEASED": Chỉ trả về lô có workflow status = RELEASED', () => {
      const results = applyFilter('RELEASED', allBatches);
      expect(results.map((b) => b.id)).toEqual(['batch-released-hist']);
    });

    it('Lọc "REJECTED": Chỉ trả về lô có workflow status = REJECTED', () => {
      const results = applyFilter('REJECTED', allBatches);
      expect(results.map((b) => b.id)).toEqual(['batch-rejected-hist']);
    });

    it('Lọc "ALL": Trả về toàn bộ danh sách lô không sót', () => {
      const results = applyFilter('ALL', allBatches);
      expect(results.length).toBe(allBatches.length);
    });
  });

  describe('3. Tách biệt Tiến độ kiểm nghiệm và Release Gate', () => {
    it('Lô PENDING_REVIEW hiển thị 3/3 chỉ tiêu độc lập với Gate xuất xưởng', () => {
      const calc = BatchInspectionProgressService.calculateInspectionProgress({
        batch: batchPendingReview,
        testResults,
        tccs: mockTccs,
      });

      expect(calc.isComplete).toBe(true);
      expect(calc.progress.percentage).toBe(100);
      expect(calc.progress.completedCount).toBe(3);
      expect(calc.progress.requiredCount).toBe(3);
      expect(calc.status).toBe('PENDING_REVIEW');
    });

    it('Lô có chỉ tiêu OOS không thể tự động bị chuyển sang Gate 7 hay PASS', () => {
      const calc = BatchInspectionProgressService.calculateInspectionProgress({
        batch: batchFailEvaluated,
        testResults,
        tccs: mockTccs,
      });

      expect(calc.hasFailures).toBe(true);
      expect(calc.failedCriteria).toContain('Định lượng hoạt chất');
      expect(calc.status).toBe('FAIL');
    });
  });

  describe('4. Store Action: evaluateInspection Dispatch', () => {
    it('Thực hiện evaluateInspection từ Zustand store qua batchAppService thành công', async () => {
      const mockResultBatch: Batch = {
        ...batchPendingReview,
        inspectionStatus: 'PASS',
        inspectionEvaluation: {
          status: 'PASS',
          evaluatedBy: 'usr-qa-test',
          evaluatorName: 'QA Manager',
          evaluatorRole: 'QA',
          evaluatedAt: new Date().toISOString(),
        },
      };

      const spyEvaluate = vi
        .spyOn(batchAppService, 'evaluateInspection')
        .mockResolvedValueOnce(mockResultBatch);

      // Cấu hình store
      useAppStore.setState({
        batches: [batchPendingReview],
        tccsList: [mockTccs],
        testResults,
        user: { id: 'usr-qa-test', displayName: 'QA Manager', role: 'QA' } as any,
      });

      const res = await useAppStore.getState().evaluateInspection(batchPendingReview.id, 'PASS');

      expect(spyEvaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: batchPendingReview.id,
          status: 'PASS',
        })
      );
      expect(res.inspectionStatus).toBe('PASS');
      spyEvaluate.mockRestore();
    });
  });
});
