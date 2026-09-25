import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchRules } from '../domain/rules';
import { BatchAppService } from '../application/service';
import { ReleaseService } from '../application/releaseService';
import { BatchQueries } from '../application/queries';
import { Batch, TestResult, TCCS } from '../domain/types';
import { createBaseMockRepository } from '../../../repositories/mockRepositoryHelper';
import { IBatchRepository } from '../infrastructure/repository';

vi.mock('../../../services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/signatureService', () => ({
  signatureService: {
    verifySignature: vi.fn().mockResolvedValue({ isValid: true }),
  },
}));

describe('Batch Domain - Vertical Slice 5 (Core GMP)', () => {
  let mockRepo: IBatchRepository;
  let service: BatchAppService;
  let releaseService: ReleaseService;
  let queries: BatchQueries;

  const sampleBatch: Batch = {
    id: 'batch_001',
    productId: 'prod_001',
    tccsId: 'tccs_001',
    batchNo: 'LOT-2026-001',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    status: 'TESTING',
    qualityStatus: 'PENDING',
    theoreticalYield: 100000,
    actualYield: 99500,
    yieldUnit: 'viên',
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const adminUser = {
    id: 'usr_admin',
    displayName: 'Admin QA',
    role: 'ADMIN',
    permissions: ['batch:create', 'batch:update', 'batch:release', 'batch:delete'],
  };

  const readOnlyUser = {
    id: 'usr_viewer',
    displayName: 'Viewer User',
    role: 'VIEWER',
    permissions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const base = createBaseMockRepository<Batch>();
    mockRepo = {
      ...base,
      findAll: vi.fn(async () => [sampleBatch]),
      findById: vi.fn(async (id: string) => (id === sampleBatch.id ? sampleBatch : null)),
      findByBatchNo: vi.fn(async (no: string) => (no === sampleBatch.batchNo ? sampleBatch : null)),
      findByProductId: vi.fn(async (pId: string) =>
        pId === sampleBatch.productId ? [sampleBatch] : []
      ),
      findByStatus: vi.fn(async (st: Batch['status']) =>
        st === sampleBatch.status ? [sampleBatch] : []
      ),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };

    service = new BatchAppService(mockRepo);
    releaseService = new ReleaseService();
    queries = new BatchQueries(mockRepo);
  });

  describe('Pure Domain Rules', () => {
    it('should validate valid batch metadata', () => {
      const res = BatchRules.validateBatchMetadata({
        batchNo: 'LOT-01',
        productId: 'prod_1',
        mfgDate: '2026-01-01',
        expDate: '2028-01-01',
      });
      expect(res.isValid).toBe(true);
    });

    it('should reject batch metadata when expDate is before mfgDate', () => {
      const res = BatchRules.validateBatchMetadata({
        batchNo: 'LOT-01',
        productId: 'prod_1',
        mfgDate: '2028-01-01',
        expDate: '2026-01-01',
      });
      expect(res.isValid).toBe(false);
    });
  });

  describe('Batch Application Service', () => {
    it('should reject createBatch if user lacks permission', async () => {
      await expect(service.createBatch(sampleBatch, readOnlyUser)).rejects.toThrow(
        'Bạn không có quyền tạo lô sản xuất mới'
      );
    });

    it('should reject updateBatch when attempting to mutate workflow status directly', async () => {
      const modifiedBatch: Batch = {
        ...sampleBatch,
        status: 'RELEASED',
      };
      await expect(service.updateBatch(modifiedBatch, adminUser, sampleBatch)).rejects.toThrow(
        'Không được thay đổi Workflow Status thông qua updateBatch()'
      );
    });

    it('should block deleteBatch if batch is already RELEASED', async () => {
      const releasedBatch: Batch = { ...sampleBatch, status: 'RELEASED' };
      mockRepo.findById = vi.fn().mockResolvedValue(releasedBatch);

      await expect(service.deleteBatch('batch_001', adminUser)).rejects.toThrow(
        'Không thể xóa Lô đã xuất xưởng (RELEASED)'
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('Release Service & 7 Release Gates', () => {
    it('should reject releaseBatch when user lacks batch:release permission', async () => {
      await expect(
        releaseService.releaseBatch({
          batchId: 'batch_001',
          currentBatch: sampleBatch,
          testResults: [],
          currentUser: readOnlyUser,
        })
      ).rejects.toThrow('Chỉ QA hoặc Quản trị viên (ADMIN) mới có thẩm quyền xuất xưởng Lô');
    });

    it('should reject releaseBatch when release prerequisites/gates fail (PENDING qualityStatus)', async () => {
      await expect(
        releaseService.releaseBatch({
          batchId: 'batch_001',
          currentBatch: sampleBatch,
          testResults: [],
          currentUser: adminUser,
        })
      ).rejects.toThrow('Từ chối xuất xưởng: Còn rào cản chưa thỏa mãn');
    });
  });

  describe('Batch Queries', () => {
    it('should query all batches', async () => {
      const all = await queries.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].batchNo).toBe('LOT-2026-001');
    });

    it('should find batch by batchNo', async () => {
      const found = await queries.getByBatchNo('LOT-2026-001');
      expect(found).not.toBeNull();
      expect(found?.productId).toBe('prod_001');
    });
  });
});
