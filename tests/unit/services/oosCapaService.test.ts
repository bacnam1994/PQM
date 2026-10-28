/**
 * tests/unit/services/oosCapaService.test.ts
 * ===========================================
 * Kiểm thử đơn vị cho OOSService & CAPAService:
 * - Kích hoạt tự động hồ sơ OOS khi kiểm nghiệm FAIL (BR-OOS-001)
 * - Tiến hành điều tra OOS Phase 1 (Lab) & Phase 2 (Manufacturing) (BR-OOS-002, 003)
 * - Khởi tạo và hoàn tất hành động CAPA (BR-CAP-001, 002)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OOSService } from '../../../src/services/app/OOSService';
import { CAPAService } from '../../../src/services/app/CAPAService';
import { deviationAppService } from '../../../src/services/app/DeviationAppService';
import { TestResult, Batch, QualityDeviation } from '../../../src/types';

describe('OOSService & CAPAService Unit Tests', () => {
  const oosService = new OOSService();
  const capaService = new CAPAService();

  const mockBatch: Batch = {
    id: 'batch-01',
    batchNo: 'LOT-2026-001',
    productId: 'prod-01',
    status: 'TESTING',
  } as Batch;

  const mockFailTestResult: TestResult = {
    id: 'tr-fail',
    batchId: 'batch-01',
    productId: 'prod-01',
    overallStatus: 'FAIL',
    labName: 'Lab QC 01',
    results: [{ criteriaName: 'Độ hòa tan', value: '60', isPass: false, status: 'FAIL' }],
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OOSService', () => {
    it('Tự động kích hoạt OOS deviation khi có kết quả kiểm nghiệm rớt', async () => {
      const autoLogSpy = vi.spyOn(deviationAppService, 'autoLogFromOOS').mockResolvedValue({
        id: 'dev-oos-01',
        deviationNo: 'DEV-2026-0001',
        title: 'OOS Test',
        status: 'LOGGED',
        severity: 'CRITICAL',
      } as QualityDeviation);

      const res = await oosService.triggerOOSInvestigation({
        testResult: mockFailTestResult,
        batch: mockBatch,
        failedCriteriaNames: ['Độ hòa tan'],
        currentUser: { email: 'qc@pqm.com', role: 'QC' },
      });

      expect(autoLogSpy).toHaveBeenCalledWith(
        mockFailTestResult,
        mockBatch,
        expect.objectContaining({ email: 'qc@pqm.com' })
      );
      expect(res.id).toBe('dev-oos-01');
    });

    it('Hoàn tất điều tra Phase 1 cập nhật sang INVESTIGATING', async () => {
      const updateStatusSpy = vi
        .spyOn(deviationAppService, 'updateStatus')
        .mockResolvedValue(undefined as any);

      await oosService.submitPhase1Investigation({
        deviationId: 'dev-oos-01',
        phase1Data: {
          instrumentCheck: 'PASS',
          standardSolutionCheck: 'PASS',
          calculationCheck: 'PASS',
          operatorInterview: 'Thao tác chuẩn',
          labErrorFound: false,
          assignedAnalyst: 'analyst@pqm.com',
        },
        currentUser: { email: 'qc_lead@pqm.com', role: 'QC' },
      });

      expect(updateStatusSpy).toHaveBeenCalledWith(
        'dev-oos-01',
        'UNDER_INVESTIGATION',
        expect.objectContaining({ email: 'qc_lead@pqm.com' }),
        expect.objectContaining({ notes: expect.stringContaining('OOS Phase 1 Lab Investigation') })
      );
    });

    it('Chặn đóng OOS nếu người thực hiện không phải QA hoặc ADMIN', async () => {
      await expect(
        oosService.concludeOOSInvestigation({
          deviationId: 'dev-oos-01',
          phase2Data: {
            manufacturingProcessCheck: 'FAIL',
            rawMaterialCheck: 'PASS',
            environmentalConditionsCheck: 'PASS',
            rootCauseIdentified: 'Nhiệt độ sấy không đạt',
            capaPlanRequired: true,
          },
          qaDecision: 'BATCH_REJECTED',
          currentUser: { email: 'qc@pqm.com', role: 'QC' },
          closureReason: 'Từ chối Lô',
        })
      ).rejects.toThrow('Chỉ QA hoặc Quản trị viên (ADMIN) mới có thẩm quyền');
    });
  });

  describe('CAPAService', () => {
    it('Chặn thêm hành động CAPA nếu thiếu trường bắt buộc', async () => {
      await expect(
        capaService.addCapaAction(
          {
            deviationId: 'dev-01',
            actionType: 'CORRECTIVE',
            description: '',
            assignedTo: 'engineer@pqm.com',
            dueDate: '2026-10-01',
          },
          { email: 'qa@pqm.com', role: 'QA' }
        )
      ).rejects.toThrow('Nội dung hành động CAPA không được để trống');
    });

    it('Hoàn thành hành động CAPA gọi delegation sang deviationAppService', async () => {
      const completeSpy = vi
        .spyOn(deviationAppService, 'completeCAPAItem')
        .mockResolvedValue({} as any);

      await capaService.completeCapaAction(
        'dev-01',
        'capa-01',
        { email: 'qa@pqm.com', role: 'QA' },
        'Đã hiệu chuẩn xong thiết bị'
      );

      expect(completeSpy).toHaveBeenCalledWith(
        'dev-01',
        'capa-01',
        expect.objectContaining({ email: 'qa@pqm.com' })
      );
    });

    it('Chặn đóng CAPA nếu thiếu bằng chứng đánh giá hiệu quả chi tiết (BR-CAP-002)', async () => {
      await expect(
        capaService.verifyAndCloseCAPA({
          deviationId: 'dev-01',
          effectivenessEvidence: 'Đã xong', // quá ngắn (< 20 ký tự)
          currentUser: { email: 'qa@pqm.com', role: 'QA' },
        })
      ).rejects.toThrow('ERR_CAPA_EFFECTIVENESS_MISSING');
    });

    it('Chặn đóng CAPA nếu còn hành động khắc phục chưa hoàn thành (BR-CAP-002)', async () => {
      vi.spyOn(deviationAppService, 'findById').mockResolvedValue({
        id: 'dev-01',
        deviationNo: 'DEV-2026-0001',
        capaItems: [
          { id: 'c1', status: 'COMPLETED' },
          { id: 'c2', status: 'PENDING' },
        ],
      } as any);

      await expect(
        capaService.verifyAndCloseCAPA({
          deviationId: 'dev-01',
          effectivenessEvidence: 'Theo dõi 3 tháng liên tiếp không phát hiện tái diễn lỗi nhiệt độ',
          currentUser: { email: 'qa@pqm.com', role: 'QA' },
        })
      ).rejects.toThrow('ERR_CAPA_ITEMS_INCOMPLETE');
    });

    it('Đóng CAPA thành công khi 100% hành động hoàn thành và thẩm định hiệu quả đạt', async () => {
      vi.spyOn(deviationAppService, 'findById').mockResolvedValue({
        id: 'dev-01',
        deviationNo: 'DEV-2026-0001',
        capaItems: [
          { id: 'c1', status: 'COMPLETED' },
          { id: 'c2', status: 'COMPLETED' },
        ],
      } as any);

      const updateStatusSpy = vi
        .spyOn(deviationAppService, 'updateStatus')
        .mockResolvedValue(undefined as any);

      const res = await capaService.verifyAndCloseCAPA({
        deviationId: 'dev-01',
        effectivenessEvidence:
          'Theo dõi 90 ngày liên tiếp không ghi nhận bất kỳ sự cố tương tự nào tái diễn',
        currentUser: { email: 'qa_manager@pqm.com', role: 'QA' },
      });

      expect(updateStatusSpy).toHaveBeenCalledWith(
        'dev-01',
        'CLOSED',
        expect.objectContaining({ email: 'qa_manager@pqm.com' }),
        expect.objectContaining({ notes: expect.stringContaining('[CAPA ĐÃ ĐÓNG]') })
      );
      expect(res.id).toBe('dev-01');
    });
  });
});
