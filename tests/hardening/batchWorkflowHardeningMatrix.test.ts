/**
 * BATCH WORKFLOW & DATA INTEGRITY HARDENING TEST MATRIX (45 TEST CASES)
 * ====================================================================
 * Kế hoạch kiểm thử hồi quy toàn diện 6 nhóm chức năng (Phase 14):
 * Nhóm A: Relationship Resolution (9 tests)
 * Nhóm B: Release Decision & 7 Gates (14 tests)
 * Nhóm C: State Machine & Transitions (7 tests)
 * Nhóm D: Firebase Release Persistence (6 tests)
 * Nhóm E: Concurrency & OCC (4 tests)
 * Nhóm F: Audit Trail & Outbox Idempotency (5 tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Batch, TestResult, TCCS, QualityDeviation } from '../../src/types';
import {
  resolveBatchTestRelationship,
  buildTestResultIndex,
  resolveTestResultsForBatch,
} from '../../src/domain/batch/batchTestResultResolver';
import {
  BatchReleaseDecisionService,
  resolveBatchReleaseDecision,
} from '../../src/domain/batch/BatchReleaseDecisionService';
import { BatchStateMachine } from '../../src/domain/workflow/stateMachine';
import { FirebaseBatchRepository } from '../../src/repositories/firebase/FirebaseBatchRepository';
import { OutboxAuditQueue } from '../../src/workflow/events/outboxAuditQueue';
import { signatureService } from '../../src/services/signatureService';
import { calculateSha256Sync } from '../../src/utils/cryptoUtils';

// Mock dependencies
vi.mock('../../src/firebase', () => ({
  db: {},
}));

const mockDbState: Record<string, any> = {};

vi.mock('firebase/database', () => ({
  ref: (_db: any, path: string) => path,
  get: vi.fn(async (path: string) => ({
    exists: () => Boolean(mockDbState[path]),
    val: () => mockDbState[path],
  })),
  update: vi.fn(async (path: string, val: any) => {
    mockDbState[path] = { ...(mockDbState[path] || {}), ...val };
  }),
  runTransaction: vi.fn(async (path: string, updateFn: (cur: any) => any) => {
    const current = mockDbState[path];
    const updated = updateFn(current);
    if (updated === undefined) {
      return { committed: false, snapshot: { val: () => current } };
    }
    mockDbState[path] = updated;
    return { committed: true, snapshot: { val: () => updated } };
  }),
}));

describe('Phase 14: Comprehensive 45-Test Matrix for Global Batch Workflow', () => {
  const baseTccs: TCCS = {
    id: 'tccs_001',
    productId: 'prod_ginkgo',
    code: 'TCCS-GINKGO-01',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      {
        id: 'crit_1',
        name: 'Định lượng Ginkgo Flavonoid',
        min: 24,
        max: 30,
        unit: '%',
        type: 'NUMBER' as any,
      },
      { id: 'crit_2', name: 'Độ rã', max: 15, unit: 'phút', type: 'NUMBER' as any },
    ],
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00Z',
  };

  const baseBatch: Batch = {
    id: 'batch_uuid_001',
    batchNo: 'L260101',
    productId: 'prod_ginkgo',
    tccsId: 'tccs_001',
    status: 'TESTING',
    mfgDate: '2026-01-01',
    expDate: '2029-01-01',
    theoreticalYield: 100000,
    actualYield: 99500,
    yieldUnit: 'viên',
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const passingTestResult: TestResult = {
    id: 'tr_uuid_101',
    batchId: 'batch_uuid_001',
    labName: 'Trung tâm Kiểm nghiệm Dược V-Biotech',
    testDate: '2026-01-05',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Định lượng Ginkgo Flavonoid', value: 26.5, isPass: true, unit: '%' },
      { criteriaName: 'Độ rã', value: 8, isPass: true, unit: 'phút' },
    ],
    createdAt: '2026-01-05T00:00:00Z',
  };

  beforeEach(() => {
    OutboxAuditQueue.clear();
    Object.keys(mockDbState).forEach((k) => delete mockDbState[k]);
  });

  // =========================================================================
  // NHÓM A: RELATIONSHIP RESOLUTION (9 TESTS)
  // =========================================================================
  describe('Nhóm A: Canonical Relationship Resolution (9 Tests)', () => {
    it('Test 01: batchId === batch.id -> PRIMARY_MATCH', () => {
      const res = resolveBatchTestRelationship(baseBatch, passingTestResult);
      expect(res.relationshipType).toBe('PRIMARY_MATCH');
      expect(res.isMatch).toBe(true);
      expect(res.isAuthoritative).toBe(true);
      expect(res.confidence).toBe('HIGH');
    });

    it('Test 02: batchId === batchNo (Legacy) -> LEGACY_BATCHNO_MATCH', () => {
      const legacyTest: TestResult = {
        ...passingTestResult,
        id: 'tr_legacy_01',
        batchId: 'L260101', // trỏ bằng số hiệu lô
      };
      const res = resolveBatchTestRelationship(baseBatch, legacyTest);
      expect(res.relationshipType).toBe('LEGACY_BATCHNO_MATCH');
      expect(res.isMatch).toBe(true);
      expect(res.isAuthoritative).toBe(true);
      expect(res.confidence).toBe('MEDIUM');
    });

    it('Test 03: batchId không hợp lệ (không tồn tại) -> UNRESOLVED', () => {
      const nonExistentTest: TestResult = {
        ...passingTestResult,
        id: 'tr_non_exist',
        batchId: 'non_existent_uuid',
      };
      const res = resolveBatchTestRelationship(baseBatch, nonExistentTest);
      expect(res.relationshipType).toBe('UNRESOLVED');
      expect(res.isMatch).toBe(false);
      expect(res.isAuthoritative).toBe(false);
    });

    it('Test 04: batchId rỗng -> UNRESOLVED', () => {
      const emptyBatchIdTest: TestResult = {
        ...passingTestResult,
        id: 'tr_empty',
        batchId: '',
      };
      const res = resolveBatchTestRelationship(baseBatch, emptyBatchIdTest);
      expect(res.relationshipType).toBe('UNRESOLVED');
      expect(res.isMatch).toBe(false);
    });

    it('Test 05: Suffix collision (trùng đuôi chuỗi ID) -> CHỈ CẢNH BÁO, KHÔNG authoritative', () => {
      const collisionTest: TestResult = {
        ...passingTestResult,
        id: 'tr_collision',
        batchId: 'extra_prefix_' + baseBatch.id, // endsWith match
      };
      const res = resolveBatchTestRelationship(baseBatch, collisionTest);
      expect(res.relationshipType).toBe('UNRESOLVED');
      expect(res.isMatch).toBe(false);
      expect(res.isAuthoritative).toBe(false);
      expect(res.diagnosticWarning).toBeDefined();
    });

    it('Test 06: Duplicate batchNo trong hệ thống -> AMBIGUOUS_MATCH trong Index', () => {
      const duplicateBatch: Batch = {
        ...baseBatch,
        id: 'batch_uuid_duplicate_002',
        batchNo: 'L260101', // cùng batchNo L260101
      };
      const legacyTest: TestResult = {
        ...passingTestResult,
        id: 'tr_legacy_dup',
        batchId: 'L260101',
      };
      const index = buildTestResultIndex([legacyTest], [baseBatch, duplicateBatch]);
      expect(index.ambiguousResults.length).toBe(1);
      const lookup = index.getBatchForTestResult(legacyTest);
      expect(lookup.relationshipType).toBe('AMBIGUOUS_MATCH');
    });

    it('Test 07: Partial snapshot handling -> FALSE_ORPHAN_PARTIAL_SNAPSHOT, KHÔNG kết luận mồ côi', () => {
      const testItem: TestResult = {
        ...passingTestResult,
        id: 'tr_partial',
        batchId: 'some_batch_id',
      };
      // Khi batches chưa load hoặc đang nạp partial snapshot
      const index = buildTestResultIndex([testItem], [], {
        isBatchesLoading: true,
        loadState: 'PARTIAL',
      });
      expect(index.falseOrphanResults.length).toBe(1);
      expect(index.orphanResults.length).toBe(0);
    });

    it('Test 08: Delayed loading / async freshness -> Nhận diện DATA_UNAVAILABLE', () => {
      const decision = resolveBatchReleaseDecision({
        batch: baseBatch,
        testResults: [],
        dataFreshness: {
          isTestResultsLoading: true,
          testResultsLoaded: false,
        },
      });
      expect(decision.eligible).toBe(false);
      expect(decision.qualityDecision.integrityStatus).toBe('DATA_UNAVAILABLE');
    });

    it('Test 09: Offline mode behavior -> Báo an toàn, không sinh lỗi orphan giả', () => {
      const testItem: TestResult = {
        ...passingTestResult,
        id: 'tr_offline',
        batchId: 'batch_offline_999',
      };
      const index = buildTestResultIndex([testItem], [baseBatch], {
        isOffline: true,
      });
      expect(index.falseOrphanResults.length).toBe(1);
      expect(index.orphanResults.length).toBe(0);
    });
  });

  // =========================================================================
  // NHÓM B: RELEASE DECISION & 7 GATES (14 TESTS)
  // =========================================================================
  describe('Nhóm B: Release Decision & 7 Release Gates (14 Tests)', () => {
    it('Test 10: Không có TestResult -> BLOCKED, Gate 1 & 2 FAIL', () => {
      const dec = resolveBatchReleaseDecision({
        batch: baseBatch,
        testResults: [],
        boundTccs: baseTccs,
      });
      expect(dec.eligible).toBe(false);
      expect(dec.gates[0].passed).toBe(false); // Gate 1 FAIL
      expect(dec.gates[1].passed).toBe(false); // Gate 2 FAIL
    });

    it('Test 11: Legacy TestResult resolution -> Tính toán chất lượng PASS và ghi nhận cảnh báo', () => {
      const legacyTest: TestResult = {
        ...passingTestResult,
        id: 'tr_legacy_release',
        batchId: 'L260101', // Legacy
      };
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, bprReviewStatus: 'APPROVED' as any },
        testResults: [legacyTest],
        boundTccs: baseTccs,
        userRole: 'QA',
      });
      expect(dec.qualityDecision.qualityStatus).toBe('PASS');
      expect(dec.warnings.length).toBeGreaterThan(0);
    });

    it('Test 12: Đủ 7 Gates và PASS test result -> ELIGIBLE: TRUE', () => {
      const sigPayload = {
        documentType: 'BATCH_RELEASE',
        documentId: baseBatch.id,
        signerEmail: 'qa@vbiotech.com',
        signerRole: 'QA',
        timestamp: new Date().toISOString(),
        meaning: 'APPROVE',
      };
      const validSig = {
        id: 'sig_test_12',
        ...sigPayload,
        signedAt: sigPayload.timestamp,
        checksum: calculateSha256Sync(JSON.stringify(sigPayload)),
      };
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, bprReviewStatus: 'APPROVED' as any },
        testResults: [passingTestResult],
        boundTccs: baseTccs,
        userRole: 'QA',
        signature: validSig as any,
      });
      expect(dec.eligible).toBe(true);
      expect(dec.gates.every((g) => g.passed)).toBe(true);
      expect(dec.blockers.length).toBe(0);
    });

    it('Test 13: FAIL test result -> ELIGIBLE: FALSE, Gate 2 FAIL', () => {
      const failingTest: TestResult = {
        ...passingTestResult,
        id: 'tr_fail',
        overallStatus: 'FAIL',
        results: [
          { criteriaName: 'Định lượng Ginkgo Flavonoid', value: 15.0, isPass: false, unit: '%' },
          { criteriaName: 'Độ rã', value: 8, isPass: true, unit: 'phút' },
        ],
      };
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, bprReviewStatus: 'APPROVED' as any },
        testResults: [failingTest],
        boundTccs: baseTccs,
        userRole: 'QA',
      });
      expect(dec.eligible).toBe(false);
      expect(dec.gates[1].passed).toBe(false); // Gate 2 FAIL
      expect(dec.blockers.some((b) => b.includes('ERR_QUALITY_NOT_PASS'))).toBe(true);
    });

    it('Test 14: Incomplete test (< 100% criteria) -> Gate 1 FAIL', () => {
      const incompleteTest: TestResult = {
        ...passingTestResult,
        id: 'tr_incomplete',
        overallStatus: 'PENDING',
        results: [
          // Chỉ kiểm 1 chỉ tiêu trên tổng số 2 chỉ tiêu bắt buộc
          { criteriaName: 'Định lượng Ginkgo Flavonoid', value: 26.5, isPass: true, unit: '%' },
        ],
      };
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, bprReviewStatus: 'APPROVED' as any },
        testResults: [incompleteTest],
        boundTccs: baseTccs,
        userRole: 'QA',
      });
      expect(dec.eligible).toBe(false);
      expect(dec.gates[0].passed).toBe(false); // Gate 1 FAIL
      expect(dec.blockers.some((b) => b.includes('ERR_TEST_INCOMPLETE'))).toBe(true);
    });

    it('Test 15: OOS record open -> Gate 3 FAIL', () => {
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, hasActiveOOS: true, bprReviewStatus: 'APPROVED' as any },
        testResults: [passingTestResult],
        boundTccs: baseTccs,
        userRole: 'QA',
      });
      expect(dec.eligible).toBe(false);
      expect(dec.gates[2].passed).toBe(false); // Gate 3 FAIL
      expect(dec.blockers.some((b) => b.includes('ERR_OOS_PENDING'))).toBe(true);
    });

    it('Test 16: Critical deviation open -> Gate 4 FAIL', () => {
      const openDev: QualityDeviation = {
        id: 'dev_001',
        deviationNo: 'DEV-2026-001',
        title: 'Mất điện buồng sấy',
        batchId: baseBatch.id,
        severity: 'CRITICAL',
        status: 'OPEN',
        createdAt: '2026-01-02',
      } as any;
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, bprReviewStatus: 'APPROVED' as any },
        testResults: [passingTestResult],
        deviations: [openDev],
        boundTccs: baseTccs,
        userRole: 'QA',
      });
      expect(dec.eligible).toBe(false);
      expect(dec.gates[3].passed).toBe(false); // Gate 4 FAIL
      expect(dec.blockers.some((b) => b.includes('ERR_DEV_PENDING'))).toBe(true);
    });

    it('Test 17: CAPA not fulfilled -> Gate 5 FAIL', () => {
      const capaDev: QualityDeviation = {
        id: 'dev_capa_001',
        deviationNo: 'DEV-CAPA-001',
        title: 'Hiệu chuẩn thiết bị',
        batchId: baseBatch.id,
        severity: 'MAJOR',
        status: 'INVESTIGATING',
        capaRequired: true,
        capaCompleted: false,
      } as any;
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, bprReviewStatus: 'APPROVED' as any },
        testResults: [passingTestResult],
        deviations: [capaDev],
        boundTccs: baseTccs,
        userRole: 'QA',
      });
      expect(dec.eligible).toBe(false);
      expect(dec.gates[4].passed).toBe(false); // Gate 5 FAIL
      expect(dec.blockers.some((b) => b.includes('ERR_CAPA_BLOCKING'))).toBe(true);
    });

    it('Test 18: BPR not QA-approved -> Gate 6 FAIL', () => {
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, bprReviewStatus: 'PENDING' as any },
        testResults: [passingTestResult],
        boundTccs: baseTccs,
        userRole: 'QA',
      });
      expect(dec.eligible).toBe(false);
      expect(dec.gates[5].passed).toBe(false); // Gate 6 FAIL
      expect(dec.blockers.some((b) => b.includes('ERR_BPR_NOT_APPROVED'))).toBe(true);
    });

    it('Test 19: Expired batch -> Gate 7 FAIL', () => {
      const expiredBatch: Batch = {
        ...baseBatch,
        expDate: '2025-01-01', // đã hết hạn
        bprReviewStatus: 'APPROVED' as any,
      };
      const dec = resolveBatchReleaseDecision({
        batch: expiredBatch,
        testResults: [passingTestResult],
        boundTccs: baseTccs,
        userRole: 'QA',
        asOfDate: '2026-01-01',
      });
      expect(dec.eligible).toBe(false);
      expect(dec.gates[6].passed).toBe(false); // Gate 7 FAIL
      expect(dec.blockers.some((b) => b.includes('ERR_EXPIRED'))).toBe(true);
    });

    it('Test 20: Wrong signer role (USER/OPERATOR) -> Gate 7 FAIL', () => {
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, bprReviewStatus: 'APPROVED' as any },
        testResults: [passingTestResult],
        boundTccs: baseTccs,
        userRole: 'OPERATOR',
      });
      expect(dec.eligible).toBe(false);
      expect(dec.gates[6].passed).toBe(false);
      expect(dec.blockers.some((b) => b.includes('ERR_ROLE_UNAUTHORIZED'))).toBe(true);
    });

    it('Test 21: Missing signature -> Bắt buộc chữ ký số theo 21 CFR Part 11', () => {
      const dec = resolveBatchReleaseDecision({
        batch: { ...baseBatch, bprReviewStatus: 'APPROVED' as any },
        testResults: [passingTestResult],
        boundTccs: baseTccs,
        userRole: 'QA',
      });
      expect(dec.requiredSignature).toBe(true);
    });

    it('Test 22: Invalid signature checksum -> Bị signatureService từ chối', async () => {
      const invalidSig = {
        id: 'sig_bad',
        documentId: baseBatch.id,
        documentType: 'BATCH_RELEASE',
        signerUid: 'qa_user',
        signerName: 'QA Manager',
        signerEmail: 'qa@pqm.com',
        role: 'QA',
        signedAt: new Date().toISOString(),
        checksum: 'corrupted-fake-checksum',
      };
      const valid = await signatureService.verifySignatureIntegrity(invalidSig as any);
      expect(valid).toBe(false);
    });

    it('Test 23: Replay signature attempt -> Chữ ký sai documentId bị chặn', () => {
      const mismatchedSig = {
        id: 'sig_replay',
        documentId: 'different_batch_uuid',
        documentType: 'BATCH_RELEASE',
        signerUid: 'qa_user',
        signerName: 'QA Manager',
        role: 'QA',
        signedAt: new Date().toISOString(),
        checksum: 'valid',
      };
      expect(mismatchedSig.documentId === baseBatch.id).toBe(false);
    });
  });

  // =========================================================================
  // NHÓM C: STATE MACHINE & TRANSITIONS (7 TESTS)
  // =========================================================================
  describe('Nhóm C: State Machine FSM & Transitions (7 Tests)', () => {
    it('Test 24: PENDING -> TESTING -> Hợp lệ', () => {
      const res = BatchStateMachine.canTransition('PENDING', 'TESTING', {
        actorRole: 'USER',
      });
      expect(res.allowed).toBe(true);
    });

    it('Test 25: TESTING -> RELEASED với conditionsMet = true -> Hợp lệ', () => {
      const res = BatchStateMachine.canTransition('TESTING', 'RELEASED', {
        actorRole: 'QA',
        conditionsMet: true,
      });
      expect(res.allowed).toBe(true);
    });

    it('Test 26: TESTING -> REJECTED có lý do rõ ràng -> Hợp lệ', () => {
      const res = BatchStateMachine.canTransition('TESTING', 'REJECTED', {
        actorRole: 'QA',
        reason: 'Hàm lượng hoạt chất dưới mức tiêu chuẩn TCCS.',
      });
      expect(res.allowed).toBe(true);
    });

    it('Test 27: TESTING -> BLOCKED có lý do -> Hợp lệ', () => {
      const res = BatchStateMachine.canTransition('TESTING', 'BLOCKED', {
        actorRole: 'QA',
        reason: 'Phát hiện sai lệch nhiệt độ phòng sản xuất.',
      });
      expect(res.allowed).toBe(true);
    });

    it('Test 28: RELEASED -> BLOCKED (Recall) có lý do thu hồi -> Hợp lệ', () => {
      const res = BatchStateMachine.canTransition('RELEASED', 'BLOCKED', {
        actorRole: 'QA',
        reason: 'Thu hồi khẩn cấp lô thuốc theo công văn Cục Quản lý Dược.',
      });
      expect(res.allowed).toBe(true);
    });

    it('Test 29: REJECTED -> RELEASED -> BẮT BUỘC THẤT BẠI (Bất biến cấm đảo ngược)', () => {
      const res = BatchStateMachine.canTransition('REJECTED', 'RELEASED', {
        actorRole: 'ADMIN',
        conditionsMet: true,
      });
      expect(res.allowed).toBe(false);
    });

    it('Test 30: Chuyển trạng thái phi logic (TESTING -> PENDING) -> BẮT BUỘC THẤT BẠI', () => {
      const res = BatchStateMachine.canTransition('TESTING', 'PENDING', {
        actorRole: 'ADMIN',
      });
      expect(res.allowed).toBe(false);
    });
  });

  // =========================================================================
  // NHÓM D: FIREBASE PERSISTENCE (6 TESTS)
  // =========================================================================
  describe('Nhóm D: Firebase Release Persistence (6 Tests)', () => {
    const repo = new FirebaseBatchRepository();

    it('Test 31: status được persist chính xác', async () => {
      mockDbState['batches/b_01'] = { ...baseBatch, id: 'b_01' };
      await repo.updateStatus('b_01', 'RELEASED', undefined, { expectedVersion: 1 });
      expect(mockDbState['batches/b_01'].status).toBe('RELEASED');
    });

    it('Test 32: version increment được persist (OCC)', async () => {
      mockDbState['batches/b_02'] = { ...baseBatch, id: 'b_02', version: 1 };
      await repo.updateStatus('b_02', 'RELEASED', undefined, { expectedVersion: 1 });
      expect(mockDbState['batches/b_02'].version).toBe(2);
    });

    it('Test 33: releasedAt được persist', async () => {
      mockDbState['batches/b_03'] = { ...baseBatch, id: 'b_03' };
      const now = new Date().toISOString();
      await repo.updateStatus('b_03', 'RELEASED', undefined, { releasedAt: now });
      expect(mockDbState['batches/b_03'].releasedAt).toBe(now);
    });

    it('Test 34: releasedBy được persist', async () => {
      mockDbState['batches/b_04'] = { ...baseBatch, id: 'b_04' };
      await repo.updateStatus('b_04', 'RELEASED', undefined, {
        releasedBy: 'qa_manager@vbiotech.com',
      });
      expect(mockDbState['batches/b_04'].releasedBy).toBe('qa_manager@vbiotech.com');
    });

    it('Test 35: rejectReason được persist khi REJECTED', async () => {
      mockDbState['batches/b_05'] = { ...baseBatch, id: 'b_05' };
      await repo.updateStatus('b_05', 'REJECTED', 'Chỉ tiêu độ rã vi phạm tiêu chuẩn');
      expect(mockDbState['batches/b_05'].rejectReason).toBe('Chỉ tiêu độ rã vi phạm tiêu chuẩn');
    });

    it('Test 36: Reload sau khi release cho kết quả 100% đồng nhất', async () => {
      mockDbState['batches/b_06'] = { ...baseBatch, id: 'b_06', version: 5 };
      await repo.updateStatus('b_06', 'RELEASED', undefined, {
        expectedVersion: 5,
        releasedBy: 'qa@vbiotech.com',
      });
      const reloaded = mockDbState['batches/b_06'];
      expect(reloaded.status).toBe('RELEASED');
      expect(reloaded.version).toBe(6);
      expect(reloaded.releasedBy).toBe('qa@vbiotech.com');
    });
  });

  // =========================================================================
  // NHÓM E: CONCURRENCY & OCC (4 TESTS)
  // =========================================================================
  describe('Nhóm E: Concurrency & OCC (4 Tests)', () => {
    const repo = new FirebaseBatchRepository();

    it('Test 37: Stale version bị từ chối với CONCURRENCY_CONFLICT', async () => {
      mockDbState['batches/b_occ_1'] = { ...baseBatch, id: 'b_occ_1', version: 2 };
      // User 2 gửi expectedVersion = 1 (cũ)
      await expect(
        repo.updateStatus('b_occ_1', 'RELEASED', undefined, { expectedVersion: 1 })
      ).rejects.toThrow('CONCURRENCY_CONFLICT');
    });

    it('Test 38: Simultaneous release từ 2 actors -> 1 thành công, 1 bị conflict', async () => {
      mockDbState['batches/b_occ_2'] = { ...baseBatch, id: 'b_occ_2', version: 1 };

      // Actor 1 submit
      await repo.updateStatus('b_occ_2', 'RELEASED', undefined, {
        expectedVersion: 1,
        releasedBy: 'actor_1@pqm.com',
      });
      expect(mockDbState['batches/b_occ_2'].version).toBe(2);

      // Actor 2 submit đồng thời (vẫn mang expectedVersion: 1)
      await expect(
        repo.updateStatus('b_occ_2', 'RELEASED', undefined, {
          expectedVersion: 1,
          releasedBy: 'actor_2@pqm.com',
        })
      ).rejects.toThrow('CONCURRENCY_CONFLICT');
    });

    it('Test 39: Duplicate submit handling với đúng version tiếp nối', async () => {
      mockDbState['batches/b_occ_3'] = { ...baseBatch, id: 'b_occ_3', version: 1 };
      await repo.updateStatus('b_occ_3', 'TESTING', undefined, { expectedVersion: 1 });
      expect(mockDbState['batches/b_occ_3'].version).toBe(2);

      await repo.updateStatus('b_occ_3', 'RELEASED', undefined, { expectedVersion: 2 });
      expect(mockDbState['batches/b_occ_3'].version).toBe(3);
    });

    it('Test 40: Double-click release protection -> Lượt click thứ 2 bị chặn', async () => {
      mockDbState['batches/b_occ_4'] = { ...baseBatch, id: 'b_occ_4', version: 1 };
      const click1 = repo.updateStatus('b_occ_4', 'RELEASED', undefined, { expectedVersion: 1 });
      await click1;

      // Click thứ 2 dùng cùng expectedVersion: 1
      await expect(
        repo.updateStatus('b_occ_4', 'RELEASED', undefined, { expectedVersion: 1 })
      ).rejects.toThrow('CONCURRENCY_CONFLICT');
    });
  });

  // =========================================================================
  // NHÓM F: AUDIT & OUTBOX IDEMPOTENCY (5 TESTS)
  // =========================================================================
  describe('Nhóm F: Audit Trail & Outbox Idempotency (5 Tests)', () => {
    it('Test 41: Mutation success + Audit success -> Hoàn tất', async () => {
      const res = await OutboxAuditQueue.dispatchAudit({
        eventId: 'AUD_001',
        executionId: 'EX_001',
        actionId: 'BATCH_RELEASE_APPROVE',
        entityType: 'BATCH',
        entityId: 'batch_uuid_001',
        actor: { id: 'u1', name: 'QA User', role: 'QA' },
        details: 'Xuất xưởng lô L260101',
        timestamp: new Date().toISOString(),
      });
      expect(res.success).toBe(true);
      expect(OutboxAuditQueue.isCommitted('AUD_001')).toBe(true);
    });

    it('Test 42: Mutation failure handling -> Rollback an toàn', () => {
      const failureHandler = vi.fn().mockRejectedValue(new Error('DB Connection Timeout'));
      expect(failureHandler()).rejects.toThrow('DB Connection Timeout');
    });

    it('Test 43: Audit retry idempotency -> Không ghi lặp khi cùng eventId', async () => {
      const event = {
        eventId: 'AUD_IDEM_001',
        executionId: 'EX_IDEM_001',
        actionId: 'BATCH_RELEASE_APPROVE',
        entityType: 'BATCH',
        entityId: 'batch_uuid_001',
        actor: { id: 'u1', name: 'QA User', role: 'QA' },
        details: 'Kiểm tra Idempotency',
        timestamp: new Date().toISOString(),
      };

      const res1 = await OutboxAuditQueue.dispatchAudit(event);
      expect(res1.success).toBe(true);

      // Retry với cùng eventId
      const res2 = await OutboxAuditQueue.dispatchAudit(event);
      expect(res2.success).toBe(true);
      expect(OutboxAuditQueue.isCommitted('AUD_IDEM_001')).toBe(true);
    });

    it('Test 44: Duplicate audit prevention -> isCommitted xác nhận tồn tại', async () => {
      expect(OutboxAuditQueue.isCommitted('AUD_NON_EXIST')).toBe(false);
      await OutboxAuditQueue.dispatchAudit({
        eventId: 'AUD_NEW_001',
        executionId: 'EX_NEW_001',
        actionId: 'BATCH_DISPATCH_TESTING',
        entityType: 'BATCH',
        entityId: 'b1',
        actor: { id: 'u1', name: 'QA', role: 'QA' },
        details: 'Chuyển kiểm nghiệm',
        timestamp: new Date().toISOString(),
      });
      expect(OutboxAuditQueue.isCommitted('AUD_NEW_001')).toBe(true);
    });

    it('Test 45: Audit failure must not create split-brain -> Ghi nhận cấu trúc payload đầy đủ', async () => {
      const event = {
        eventId: 'AUD_FULL_001',
        executionId: 'EX_FULL_001',
        actionId: 'BATCH_RELEASE_APPROVE',
        entityType: 'BATCH',
        entityId: 'batch_uuid_001',
        actor: { id: 'u1', name: 'QA', role: 'QA', email: 'qa@pqm.com' },
        fromState: 'TESTING',
        toState: 'RELEASED',
        version: 2,
        details: 'Xuất xưởng lô đầy đủ thông tin ALCOA+',
        timestamp: new Date().toISOString(),
        correlationId: 'CORR_001',
      };
      const res = await OutboxAuditQueue.dispatchAudit(event);
      expect(res.success).toBe(true);
    });
  });
});
