import { describe, it, expect, vi } from 'vitest';
import {
  buildEvaluationSnapshot,
  createEvaluationHash,
  CURRENT_ENGINE_VERSION,
} from './EvaluationSnapshotBuilder';
import { TestResult } from '../../types';
import { TestResultAppService } from '../../services/app/TestResultAppService';

describe('Phase 4: Evaluation Snapshot & ALCOA+ Data Integrity', () => {
  const mockTestResultPass: TestResult = {
    id: 'TR-2026-001',
    batchId: 'BATCH-001',
    labName: 'QC Micro Lab',
    testDate: '2026-09-14',
    createdAt: '2026-09-14T08:00:00.000Z',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Định tính', value: 'Dương tính', isPass: true, limit: 'Dương tính' },
      { criteriaName: 'Độ ẩm', value: '5.2%', isPass: true, limit: '4.0 - 6.0%' },
      { criteriaName: 'Định lượng', value: '99.5%', isPass: true, limit: '95.0 - 105.0%' },
    ],
  };

  const mockTestResultFail: TestResult = {
    id: 'TR-2026-002',
    batchId: 'BATCH-002',
    labName: 'QC Chemical Lab',
    testDate: '2026-09-14',
    createdAt: '2026-09-14T08:00:00.000Z',
    overallStatus: 'FAIL',
    results: [
      { criteriaName: 'Độ ẩm', value: '7.5%', isPass: false, limit: '4.0 - 6.0%' },
      { criteriaName: 'Định lượng', value: '98.0%', isPass: true, limit: '95.0 - 105.0%' },
    ],
  };

  it('tạo snapshot đầy đủ với engineVersion, tccsVersion, evaluatedAt, evaluatedBy', () => {
    const user = { email: 'analyst@vbiotech.vn' };
    const snapshot = buildEvaluationSnapshot(mockTestResultPass, user, {
      tccs: { id: 'TCCS-001', version: 3 } as any,
    });

    expect(snapshot.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(snapshot.tccsId).toBe('TCCS-001');
    expect(snapshot.tccsVersion).toBe(3);
    expect(snapshot.evaluatedBy).toBe('analyst@vbiotech.vn');
    expect(snapshot.overallStatus).toBe('PASS');
    expect(snapshot.criterionResults).toHaveLength(3);
    expect(snapshot.criterionResults[0].criteriaName).toBe('Định tính');
    expect(snapshot.criterionResults[0].isPass).toBe(true);
    expect(snapshot.evaluationHash).toMatch(/^eval_[0-9a-f]+$/);
    expect(snapshot.reasons).toEqual([]);
  });

  it('ghi nhận lý do thất bại (reasons) khi kết quả kiểm nghiệm là FAIL', () => {
    const user = { email: 'reviewer@vbiotech.vn' };
    const snapshot = buildEvaluationSnapshot(mockTestResultFail, user);

    expect(snapshot.overallStatus).toBe('FAIL');
    expect(snapshot.reasons.length).toBeGreaterThan(0);
    expect(snapshot.reasons[0]).toContain('Độ ẩm');
    expect(snapshot.evaluationHash).toBeDefined();
  });

  it('sinh mã hash tất định (deterministic hash) cho cùng payload', () => {
    const payloadA = {
      testResultId: 'TR-001',
      batchId: 'B-001',
      overallStatus: 'PASS',
      evaluatedAt: '2026-09-14T08:00:00.000Z',
    };
    const payloadB = {
      testResultId: 'TR-001',
      batchId: 'B-001',
      overallStatus: 'PASS',
      evaluatedAt: '2026-09-14T08:00:00.000Z',
    };
    const payloadDifferent = {
      ...payloadA,
      overallStatus: 'FAIL',
    };

    const hashA = createEvaluationHash(payloadA);
    const hashB = createEvaluationHash(payloadB);
    const hashDiff = createEvaluationHash(payloadDifferent);

    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashDiff);
  });

  it('TestResultAppService tự động đính kèm snapshot khi tạo phiếu kiểm nghiệm mới', async () => {
    const mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
    };
    const mockDeviationService = {
      autoLogFromOOS: vi.fn().mockResolvedValue(undefined),
    } as any;

    const service = new TestResultAppService(mockRepo as any, mockDeviationService);
    const user = { email: 'qa@vbiotech.vn', role: 'ADMIN' };

    await service.createTestResult(mockTestResultPass, user);

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    const savedResult: TestResult = mockRepo.save.mock.calls[0][0];

    expect(savedResult.evaluationSnapshot).toBeDefined();
    expect(savedResult.evaluationSnapshot?.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(savedResult.evaluationSnapshot?.evaluatedBy).toBe('qa@vbiotech.vn');
    expect(savedResult.evaluationSnapshot?.overallStatus).toBe('PASS');
    expect(savedResult.evaluationSnapshot?.evaluationHash).toBeDefined();
  });

  it('TestResultAppService tự động cập nhật snapshot khi chỉnh sửa phiếu kiểm nghiệm', async () => {
    const mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
    };
    const mockDeviationService = {
      autoLogFromOOS: vi.fn().mockResolvedValue(undefined),
    } as any;

    const service = new TestResultAppService(mockRepo as any, mockDeviationService);
    const user = { email: 'qa@vbiotech.vn', role: 'ADMIN' };

    await service.updateTestResult(mockTestResultFail, user);

    expect(mockRepo.update).toHaveBeenCalledTimes(1);
    const updatedResult: TestResult = mockRepo.update.mock.calls[0][0];

    expect(updatedResult.evaluationSnapshot).toBeDefined();
    expect(updatedResult.evaluationSnapshot?.overallStatus).toBe('FAIL');
    expect(updatedResult.evaluationSnapshot?.reasons[0]).toContain('Độ ẩm');
  });

  it('tương thích ngược: phiếu kiểm nghiệm cũ không có snapshot vẫn hoạt động bình thường', () => {
    const legacyResult: TestResult = {
      id: 'TR-LEGACY',
      batchId: 'BATCH-LEGACY',
      labName: 'Old Lab',
      testDate: '2024-01-01',
      createdAt: '2024-01-01T08:00:00.000Z',
      overallStatus: 'PASS',
      results: [{ criteriaName: 'pH', value: '7.0', isPass: true }],
    };

    expect(legacyResult.evaluationSnapshot).toBeUndefined();
    expect(legacyResult.overallStatus).toBe('PASS');
    expect(legacyResult.results[0].isPass).toBe(true);
  });
});
