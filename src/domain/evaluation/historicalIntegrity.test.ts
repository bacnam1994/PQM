/**
 * historicalIntegrity.test.ts
 * Kiểm tra toàn vẹn ALCOA+ của EvaluationSnapshot theo thời gian:
 * Khi TCCS thay đổi từ v1 sang v2 (siết chặt tiêu chuẩn), kết quả kiểm nghiệm lịch sử
 * đã phê duyệt và niêm phong bằng Snapshot KHÔNG bao giờ bị tính lại thành kết quả mới.
 */

import { describe, it, expect } from 'vitest';
import { QualityEvaluationEngine } from './QualityEvaluationEngine';
import {
  buildEvaluationSnapshot,
  createEvaluationHash,
  verifyEvaluationSnapshotIntegrity,
} from './EvaluationSnapshotBuilder';
import { TCCS, TestResult, Batch } from '../../types';

describe('P5 — Historical Integrity & Immutable Evaluation Snapshot', () => {
  it('bảo toàn kết quả đạt chuẩn của phiếu lịch sử khi TCCS thay đổi phiên bản mới', () => {
    // 1. Khởi tạo TCCS Phiên bản 1 (v1): Giới hạn hàm lượng 90.0 - 110.0%
    const tccsV1: TCCS = {
      id: 'tccs_amox_01',
      code: 'TCCS-AMOX-01',
      productId: 'prod_amox',
      productName: 'Amoxicillin 500mg',
      version: 1,
      isActive: true,
      issueDate: '2025-01-01',
      mainQualityCriteria: [
        {
          id: 'crit_assay',
          name: 'Hàm lượng Amoxicillin',
          type: 'NUMBER',
          min: 90.0,
          max: 110.0,
          unit: '%',
        },
      ],
      safetyCriteria: [],
      alternateRules: [],
      packaging: 'Vỉ 10 viên',
      storage: 'Nhiệt độ phòng',
      shelfLife: '36 tháng',
    } as any;

    // 2. Lô sản xuất B001 sản xuất theo TCCS v1
    const batchB001: Batch = {
      id: 'batch_b001',
      batchNo: 'B25001',
      productId: 'prod_amox',
      tccsId: 'tccs_amox_01',
      mfgDate: '2025-02-01',
      expDate: '2028-02-01',
      status: 'RELEASED',
    } as any;

    // 3. Nhập kết quả kiểm nghiệm cho Lô B001: Hàm lượng đạt 92.0%
    const rawResultsB001 = [
      {
        criteriaName: 'Hàm lượng Amoxicillin',
        value: '92.0',
        isPass: QualityEvaluationEngine.evaluateCriterionSmart(
          tccsV1.mainQualityCriteria[0],
          '92.0'
        ),
      },
    ];

    expect(rawResultsB001[0].isPass).toBe(true); // ĐẠT theo TCCS v1 (90 - 110%)

    const overallStatusB001 = QualityEvaluationEngine.calculateOverallStatus(
      rawResultsB001 as any,
      tccsV1
    );
    expect(overallStatusB001).toBe('PASS');

    const testResultB001: TestResult = {
      id: 'tr_b001',
      batchId: 'batch_b001',
      testDate: '2025-02-10',
      overallStatus: overallStatusB001,
      results: rawResultsB001 as any,
      labName: 'Phòng Kiểm Nghiệm V-Biotech',
      createdAt: '2025-02-10T10:00:00Z',
    };

    // Niêm phong kết quả bằng EvaluationSnapshot (ALCOA+)
    const snapshotB001 = buildEvaluationSnapshot(
      testResultB001,
      { email: 'qa.lead@v-biotech.com' },
      {
        batch: batchB001,
        tccs: tccsV1,
      }
    );
    testResultB001.evaluationSnapshot = snapshotB001;

    // Kiểm tra tính hợp lệ ban đầu của Snapshot
    expect(snapshotB001.overallStatus).toBe('PASS');
    expect(snapshotB001.tccsVersion).toBe(1);
    expect(snapshotB001.engineVersion).toBe('4.0.0-deterministic');
    expect(snapshotB001.evaluationHash).toBeDefined();

    // 4. BIẾN ĐỘNG HỆ THỐNG: TCCS được sửa đổi nâng cấp lên Phiên bản 2 (v2)
    // Tiêu chuẩn mới siết chặt dải hàm lượng thành: 95.0 - 105.0%
    const tccsV2: TCCS = {
      ...tccsV1,
      version: 2,
      issueDate: '2026-01-01',
      mainQualityCriteria: [
        {
          id: 'crit_assay',
          name: 'Hàm lượng Amoxicillin',
          type: 'NUMBER',
          min: 95.0, // Siết chặt từ 90 -> 95%
          max: 105.0,
          unit: '%',
        },
      ],
    } as any;

    // 5. Thử nghiệm đánh giá lô mới B002 sản xuất theo TCCS v2 cùng giá trị 92.0%
    const isPassUnderV2 = QualityEvaluationEngine.evaluateCriterionSmart(
      tccsV2.mainQualityCriteria[0],
      '92.0'
    );
    expect(isPassUnderV2).toBe(false); // Theo TCCS v2 thì 92.0% sẽ KHÔNG ĐẠT (FAIL)

    // 6. KIỂM ĐỊNH TOÀN VẸN LỊCH SỬ (HISTORICAL INTEGRITY ASSERTIONS):
    // Phiếu kiểm nghiệm lịch sử tr_b001 KHÔNG BAO GIỜ bị thay đổi theo TCCS v2
    expect(testResultB001.evaluationSnapshot?.overallStatus).toBe('PASS');
    expect(testResultB001.evaluationSnapshot?.tccsVersion).toBe(1);
    expect(testResultB001.evaluationSnapshot?.criterionResults[0].isPass).toBe(true);

    // Xác thực mã băm evaluationHash ban đầu vẫn khớp 100% với dữ liệu snapshot đã niêm phong (ALCOA+ SHA-256)
    const isIntegrityValid = verifyEvaluationSnapshotIntegrity(
      testResultB001.evaluationSnapshot,
      testResultB001.id,
      testResultB001.batchId
    );
    expect(isIntegrityValid).toBe(true);
  });
});
