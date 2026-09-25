import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TCCSRules } from '../domain/rules';
import { TCCSAppService } from '../application/service';
import { TCCSQueries } from '../application/queries';
import { TCCS, Batch, CriteriaAlias, CriterionType } from '../domain/types';
import { createBaseMockRepository } from '../../../repositories/mockRepositoryHelper';
import {
  ITCCSRepository,
  ICriteriaAliasRepository,
  IAILearnedMappingRepository,
} from '../infrastructure/repository';

vi.mock('../../../services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

describe('TCCS Domain - Vertical Slice 3 (High-GMP)', () => {
  let mockTccsRepo: ITCCSRepository;
  let mockAliasRepo: ICriteriaAliasRepository;
  let mockAiRepo: IAILearnedMappingRepository;
  let service: TCCSAppService;
  let queries: TCCSQueries;

  const sampleTCCS: TCCS = {
    id: 'tccs_001',
    code: 'TCCS-01-PARA',
    productId: 'prod_para_500',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      {
        id: 'crit_1',
        name: 'Định lượng Paracetamol',
        type: CriterionType.NUMBER,
        min: 95,
        max: 105,
        unit: '%',
      },
    ],
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const adminUser = {
    id: 'usr_admin',
    displayName: 'QA Manager',
    role: 'ADMIN',
    permissions: ['tccs:create', 'tccs:update', 'tccs:delete'],
  };

  const readOnlyUser = {
    id: 'usr_viewer',
    displayName: 'Viewer User',
    role: 'VIEWER',
    permissions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const baseTccs = createBaseMockRepository<TCCS>();
    mockTccsRepo = {
      ...baseTccs,
      findAll: vi.fn(async () => [sampleTCCS]),
      findById: vi.fn(async (id: string) => (id === sampleTCCS.id ? sampleTCCS : null)),
      findByCode: vi.fn(async (code: string) => (code === sampleTCCS.code ? sampleTCCS : null)),
      findByProductId: vi.fn(async (pId: string) =>
        pId === sampleTCCS.productId ? [sampleTCCS] : []
      ),
      findActiveByProductId: vi.fn(async (pId: string) =>
        pId === sampleTCCS.productId ? sampleTCCS : null
      ),
      batchUpdate: vi.fn().mockResolvedValue(undefined),
    };

    const baseAlias = createBaseMockRepository<CriteriaAlias>();
    mockAliasRepo = {
      ...baseAlias,
      findByTccsId: vi.fn(async () => []),
      findByCanonicalName: vi.fn(async () => null),
    };

    const baseAi = createBaseMockRepository<any>();
    mockAiRepo = {
      ...baseAi,
      findByOriginalName: vi.fn(async () => null),
      findByRawName: vi.fn(async () => null),
    };

    service = new TCCSAppService(mockTccsRepo, mockAliasRepo, mockAiRepo);
    queries = new TCCSQueries(mockTccsRepo);
  });

  describe('Pure Domain Rules', () => {
    it('should validate valid TCCS', () => {
      const res = TCCSRules.validate({ code: 'TCCS-01', productId: 'prod_1' });
      expect(res.valid).toBe(true);
    });

    it('should reject TCCS with empty code', () => {
      const res = TCCSRules.validate({ code: '', productId: 'prod_1' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Mã TCCS không được để trống');
    });

    it('should reject TCCS without productId', () => {
      const res = TCCSRules.validate({ code: 'TCCS-01' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('liên kết với một sản phẩm');
    });

    it('should detect if TCCS is bound to any batch', () => {
      const batches = [
        {
          id: 'batch_1',
          batchNumber: 'LOT-2026-001',
          productId: 'prod_1',
          tccsId: 'tccs_001',
          status: 'IN_PROCESS',
        } as unknown as Batch,
      ];
      expect(TCCSRules.isBoundToBatch('tccs_001', batches)).toBe(true);
      expect(TCCSRules.isBoundToBatch('tccs_999', batches)).toBe(false);
    });

    it('should resolve latest active TCCS ID based on issueDate', () => {
      const list: TCCS[] = [
        { id: 'v1', issueDate: '2025-01-01' } as TCCS,
        { id: 'v2', issueDate: '2026-05-01' } as TCCS,
        { id: 'v3', issueDate: '2026-02-01' } as TCCS,
      ];
      expect(TCCSRules.resolveLatestActiveId(list)).toBe('v2');
      expect(TCCSRules.resolveLatestActiveId([])).toBeNull();
    });
  });

  describe('TCCS Application Service', () => {
    it('should reject createTCCS if user lacks permission', async () => {
      await expect(service.createTCCS(sampleTCCS, [], readOnlyUser)).rejects.toThrow(
        'Bạn không có quyền tạo mới Tiêu chuẩn cơ sở'
      );
    });

    it('should dispatch TCCS_CREATE and set isActive to true for single version', async () => {
      await service.createTCCS(sampleTCCS, [], adminUser);
      expect(mockTccsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tccs_001', isActive: true })
      );
    });

    it('should block deleteTCCS if TCCS is bound to a batch', async () => {
      const batches = [
        {
          id: 'b1',
          batchNumber: 'LOT-1',
          tccsId: 'tccs_001',
        } as unknown as Batch,
      ];
      await expect(service.deleteTCCS('tccs_001', batches, adminUser)).rejects.toThrow(
        'đang liên kết với ít nhất một lô sản xuất'
      );
      expect(mockTccsRepo.delete).not.toHaveBeenCalled();
    });

    it('should delete TCCS and clean up orphan aliases when unbound', async () => {
      const existingAliases: CriteriaAlias[] = [
        { id: 'alias_1', tccsId: 'tccs_001', canonicalName: 'Định lượng' } as CriteriaAlias,
        { id: 'alias_2', tccsId: 'other_tccs', canonicalName: 'Độ tan' } as CriteriaAlias,
      ];

      await service.deleteTCCS('tccs_001', [], adminUser, 'TCCS-01-PARA', existingAliases);
      expect(mockTccsRepo.delete).toHaveBeenCalledWith('tccs_001');
      expect(mockAliasRepo.delete).toHaveBeenCalledWith('alias_1');
      expect(mockAliasRepo.delete).not.toHaveBeenCalledWith('alias_2');
    });
  });

  describe('TCCS Queries', () => {
    it('should return all TCCS', async () => {
      const all = await queries.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].code).toBe('TCCS-01-PARA');
    });

    it('should get active TCCS by product ID', async () => {
      const active = await queries.getActiveByProductId('prod_para_500');
      expect(active).not.toBeNull();
      expect(active?.id).toBe('tccs_001');
    });
  });
});
