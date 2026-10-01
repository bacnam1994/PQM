/**
 * BATCH WORKFLOW STATE TRANSITION & HARDENING AUDIT (REGRESSION SUITE)
 * ====================================================================
 * Kiểm thử toàn diện 24 yêu cầu Acceptance Criteria:
 * 1. Bảng State Machine FSM Topology (PENDING, TESTING, BLOCKED, RELEASED, REJECTED)
 * 2. Action -> Transition mapping (resolveNextState, canExecuteAction)
 * 3. Ngăn chặn triệt để Caller quyết định nextState
 * 4. Ngăn chặn generic status mutation bypass
 * 5. RELEASED là Immutable Business State (chỉ cho phép RECALL -> BLOCKED)
 * 6. REJECTED là Terminal State (không thể đảo ngược)
 * 7. Phân tách ngữ nghĩa: BLOCKED (Hold vs Recall), REJECTED, RESUME
 * 8. Semantic audit fields persistence (recalled*, held*, resumed*, rejected*)
 * 9. UI projection từ BatchStateMachine.getAvailableWorkflowActions
 * 10. OCC Version Increment & Double Transition Prevention
 * 11. Idempotency Key deduplication
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchStateMachine } from '../../src/domain/workflow/stateMachine';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import { BatchAppService } from '../../src/domains/batch/application/service';
import { Batch, TestResult, TCCS } from '../../src/types';
import { IBatchRepository } from '../../src/repositories/BatchRepository';
import { calculateSha256Sync } from '../../src/utils/cryptoUtils';
import { computeSignatureChecksum } from '../../src/services/signatureService';

// Mock Firebase RTDB to prevent real network calls and mock push/ref
vi.mock('../../src/firebase', () => ({
  db: {},
}));

vi.mock('firebase/database', () => ({
  ref: (_db: any, path: string) => path,
  push: vi.fn(() => ({ key: 'mock_key' })),
  set: vi.fn(async () => {}),
  get: vi.fn(async () => ({ exists: () => false, val: () => null })),
  update: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
  runTransaction: vi.fn(async (_path: string, updateFn: (cur: any) => any) => {
    return { committed: true, snapshot: { val: () => updateFn({}) } };
  }),
}));

describe('FINAL STATE TRANSITION AUDIT & HARDENING – BATCH WORKFLOW', () => {
  const baseTccs: TCCS = {
    id: 'tccs_001',
    productId: 'prod_001',
    code: 'TCCS-001',
    name: 'Tiêu chuẩn Ginkgo',
    version: '1.0',
    criteria: [
      {
        id: 'crit_1',
        name: 'Định lượng Ginkgo Flavonoid',
        specification: '22.0 - 27.0 %',
        minVal: 22.0,
        maxVal: 27.0,
        unit: '%',
        critical: true,
      },
      {
        id: 'crit_2',
        name: 'Độ rã',
        specification: '<= 15 phút',
        maxVal: 15,
        unit: 'phút',
        critical: false,
      },
    ],
    status: 'ACTIVE',
  };

  const passingTestResult: TestResult = {
    id: 'tr_001',
    batchId: 'b_test_01',
    tccsId: 'tccs_001',
    productId: 'prod_001',
    sampleCode: 'SMP-001',
    overallStatus: 'PASS',
    workflowStatus: 'RELEASED',
    testDate: '2026-03-01',
    results: [
      { criteriaName: 'Định lượng Ginkgo Flavonoid', value: 24.5, isPass: true, unit: '%' },
      { criteriaName: 'Độ rã', value: 8, isPass: true, unit: 'phút' },
    ],
  };

  const baseBatch: Batch = {
    id: 'b_test_01',
    batchNo: 'L2603001',
    productId: 'prod_001',
    tccsId: 'tccs_001',
    mfgDate: '2026-03-01',
    expDate: '2029-03-01',
    theoreticalYield: 100000,
    actualYield: 98500,
    yieldUnit: 'viên',
    status: 'PENDING',
    version: 1,
    tccsSnapshot: baseTccs,
    bprReviewStatus: 'APPROVED',
  };

  // Mock Repository in-memory
  let memoryDb: Record<string, Batch> = {};
  let updateStatusMock: any;

  const mockRepo: IBatchRepository = {
    save: vi.fn(async (b: Batch) => {
      memoryDb[b.id] = { ...b };
      return b;
    }),
    findById: vi.fn(async (id: string) => (memoryDb[id] ? { ...memoryDb[id] } : null)),
    findAll: vi.fn(async () => Object.values(memoryDb)),
    update: vi.fn(async (b: Batch) => {
      memoryDb[b.id] = { ...b };
      return b;
    }),
    delete: vi.fn(async (id: string) => {
      delete memoryDb[id];
    }),
    findByBatchNo: vi.fn(
      async (no: string) => Object.values(memoryDb).find((b) => b.batchNo === no) || null
    ),
    findByProductId: vi.fn(async (pid: string) =>
      Object.values(memoryDb).filter((b) => b.productId === pid)
    ),
    findByStatus: vi.fn(async (st: any) => Object.values(memoryDb).filter((b) => b.status === st)),
    updateProgress: vi.fn(async (id: string, progress: number) => {
      if (memoryDb[id]) memoryDb[id].progressPercent = progress;
    }),
    updateStatus: vi.fn(async (id: string, status: any, reason?: string, meta?: any) => {
      const cur = memoryDb[id];
      if (!cur) throw new Error('Not found');
      if (meta?.expectedVersion !== undefined && cur.version !== meta.expectedVersion) {
        throw new Error(
          `CONCURRENCY_CONFLICT: Version ${cur.version} != expected ${meta.expectedVersion}`
        );
      }
      const newVer = (cur.version || 1) + 1;
      memoryDb[id] = {
        ...cur,
        ...meta,
        status,
        version: newVer,
        updatedAt: new Date().toISOString(),
      };
    }),
    // mock helper
    findTestResultsByBatchId: vi.fn(async (_batchId: string) => [passingTestResult]),
  } as any;

  beforeEach(() => {
    memoryDb = {
      [baseBatch.id]: { ...baseBatch },
    };
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. STATE MACHINE MATRIX SSoT TESTS
  // =========================================================================
  describe('1. State Machine Topology Matrix (BatchStateMachine SSoT)', () => {
    it('PENDING: -> TESTING (YES), -> REJECTED (YES có lý do), -> BLOCKED (YES có lý do), -> RELEASED (NO)', () => {
      expect(BatchStateMachine.canTransition('PENDING', 'TESTING').allowed).toBe(true);
      expect(
        BatchStateMachine.canTransition('PENDING', 'REJECTED', {
          reason: 'Lỗi tá dược',
          actorRole: 'QA',
        }).allowed
      ).toBe(true);
      expect(
        BatchStateMachine.canTransition('PENDING', 'REJECTED', { actorRole: 'QA' }).allowed
      ).toBe(false); // thiếu lý do
      expect(
        BatchStateMachine.canTransition('PENDING', 'BLOCKED', {
          reason: 'Chờ thẩm định máy',
          actorRole: 'QA',
        }).allowed
      ).toBe(true);
      expect(BatchStateMachine.canTransition('PENDING', 'RELEASED').allowed).toBe(false); // BẤT BIẾN
    });

    it('TESTING: -> RELEASED (YES nếu đủ điều kiện), -> REJECTED (YES), -> BLOCKED (YES), -> PENDING (NO)', () => {
      expect(
        BatchStateMachine.canTransition('TESTING', 'RELEASED', {
          actorRole: 'QA',
          conditionsMet: true,
        }).allowed
      ).toBe(true);
      expect(
        BatchStateMachine.canTransition('TESTING', 'RELEASED', {
          actorRole: 'QA',
          conditionsMet: false,
        }).allowed
      ).toBe(false);
      expect(
        BatchStateMachine.canTransition('TESTING', 'REJECTED', {
          actorRole: 'QA',
          reason: 'Không đạt',
        }).allowed
      ).toBe(true);
      expect(
        BatchStateMachine.canTransition('TESTING', 'BLOCKED', {
          actorRole: 'QA',
          reason: 'Nghi ngờ nhiễm chéo',
        }).allowed
      ).toBe(true);
      expect(BatchStateMachine.canTransition('TESTING', 'PENDING').allowed).toBe(false); // BẤT BIẾN
    });

    it('BLOCKED: -> TESTING (YES nếu có lý do/retest plan), -> REJECTED (YES), -> RELEASED (NO), -> PENDING (NO)', () => {
      expect(
        BatchStateMachine.canTransition('BLOCKED', 'TESTING', {
          actorRole: 'QA',
          reason: 'Kế hoạch kiểm tra lại số 01',
        }).allowed
      ).toBe(true);
      expect(
        BatchStateMachine.canTransition('BLOCKED', 'TESTING', { actorRole: 'QA' }).allowed
      ).toBe(false); // thiếu lý do/kế hoạch
      expect(
        BatchStateMachine.canTransition('BLOCKED', 'REJECTED', {
          actorRole: 'QA',
          reason: 'Không khắc phục được',
        }).allowed
      ).toBe(true);
      expect(BatchStateMachine.canTransition('BLOCKED', 'RELEASED').allowed).toBe(false); // Phải qua TESTING trước
      expect(BatchStateMachine.canTransition('BLOCKED', 'PENDING').allowed).toBe(false);
    });

    it('RELEASED: -> BLOCKED (YES nếu là Recall có lý do), -> PENDING (NO), -> TESTING (NO), -> REJECTED (NO)', () => {
      expect(
        BatchStateMachine.canTransition('RELEASED', 'BLOCKED', {
          actorRole: 'QA',
          reason: 'Thu hồi Class I',
        }).allowed
      ).toBe(true);
      expect(
        BatchStateMachine.canTransition('RELEASED', 'BLOCKED', { actorRole: 'QA' }).allowed
      ).toBe(false); // thiếu lý do thu hồi
      expect(BatchStateMachine.canTransition('RELEASED', 'PENDING').allowed).toBe(false); // BẤT BIẾN
      expect(BatchStateMachine.canTransition('RELEASED', 'TESTING').allowed).toBe(false); // BẤT BIẾN
      expect(BatchStateMachine.canTransition('RELEASED', 'REJECTED').allowed).toBe(false); // Không dùng REJECT để recall
    });

    it('REJECTED: -> [] (TERMINAL STATE - BẤT BIẾN KHÔNG THỂ CHUYỂN TIẾP)', () => {
      expect(BatchStateMachine.getValidNextStates('REJECTED')).toEqual([]);
      expect(BatchStateMachine.canTransition('REJECTED', 'PENDING').allowed).toBe(false);
      expect(BatchStateMachine.canTransition('REJECTED', 'TESTING').allowed).toBe(false);
      expect(BatchStateMachine.canTransition('REJECTED', 'RELEASED').allowed).toBe(false);
      expect(BatchStateMachine.canTransition('REJECTED', 'BLOCKED').allowed).toBe(false);
    });
  });

  // =========================================================================
  // 2. ACTION TO TRANSITION MAPPING & CALLER RESTRICTIONS
  // =========================================================================
  describe('2. Action to Transition Mapping & Automatic Calculation', () => {
    it('resolveNextState tính đúng theo actionId và currentState', () => {
      expect(BatchStateMachine.resolveNextState('BATCH_DISPATCH_TESTING', 'PENDING')).toBe(
        'TESTING'
      );
      expect(BatchStateMachine.resolveNextState('BATCH_RELEASE_APPROVE', 'TESTING')).toBe(
        'RELEASED'
      );
      expect(BatchStateMachine.resolveNextState('BATCH_REJECT', 'PENDING')).toBe('REJECTED');
      expect(BatchStateMachine.resolveNextState('BATCH_REJECT', 'TESTING')).toBe('REJECTED');
      expect(BatchStateMachine.resolveNextState('BATCH_REJECT', 'BLOCKED')).toBe('REJECTED');
      expect(BatchStateMachine.resolveNextState('BATCH_HOLD', 'PENDING')).toBe('BLOCKED');
      expect(BatchStateMachine.resolveNextState('BATCH_HOLD', 'TESTING')).toBe('BLOCKED');
      expect(BatchStateMachine.resolveNextState('BATCH_RESUME', 'BLOCKED')).toBe('TESTING');
      expect(BatchStateMachine.resolveNextState('BATCH_RECALL', 'RELEASED')).toBe('BLOCKED');
    });

    it('resolveNextState từ chối các hành động sai trạng thái xuất phát', () => {
      expect(BatchStateMachine.resolveNextState('BATCH_RELEASE_APPROVE', 'PENDING')).toBeNull();
      expect(BatchStateMachine.resolveNextState('BATCH_RELEASE_APPROVE', 'BLOCKED')).toBeNull();
      expect(BatchStateMachine.resolveNextState('BATCH_DISPATCH_TESTING', 'RELEASED')).toBeNull();
      expect(BatchStateMachine.resolveNextState('BATCH_RECALL', 'TESTING')).toBeNull();
      expect(BatchStateMachine.resolveNextState('BATCH_RESUME', 'RELEASED')).toBeNull();
      expect(BatchStateMachine.resolveNextState('BATCH_REJECT', 'RELEASED')).toBeNull(); // Recall, not reject
    });

    it('UI projection getAvailableWorkflowActions chỉ trả về action hợp lệ', () => {
      const pendingActions = BatchStateMachine.getAvailableWorkflowActions('PENDING', 'QA');
      expect(pendingActions.map((a) => a.actionId)).toEqual([
        'BATCH_DISPATCH_TESTING',
        'BATCH_REJECT',
        'BATCH_HOLD',
      ]);

      const testingActions = BatchStateMachine.getAvailableWorkflowActions('TESTING', 'QA');
      expect(testingActions.map((a) => a.actionId)).toEqual([
        'BATCH_RELEASE_APPROVE',
        'BATCH_REJECT',
        'BATCH_HOLD',
      ]);

      const blockedActions = BatchStateMachine.getAvailableWorkflowActions('BLOCKED', 'QA');
      expect(blockedActions.map((a) => a.actionId)).toEqual(['BATCH_REJECT', 'BATCH_RESUME']);

      const releasedActions = BatchStateMachine.getAvailableWorkflowActions('RELEASED', 'QA');
      expect(releasedActions.map((a) => a.actionId)).toEqual(['BATCH_RECALL']);

      const rejectedActions = BatchStateMachine.getAvailableWorkflowActions('REJECTED', 'QA');
      expect(rejectedActions).toEqual([]); // Terminal state: không có action nào
    });
  });

  // =========================================================================
  // 3. INTENT METHODS & WORKFLOW HANDLERS EXECUTION
  // =========================================================================
  describe('3. Intent APIs & Workflow Execution', () => {
    const handlers = new BatchWorkflowHandlers(mockRepo);
    const qaUser = { id: 'usr_qa', email: 'qa@vbiotech.com', role: 'QA' };

    it('dispatchTesting: PENDING -> TESTING thành công, tăng version', async () => {
      const res = await handlers.dispatchTesting(baseBatch.id, qaUser);
      expect(res.status).toBe('TESTING');
      expect(res.version).toBe(2);
      expect(memoryDb[baseBatch.id].status).toBe('TESTING');
      expect(memoryDb[baseBatch.id].version).toBe(2);
    });

    async function createTestSignature(docId: string, docType: string) {
      const dataToHash = {
        documentType: docType as any,
        documentId: docId,
        signerUid: 'usr_qa',
        signerName: 'QA Manager',
        signerEmail: 'qa@vbiotech.com',
        role: 'QA' as any,
        meaning: 'APPROVE',
        signedAt: new Date().toISOString(),
      };
      const checksum = await computeSignatureChecksum(dataToHash);
      return {
        id: `sig_${Date.now()}_${Math.random()}`,
        ...dataToHash,
        checksum,
      } as any;
    }

    it('approveRelease: TESTING -> RELEASED thành công khi 7 gates pass, tăng version và lưu snapshot', async () => {
      memoryDb[baseBatch.id] = { ...baseBatch, status: 'TESTING', version: 2 };
      const signature = await createTestSignature(baseBatch.id, 'BATCH_RELEASE');
      const res = await handlers.approveRelease(baseBatch.id, qaUser, {
        reason: 'Đạt toàn diện 7 Release Gates',
        batchTestResults: [passingTestResult],
        signature,
      });
      expect(res.status).toBe('RELEASED');
      expect(res.version).toBe(3);
      expect(res.releasedBy).toBe('qa@vbiotech.com');
      expect(res.releasedAt).toBeDefined();
      expect(res.releaseDecisionSnapshot).toBeDefined();
      expect(res.releaseDecisionSnapshot.eligible).toBe(true);
    });

    it('approveRelease bị CHẶN khi hồ sơ BPR chưa APPROVED', async () => {
      memoryDb[baseBatch.id] = {
        ...baseBatch,
        status: 'TESTING',
        version: 2,
        bprReviewStatus: 'PENDING',
      };
      const signature = await createTestSignature(baseBatch.id, 'BATCH_RELEASE');
      await expect(
        handlers.approveRelease(baseBatch.id, qaUser, {
          batchTestResults: [passingTestResult],
          signature,
        })
      ).rejects.toThrow('Quy chuẩn GMP & Release Guard');
    });

    it('holdBatch: ghi nhận holdReason, heldAt, heldBy và chuyển sang BLOCKED', async () => {
      memoryDb[baseBatch.id] = { ...baseBatch, status: 'TESTING', version: 2 };
      const res = await handlers.holdBatch(baseBatch.id, 'Phát hiện sự cố nhiệt độ', qaUser);
      expect(res.status).toBe('BLOCKED');
      expect(res.holdReason).toBe('Phát hiện sự cố nhiệt độ');
      expect(res.heldBy).toBe('qa@vbiotech.com');
      expect(res.heldAt).toBeDefined();
      expect(res.version).toBe(3);
    });

    it('resumeBatch: BLOCKED -> TESTING ghi nhận resumeReason, resumedAt, resumedBy', async () => {
      memoryDb[baseBatch.id] = {
        ...baseBatch,
        status: 'BLOCKED',
        version: 3,
        holdReason: 'Nghi ngờ độ ẩm',
      };
      const res = await handlers.resumeBatch(
        baseBatch.id,
        'Đã hiệu chuẩn xong ẩm kế và có Retest Plan',
        qaUser
      );
      expect(res.status).toBe('TESTING');
      expect(res.resumeReason).toBe('Đã hiệu chuẩn xong ẩm kế và có Retest Plan');
      expect(res.resumedBy).toBe('qa@vbiotech.com');
      expect(res.resumedAt).toBeDefined();
      expect(res.version).toBe(4);
    });

    it('recallBatch: RELEASED -> BLOCKED ghi nhận recallReason, recalledAt, recalledBy (tách biệt hoàn toàn với reject)', async () => {
      memoryDb[baseBatch.id] = {
        ...baseBatch,
        status: 'RELEASED',
        version: 4,
        releasedAt: '2026-03-01T00:00:00Z',
        releasedBy: 'qa@vbiotech.com',
      };
      const signature = await createTestSignature(baseBatch.id, 'BATCH_RECALL');
      const res = await handlers.recallBatch(
        baseBatch.id,
        'Thu hồi khẩn cấp Class I do nhầm nhãn',
        qaUser,
        {
          signature,
        }
      );
      expect(res.status).toBe('BLOCKED');
      expect(res.recallReason).toBe('Thu hồi khẩn cấp Class I do nhầm nhãn');
      expect(res.recalledBy).toBe('qa@vbiotech.com');
      expect(res.recalledAt).toBeDefined();
      expect(res.rejectReason).toBeUndefined(); // Không dùng rejectReason cho recall
      expect(res.version).toBe(5);
    });

    it('rejectBatch: ghi nhận rejectReason, rejectedAt, rejectedBy và không cho phép chuyển tiếp', async () => {
      memoryDb[baseBatch.id] = { ...baseBatch, status: 'TESTING', version: 2 };
      const signature = await createTestSignature(baseBatch.id, 'BATCH_REJECT');
      const res = await handlers.rejectBatch(
        baseBatch.id,
        'Hàm lượng hoạt chất không đạt',
        qaUser,
        {
          signature,
        }
      );
      expect(res.status).toBe('REJECTED');
      expect(res.rejectReason).toBe('Hàm lượng hoạt chất không đạt');
      expect(res.rejectedBy).toBe('qa@vbiotech.com');
      expect(res.rejectedAt).toBeDefined();
      expect(res.version).toBe(3);

      // Thử chuyển tiếp từ REJECTED -> BỊ CHẶN
      await expect(handlers.dispatchTesting(baseBatch.id, qaUser)).rejects.toThrow(
        'State Machine Violation'
      );
    });
  });

  // =========================================================================
  // 4. CONCURRENCY, OCC & IDEMPOTENCY
  // =========================================================================
  describe('4. OCC Concurrency & Idempotency', () => {
    const handlers = new BatchWorkflowHandlers(mockRepo);
    const qaUser = { id: 'usr_qa', email: 'qa@vbiotech.com', role: 'QA' };

    it('Double Transition / Stale Version bị chặn bởi OCC (expectedVersion mismatch)', async () => {
      memoryDb[baseBatch.id] = { ...baseBatch, status: 'PENDING', version: 5 };

      // User A thực hiện trước -> Thành công
      await handlers.dispatchTesting(baseBatch.id, qaUser, { expectedVersion: 5 });
      expect(memoryDb[baseBatch.id].version).toBe(6);

      // User B gửi expectedVersion = 5 (cũ) -> Thất bại OCC
      await expect(
        handlers.dispatchTesting(baseBatch.id, qaUser, { expectedVersion: 5 })
      ).rejects.toThrow();
    });

    it('Idempotency Key: Request trùng lặp trả về kết quả ban đầu, không tăng version hai lần', async () => {
      memoryDb[baseBatch.id] = { ...baseBatch, status: 'PENDING', version: 10 };
      const idempotencyKey = 'IDEM-KEY-RELEASE-TEST-123';

      const res1 = await handlers.dispatchTesting(baseBatch.id, qaUser, {
        expectedVersion: 10,
        idempotencyKey,
      });
      expect(res1.status).toBe('TESTING');
      expect(res1.version).toBe(11);

      // Lần 2 với cùng idempotencyKey -> Idempotent
      const res2 = await handlers.dispatchTesting(baseBatch.id, qaUser, {
        expectedVersion: 11,
        idempotencyKey,
      });
      expect(res2.status).toBe('TESTING');
      expect(memoryDb[baseBatch.id].version).toBe(11); // Không tăng lần 2
    });
  });
});
