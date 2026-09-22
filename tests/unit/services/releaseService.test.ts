/**
 * tests/unit/services/releaseService.test.ts
 * ===========================================
 * Kiểm thử đơn vị cho ReleaseService:
 * - Đánh giá 7 Release Gates (evaluateReleaseReadiness)
 * - Xuất xưởng Lô thành công khi thỏa mãn toàn bộ tiêu chí (releaseBatch)
 * - Chặn xuất xưởng khi vai trò không phải QA/ADMIN hoặc chưa đủ điều kiện
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReleaseService } from '../../../src/services/app/ReleaseService';
import { Batch, TestResult, TCCS } from '../../../src/types';
import { batchAppService } from '../../../src/services/app/BatchAppService';
import { signatureService } from '../../../src/services/signatureService';

describe('ReleaseService Unit Tests', () => {
  let service: ReleaseService;

  const mockTccs: TCCS = {
    id: 'tccs-01',
    productId: 'prod-01',
    code: 'TCCS-01',
    productName: 'Paracetamol 500mg',
    isActive: true,
    mainQualityCriteria: [
      { id: 'c1', name: 'Định lượng', min: 95, max: 105, unit: '%', type: 'NUMBER' as any },
    ],
  };

  const mockBatch: Batch = {
    id: 'batch-01',
    batchNo: 'LOT-2026-001',
    productId: 'prod-01',
    productName: 'Paracetamol 500mg',
    tccsId: 'tccs-01',
    status: 'TESTING',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    createdAt: '2026-01-01',
  };

  const mockPassingTestResult: TestResult = {
    id: 'tr-01',
    batchId: 'batch-01',
    productId: 'prod-01',
    tccsId: 'tccs-01',
    overallStatus: 'PASS',
    approvalStatus: 'APPROVED',
    results: [
      {
        criterionId: 'c1',
        criteriaName: 'Định lượng',
        value: '100.0',
        isPass: true,
        status: 'PASS',
      },
    ],
    evaluationSnapshot: {
      schemaVersion: '1.0.0',
      snapshotId: 'snap-01',
      evaluationHash: 'hash-01',
      evaluatedAt: '2026-01-02',
      overallStatus: 'PASS',
      criterionResults: [],
    } as any,
  } as any;

  beforeEach(() => {
    service = new ReleaseService();
    vi.clearAllMocks();
  });

  describe('evaluateReleaseReadiness', () => {
    it('Trả về kết quả sẵn sàng khi lô đạt chuẩn và có thẩm quyền QA', () => {
      const res = service.evaluateReleaseReadiness({
        batch: mockBatch,
        testResults: [mockPassingTestResult],
        boundTccs: mockTccs,
        userRole: 'QA',
      });

      expect(res.isEligible).toBe(true);
      expect(res.allGatesPassed).toBe(true);
      expect(res.gates).toHaveLength(7);
      expect(res.blockers).toHaveLength(0);
    });

    it('Chặn sẵn sàng khi lô có sự cố OOS chưa đóng', () => {
      const res = service.evaluateReleaseReadiness({
        batch: { ...mockBatch, hasActiveOOS: true },
        testResults: [mockPassingTestResult],
        boundTccs: mockTccs,
        userRole: 'QA',
      });

      expect(res.isEligible).toBe(false);
      expect(res.allGatesPassed).toBe(false);
      expect(res.gates[2].passed).toBe(false); // Gate 3: OOS
    });
  });

  describe('releaseBatch', () => {
    it('Chặn xuất xưởng nếu người thực hiện là LAB/GUEST', async () => {
      await expect(
        service.releaseBatch({
          batchId: 'batch-01',
          currentBatch: mockBatch,
          testResults: [mockPassingTestResult],
          currentUser: { email: 'lab@pqm.com', role: 'LAB' },
        })
      ).rejects.toThrow('Từ chối quyền: Chỉ QA hoặc Quản trị viên');
    });

    it('Chặn xuất xưởng nếu QA thực hiện mà thiếu chữ ký điện tử', async () => {
      await expect(
        service.releaseBatch({
          batchId: 'batch-01',
          currentBatch: mockBatch,
          testResults: [mockPassingTestResult],
          currentUser: { email: 'qa@pqm.com', role: 'QA' },
          boundTccs: mockTccs,
        })
      ).rejects.toThrow('Yêu cầu chữ ký điện tử hợp lệ của QA');
    });

    it('Cho phép ADMIN xuất xưởng lô kèm lý do', async () => {
      const updateStatusSpy = vi
        .spyOn(batchAppService, 'updateStatus')
        .mockResolvedValue(undefined);

      const res = await service.releaseBatch({
        batchId: 'batch-01',
        currentBatch: mockBatch,
        testResults: [mockPassingTestResult],
        currentUser: { email: 'admin@pqm.com', role: 'ADMIN' },
        reason: 'Quản trị viên xuất xưởng',
      });

      expect(res.success).toBe(true);
      expect(updateStatusSpy).toHaveBeenCalledWith(
        'batch-01',
        'RELEASED',
        expect.objectContaining({ role: 'ADMIN' }),
        expect.objectContaining({ reason: 'Quản trị viên xuất xưởng' })
      );
    });
  });
});
