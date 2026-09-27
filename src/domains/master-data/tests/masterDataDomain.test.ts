import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MasterCriterionRules,
  PharmacopoeiaRules,
  LaboratoryRules,
  MasterCriterionAppService,
  PharmacopoeiaAppService,
  LaboratoryAppService,
  masterDataQueries,
  MasterCriterion,
  PharmacopoeiaStandard,
  TestingLaboratory,
} from '../index';

vi.mock('../../../services/auditService', () => ({
  logAuditAction: vi.fn(),
}));

vi.mock('../../../workflow/WorkflowFacade', () => ({
  WorkflowFacade: {
    dispatch: vi.fn().mockImplementation(async (context, handler) => {
      const data = await handler();
      return { success: true, data };
    }),
  },
}));

vi.mock('../../../services/testResultService', () => ({
  bulkRenameCriteriaInAllTestResults: vi
    .fn()
    .mockResolvedValue({ updatedCount: 5, totalScanned: 20 }),
}));

vi.mock('../../../services/permissionService', () => ({
  can: vi.fn().mockImplementation((user, permission) => {
    if (user?.role === 'ADMIN' || user?.isAdmin) return true;
    if (user?.role === 'QA' && permission !== 'system:admin') return true;
    return false;
  }),
}));

describe('VERTICAL SLICE 13: Master Data Domain Tests', () => {
  const adminUser = { uid: 'u-admin', email: 'admin@pqm.com', role: 'ADMIN', isAdmin: true };
  const qaUser = { uid: 'u-qa', email: 'qa@pqm.com', role: 'QA', isAdmin: false };
  const guestUser = { uid: 'u-guest', email: 'guest@pqm.com', role: 'GUEST', isAdmin: false };

  describe('1. Master Criterion Domain & Rules', () => {
    let mockCriteriaRepo: any;
    let criteriaService: MasterCriterionAppService;

    const sampleCriterion: MasterCriterion = {
      id: 'crit-01',
      canonicalName: 'Độ pH',
      category: 'QUALITY',
      defaultUnit: '',
      type: 'NUMBER',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockCriteriaRepo = {
        findAll: vi.fn().mockResolvedValue([sampleCriterion]),
        findActive: vi.fn().mockResolvedValue([sampleCriterion]),
        findById: vi.fn().mockResolvedValue(sampleCriterion),
        save: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      criteriaService = new MasterCriterionAppService(mockCriteriaRepo);
    });

    it('từ chối chỉ tiêu mẫu nếu tên chỉ tiêu rỗng', () => {
      expect(() =>
        MasterCriterionRules.validate({ ...sampleCriterion, canonicalName: '' })
      ).toThrow(/Tên chỉ tiêu không được để trống/);
    });

    it('tạo mới chỉ tiêu mẫu thành công qua service', async () => {
      await criteriaService.create(sampleCriterion, qaUser);
      expect(mockCriteriaRepo.save).toHaveBeenCalledWith(sampleCriterion);
    });

    it('chặn người dùng không có quyền tạo chỉ tiêu mẫu', async () => {
      await expect(criteriaService.create(sampleCriterion, guestUser)).rejects.toThrow(
        /Từ chối quyền/
      );
    });

    it('đổi tên chỉ tiêu mẫu hàng loạt với quyền quản trị / QA', async () => {
      const result = await criteriaService.bulkRename('pH cũ', 'Độ pH chuẩn', qaUser);
      expect(result.updatedCount).toBe(5);
    });
  });

  describe('2. Pharmacopoeia Domain & Rules', () => {
    let mockPharmaRepo: any;
    let pharmaService: PharmacopoeiaAppService;

    const sampleStandard: PharmacopoeiaStandard = {
      id: 'pharma-01',
      title: 'Độ rã viên nén',
      standard: 'Không quá 15 phút',
      source: 'DĐVN V',
      category: 'Lý hóa',
      keywords: ['độ rã', 'disintegration'],
    };

    beforeEach(() => {
      mockPharmaRepo = {
        findAll: vi.fn().mockResolvedValue([sampleStandard]),
        findById: vi.fn().mockResolvedValue(sampleStandard),
        save: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        seedDefaults: vi.fn().mockResolvedValue(undefined),
      };
      pharmaService = new PharmacopoeiaAppService(mockPharmaRepo);
    });

    it('từ chối tiêu chuẩn nếu thiếu ID, tiêu đề hoặc nội dung', () => {
      expect(() => PharmacopoeiaRules.validate({ ...sampleStandard, title: '' })).toThrow(
        /Yêu cầu đầy đủ ID, tiêu đề và nội dung quy chuẩn/
      );
    });

    it('chặn vai trò không có thẩm quyền tạo tiêu chuẩn dược điển', async () => {
      await expect(
        pharmaService.createStandard(sampleStandard, {
          actorId: 'guest-1',
          actorRole: 'GUEST',
        })
      ).rejects.toThrow(/Thẩm quyền bị từ chối/);
    });

    it('tạo mới tiêu chuẩn dược điển thành công với QA/ADMIN', async () => {
      const created = await pharmaService.createStandard(sampleStandard, {
        actorId: 'qa-1',
        actorRole: 'QA',
        actorEmail: 'qa@pqm.com',
      });
      expect(created.id).toBe(sampleStandard.id);
      expect(mockPharmaRepo.save).toHaveBeenCalledTimes(1);
    });

    it('xóa tiêu chuẩn yêu cầu lý do giải trình', async () => {
      await expect(
        pharmaService.deleteStandard('pharma-01', {
          actorId: 'admin-1',
          actorRole: 'ADMIN',
          reason: '',
        })
      ).rejects.toThrow(/bắt buộc phải có lý do giải trình/);

      await pharmaService.deleteStandard('pharma-01', {
        actorId: 'admin-1',
        actorRole: 'ADMIN',
        reason: 'Cập nhật ấn bản mới',
      });
      expect(mockPharmaRepo.delete).toHaveBeenCalledWith('pharma-01');
    });
  });

  describe('3. Laboratory Domain & Rules', () => {
    let mockLabRepo: any;
    let labService: LaboratoryAppService;

    const sampleLab: TestingLaboratory = {
      id: 'lab-01',
      code: 'LAB-EXT-01',
      canonicalName: 'Trung tâm Quatest 3',
      aliases: ['Quatest3', 'Trung tâm Kỹ thuật 3'],
      type: 'EXTERNAL',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockLabRepo = {
        findAll: vi.fn().mockResolvedValue([sampleLab]),
        findById: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      labService = new LaboratoryAppService(mockLabRepo);
    });

    it('từ chối phòng lab nếu thiếu ID, mã Code hoặc Tên chuẩn', () => {
      expect(() => LaboratoryRules.validate({ ...sampleLab, canonicalName: '' })).toThrow(
        /Yêu cầu đầy đủ ID, mã Code và Tên chuẩn hóa/
      );
    });

    it('tạo mới phòng lab thành công với vai trò QA/ADMIN', async () => {
      const created = await labService.createLaboratory(sampleLab, {
        actorId: 'qa-1',
        actorRole: 'QA',
        actorEmail: 'qa@pqm.com',
      });
      expect(created.id).toBe(sampleLab.id);
      expect(mockLabRepo.save).toHaveBeenCalledTimes(1);
    });

    it('chặn QA xóa phòng lab (chỉ ADMIN)', async () => {
      await expect(
        labService.deleteLaboratory('lab-01', {
          actorId: 'qa-1',
          actorRole: 'QA',
          reason: 'Lý do',
        })
      ).rejects.toThrow(/Chỉ Quản trị viên \(ADMIN\) mới có quyền xóa/);
    });
  });

  describe('4. MasterDataQueries', () => {
    it('cung cấp các phương thức truy vấn hợp lệ', () => {
      expect(typeof masterDataQueries.getAllCriteria).toBe('function');
      expect(typeof masterDataQueries.getActiveCriteria).toBe('function');
      expect(typeof masterDataQueries.getAllPharmacopoeiaStandards).toBe('function');
      expect(typeof masterDataQueries.getPharmacopoeiaStandardById).toBe('function');
      expect(typeof masterDataQueries.getAllLaboratories).toBe('function');
      expect(typeof masterDataQueries.getLaboratoryById).toBe('function');
    });
  });
});
