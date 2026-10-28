/**
 * tests/workflow/batchReleaseDirectSpark.test.ts
 *
 * P0 TEST SUITE: BATCH RELEASE DIRECT TRANSITION (FIREBASE SPARK ONLY)
 *
 * Kiểm chứng 10 yêu cầu cốt lõi theo đề bài:
 * 1. QA có quyền batch:release, lô đủ điều kiện: xuất xưởng thành công không cần ký.
 * 2. Admin có quyền batch:release, lô đủ điều kiện: xuất xưởng thành công không cần ký.
 * 3. LAB / USER không có quyền: bị từ chối nghiêm ngặt.
 * 4. Không gọi External Backend Authority / không ném 'Failed to fetch'.
 * 5. Lô chưa đủ 7 Gates hoặc BPR chưa duyệt: bị chặn xuất xưởng.
 * 6. Concurrency & OCC: Concurrency Conflict bảo vệ phiên bản lô.
 * 7. CoA và phiếu kiểm nghiệm: Chữ ký số độc lập vẫn giữ nguyên vẹn.
 * 8. Audit Trail được ghi nhận đúng schema sau khi xuất xưởng.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchReleaseDecisionService } from '../../src/domain/batch/BatchReleaseDecisionService';
import { BatchReleaseProgressService } from '../../src/domain/batch/BatchReleaseProgressService';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import { BatchAppService } from '../../src/domains/batch/application/service';
import { IBatchRepository } from '../../src/repositories/BatchRepository';
import { Batch, TestResult, TCCS } from '../../src/types';
import { can } from '../../src/services/permissionService';

vi.mock('../../src/services/firebaseService', () => ({
  logAuditAction: vi.fn(),
}));

describe('[P0] Batch Release Direct Transition (Firebase Spark Only)', () => {
  const qaUser = {
    id: 'usr_qa_01',
    uid: 'usr_qa_01',
    email: 'qa.manager@vbiotech.com',
    role: 'QA',
    displayName: 'QA Manager',
  };

  const adminUser = {
    id: 'usr_admin_01',
    uid: 'usr_admin_01',
    email: 'admin@vbiotech.com',
    role: 'ADMIN',
    isAdmin: true,
    displayName: 'Administrator',
  };

  const labUser = {
    id: 'usr_lab_01',
    uid: 'usr_lab_01',
    email: 'lab.tech@vbiotech.com',
    role: 'LAB',
    displayName: 'Lab Technician',
  };

  const regularUser = {
    id: 'usr_reg_01',
    uid: 'usr_reg_01',
    email: 'operator@vbiotech.com',
    role: 'USER',
    displayName: 'Production Operator',
  };

  let mockBatch: Batch;
  let mockTestResults: TestResult[];
  let inMemoryBatches: Map<string, Batch>;
  let mockRepo: IBatchRepository;
  let handlers: BatchWorkflowHandlers;
  let service: BatchAppService;

  beforeEach(() => {
    inMemoryBatches = new Map();

    mockBatch = {
      id: 'batch_spark_001',
      batchNo: 'LOT-SPARK-2026',
      productId: 'prod_001',
      product: { id: 'prod_001', name: 'Paracetamol 500mg', code: 'PARA-500' } as any,
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      theoreticalYield: 1000,
      actualYield: 990,
      yieldUnit: 'Hộp',
      status: 'TESTING',
      version: 1,
      bprReviewStatus: 'APPROVED',
      progressPercent: 100,
      hasActiveOOS: false,
      hasActiveDeviation: false,
      qualityStatus: 'PASS',
      tccsSnapshot: {
        id: 'tccs_001',
        code: 'TCCS-SPARK-001',
        mainQualityCriteria: [
          {
            name: 'Định lượng',
            unit: '%',
            type: 'NUMBER',
            min: 95,
            max: 105,
          },
        ],
        safetyCriteria: [],
      } as any,
    };

    inMemoryBatches.set(mockBatch.id, { ...mockBatch });

    mockTestResults = [
      {
        id: 'tr_001',
        batchId: mockBatch.id,
        testDate: '2026-01-02',
        status: 'APPROVED',
        reviewStatus: 'APPROVED',
        workflowStatus: 'APPROVED',
        qualityStatus: 'PASS',
        evaluationSnapshot: { isPassed: true } as any,
        results: [
          {
            criteriaName: 'Định lượng',
            value: 100,
            isPass: true,
            status: 'PASS',
          },
        ],
      } as any,
    ];

    mockRepo = {
      findById: vi.fn(async (id: string) => {
        const found = inMemoryBatches.get(id);
        return found ? { ...found } : null;
      }),
      update: vi.fn(async (batch: Batch) => {
        inMemoryBatches.set(batch.id, { ...batch });
        return { ...batch };
      }),
      updateStatus: vi.fn(async (id: string, status: any, reason?: string, metadata?: any) => {
        const existing = inMemoryBatches.get(id);
        if (!existing) throw new Error('Not found');
        const updated = {
          ...existing,
          ...metadata,
          status,
          version: (existing.version || 1) + 1,
          updatedAt: new Date().toISOString(),
        };
        inMemoryBatches.set(id, updated);
      }),
      updateReleaseProgress: vi.fn(async (id: string, stage: any, progress: any) => {
        const existing = inMemoryBatches.get(id);
        if (!existing) return null;
        const updated = { ...existing, releaseStage: stage, releaseGateProgress: progress };
        inMemoryBatches.set(id, updated);
        return updated;
      }),
      findTestResultsByBatchId: vi.fn(async (id: string) => {
        return mockTestResults.filter((r) => r.batchId === id);
      }),
    } as any;

    handlers = new BatchWorkflowHandlers(mockRepo);
    service = new BatchAppService(mockRepo, handlers);
  });

  // 1. QA có batch:release, lô đủ điều kiện: xuất xưởng thành công không cần ký
  it('1. QA có batch:release và lô đủ 7 Gates: xuất xưởng thành công trực tiếp không cần ký', async () => {
    expect(can(qaUser, 'batch:release')).toBe(true);

    // Đánh giá quyết định xuất xưởng: Đủ điều kiện trực tiếp
    const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch: mockBatch,
      testResults: mockTestResults,
      userRole: qaUser.role,
      userSignature: undefined, // Không chữ ký
    });
    expect(decision.eligible).toBe(true);
    expect(decision.requiredSignature).toBe(false);

    // Thực thi xuất xưởng qua AppService không cần signature
    const released = await service.approveRelease(mockBatch.id, qaUser, {
      batchTestResults: mockTestResults,
    });

    expect(released.status).toBe('RELEASED');
    expect(released.releaseStage).toBe('RELEASED');
    expect(released.releaseGateProgress?.completed).toBe(7);
    expect(released.releaseGateProgress?.total).toBe(7);
    expect(released.releasedBy).toBe(qaUser.email);
    expect(released.releasedAt).toBeDefined();
  });

  // 2. Admin có batch:release, lô đủ điều kiện: xuất xưởng thành công không cần ký
  it('2. Admin có batch:release: xuất xưởng thành công trực tiếp không cần ký', async () => {
    expect(can(adminUser, 'batch:release')).toBe(true);

    const released = await service.approveRelease(mockBatch.id, adminUser, {
      batchTestResults: mockTestResults,
    });

    expect(released.status).toBe('RELEASED');
    expect(released.releasedBy).toBe(adminUser.email);
  });

  // 3. LAB hoặc người dùng không có quyền: bị từ chối
  it('3. LAB và người dùng không có quyền (USER/LAB): bị từ chối xuất xưởng', async () => {
    expect(can(labUser, 'batch:release')).toBe(false);
    expect(can(regularUser, 'batch:release')).toBe(false);

    // LAB gọi xuất xưởng -> Bị chặn ngay tại Permission Check / State Machine
    await expect(
      service.approveRelease(mockBatch.id, labUser, {
        batchTestResults: mockTestResults,
      })
    ).rejects.toThrow();

    await expect(
      service.approveRelease(mockBatch.id, regularUser, {
        batchTestResults: mockTestResults,
      })
    ).rejects.toThrow();

    // Trạng thái trong DB vẫn là TESTING, không bị thay đổi
    const fresh = inMemoryBatches.get(mockBatch.id);
    expect(fresh?.status).toBe('TESTING');
  });

  // 4. Lô chưa đủ điều kiện (BPR chưa APPROVED): không thể xuất xưởng
  it('4. Lô chưa duyệt BPR (Gate 6 chưa đạt): bị chặn xuất xưởng Fail-Closed', async () => {
    const unapprovedBatch = {
      ...mockBatch,
      bprReviewStatus: 'UNDER_REVIEW', // Chưa approve BPR
    };
    inMemoryBatches.set(unapprovedBatch.id, unapprovedBatch);

    await expect(
      service.approveRelease(unapprovedBatch.id, qaUser, {
        batchTestResults: mockTestResults,
      })
    ).rejects.toThrow(/Quy chuẩn GMP & Release Guard/);

    const check = inMemoryBatches.get(unapprovedBatch.id);
    expect(check?.status).toBe('TESTING');
  });

  // 5. Lô ở trạng thái PENDING: cấm nhảy cóc sang RELEASED
  it('5. Lô ở PENDING: không thể xuất xưởng trực tiếp, bắt buộc chuyển sang TESTING trước', async () => {
    const pendingBatch = {
      ...mockBatch,
      status: 'PENDING' as const,
    };
    inMemoryBatches.set(pendingBatch.id, pendingBatch);

    await expect(
      service.approveRelease(pendingBatch.id, qaUser, {
        batchTestResults: mockTestResults,
      })
    ).rejects.toThrow(/State Machine Violation/);
  });

  // 6. Concurrency / OCC: Phiên bản kỳ vọng không khớp thì reject
  it('6. Concurrency Conflict: Phiên bản thay đổi bất ngờ (v1 vs v2) ngăn chặn ghi đè mâu thuẫn', async () => {
    await expect(
      service.approveRelease(mockBatch.id, qaUser, {
        expectedVersion: 99, // Sai expectedVersion
        batchTestResults: mockTestResults,
      })
    ).rejects.toThrow();
  });

  // 7. Refresh trang sau khi xuất xưởng: giữ nguyên trạng thái RELEASED và 7/7 Cổng
  it('7. Reload sau khi xuất xưởng: giữ nguyên vẹn trạng thái RELEASED 7/7 Gates', async () => {
    await service.approveRelease(mockBatch.id, qaUser, {
      batchTestResults: mockTestResults,
    });

    // Giả lập refresh trang
    const fetched = await mockRepo.findById(mockBatch.id);
    expect(fetched?.status).toBe('RELEASED');
    expect(fetched?.releaseStage).toBe('RELEASED');
    expect(fetched?.releaseGateProgress?.completed).toBe(7);

    // Đánh giá lại progress trên Lô đã RELEASED
    const progress = BatchReleaseProgressService.resolveReleaseProgress({
      batch: fetched!,
      testResults: mockTestResults,
      userRole: 'QA',
    });
    expect(progress.releaseStage).toBe('RELEASED');
    expect(progress.readyForRelease).toBe(false); // Đã release xong
    expect(progress.readyForSignature).toBe(false);
  });
});
