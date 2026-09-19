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
      findRecent: vi.fn().mockResolvedValue([]),
    };
    mockDeviationService = {
      autoLogFromOOS: vi.fn().mockResolvedValue(null),
    };
    service = new TestResultAppService(mockRepo, mockDeviationService);
  });

  describe('createTestResult', () => {
    it('should reject unauthorized users (VIEWER)', async () => {
      await expect(service.createTestResult(validTestResult, viewerUser)).rejects.toThrow(
        /Từ chối quyền/
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should reject missing batchId', async () => {
      const invalid = { ...validTestResult, batchId: '' };
      await expect(service.createTestResult(invalid, labUser)).rejects.toThrow(
        /gắn liền với một Lô/
      );
    });

    it('should reject missing labName', async () => {
      const invalid = { ...validTestResult, labName: '' };
      await expect(service.createTestResult(invalid, labUser)).rejects.toThrow(
        /Tên phòng kiểm nghiệm/
      );
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
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tr-001',
          overallStatus: 'FAIL',
        })
      );
      expect(mockDeviationService.autoLogFromOOS).toHaveBeenCalledWith(
        expect.objectContaining({ overallStatus: 'FAIL' }),
        undefined,
        qcUser
      );
    });

    it('should keep overallStatus as PASS when all criteria pass', async () => {
      await service.createTestResult(validTestResult, labUser);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tr-001',
          overallStatus: 'PASS',
        })
      );
      expect(mockDeviationService.autoLogFromOOS).not.toHaveBeenCalled();
    });
  });

  describe('updateTestResult', () => {
    it('should reject updating locked/approved test results for non-admin', async () => {
      const lockedResult: any = { ...validTestResult, status: 'APPROVED' };
      await expect(service.updateTestResult(lockedResult, qcUser, lockedResult)).rejects.toThrow(
        /Từ chối quyền/
      );
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should allow QC to update pending test result and re-evaluate overallStatus and trigger autoLogFromOOS if FAIL', async () => {
      const updated: TestResult = {
        ...validTestResult,
        results: [{ criteriaName: 'Độ ẩm', value: '12.0', isPass: false }],
      };
      await service.updateTestResult(updated, qcUser, validTestResult);
      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tr-001',
          overallStatus: 'FAIL',
        })
      );
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
      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 3,
        })
      );
    });
  });

  describe('deleteTestResult', () => {
    it('should reject unauthorized user (LAB/QC) from deleting test result', async () => {
      await expect(service.deleteTestResult('tr-001', labUser, validTestResult)).rejects.toThrow(
        /Từ chối quyền/
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('should block deleting APPROVED or RELEASED test results (ALCOA+ Immutability Guard)', async () => {
      const approvedResult: TestResult = {
        ...validTestResult,
        workflowStatus: 'APPROVED',
      };
      await expect(service.deleteTestResult('tr-001', adminUser, approvedResult)).rejects.toThrow(
        /Không thể xóa Phiếu kiểm nghiệm đã được phê duyệt/
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to delete DRAFT test result', async () => {
      const draftResult: TestResult = { ...validTestResult, workflowStatus: 'DRAFT' };
      await service.deleteTestResult('tr-001', adminUser, draftResult);
      expect(mockRepo.delete).toHaveBeenCalledWith('tr-001');
    });
  });

  describe('updateWorkflowStatus & Quality × Workflow Matrix', () => {
    const qaUser = { uid: 'u_qa', email: 'qa@pqm.com', role: 'QA' };

    it('should allow transition from DRAFT to SUBMITTED when quality is evaluated', async () => {
      const draftTR: TestResult = { ...validTestResult, workflowStatus: 'DRAFT' };
      await service.updateWorkflowStatus('tr-001', 'SUBMITTED', labUser, {
        oldTestResult: draftTR,
      });
      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ workflowStatus: 'SUBMITTED' })
      );
    });

    it('should reject SUBMITTED when qualityStatus is UNKNOWN (no criteria)', async () => {
      const emptyTR: TestResult = {
        ...validTestResult,
        workflowStatus: 'DRAFT',
        results: [],
        overallStatus: 'UNKNOWN',
      };
      await expect(
        service.updateWorkflowStatus('tr-001', 'SUBMITTED', labUser, { oldTestResult: emptyTR })
      ).rejects.toThrow(/Ma trận Chất lượng × Quy trình.*khi trạng thái chất lượng là UNKNOWN/);
    });

    it('should reject transition from FINAL to APPROVED by non-QA/Admin', async () => {
      const finalTR: TestResult = { ...validTestResult, workflowStatus: 'FINAL' };
      await expect(
        service.updateWorkflowStatus('tr-001', 'APPROVED', labUser, { oldTestResult: finalTR })
      ).rejects.toThrow(/Quy chuẩn State Machine Phiếu KN.*không có thẩm quyền/);
    });

    it('should allow QA to approve FINAL test result when quality is PASS', async () => {
      const finalTR: TestResult = { ...validTestResult, workflowStatus: 'FINAL' };
      await service.updateWorkflowStatus('tr-001', 'APPROVED', qaUser, { oldTestResult: finalTR });
      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ workflowStatus: 'APPROVED' })
      );
    });

    it('should strictly forbid transition to RELEASED when qualityStatus is FAIL (GMP Invariant)', async () => {
      const approvedFailTR: TestResult = {
        ...validTestResult,
        workflowStatus: 'APPROVED',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Độ ẩm', value: '15.0', isPass: false }],
      };
      await expect(
        service.updateWorkflowStatus('tr-001', 'RELEASED', qaUser, {
          oldTestResult: approvedFailTR,
        })
      ).rejects.toThrow(/BẤT BIẾN GMP: Tuyệt đối cấm xuất xưởng.*FAIL/);
    });

    it('should require reason when marking test result as SUPERSEDED', async () => {
      const finalTR: TestResult = { ...validTestResult, workflowStatus: 'FINAL' };
      await expect(
        service.updateWorkflowStatus('tr-001', 'SUPERSEDED', qaUser, {
          oldTestResult: finalTR,
          reason: '',
        })
      ).rejects.toThrow(/SUPERSEDED.*bắt buộc phải có lý do/);
    });

    it('should block any further transition from SUPERSEDED (Terminal State)', async () => {
      const supersededTR: TestResult = { ...validTestResult, workflowStatus: 'SUPERSEDED' };
      await expect(
        service.updateWorkflowStatus('tr-001', 'FINAL', qaUser, { oldTestResult: supersededTR })
      ).rejects.toThrow(/SUPERSEDED là trạng thái kết thúc bất biến — cấm chuyển đổi tiếp/);
    });
  });
});
