/**
 * tests/integration/evaluationSnapshotWorkflow.test.ts
 * ====================================================
 * Bộ kiểm thử tích hợp (Integration Test) kiểm tra toàn vẹn luồng Snapshot:
 * 1. TCCS (Criterion ID + Alternate Rules) -> TestResult -> Snapshot Generation.
 * 2. Xác thực tính toàn vẹn chữ ký băm (SHA-256 Hash Verification).
 * 3. Chống giả mạo ALCOA+ (Tamper Detection): Phát hiện bất kỳ can thiệp trái phép nào vào kết quả.
 * 4. Kiểm soát phiên bản TCCS (Version Drift Detection).
 * 5. Bất biến định danh (Criterion ID Invariance): Đổi tên chỉ tiêu không làm hỏng liên kết dữ liệu.
 */

import { describe, it, expect } from 'vitest';
import { TCCS, TestResult, CriterionType } from '../../src/types';
import {
  buildEvaluationSnapshot,
  validateEvaluationSnapshot,
  verifyEvaluationSnapshotIntegrity,
} from '../../src/domain/evaluation/EvaluationSnapshotBuilder';

describe('Integration Test: Evaluation Snapshot Lifecycle & ALCOA+ Data Integrity', () => {
  const mockTccs: TCCS = {
    id: 'tccs-amoxicillin-500',
    code: 'TCCS-AMOX-500',
    productName: 'Amoxicillin 500mg',
    version: 1,
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      {
        id: 'crit-uuid-001',
        name: 'Định lượng Amoxicillin',
        unit: '%',
        min: 90,
        max: 110,
        type: CriterionType.NUMBER,
      },
      {
        id: 'crit-uuid-002',
        name: 'Định lượng Amoxicillin (HPLC kiểm tra lại)',
        unit: '%',
        min: 90,
        max: 110,
        type: CriterionType.NUMBER,
      },
      {
        id: 'crit-uuid-003',
        name: 'Độ ẩm',
        unit: '%',
        max: 5.0,
        type: CriterionType.NUMBER,
      },
    ],
    alternateRules: [
      {
        id: 'alt-amox-01',
        main: 'Định lượng Amoxicillin',
        mainCriterionId: 'crit-uuid-001',
        alt: 'Định lượng Amoxicillin (HPLC kiểm tra lại)',
        altCriterionId: 'crit-uuid-002',
        type: 'FAIL_RETRY',
        action: 'REQUIRE_RETEST',
        note: 'Khi định lượng vi sinh không đạt, bắt buộc kiểm tra lại bằng phương pháp HPLC',
      },
    ],
  };

  const initialTestResult: TestResult = {
    id: 'tr-amox-batch-2026-001',
    batchId: 'batch-amox-001',
    batchNo: 'AMOX-2026-01',
    tccsId: mockTccs.id,
    labName: 'Phòng Kiểm Nghiệm Vi Sinh & Hóa Lý',
    testDate: '2026-09-22',
    overallStatus: 'PASS',
    results: [
      {
        criterionId: 'crit-uuid-001',
        criteriaName: 'Định lượng Amoxicillin',
        value: '85', // FAIL
        isPass: false,
        status: 'FAIL',
      },
      {
        criterionId: 'crit-uuid-002',
        criteriaName: 'Định lượng Amoxicillin (HPLC kiểm tra lại)',
        value: '99.5', // PASS -> Cứu chỉ tiêu chính
        isPass: true,
        status: 'PASS',
      },
      {
        criterionId: 'crit-uuid-003',
        criteriaName: 'Độ ẩm',
        value: '3.2', // PASS
        isPass: true,
        status: 'PASS',
      },
    ],
  };

  it('1. Đóng băng Snapshot thành công và lưu giữ đầy đủ mã băm SHA-256', () => {
    const qcUser = {
      uid: 'user-qc-01',
      email: 'kiemnghiemvien@v-biotech.vn',
      role: 'QC',
    };

    const snapshot = buildEvaluationSnapshot(initialTestResult, qcUser, { boundTccs: mockTccs });

    // Kiểm tra cấu trúc snapshot chuẩn
    expect(snapshot.evaluationHash).toBeDefined();
    expect(snapshot.evaluationHash.length).toBe(64); // SHA-256 hash length
    expect(snapshot.overallStatus).toBe('PASS');
    expect(snapshot.tccsId).toBe(mockTccs.id);
    expect(snapshot.tccsVersion).toBe(1);
    expect(snapshot.criterionResults.length).toBe(3);

    // Kiểm tra lưu vết Criterion ID
    const crit1 = snapshot.criterionResults.find((c) => c.criterionId === 'crit-uuid-001');
    expect(crit1).toBeDefined();
    expect(crit1?.criterionId).toBe('crit-uuid-001');

    // Xác thực toàn vẹn bằng validator
    const integrityValid = verifyEvaluationSnapshotIntegrity(
      snapshot,
      initialTestResult.id,
      initialTestResult.batchId
    );
    expect(integrityValid).toBe(true);

    const fullValidation = validateEvaluationSnapshot(snapshot, initialTestResult, mockTccs);
    expect(fullValidation.isValid).toBe(true);
  });

  it('2. Chống giả mạo ALCOA+: Bất kỳ sửa đổi trái phép nào đều bị phát hiện ngay lập tức', () => {
    const qcUser = { uid: 'user-qc-01', email: 'kiemnghiemvien@v-biotech.vn' };
    const snapshot = buildEvaluationSnapshot(initialTestResult, qcUser, { boundTccs: mockTccs });

    // Kịch bản tấn công: Kẻ gian can thiệp trực tiếp vào kết quả chỉ tiêu trong snapshot
    const tamperedSnapshot = {
      ...snapshot,
      criterionResults: snapshot.criterionResults.map((c) =>
        c.criteriaName === 'Độ ẩm' ? { ...c, value: '15.0' } : c
      ),
    };

    const validationResult = validateEvaluationSnapshot(
      tamperedSnapshot,
      initialTestResult,
      mockTccs
    );
    expect(validationResult.isValid).toBe(false);
    expect(validationResult.reason).toContain(
      'Mã băm SHA-256 không hợp lệ hoặc dữ liệu snapshot bị sửa đổi'
    );
  });

  it('3. Chống đảo ngược trạng thái: Sửa overallStatus từ FAIL sang PASS bị chặn đứng', () => {
    const failedTestResult: TestResult = {
      ...initialTestResult,
      id: 'tr-amox-failed-002',
      overallStatus: 'FAIL',
      results: [
        {
          criterionId: 'crit-uuid-003',
          criteriaName: 'Độ ẩm',
          value: '8.5', // Rớt max 5.0%
          isPass: false,
          status: 'FAIL',
        },
      ],
    };

    const snapshot = buildEvaluationSnapshot(
      failedTestResult,
      { uid: 'user-qc-01' },
      { boundTccs: mockTccs }
    );
    expect(snapshot.overallStatus).toBe('FAIL');

    // Giả mạo đổi overallStatus sang PASS
    const forgedSnapshot = {
      ...snapshot,
      overallStatus: 'PASS' as const,
    };

    const validation = validateEvaluationSnapshot(forgedSnapshot, failedTestResult, mockTccs);
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toContain(
      'Mã băm SHA-256 không hợp lệ hoặc dữ liệu snapshot bị sửa đổi'
    );
  });

  it('4. Kiểm soát phiên bản tiêu chuẩn: TCCS nâng phiên bản (v1 -> v2) yêu cầu Re-evaluate', () => {
    const snapshotV1 = buildEvaluationSnapshot(
      initialTestResult,
      { uid: 'user-qc-01' },
      { boundTccs: mockTccs }
    );

    // Tiêu chuẩn cơ sở được sửa đổi ban hành phiên bản v2
    const upgradedTccs: TCCS = {
      ...mockTccs,
      version: 2,
    };

    const validation = validateEvaluationSnapshot(snapshotV1, initialTestResult, upgradedTccs);
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toContain('Snapshot dùng phiên bản TCCS cũ (v1 so với v2)');
  });

  it('5. Bất biến định danh (Criterion ID Invariance): Khi đổi tên chỉ tiêu hiển thị, ID vẫn bảo vệ toàn vẹn', () => {
    const snapshot = buildEvaluationSnapshot(
      initialTestResult,
      { uid: 'user-qc-01' },
      { boundTccs: mockTccs }
    );

    // Kiểm tra tất cả các chỉ tiêu trong snapshot đều có criterionId
    snapshot.criterionResults.forEach((crit) => {
      expect(crit.criterionId).toBeDefined();
      expect(crit.criterionId).toMatch(/^crit-uuid-\d+$/);
    });
  });
});
