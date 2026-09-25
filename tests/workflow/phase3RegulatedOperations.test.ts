/**
 * tests/workflow/phase3RegulatedOperations.test.ts
 * ===================================================
 * WORKFLOW PHASE 3: REGULATED OPERATIONS VERTICAL SLICES TEST SUITE
 * Kiểm thử toàn diện các luồng nghiệp vụ chuẩn GxP / 21 CFR Part 11:
 * 1. Deviation & CAPA Flow (DEVIATION_*, CAPA_*, OOS_*)
 * 2. Change Control Flow (CHANGE_REQUEST_*)
 * 3. Multi-stage Approval & CoA Flow (APPROVAL_TASK_*, COA_*)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviationWorkflowHandlers } from '../../src/workflow/handlers/deviationWorkflowHandlers';
import { ChangeControlWorkflowHandlers } from '../../src/workflow/handlers/changeControlWorkflowHandlers';
import { ApprovalWorkflowService } from '../../src/services/app/ApprovalWorkflowService';
import { CoAService } from '../../src/services/app/CoAService';
import { IDeviationRepository } from '../../src/repositories/IDeviationRepository';
import { IChangeControlRepository } from '../../src/repositories/IChangeControlRepository';
import { QualityDeviation } from '../../src/types/deviation';
import { ChangeRequest } from '../../src/types/changeControl';
import { OutboxAuditQueue } from '../../src/workflow/events/outboxAuditQueue';
import { buildEvaluationSnapshot } from '../../src/domain/evaluation/EvaluationSnapshotBuilder';
import { Batch, TestResult, TCCS, CriterionType, ElectronicSignature } from '../../src/types';

// Mock audit service to isolate outbox verification
vi.mock('../../src/services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock signature service
vi.mock('../../src/services/signatureService', () => ({
  signatureService: {
    verifySignatureIntegrity: vi.fn().mockResolvedValue(true),
  },
}));

describe('Workflow Phase 3: Regulated Operations Vertical Slices', () => {
  const qaUser = {
    uid: 'qa-001',
    email: 'qa.lead@v-biotech.com',
    role: 'QA' as const,
    displayName: 'Nguyen Thi QA',
  };

  const adminUser = {
    uid: 'admin-001',
    email: 'admin@v-biotech.com',
    role: 'ADMIN' as const,
    isAdmin: true,
    displayName: 'He Thong Admin',
  };

  const qcUser = {
    uid: 'qc-001',
    email: 'qc.analyst@v-biotech.com',
    role: 'QC' as const,
    displayName: 'Tran Van QC',
  };

  const guestUser = {
    uid: 'guest-001',
    email: 'guest@v-biotech.com',
    role: 'GUEST' as const,
    displayName: 'Khach Vang Lai',
  };

  const validSignature: ElectronicSignature = {
    signerId: 'qa-001',
    signerName: 'Nguyen Thi QA',
    signerEmail: 'qa.lead@v-biotech.com',
    signerRole: 'QA',
    timestamp: new Date().toISOString(),
    meaning: 'Phê duyệt xuất xưởng và kết luận kiểm nghiệm',
    signatureHash: 'hash-abc-xyz-123456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    OutboxAuditQueue.clear();
  });

  describe('Slice 1: Deviation & CAPA Lifecycle (DEVIATION_*, CAPA_*)', () => {
    let mockDevStore: Map<string, QualityDeviation>;
    let mockRepo: IDeviationRepository;
    let handlers: DeviationWorkflowHandlers;

    beforeEach(() => {
      mockDevStore = new Map();
      mockRepo = {
        findAll: vi.fn(async () => Array.from(mockDevStore.values())),
        findById: vi.fn(async (id: string) => mockDevStore.get(id) || null),
        findByStatus: vi.fn(async (s) =>
          Array.from(mockDevStore.values()).filter((d) => d.status === s)
        ),
        findByBatchId: vi.fn(async (b) =>
          Array.from(mockDevStore.values()).filter((d) => d.batchId === b)
        ),
        save: vi.fn(async (dev: QualityDeviation) => {
          mockDevStore.set(dev.id, dev);
        }),
        update: vi.fn(async (dev: QualityDeviation) => {
          mockDevStore.set(dev.id, dev);
        }),
        updateStatus: vi.fn(async (id: string, status: any) => {
          const d = mockDevStore.get(id);
          if (d) {
            d.status = status;
          }
        }),
        delete: vi.fn(async (id: string) => {
          mockDevStore.delete(id);
        }),
      } as any;
      handlers = new DeviationWorkflowHandlers(mockRepo);
    });

    it('1.1 Khởi tạo Deviation qua WorkflowFacade.dispatch() và ghi nhận Outbox Audit', async () => {
      const dev = await handlers.handleCreate(
        {
          title: 'Độ ẩm vượt giới hạn cho phép lô Para-001',
          source: 'OOS',
          severity: 'MAJOR',
          batchId: 'batch-p01',
          batchNo: 'LOT-2026-P01',
          description: 'Hàm lượng ẩm đo được 6.2% so với ngưỡng max 5.0%',
        },
        qaUser
      );

      expect(dev.id).toBeDefined();
      expect(dev.status).toBe('LOGGED');
      expect(dev.deviationNo).toContain('DEV-');
      expect(mockDevStore.has(dev.id)).toBe(true);

      const auditEntries = OutboxAuditQueue.getQueue();
      const createAudit = auditEntries.find((e) => e.actionId === 'DEVIATION_CREATE');
      expect(createAudit).toBeDefined();
      expect(createAudit?.entityType).toBe('DEVIATION');
    });

    it('1.2 Thêm và hoàn tất CAPA Action Item qua Workflow Engine', async () => {
      const dev = await handlers.handleCreate(
        {
          title: 'Nhiệt độ phòng cân vượt ngưỡng',
          source: 'INTERNAL_AUDIT',
          severity: 'MINOR',
          description: 'Điều hòa hỏng khiến nhiệt độ tăng lên 28C',
        },
        qaUser
      );

      // Thêm CAPA
      const withCapa = await handlers.handleAddCAPAItem(
        dev.id,
        {
          type: 'CORRECTIVE',
          action: 'Bảo trì hệ thống điều hòa HVAC phòng cân',
          responsible: 'Bảo trì Cơ điện',
          deadline: '2026-10-01',
          status: 'PENDING',
        },
        qaUser
      );

      expect(withCapa.capaItems?.length).toBe(1);
      const capaId = withCapa.capaItems![0].id;
      expect(withCapa.capaItems![0].status).toBe('PENDING');

      // Hoàn tất CAPA
      const completedDev = await handlers.handleCompleteCAPAItem(dev.id, capaId, qaUser);

      expect(completedDev.capaItems![0].status).toBe('COMPLETED');
      expect(completedDev.capaItems![0].completedAt).toBeDefined();

      const auditEntries = OutboxAuditQueue.getQueue();
      expect(auditEntries.some((e) => e.actionId === 'CAPA_CREATE')).toBe(true);
      expect(auditEntries.some((e) => e.actionId === 'CAPA_EXECUTE')).toBe(true);
    });

    it('1.3 Chuyển trạng thái Deviation sang UNDER_INVESTIGATION và CLOSED', async () => {
      const dev = await handlers.handleCreate(
        {
          title: 'Hạt lạ trong mẫu kiểm tra cảm quan',
          source: 'IN_PROCESS',
          severity: 'CRITICAL',
          description: 'Phát hiện sợi vải đen trong mẫu nang',
        },
        qaUser
      );

      const investigating = await handlers.handleUpdateStatus(
        dev.id,
        'UNDER_INVESTIGATION',
        qaUser,
        { notes: 'Tiến hành soi kính hiển vi và phỏng vấn công nhân' }
      );
      expect(investigating.status).toBe('UNDER_INVESTIGATION');

      const closed = await handlers.handleUpdateStatus(dev.id, 'CLOSED', qaUser, {
        notes: 'Đã rà soát quy trình trang phục phòng sạch, đóng hồ sơ',
      });
      expect(closed.status).toBe('CLOSED');
    });

    it('1.4 Xóa Deviation yêu cầu quyền ADMIN và ghi nhận lý do', async () => {
      const dev = await handlers.handleCreate(
        {
          title: 'Nhầm lẫn nhập liệu phiếu thử nghiệm',
          source: 'OTHER',
          severity: 'MINOR',
          description: 'Gõ nhầm tên chỉ tiêu',
        },
        qaUser
      );

      // Guest cố xóa -> Bị từ chối bởi RBAC Guard
      await expect(
        handlers.handleDelete(dev.id, guestUser, 'Nhập nhầm hoàn toàn')
      ).rejects.toThrow();

      // Admin xóa với lý do hợp lệ -> Thành công
      await handlers.handleDelete(dev.id, adminUser, 'Hồ sơ nhập sai thông tin cần hủy bỏ');
      expect(mockDevStore.has(dev.id)).toBe(false);
    });
  });

  describe('Slice 2: Change Control Lifecycle (CHANGE_REQUEST_*)', () => {
    let mockChangeStore: Map<string, ChangeRequest>;
    let mockRepo: IChangeControlRepository;
    let handlers: ChangeControlWorkflowHandlers;

    beforeEach(() => {
      mockChangeStore = new Map();
      mockRepo = {
        findAll: vi.fn(async () => Array.from(mockChangeStore.values())),
        findById: vi.fn(async (id: string) => mockChangeStore.get(id) || null),
        findByStatus: vi.fn(async (s) =>
          Array.from(mockChangeStore.values()).filter((c) => c.status === s)
        ),
        findByProduct: vi.fn(async (p) =>
          Array.from(mockChangeStore.values()).filter((c) => c.productId === p)
        ),
        save: vi.fn(async (req: ChangeRequest) => {
          mockChangeStore.set(req.id, req);
        }),
        update: vi.fn(async (req: ChangeRequest) => {
          mockChangeStore.set(req.id, req);
        }),
        delete: vi.fn(async (id: string) => {
          mockChangeStore.delete(id);
        }),
      } as any;
      handlers = new ChangeControlWorkflowHandlers(mockRepo);
    });

    it('2.1 Khởi tạo Change Request qua Workflow Kernel (CHANGE_REQUEST_CREATE)', async () => {
      const cr = await handlers.handleCreate(
        {
          title: 'Thay đổi nhà cung ứng tá dược Magnesi stearat',
          category: 'RAW_MATERIAL',
          changeType: 'MAJOR',
          targetImplementationDate: '2026-11-01',
          justification: 'Nhà cung ứng cũ tăng giá và thời gian giao hàng kéo dài',
          description: 'Toàn bộ các sản phẩm viên nén',
        },
        qaUser
      );

      expect(cr.id).toBeDefined();
      expect(cr.status).toBe('DRAFT');
      expect(cr.crNo).toContain('CR-');
      expect(mockChangeStore.has(cr.id)).toBe(true);

      const auditEntries = OutboxAuditQueue.getQueue();
      expect(auditEntries.some((e) => e.actionId === 'CHANGE_REQUEST_CREATE')).toBe(true);
    });

    it('2.2 Đánh giá ma trận rủi ro FMEA (CHANGE_REQUEST_FMEA_ASSESS)', async () => {
      const cr = await handlers.handleCreate(
        {
          title: 'Thay đổi thông số nhiệt độ sấy tầng sôi',
          category: 'MANUFACTURING_PROCESS',
          changeType: 'MAJOR',
          targetImplementationDate: '2026-11-01',
          justification: 'Tối ưu hóa thời gian sấy mẻ lớn',
          description: 'Quy trình sản xuất viên Paracetamol',
        },
        qaUser
      );

      // Severity=5, Probability=3, Detectability=2 => RPN = 30 >= 25 (MEDIUM)
      const assessed = await handlers.handleAssessFMEARisk(
        cr.id,
        {
          severity: 5,
          probability: 3,
          detectability: 2,
          mitigationPlan: 'Nguy cơ làm giảm độ hòa tan nếu sấy quá nhiệt',
        },
        qaUser
      );

      expect(assessed.riskAssessment).toBeDefined();
      expect(assessed.riskAssessment?.rpn).toBe(30);
      expect(assessed.riskAssessment?.riskLevel).toBe('MEDIUM');

      const auditEntries = OutboxAuditQueue.getQueue();
      expect(auditEntries.some((e) => e.actionId === 'CHANGE_REQUEST_FMEA_ASSESS')).toBe(true);
    });

    it('2.3 Thêm hành động và hoàn tất hành động triển khai thay đổi', async () => {
      const cr = await handlers.handleCreate(
        {
          title: 'Cập nhật tài liệu SOP kiểm tra cảm quan',
          category: 'SPECIFICATION',
          changeType: 'MINOR',
          targetImplementationDate: '2026-11-01',
          justification: 'Chuẩn hóa định dạng tài liệu theo phiên bản mới',
          description: 'Toàn xưởng',
        },
        qaUser
      );

      const withAction = await handlers.handleAddActionItem(
        cr.id,
        {
          title: 'Soạn thảo dự thảo SOP phiên bản 03',
          responsible: 'qa.lead@v-biotech.com',
          deadline: '2026-10-15',
        },
        qaUser
      );

      expect(withAction.actionItems?.length).toBe(1);
      const actionId = withAction.actionItems![0].id;

      const completed = await handlers.handleCompleteActionItem(cr.id, actionId, qaUser);

      expect(completed.actionItems![0].status).toBe('COMPLETED');
      expect(completed.actionItems![0].completedAt).toBeDefined();
    });
  });

  describe('Slice 3: Multi-Stage Approval Pipeline & CoA Publishing', () => {
    const mockTccs: TCCS = {
      id: 'tccs-100',
      productId: 'prod-100',
      code: 'TCCS-AMOX-500',
      productName: 'Amoxicillin 500mg',
      isActive: true,
      mainQualityCriteria: [
        {
          id: 'crit-01',
          name: 'Định lượng hoạt chất',
          unit: '%',
          min: 90,
          max: 110,
          type: CriterionType.NUMBER,
        },
        { id: 'crit-02', name: 'Độ rã', unit: 'phút', max: 15, type: CriterionType.NUMBER },
      ],
    };

    const mockBatch: Batch = {
      id: 'batch-amox-01',
      batchNo: 'LOT-AMOX-2026-001',
      productId: 'prod-100',
      productName: 'Amoxicillin 500mg',
      tccsId: 'tccs-100',
      status: 'TESTING',
      mfgDate: '2026-02-01',
      expDate: '2029-02-01',
    };

    it('3.1 Khởi tạo pipeline và thực hiện phê duyệt 2 bước chuẩn 21 CFR Part 11', async () => {
      const task = ApprovalWorkflowService.initiateApprovalPipeline(
        'TEST_RESULT',
        'tr-amox-001',
        'creator@v-biotech.com',
        'Thẩm duyệt phiếu kiểm nghiệm Amox 500mg'
      );

      expect(task.status).toBe('PENDING');
      expect(task.steps.length).toBe(2);

      // Chặn người lập tự phê duyệt (Segregation of Duties)
      await expect(
        ApprovalWorkflowService.processStepDecision(
          task,
          { uid: 'creator-uid', email: 'creator@v-biotech.com', role: 'QC' },
          'APPROVE',
          'Tự duyệt phiếu của mình',
          validSignature
        )
      ).rejects.toThrow('ERR_SOD_VIOLATION');

      // Bước 1: QC Soát xét và duyệt
      const step1Result = await ApprovalWorkflowService.processStepDecision(
        task,
        qcUser,
        'APPROVE',
        'QC kiểm tra dữ liệu phân tích đạt tiêu chuẩn',
        validSignature
      );

      expect(step1Result.status).toBe('IN_PROGRESS');
      expect(step1Result.currentStepIndex).toBe(1);
      expect(step1Result.steps[0].status).toBe('APPROVED');

      // Bước 2: QA Phê duyệt hoàn tất với Chữ ký số
      const finalTask = await ApprovalWorkflowService.processStepDecision(
        step1Result,
        qaUser,
        'APPROVE',
        'QA phê duyệt phát hành phiếu kiểm nghiệm thành phẩm',
        validSignature
      );

      expect(finalTask.status).toBe('APPROVED');
      expect(finalTask.steps[1].status).toBe('APPROVED');
      expect(finalTask.history.length).toBe(3); // INIT + STEP1 + STEP2
    });

    it('3.2 Thu hồi / Hủy phê duyệt có kiểm soát theo BR-APP-002', async () => {
      const task = ApprovalWorkflowService.initiateApprovalPipeline(
        'TEST_RESULT',
        'tr-amox-002',
        'creator@v-biotech.com'
      );

      // Hủy duyệt với lý do quá ngắn (<30 ký tự) -> Bị từ chối
      await expect(
        ApprovalWorkflowService.revokeApproval({
          task,
          user: qaUser,
          reason: 'Lý do ngắn',
        })
      ).rejects.toThrow('ERR_REVOCATION_REASON_TOO_SHORT');

      // Hủy duyệt khi Lô đã RELEASED -> Bị từ chối
      await expect(
        ApprovalWorkflowService.revokeApproval({
          task,
          user: qaUser,
          reason: 'Phát hiện sự cố kỹ thuật nghiêm trọng tại mẫu lưu đối chứng',
          relatedBatch: { ...mockBatch, status: 'RELEASED' },
        })
      ).rejects.toThrow('Không thể hủy duyệt phiếu khi Lô sản xuất liên quan đã Xuất xưởng');

      // Hủy duyệt hợp lệ khi Lô đang TESTING
      const revoked = await ApprovalWorkflowService.revokeApproval({
        task,
        user: qaUser,
        reason: 'Phát hiện sai lệch nhiệt độ sấy tủ chân không ảnh hưởng kết quả kiểm nghiệm',
        relatedBatch: mockBatch,
        signature: validSignature,
      });

      expect(revoked.status).toBe('REJECTED');
      expect(revoked.metadata?.revocationReason).toContain('Phát hiện sai lệch nhiệt độ');
    });

    it('3.3 Sinh CoA, Ký số điện tử và Thu hồi CoA qua Workflow Engine', async () => {
      const coaService = new CoAService();

      const testResult: TestResult = {
        id: 'tr-amox-01',
        batchId: mockBatch.id,
        productId: mockBatch.productId,
        tccsId: mockTccs.id,
        overallStatus: 'PASS',
        testDate: '2026-02-05',
        labName: 'Phòng Kiểm Nghiệm Đạt Chuẩn GLP',
        results: [
          {
            criterionId: 'crit-01',
            criteriaName: 'Định lượng hoạt chất',
            value: '99.5',
            isPass: true,
            status: 'PASS',
          },
          {
            criterionId: 'crit-02',
            criteriaName: 'Độ rã',
            value: '8.5',
            isPass: true,
            status: 'PASS',
          },
        ],
      } as any;

      testResult.evaluationSnapshot = buildEvaluationSnapshot(
        testResult,
        { email: qaUser.email },
        { tccs: mockTccs }
      );

      // Sinh CoA bất đồng bộ qua Workflow Kernel
      const coaPayload = await coaService.generateCoAPayloadAsync({
        batch: mockBatch,
        testResult,
        tccs: mockTccs,
        currentUser: qaUser,
      });

      expect(coaPayload.coaNumber).toContain('COA-LOT-AMOX-2026-001');
      expect(coaPayload.overallConclusion).toBe('ĐẠT TIÊU CHUẨN');
      expect(coaPayload.canonicalStatus).toBe('PASS');
      expect(coaPayload.isIntegrityVerified).toBe(true);

      // QA Ký số phát hành chứng nhận CoA điện tử
      const signed = await coaService.signCoA({
        coaNumber: coaPayload.coaNumber,
        batchNumber: mockBatch.batchNo,
        signature: validSignature,
        currentUser: qaUser,
      });

      expect(signed.coaNumber).toBe(coaPayload.coaNumber);
      expect(signed.signedAt).toBeDefined();

      // Thu hồi CoA khi phát hiện sai sót
      const revoked = await coaService.revokeCoA({
        coaNumber: coaPayload.coaNumber,
        reason: 'Thu hồi do phát hiện kết quả thẩm định lại của mẫu lưu không đồng nhất',
        currentUser: qaUser,
        signature: validSignature,
      });

      expect(revoked.coaNumber).toBe(coaPayload.coaNumber);
      expect(revoked.revokedAt).toBeDefined();

      const auditEntries = OutboxAuditQueue.getQueue();
      expect(auditEntries.some((e) => e.actionId === 'COA_GENERATE')).toBe(true);
      expect(auditEntries.some((e) => e.actionId === 'COA_SIGN')).toBe(true);
      expect(auditEntries.some((e) => e.actionId === 'COA_REVOKE')).toBe(true);
    });
  });
});
