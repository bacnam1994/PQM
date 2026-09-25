/**
 * PHASE 2 VERTICAL SLICES INTEGRATION TESTS
 *
 * Kiểm tra tích hợp End-to-End hai luồng nghiệp vụ rủi ro cao GMP:
 * 1. Phân hệ Test Result & Quality / OOS
 * 2. Phân hệ Batch & Release Gate / Recall
 *
 * Tiêu chí kiểm định:
 * - Điều phối đồng nhất qua WorkflowFacade
 * - Thực thi toàn bộ rào chắn (RBAC, OCC, Reason, 21 CFR Part 11 Signature, Confirmation Token)
 * - ALCOA+ Fail-Closed Audit Trail đồng bộ qua OutboxAuditQueue
 * - Telemetry & Feature Flag Cutover
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowFacade } from '../../src/workflow/WorkflowFacade';
import { OutboxAuditQueue } from '../../src/workflow/events/outboxAuditQueue';
import { WorkflowTelemetry } from '../../src/workflow/observability/workflowTelemetry';
import { TestResultWorkflowHandlers } from '../../src/workflow/handlers/testResultWorkflowHandlers';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import {
  setWorkflowFeatureFlag,
  resetWorkflowFeatureFlags,
} from '../../src/workflow/contracts/featureFlags';
import { TestResult, Batch, ElectronicSignature } from '../../src/types';

vi.mock('../../src/services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/signatureService', () => ({
  signatureService: {
    verifySignatureIntegrity: vi
      .fn()
      .mockImplementation(async (sig: any) => sig?.checksum === 'valid-checksum'),
  },
}));

describe('Phase 2 Vertical Slices: Test Result & Batch Workflows', () => {
  const adminActor = { id: 'usr_admin', name: 'Admin User', role: 'ADMIN', email: 'admin@pqm.com' };
  const qaActor = { id: 'usr_qa', name: 'QA Specialist', role: 'QA', email: 'qa@pqm.com' };
  const qcActor = { id: 'usr_qc', name: 'QC Analyst', role: 'QC', email: 'qc@pqm.com' };
  const labActor = { id: 'usr_lab', name: 'Lab Technician', role: 'LAB', email: 'lab@pqm.com' };
  const viewerActor = {
    id: 'usr_viewer',
    name: 'Guest Viewer',
    role: 'VIEWER',
    email: 'viewer@pqm.com',
  };

  let mockTRRepo: any;
  let mockBatchRepo: any;
  let mockDeviationService: any;
  let testResultHandlers: TestResultWorkflowHandlers;
  let batchHandlers: BatchWorkflowHandlers;

  beforeEach(() => {
    resetWorkflowFeatureFlags();
    OutboxAuditQueue.clear();
    WorkflowTelemetry.clear();
    vi.clearAllMocks();

    mockTRRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
    };

    mockDeviationService = {
      autoLogFromOOS: vi.fn().mockResolvedValue(null),
    };

    mockBatchRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
    };

    testResultHandlers = new TestResultWorkflowHandlers(mockTRRepo, mockDeviationService);
    batchHandlers = new BatchWorkflowHandlers(mockBatchRepo);
  });

  // =========================================================================
  // SLICE 1: TEST RESULT & QUALITY / OOS
  // =========================================================================
  describe('Vertical Slice 1: Test Result & Quality Evaluation', () => {
    const mockBatch: Batch = {
      id: 'batch_2026_001',
      batchNo: 'LOT-2026-001',
      productId: 'prod_ginkgo',
      tccsId: 'tccs_ginkgo_v1',
      status: 'TESTING',
      version: 1,
    };

    const validTestResult: TestResult = {
      id: 'tr_2026_001',
      batchId: 'batch_2026_001',
      tccsId: 'tccs_ginkgo_v1',
      labName: 'Phòng Lab Vi sinh - Hóa lý',
      testDate: '2026-02-15',
      workflowStatus: 'DRAFT',
      version: 1,
      results: [
        { criteriaName: 'Độ ẩm', value: '5.2', isPass: true, limit: '<= 9.0%' },
        {
          criteriaName: 'Định lượng hoạt chất',
          value: '25.4',
          isPass: true,
          limit: '22.0 - 28.0%',
        },
      ],
    };

    it('TEST_RESULT_CREATE: Cho phép LAB/QC/QA tạo mới và tự động ghi Outbox Audit Trail', async () => {
      const created = await testResultHandlers.handleCreate(validTestResult, qcActor, {
        batch: mockBatch,
      });

      expect(created.id).toBe('tr_2026_001');
      expect(created.overallStatus).toBe('PASS');
      expect(created.evaluationSnapshot).toBeDefined();
      expect(created.evaluationSnapshot?.evaluationHash).toBeDefined();
      expect(mockTRRepo.save).toHaveBeenCalled();

      // Kiểm tra Outbox Audit
      const auditQueue = OutboxAuditQueue.getQueue();
      const lastAudit = auditQueue.find(
        (e) => e.entityId === 'tr_2026_001' && e.actionId === 'TEST_RESULT_CREATE'
      );
      expect(lastAudit).toBeDefined();
      expect(lastAudit?.actor.role).toBe('QC');
    });

    it('TEST_RESULT_CREATE: Chặn VIEWER không có quyền tạo phiếu kiểm nghiệm (RoleRBACGuard)', async () => {
      await expect(
        testResultHandlers.handleCreate(validTestResult, viewerActor, { batch: mockBatch })
      ).rejects.toThrow(/không được phép thực hiện hành động/);
    });

    it('TEST_RESULT_ENTRY_INPUT: Cập nhật kết quả, bảo vệ OCC và tăng version', async () => {
      const updatedData: TestResult = {
        ...validTestResult,
        version: 1,
        results: [{ criteriaName: 'Độ ẩm', value: '6.0', isPass: true, limit: '<= 9.0%' }],
      };

      const result = await testResultHandlers.handleUpdate(updatedData, qcActor, validTestResult, {
        batch: mockBatch,
      });

      expect(result.version).toBe(2);
      expect(result.updatedAt).toBeDefined();
      expect(mockTRRepo.update).toHaveBeenCalled();
    });

    it('TEST_RESULT_SUBMIT: Chuyển trạng thái sang SUBMITTED', async () => {
      mockTRRepo.findById.mockResolvedValue(validTestResult);

      const submitted = await testResultHandlers.handleWorkflowStatusTransition(
        'tr_2026_001',
        'SUBMITTED',
        labActor,
        { oldTestResult: validTestResult, batch: mockBatch }
      );

      expect(submitted.workflowStatus).toBe('SUBMITTED');
      expect(mockTRRepo.update).toHaveBeenCalled();
    });

    it('TEST_RESULT_APPROVE: QA phê duyệt kèm Chữ ký số 21 CFR Part 11 hợp lệ', async () => {
      const submittedResult: TestResult = {
        ...validTestResult,
        workflowStatus: 'FINAL',
      };
      mockTRRepo.findById.mockResolvedValue(submittedResult);

      const validSig: ElectronicSignature = {
        id: 'sig_tr_001',
        documentType: 'TEST_RESULT_APPROVAL',
        documentId: 'tr_2026_001',
        signerUid: qaActor.id,
        signerName: qaActor.name,
        signerEmail: qaActor.email,
        role: 'QA',
        meaning: 'Phê duyệt kết quả kiểm nghiệm thành phẩm',
        signedAt: new Date().toISOString(),
        checksum: 'valid-checksum',
      };

      const approved = await testResultHandlers.handleWorkflowStatusTransition(
        'tr_2026_001',
        'APPROVED',
        qaActor,
        {
          oldTestResult: submittedResult,
          signature: validSig,
          requireSignature: true,
        }
      );

      expect(approved.workflowStatus).toBe('APPROVED');
      expect(mockTRRepo.update).toHaveBeenCalled();
    });

    it('TEST_RESULT_REVOKE: Thu hồi phiếu đã duyệt yêu cầu lý do và chữ ký số QA', async () => {
      const approvedResult: TestResult = {
        ...validTestResult,
        workflowStatus: 'APPROVED',
      };
      mockTRRepo.findById.mockResolvedValue(approvedResult);

      // Thiếu lý do -> Bị chặn
      await expect(
        testResultHandlers.handleWorkflowStatusTransition('tr_2026_001', 'SUPERSEDED', qaActor, {
          oldTestResult: approvedResult,
          reason: '',
        })
      ).rejects.toThrow(/bắt buộc phải có lý do giải trình/);

      const validRevokeSig: ElectronicSignature = {
        id: 'sig_tr_revoke_001',
        documentType: 'TEST_RESULT',
        documentId: 'tr_2026_001',
        signerUid: qaActor.id,
        signerName: qaActor.name,
        signerEmail: qaActor.email,
        role: 'QA',
        meaning: 'Thu hồi phiếu kiểm nghiệm',
        signedAt: new Date().toISOString(),
        checksum: 'valid-checksum',
      };

      const revoked = await testResultHandlers.handleWorkflowStatusTransition(
        'tr_2026_001',
        'SUPERSEDED',
        qaActor,
        {
          oldTestResult: approvedResult,
          reason: 'Thu hồi do phát hiện hiệu chuẩn thiết bị HPLC bị lệch',
          signature: validRevokeSig,
        }
      );

      expect(revoked.workflowStatus).toBe('SUPERSEDED');
    });

    it('TEST_RESULT_DELETE: Chặn xóa phiếu đã APPROVED / RELEASED (ALCOA+ Immutability)', async () => {
      const approvedResult: TestResult = {
        ...validTestResult,
        workflowStatus: 'APPROVED',
      };

      await expect(
        testResultHandlers.handleDelete('tr_2026_001', adminActor, approvedResult)
      ).rejects.toThrow(/Không thể xóa Phiếu kiểm nghiệm đã được phê duyệt/);
    });
  });

  // =========================================================================
  // SLICE 2: BATCH & RELEASE GATE / RECALL
  // =========================================================================
  describe('Vertical Slice 2: Batch Lifecycle & 7 Release Gates', () => {
    const validBatch: Batch = {
      id: 'batch_slice_002',
      batchNo: 'LOT-2026-SLICE-02',
      productId: 'prod_vitamin_c',
      tccsId: 'tccs_vit_c',
      status: 'PENDING',
      version: 1,
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      theoreticalYield: 5000,
      actualYield: 4950,
      yieldUnit: 'Chai',
    };

    it('BATCH_CREATE: Khởi tạo Lô luôn ở trạng thái PENDING và đóng băng Snapshot', async () => {
      const mockTCCS: any = { id: 'tccs_vit_c', code: 'TCCS-VIT-C-01', version: '1.0' };
      const created = await batchHandlers.handleCreate(validBatch, adminActor, [], {
        activeTCCS: mockTCCS,
      });

      expect(created.status).toBe('PENDING');
      expect(created.version).toBe(1);
      expect(created.tccsSnapshot).toEqual(mockTCCS);
      expect(mockBatchRepo.save).toHaveBeenCalled();

      const lastAudit = OutboxAuditQueue.getQueue().find(
        (e) => e.entityId === 'batch_slice_002' && e.actionId === 'BATCH_CREATE'
      );
      expect(lastAudit).toBeDefined();
    });

    it('BATCH_UPDATE_METADATA: Cập nhật thông tin có bảo vệ OCC', async () => {
      const updated = await batchHandlers.handleUpdate(
        { ...validBatch, actualYield: 4980 },
        adminActor,
        validBatch
      );

      expect(updated.version).toBe(2);
      expect(updated.actualYield).toBe(4980);
      expect(mockBatchRepo.update).toHaveBeenCalled();
    });

    it('BATCH_DISPATCH_TESTING: Chuyển Lô từ PENDING sang TESTING', async () => {
      mockBatchRepo.findById.mockResolvedValue(validBatch);

      const dispatched = await batchHandlers.handleStatusTransition(
        'batch_slice_002',
        'TESTING',
        qaActor,
        { currentBatch: validBatch }
      );

      expect(dispatched.status).toBe('TESTING');
      expect(mockBatchRepo.updateStatus).toHaveBeenCalledWith(
        'batch_slice_002',
        'TESTING',
        undefined
      );
    });

    it('BATCH_RELEASE_APPROVE: Chặn xuất xưởng khi kết quả kiểm nghiệm bị FAIL (Release Gate)', async () => {
      const testingBatch: Batch = { ...validBatch, status: 'TESTING' };
      mockBatchRepo.findById.mockResolvedValue(testingBatch);

      const failedTR: TestResult = {
        id: 'tr_fail',
        batchId: 'batch_slice_002',
        labName: 'Lab QC',
        testDate: '2026-02-01',
        overallStatus: 'FAIL',
        version: 1,
        results: [{ criteriaName: 'Độ tinh khiết', value: '88%', isPass: false }],
      };

      await expect(
        batchHandlers.handleStatusTransition('batch_slice_002', 'RELEASED', qaActor, {
          currentBatch: testingBatch,
          batchTestResults: [failedTR],
        })
      ).rejects.toThrow(/Quy chuẩn GMP & Release Guard.*chưa đạt chuẩn PASS/);
    });

    it('BATCH_RELEASE_APPROVE: Xuất xưởng thành công khi đạt chuẩn và có chữ ký điện tử 21 CFR Part 11', async () => {
      const testingBatch: Batch = { ...validBatch, status: 'TESTING' };
      mockBatchRepo.findById.mockResolvedValue(testingBatch);

      const passedTR: TestResult = {
        id: 'tr_pass',
        batchId: 'batch_slice_002',
        labName: 'Lab QC',
        testDate: '2026-02-01',
        overallStatus: 'PASS',
        version: 1,
        results: [{ criteriaName: 'Độ tinh khiết', value: '99.5%', isPass: true }],
      };

      const validSig: ElectronicSignature = {
        id: 'sig_rel_01',
        documentType: 'BATCH_RELEASE',
        documentId: 'batch_slice_002',
        signerUid: qaActor.id,
        signerName: qaActor.name,
        signerEmail: qaActor.email,
        role: 'QA',
        meaning: 'Phê duyệt xuất xưởng Lô sản phẩm',
        signedAt: new Date().toISOString(),
        checksum: 'valid-checksum',
      };

      const released = await batchHandlers.handleStatusTransition(
        'batch_slice_002',
        'RELEASED',
        qaActor,
        {
          currentBatch: testingBatch,
          batchTestResults: [passedTR],
          signature: validSig,
          requireSignature: true,
        }
      );

      expect(released.status).toBe('RELEASED');
      expect(released.releasedBy).toBe(qaActor.email);
    });

    it('BATCH_HOLD & BATCH_RECALL: Thu hồi Lô (chuyển sang BLOCKED) yêu cầu lý do bắt buộc', async () => {
      const releasedBatch: Batch = { ...validBatch, status: 'RELEASED' };
      mockBatchRepo.findById.mockResolvedValue(releasedBatch);

      // Chuyển sang BLOCKED không lý do -> Bị chặn
      await expect(
        batchHandlers.handleStatusTransition('batch_slice_002', 'BLOCKED', qaActor, {
          currentBatch: releasedBatch,
          reason: '',
        })
      ).rejects.toThrow(/bắt buộc phải có lý do/);

      const validRecallSig: ElectronicSignature = {
        id: 'sig_recall_01',
        documentType: 'BATCH',
        documentId: 'batch_slice_002',
        signerUid: qaActor.id,
        signerName: qaActor.name,
        signerEmail: qaActor.email,
        role: 'QA',
        meaning: 'Thu hồi khẩn cấp Lô khỏi thị trường',
        signedAt: new Date().toISOString(),
        checksum: 'valid-checksum',
      };

      // Chuyển sang BLOCKED có lý do và chữ ký số -> Thành công
      const recalled = await batchHandlers.handleStatusTransition(
        'batch_slice_002',
        'BLOCKED',
        qaActor,
        {
          currentBatch: releasedBatch,
          reason: 'Thu hồi khẩn cấp theo công văn Cục Quản lý Dược số 1234/QLD',
          signature: validRecallSig,
        }
      );

      expect(recalled.status).toBe('BLOCKED');
    });

    it('BATCH_DELETE: Bắt buộc chuỗi xác nhận CONFIRM-DELETE-BATCH đối với thao tác phá hủy', async () => {
      const execution = await WorkflowFacade.dispatch({
        actionId: 'BATCH_DELETE',
        entityType: 'BATCH',
        entityId: 'batch_slice_002',
        actor: adminActor,
        payload: { batchId: 'batch_slice_002' },
        reason: 'Xóa lô thử nghiệm',
        confirmationToken: 'WRONG-TOKEN',
      });

      expect(execution.success).toBe(false);
      expect(execution.failureCode).toBe('INVALID_CONFIRMATION_TOKEN');
      expect(execution.failureReason).toContain('CONFIRM-DELETE-BATCH');
    });

    it('BATCH_DELETE: Thành công khi cung cấp đúng confirmationToken', async () => {
      mockBatchRepo.findById.mockResolvedValue({
        ...validBatch,
        status: 'PENDING',
      });

      await expect(
        batchHandlers.handleDelete('batch_slice_002', adminActor, 'LOT-2026-SLICE-02')
      ).resolves.not.toThrow();

      expect(mockBatchRepo.delete).toHaveBeenCalledWith('batch_slice_002');
    });
  });

  // =========================================================================
  // SLICE 3: FEATURE FLAGS & TELEMETRY
  // =========================================================================
  describe('Vertical Slice 3: Rollback Control & Observability', () => {
    it('Hỗ trợ Feature Flag Rollback: Khi tắt flag, vẫn thực thi trực tiếp an toàn', async () => {
      setWorkflowFeatureFlag('enableTestResultWorkflowFacade', false);

      const testResult: TestResult = {
        id: 'tr_rollback_01',
        batchId: 'batch_01',
        labName: 'Lab A',
        testDate: '2026-02-01',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'pH', value: '6.5', isPass: true }],
      };

      const result = await testResultHandlers.handleCreate(testResult, qcActor);
      expect(result.id).toBe('tr_rollback_01');
      expect(result.version).toBe(1);
      expect(mockTRRepo.save).toHaveBeenCalledWith(result);
    });

    it('WorkflowTelemetry ghi nhận sự kiện metric chuẩn ALCOA+', async () => {
      await testResultHandlers.handleCreate(
        {
          id: 'tr_telemetry_test',
          batchId: 'batch_01',
          labName: 'Lab QC',
          testDate: '2026-02-01',
          overallStatus: 'PASS',
          results: [{ criteriaName: 'Độ ẩm', value: '4.5', isPass: true }],
        },
        qcActor
      );

      const events = WorkflowTelemetry.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event).toMatch(/^workflow\.execution\.(completed|failed)$/);
    });
  });
});
