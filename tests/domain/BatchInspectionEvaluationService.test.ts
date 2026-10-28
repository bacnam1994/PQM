/**
 * tests/domain/BatchInspectionEvaluationService.test.ts
 * ====================================================
 * Unit & Integration Test Suite cho nghiệp vụ Đánh giá Chất lượng Lô (STATE-03)
 *
 * Kiểm thử 8 yêu cầu nghiệp vụ bắt buộc:
 * 1. Người có quyền (QA/QC/ADMIN) đánh giá Pass.
 * 2. Người có quyền (QA/QC/ADMIN) đánh giá Fail.
 * 3. Người không có quyền (LAB/PRODUCTION/VIEWER) bị từ chối.
 * 4. Đánh giá khi chưa đủ chỉ tiêu bị từ chối.
 * 5. Gửi yêu cầu trùng không tạo nhiều quyết định (Idempotency).
 * 6. Dữ liệu thay đổi sau kết luận (Stale Invalidation & RELEASED protection).
 * 7. Mất phản hồi phía client sau khi server đã xử lý (Retry an toàn).
 * 8. Audit log đầy đủ và đúng người thực hiện.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchAppService } from '../../src/domains/batch/application/service';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import { IBatchRepository } from '../../src/repositories/interfaces/IBatchRepository';
import { Batch, TestResult, TCCS, Criterion } from '../../src/types';
import * as auditModule from '../../src/services/auditService';

// Mock audit log service để theo dõi ALCOA+ Audit Trail
vi.mock('../../src/services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock Firebase realtime database module
vi.mock('../../src/firebase', () => ({
  db: {},
}));

// ─── Helpers tạo dữ liệu mẫu ────────────────────────────────────────────────

function createMockTccs(criteriaCount: number = 3): TCCS {
  const mainQualityCriteria: Criterion[] = [];
  for (let i = 1; i <= criteriaCount; i++) {
    mainQualityCriteria.push({
      id: `crit_${i}`,
      name: `Chỉ tiêu ${i}`,
      type: 'NUMBER',
      min: 90,
      max: 110,
      unit: '%',
    });
  }
  return {
    id: 'tccs_001',
    productId: 'prod_001',
    code: 'TCCS-TEST-001',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria,
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function createMockBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: 'batch_001',
    productId: 'prod_001',
    tccsId: 'tccs_001',
    batchNo: 'B26001',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    batchSize: 1000,
    unit: 'chai',
    status: 'TESTING',
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockTestResult(
  batchId: string,
  entries: Array<{ name: string; value: any; isPass?: boolean }>,
  overrides: Partial<TestResult> = {}
): TestResult {
  return {
    id: 'tr_001',
    batchId,
    labName: 'QC V-Biotech',
    testDate: '2026-01-02',
    status: 'APPROVED',
    results: entries.map((e, idx) => ({
      id: `entry_${idx + 1}`,
      criteriaName: e.name,
      value: e.value,
      isPass: e.isPass ?? true,
    })),
    createdAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('STATE-03: Pass/Fail Evaluation Service & Operations', () => {
  let mockStore: Map<string, Batch>;
  let mockRepo: IBatchRepository;
  let batchService: BatchAppService;

  beforeEach(() => {
    vi.clearAllMocks();
    BatchWorkflowHandlers.clearEvaluationIdempotencyCache();
    mockStore = new Map();

    mockRepo = {
      findById: vi.fn(async (id: string) => {
        const b = mockStore.get(id);
        return b ? { ...b } : null;
      }),
      findByBatchNo: vi.fn(async () => null),
      findByProductId: vi.fn(async () => []),
      findByStatus: vi.fn(async () => []),
      create: vi.fn(async (b: Batch) => {
        mockStore.set(b.id, { ...b });
      }),
      update: vi.fn(async (b: Batch) => {
        mockStore.set(b.id, { ...b });
      }),
      delete: vi.fn(async (id: string) => {
        mockStore.delete(id);
      }),
      findPaginated: vi.fn(async () => ({ items: [], total: 0 })),
      updateStatus: vi.fn(async () => {}),
      updateProgress: vi.fn(async () => {}),
      updateBprReview: vi.fn(async () => ({}) as Batch),
      updateReleaseProgress: vi.fn(async () => ({}) as Batch),
      updateInspectionEvaluation: vi.fn(
        async (
          batchId: string,
          inspectionStatus: any,
          evaluation?: any,
          options?: any
        ): Promise<Batch> => {
          const current = mockStore.get(batchId);
          if (!current) throw new Error('Not found');
          if (current.status === 'RELEASED' && evaluation && evaluation.status !== 'PASS') {
            throw new Error('Không thể thay đổi đánh giá Lô đã xuất xưởng');
          }
          if (
            options?.expectedVersion !== undefined &&
            (current.version ?? 1) !== options.expectedVersion
          ) {
            throw new Error(`CONCURRENCY_CONFLICT: Phiên bản hiện tại khác kỳ vọng`);
          }
          const updated: Batch = {
            ...current,
            inspectionStatus,
            inspectionEvaluation: evaluation,
            inspectionProgress: options?.inspectionProgress,
            version: (current.version ?? 1) + 1,
            updatedAt: new Date().toISOString(),
          };
          if (!evaluation) {
            delete updated.inspectionEvaluation;
          }
          mockStore.set(batchId, updated);
          return updated;
        }
      ),
    };

    batchService = new BatchAppService(mockRepo);
  });

  // 1. Người có quyền đánh giá Pass
  it('Yêu cầu 1: Người có quyền (QA, QC, ADMIN) đánh giá PASS thành công khi đủ điều kiện', async () => {
    const tccs = createMockTccs(3);
    const batch = createMockBatch({ tccsSnapshot: tccs });
    mockStore.set(batch.id, batch);

    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 95, isPass: true },
      { name: 'Chỉ tiêu 2', value: 100, isPass: true },
      { name: 'Chỉ tiêu 3', value: 105, isPass: true },
    ]);

    const qaUser = {
      id: 'usr_qa_01',
      displayName: 'Nguyen Thi QA',
      email: 'qa@vbiotech.com',
      role: 'QA',
    };

    const updated = await batchService.evaluateInspection({
      batchId: batch.id,
      status: 'PASS',
      currentUser: qaUser,
      testResults: [testResult],
      tccs,
    });

    expect(updated.inspectionStatus).toBe('PASS');
    expect(updated.inspectionEvaluation).toBeDefined();
    expect(updated.inspectionEvaluation?.status).toBe('PASS');
    expect(updated.inspectionEvaluation?.evaluatedBy).toBe('usr_qa_01');
    expect(updated.inspectionEvaluation?.evaluatorRole).toBe('QA');
    expect(updated.inspectionEvaluation?.evaluationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(updated.version).toBe(2);

    // Kiểm tra Audit Log
    expect(auditModule.logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        collection: 'BATCHES',
        documentId: batch.id,
        performedBy: 'qa@vbiotech.com',
      })
    );
  });

  // 2. Người có quyền đánh giá Fail
  it('Yêu cầu 2: Người có quyền (QC) đánh giá FAIL kèm lý do giải trình kỹ thuật hợp lệ', async () => {
    const tccs = createMockTccs(3);
    const batch = createMockBatch({ tccsSnapshot: tccs });
    mockStore.set(batch.id, batch);

    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 95, isPass: true },
      { name: 'Chỉ tiêu 2', value: 120, isPass: false }, // OOS
      { name: 'Chỉ tiêu 3', value: 105, isPass: true },
    ]);

    const qcUser = {
      id: 'usr_qc_01',
      displayName: 'Tran Van QC',
      email: 'qc@vbiotech.com',
      role: 'QC',
    };

    const reason = 'Chỉ tiêu 2 vi phạm giới hạn quy cách OOS (120% > 110%).';
    const updated = await batchService.evaluateInspection({
      batchId: batch.id,
      status: 'FAIL',
      currentUser: qcUser,
      reason,
      testResults: [testResult],
      tccs,
    });

    expect(updated.inspectionStatus).toBe('FAIL');
    expect(updated.inspectionEvaluation?.status).toBe('FAIL');
    expect(updated.inspectionEvaluation?.reason).toBe(reason);
    expect(updated.inspectionEvaluation?.evaluatorRole).toBe('QC');
    expect(updated.version).toBe(2);

    expect(auditModule.logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        collection: 'BATCHES',
        documentId: batch.id,
        performedBy: 'qc@vbiotech.com',
      })
    );
  });

  // 3. Người không có quyền bị từ chối
  it('Yêu cầu 3: Người không có thẩm quyền (LAB, PRODUCTION, VIEWER) bị từ chối đánh giá', async () => {
    const tccs = createMockTccs(3);
    const batch = createMockBatch({ tccsSnapshot: tccs });
    mockStore.set(batch.id, batch);

    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 95, isPass: true },
      { name: 'Chỉ tiêu 2', value: 100, isPass: true },
      { name: 'Chỉ tiêu 3', value: 105, isPass: true },
    ]);

    const labUser = {
      id: 'usr_lab_01',
      displayName: 'Analyst KNV',
      email: 'lab@vbiotech.com',
      role: 'LAB',
    };

    await expect(
      batchService.evaluateInspection({
        batchId: batch.id,
        status: 'PASS',
        currentUser: labUser,
        testResults: [testResult],
        tccs,
      })
    ).rejects.toThrow(/Từ chối quyền: Người dùng vai trò 'LAB' không có thẩm quyền/);

    // Đảm bảo trạng thái không bị thay đổi
    const unchanged = mockStore.get(batch.id);
    expect(unchanged?.inspectionStatus).toBeUndefined();
    expect(unchanged?.inspectionEvaluation).toBeUndefined();
  });

  // 4. Đánh giá khi chưa đủ chỉ tiêu bị từ chối
  it('Yêu cầu 4: Đánh giá PASS khi chưa hoàn thành đủ 100% chỉ tiêu bắt buộc bị từ chối', async () => {
    const tccs = createMockTccs(3);
    const batch = createMockBatch({ tccsSnapshot: tccs });
    mockStore.set(batch.id, batch);

    // Chỉ có 2/3 chỉ tiêu
    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 95, isPass: true },
      { name: 'Chỉ tiêu 2', value: 100, isPass: true },
    ]);

    const qaUser = {
      id: 'usr_qa_01',
      displayName: 'Nguyen Thi QA',
      email: 'qa@vbiotech.com',
      role: 'QA',
    };

    await expect(
      batchService.evaluateInspection({
        batchId: batch.id,
        status: 'PASS',
        currentUser: qaUser,
        testResults: [testResult],
        tccs,
      })
    ).rejects.toThrow(/Không thể xác nhận Đạt \(PASS\) khi chưa hoàn thành đầy đủ 100% chỉ tiêu/);

    // Đảm bảo trạng thái không đổi
    const unchanged = mockStore.get(batch.id);
    expect(unchanged?.inspectionStatus).toBeUndefined();
  });

  it('Yêu cầu 4b: Đánh giá PASS khi có chỉ tiêu FAIL (OOS) bị từ chối', async () => {
    const tccs = createMockTccs(2);
    const batch = createMockBatch({ tccsSnapshot: tccs });
    mockStore.set(batch.id, batch);

    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 95, isPass: true },
      { name: 'Chỉ tiêu 2', value: 120, isPass: false },
    ]);

    const qaUser = {
      id: 'usr_qa_01',
      displayName: 'Nguyen Thi QA',
      email: 'qa@vbiotech.com',
      role: 'QA',
    };

    await expect(
      batchService.evaluateInspection({
        batchId: batch.id,
        status: 'PASS',
        currentUser: qaUser,
        testResults: [testResult],
        tccs,
      })
    ).rejects.toThrow(
      /Không thể xác nhận Đạt \(PASS\) khi tồn tại chỉ tiêu kiểm nghiệm không đạt tiêu chuẩn/
    );
  });

  // 5. Gửi yêu cầu trùng không tạo nhiều quyết định (Idempotency)
  it('Yêu cầu 5: Gửi yêu cầu trùng (Retry) với cùng idempotencyKey trả về kết quả cũ, không lặp audit', async () => {
    const tccs = createMockTccs(2);
    const batch = createMockBatch({ tccsSnapshot: tccs });
    mockStore.set(batch.id, batch);

    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 95, isPass: true },
      { name: 'Chỉ tiêu 2', value: 100, isPass: true },
    ]);

    const qaUser = {
      id: 'usr_qa_01',
      displayName: 'Nguyen Thi QA',
      email: 'qa@vbiotech.com',
      role: 'QA',
    };

    const idempotencyKey = 'eval_idem_key_001';

    // Lần 1: Thực thi thành công
    const result1 = await batchService.evaluateInspection({
      batchId: batch.id,
      status: 'PASS',
      currentUser: qaUser,
      idempotencyKey,
      testResults: [testResult],
      tccs,
    });

    expect(result1.inspectionStatus).toBe('PASS');
    expect(auditModule.logAuditAction).toHaveBeenCalledTimes(1);

    // Lần 2: Gửi lại y hệt với idempotencyKey
    const result2 = await batchService.evaluateInspection({
      batchId: batch.id,
      status: 'PASS',
      currentUser: qaUser,
      idempotencyKey,
      testResults: [testResult],
      tccs,
    });

    // Kết quả nhận về phải y hệt và không tạo audit log lần 2
    expect(result2.inspectionStatus).toBe('PASS');
    expect(result2.version).toBe(result1.version);
    expect(auditModule.logAuditAction).toHaveBeenCalledTimes(1);
  });

  // 6. Dữ liệu thay đổi sau kết luận (Stale Protection)
  it('Yêu cầu 6: Dữ liệu biến thiên sau khi đánh giá PASS tự động vô hiệu hóa kết luận cũ', async () => {
    const tccs = createMockTccs(2);
    const batch = createMockBatch({ tccsSnapshot: tccs });
    mockStore.set(batch.id, batch);

    const testResult1 = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 95, isPass: true },
      { name: 'Chỉ tiêu 2', value: 100, isPass: true },
    ]);

    const qaUser = {
      id: 'usr_qa_01',
      displayName: 'Nguyen Thi QA',
      email: 'qa@vbiotech.com',
      role: 'QA',
    };

    // Đánh giá PASS ban đầu
    const evaluatedBatch = await batchService.evaluateInspection({
      batchId: batch.id,
      status: 'PASS',
      currentUser: qaUser,
      testResults: [testResult1],
      tccs,
    });
    expect(evaluatedBatch.inspectionStatus).toBe('PASS');
    expect(evaluatedBatch.inspectionEvaluation).toBeDefined();

    // Người dùng chỉnh sửa kết quả đo lường của Chỉ tiêu 1 (đổi giá trị -> đổi hash)
    const modifiedTestResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 98, isPass: true }, // Giá trị thay đổi từ 95 sang 98
      { name: 'Chỉ tiêu 2', value: 100, isPass: true },
    ]);

    // Gọi kiểm tra stale invalidation
    const invalidatedBatch = await batchService.invalidateInspectionIfStale(batch.id, qaUser, {
      testResults: [modifiedTestResult],
      tccs,
    });

    expect(invalidatedBatch).not.toBeNull();
    // Kết luận PASS cũ đã bị hủy, quay về PENDING_REVIEW để QA thẩm định lại
    expect(invalidatedBatch?.inspectionStatus).toBe('PENDING_REVIEW');
    expect(invalidatedBatch?.inspectionEvaluation).toBeUndefined();

    // Kiểm tra Audit Log ghi nhận sự kiện vô hiệu hóa
    expect(auditModule.logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.stringContaining('Vô hiệu hóa kết luận chất lượng Lô'),
      })
    );
  });

  it('Yêu cầu 6b: Lô đã xuất xưởng (RELEASED) được bảo toàn tuyệt đối, cấm vô hiệu hóa', async () => {
    const tccs = createMockTccs(2);
    const releasedBatch = createMockBatch({
      status: 'RELEASED',
      inspectionStatus: 'PASS',
      inspectionEvaluation: {
        status: 'PASS',
        evaluatedBy: 'qa_user',
        evaluatorName: 'QA Leader',
        evaluatorRole: 'QA',
        evaluatedAt: '2026-01-01T00:00:00Z',
        versionAtEvaluation: 1,
      },
      tccsSnapshot: tccs,
    });
    mockStore.set(releasedBatch.id, releasedBatch);

    const qaUser = {
      id: 'usr_qa_01',
      displayName: 'Nguyen Thi QA',
      email: 'qa@vbiotech.com',
      role: 'QA',
    };

    // Thử invalidate khi dữ liệu rỗng
    const res = await batchService.invalidateInspectionIfStale(releasedBatch.id, qaUser, {
      testResults: [],
      tccs,
    });

    // Lô RELEASED giữ nguyên kết luận PASS
    expect(res?.inspectionStatus).toBe('PASS');
    expect(res?.inspectionEvaluation).toBeDefined();
  });

  // 7. Mất phản hồi phía client sau khi server đã xử lý (Client timeout / Retry)
  it('Yêu cầu 7: Client retry sau khi server đã xử lý không gây lỗi CONCURRENCY_CONFLICT', async () => {
    const tccs = createMockTccs(2);
    const batch = createMockBatch({ version: 1, tccsSnapshot: tccs });
    mockStore.set(batch.id, batch);

    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 95, isPass: true },
      { name: 'Chỉ tiêu 2', value: 100, isPass: true },
    ]);

    const qaUser = {
      id: 'usr_qa_01',
      displayName: 'Nguyen Thi QA',
      email: 'qa@vbiotech.com',
      role: 'QA',
    };

    const idempotencyKey = 'retry_key_after_timeout';

    // Lần 1: Server xử lý thành công, batch version tăng từ 1 lên 2
    const res1 = await batchService.evaluateInspection({
      batchId: batch.id,
      status: 'PASS',
      currentUser: qaUser,
      expectedVersion: 1,
      idempotencyKey,
      testResults: [testResult],
      tccs,
    });
    expect(res1.version).toBe(2);

    // Lần 2: Client do timeout gửi lại request với expectedVersion cũ (1) và cùng idempotencyKey
    const res2 = await batchService.evaluateInspection({
      batchId: batch.id,
      status: 'PASS',
      currentUser: qaUser,
      expectedVersion: 1, // Client vẫn cầm version 1 do chưa nhận được response lần 1
      idempotencyKey,
      testResults: [testResult],
      tccs,
    });

    // Hệ thống nhận diện idempotency và trả về kết quả thành công của lần 1
    expect(res2.inspectionStatus).toBe('PASS');
    expect(res2.version).toBe(2);
  });

  // 8. Audit log đầy đủ và đúng người thực hiện
  it('Yêu cầu 8: Audit log ghi nhận đầy đủ các trường thông tin chuẩn mực ALCOA+', async () => {
    const tccs = createMockTccs(2);
    const batch = createMockBatch({ tccsSnapshot: tccs });
    mockStore.set(batch.id, batch);

    const testResult = createMockTestResult(batch.id, [
      { name: 'Chỉ tiêu 1', value: 95, isPass: true },
      { name: 'Chỉ tiêu 2', value: 100, isPass: true },
    ]);

    const adminUser = {
      id: 'usr_admin_01',
      displayName: 'He Thong Admin',
      email: 'admin@vbiotech.com',
      role: 'ADMIN',
    };

    await batchService.evaluateInspection({
      batchId: batch.id,
      status: 'PASS',
      currentUser: adminUser,
      reason: 'Đạt toàn bộ chỉ tiêu',
      testResults: [testResult],
      tccs,
    });

    expect(auditModule.logAuditAction).toHaveBeenCalledWith({
      action: 'UPDATE',
      collection: 'BATCHES',
      documentId: batch.id,
      performedBy: 'admin@vbiotech.com',
      details: expect.stringMatching(/Đánh giá chất lượng Lô \[B26001\]: ĐẠT \(PASS\)/),
    });
  });
});
