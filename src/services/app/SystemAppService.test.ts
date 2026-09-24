import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemAppService, SystemActionContext } from './SystemAppService';
import { ISystemRepository } from '../../repositories/ISystemRepository';

describe('SystemAppService', () => {
  let mockRepo: ISystemRepository;
  let service: SystemAppService;

  const adminContext: SystemActionContext = {
    actorId: 'admin-1',
    actorRole: 'ADMIN',
    actorEmail: 'admin@vbiotech.vn',
    reason: 'Bảo trì định kỳ hệ thống',
  };

  const nonAdminContext: SystemActionContext = {
    actorId: 'user-1',
    actorRole: 'QA',
    actorEmail: 'qa@vbiotech.vn',
    reason: 'Thử nghiệm',
  };

  beforeEach(() => {
    mockRepo = {
      backupDatabase: vi.fn().mockResolvedValue({ products: {}, batches: {} }),
      restoreDatabase: vi.fn().mockResolvedValue(undefined),
      wipeDatabase: vi.fn().mockResolvedValue(undefined),
      resetDemoData: vi.fn().mockResolvedValue(undefined),
    };
    service = new SystemAppService(mockRepo);
  });

  describe('Authorization Gate', () => {
    it('chặn các vai trò không phải ADMIN thực hiện backup', async () => {
      await expect(service.backupDatabase(nonAdminContext)).rejects.toThrow(
        /Thao tác DATABASE_BACKUP bắt buộc quyền Quản trị viên/
      );
    });

    it('chặn các vai trò không phải ADMIN thực hiện wipe', async () => {
      await expect(
        service.wipeDatabase({ ...nonAdminContext, confirmationToken: 'CONFIRM_WIPE' })
      ).rejects.toThrow(/Thao tác DATABASE_WIPE bắt buộc quyền Quản trị viên/);
    });

    it('chặn các vai trò không phải ADMIN thực hiện restore', async () => {
      await expect(
        service.restoreDatabase(
          { demo: true },
          { ...nonAdminContext, confirmationToken: 'CONFIRM_RESTORE' }
        )
      ).rejects.toThrow(/Thao tác DATABASE_RESTORE bắt buộc quyền Quản trị viên/);
    });

    it('chặn các vai trò không phải ADMIN thực hiện reset demo data', async () => {
      await expect(
        service.resetDemoData(
          { demo: true },
          { ...nonAdminContext, confirmationToken: 'CONFIRM_RESET_DEMO' }
        )
      ).rejects.toThrow(/Thao tác DATABASE_RESET_DEMO bắt buộc quyền Quản trị viên/);
    });
  });

  describe('Confirmation Token & Reason Enforcement', () => {
    it('DATABASE_WIPE yêu cầu confirmationToken đúng CONFIRM_WIPE và lý do', async () => {
      // Thiếu lý do
      await expect(
        service.wipeDatabase({ ...adminContext, reason: '', confirmationToken: 'CONFIRM_WIPE' })
      ).rejects.toThrow(/bắt buộc phải có lý do giải trình/);

      // Sai token
      await expect(
        service.wipeDatabase({ ...adminContext, confirmationToken: 'WRONG_TOKEN' })
      ).rejects.toThrow(/Mã xác nhận xóa dữ liệu không hợp lệ/);

      // Đúng token và lý do
      const result = await service.wipeDatabase({
        ...adminContext,
        confirmationToken: 'CONFIRM_WIPE',
      });
      expect(result.success).toBe(true);
      expect(result.action).toBe('DATABASE_WIPE');
      expect(mockRepo.wipeDatabase).toHaveBeenCalledTimes(1);
    });

    it('DATABASE_RESTORE yêu cầu dữ liệu hợp lệ và token CONFIRM_RESTORE', async () => {
      // Dữ liệu rỗng
      await expect(
        service.restoreDatabase({}, { ...adminContext, confirmationToken: 'CONFIRM_RESTORE' })
      ).rejects.toThrow(/Dữ liệu khôi phục không hợp lệ hoặc rỗng/);

      // Đúng dữ liệu và token
      const result = await service.restoreDatabase(
        { products: { p1: { name: 'A' } } },
        { ...adminContext, confirmationToken: 'CONFIRM_RESTORE' }
      );
      expect(result.success).toBe(true);
      expect(mockRepo.restoreDatabase).toHaveBeenCalledTimes(1);
    });

    it('DATABASE_RESET_DEMO yêu cầu token CONFIRM_RESET_DEMO', async () => {
      const result = await service.resetDemoData(
        { products: {} },
        { ...adminContext, confirmationToken: 'CONFIRM_RESET_DEMO' }
      );
      expect(result.success).toBe(true);
      expect(mockRepo.resetDemoData).toHaveBeenCalledTimes(1);
    });

    it('DATABASE_BACKUP trích xuất dữ liệu thành công cho ADMIN', async () => {
      const result = await service.backupDatabase(adminContext);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockRepo.backupDatabase).toHaveBeenCalledTimes(1);
    });
  });
});
