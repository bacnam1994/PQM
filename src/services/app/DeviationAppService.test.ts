import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviationAppService } from './DeviationAppService';
import { IDeviationRepository } from '../../repositories/IDeviationRepository';
import { QualityDeviation } from '../../types/deviation';
import { TestResult, Batch } from '../../types';
import * as auditService from '../auditService';

describe('DeviationAppService - Quality Deviation & CAPA Workflow', () => {
  let mockRepo: IDeviationRepository;
  let service: DeviationAppService;
  let inMemoryDeviations: Map<string, QualityDeviation>;

  const mockQAUser = { uid: 'u1', email: 'qa@v-biotech.com', role: 'QA' };
  const mockLabUser = { uid: 'u2', email: 'lab@v-biotech.com', role: 'LAB_ANALYST' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auditService, 'logAuditAction').mockImplementation(async () => {});

    inMemoryDeviations = new Map();

    mockRepo = {
      findById: vi.fn(async (id: string) => inMemoryDeviations.get(id) || null),
      findAll: vi.fn(async () => Array.from(inMemoryDeviations.values())),
      findByBatchId: vi.fn(async (batchId: string) =>
        Array.from(inMemoryDeviations.values()).filter(d => d.batchId === batchId)
      ),
      save: vi.fn(async (deviation: QualityDeviation) => {
        inMemoryDeviations.set(deviation.id, deviation);
      }),
      updateStatus: vi.fn(async (id: string, status: any, notes?: string) => {
        const item = inMemoryDeviations.get(id);
        if (item) {
          item.status = status;
          if (notes) item.closureNotes = notes;
          item.updatedAt = new Date().toISOString();
        }
      }),
      delete: vi.fn(async (id: string) => {
        inMemoryDeviations.delete(id);
      }),
    };

    service = new DeviationAppService(mockRepo);
  });

  describe('createDeviation', () => {
    it('should successfully create a deviation with status LOGGED and version 1', async () => {
      const dev = await service.createDeviation({
        title: 'Nhiệt độ kho bảo quản vượt ngưỡng 30 độ C',
        source: 'STORAGE_ENVIRONMENT',
        severity: 'MAJOR',
        description: 'Sensor số 2 ghi nhận nhiệt độ 32.5 độ C trong 45 phút.',
        immediateAction: 'Khởi động máy lạnh phụ trợ.'
      }, mockQAUser);

      expect(dev).toBeDefined();
      expect(dev.id).toBeTruthy();
      expect(dev.deviationNo).toMatch(/^DEV-\d{4}-\d{4}$/);
      expect(dev.status).toBe('LOGGED');
      expect(dev.severity).toBe('MAJOR');
      expect(dev.version).toBe(1);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(auditService.logAuditAction).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE',
        collection: 'DEVIATIONS'
      }));
    });
  });

  describe('autoLogFromOOS', () => {
    it('should return null when test result overallStatus is PASS', async () => {
      const passResult: TestResult = {
        id: 'tr-pass',
        batchId: 'b-01',
        testDate: '2026-09-08',
        createdAt: '2026-09-08T00:00:00.000Z',
        labName: 'Lab 1',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'pH', value: 6.5, isPass: true }]
      };

      const result = await service.autoLogFromOOS(passResult, undefined, mockLabUser);
      expect(result).toBeNull();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should automatically create a deviation when test result is FAIL', async () => {
      const failResult: TestResult = {
        id: 'tr-fail-1',
        batchId: 'b-01',
        testDate: '2026-09-08',
        createdAt: '2026-09-08T00:00:00.000Z',
        labName: 'Lab 1',
        overallStatus: 'FAIL',
        results: [
          { criteriaName: 'Độ hòa tan', value: '65%', isPass: false, limit: '≥ 80%' },
          { criteriaName: 'pH', value: 6.5, isPass: true }
        ]
      };

      const batch: Batch = {
        id: 'b-01',
        batchNo: 'L260901',
        productId: 'prod-01',
        tccsId: 'tccs-01',
        mfgDate: '2026-09-01',
        expDate: '2028-09-01',
        theoreticalYield: 100,
        actualYield: 98,
        yieldUnit: 'kg',
        status: 'TESTING',
        createdAt: '2026-09-01T00:00:00.000Z'
      };

      const dev = await service.autoLogFromOOS(failResult, batch, mockLabUser);
      expect(dev).toBeDefined();
      expect(dev?.source).toBe('OOS_TEST_RESULT');
      expect(dev?.severity).toBe('MAJOR');
      expect(dev?.failedCriteria?.length).toBe(1);
      expect(dev?.failedCriteria?.[0].name).toBe('Độ hòa tan');
      expect(dev?.batchNo).toBe('L260901');
    });

    it('should mark severity as CRITICAL if microbiological test fails', async () => {
      const failResult: TestResult = {
        id: 'tr-fail-micro',
        batchId: 'b-02',
        testDate: '2026-09-08',
        createdAt: '2026-09-08T00:00:00.000Z',
        labName: 'Lab Micro',
        overallStatus: 'FAIL',
        results: [
          { criteriaName: 'Tổng số vi sinh vật hiếu khí', value: '1500 CFU/g', isPass: false, limit: '≤ 1000 CFU/g' }
        ]
      };

      const dev = await service.autoLogFromOOS(failResult, undefined, mockLabUser);
      expect(dev?.severity).toBe('CRITICAL');
    });

    it('should not create duplicate deviation if one already exists for the test result', async () => {
      const failResult: TestResult = {
        id: 'tr-fail-dup',
        batchId: 'b-03',
        testDate: '2026-09-08',
        createdAt: '2026-09-08T00:00:00.000Z',
        labName: 'Lab 1',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'pH', value: 4.0, isPass: false }]
      };

      // Call first time
      const first = await service.autoLogFromOOS(failResult, undefined, mockLabUser);
      // Call second time
      const second = await service.autoLogFromOOS(failResult, undefined, mockLabUser);

      expect(first?.id).toBe(second?.id);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateStatus & State Machine', () => {
    it('should allow advancing from LOGGED to UNDER_INVESTIGATION', async () => {
      const dev = await service.createDeviation({
        title: 'Màu sắc dung dịch biến đổi',
        source: 'MANUFACTURING',
        severity: 'MINOR',
        description: 'Dung dịch có màu vàng nhạt thay vì không màu.'
      }, mockQAUser);

      await service.updateStatus(dev.id, 'UNDER_INVESTIGATION', mockQAUser);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(dev.id, 'UNDER_INVESTIGATION', undefined);
    });

    it('should prevent non-QA users from closing a deviation', async () => {
      const dev = await service.createDeviation({
        title: 'Test',
        source: 'INTERNAL_AUDIT',
        severity: 'MINOR',
        description: 'Test'
      }, mockLabUser);

      await expect(
        service.updateStatus(dev.id, 'CLOSED', mockLabUser, { notes: 'Đã xử lý xong' })
      ).rejects.toThrow('Từ chối quyền: Chỉ Trưởng phòng QA');
    });

    it('should require closure notes before closing a deviation', async () => {
      const dev = await service.createDeviation({
        title: 'Test',
        source: 'INTERNAL_AUDIT',
        severity: 'MINOR',
        description: 'Test'
      }, mockQAUser);

      await expect(
        service.updateStatus(dev.id, 'CLOSED', mockQAUser)
      ).rejects.toThrow('Quy chuẩn GMP: Bắt buộc phải ghi nhận ý kiến thẩm định');
    });

    it('should allow QA to close deviation with notes', async () => {
      const dev = await service.createDeviation({
        title: 'Test',
        source: 'INTERNAL_AUDIT',
        severity: 'MINOR',
        description: 'Test'
      }, mockQAUser);

      await service.updateStatus(dev.id, 'CLOSED', mockQAUser, {
        notes: 'Đã thẩm tra mẫu lưu và hiệu chuẩn lại thiết bị đo pH. Đạt chuẩn.'
      });

      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        dev.id,
        'CLOSED',
        'Đã thẩm tra mẫu lưu và hiệu chuẩn lại thiết bị đo pH. Đạt chuẩn.'
      );
    });
  });

  describe('addCAPAItem', () => {
    it('should append CAPA action and advance status to CAPA_PLANNED if currently UNDER_INVESTIGATION', async () => {
      const dev = await service.createDeviation({
        title: 'Cân phân tích trôi điểm 0',
        source: 'MANUFACTURING',
        severity: 'MAJOR',
        description: 'Cân số 4 trôi 0.05g'
      }, mockQAUser);

      // Chuyển sang UNDER_INVESTIGATION
      await service.updateStatus(dev.id, 'UNDER_INVESTIGATION', mockQAUser);

      // Bổ sung CAPA
      const updated = await service.addCAPAItem(dev.id, {
        type: 'CORRECTIVE',
        action: 'Bảo trì, căn chỉnh và dán tem kiểm định lại cân số 4',
        responsible: 'Kỹ sư Thiết bị',
        deadline: '2026-09-15',
        status: 'PENDING',
        verificationMethod: 'Biên bản hiệu chuẩn thiết bị'
      }, mockQAUser);

      expect(updated.capaItems?.length).toBe(1);
      expect(updated.capaItems?.[0].id).toBeTruthy();
      expect(updated.capaItems?.[0].action).toContain('Bảo trì');
      expect(updated.status).toBe('CAPA_PLANNED');
      expect(updated.version).toBe(2);
    });
  });

  describe('completeCAPAItem', () => {
    it('should mark specified CAPA item as COMPLETED and increment version', async () => {
      const dev = await service.createDeviation({
        title: 'Cân phân tích trôi điểm 0',
        source: 'MANUFACTURING',
        severity: 'MAJOR',
        description: 'Cân số 4 trôi 0.05g'
      }, mockQAUser);

      const withCapa = await service.addCAPAItem(dev.id, {
        type: 'CORRECTIVE',
        action: 'Bảo dưỡng cân',
        responsible: 'Kỹ sư Thiết bị',
        deadline: '2026-09-15',
        status: 'PENDING'
      }, mockQAUser);

      const capaId = withCapa.capaItems![0].id;
      const completed = await service.completeCAPAItem(dev.id, capaId, mockQAUser);

      expect(completed.capaItems![0].status).toBe('COMPLETED');
      expect(completed.capaItems![0].completedAt).toBeDefined();
      expect(completed.version).toBe(3);
      expect(auditService.logAuditAction).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE',
        collection: 'DEVIATIONS',
        documentId: dev.id
      }));
    });
  });
});
