/**
 * BATCH BPR & 7 RELEASE GATES REGRESSION & SECURITY TEST SUITE (PHASE 10)
 *
 * Kiểm tra toàn diện:
 * 1. BPR Lifecycle (DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED)
 * 2. Cấm DRAFT -> APPROVED trực tiếp
 * 3. Quyền hạn QA/ADMIN trên BPR Review
 * 4. 7 Release Gates FAIL-CLOSED:
 *    - Gate 6 fail (BPR chưa duyệt) -> không thể xuất xưởng
 *    - Gate 7 fail (Thiếu chữ ký / Sai chữ ký / Sai vai trò / Sai documentId) -> không thể xuất xưởng
 *    - Gate 7 từ chối chữ ký của tài liệu khác (BATCH, BATCH_REJECT, TEST_RESULT_APPROVAL, COA_ISSUE)
 *    - Gate 7 từ chối checksum giả lập / mock / sig_auto_*
 * 5. Luồng E2E hoàn chỉnh:
 *    TESTING -> BPR UNDER_REVIEW -> BPR APPROVED -> SIGN BATCH_RELEASE -> 7/7 PASS -> BATCH_RELEASE_APPROVE -> RELEASED
 * 6. Rào chắn bảo mật (Security Guards):
 *    - USER không thể approve BPR
 *    - USER không thể ký release
 *    - Cấm direct status mutation (bắt buộc qua Workflow Kernel)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BprStateMachine } from '../../src/domain/workflow/bprStateMachine';
import { BatchReleaseDecisionService } from '../../src/domain/batch/BatchReleaseDecisionService';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import { BatchAppService } from '../../src/domains/batch/application/service';
import { IBatchRepository } from '../../src/repositories/BatchRepository';
import { Batch, TestResult, ElectronicSignature } from '../../src/types';
import { computeSignatureChecksum } from '../../src/services/signatureService';
import { updateBatchStatusService } from '../../src/services/databaseService';

describe('Batch BPR Workflow & 7 Release Gates Test Suite', () => {
  const qaUser = {
    id: 'usr_qa',
    email: 'qa@vbiotech.com',
    displayName: 'QA Manager',
    role: 'QA',
  };

  const adminUser = {
    id: 'usr_admin',
    email: 'admin@vbiotech.com',
    displayName: 'System Admin',
    role: 'ADMIN',
  };

  const regularUser = {
    id: 'usr_regular',
    email: 'user@vbiotech.com',
    displayName: 'Regular User',
    role: 'USER',
  };

  const qcUser = {
    id: 'usr_qc',
    email: 'qc@vbiotech.com',
    displayName: 'QC Analyst',
    role: 'QC',
  };

  let mockBatch: Batch;
  let mockTestResults: TestResult[];
  let mockRepo: IBatchRepository;
  let handlers: BatchWorkflowHandlers;
  let service: BatchAppService;

  beforeEach(() => {
    mockBatch = {
      id: 'batch_test_001',
      batchNo: 'LOT-2026-001',
      productId: 'prod_001',
      product: { id: 'prod_001', name: 'Paracetamol 500mg', code: 'PARA-500' } as any,
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      theoreticalYield: 1000,
      actualYield: 980,
      yieldUnit: 'Hộp',
      status: 'TESTING',
      version: 1,
      bprReviewStatus: 'DRAFT',
      tccsSnapshot: {
        id: 'tccs_001',
        code: 'TCCS-PARA-001',
        mainQualityCriteria: [{ name: 'Định lượng', type: 'NUMBER', min: 95, max: 105, unit: '%' }],
        safetyCriteria: [],
      } as any,
    };

    mockTestResults = [
      {
        id: 'tr_001',
        batchId: 'batch_test_001',
        status: 'APPROVED',
        reviewStatus: 'APPROVED',
        evaluationSnapshot: { isPassed: true } as any,
        results: [
          {
            criteriaName: 'Định lượng',
            value: 99.5,
            isPass: true,
          } as any,
        ],
      } as any,
    ];

    mockRepo = {
      findAll: vi.fn(async () => [mockBatch]),
      findById: vi.fn(async (id: string) => (id === mockBatch.id ? mockBatch : null)),
      findByBatchNo: vi.fn(async (no: string) => (no === mockBatch.batchNo ? mockBatch : null)),
      findByProductId: vi.fn(async () => [mockBatch]),
      findByStatus: vi.fn(async () => [mockBatch]),
      save: vi.fn(async (b: Batch) => b),
      update: vi.fn(async (b: Batch) => b),
      delete: vi.fn(async () => {}),
      updateStatus: vi.fn(async () => {}),
      updateProgress: vi.fn(async () => {}),
      updateBprReview: vi.fn(async (_id, status, meta) => {
        mockBatch = {
          ...mockBatch,
          bprReviewStatus: status,
          version: (mockBatch.version ?? 1) + 1,
          ...meta,
        };
        return mockBatch;
      }),
    };

    handlers = new BatchWorkflowHandlers(mockRepo);
    service = new BatchAppService(mockRepo);
  });

  // =========================================================================
  // 1. BPR STATE MACHINE LIFECYCLE TESTS
  // =========================================================================
  describe('1. BPR State Machine Lifecycle (Phase 1)', () => {
    it('Chuyển trạng thái tuần tự: DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED', () => {
      // DRAFT -> SUBMITTED
      const s1 = BprStateMachine.resolveNextBprStatus('BPR_SUBMIT', 'DRAFT');
      expect(s1).toBe('SUBMITTED');

      // SUBMITTED -> UNDER_REVIEW
      const s2 = BprStateMachine.resolveNextBprStatus('BPR_START_REVIEW', s1);
      expect(s2).toBe('UNDER_REVIEW');

      // UNDER_REVIEW -> APPROVED
      const s3 = BprStateMachine.resolveNextBprStatus('BPR_APPROVE', s2);
      expect(s3).toBe('APPROVED');
    });

    it('Chuyển trạng thái từ chối: UNDER_REVIEW -> REJECTED -> SUBMITTED', () => {
      const s1 = BprStateMachine.resolveNextBprStatus('BPR_REJECT', 'UNDER_REVIEW');
      expect(s1).toBe('REJECTED');

      // Nộp lại sau khi bị từ chối
      const s2 = BprStateMachine.resolveNextBprStatus('BPR_SUBMIT', s1);
      expect(s2).toBe('SUBMITTED');
    });

    it('CẤM DRAFT -> APPROVED trực tiếp', () => {
      expect(() => {
        BprStateMachine.resolveNextBprStatus('BPR_APPROVE', 'DRAFT');
      }).toThrow(/cấm phê duyệt BPR trực tiếp từ DRAFT/i);
    });

    it('CẤM SUBMITTED -> APPROVED trực tiếp (bắt buộc phải qua UNDER_REVIEW)', () => {
      expect(() => {
        BprStateMachine.resolveNextBprStatus('BPR_APPROVE', 'SUBMITTED');
      }).toThrow(/phải được thẩm tra ở trạng thái 'UNDER_REVIEW'/i);
    });

    it('Kiểm tra quyền hạn BPR: QA và ADMIN được phép, USER/QC bị từ chối', () => {
      expect(() => BprStateMachine.verifyRole('BPR_APPROVE', 'QA')).not.toThrow();
      expect(() => BprStateMachine.verifyRole('BPR_APPROVE', 'ADMIN')).not.toThrow();

      expect(() => BprStateMachine.verifyRole('BPR_APPROVE', 'USER')).toThrow(
        /không có thẩm quyền/i
      );
      expect(() => BprStateMachine.verifyRole('BPR_APPROVE', 'QC')).toThrow(/không có thẩm quyền/i);
      expect(() => BprStateMachine.verifyRole('BPR_START_REVIEW', 'USER')).toThrow(
        /không có thẩm quyền/i
      );
      expect(() => BprStateMachine.verifyRole('BPR_REJECT', 'QC')).toThrow(/không có thẩm quyền/i);
    });
  });

  // =========================================================================
  // 2. BPR AUDIT TRAIL & METADATA TESTS
  // =========================================================================
  describe('2. BPR Handler & Persistence (Phase 1 & 2)', () => {
    it('QA Approve BPR ghi nhận bprReviewedAt, bprReviewedBy, bprReviewComment và KHÔNG ghi đè releasedAt', async () => {
      mockBatch.bprReviewStatus = 'UNDER_REVIEW';

      const updated = await service.approveBpr(mockBatch.id, qaUser, {
        comment: 'Hồ sơ sản xuất đạt chuẩn GMP-WHO.',
      });

      expect(updated.bprReviewStatus).toBe('APPROVED');
      expect(updated.bprReviewedBy).toBe(qaUser.email);
      expect(updated.bprReviewedAt).toBeDefined();
      expect(updated.bprReviewComment).toBe('Hồ sơ sản xuất đạt chuẩn GMP-WHO.');

      // Bất biến: releasedAt và releasedBy không được chạm vào
      expect(updated.releasedAt).toBeUndefined();
      expect(updated.releasedBy).toBeUndefined();
      expect(updated.status).toBe('TESTING'); // Batch status vẫn là TESTING
    });

    it('Từ chối BPR bắt buộc phải có lý do giải trình', async () => {
      mockBatch.bprReviewStatus = 'UNDER_REVIEW';

      await expect(service.rejectBpr(mockBatch.id, '', qaUser)).rejects.toThrow(/lý do từ chối/i);
    });
  });

  // =========================================================================
  // 3. 7 RELEASE GATES TESTS (FAIL-CLOSED)
  // =========================================================================
  describe('3. 7 Release Gates Evaluation (Phase 3 - 6 & 12)', () => {
    it('Gate 6 FAIL khi BPR chưa được QA phê duyệt -> cannot release', () => {
      mockBatch.bprReviewStatus = 'UNDER_REVIEW';

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'QA',
      });

      expect(decision.eligible).toBe(false);
      const gate6 = decision.gates.find((g) => g.gateIndex === 6);
      expect(gate6).toBeDefined();
      expect(gate6!.passed).toBe(false);
      expect(gate6!.blockers[0]).toContain('ERR_BPR_NOT_APPROVED');
    });

    it('Gate 6 PASS khi BPR được QA APPROVED', () => {
      mockBatch.bprReviewStatus = 'APPROVED';

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'QA',
      });

      const gate6 = decision.gates.find((g) => g.gateIndex === 6);
      expect(gate6).toBeDefined();
      expect(gate6!.passed).toBe(true);
    });

    it('Gate 7 FAIL khi thiếu chữ ký điện tử -> cannot release (ERR_SIGNATURE_MISSING)', () => {
      mockBatch.bprReviewStatus = 'APPROVED';

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        // userSignature is undefined
      });

      expect(decision.eligible).toBe(false);
      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(false);
      expect(gate7!.blockers[0]).toContain('ERR_SIGNATURE_MISSING');
    });

    it('Gate 7 FAIL khi chữ ký thuộc documentType khác (BATCH, BATCH_REJECT, COA_ISSUE)', async () => {
      mockBatch.bprReviewStatus = 'APPROVED';

      const wrongTypeSig: ElectronicSignature = {
        id: 'sig_001',
        documentType: 'BATCH_REJECT', // Sai documentType!
        documentId: mockBatch.id,
        signerUid: qaUser.id,
        signerName: qaUser.displayName,
        signerEmail: qaUser.email,
        role: 'QA',
        meaning: 'Testing',
        signedAt: new Date().toISOString(),
        checksum: 'checksum_placeholder',
      };
      wrongTypeSig.checksum = await computeSignatureChecksum(wrongTypeSig);

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: wrongTypeSig,
      });

      expect(decision.eligible).toBe(false);
      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(false);
      expect(gate7!.blockers[0]).toContain('ERR_SIGNATURE_MISMATCH');
    });

    it('Gate 7 FAIL khi documentId trong chữ ký không khớp với Batch ID', async () => {
      mockBatch.bprReviewStatus = 'APPROVED';

      const wrongIdSig: ElectronicSignature = {
        id: 'sig_002',
        documentType: 'BATCH_RELEASE',
        documentId: 'another_batch_999', // Sai documentId!
        signerUid: qaUser.id,
        signerName: qaUser.displayName,
        signerEmail: qaUser.email,
        role: 'QA',
        meaning: 'Release approval',
        signedAt: new Date().toISOString(),
        checksum: '',
      };
      wrongIdSig.checksum = await computeSignatureChecksum(wrongIdSig);

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: wrongIdSig,
      });

      expect(decision.eligible).toBe(false);
      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(false);
      expect(gate7!.blockers[0]).toContain('ERR_SIGNATURE_MISMATCH');
    });

    it('Gate 7 FAIL khi người ký có vai trò không đủ thẩm quyền (USER, QC)', async () => {
      mockBatch.bprReviewStatus = 'APPROVED';

      const unauthorizedSig: ElectronicSignature = {
        id: 'sig_003',
        documentType: 'BATCH_RELEASE',
        documentId: mockBatch.id,
        signerUid: regularUser.id,
        signerName: regularUser.displayName,
        signerEmail: regularUser.email,
        role: 'USER', // Không có thẩm quyền ký
        meaning: 'Release approval',
        signedAt: new Date().toISOString(),
        checksum: '',
      };
      unauthorizedSig.checksum = await computeSignatureChecksum(unauthorizedSig);

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'USER',
        userSignature: unauthorizedSig,
      });

      expect(decision.eligible).toBe(false);
      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(false);
      expect(
        gate7!.blockers.some(
          (b) =>
            b.includes('ERR_ROLE_UNAUTHORIZED') || b.includes('ERR_SIGNATURE_ROLE_UNAUTHORIZED')
        )
      ).toBe(true);
    });

    it('Gate 7 FAIL khi phát hiện checksum giả lập (sig_auto_*, mock, valid-checksum)', () => {
      mockBatch.bprReviewStatus = 'APPROVED';

      const fakeSig: ElectronicSignature = {
        id: 'sig_004',
        documentType: 'BATCH_RELEASE',
        documentId: mockBatch.id,
        signerUid: qaUser.id,
        signerName: qaUser.displayName,
        signerEmail: qaUser.email,
        role: 'QA',
        meaning: 'Release approval',
        signedAt: new Date().toISOString(),
        checksum: 'sig_auto_12345678', // Fake mock checksum!
      };

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: fakeSig,
      });

      expect(decision.eligible).toBe(false);
      const gate7 = decision.gates.find((g) => g.gateIndex === 7);
      expect(gate7!.passed).toBe(false);
      expect(gate7!.blockers.some((b) => b.includes('ERR_SIGNATURE_TAMPERED'))).toBe(true);
    });

    it('Gate 7 PASS và 7/7 gates PASS khi chữ ký hợp lệ của QA/ADMIN', async () => {
      mockBatch.bprReviewStatus = 'APPROVED';

      const validSig: ElectronicSignature = {
        id: 'sig_005',
        documentType: 'BATCH_RELEASE',
        documentId: mockBatch.id,
        documentVersion: mockBatch.version,
        signerUid: qaUser.id,
        signerName: qaUser.displayName,
        signerEmail: qaUser.email,
        role: 'QA',
        meaning:
          'Tôi xác nhận và phê duyệt xuất xưởng Lô sản xuất này theo đúng tiêu chuẩn chất lượng và hồ sơ lô.',
        signedAt: new Date().toISOString(),
        checksum: '',
      };
      validSig.checksum = await computeSignatureChecksum(validSig);

      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: mockBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: validSig,
      });

      expect(decision.eligible).toBe(true);
      expect(decision.blockers).toHaveLength(0);
      expect(decision.gates).toHaveLength(7);
      expect(decision.gates.every((g) => g.passed)).toBe(true);
    });
  });

  // =========================================================================
  // 4. E2E FLOW TESTS (TESTING -> BPR APPROVE -> SIGN -> RELEASED)
  // =========================================================================
  describe('4. Complete End-to-End Release Flow (Phase 9 & 10)', () => {
    it('Chạy đầy đủ: TESTING -> BPR SUBMIT -> START REVIEW -> APPROVE -> SIGN -> RELEASED', async () => {
      // Bước 1: Batch khởi đầu ở TESTING, BPR ở DRAFT
      expect(mockBatch.status).toBe('TESTING');
      expect(mockBatch.bprReviewStatus).toBe('DRAFT');

      // Bước 2: Nộp BPR (SUBMIT)
      const submittedBatch = await service.submitBpr(mockBatch.id, qaUser);
      expect(submittedBatch.bprReviewStatus).toBe('SUBMITTED');

      // Bước 3: QA Bắt đầu thẩm tra (START_REVIEW)
      const reviewingBatch = await service.startBprReview(mockBatch.id, qaUser);
      expect(reviewingBatch.bprReviewStatus).toBe('UNDER_REVIEW');

      // Bước 4: QA Phê duyệt BPR (APPROVE)
      const approvedBprBatch = await service.approveBpr(mockBatch.id, qaUser, {
        comment: 'Kiểm tra BPR đầy đủ, thông số đạt tiêu chuẩn.',
      });
      expect(approvedBprBatch.bprReviewStatus).toBe('APPROVED');
      expect(approvedBprBatch.status).toBe('TESTING'); // Vẫn là TESTING

      // Bước 5: Đánh giá Release trước khi ký -> Gate 1-6 PASS, Gate 7 thiếu chữ ký
      const preSignDecision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: approvedBprBatch,
        testResults: mockTestResults,
        userRole: 'QA',
      });
      const gates1to6Pass = preSignDecision.gates.slice(0, 6).every((g) => g.passed);
      expect(gates1to6Pass).toBe(true);
      expect(preSignDecision.eligible).toBe(false); // Chưa ký nên chưa eligible

      // Bước 6: Tạo chữ ký BATCH_RELEASE thật
      const releaseSig: ElectronicSignature = {
        id: 'sig_release_real_001',
        documentType: 'BATCH_RELEASE',
        documentId: approvedBprBatch.id,
        documentVersion: approvedBprBatch.version,
        signerUid: qaUser.id,
        signerName: qaUser.displayName,
        signerEmail: qaUser.email,
        role: 'QA',
        meaning:
          'Tôi xác nhận và phê duyệt xuất xưởng Lô sản xuất này theo đúng tiêu chuẩn chất lượng và hồ sơ lô.',
        signedAt: new Date().toISOString(),
        checksum: '',
      };
      releaseSig.checksum = await computeSignatureChecksum(releaseSig);

      // Bước 7: Re-evaluate 7 Gates với chữ ký thật
      const postSignDecision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch: approvedBprBatch,
        testResults: mockTestResults,
        userRole: 'QA',
        userSignature: releaseSig,
      });
      expect(postSignDecision.eligible).toBe(true);

      // Bước 8: Dispatch BATCH_RELEASE_APPROVE qua Workflow Kernel
      const releasedBatch = await service.approveRelease(approvedBprBatch.id, qaUser, {
        signature: releaseSig,
        batchTestResults: mockTestResults,
      });

      expect(releasedBatch.status).toBe('RELEASED');
      expect(releasedBatch.releasedAt).toBeDefined();
      expect(releasedBatch.releasedBy).toBe(qaUser.email);
    });
  });

  // =========================================================================
  // 5. SECURITY & FORBIDDEN MUTATIONS TESTS
  // =========================================================================
  describe('5. Security Guardrails & Anti-Bypass', () => {
    it('USER không có quyền approve BPR', async () => {
      mockBatch.bprReviewStatus = 'UNDER_REVIEW';

      await expect(service.approveBpr(mockBatch.id, regularUser)).rejects.toThrow(
        /không có thẩm quyền/i
      );
    });

    it('USER không có quyền ký xuất xưởng BATCH_RELEASE_APPROVE', async () => {
      mockBatch.bprReviewStatus = 'APPROVED';

      await expect(
        service.approveRelease(mockBatch.id, regularUser, {
          batchTestResults: mockTestResults,
        })
      ).rejects.toThrow(/Từ chối quyền|không được phép|ERR_ROLE_UNAUTHORIZED|không có thẩm quyền/i);
    });

    it('Cấm direct status mutation gọi updateBatchStatusService', async () => {
      await expect(updateBatchStatusService(mockBatch.id, 'RELEASED')).rejects.toThrow(
        /FORBIDDEN STATUS MUTATION/i
      );
    });
  });
});
