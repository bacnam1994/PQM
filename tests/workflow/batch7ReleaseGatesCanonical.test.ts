/**
 * BATCH 7 RELEASE GATES CANONICAL & INTEGRITY TEST SUITE (PHASE 20)
 *
 * Kiểm tra 8 test case bắt buộc theo Phase 20:
 * - CASE 1: Gate 1-5 PASS, Gate 6 FAIL, Gate 7 FAIL -> Batch status = TESTING, Release = 5/7, Current Gate = 6
 * - CASE 2: Gate 1-6 PASS, Gate 7 signature missing -> Batch status = TESTING, Release = 6/7, Current Gate = 7
 * - CASE 3: Gate 1-6 PASS, Gate 7 valid signature -> Release = 7/7, READY_TO_RELEASE, sau đó BATCH_RELEASE_APPROVE -> RELEASED
 * - CASE 4: WRONG VERSION -> Batch v10, thay đổi v11, ký documentVersion = 10 -> Gate 7 FAIL, ERR_SIGNATURE_VERSION_MISMATCH
 * - CASE 5: WRONG SIGNATURE TYPE -> BATCH_REJECT -> Gate 7 FAIL, ERR_SIGNATURE_MISMATCH
 * - CASE 6: WRONG ROLE -> USER -> Gate 7 FAIL, ERR_SIGNATURE_ROLE_UNAUTHORIZED
 * - CASE 7: FAKE SIGNATURE -> sig_auto_*, mock, valid-checksum -> Gate 7 FAIL, ERR_SIGNATURE_TAMPERED
 * - CASE 8: RELOAD -> Sau khi 6/7, reload browser/fetch -> 6/7, Gate 7, không quay về 100% Chờ kiểm nghiệm
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchReleaseDecisionService } from '../../src/domain/batch/BatchReleaseDecisionService';
import { BatchReleaseProgressService } from '../../src/domain/batch/BatchReleaseProgressService';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import { BatchAppService } from '../../src/domains/batch/application/service';
import { IBatchRepository } from '../../src/repositories/BatchRepository';
import { Batch, TestResult, ElectronicSignature } from '../../src/types';
import { computeSignatureChecksum } from '../../src/services/signatureService';

describe('Batch 7 Release Gates Canonical Tests (Phase 20 Requirements)', () => {
  const qaUser = {
    id: 'usr_qa',
    email: 'qa@vbiotech.com',
    displayName: 'QA Manager',
    role: 'QA',
  };

  const regularUser = {
    id: 'usr_regular',
    email: 'user@vbiotech.com',
    displayName: 'Regular User',
    role: 'USER',
  };

  let mockBatch: Batch;
  let mockTestResults: TestResult[];
  let mockRepo: IBatchRepository;
  let handlers: BatchWorkflowHandlers;
  let service: BatchAppService;

  beforeEach(() => {
    mockBatch = {
      id: 'batch_canonical_001',
      batchNo: 'LOT-CANONICAL-2026',
      productId: 'prod_001',
      product: { id: 'prod_001', name: 'Amoxicillin 500mg', code: 'AMOX-500' } as any,
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      theoreticalYield: 1000,
      actualYield: 980,
      yieldUnit: 'Hộp',
      status: 'TESTING',
      version: 10,
      bprReviewStatus: 'UNDER_REVIEW',
      progressPercent: 100,
      hasActiveOOS: false,
      hasActiveDeviation: false,
      tccsSnapshot: {
        id: 'tccs_001',
        code: 'TCCS-AMOX-001',
        mainQualityCriteria: [{ name: 'Định lượng', type: 'NUMBER', min: 95, max: 105, unit: '%' }],
        safetyCriteria: [],
      } as any,
    };

    mockTestResults = [
      {
        id: 'tr_001',
        batchId: 'batch_canonical_001',
        status: 'APPROVED',
        reviewStatus: 'APPROVED',
        evaluationSnapshot: { isPassed: true } as any,
        results: [
          {
            criteriaName: 'Định lượng',
            value: 99.8,
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
      findTestResultsByBatchId: vi.fn(async (id: string) =>
        mockTestResults.filter((r) => r.batchId === id)
      ),
      save: vi.fn(async (b: Batch) => b),
      update: vi.fn(async (b: Batch) => {
        mockBatch = { ...b };
        return mockBatch;
      }),
      delete: vi.fn(async () => {}),
      updateStatus: vi.fn(async (_id, status, _reason, meta) => {
        mockBatch = {
          ...mockBatch,
          status: status as any,
          version: (meta?.expectedVersion ?? mockBatch.version ?? 1) + 1,
          ...meta,
        };
      }),
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
      updateReleaseProgress: vi.fn(async (_id, stage, progress) => {
        mockBatch = {
          ...mockBatch,
          releaseStage: stage,
          releaseGateProgress: progress,
        };
      }),
    };

    handlers = new BatchWorkflowHandlers(mockRepo);
    service = new BatchAppService(mockRepo);
  });

  // CASE 1: Gate 1-5 PASS, Gate 6 FAIL, Gate 7 FAIL
  it('CASE 1: Gate 1-5 PASS, Gate 6 FAIL -> Batch status = TESTING, Release = 5/7, Current Gate = 6', () => {
    mockBatch.bprReviewStatus = 'UNDER_REVIEW'; // Gate 6 FAIL
    mockBatch.status = 'TESTING';

    const progress = BatchReleaseProgressService.resolveReleaseProgress({
      batch: mockBatch,
      testResults: mockTestResults,
      userRole: 'QA',
    });

    expect(mockBatch.status).toBe('TESTING');
    expect(progress.releaseGateProgress.completed).toBe(5);
    expect(progress.releaseGateProgress.total).toBe(7);
    expect(progress.releaseGateProgress.currentGate).toBe(6);
    expect(progress.releaseStage).toBe('GATE_6');
    expect(progress.readyForFinalApproval).toBe(false);
  });

  // CASE 2: Gate 1-6 PASS, Gate 7 signature missing
  it('CASE 2: Gate 1-6 PASS, Gate 7 signature missing -> Batch status = TESTING, Release = 6/7, Current Gate = 7', () => {
    mockBatch.bprReviewStatus = 'APPROVED'; // Gate 6 PASS
    mockBatch.status = 'TESTING';

    const progress = BatchReleaseProgressService.resolveReleaseProgress({
      batch: mockBatch,
      testResults: mockTestResults,
      userRole: 'QA',
      // no userSignature
    });

    expect(mockBatch.status).toBe('TESTING');
    expect(progress.releaseGateProgress.completed).toBe(6);
    expect(progress.releaseGateProgress.total).toBe(7);
    expect(progress.releaseGateProgress.currentGate).toBe(7);
    expect(progress.releaseGateProgress.percentage).toBe(86);
    expect(progress.releaseStage).toBe('GATE_7');
    expect(progress.readyForFinalApproval).toBe(true);

    const gate7 = progress.gateResults.find((g) => g.gateIndex === 7);
    expect(gate7).toBeDefined();
    expect(gate7!.passed).toBe(false);
    expect(gate7!.status).toBe('WAITING');
    expect(gate7!.blockers?.[0]).toContain('ERR_SIGNATURE_MISSING');
  });

  // CASE 3: Gate 1-6 PASS, Gate 7 valid signature -> 7/7 READY_TO_RELEASE -> BATCH_RELEASE_APPROVE -> RELEASED
  it('CASE 3: Gate 1-6 PASS, Gate 7 valid signature -> Release = 7/7, READY_TO_RELEASE, sau đó BATCH_RELEASE_APPROVE -> RELEASED', async () => {
    mockBatch.bprReviewStatus = 'APPROVED';

    const validSig: ElectronicSignature = {
      id: 'sig_valid_001',
      documentType: 'BATCH_RELEASE',
      documentId: mockBatch.id,
      documentVersion: mockBatch.version,
      signerUid: qaUser.id,
      signerName: qaUser.displayName,
      signerEmail: qaUser.email,
      role: 'QA',
      meaning: 'Phê duyệt xuất xưởng lô',
      signedAt: new Date().toISOString(),
      checksum: '',
    };
    validSig.checksum = await computeSignatureChecksum(validSig);

    const progress = BatchReleaseProgressService.resolveReleaseProgress({
      batch: mockBatch,
      testResults: mockTestResults,
      userRole: 'QA',
      userSignature: validSig,
    });

    expect(progress.releaseGateProgress.completed).toBe(7);
    expect(progress.releaseGateProgress.currentGate).toBe(8);
    expect(progress.releaseGateProgress.percentage).toBe(100);
    expect(progress.releaseStage).toBe('READY_TO_RELEASE');

    // Sau đó thực hiện BATCH_RELEASE_APPROVE qua service/StateMachine
    const releasedBatch = await service.approveRelease(mockBatch.id, qaUser, {
      signature: validSig,
      batchTestResults: mockTestResults,
    });

    expect(releasedBatch.status).toBe('RELEASED');
    expect(releasedBatch.releaseStage).toBe('RELEASED');
    expect(releasedBatch.releaseGateProgress?.completed).toBe(7);
    expect(releasedBatch.releaseGateProgress?.percentage).toBe(100);
  });

  // CASE 4: WRONG VERSION -> v10 vs v11 -> Gate 7 FAIL ERR_SIGNATURE_VERSION_MISMATCH
  it('CASE 4: WRONG VERSION -> Batch v10 vs ký documentVersion = 10 khi Batch đã lên v11 -> Gate 7 FAIL, ERR_SIGNATURE_VERSION_MISMATCH, KHÔNG RELEASE', async () => {
    mockBatch.bprReviewStatus = 'APPROVED';
    mockBatch.version = 11; // Batch đã thay đổi lên v11

    const staleSig: ElectronicSignature = {
      id: 'sig_stale_001',
      documentType: 'BATCH_RELEASE',
      documentId: mockBatch.id,
      documentVersion: 10, // Ký bằng snapshot cũ v10!
      signerUid: qaUser.id,
      signerName: qaUser.displayName,
      signerEmail: qaUser.email,
      role: 'QA',
      meaning: 'Phê duyệt xuất xưởng',
      signedAt: new Date().toISOString(),
      checksum: '',
    };
    staleSig.checksum = await computeSignatureChecksum(staleSig);

    const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch: mockBatch,
      testResults: mockTestResults,
      userRole: 'QA',
      userSignature: staleSig,
    });

    expect(decision.eligible).toBe(false);
    const gate7 = decision.gates.find((g) => g.gateIndex === 7);
    expect(gate7!.passed).toBe(false);
    expect(gate7!.blockers?.[0]).toContain('ERR_SIGNATURE_VERSION_MISMATCH');
    expect(gate7!.blockers?.[0]).toContain('Lô đã thay đổi sau khi mở màn hình ký');

    // Cố tình gọi approveRelease với chữ ký lệch version -> BỊ TỪ CHỐI
    await expect(
      service.approveRelease(mockBatch.id, qaUser, {
        signature: staleSig,
        batchTestResults: mockTestResults,
      })
    ).rejects.toThrow(/ERR_SIGNATURE_VERSION_MISMATCH/);

    expect(mockBatch.status).toBe('TESTING'); // Không bị chuyển sang RELEASED
  });

  // CASE 5: WRONG SIGNATURE TYPE (BATCH_REJECT)
  it('CASE 5: WRONG SIGNATURE TYPE (BATCH_REJECT) -> Gate 7 FAIL, ERR_SIGNATURE_MISMATCH', async () => {
    mockBatch.bprReviewStatus = 'APPROVED';

    const rejectSig: ElectronicSignature = {
      id: 'sig_reject_001',
      documentType: 'BATCH_REJECT', // Sai documentType
      documentId: mockBatch.id,
      documentVersion: mockBatch.version,
      signerUid: qaUser.id,
      signerName: qaUser.displayName,
      signerEmail: qaUser.email,
      role: 'QA',
      meaning: 'Từ chối lô',
      signedAt: new Date().toISOString(),
      checksum: '',
    };
    rejectSig.checksum = await computeSignatureChecksum(rejectSig);

    const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch: mockBatch,
      testResults: mockTestResults,
      userRole: 'QA',
      userSignature: rejectSig,
    });

    expect(decision.eligible).toBe(false);
    const gate7 = decision.gates.find((g) => g.gateIndex === 7);
    expect(gate7!.passed).toBe(false);
    expect(gate7!.blockers?.[0]).toContain('ERR_SIGNATURE_MISMATCH');
  });

  // CASE 6: WRONG ROLE (USER)
  it('CASE 6: WRONG ROLE (USER) -> Gate 7 FAIL, ERR_SIGNATURE_ROLE_UNAUTHORIZED', async () => {
    mockBatch.bprReviewStatus = 'APPROVED';

    const userSig: ElectronicSignature = {
      id: 'sig_user_001',
      documentType: 'BATCH_RELEASE',
      documentId: mockBatch.id,
      documentVersion: mockBatch.version,
      signerUid: regularUser.id,
      signerName: regularUser.displayName,
      signerEmail: regularUser.email,
      role: 'USER', // Sai vai trò
      meaning: 'Ký duyệt',
      signedAt: new Date().toISOString(),
      checksum: '',
    };
    userSig.checksum = await computeSignatureChecksum(userSig);

    const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch: mockBatch,
      testResults: mockTestResults,
      userRole: 'USER',
      userSignature: userSig,
    });

    expect(decision.eligible).toBe(false);
    const gate7 = decision.gates.find((g) => g.gateIndex === 7);
    expect(gate7!.passed).toBe(false);
    expect(
      gate7!.blockers?.some(
        (b) => b.includes('ERR_SIGNATURE_ROLE_UNAUTHORIZED') || b.includes('ERR_ROLE_UNAUTHORIZED')
      )
    ).toBe(true);
  });

  // CASE 7: FAKE SIGNATURE (sig_auto_*, mock, valid-checksum)
  it('CASE 7: FAKE SIGNATURE (sig_auto_*, mock, valid-checksum) -> Gate 7 FAIL, ERR_SIGNATURE_TAMPERED', () => {
    mockBatch.bprReviewStatus = 'APPROVED';

    const fakeChecksums = ['sig_auto_12345678', 'mock-signature-checksum', 'valid-checksum'];

    for (const fakeChecksum of fakeChecksums) {
      const fakeSig: ElectronicSignature = {
        id: 'sig_fake_001',
        documentType: 'BATCH_RELEASE',
        documentId: mockBatch.id,
        documentVersion: mockBatch.version,
        signerUid: qaUser.id,
        signerName: qaUser.displayName,
        signerEmail: qaUser.email,
        role: 'QA',
        meaning: 'Fake approval',
        signedAt: new Date().toISOString(),
        checksum: fakeChecksum,
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
      expect(gate7!.blockers?.some((b) => b.includes('ERR_SIGNATURE_TAMPERED'))).toBe(true);
    }
  });

  // CASE 8: RELOAD BROWSER -> Sau 6/7, reload giữ nguyên 6/7 và Gate 7
  it('CASE 8: RELOAD -> Sau khi đạt 6/7 (BPR APPROVED), fetch lại Batch từ repo vẫn giữ 6/7, Gate 7, không quay về 100% Chờ kiểm nghiệm', async () => {
    // 1. Approve BPR
    mockBatch.bprReviewStatus = 'UNDER_REVIEW';
    const approvedBatch = await service.approveBpr(mockBatch.id, qaUser, {
      comment: 'BPR hồ sơ đạt chuẩn GMP.',
    });

    expect(approvedBatch.bprReviewStatus).toBe('APPROVED');
    expect(approvedBatch.releaseStage).toBe('GATE_7');
    expect(approvedBatch.releaseGateProgress?.completed).toBe(6);
    expect(approvedBatch.releaseGateProgress?.currentGate).toBe(7);

    // 2. Giả lập reload browser (fetch fresh batch từ repo)
    const reloadedBatch = await mockRepo.findById(mockBatch.id);
    expect(reloadedBatch).toBeDefined();
    expect(reloadedBatch!.status).toBe('TESTING');
    expect(reloadedBatch!.releaseStage).toBe('GATE_7');
    expect(reloadedBatch!.releaseGateProgress?.completed).toBe(6);
    expect(reloadedBatch!.releaseGateProgress?.total).toBe(7);
    expect(reloadedBatch!.releaseGateProgress?.currentGate).toBe(7);
    expect(reloadedBatch!.releaseGateProgress?.percentage).toBe(86);
  });

  // CASE 9: PENDING BATCH -> BATCH_RELEASE_APPROVE từ chối khi PENDING, bắt buộc qua BATCH_DISPATCH_TESTING -> TESTING -> RELEASED
  it('CASE 9: PENDING BATCH -> BATCH_RELEASE_APPROVE từ chối khi PENDING, bắt buộc qua BATCH_DISPATCH_TESTING -> TESTING -> RELEASED', async () => {
    // Thiết lập lô ở PENDING nhưng đã hoàn tất kiểm nghiệm và BPR
    mockBatch = {
      ...mockBatch,
      status: 'PENDING',
      version: 10,
      bprReviewStatus: 'APPROVED',
      releaseStage: 'GATE_7',
      releaseGateProgress: {
        completed: 6,
        total: 7,
        currentGate: 7,
        percentage: 86,
        evaluatedAt: new Date().toISOString(),
      },
    };

    const validSig: ElectronicSignature = {
      id: 'sig_pending_release_001',
      documentType: 'BATCH_RELEASE',
      documentId: mockBatch.id,
      documentVersion: 11,
      signerUid: qaUser.id,
      signerName: qaUser.displayName,
      signerEmail: qaUser.email,
      role: 'QA',
      meaning: 'Phê duyệt xuất xưởng lô',
      signedAt: new Date().toISOString(),
      checksum: '',
    };
    validSig.checksum = await computeSignatureChecksum(validSig);

    // 1. Thử release trực tiếp khi PENDING -> Bắt buộc bị từ chối
    await expect(
      service.approveRelease(mockBatch.id, qaUser, {
        signature: validSig,
        batchTestResults: mockTestResults,
      })
    ).rejects.toThrow(/State Machine Violation|Không thể chuyển từ PENDING/);

    // 2. Chuyển Lô sang TESTING hợp lệ bằng dispatchTesting
    const testingBatch = await service.dispatchTesting(mockBatch.id, qaUser);
    expect(testingBatch.status).toBe('TESTING');
    expect(testingBatch.version).toBe(11);

    // 3. Thực hiện xuất xưởng từ TESTING -> Thành công 100%
    const releasedBatch = await service.approveRelease(mockBatch.id, qaUser, {
      signature: validSig,
      batchTestResults: mockTestResults,
    });

    expect(releasedBatch.status).toBe('RELEASED');
    expect(releasedBatch.releaseStage).toBe('RELEASED');
    expect(releasedBatch.releaseGateProgress?.completed).toBe(7);
    expect(releasedBatch.releaseGateProgress?.percentage).toBe(100);
  });
});
