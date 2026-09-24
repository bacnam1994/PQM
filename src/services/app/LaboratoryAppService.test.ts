import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LaboratoryAppService, LabActionContext } from './LaboratoryAppService';
import { ILaboratoryRepository } from '../../repositories/ILaboratoryRepository';
import { TestingLaboratory } from '../../types/laboratory';

describe('LaboratoryAppService', () => {
  let mockRepo: ILaboratoryRepository;
  let service: LaboratoryAppService;

  const adminContext: LabActionContext = {
    actorId: 'admin-1',
    actorRole: 'ADMIN',
    actorEmail: 'admin@vbiotech.vn',
  };

  const qaContext: LabActionContext = {
    actorId: 'qa-1',
    actorRole: 'QA',
    actorEmail: 'qa@vbiotech.vn',
  };

  const guestContext: LabActionContext = {
    actorId: 'guest-1',
    actorRole: 'GUEST',
  };

  const sampleLab: TestingLaboratory = {
    id: 'lab-vn-01',
    code: 'VN01',
    canonicalName: 'Viện Kiểm Nghiệm Thuốc TW',
    aliases: ['VKNTW', 'NIFC'],
    type: 'EXTERNAL',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([sampleLab]),
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    service = new LaboratoryAppService(mockRepo);
  });

  describe('Authorization Gate', () => {
    it('chặn vai trò không có thẩm quyền (GUEST) tạo phòng lab', async () => {
      await expect(service.createLaboratory(sampleLab, guestContext)).rejects.toThrow(
        /Thẩm quyền bị từ chối/
      );
    });

    it('chặn vai trò QA xóa phòng lab (bắt buộc ADMIN)', async () => {
      await expect(
        service.deleteLaboratory('lab-vn-01', { ...qaContext, reason: 'Dừng hợp tác' })
      ).rejects.toThrow(/Chỉ Quản trị viên \(ADMIN\) mới có quyền xóa đơn vị kiểm nghiệm/);
    });
  });

  describe('Validation & Execution', () => {
    it('tạo mới phòng lab thành công với vai trò QA/ADMIN', async () => {
      const created = await service.createLaboratory(sampleLab, qaContext);
      expect(created.id).toBe(sampleLab.id);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('từ chối tạo phòng lab nếu thiếu ID hoặc Tên chuẩn', async () => {
      await expect(
        service.createLaboratory({ ...sampleLab, canonicalName: '' }, qaContext)
      ).rejects.toThrow(/Yêu cầu đầy đủ ID, mã Code và Tên chuẩn hóa/);
    });

    it('cập nhật phòng lab thành công', async () => {
      await service.updateLaboratory({ ...sampleLab, code: 'VN01-MOD' }, adminContext);
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
    });

    it('xóa phòng lab yêu cầu lý do giải trình', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(sampleLab);
      await expect(
        service.deleteLaboratory('lab-vn-01', { ...adminContext, reason: '' })
      ).rejects.toThrow(/bắt buộc phải có lý do giải trình/);

      await service.deleteLaboratory('lab-vn-01', {
        ...adminContext,
        reason: 'Hết hạn giấy phép kiểm nghiệm',
      });
      expect(mockRepo.delete).toHaveBeenCalledWith('lab-vn-01');
    });
  });
});
