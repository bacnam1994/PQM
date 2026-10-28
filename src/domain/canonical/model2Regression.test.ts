/**
 * model2Regression.test.ts
 * =========================
 * BỘ KIỂM THỬ HỒI QUY BẮT BUỘC CHO PQM VIBE CODING — MODEL 2:
 * CANONICAL STATUS RESOLVER
 *
 * 1. stored PASS + calculated FAIL -> FAIL
 * 2. stored FAIL + calculated PASS -> PASS nếu source data hiện tại thực sự PASS
 * 3. stored APPROVED + no criteria -> UNKNOWN
 * 4. stored RELEASED + PENDING criteria -> PENDING
 * 5. valid snapshot PASS + unchanged source -> PASS
 * 6. invalid snapshot PASS + current criteria FAIL -> FAIL (re-evaluate)
 * 7. snapshot wrong TCCS version -> re-evaluate
 * 8. snapshot wrong batch -> re-evaluate
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTestResultStatus,
  normalizeTestResultStatus,
  calculateOverallStatusForTestResult,
} from '../test-result/testResultStatusResolver';
import {
  buildEvaluationSnapshot,
  validateEvaluationSnapshot,
  verifyEvaluationSnapshotIntegrity,
} from '../evaluation/EvaluationSnapshotBuilder';
import { CanonicalStatusResolver, resolveQualityStatus } from './canonicalResolver';
import { TestResult, TCCS } from '../../types';

describe('MODEL 2 — CANONICAL STATUS RESOLVER REGRESSION SUITE', () => {
  // -------------------------------------------------------------------------
  // Ca kiểm thử 1: stored PASS + calculated FAIL -> FAIL
  // -------------------------------------------------------------------------
  it('1. stored PASS + calculated FAIL -> resolves to FAIL', () => {
    const tr: TestResult = {
      id: 'TR-M2-001',
      batchId: 'BATCH-001',
      labName: 'Lab Hóa lý',
      testDate: '2026-09-18',
      overallStatus: 'PASS', // Stored is PASS
      createdAt: '2026-09-18',
      results: [
        { criteriaName: 'Định lượng hoạt chất', isPass: false, value: '85.0%' }, // Criteria FAIL
      ],
    };

    expect(resolveTestResultStatus(tr)).toBe('FAIL');
    expect(CanonicalStatusResolver.calculateCanonicalTestStatus(tr)).toBe('FAIL');
  });

  // -------------------------------------------------------------------------
  // Ca kiểm thử 2: stored FAIL + calculated PASS -> PASS nếu source data hiện tại thực sự PASS
  // -------------------------------------------------------------------------
  it('2. stored FAIL + calculated PASS -> resolves to PASS if current source data is genuinely PASS', () => {
    const tr: TestResult = {
      id: 'TR-M2-002',
      batchId: 'BATCH-001',
      labName: 'Lab Hóa lý',
      testDate: '2026-09-18',
      overallStatus: 'FAIL', // Stored is FAIL
      createdAt: '2026-09-18',
      results: [
        { criteriaName: 'Định lượng hoạt chất', isPass: true, value: '99.5%' },
        { criteriaName: 'Độ ẩm', isPass: true, value: '3.2%' },
      ],
    };

    expect(resolveTestResultStatus(tr)).toBe('PASS');
    expect(CanonicalStatusResolver.calculateCanonicalTestStatus(tr)).toBe('PASS');
  });

  // -------------------------------------------------------------------------
  // Ca kiểm thử 3: stored APPROVED + no criteria -> UNKNOWN
  // -------------------------------------------------------------------------
  it('3. stored APPROVED + no criteria -> resolves to UNKNOWN', () => {
    const trEmptyResults: TestResult = {
      id: 'TR-M2-003-A',
      batchId: 'BATCH-001',
      labName: 'Lab Vi sinh',
      testDate: '2026-09-18',
      overallStatus: 'APPROVED' as any,
      workflowStatus: 'APPROVED',
      createdAt: '2026-09-18',
      results: [],
    };
    expect(resolveTestResultStatus(trEmptyResults)).toBe('UNKNOWN');
    expect(CanonicalStatusResolver.calculateCanonicalTestStatus(trEmptyResults)).toBe('INVALID');

    const trNoResultsArray = {
      id: 'TR-M2-003-B',
      batchId: 'BATCH-001',
      labName: 'Lab Vi sinh',
      testDate: '2026-09-18',
      overallStatus: 'APPROVED',
      workflowStatus: 'APPROVED',
      createdAt: '2026-09-18',
    };
    expect(resolveTestResultStatus(trNoResultsArray)).toBe('UNKNOWN');
  });

  // -------------------------------------------------------------------------
  // Ca kiểm thử 4: stored RELEASED + PENDING criteria -> PENDING
  // -------------------------------------------------------------------------
  it('4. stored RELEASED + PENDING criteria -> resolves to PENDING', () => {
    const tr: TestResult = {
      id: 'TR-M2-004',
      batchId: 'BATCH-001',
      labName: 'Lab Vi sinh',
      testDate: '2026-09-18',
      overallStatus: 'RELEASED' as any,
      workflowStatus: 'RELEASED',
      createdAt: '2026-09-18',
      results: [
        { criteriaName: 'Định lượng hoạt chất', isPass: true, value: '99.5%' },
        { criteriaName: 'Vi sinh 7 ngày', isPass: null, value: '' }, // Unresolved pending
      ],
    };

    expect(resolveTestResultStatus(tr)).toBe('PENDING');
    expect(CanonicalStatusResolver.calculateCanonicalTestStatus(tr)).toBe('PENDING');
  });

  // -------------------------------------------------------------------------
  // Ca kiểm thử 5: valid snapshot PASS + unchanged source -> PASS
  // -------------------------------------------------------------------------
  it('5. valid snapshot PASS + unchanged source -> resolves to PASS', () => {
    const trBase: TestResult = {
      id: 'TR-M2-005',
      batchId: 'BATCH-005',
      labName: 'Phòng Kiểm nghiệm Trung tâm',
      testDate: '2026-09-18',
      overallStatus: 'PASS',
      createdAt: '2026-09-18',
      results: [
        { criteriaName: 'Độ tinh khiết', isPass: true, value: '99.9%' },
        { criteriaName: 'pH', isPass: true, value: '6.5' },
      ],
    };

    const snapshot = buildEvaluationSnapshot(trBase, { email: 'qa_manager@vbiotech.vn' });
    const trWithSnapshot: TestResult = {
      ...trBase,
      evaluationSnapshot: snapshot,
    };

    const validation = validateEvaluationSnapshot(snapshot, trWithSnapshot);
    expect(validation.isValid).toBe(true);
    expect(resolveTestResultStatus(trWithSnapshot)).toBe('PASS');
    expect(CanonicalStatusResolver.calculateCanonicalTestStatus(trWithSnapshot)).toBe('PASS');
  });

  // -------------------------------------------------------------------------
  // Ca kiểm thử 6: invalid snapshot PASS + current criteria FAIL -> FAIL (re-evaluate)
  // -------------------------------------------------------------------------
  it('6. invalid snapshot PASS + current criteria FAIL -> rejects snapshot and resolves to FAIL', () => {
    const trOriginal: TestResult = {
      id: 'TR-M2-006',
      batchId: 'BATCH-006',
      labName: 'Lab Hóa lý',
      testDate: '2026-09-18',
      overallStatus: 'PASS',
      createdAt: '2026-09-18',
      results: [{ criteriaName: 'Độ tinh khiết', isPass: true, value: '99.9%' }],
    };

    // Tạo snapshot lúc còn PASS
    const snapshot = buildEvaluationSnapshot(trOriginal, { email: 'qa@vbiotech.vn' });

    // Dữ liệu nguồn sau đó bị sửa đổi thành FAIL trong khi snapshot vẫn mang overallStatus PASS
    const trTamperedSource: TestResult = {
      ...trOriginal,
      results: [
        { criteriaName: 'Độ tinh khiết', isPass: false, value: '92.0%' }, // Hiện tại FAIL
      ],
      evaluationSnapshot: snapshot,
    };

    // validateEvaluationSnapshot phải phát hiện parity mismatch giữa snapshot và results hiện tại
    const validation = validateEvaluationSnapshot(snapshot, trTamperedSource);
    expect(validation.isValid).toBe(false);

    // Canonical resolution không tin tưởng snapshot bị vô hiệu hóa -> Re-evaluate từ criteria -> FAIL
    expect(resolveTestResultStatus(trTamperedSource)).toBe('FAIL');
    expect(CanonicalStatusResolver.calculateCanonicalTestStatus(trTamperedSource)).toBe('FAIL');
  });

  // -------------------------------------------------------------------------
  // Ca kiểm thử 7: snapshot wrong TCCS version -> re-evaluate
  // -------------------------------------------------------------------------
  it('7. snapshot wrong TCCS version -> invalidates snapshot and re-evaluates against current TCCS', () => {
    const tccsV1: TCCS = {
      id: 'TCCS-PARACETAMOL',
      code: 'TCCS-001',
      version: 1,
      productId: 'PROD-01',
      isActive: true,
      issueDate: '2026-01-01',
      mainQualityCriteria: [],
      safetyCriteria: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const tr: TestResult = {
      id: 'TR-M2-007',
      batchId: 'BATCH-007',
      labName: 'Lab QC',
      testDate: '2026-09-18',
      overallStatus: 'PASS',
      createdAt: '2026-09-18',
      results: [{ criteriaName: 'Định lượng', isPass: false, value: '88%' }],
    };

    // Snapshot được niêm phong với TCCS v1
    const snapshotV1 = buildEvaluationSnapshot(tr, { email: 'qa@vbiotech.vn' }, { tccs: tccsV1 });
    tr.evaluationSnapshot = snapshotV1;

    // TCCS hiện tại đã được nâng cấp lên v2
    const tccsV2: TCCS = {
      ...tccsV1,
      version: 2,
    };

    // validateEvaluationSnapshot phát hiện phiên bản TCCS trong snapshot (v1) khác TCCS hiện hành (v2)
    const validation = validateEvaluationSnapshot(tr.evaluationSnapshot, tr, tccsV2);
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toContain('TCCS cũ');

    // Canonical Status Resolver tự động re-evaluate theo TCCS v2 và criteria thực tế -> FAIL
    expect(resolveTestResultStatus(tr, tccsV2)).toBe('FAIL');
  });

  // -------------------------------------------------------------------------
  // Ca kiểm thử 8: snapshot wrong batch -> re-evaluate
  // -------------------------------------------------------------------------
  it('8. snapshot wrong batch -> invalidates snapshot and re-evaluates', () => {
    const trBatchA: TestResult = {
      id: 'TR-M2-008',
      batchId: 'BATCH-AAA',
      labName: 'Lab QC',
      testDate: '2026-09-18',
      overallStatus: 'PASS',
      createdAt: '2026-09-18',
      results: [{ criteriaName: 'Định lượng', isPass: true, value: '99%' }],
    };

    // Snapshot được đóng băng cho BATCH-AAA
    const snapshotA = buildEvaluationSnapshot(trBatchA, { email: 'qa@vbiotech.vn' });

    // Snapshot của BATCH-AAA bị dán nhầm vào phiếu của BATCH-BBB có criteria FAIL
    const trBatchB: TestResult = {
      id: 'TR-M2-008',
      batchId: 'BATCH-BBB', // Khác với snapshot.batchId
      labName: 'Lab QC',
      testDate: '2026-09-18',
      overallStatus: 'PASS',
      createdAt: '2026-09-18',
      results: [{ criteriaName: 'Định lượng', isPass: false, value: '80%' }],
      evaluationSnapshot: snapshotA,
    };

    const validation = validateEvaluationSnapshot(trBatchB.evaluationSnapshot, trBatchB);
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toContain('batchId');

    // Re-evaluation dựa trên dữ liệu chỉ tiêu thực tế của BATCH-BBB -> FAIL
    expect(resolveTestResultStatus(trBatchB)).toBe('FAIL');
    expect(CanonicalStatusResolver.calculateCanonicalTestStatus(trBatchB)).toBe('FAIL');
  });

  // -------------------------------------------------------------------------
  // Kiểm tra tính toàn vẹn chữ ký băm (Hash Tampering Check)
  // -------------------------------------------------------------------------
  it('9. tampered snapshot hash -> invalidates snapshot and re-evaluates', () => {
    const tr: TestResult = {
      id: 'TR-M2-009',
      batchId: 'BATCH-009',
      labName: 'Lab QC',
      testDate: '2026-09-18',
      overallStatus: 'PASS',
      createdAt: '2026-09-18',
      results: [{ criteriaName: 'Định lượng', isPass: true, value: '99%' }],
    };

    const snapshot = buildEvaluationSnapshot(tr, { email: 'qa@vbiotech.vn' });
    // Giả mạo hoặc làm hỏng evaluationHash
    snapshot.evaluationHash = 'fake_tampered_hash_value_1234567890';

    tr.evaluationSnapshot = snapshot;

    const validation = validateEvaluationSnapshot(snapshot, tr);
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toContain('Mã băm SHA-256 không hợp lệ');
  });

  // -------------------------------------------------------------------------
  // Ca kiểm thử 10: resolveQualityStatus export & equivalence
  // -------------------------------------------------------------------------
  it('10. resolveQualityStatus is authoritative and accessible directly and statically', () => {
    const tr: TestResult = {
      id: 'TR-M2-010',
      batchId: 'BATCH-010',
      labName: 'Lab QC',
      testDate: '2026-09-19',
      overallStatus: 'PASS',
      createdAt: '2026-09-19',
      results: [{ criteriaName: 'Định lượng', isPass: true, value: '100%' }],
    };

    expect(resolveQualityStatus(tr)).toBe('PASS');
    expect(CanonicalStatusResolver.resolveQualityStatus(tr)).toBe('PASS');
  });

  // -------------------------------------------------------------------------
  // Ca kiểm thử 11: resolveQualityStatus handles Canonical tr.criteria
  // -------------------------------------------------------------------------
  it('11. resolveQualityStatus evaluates canonical tr.criteria seamlessly', () => {
    const trCanonical: any = {
      id: 'TR-M2-011',
      batchId: 'BATCH-011',
      productId: 'PROD-011',
      labName: 'Lab QC',
      testDate: '2026-09-19',
      qualityStatus: 'PENDING',
      criteria: [
        { criteriaName: 'Độ hòa tan', isPass: true, value: '95%' },
        { criteriaName: 'Tạp chất liên quan', isPass: false, value: '1.2%' },
      ],
      createdAt: Date.now(),
      version: 1,
    };

    expect(resolveQualityStatus(trCanonical)).toBe('FAIL');
  });
});
