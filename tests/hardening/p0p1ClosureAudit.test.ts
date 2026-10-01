/**
 * P0/P1 CLOSURE AUDIT - GLOBAL BATCH WORKFLOW E2E VERIFICATION MATRIX
 *
 * Kiểm tra và đóng toàn bộ đường bypass còn sót sau v11.36.0:
 * - 0 BPR bypass
 * - 0 conditionsMet bypass
 * - 0 auto signature
 * - 0 mock checksum
 * - 0 unsafe transaction fallback
 * - 0 mutation/audit split-brain
 * - 0 false orphan khi data partial
 * - 0 authoritative suffix match
 * - 0 ambiguous relationship auto-repair
 * - 0 duplicate release
 * - 0 stale-version release
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchReleaseDecisionService } from '../../src/domain/batch/BatchReleaseDecisionService';
import { BatchStateMachine } from '../../src/domain/workflow/stateMachine';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import { OutboxAuditQueue } from '../../src/workflow/events/outboxAuditQueue';
import { UnifiedWorkflowExecutor } from '../../src/workflow/kernel/workflowExecutor';
import {
  resolveTestResultsForBatch,
  buildTestResultIndex,
} from '../../src/domain/batch/batchTestResultResolver';
import { resolveCanonicalBatchQualityDecision } from '../../src/domain/batch/canonicalBatchQualityDecision';
import { Batch, TestResult, TCCS } from '../../src/types';
import { calculateSha256Sync } from '../../src/utils/cryptoUtils';
import * as auditService from '../../src/services/auditService';

vi.mock('../../src/services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

describe('P0/P1 Closure Audit - Global Batch Workflow Suite', () => {
  const mockTccs: TCCS = {
    id: 'tccs-001',
    productId: 'prod-001',
    code: 'TCCS-PARACETAMOL',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      { id: 'c1', name: 'Định lượng', min: 95, max: 105, unit: '%', type: 'NUMBER' as any },
    ],
    safetyCriteria: [],
    createdAt: '2026-01-01',
  };

  const passingTestResult: TestResult = {
    id: 'tr-001',
    batchId: 'batch-001',
    productId: 'prod-001',
    status: 'APPROVED',
    overallStatus: 'PASS',
    labName: 'Lab QC Central',
    testDate: '2026-01-10',
    results: [{ criteriaName: 'Định lượng', value: 100.1, isPass: true }],
    createdAt: '2026-01-10T00:00:00Z',
  };

  const validQaActor = {
    id: 'qa-user-1',
    name: 'QA Lead',
    role: 'QA',
    email: 'qa@pqm.com',
  };

  beforeEach(() => {
    OutboxAuditQueue.clear();
    vi.clearAllMocks();
  });

  // =========================================================================
  // CASE 01: TESTING + no BPR -> BLOCK
  // =========================================================================
  it('CASE 01: TESTING + no BPR -> BLOCK (Gate 6 Fail-Closed)', () => {
    const batchWithoutBpr: Batch = {
      id: 'batch-001',
      batchNo: 'B2026-001',
      productId: 'prod-001',
      status: 'TESTING',
      // bprReviewStatus undefined
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      createdAt: '2026-01-01',
    };

    const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch: batchWithoutBpr,
      testResults: [passingTestResult],
      boundTccs: mockTccs,
      userRole: 'QA',
    });

    expect(decision.eligible).toBe(false);
    const gate6 = decision.gates.find((g) => g.gateIndex === 6);
    expect(gate6?.passed).toBe(false);
    expect(decision.blockers.some((b) => b.includes('ERR_BPR_NOT_APPROVED'))).toBe(true);
  });

  // =========================================================================
  // CASE 02: TESTING + BPR APPROVED + no signature -> BLOCK
  // =========================================================================
  it('CASE 02: TESTING + BPR APPROVED + no signature -> BLOCK (Gate 7 Fail-Closed)', () => {
    const batchWithBpr: Batch = {
      id: 'batch-001',
      batchNo: 'B2026-001',
      productId: 'prod-001',
      status: 'TESTING',
      bprReviewStatus: 'APPROVED',
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      createdAt: '2026-01-01',
    };

    const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch: batchWithBpr,
      testResults: [passingTestResult],
      boundTccs: mockTccs,
      userRole: 'QA',
      // userSignature missing
    });

    expect(decision.eligible).toBe(false);
    const gate7 = decision.gates.find((g) => g.gateIndex === 7);
    expect(gate7?.passed).toBe(false);
    expect(decision.blockers.some((b) => b.includes('ERR_SIGNATURE_MISSING'))).toBe(true);
  });

  // =========================================================================
  // CASE 03: TESTING + BPR APPROVED + invalid signature -> BLOCK
  // =========================================================================
  it('CASE 03: TESTING + BPR APPROVED + invalid signature (mock/auto/tampered) -> BLOCK', () => {
    const batchWithBpr: Batch = {
      id: 'batch-001',
      batchNo: 'B2026-001',
      productId: 'prod-001',
      status: 'TESTING',
      bprReviewStatus: 'APPROVED',
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      createdAt: '2026-01-01',
    };

    // 3a. Mock checksum
    const mockSig: any = {
      documentType: 'BATCH_RELEASE',
      documentId: 'batch-001',
      signerEmail: 'qa@pqm.com',
      signerRole: 'QA',
      signedAt: new Date().toISOString(),
      checksum: 'valid-checksum', // Bị cấm
    };
    const decMock = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch: batchWithBpr,
      testResults: [passingTestResult],
      boundTccs: mockTccs,
      userRole: 'QA',
      userSignature: mockSig,
    });
    expect(decMock.eligible).toBe(false);
    expect(decMock.blockers.some((b) => b.includes('ERR_SIGNATURE_TAMPERED'))).toBe(true);

    // 3b. Mismatched Document ID (chữ ký của batch khác)
    const mismatchSig: any = {
      documentType: 'BATCH_RELEASE',
      documentId: 'batch-OTHER-999',
      signerEmail: 'qa@pqm.com',
      signerRole: 'QA',
      signedAt: new Date().toISOString(),
      checksum: calculateSha256Sync('batch-OTHER-999'),
    };
    const decMismatch = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch: batchWithBpr,
      testResults: [passingTestResult],
      boundTccs: mockTccs,
      userRole: 'QA',
      userSignature: mismatchSig,
    });
    expect(decMismatch.eligible).toBe(false);
    expect(decMismatch.blockers.some((b) => b.includes('ERR_SIGNATURE_MISMATCH'))).toBe(true);
  });

  // =========================================================================
  // CASE 04: TESTING + BPR APPROVED + valid signature -> RELEASED
  // =========================================================================
  it('CASE 04: TESTING + BPR APPROVED + valid signature -> PASS all 7 gates and RELEASED', () => {
    const batchWithBpr: Batch = {
      id: 'batch-001',
      batchNo: 'B2026-001',
      productId: 'prod-001',
      status: 'TESTING',
      bprReviewStatus: 'APPROVED',
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      createdAt: '2026-01-01',
    };

    const validSig: any = {
      documentType: 'BATCH_RELEASE',
      documentId: 'batch-001',
      signerEmail: 'qa@pqm.com',
      signerRole: 'QA',
      signedAt: new Date().toISOString(),
      checksum: calculateSha256Sync('batch-001'),
    };

    const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch: batchWithBpr,
      testResults: [passingTestResult],
      boundTccs: mockTccs,
      userRole: 'QA',
      userSignature: validSig,
    });

    expect(decision.eligible).toBe(true);
    expect(decision.gates.every((g) => g.passed)).toBe(true);
    expect(decision.blockers.length).toBe(0);
  });

  // =========================================================================
  // CASE 05: Concurrent release A/B -> only one succeeds (OCC)
  // =========================================================================
  it('CASE 05: Concurrent release A/B -> Stale version rejected with CONCURRENCY_CONFLICT', async () => {
    let repoVersion = 1;
    let updateCount = 0;

    const validBatch: Batch = {
      id: 'batch-occ',
      batchNo: 'LOT-OCC-01',
      status: 'TESTING',
      bprReviewStatus: 'APPROVED',
      version: 1,
      createdAt: '2026-01-01',
    };

    const mockRepo: any = {
      findById: vi
        .fn()
        .mockImplementation(async (id) => ({ ...validBatch, id, version: repoVersion })),
      updateStatus: vi.fn().mockImplementation(async (_id, _status, _reason, metadata) => {
        if (metadata?.expectedVersion !== undefined && metadata.expectedVersion !== repoVersion) {
          throw new Error('CONCURRENCY_CONFLICT: Phiên bản không khớp');
        }
        repoVersion++;
        updateCount++;
      }),
    };

    const handlers = new BatchWorkflowHandlers(mockRepo);

    const validSig = {
      id: 'sig-01',
      documentType: 'BATCH_RELEASE',
      documentId: 'batch-occ',
      signerEmail: 'qa@pqm.com',
      signerRole: 'QA',
      signedAt: new Date().toISOString(),
      checksum: calculateSha256Sync('batch-occ'),
    };

    // Release A (version 1 -> version 2)
    await handlers.handleStatusTransition('batch-occ', 'RELEASED', validQaActor as any, {
      currentBatch: validBatch,
      batchTestResults: [{ ...passingTestResult, batchId: 'batch-occ' }],
      signature: validSig,
      expectedVersion: 1,
    });
    expect(updateCount).toBe(1);

    // Release B concurrent với expectedVersion 1 (stale)
    await expect(
      handlers.handleStatusTransition('batch-occ', 'RELEASED', validQaActor as any, {
        currentBatch: { ...validBatch, version: 1 },
        batchTestResults: [{ ...passingTestResult, batchId: 'batch-occ' }],
        signature: validSig,
        expectedVersion: 1, // Stale version
      })
    ).rejects.toThrow(/CONCURRENCY_CONFLICT/);

    expect(updateCount).toBe(1); // Chỉ 1 lần duy nhất được commit
  });

  // =========================================================================
  // CASE 06: Firebase transaction error -> no mutation (Fail-Closed)
  // =========================================================================
  it('CASE 06: Firebase transaction error -> no mutation and error rethrown (Fail-Closed)', async () => {
    const validBatch: Batch = {
      id: 'batch-001',
      batchNo: 'B2026-001',
      status: 'TESTING',
      bprReviewStatus: 'APPROVED',
      version: 1,
      createdAt: '2026-01-01',
    };

    const mockRepo: any = {
      findById: vi.fn().mockResolvedValue(validBatch),
      updateStatus: vi.fn().mockRejectedValue(new Error('FIREBASE_PERMISSION_DENIED_PRODUCTION')),
    };

    const handlers = new BatchWorkflowHandlers(mockRepo);

    const validSig = {
      id: 'sig-01',
      documentType: 'BATCH_RELEASE',
      documentId: 'batch-001',
      signerEmail: 'qa@pqm.com',
      signerRole: 'QA',
      signedAt: new Date().toISOString(),
      checksum: calculateSha256Sync('batch-001'),
    };

    await expect(
      handlers.handleStatusTransition('batch-001', 'RELEASED', validQaActor as any, {
        currentBatch: validBatch,
        batchTestResults: [passingTestResult],
        signature: validSig,
        expectedVersion: 1,
      })
    ).rejects.toThrow('FIREBASE_PERMISSION_DENIED_PRODUCTION');
  });

  // =========================================================================
  // CASE 07: Audit temporary failure -> durable outbox remains pending/retry
  // =========================================================================
  it('CASE 07: Audit temporary failure -> outbox marks RETRYING without workflow split-brain failure', async () => {
    vi.mocked(auditService.logAuditAction).mockRejectedValue(new Error('Network temporary drop'));

    let mutationCommitted = false;
    const result = await UnifiedWorkflowExecutor.execute(
      {
        actionId: 'BATCH_RELEASE_APPROVE',
        entityType: 'BATCH',
        entityId: 'batch-split-brain-guard',
        actor: validQaActor,
        expectedVersion: 1,
        payload: { status: 'RELEASED' },
        reason: 'Phê duyệt xuất xưởng lô đạt chuẩn GMP',
        confirmationToken: 'RELEASE',
        signature: {
          id: 'sig-01',
          documentType: 'BATCH_RELEASE',
          documentId: 'batch-split-brain-guard',
          signerEmail: 'qa@pqm.com',
          signerRole: 'QA',
          signedAt: new Date().toISOString(),
          checksum: calculateSha256Sync('batch-split-brain-guard'),
        },
      },
      async () => {
        mutationCommitted = true;
        return { released: true };
      }
    );

    // Mutation đã thành công
    expect(mutationCommitted).toBe(true);
    // Workflow thành công (không để split-brain DB Released nhưng workflow báo lỗi)
    expect(result.success).toBe(true);
    expect(result.auditStatus).toBe('RETRYING');

    // Sự kiện được bảo toàn bền vững trong Outbox
    const queue = OutboxAuditQueue.getQueue();
    const event = queue.find((e) => e.entityId === 'batch-split-brain-guard');
    expect(event).toBeDefined();
    expect(event?.state).toBe('RETRYING');
    expect(event?.eventId).toBe('AUD-BATCH-batch-split-brain-guard-BATCH_RELEASE_APPROVE-v2');
  });

  // =========================================================================
  // CASE 08: Partial TestResult snapshot -> DATA_UNAVAILABLE
  // =========================================================================
  it('CASE 08: Partial TestResult snapshot -> returns DATA_UNAVAILABLE (no false missing test result)', () => {
    const releasedBatch: Batch = {
      id: 'batch-partial',
      batchNo: 'LOT-PARTIAL',
      status: 'RELEASED',
      createdAt: '2026-01-01',
    };

    // Khi data testResults đang tải (loadState = 'PARTIAL' hoặc isTestResultsLoading = true)
    const decision = resolveCanonicalBatchQualityDecision({
      batch: releasedBatch,
      testResults: [], // Chưa có kết quả nạp xong
      dataFreshness: {
        isTestResultsLoading: true,
        loadState: 'PARTIAL',
      },
    });

    expect(decision.integrityStatus).toBe('DATA_UNAVAILABLE');
    expect(decision.integrityStatus).not.toBe('MISSING_TEST_RESULT');
    expect(decision.shouldAlert).toBe(false);
  });

  // =========================================================================
  // CASE 09: Legacy batchNo TestResult -> correct relationship
  // =========================================================================
  it('CASE 09: Legacy batchNo TestResult -> correctly mapped with LEGACY_BATCH_NO relationship', () => {
    const batch: Batch = {
      id: 'batch-technical-id-123',
      batchNo: 'B2026-LOT-789',
      status: 'TESTING',
      createdAt: '2026-01-01',
    };

    // Test result chỉ có batchId = 'B2026-LOT-789' (số lô thay vì ID kỹ thuật)
    const legacyTr: TestResult = {
      id: 'tr-legacy-01',
      batchId: 'B2026-LOT-789',
      status: 'APPROVED',
      overallStatus: 'PASS',
      createdAt: '2026-01-01',
    };

    const resolution = resolveTestResultsForBatch(batch, [legacyTr]);
    expect(resolution.hasPrimaryMatch).toBe(false);
    expect(resolution.hasLegacyMatch).toBe(true);
    expect(resolution.legacyResults).toHaveLength(1);
    expect(resolution.legacyResults[0].id).toBe('tr-legacy-01');
  });

  // =========================================================================
  // CASE 10: Ambiguous batchNo -> BLOCK / AMBIGUOUS
  // =========================================================================
  it('CASE 10: Ambiguous batchNo across multiple batches -> AMBIGUOUS_MATCH (no auto-repair)', () => {
    const batchA: Batch = {
      id: 'batch-id-A',
      batchNo: 'DUPLICATE-LOT',
      status: 'TESTING',
      createdAt: '2026-01-01',
    };
    const batchB: Batch = {
      id: 'batch-id-B',
      batchNo: 'DUPLICATE-LOT',
      status: 'TESTING',
      createdAt: '2026-01-01',
    };

    const tr: TestResult = {
      id: 'tr-ambiguous',
      batchId: 'DUPLICATE-LOT', // Trùng cả batchA và batchB
      createdAt: '2026-01-01',
    };

    const index = buildTestResultIndex([tr], [batchA, batchB]);
    const res = index.getBatchForTestResult(tr);
    expect(res.relationshipType).toBe('AMBIGUOUS_MATCH');
    expect(res.batch).toBeUndefined();
  });

  // =========================================================================
  // CASE 11: Primary draft + Legacy approved -> verify authoritative selection
  // =========================================================================
  it('CASE 11: Primary draft + Legacy approved -> selects Legacy approved as Authoritative with decisionTrace', () => {
    const batch: Batch = {
      id: 'batch-tech-11',
      batchNo: 'LOT-REV-11',
      status: 'TESTING',
      createdAt: '2026-01-01',
    };

    // Primary trỏ đúng batchId nhưng chỉ là bản nháp (DRAFT)
    const primaryDraftTr: TestResult = {
      id: 'tr-primary-draft',
      batchId: 'batch-tech-11',
      status: 'DRAFT',
      overallStatus: 'PENDING',
      results: [{ criteriaName: 'Định lượng', value: 98, isPass: true }],
      createdAt: '2026-01-02',
    };

    // Legacy liên kết qua batchNo nhưng đã APPROVED chính thức
    const legacyApprovedTr: TestResult = {
      id: 'tr-legacy-approved',
      batchId: 'LOT-REV-11',
      status: 'APPROVED',
      overallStatus: 'PASS',
      results: [{ criteriaName: 'Định lượng', value: 100.2, isPass: true }],
      createdAt: '2026-01-01',
    };

    const decision = resolveCanonicalBatchQualityDecision({
      batch,
      testResults: [primaryDraftTr, legacyApprovedTr],
      boundTccs: mockTccs,
    });

    // Authoritative result phải là phiếu Legacy Approved (không bị bỏ mù quáng)
    expect(decision.supremeTestResultId).toBe('tr-legacy-approved');
    expect(decision.decisionTrace?.authoritativeSelectionReason).toBe(
      'LEGACY_APPROVED_OVER_PRIMARY_DRAFT'
    );
    expect(decision.qualityStatus).toBe('PASS');
  });

  // =========================================================================
  // CASE 12: Duplicate reportNo across batches -> AMBIGUOUS (no auto-repair)
  // =========================================================================
  it('CASE 12: Duplicate reportNo across batches -> AMBIGUOUS_MATCH (blocks incorrect peer recovery)', () => {
    const batch1: Batch = {
      id: 'batch-01',
      batchNo: 'LOT-01',
      productId: 'PROD-A',
      status: 'TESTING',
      createdAt: '2026-01-01',
    };
    const batch2: Batch = {
      id: 'batch-02',
      batchNo: 'LOT-02',
      productId: 'PROD-B',
      status: 'TESTING',
      createdAt: '2026-01-01',
    };

    // Peer 1 đã gắn batch-01
    const peer1: TestResult = {
      id: 'peer-1',
      batchId: 'batch-01',
      reportNo: 'KN-2026-DUPLICATE',
      productId: 'PROD-A',
      createdAt: '2026-01-01',
    };

    // Peer 2 đã gắn batch-02
    const peer2: TestResult = {
      id: 'peer-2',
      batchId: 'batch-02',
      reportNo: 'KN-2026-DUPLICATE',
      productId: 'PROD-B',
      createdAt: '2026-01-01',
    };

    // Phiếu r bị mất batchId, chỉ có reportNo trùng
    const orphanR: TestResult = {
      id: 'tr-orphan-r',
      batchId: '',
      reportNo: 'KN-2026-DUPLICATE',
      createdAt: '2026-01-01',
    };

    const index = buildTestResultIndex([peer1, peer2, orphanR], [batch1, batch2]);
    const res = index.getBatchForTestResult(orphanR);

    // Không tự động recovery khi reportNo bị trùng trên nhiều batch khác nhau
    expect(res.relationshipType).toBe('AMBIGUOUS_MATCH');
    expect(res.batch).toBeUndefined();
  });
});
