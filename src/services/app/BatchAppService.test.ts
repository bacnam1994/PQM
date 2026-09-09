import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchAppService } from './BatchAppService';
import { IBatchRepository } from '../../repositories/BatchRepository';
import { Batch, TestResult } from '../../types';

vi.mock('../auditService', () => ({
  logAuditAction: vi.fn(),
}));

vi.mock('../signatureService', () => ({
  signatureService: {
    verifySignatureIntegrity: vi.fn().mockImplementation(async (sig: any) => sig?.checksum === 'valid-checksum'),
  },
}));

describe('BatchAppService', () => {
  let service: BatchAppService;
  let mockRepo: IBatchRepository;

  const adminUser = { uid: 'u_admin', email: 'admin@pqm.com', role: 'ADMIN', isAdmin: true };
  const qaUser = { uid: 'u_qa', email: 'qa@pqm.com', role: 'QA' };
  const prodUser = { uid: 'u_prod', email: 'prod@pqm.com', role: 'PRODUCTION' };
  const viewerUser = { uid: 'u_viewer', email: 'viewer@pqm.com', role: 'VIEWER' };

  const validBatch: Batch = {
    id: 'batch-001',
    productId: 'prod-001',
    tccsId: 'tccs-001',
    batchNo: 'LOT-2026-001',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    theoreticalYield: 1000,
    actualYield: 980,
    yieldUnit: 'Hộp',
    status: 'PENDING',
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      findByBatchNo: vi.fn().mockResolvedValue(null),
      findByProductId: vi.fn().mockResolvedValue([]),
      findByStatus: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    service = new BatchAppService(mockRepo);
  });

  describe('createBatch', () => {
    it('should reject unauthorized users (VIEWER)', async () => {
      await expect(service.createBatch(validBatch, viewerUser)).rejects.toThrow(/Từ chối quyền/);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should reject missing batchNo', async () => {
      const invalid = { ...validBatch, batchNo: '' };
      await expect(service.createBatch(invalid, prodUser)).rejects.toThrow(/Số lô sản xuất không được để trống/);
    });

    it('should reject missing productId', async () => {
      const invalid = { ...validBatch, productId: '' };
      await expect(service.createBatch(invalid, prodUser)).rejects.toThrow(/Vui lòng chọn sản phẩm/);
    });

    it('should reject duplicate batchNo within existing batches', async () => {
      const existing: Batch[] = [{ ...validBatch, id: 'batch-old', batchNo: 'LOT-2026-001' }];
      await expect(service.createBatch(validBatch, prodUser, existing)).rejects.toThrow(/đã tồn tại/);
    });

    it('should reject expDate earlier than mfgDate', async () => {
      const invalid = { ...validBatch, mfgDate: '2026-06-01', expDate: '2026-01-01' };
      await expect(service.createBatch(invalid, prodUser)).rejects.toThrow(/Hạn dùng không được trước ngày sản xuất/);
    });

    it('should reject negative yields', async () => {
      const invalid = { ...validBatch, actualYield: -5 };
      await expect(service.createBatch(invalid, prodUser)).rejects.toThrow(/không thể là số âm/);
    });

    it('should successfully create batch for authorized user and set default version 1', async () => {
      await service.createBatch(validBatch, prodUser);
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'batch-001',
        batchNo: 'LOT-2026-001',
        status: 'PENDING',
        version: 1,
      }));
    });

    it('should capture schema snapshots (TCCS & Formula) during batch creation', async () => {
      const mockTCCS: any = { id: 'tccs-001', code: 'TCCS-GINKGO-01', isActive: true };
      const mockFormula: any = { id: 'formula-001', productId: 'prod-001', ingredients: [] };

      await service.createBatch(validBatch, prodUser, [], {
        activeTCCS: mockTCCS,
        productFormula: mockFormula,
      });

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'batch-001',
        version: 1,
        tccsSnapshot: mockTCCS,
        formulaSnapshot: mockFormula,
      }));
    });
  });

  describe('updateBatch & Optimistic Concurrency Control (OCC)', () => {
    it('should reject editing a RELEASED batch if not ADMIN', async () => {
      const releasedBatch: Batch = { ...validBatch, status: 'RELEASED' };
      await expect(service.updateBatch(releasedBatch, prodUser, releasedBatch)).rejects.toThrow(/Từ chối quyền/);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to update a RELEASED batch', async () => {
      const releasedBatch: Batch = { ...validBatch, status: 'RELEASED' };
      await service.updateBatch(releasedBatch, adminUser, releasedBatch);
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('should reject update if incoming version is older than current version (OCC Conflict)', async () => {
      const serverBatch: Batch = { ...validBatch, version: 3 };
      const staleIncomingBatch: Batch = { ...validBatch, version: 1 };

      await expect(
        service.updateBatch(staleIncomingBatch, prodUser, serverBatch)
      ).rejects.toThrow(/đã được cập nhật bởi một phiên làm việc khác/);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should increment version on successful update', async () => {
      const currentBatch: Batch = { ...validBatch, version: 2 };
      const incomingBatch: Batch = { ...validBatch, version: 2, batchNo: 'LOT-2026-001-REV' };

      await service.updateBatch(incomingBatch, prodUser, currentBatch);
      expect(mockRepo.update).toHaveBeenCalledWith(expect.objectContaining({
        version: 3,
        batchNo: 'LOT-2026-001-REV',
      }));
    });
  });

  describe('updateStatus & Release Guard', () => {
    it('should block non-QA/Admin users from releasing a batch', async () => {
      await expect(
        service.updateStatus('batch-001', 'RELEASED', prodUser, { currentBatch: validBatch })
      ).rejects.toThrow(/Chỉ bộ phận QA hoặc Quản trị viên/);
      expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should block release when there are failed test results (GMP Release Guard)', async () => {
      const failedTestResult: TestResult = {
        id: 'tr-01',
        batchId: 'batch-001',
        labName: 'Lab QC',
        testDate: '2026-01-10',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Độ ẩm', value: '12%', isPass: false }],
        createdAt: '2026-01-10T00:00:00Z',
      };

      await expect(
        service.updateStatus('batch-001', 'RELEASED', qaUser, {
          currentBatch: validBatch,
          batchTestResults: [failedTestResult],
        })
      ).rejects.toThrow(/Không thể duyệt xuất xưởng lô có kết quả kiểm nghiệm KHÔNG ĐẠT/);
      expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should allow QA to release when all test results pass', async () => {
      const passedTestResult: TestResult = {
        id: 'tr-01',
        batchId: 'batch-001',
        labName: 'Lab QC',
        testDate: '2026-01-10',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'Độ ẩm', value: '4%', isPass: true }],
        createdAt: '2026-01-10T00:00:00Z',
      };

      await service.updateStatus('batch-001', 'RELEASED', qaUser, {
        currentBatch: validBatch,
        batchTestResults: [passedTestResult],
      });
      expect(mockRepo.updateStatus).toHaveBeenCalledWith('batch-001', 'RELEASED', undefined);
    });

    it('should reject release when requireSignature is true but signature is missing', async () => {
      await expect(
        service.updateStatus('batch-001', 'RELEASED', qaUser, {
          currentBatch: validBatch,
          requireSignature: true,
        })
      ).rejects.toThrow(/Yêu cầu chữ ký điện tử hợp lệ/);
    });

    it('should reject release when signature documentId does not match batchId', async () => {
      const mismatchSig: any = {
        id: 'sig-01',
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-999', // Mismatched ID
        checksum: 'valid-checksum',
      };

      await expect(
        service.updateStatus('batch-001', 'RELEASED', qaUser, {
          currentBatch: validBatch,
          signature: mismatchSig,
        })
      ).rejects.toThrow(/không khớp với Lô sản xuất/);
    });

    it('should allow release when valid electronic signature is provided', async () => {
      const validSig: any = {
        id: 'sig-01',
        documentType: 'BATCH_RELEASE',
        documentId: 'batch-001',
        signerEmail: 'qa@pqm.com',
        checksum: 'valid-checksum',
      };

      await service.updateStatus('batch-001', 'RELEASED', qaUser, {
        currentBatch: validBatch,
        signature: validSig,
      });

      expect(mockRepo.updateStatus).toHaveBeenCalledWith('batch-001', 'RELEASED', undefined);
    });
  });

  describe('deleteBatch', () => {
    it('should reject non-ADMIN users from deleting batch', async () => {
      await expect(service.deleteBatch('batch-001', qaUser)).rejects.toThrow(/Chỉ Quản trị viên/);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to delete batch', async () => {
      await service.deleteBatch('batch-001', adminUser, 'LOT-2026-001');
      expect(mockRepo.delete).toHaveBeenCalledWith('batch-001');
    });
  });
});
