import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  batchWorkflowHandlers,
  BatchWorkflowHandlers,
} from '../../src/workflow/handlers/batchWorkflowHandlers';
import { Batch, TestResult, TCCS } from '../../src/types';

vi.mock('../../src/services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

describe('evaluateInspection Server-First Fallback Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    BatchWorkflowHandlers.clearEvaluationIdempotencyCache();
  });

  it('tự động gọi findTestResultsByBatchId từ server repo khi options.testResults rỗng hoặc thiếu', async () => {
    const mockTccs: TCCS = {
      id: 'tccs_01',
      productId: 'prod_hi_biotech',
      code: 'TCCS-01',
      isActive: true,
      mainQualityCriteria: [
        {
          id: 'crit_1',
          name: 'Độ ẩm',
          type: 'NUMBER',
          min: 0,
          max: 10,
          unit: '%',
        },
      ],
      safetyCriteria: [],
      createdAt: '2026-01-01T00:00:00Z',
    };

    const mockBatch: Batch = {
      id: 'batch_682605',
      batchNo: '682605',
      productId: 'prod_hi_biotech',
      productName: 'HI BIOTECH',
      tccsId: 'tccs_01',
      tccsSnapshot: mockTccs,
      mfgDate: '2026-10-01',
      expDate: '2028-10-01',
      status: 'TESTING',
      version: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const serverTestResults: TestResult[] = [
      {
        id: 'tr_01',
        batchId: 'batch_682605',
        batchNo: '682605',
        labName: 'QC V-Biotech',
        status: 'APPROVED',
        overallStatus: 'PASS',
        testDate: '2026-10-10',
        results: [
          {
            id: 'entry_1',
            criteriaName: 'Độ ẩm',
            value: 5,
            isPass: true,
          },
        ],
        createdAt: '2026-10-10T00:00:00Z',
      } as any,
    ];

    // Mock batch repository
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(mockBatch),
      updateStatus: vi.fn().mockResolvedValue(true),
      update: vi.fn().mockResolvedValue(true),
      findTestResultsByBatchId: vi.fn().mockResolvedValue(serverTestResults),
    };

    (batchWorkflowHandlers as any).repo = mockRepo;

    const result = await batchWorkflowHandlers.evaluateInspection(
      'batch_682605',
      'PASS',
      {
        id: 'user_admin',
        name: 'Admin',
        role: 'ADMIN',
      },
      {
        reason: 'Đủ 100% chỉ tiêu theo TCCS từ server-first',
        testResults: [], // Gửi mảng rỗng để kích hoạt fallback nạp từ server
      }
    );

    expect(mockRepo.findTestResultsByBatchId).toHaveBeenCalledWith('batch_682605');
    expect(result).toBeDefined();
    expect(result.inspectionStatus).toBe('PASS');
    expect(result.inspectionEvaluation?.status).toBe('PASS');
  });
});
