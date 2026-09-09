import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestResultAppService } from './TestResultAppService';
import { ITestResultRepository } from '../../repositories/TestResultRepository';
import { createBaseMockRepository } from '../../repositories/mockRepositoryHelper';
import { TestResult } from '../../types';

vi.mock('../auditService', () => ({
  logAuditAction: vi.fn(),
}));

describe('TestResultAppService', () => {
  let service: TestResultAppService;
  let mockRepo: ITestResultRepository;
  let mockDeviationService: any;

  const adminUser = { uid: 'u_admin', email: 'admin@pqm.com', role: 'ADMIN', isAdmin: true };
  const qcUser = { uid: 'u_qc', email: 'qc@pqm.com', role: 'QC' };
  const labUser = { uid: 'u_lab', email: 'lab@pqm.com', role: 'LAB' };
  const viewerUser = { uid: 'u_viewer', email: 'viewer@pqm.com', role: 'VIEWER' };

  const validTestResult: TestResult = {
    id: 'tr-001',
    batchId: 'batch-001',
    labName: 'Phòng Kiểm nghiệm Trung tâm',
    testDate: '2026-02-01',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Độ ẩm', value: '4.5', isPass: true, limit: '<= 9.0%' },
      { criteriaName: 'Định lượng Ginkgo', value: '24.2', isPass: true, limit: '22.0 - 27.0%' },
    ],
    createdAt: '2026-02-01T00:00:00Z',
  };

  beforeEach(() => {
    mockRepo = {
      ...createBaseMockRepository<TestResult>(),
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      findByBatchId: vi.fn().mockResolvedValue([]),
      findByOverallStatus: vi.fn().mockResolvedValue([]),
      findRecent: vi.fn().mockResolvedValue([])
    };
    mockDeviationService = {
      autoLogFromOOS: vi.fn().mockResolvedValue(null),
    };
    service = new TestResultAppService(mockRepo, mockDeviationService);
  });

  describe('createTestResult', () => {
    it('should reject unauthorized users (VIEWER)', async () => {
      await expect(service.createTestResult(validTestResult, viewerUser)).rejects.toThrow(/Từ chối quyền/);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should reject missing batchId', async () => {
      const invalid = { ...validTestResult, batchId: '' };
      await expect(service.createTestResult(invalid, labUser)).rejects.toThrow(/gắn liền với một Lô/);
    });

    it('should reject missing labName', async () => {
      const invalid = { ...validTestResult, labName: '' };
      await expect(service.createTestResult(invalid, labUser)).rejects.toThrow(/Tên phòng kiểm nghiệm/);
    });

    it('should reject missing testDate', async () => {
      const invalid = { ...validTestResult, testDate: '' };
      await expect(service.createTestResult(invalid, labUser)).rejects.toThrow(/Ngày kiểm nghiệm/);
    });

    it('should automatically set overallStatus to FAIL if any criterion isPass is false', async () => {
      const withFail: TestResult = {
        ...validTestResult,
        overallStatus: 'PASS', // User mistakenly set to PASS
        results: [
          { criteriaName: 'Độ ẩm', value: '11.5', isPass: false },
          { criteriaName: 'Định lượng Ginkgo', value: '24.2', isPass: true },
        ],
      };

      await service.createTestResult(withFail, qcUser);
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'tr-001',
        overallStatus: 'FAIL',
      }));
      expect(mockDeviationService.autoLogFromOOS).toHaveBeenCalledWith(
        expect.objectContaining({ overallStatus: 'FAIL' }),
        undefined,
        qcUser
      );
    });

    it('should keep overallStatus as PASS when all criteria pass', async () => {
      await service.createTestResult(validTestResult, labUser);
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'tr-001',
        overallStatus: 'PASS',
      }));
      expect(mockDeviationService.autoLogFromOOS).not.toHaveBeenCalled();
    });
  });

  describe('updateTestResult', () => {
    it('should reject updating locked/approved test results for non-admin', async () => {
      const lockedResult: any = { ...validTestResult, status: 'APPROVED' };
      await expect(
        service.updateTestResult(lockedResult, qcUser, lockedResult)
      ).rejects.toThrow(/Từ chối quyền/);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should allow QC to update pending test result and re-evaluate overallStatus and trigger autoLogFromOOS if FAIL', async () => {
      const updated: TestResult = {
        ...validTestResult,
        results: [
          { criteriaName: 'Độ ẩm', value: '12.0', isPass: false },
        ],
      };
      await service.updateTestResult(updated, qcUser, validTestResult);
      expect(mockRepo.update).toHaveBeenCalledWith(expect.objectContaining({
        id: 'tr-001',
        overallStatus: 'FAIL',
      }));
      expect(mockDeviationService.autoLogFromOOS).toHaveBeenCalledWith(
        expect.objectContaining({ overallStatus: 'FAIL' }),
        undefined,
        qcUser
      );
    });

    it('should reject updating test result if incoming version is older than current version (OCC Conflict)', async () => {
      const currentServerResult: TestResult = { ...validTestResult, version: 3 };
      const staleIncomingResult: TestResult = { ...validTestResult, version: 1 };

      await expect(
        service.updateTestResult(staleIncomingResult, qcUser, currentServerResult)
      ).rejects.toThrow(/đã được cập nhật bởi một phiên làm việc khác/);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should increment version on successful update of test result', async () => {
      const currentResult: TestResult = { ...validTestResult, version: 2 };
      const incomingResult: TestResult = { ...validTestResult, version: 2 };

      await service.updateTestResult(incomingResult, qcUser, currentResult);
      expect(mockRepo.update).toHaveBeenCalledWith(expect.objectContaining({
        version: 3,
      }));
    });
  });

  describe('deleteTestResult', () => {
    it('should reject unauthorized user (LAB/QC) from deleting test result', async () => {
      await expect(service.deleteTestResult('tr-001', labUser, validTestResult)).rejects.toThrow(/Từ chối quyền/);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to delete test result', async () => {
      await service.deleteTestResult('tr-001', adminUser, validTestResult);
      expect(mockRepo.delete).toHaveBeenCalledWith('tr-001');
    });
  });
});
