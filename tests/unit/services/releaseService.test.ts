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
    createdAt: '2026-01-01T00:00:00.000Z',
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

  describe('executeBatchHold & executeBatchRecall (BR-REL-002)', () => {
    it('Chặn tạm dừng lưu thông (Hold) nếu người dùng không phải QA/ADMIN', async () => {
      await expect(
        service.executeBatchHold({
          batchId: 'batch-01',
          currentBatch: mockBatch,
          reason: 'Nghi ngờ hàm lượng tạp chất cao',
          currentUser: { email: 'prod@pqm.com', role: 'PRODUCTION' },
        })
      ).rejects.toThrow('Từ chối quyền: Chỉ Quản lý chất lượng (QA) hoặc Quản trị viên');
    });

    it('Yêu cầu lý do giải trình khi ban hành Lệnh giữ Lô', async () => {
      await expect(
        service.executeBatchHold({
          batchId: 'batch-01',
          currentBatch: mockBatch,
          reason: '   ',
          currentUser: { email: 'qa@pqm.com', role: 'QA' },
        })
      ).rejects.toThrow('ERR_HOLD_REASON_REQUIRED');
    });

    it('QA ban hành Lệnh giữ Lô (Batch Hold) thành công, cập nhật trạng thái BLOCKED', async () => {
      const updateStatusSpy = vi
        .spyOn(batchAppService, 'updateStatus')
        .mockResolvedValue(undefined);

      const res = await service.executeBatchHold({
        batchId: 'batch-01',
        currentBatch: { ...mockBatch, status: 'RELEASED' },
        reason: 'Có khiếu nại khách hàng về vỡ viên',
        currentUser: { email: 'qa@pqm.com', role: 'QA' },
      });

      expect(res.success).toBe(true);
      expect(updateStatusSpy).toHaveBeenCalledWith(
        'batch-01',
        'BLOCKED',
        expect.objectContaining({ role: 'QA' }),
        expect.objectContaining({ reason: expect.stringContaining('LỆNH GIỮ LÔ') })
      );
    });

    it('QA ban hành Lệnh thu hồi Lô (Batch Recall) thành công với cấp độ Class I', async () => {
      const updateStatusSpy = vi
        .spyOn(batchAppService, 'updateStatus')
        .mockResolvedValue(undefined);

      const res = await service.executeBatchRecall({
        batchId: 'batch-01',
        currentBatch: { ...mockBatch, status: 'RELEASED' },
        recallClass: 'CLASS_I',
        reason: 'Phát hiện tạp chất lạ vượt ngưỡng độc tính theo cảnh báo Cục Quản lý Dược',
        currentUser: { email: 'qa@pqm.com', role: 'QA' },
      });

      expect(res.success).toBe(true);
      expect(updateStatusSpy).toHaveBeenCalledWith(
        'batch-01',
        'BLOCKED',
        expect.objectContaining({ role: 'QA' }),
        expect.objectContaining({ reason: expect.stringContaining('THU HỒI CLASS_I') })
      );
    });
  });
});
