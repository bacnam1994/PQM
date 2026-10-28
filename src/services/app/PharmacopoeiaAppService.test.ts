import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PharmacopoeiaAppService, PharmacopoeiaActionContext } from './PharmacopoeiaAppService';
import { IPharmacopoeiaRepository } from '../../repositories/IPharmacopoeiaRepository';
import { PharmacopoeiaStandard } from '../pharmacopoeiaService';

describe('PharmacopoeiaAppService', () => {
  let mockRepo: IPharmacopoeiaRepository;
  let service: PharmacopoeiaAppService;

  const adminContext: PharmacopoeiaActionContext = {
    actorId: 'admin-1',
    actorRole: 'ADMIN',
    actorEmail: 'admin@vbiotech.vn',
  };

  const qaContext: PharmacopoeiaActionContext = {
    actorId: 'qa-1',
    actorRole: 'QA',
    actorEmail: 'qa@vbiotech.vn',
  };

  const guestContext: PharmacopoeiaActionContext = {
    actorId: 'guest-1',
    actorRole: 'GUEST',
  };

  const sampleStandard: PharmacopoeiaStandard = {
    id: 'pharma-std-001',
    title: 'Độ ẩm (Loss on Drying)',
    keywords: ['độ ẩm', 'moisture'],
    standard: 'NMT 5.0%',
    source: 'DĐVN V',
    category: 'Lý hóa',
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([sampleStandard]),
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      seedDefaults: vi.fn().mockResolvedValue(undefined),
    };
    service = new PharmacopoeiaAppService(mockRepo);
  });

  describe('Authorization Gate', () => {
    it('chặn vai trò không có thẩm quyền tạo tiêu chuẩn dược điển', async () => {
      await expect(service.createStandard(sampleStandard, guestContext)).rejects.toThrow(
        /Thẩm quyền bị từ chối/
      );
    });

    it('chặn QA xóa tiêu chuẩn dược điển (chỉ ADMIN)', async () => {
      await expect(
        service.deleteStandard('pharma-std-001', { ...qaContext, reason: 'Lỗi thời' })
      ).rejects.toThrow(/Chỉ Quản trị viên \(ADMIN\) mới có quyền/);
    });

    it('chặn QA seed tiêu chuẩn mặc định (chỉ ADMIN)', async () => {
      await expect(
        service.seedDefaultStandards([sampleStandard], { ...qaContext, reason: 'Seed' })
      ).rejects.toThrow(/Chỉ Quản trị viên \(ADMIN\) mới có quyền/);
    });
  });

  describe('Validation & Execution', () => {
    it('tạo mới tiêu chuẩn dược điển thành công với QA/ADMIN', async () => {
      const created = await service.createStandard(sampleStandard, qaContext);
      expect(created.id).toBe(sampleStandard.id);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('cập nhật tiêu chuẩn dược điển thành công', async () => {
      await service.updateStandard({ ...sampleStandard, standard: 'NMT 6.0%' }, adminContext);
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
    });

    it('xóa tiêu chuẩn yêu cầu lý do giải trình', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(sampleStandard);
      await expect(
        service.deleteStandard('pharma-std-001', { ...adminContext, reason: '' })
      ).rejects.toThrow(/bắt buộc phải có lý do giải trình/);

      await service.deleteStandard('pharma-std-001', {
        ...adminContext,
        reason: 'Thay thế bằng phiên bản dược điển mới',
      });
      expect(mockRepo.delete).toHaveBeenCalledWith('pharma-std-001');
    });

    it('seed tiêu chuẩn mặc định gọi repository seedDefaults', async () => {
      await service.seedDefaultStandards([sampleStandard], adminContext);
      expect(mockRepo.seedDefaults).toHaveBeenCalledWith([sampleStandard]);
    });
  });
});
