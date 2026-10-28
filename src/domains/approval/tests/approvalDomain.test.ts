import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApprovalTaskStateMachine,
  ApprovalRules,
  ApprovalWorkflowService,
  approvalQueries,
} from '../index';
import { signatureService } from '../../../services/signatureService';
import { ElectronicSignature, Batch } from '../../../types';

vi.mock('../../../services/auditService', () => ({
  logAuditAction: vi.fn(),
}));

vi.mock('../../../services/signatureService', () => ({
  signatureService: {
    verifySignatureIntegrity: vi.fn(),
  },
}));

describe('VERTICAL SLICE 12: Approval Domain Tests', () => {
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

  describe('1. ApprovalTaskStateMachine', () => {
    it('cho phép chuyển đổi trạng thái hợp lệ từ PENDING sang IN_PROGRESS, APPROVED, REJECTED, CANCELLED', () => {
      expect(ApprovalTaskStateMachine.canTransition('PENDING', 'IN_PROGRESS').allowed).toBe(true);
      expect(ApprovalTaskStateMachine.canTransition('PENDING', 'APPROVED').allowed).toBe(true);
      expect(ApprovalTaskStateMachine.canTransition('PENDING', 'REJECTED').allowed).toBe(true);
      expect(ApprovalTaskStateMachine.canTransition('PENDING', 'CANCELLED').allowed).toBe(true);
    });

    it('cho phép thu hồi từ APPROVED sang REJECTED hoặc CANCELLED', () => {
      expect(ApprovalTaskStateMachine.canTransition('APPROVED', 'REJECTED').allowed).toBe(true);
      expect(ApprovalTaskStateMachine.canTransition('APPROVED', 'CANCELLED').allowed).toBe(true);
    });

    it('chặn chuyển đổi từ trạng thái kết thúc (REJECTED/CANCELLED)', () => {
      expect(ApprovalTaskStateMachine.isTerminal('REJECTED')).toBe(true);
      expect(ApprovalTaskStateMachine.isTerminal('CANCELLED')).toBe(true);
      expect(ApprovalTaskStateMachine.canTransition('REJECTED', 'APPROVED').allowed).toBe(false);
      expect(ApprovalTaskStateMachine.canTransition('CANCELLED', 'IN_PROGRESS').allowed).toBe(
        false
      );
    });
  });

  describe('2. ApprovalRules & Precondition Validations', () => {
    it('cung cấp cấu hình bước chuẩn cho từng loại thực thể', () => {
      const trSteps = ApprovalRules.getDefaultStepsForEntity('TEST_RESULT');
      expect(trSteps).toHaveLength(2);
      expect(trSteps[0].roleRequired).toBe('QC');
      expect(trSteps[1].roleRequired).toBe('QA');

      const batchSteps = ApprovalRules.getDefaultStepsForEntity('BATCH');
      expect(batchSteps).toHaveLength(2);
      expect(batchSteps[0].roleRequired).toBe('QC');
      expect(batchSteps[1].roleRequired).toBe('QA');

      const ccSteps = ApprovalRules.getDefaultStepsForEntity('CHANGE_CONTROL');
      expect(ccSteps).toHaveLength(2);
      expect(ccSteps[0].roleRequired).toBe('QA');
      expect(ccSteps[1].roleRequired).toBe('ADMIN');
    });

    it('thực thi cơ chế Tách biệt Trách nhiệm SoD: chặn người khởi tạo tự thẩm định', () => {
      const task = ApprovalRules.initiateApprovalPipeline(
        'TEST_RESULT',
        'tr-101',
        'initiator@pqm.com'
      );
      expect(ApprovalRules.verifySoDCompliance(task, { email: 'initiator@pqm.com' })).toBe(false);
      expect(ApprovalRules.verifySoDCompliance(task, { email: 'other@pqm.com' })).toBe(true);
    });

    it('chặn vai trò không có thẩm quyền thực thi bước duyệt', () => {
      const task = ApprovalRules.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN Lô L2601',
        'initiator@pqm.com'
      );

      expect(() =>
        ApprovalRules.validateStepDecisionPreconditions({
          task,
          user: prodUser,
          decision: 'APPROVE',
          signature: validSignature,
        })
      ).toThrow(/Từ chối quyền: Bước.*yêu cầu vai trò QC/);
    });

    it('bắt buộc có chữ ký điện tử cho quyết định APPROVE', () => {
      const task = ApprovalRules.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN Lô L2601',
        'initiator@pqm.com'
      );

      expect(() =>
        ApprovalRules.validateStepDecisionPreconditions({
          task,
          user: qcUser,
          decision: 'APPROVE',
        })
      ).toThrow(/Bắt buộc phải có chữ ký điện tử hợp lệ/);
    });

    it('bắt buộc lý do tối thiểu 10 ký tự khi REJECT', () => {
      const task = ApprovalRules.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN Lô L2601',
        'initiator@pqm.com'
      );

      expect(() =>
        ApprovalRules.validateStepDecisionPreconditions({
          task,
          user: qcUser,
          decision: 'REJECT',
          reason: 'Lỗi',
        })
      ).toThrow(/Lý do từ chối phải có tối thiểu 10 ký tự/);
    });

    it('thẩm định điều kiện thu hồi: chặn người dùng không phải QA/ADMIN', () => {
      const task = ApprovalRules.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN Lô L2601',
        'initiator@pqm.com'
      );

      expect(() =>
        ApprovalRules.validateRevocationPreconditions({
          task,
          user: qcUser,
          reason: 'Lý do thu hồi phiếu kiểm nghiệm dài hơn 30 ký tự giải trình kỹ thuật',
        })
      ).toThrow(/Chỉ QA Manager hoặc Quản trị viên mới có thẩm quyền/);
    });

    it('thẩm định điều kiện thu hồi: chặn thu hồi khi Lô đã Xuất xưởng (RELEASED per BR-APP-002)', () => {
      const task = ApprovalRules.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN Lô L2601',
        'initiator@pqm.com'
      );
      const releasedBatch: Batch = {
        id: 'b-101',
        batchNo: 'B2601',
        productId: 'p-1',
        tccsId: 'tccs-1',
        mfgDate: '2026-01-01',
        expDate: '2028-01-01',
        theoreticalYield: 1000,
        actualYield: 1000,
        yieldUnit: 'hộp',
        status: 'RELEASED',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      expect(() =>
        ApprovalRules.validateRevocationPreconditions({
          task,
          user: qaUser,
          reason: 'Lý do thu hồi phiếu kiểm nghiệm dài hơn 30 ký tự giải trình kỹ thuật',
          relatedBatch: releasedBatch,
        })
      ).toThrow(/Không thể hủy duyệt phiếu khi Lô sản xuất liên quan đã Xuất xưởng/);
    });

    it('thẩm định điều kiện thu hồi: chặn nếu lý do ngắn hơn 30 ký tự', () => {
      const task = ApprovalRules.createStandardTask(
        'TEST_RESULT',
        'tr-101',
        'Phiếu KN Lô L2601',
        'initiator@pqm.com'
      );

      expect(() =>
        ApprovalRules.validateRevocationPreconditions({
          task,
          user: qaUser,
          reason: 'Lý do ngắn',
        })
      ).toThrow(/tối thiểu 30 ký tự giải trình chi tiết kỹ thuật/);
    });
  });

  describe('3. ApprovalWorkflowService & End-to-End Workflow Decisions', () => {
    it('thực thi quy trình duyệt 2 cấp hoàn chỉnh (QC -> QA -> APPROVED)', async () => {
      const initialTask = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-202',
        'Phiếu KN Lô 202',
        'lab@pqm.com'
      );

      // Bước 1: QC duyệt
      const step1Result = await ApprovalWorkflowService.processStepDecision(
        initialTask,
        qcUser,
        'APPROVE',
        'QC kiểm tra số liệu đầy đủ',
        validSignature
      );
      expect(step1Result.status).toBe('IN_PROGRESS');
      expect(step1Result.currentStepIndex).toBe(1);
      expect(step1Result.steps[0].status).toBe('APPROVED');

      // Bước 2: QA duyệt
      const step2Result = await ApprovalWorkflowService.processStepDecision(
        step1Result,
        qaUser,
        'APPROVE',
        'QA phê duyệt phát hành phiếu',
        validSignature
      );
      expect(step2Result.status).toBe('APPROVED');
      expect(step2Result.steps[1].status).toBe('APPROVED');
      expect(step2Result.history).toHaveLength(3); // 1 init + 2 steps
    });

    it('thực thi từ chối ở bước 1 và kết thúc với REJECTED', async () => {
      const initialTask = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-303',
        'Phiếu KN Lô 303',
        'lab@pqm.com'
      );

      const rejectedTask = await ApprovalWorkflowService.processStepDecision(
        initialTask,
        qcUser,
        'REJECT',
        'Số liệu phân tích vi sinh không đạt tiêu chuẩn TCCS'
      );

      expect(rejectedTask.status).toBe('REJECTED');
      expect(rejectedTask.steps[0].status).toBe('REJECTED');
      expect(rejectedTask.steps[0].decision).toBe('REJECT');
    });

    it('thực thi thu hồi phê duyệt hợp lệ bởi QA khi Lô ở trạng thái BLOCKED hoặc chưa xuất xưởng', async () => {
      const approvedTask = ApprovalWorkflowService.createStandardTask(
        'TEST_RESULT',
        'tr-404',
        'Phiếu KN Lô 404',
        'lab@pqm.com'
      );
      approvedTask.status = 'APPROVED';

      const blockedBatch: Batch = {
        id: 'b-404',
        batchNo: 'B404',
        productId: 'p-1',
        tccsId: 'tccs-1',
        mfgDate: '2026-01-01',
        expDate: '2028-01-01',
        theoreticalYield: 1000,
        actualYield: 1000,
        yieldUnit: 'hộp',
        status: 'BLOCKED',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const revokedTask = await ApprovalWorkflowService.revokeApproval({
        task: approvedTask,
        user: qaUser,
        reason: 'Phát hiện sai lệch nhiệt độ phòng lưu mẫu kiểm nghiệm cần kiểm tra lại',
        relatedBatch: blockedBatch,
        signature: validSignature,
      });

      expect(revokedTask.status).toBe('REJECTED');
      expect(revokedTask.metadata?.revocationReason).toBe(
        'Phát hiện sai lệch nhiệt độ phòng lưu mẫu kiểm nghiệm cần kiểm tra lại'
      );
    });
  });

  describe('4. ApprovalQueries', () => {
    it('cung cấp các phương thức truy vấn hợp lệ', () => {
      expect(typeof approvalQueries.findByEntity).toBe('function');
      expect(typeof approvalQueries.findByAssignee).toBe('function');
      expect(typeof approvalQueries.findById).toBe('function');
      expect(typeof approvalQueries.findAll).toBe('function');
      expect(typeof approvalQueries.findPendingTasks).toBe('function');
    });
  });
});
