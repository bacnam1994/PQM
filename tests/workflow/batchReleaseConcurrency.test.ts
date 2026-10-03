import { describe, it, expect, beforeEach, vi } from 'vitest';
import { batchRepository } from '../../src/repositories/firebase/FirebaseBatchRepository';
import { BatchReleaseProgressService } from '../../src/domain/batch/BatchReleaseProgressService';
import { BatchStateMachine } from '../../src/domain/workflow/stateMachine';
import { Batch, TestResult, BatchReleaseGateProgress, TCCS } from '../../src/types';
import { ElectronicSignature } from '../../src/types/signature';
import { computeSignatureChecksum } from '../../src/services/signatureService';

// Mock Firebase Realtime Database with transactional state support
const mockDbState: Record<string, any> = {};

vi.mock('../../src/firebase', () => ({
  db: {},
}));

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

describe('Batch Release Concurrency & OCC Hardening (P0-1 đến P1-4)', () => {
  let mockBatch: Batch;
  const baseTccs: TCCS = {
    id: 'tccs_001',
    productId: 'prod_001',
    code: 'TCCS-001',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      { id: 'crit_1', name: 'Định lượng', min: 90, max: 110, unit: '%', type: 'NUMBER' as any },
    ],
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    mockBatch = {
      id: 'batch_concurrency_test_001',
      batchNo: 'B-CONCURRENCY-001',
      productId: 'prod_001',
      status: 'TESTING',
      version: 5,
      mfgDate: '2026-01-01',
      expDate: '2028-01-01',
      releaseStage: 'GATE_6',
      hasActiveOOS: false,
      hasActiveDeviation: false,
      bprReviewStatus: 'APPROVED',
      releaseGateProgress: {
        completed: 5,
        total: 7,
        currentGate: 6,
        percentage: 71,
        evaluatedAt: new Date().toISOString(),
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    // Initialize mock database state for batch
    mockDbState[`batches/${mockBatch.id}`] = { ...mockBatch };
  });

  // P0-1: updateReleaseProgress tăng version và bảo toàn OCC
  it('P0-1: updateReleaseProgress tăng version của Batch và từ chối expectedVersion lỗi thời', async () => {
    const progressUpdate: BatchReleaseGateProgress = {
      completed: 6,
      total: 7,
      currentGate: 7,
      percentage: 86,
      evaluatedAt: new Date().toISOString(),
    };

    const initialVersion = mockBatch.version;
    const updated = await batchRepository.updateReleaseProgress(
      mockBatch.id,
      'GATE_7',
      progressUpdate,
      { expectedVersion: initialVersion }
    );

    expect(updated).toBeDefined();
    expect(updated.version).toBe(initialVersion + 1);
    expect(updated.releaseStage).toBe('GATE_7');
    expect(updated.releaseGateProgress?.completed).toBe(6);

    // Cập nhật với expectedVersion cũ (stale version) -> Phải throw CONCURRENCY_CONFLICT
    await expect(
      batchRepository.updateReleaseProgress(
        mockBatch.id,
        'GATE_7',
        progressUpdate,
        { expectedVersion: initialVersion } // Stale version! (DB đã lên initialVersion + 1)
      )
    ).rejects.toThrow(/CONCURRENCY_CONFLICT/);
  });

  // P0-2: Không cho phép progress writer cũ ghi đè trạng thái RELEASED (Anti-Stale Overwrite)
  it('P0-2: Khi Batch đã chuyển sang RELEASED, một tác vụ bất đồng bộ ghi 6/7 sẽ bị từ chối/bảo toàn RELEASED', async () => {
    // 1. Giả lập Batch đã được ký xuất xưởng (RELEASED, 7/7, version = 10)
    mockBatch = {
      ...mockBatch,
      status: 'RELEASED',
      releaseStage: 'RELEASED',
      version: 10,
      releaseGateProgress: {
        completed: 7,
        total: 7,
        currentGate: 8,
        percentage: 100,
        evaluatedAt: new Date().toISOString(),
      },
    };
    mockDbState[`batches/${mockBatch.id}`] = { ...mockBatch };

    // 2. Một luồng bất đồng bộ cũ (ví dụ BPR review hoặc test result sync bị delay) cố ghi 6/7
    const staleProgress: BatchReleaseGateProgress = {
      completed: 6,
      total: 7,
      currentGate: 7,
      percentage: 86,
      evaluatedAt: new Date().toISOString(),
    };

    const result = await batchRepository.updateReleaseProgress(
      mockBatch.id,
      'GATE_7',
      staleProgress
    );

    // 3. Phải bảo toàn RELEASED và 7/7, KHÔNG bị thụt lùi về GATE_7 hoặc 6/7!
    expect(result.status).toBe('RELEASED');
    expect(result.releaseStage).toBe('RELEASED');
    expect(result.releaseGateProgress?.completed).toBe(7);
  });

  // P0-3: batchRepository.updateStatus('RELEASED') bị chặn tuyệt đối từ client repository
  it('P0-3: Chặn client updateStatus(RELEASED) trực tiếp với ERR_DIRECT_RELEASE_FORBIDDEN', async () => {
    mockDbState[`batches/${mockBatch.id}`] = {
      ...mockBatch,
      status: 'TESTING',
      version: 5,
    };

    await expect(
      batchRepository.updateStatus(mockBatch.id, 'RELEASED', 'Phê duyệt xuất xưởng chính thức', {
        expectedVersion: 5,
        releasedBy: 'qa@vbiotech.vn',
      })
    ).rejects.toThrow('ERR_DIRECT_RELEASE_FORBIDDEN');
  });

  // P1-2: Phân định rạch ròi readyForSignature vs readyForRelease
  it('P1-2: Phân định rạch ròi: 6/7 -> readyForSignature=true, readyForRelease=false; 7/7 -> readyForRelease=true', async () => {
    const mockResults: TestResult[] = [
      {
        id: 'tr_01',
        batchId: mockBatch.id,
        productId: mockBatch.productId,
        overallStatus: 'PASS',
        workflowStatus: 'APPROVED' as any,
        results: [
          {
            criterionId: 'crit_1',
            criteriaName: 'Định lượng',
            value: 100,
            unit: '%',
            isPass: true,
          },
        ],
        updatedAt: new Date().toISOString(),
      },
    ];

    mockBatch.bprReviewStatus = 'APPROVED';
    mockBatch.hasActiveOOS = false;
    mockBatch.hasActiveDeviation = false;

    // Trường hợp 1: Chưa có chữ ký (Gate 1-6 PASS, Gate 7 chờ ký)
    const progressWithoutSig = BatchReleaseProgressService.resolveReleaseProgress({
      batch: mockBatch,
      testResults: mockResults,
      boundTccs: baseTccs,
      userRole: 'QA',
    });

    expect(progressWithoutSig.releaseGateProgress.completed).toBe(6);
    expect(progressWithoutSig.releaseStage).toBe('GATE_7');
    expect(progressWithoutSig.readyForSignature).toBe(true);
    expect(progressWithoutSig.readyForRelease).toBe(false);

    // Trường hợp 2: Có chữ ký hợp lệ (7/7 Gates)
    const validSig: ElectronicSignature = {
      id: 'sig_valid_001',
      documentType: 'BATCH_RELEASE',
      documentId: mockBatch.id,
      documentVersion: mockBatch.version,
      signerUid: 'qa_user_01',
      signerName: 'QA Manager',
      signerEmail: 'qa@vbiotech.vn',
      role: 'QA',
      meaning: 'Phê duyệt xuất xưởng',
      signedAt: new Date().toISOString(),
      checksum: '',
    };
    validSig.checksum = await computeSignatureChecksum(validSig);

    const progressWithSig = BatchReleaseProgressService.resolveReleaseProgress({
      batch: mockBatch,
      testResults: mockResults,
      boundTccs: baseTccs,
      userRole: 'QA',
      userSignature: validSig,
    });

    expect(progressWithSig.releaseGateProgress.completed).toBe(7);
    expect(progressWithSig.releaseStage).toBe('READY_TO_RELEASE');
    expect(progressWithSig.readyForSignature).toBe(false);
    expect(progressWithSig.readyForRelease).toBe(true);
  });

  // P1-3: State Machine canTransition gắn kết chặt chẽ với điều kiện 7 Gate
  it('P1-3: BatchStateMachine từ chối chuyển sang RELEASED nếu conditionsMet = false', () => {
    const checkFailed = BatchStateMachine.canTransition('TESTING', 'RELEASED', {
      actorRole: 'QA',
      actorId: 'qa_01',
      conditionsMet: false,
    });

    expect(checkFailed.allowed).toBe(false);
    expect(checkFailed.reason).toContain(
      'Điều kiện kiểm nghiệm chất lượng chưa đạt để chuyển sang RELEASED'
    );

    const checkSuccess = BatchStateMachine.canTransition('TESTING', 'RELEASED', {
      actorRole: 'QA',
      actorId: 'qa_01',
      conditionsMet: true,
    });

    expect(checkSuccess.allowed).toBe(true);
  });

  // P1-5: Bộ lọc removeUndefined loại bỏ hoàn toàn các trường undefined trước khi ghi vào Firebase
  it('P1-5: updateStatus loại bỏ toàn bộ trường undefined trước khi commit vào Firebase (removeUndefined sanitizer)', async () => {
    mockDbState[`batches/${mockBatch.id}`] = {
      ...mockBatch,
      status: 'PENDING',
      version: 2,
    };

    // Truyền metadata và reason có chứa trường undefined
    await batchRepository.updateStatus(
      mockBatch.id,
      'TESTING',
      undefined, // reason undefined
      {
        expectedVersion: 2,
        releaseDecisionSnapshot: undefined,
        releasedBy: undefined,
        notes: undefined as any,
      }
    );

    const savedBatch = mockDbState[`batches/${mockBatch.id}`];
    expect(savedBatch).toBeDefined();
    expect(savedBatch.status).toBe('TESTING');
    expect(savedBatch.version).toBe(3);

    // Kiểm tra không có bất kỳ key nào mang giá trị undefined trong object đã lưu
    for (const [key, value] of Object.entries(savedBatch)) {
      expect(value).not.toBeUndefined();
    }
    expect('releaseDecisionSnapshot' in savedBatch).toBe(false);
    expect('notes' in savedBatch).toBe(false);
  });
});
