/**
 * PHASE 15: End-to-End Batch Lifecycle & Data Integrity Verification Test Suite
 *
 * Kiểm chứng trọn vẹn toàn bộ chu trình sống của Lô sản xuất:
 * PENDING (v1) -> TESTING (v2) -> [Gate Blockers] -> RELEASED (v3) -> BLOCKED (v4 Recall)
 *
 * Bảo đảm 10 Mục tiêu Bất biến GMP & 21 CFR Part 11:
 * 1. Single Source of Truth cho mối quan hệ Lô - Phiếu
 * 2. Ngăn chặn triệt để Suffix Matching độc lập
 * 3. 7 Cổng thẩm tra Xuất xưởng Lô (Release Gates) không thể bị bypass
 * 4. State Machine FSM bảo toàn nghiêm ngặt luồng trạng thái
 * 5. Bắt buộc chữ ký điện tử hợp lệ 21 CFR Part 11
 * 6. Kiểm soát xung đột đồng thời (OCC) với version nguyên tử
 * 7. Outbox Pattern bảo đảm Idempotency của Audit Events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Batch } from '../../src/types/batch';
import { TestResult } from '../../src/types/testResult';
import { User } from '../../src/types/user';
import { BatchReleaseDecisionService } from '../../src/domain/batch/BatchReleaseDecisionService';
import { BatchStateMachine } from '../../src/domain/workflow/stateMachine';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import { IBatchRepository } from '../../src/repositories/interfaces/IBatchRepository';
import { OutboxAuditQueue } from '../../src/workflow/events/outboxAuditQueue';
import { WorkflowExecutor } from '../../src/workflow/kernel/workflowExecutor';
import { WorkflowContext } from '../../src/workflow/contracts/actions';

vi.mock('../../src/services/signatureService', () => ({
  signatureService: {
    verifySignatureIntegrity: vi
      .fn()
      .mockImplementation(async (sig: any) => sig?.checksum === 'valid-checksum'),
  },
}));

describe('Phase 15: End-to-End Batch Lifecycle & Data Integrity Verification', () => {
  let mockBatchesDb: Map<string, Batch>;
  let mockRepo: IBatchRepository;
  let qaUser: User;
  let operatorUser: User;
  let handlers: BatchWorkflowHandlers;

  beforeEach(() => {
    mockBatchesDb = new Map<string, Batch>();

    mockRepo = {
      findById: vi.fn(async (id: string) => {
        const found = mockBatchesDb.get(id);
        return found ? JSON.parse(JSON.stringify(found)) : null;
      }),
      findByBatchNo: vi.fn(async (batchNo: string) => {
        for (const b of mockBatchesDb.values()) {
          if (b.batchNo === batchNo) return JSON.parse(JSON.stringify(b));
        }
        return null;
      }),
      update: vi.fn(async (batch: Batch) => {
        mockBatchesDb.set(batch.id, JSON.parse(JSON.stringify(batch)));
        return JSON.parse(JSON.stringify(batch));
      }),
      updateStatus: vi.fn(async (id: string, status: any, reason?: string, options?: any) => {
        const current = mockBatchesDb.get(id);
        if (!current) throw new Error('BATCH_NOT_FOUND');

        // OCC check
        if (options?.expectedVersion !== undefined && current.version !== options.expectedVersion) {
          const err = new Error(
            `CONCURRENCY_CONFLICT: Batch ${id} has been modified concurrently. Expected version ${options.expectedVersion}, got ${current.version}.`
          );
          (err as any).code = 'CONCURRENCY_CONFLICT';
          throw err;
        }

        const nextVer = (current.version ?? 1) + 1;
        const updated: Batch = {
          ...current,
          status,
          version: nextVer,
          updatedAt: new Date().toISOString(),
          ...(status === 'RELEASED'
            ? {
                releasedAt: options?.releasedAt || new Date().toISOString(),
                releasedBy: options?.releasedBy || 'qa@pqm.com',
                releaseDecisionSnapshot: options?.releaseDecisionSnapshot,
              }
            : {}),
          ...(status === 'REJECTED' || status === 'BLOCKED' ? { rejectReason: reason } : {}),
        };
        mockBatchesDb.set(id, updated);
        return updated;
      }),
    } as any;

    handlers = new BatchWorkflowHandlers(mockRepo);

    qaUser = {
      uid: 'user_qa_001',
      id: 'user_qa_001',
      name: 'Nguyen Van QA',
      email: 'qa@pqm.com',
      role: 'QA',
    } as User;

    operatorUser = {
      uid: 'user_op_001',
      id: 'user_op_001',
      name: 'Tran Van Operator',
      email: 'op@pqm.com',
      role: 'OPERATOR',
    } as User;
  });

  it('thực thi trọn vẹn vòng đời Lô sản xuất qua 10 bước nghiêm ngặt', async () => {
    // -------------------------------------------------------------
    // Bước 1: Khởi tạo Lô sản xuất mới ở trạng thái PENDING (Version 1)
    // -------------------------------------------------------------
    const initialBatch: Batch = {
      id: 'batch-e2e-2026',
      batchNo: 'LOT-E2E-2026-001',
      productId: 'prod-para-500',
      productName: 'Paracetamol 500mg',
      status: 'PENDING',
      version: 1,
      mfgDate: '2026-01-01',
      expDate: '2029-01-01',
      size: 100000,
      unit: 'viên',
      createdAt: '2026-01-01T08:00:00Z',
      tccsSnapshot: {
        id: 'tccs-para-01',
        code: 'TCCS-PARA-500-2026',
        version: 1,
        mainQualityCriteria: [
          { name: 'Hình thức', expectedText: 'Viên nén màu trắng', type: 'TEXT' },
          { name: 'Độ ẩm', max: 5.0, type: 'NUMBER' },
          { name: 'Định lượng', min: 95.0, max: 105.0, type: 'NUMBER' },
        ],
      } as any,
    };
    mockBatchesDb.set(initialBatch.id, initialBatch);

    expect(initialBatch.status).toBe('PENDING');
    expect(initialBatch.version).toBe(1);

    const prodUser = {
      uid: 'user_prod_001',
      id: 'user_prod_001',
      name: 'Tran Van Production',
      email: 'prod@pqm.com',
      role: 'PRODUCTION',
    } as User;

    await handlers.handleStatusTransition('batch-e2e-2026', 'TESTING', prodUser, {
      currentBatch: initialBatch,
    });

    const testingBatch = mockBatchesDb.get('batch-e2e-2026')!;
    expect(testingBatch.status).toBe('TESTING');
    expect(testingBatch.version).toBe(2);

    // -------------------------------------------------------------
    // Bước 3: Thử chuyển bất hợp pháp từ TESTING sang RELEASED khi chưa có phiếu kiểm nghiệm
    // Rào chắn Gate 1: ERR_TEST_INCOMPLETE phải chặn đứng
    // -------------------------------------------------------------
    const dummySignature = {
      id: 'sig-e2e-01',
      documentType: 'BATCH_RELEASE' as any,
      documentId: 'batch-e2e-2026',
      signerEmail: 'qa@pqm.com',
      signerName: 'Nguyen Van QA',
      signedAt: new Date().toISOString(),
      checksum: 'valid-checksum',
    };

    await expect(
      handlers.handleStatusTransition('batch-e2e-2026', 'RELEASED', qaUser, {
        currentBatch: testingBatch,
        batchTestResults: [],
        signature: dummySignature,
      })
    ).rejects.toThrow(/ERR_TEST_INCOMPLETE/);

    // -------------------------------------------------------------
    // Bước 4: Thử release khi phiếu kiểm nghiệm có chỉ tiêu FAIL
    // Rào chắn Gate 2: ERR_QUALITY_NOT_PASS phải chặn đứng
    // -------------------------------------------------------------
    const failingTestResult: TestResult = {
      id: 'tr-fail-001',
      batchId: 'batch-e2e-2026',
      status: 'APPROVED',
      labName: 'Lab QC',
      testDate: '2026-01-05',
      overallStatus: 'FAIL',
      results: [
        { criteriaName: 'Hình thức', value: 'Đạt', isPass: true },
        { criteriaName: 'Độ ẩm', value: '7.5%', isPass: false }, // FAIL
        { criteriaName: 'Định lượng', value: '99.2%', isPass: true },
      ],
      createdAt: '2026-01-05T10:00:00Z',
    };

    await expect(
      handlers.handleStatusTransition('batch-e2e-2026', 'RELEASED', qaUser, {
        currentBatch: testingBatch,
        batchTestResults: [failingTestResult],
        signature: dummySignature,
      })
    ).rejects.toThrow(/ERR_QUALITY_NOT_PASS/);

    // -------------------------------------------------------------
    // Bước 5: Thử release với phiếu kiểm nghiệm liên kết mập mờ qua Suffix Matching (không khớp batchId)
    // Không được coi là PRIMARY_MATCH, Gate 1 chặn vì thiếu phiếu chính thức
    // -------------------------------------------------------------
    const suffixMismatchTR: TestResult = {
      id: 'tr-suffix-001',
      batchId: 'diff-batch-001',
      batchNo: '001', // Chỉ là chuỗi đuôi của LOT-E2E-2026-001
      labName: 'Lab QC',
      testDate: '2026-01-05',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Hình thức', value: 'Đạt', isPass: true },
        { criteriaName: 'Độ ẩm', value: '4.0%', isPass: true },
        { criteriaName: 'Định lượng', value: '99.2%', isPass: true },
      ],
      createdAt: '2026-01-05T10:00:00Z',
    };

    await expect(
      handlers.handleStatusTransition('batch-e2e-2026', 'RELEASED', qaUser, {
        currentBatch: testingBatch,
        batchTestResults: [suffixMismatchTR],
        signature: dummySignature,
      })
    ).rejects.toThrow(/ERR_TEST_INCOMPLETE/);

    // -------------------------------------------------------------
    // Bước 6: Chuẩn bị Phiếu kiểm nghiệm đạt chuẩn PASS 100% liên kết chuẩn tắc (PRIMARY_MATCH)
    // -------------------------------------------------------------
    const passingTestResult: TestResult = {
      id: 'tr-authoritative-001',
      batchId: 'batch-e2e-2026', // Khớp chính xác ID kỹ thuật
      batchNo: 'LOT-E2E-2026-001',
      status: 'APPROVED',
      labName: 'Lab QC Trung Tâm',
      testDate: '2026-01-06',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Hình thức', value: 'Viên nén màu trắng', isPass: true },
        { criteriaName: 'Độ ẩm', value: '3.8%', isPass: true },
        { criteriaName: 'Định lượng', value: '100.1%', isPass: true },
      ],
      createdAt: '2026-01-06T09:00:00Z',
    };

    // -------------------------------------------------------------
    // Bước 7: Thử xuất xưởng với chữ ký số sai documentId
    // Rào chắn 21 CFR Part 11 phải chặn đứng
    // -------------------------------------------------------------
    const mismatchedSig = {
      ...dummySignature,
      documentId: 'different-batch-id',
    };

    await expect(
      handlers.handleStatusTransition('batch-e2e-2026', 'RELEASED', qaUser, {
        currentBatch: testingBatch,
        batchTestResults: [passingTestResult],
        requireSignature: true,
        signature: mismatchedSig,
      })
    ).rejects.toThrow(/không khớp với Lô sản xuất/);

    // -------------------------------------------------------------
    // Bước 8: Xuất xưởng HỢP LỆ với đầy đủ 7 Release Gates và Chữ ký QA chuẩn
    // -------------------------------------------------------------
    const validQASig = {
      id: 'sig-valid-qa-001',
      documentType: 'BATCH_RELEASE' as any,
      documentId: 'batch-e2e-2026',
      signerEmail: 'qa@pqm.com',
      signerName: 'Nguyen Van QA',
      role: 'QA',
      signedAt: '2026-01-06T15:30:00Z',
      checksum: 'valid-checksum',
    };

    await handlers.handleStatusTransition('batch-e2e-2026', 'RELEASED', qaUser, {
      currentBatch: testingBatch,
      batchTestResults: [passingTestResult],
      signature: validQASig,
    });

    const releasedBatch = mockBatchesDb.get('batch-e2e-2026')!;
    expect(releasedBatch.status).toBe('RELEASED');
    expect(releasedBatch.version).toBe(3); // Tăng từ 2 lên 3
    expect(releasedBatch.releasedAt).toBeDefined();
    expect(releasedBatch.releasedBy).toBe('qa@pqm.com');
    expect(releasedBatch.releaseDecisionSnapshot).toBeDefined();
    expect(releasedBatch.releaseDecisionSnapshot.eligible).toBe(true);
    expect(releasedBatch.releaseDecisionSnapshot.gates).toHaveLength(7);
    expect(releasedBatch.releaseDecisionSnapshot.gates.every((g: any) => g.passed)).toBe(true);

    // -------------------------------------------------------------
    // Bước 9: Kiểm tra Optimistic Concurrency Control (OCC)
    // Thử cập nhật với stale version cũ (version = 2) phải bị ném CONCURRENCY_CONFLICT
    // -------------------------------------------------------------
    await expect(
      mockRepo.updateStatus('batch-e2e-2026', 'BLOCKED', 'Recall test', {
        expectedVersion: 2, // Phiên bản cũ đã lỗi thời (hiện tại là 3)
      })
    ).rejects.toThrow(/CONCURRENCY_CONFLICT/);

    // -------------------------------------------------------------
    // Bước 10: State Machine FSM - Ngăn chặn quay ngược về PENDING từ RELEASED
    // -------------------------------------------------------------
    const transitionCheck = BatchStateMachine.canTransition('RELEASED', 'PENDING', {
      actorRole: 'QA',
      reason: 'Cố tình rollback về PENDING',
    });
    expect(transitionCheck.allowed).toBe(false);

    // -------------------------------------------------------------
    // Bước 11: Thu hồi khẩn cấp (Recall) sang BLOCKED thành công (Version 3 -> 4)
    // Hành động Recall bắt buộc kèm chữ ký phê duyệt QA
    // -------------------------------------------------------------
    const recallSig = {
      id: 'sig-recall-001',
      documentType: 'BATCH_RECALL' as any,
      documentId: 'batch-e2e-2026',
      signerEmail: 'qa@pqm.com',
      signerName: 'Nguyen Van QA',
      role: 'QA',
      signedAt: new Date().toISOString(),
      checksum: 'valid-checksum',
    };

    await handlers.handleStatusTransition('batch-e2e-2026', 'BLOCKED', qaUser, {
      reason: 'Thu hồi do khiếu nại bao bì thị trường',
      currentBatch: releasedBatch,
      signature: recallSig,
    });

    const blockedBatch = mockBatchesDb.get('batch-e2e-2026')!;
    expect(blockedBatch.status).toBe('BLOCKED');
    expect(blockedBatch.version).toBe(4);
    expect(blockedBatch.rejectReason).toBe('Thu hồi do khiếu nại bao bì thị trường');
  });

  it('đảm bảo Outbox Audit Queue không nhân bản sự kiện (Idempotency Audit Delivery)', async () => {
    OutboxAuditQueue.clear();

    const sampleEvent = {
      eventId: 'evt_test_release_001',
      executionId: 'exec_001',
      actionId: 'BATCH_RELEASE_APPROVE',
      entityType: 'batches',
      entityId: 'batch-001',
      actor: { id: 'u1', name: 'QA Head', email: 'qa@pqm.com', role: 'QA' },
      fromState: 'TESTING',
      toState: 'RELEASED',
      version: 3,
      details: 'Xuất xưởng thành công',
      timestamp: new Date().toISOString(),
    };

    // Lần 1: Dispatch event thành công và committed
    const res1 = await OutboxAuditQueue.dispatchAudit(sampleEvent);
    expect(res1.success).toBe(true);
    expect(OutboxAuditQueue.isCommitted(sampleEvent.eventId)).toBe(true);
    expect(OutboxAuditQueue.getQueue().length).toBe(1);

    // Lần 2: Thử retry hoặc dispatch lại chính eventId đó -> Idempotent trả về success ngay lập tức không thêm vào queue
    const res2 = await OutboxAuditQueue.dispatchAudit(sampleEvent);
    expect(res2.success).toBe(true);
    expect(OutboxAuditQueue.getQueue().length).toBe(1); // Không nhân bản trong queue
  });
});
