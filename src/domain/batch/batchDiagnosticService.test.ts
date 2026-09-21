import { describe, it, expect } from 'vitest';
import { BatchDiagnosticService } from './batchDiagnosticService';
import { Batch, TestResult, TCCS, CriterionType } from '../../types';

describe('P1 — BATCH DIAGNOSTIC ENGINE & BATCH 702601 REGRESSION SUITE', () => {
  const mockTccs702601: TCCS = {
    id: 'TCCS-702601-V1',
    productId: 'PROD-NANO-CURCUMIN',
    code: 'TCCS-NC-2026',
    issueDate: '2026-01-10',
    isActive: true,
    mainQualityCriteria: [
      { name: 'Độ ẩm', unit: '%', min: 0, max: 5.0, type: CriterionType.NUMBER },
      {
        name: 'Hàm lượng Curcumin',
        unit: 'mg/viên',
        min: 90.0,
        max: 110.0,
        type: CriterionType.NUMBER,
      },
      { name: 'Độ rã', unit: 'phút', max: 30, type: CriterionType.NUMBER },
    ],
    safetyCriteria: [
      { name: 'Chì (Pb)', unit: 'ppm', max: 2.0, type: CriterionType.NUMBER },
      {
        name: 'Tổng số vi sinh vật hiếu khí',
        unit: 'CFU/g',
        max: 1000,
        type: CriterionType.NUMBER,
      },
    ],
    createdAt: '2026-01-10T00:00:00.000Z',
  };

  const mockBatch702601: Batch = {
    id: 'batch-702601-uid',
    batchNo: '702601',
    productId: 'PROD-NANO-CURCUMIN',
    tccsId: 'TCCS-702601-V1',
    mfgDate: '2026-09-10',
    expDate: '2028-09-10',
    theoreticalYield: 50000,
    actualYield: 49800,
    yieldUnit: 'viên',
    status: 'TESTING',
    createdAt: '2026-09-10T08:00:00.000Z',
  };

  it('1. Chẩn đoán Lô 702601 khi đã kiểm đủ 100% và ĐẠT chuẩn (Full Pass)', () => {
    const testResultPass: TestResult = {
      id: 'TR-702601-01',
      batchId: 'batch-702601-uid',
      labName: 'QUATEST 3',
      testDate: '2026-09-15',
      overallStatus: 'PASS',
      status: 'APPROVED',
      results: [
        { criteriaName: 'Độ ẩm', value: 3.4, isPass: true, unit: '%' },
        { criteriaName: 'Hàm lượng Curcumin', value: 102.5, isPass: true, unit: 'mg/viên' },
        { criteriaName: 'Độ rã', value: 15, isPass: true, unit: 'phút' },
        { criteriaName: 'Chì (Pb)', value: 0.05, isPass: true, unit: 'ppm' },
        { criteriaName: 'Tổng số vi sinh vật hiếu khí', value: 120, isPass: true, unit: 'CFU/g' },
      ],
      createdAt: '2026-09-15T10:00:00.000Z',
    };

    const report = BatchDiagnosticService.diagnoseBatch('702601', {
      batches: [mockBatch702601],
      testResults: [testResultPass],
      tccsList: [mockTccs702601],
    });

    expect(report.batchInfo.batchNo).toBe('702601');
    expect(report.batchInfo.workflowStatus).toBe('TESTING');
    expect(report.completion.requiredCriteriaCount).toBe(5);
    expect(report.completion.testedCriteriaCount).toBe(5);
    expect(report.completion.completionPercentage).toBe(100);
    expect(report.canonicalResult.status).toBe('PASS');
    expect(report.releaseGate.isEligible).toBe(true);

    // In cây chẩn đoán mẫu
    console.log('\n===== CHẨN ĐOÁN LÔ 702601 (ĐẠT CHUẨN) =====\n' + report.asciiTree);
    expect(report.asciiTree).toContain('BATCH');
    expect(report.asciiTree).toContain('COMPLETION');
    expect(report.asciiTree).toContain('QUALITY');
    expect(report.asciiTree).toContain('CANONICAL RESULT');
    expect(report.asciiTree).toContain('RELEASE GATE');
  });

  it('2. Chẩn đoán Lô 702601 khi kiểm chưa đủ chỉ tiêu (Incomplete / Pending)', () => {
    const testResultPartial: TestResult = {
      id: 'TR-702601-PARTIAL',
      batchId: 'batch-702601-uid',
      labName: 'Lab Nội bộ',
      testDate: '2026-09-12',
      overallStatus: 'PENDING',
      status: 'TESTING',
      results: [
        { criteriaName: 'Độ ẩm', value: 3.2, isPass: true, unit: '%' },
        { criteriaName: 'Hàm lượng Curcumin', value: 99.8, isPass: true, unit: 'mg/viên' },
      ],
      createdAt: '2026-09-12T10:00:00.000Z',
    };

    const report = BatchDiagnosticService.diagnoseBatch('702601', {
      batches: [mockBatch702601],
      testResults: [testResultPartial],
      tccsList: [mockTccs702601],
    });

    expect(report.completion.completionPercentage).toBeLessThan(100);
    expect(report.completion.isComplete).toBe(false);
    expect(report.completion.missingCriteria.length).toBe(3);
    expect(report.releaseGate.isEligible).toBe(false);
    expect(report.releaseGate.blockers.some((b) => b.includes('chưa kiểm nghiệm hoàn tất'))).toBe(
      true
    );

    console.log('\n===== CHẨN ĐOÁN LÔ 702601 (CHƯA HOÀN TẤT) =====\n' + report.asciiTree);
  });

  it('3. Chẩn đoán Lô 702601 khi có chỉ tiêu FAIL (OOS Blocker)', () => {
    const testResultFail: TestResult = {
      id: 'TR-702601-FAIL',
      batchId: 'batch-702601-uid',
      labName: 'EUROFINS',
      testDate: '2026-09-14',
      overallStatus: 'FAIL',
      status: 'APPROVED',
      results: [
        { criteriaName: 'Độ ẩm', value: 3.4, isPass: true, unit: '%' },
        { criteriaName: 'Hàm lượng Curcumin', value: 75.0, isPass: false, unit: 'mg/viên' }, // Dưới 90 mg -> FAIL
        { criteriaName: 'Độ rã', value: 20, isPass: true, unit: 'phút' },
        { criteriaName: 'Chì (Pb)', value: 0.05, isPass: true, unit: 'ppm' },
        { criteriaName: 'Tổng số vi sinh vật hiếu khí', value: 120, isPass: true, unit: 'CFU/g' },
      ],
      createdAt: '2026-09-14T10:00:00.000Z',
    };

    const report = BatchDiagnosticService.diagnoseBatch('702601', {
      batches: [mockBatch702601],
      testResults: [testResultFail],
      tccsList: [mockTccs702601],
    });

    expect(report.canonicalResult.status).toBe('FAIL');
    expect(report.releaseGate.isEligible).toBe(false);
    expect(report.releaseGate.blockers.some((b) => b.includes('không đạt chuẩn'))).toBe(true);
    // Batch status vẫn giữ nguyên TESTING, không tự động chuyển REJECTED
    expect(report.batchInfo.workflowStatus).toBe('TESTING');

    console.log('\n===== CHẨN ĐOÁN LÔ 702601 (KHÔNG ĐẠT) =====\n' + report.asciiTree);
  });

  it('4. Chẩn đoán Lô không tồn tại', () => {
    const report = BatchDiagnosticService.diagnoseBatch('999999_NON_EXISTENT', {
      batches: [mockBatch702601],
      testResults: [],
    });

    expect(report.canonicalResult.status).toBe('UNKNOWN');
    expect(report.releaseGate.isEligible).toBe(false);
    expect(report.asciiTree).toContain('Không tìm thấy Lô sản xuất');
  });
});
