import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApprovalWorkflowService } from './ApprovalWorkflowService';
import { signatureService } from '../signatureService';
import { ElectronicSignature } from '../../types';

vi.mock('../auditService', () => ({
  logAuditAction: vi.fn(),
}));

vi.mock('../signatureService', () => ({
  signatureService: {
    verifySignatureIntegrity: vi.fn(),
  },
}));

describe('TASK-006: ApprovalWorkflowService', () => {
  const qcUser = { uid: 'u-qc', email: 'qc@pqm.com', role: 'QC' as const, isAdmin: false };
  const qaUser = { uid: 'u-qa', email: 'qa@pqm.com', role: 'QA' as const, isAdmin: false };
  const prodUser = {
    uid: 'u-prod',
    email: 'prod@pqm.com',
    role: 'PRODUCTION' as const,
    isAdmin: false,
  };

  const validSignature: ElectronicSignature = {
    id: 'sig-1',
    documentType: 'TEST_RESULT_APPROVAL',
    documentId: 'tr-101',
    signerUid: 'u-qa',
    signerName: 'Trưởng phòng QA',
    signerEmail: 'qa@pqm.com',
    role: 'QA',
    signedAt: '2026-03-01T10:00:00Z',
    meaning: 'APPROVAL',
    comments: 'Đạt yêu cầu tiêu chuẩn xuất xưởng',
    checksum: 'valid-checksum',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signatureService.verifySignatureIntegrity).mockResolvedValue(true);
  });

  describe('1. Task Initialization', () => {
    it('tạo task xét duyệt kết quả kiểm nghiệm với đúng 2 bước QC và QA', () => {
      const task = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN Lô L2601',
        'qc@pqm.com'
      );
      expect(task.status).toBe('PENDING');
      expect(task.currentStepIndex).toBe(0);
      expect(task.steps.length).toBe(2);
      expect(task.steps[0].roleRequired).toBe('QC');
      expect(task.steps[1].roleRequired).toBe('QA');
      expect(task.history.length).toBe(1);
    });

    it('tạo task xét duyệt lô hàng xuất xưởng với đúng 2 bước QC và QA', () => {
      const task = ApprovalWorkflowService.createStandardTask(
        'BATCH',
        'b-201',
        'Xuất xưởng Lô B201',
        'qa@pqm.com'
      );
      expect(task.entityType).toBe('BATCH');
      expect(task.steps[1].stepName).toContain('QA');
    });
  });

  describe('2. Role Enforcement & Authorization', () => {
    it('từ chối nếu nhân sự Sản xuất (PRODUCTION) cố tình phê duyệt bước QC', async () => {
      const task = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'qc@pqm.com'
      );
      await expect(
        ApprovalWorkflowService.processStepDecision(
          task,
          prodUser,
          'APPROVE',
          'Duyệt thử',
          validSignature
        )
      ).rejects.toThrow(
        'Từ chối quyền: Bước "Soát xét Kết quả Phân tích (QC Review)" yêu cầu vai trò QC.'
      );
    });
  });

  describe('3. Electronic Signature Verification (21 CFR Part 11)', () => {
    it('bắt buộc phải có chữ ký điện tử khi phê duyệt', async () => {
      const task = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'qc@pqm.com'
      );
      await expect(
        ApprovalWorkflowService.processStepDecision(task, qcUser, 'APPROVE', 'Đồng ý nhưng quên ký')
      ).rejects.toThrow('Bắt buộc phải có chữ ký điện tử hợp lệ');
    });

    it('từ chối phê duyệt nếu chữ ký bị can thiệp (Integrity Check Failed)', async () => {
      vi.mocked(signatureService.verifySignatureIntegrity).mockResolvedValue(false);
      const task = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'qc@pqm.com'
      );
      await expect(
        ApprovalWorkflowService.processStepDecision(
          task,
          qcUser,
          'APPROVE',
          'Chữ ký lỗi',
          validSignature
        )
      ).rejects.toThrow('Chữ ký điện tử không hợp lệ hoặc đã bị can thiệp');
    });
  });

  describe('4. Multi-Stage Workflow Progression', () => {
    it('tiến triển đầy đủ từ PENDING -> IN_PROGRESS -> APPROVED qua 2 bước', async () => {
      const initialTask = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'qc@pqm.com'
      );

      // Bước 1: QC Duyệt
      const afterStep1 = await ApprovalWorkflowService.processStepDecision(
        initialTask,
        qcUser,
        'APPROVE',
        'QC kiểm tra dữ liệu đạt yêu cầu',
        validSignature
      );

      expect(afterStep1.status).toBe('IN_PROGRESS');
      expect(afterStep1.currentStepIndex).toBe(1);
      expect(afterStep1.steps[0].status).toBe('APPROVED');
      expect(afterStep1.steps[1].status).toBe('PENDING');

      // Bước 2: QA Duyệt xuất xưởng
      const finalTask = await ApprovalWorkflowService.processStepDecision(
        afterStep1,
        qaUser,
        'APPROVE',
        'QA phê duyệt phát hành phiếu',
        validSignature
      );

      expect(finalTask.status).toBe('APPROVED');
      expect(finalTask.steps[1].status).toBe('APPROVED');
      expect(finalTask.history.length).toBe(3); // INIT + STEP1 + STEP2
    });

    it('dừng toàn bộ quy trình khi bị Từ chối (REJECT) ở bước bất kỳ', async () => {
      const initialTask = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'qc@pqm.com'
      );

      const rejectedTask = await ApprovalWorkflowService.processStepDecision(
        initialTask,
        qcUser,
        'REJECT',
        'Chỉ tiêu độ ẩm không đạt TCCS'
      );

      expect(rejectedTask.status).toBe('REJECTED');
      expect(rejectedTask.steps[0].status).toBe('REJECTED');
      expect(rejectedTask.steps[0].reason).toContain('độ ẩm không đạt');
    });
  });

  describe('5. Segregation of Duties (SoD - BR-APP-001 & FRS-MOD-13)', () => {
    it('khởi tạo pipeline chuẩn FRS-MOD-13 có cờ enforceSoD', () => {
      const task = ApprovalWorkflowService.initiateApprovalPipeline(
        'TEST_RESULT',
        'tr-202',
        'tester@pqm.com'
      );
      expect(task.metadata?.originatorId).toBe('tester@pqm.com');
      expect(task.metadata?.enforceSoD).toBe(true);
    });

    it('verifySoDCompliance phát hiện xung đột khi người duyệt trùng người lập', () => {
      const task = ApprovalWorkflowService.initiateApprovalPipeline(
        'TEST_RESULT',
        'tr-202',
        'tester@pqm.com'
      );
      expect(ApprovalWorkflowService.verifySoDCompliance(task, { email: 'tester@pqm.com' })).toBe(
        false
      );
      expect(ApprovalWorkflowService.verifySoDCompliance(task, { email: 'reviewer@pqm.com' })).toBe(
        true
      );
    });

    it('chặn đứng người lập tự thẩm định phiếu của chính mình (ERR_SOD_VIOLATION)', async () => {
      const task = ApprovalWorkflowService.initiateApprovalPipeline(
        'TEST_RESULT',
        'tr-202',
        'qc@pqm.com'
      );
      await expect(
        ApprovalWorkflowService.processStepDecision(
          task,
          qcUser,
          'APPROVE',
          'Tự duyệt phiếu của mình',
          validSignature
        )
      ).rejects.toThrow('ERR_SOD_VIOLATION');
    });
  });

  describe('6. Rejection Reason Validation', () => {
    it('báo lỗi khi từ chối mà không nhập lý do (ERR_REJECTION_REASON_REQUIRED)', async () => {
      const task = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'tester@pqm.com'
      );
      await expect(
        ApprovalWorkflowService.processStepDecision(task, qcUser, 'REJECT', '')
      ).rejects.toThrow('ERR_REJECTION_REASON_REQUIRED');
    });

    it('báo lỗi khi lý do từ chối quá ngắn dưới 10 ký tự (ERR_REJECTION_REASON_TOO_SHORT)', async () => {
      const task = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'tester@pqm.com'
      );
      await expect(
        ApprovalWorkflowService.processStepDecision(task, qcUser, 'REJECT', 'Không đạt')
      ).rejects.toThrow('ERR_REJECTION_REASON_TOO_SHORT');
    });
  });

  describe('7. Revocation & Invalidation Rule (BR-APP-002)', () => {
    it('chặn hủy phê duyệt khi Lô đã ở trạng thái RELEASED', async () => {
      const task = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'tester@pqm.com'
      );
      task.status = 'APPROVED';

      const mockReleasedBatch = { id: 'b-01', status: 'RELEASED' } as any;

      await expect(
        ApprovalWorkflowService.revokeApproval({
          task,
          user: qaUser,
          reason: 'Phát hiện sai lệch nghiêm trọng trong quá trình kiểm nghiệm mẫu phân tích',
          relatedBatch: mockReleasedBatch,
        })
      ).rejects.toThrow(
        'Không thể hủy duyệt phiếu khi Lô sản xuất liên quan đã Xuất xưởng (RELEASED)'
      );
    });

    it('bắt buộc lý do thu hồi tối thiểu 30 ký tự giải trình kỹ thuật (BR-APP-002)', async () => {
      const task = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'tester@pqm.com'
      );
      task.status = 'APPROVED';

      await expect(
        ApprovalWorkflowService.revokeApproval({
          task,
          user: qaUser,
          reason: 'Lý do quá ngắn',
        })
      ).rejects.toThrow('ERR_REVOCATION_REASON_TOO_SHORT');
    });

    it('thu hồi thành công khi Lô ở trạng thái TESTING và đầy đủ lý do giải trình', async () => {
      const task = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN',
        'tester@pqm.com'
      );
      task.status = 'APPROVED';

      const mockTestingBatch = { id: 'b-01', status: 'TESTING' } as any;
      const longReason =
        'Phát hiện chuẩn nội HPLC bị suy giảm nồng độ sau 24h lưu trữ trong phòng thí nghiệm';

      const revokedTask = await ApprovalWorkflowService.revokeApproval({
        task,
        user: qaUser,
        reason: longReason,
        relatedBatch: mockTestingBatch,
      });

      expect(revokedTask.status).toBe('REJECTED');
      expect(revokedTask.metadata?.revocationReason).toBe(longReason);
      expect(revokedTask.metadata?.revokedBy).toBe(qaUser.email);
    });
  });
});
