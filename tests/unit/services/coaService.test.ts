/**
 * tests/unit/services/coaService.test.ts
 * =======================================
 * Kiểm thử đơn vị cho CoAService:
 * - Đọc từ EvaluationSnapshot đã niêm phong (BR-COA-001)
 * - Tự động phát sinh Footnote cho chỉ tiêu thay thế / miễn kiểm (BR-COA-002)
 * - Phát hiện can thiệp chữ ký băm SHA-256 (BR-COA-003)
 */

import { describe, it, expect } from 'vitest';
import { CoAService } from '../../../src/services/app/CoAService';
import { Batch, TestResult, TCCS, CriterionType } from '../../../src/types';
import { buildEvaluationSnapshot } from '../../../src/domain/evaluation/EvaluationSnapshotBuilder';

describe('CoAService Unit Tests', () => {
  const service = new CoAService();

  const mockTccs: TCCS = {
    id: 'tccs-para',
    productId: 'prod-para',
    code: 'TCCS-PARA',
    productName: 'Paracetamol 500mg',
    isActive: true,
    mainQualityCriteria: [
      { id: 'c1', name: 'Định lượng', unit: '%', min: 95, max: 105, type: CriterionType.NUMBER },
      { id: 'c2', name: 'Độ hòa tan', unit: '%', min: 75, type: CriterionType.NUMBER },
    ],
  };

  const mockBatch: Batch = {
    id: 'batch-01',
    batchNo: 'LOT-2026-001',
    productId: 'prod-para',
    productName: 'Paracetamol 500mg',
    tccsId: 'tccs-para',
    status: 'RELEASED',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
  };

  it('Tạo CoA thành công từ Snapshot nguyên vẹn với đầy đủ thông tin pháp lý', () => {
    const testResult: TestResult = {
      id: 'tr-01',
      batchId: 'batch-01',
      productId: 'prod-para',
      tccsId: 'tccs-para',
      overallStatus: 'PASS',
      testDate: '2026-01-02',
      labName: 'Phòng Kiểm Nghiệm Trung Tâm',
      results: [
        {
          criterionId: 'c1',
          criteriaName: 'Định lượng',
          value: '100.2',
          isPass: true,
          status: 'PASS',
        },
        {
          criterionId: 'c2',
          criteriaName: 'Độ hòa tan',
          value: '85.0',
          isPass: true,
          status: 'PASS',
        },
      ],
    } as any;

    const snapshot = buildEvaluationSnapshot(
      testResult,
      { email: 'qa_lead@pqm.com' },
      { tccs: mockTccs }
    );
    testResult.evaluationSnapshot = snapshot;

    const coa = service.generateCoAPayload({
      batch: mockBatch,
      testResult,
      tccs: mockTccs,
      currentUser: { email: 'qa_lead@pqm.com' },
    });

    expect(coa.coaNumber).toContain('LOT-2026-001');
    expect(coa.overallConclusion).toBe('ĐẠT TIÊU CHUẨN');
    expect(coa.canonicalStatus).toBe('PASS');
    expect(coa.criteriaList).toHaveLength(2);
    expect(coa.isIntegrityVerified).toBe(true);
    expect(coa.alcoaHash).toBe(snapshot.evaluationHash);
  });

  it('Báo lỗi bảo mật nếu EvaluationSnapshot bị can thiệp trái phép (Tamper Detection)', () => {
    const testResult: TestResult = {
      id: 'tr-01',
      batchId: 'batch-01',
      productId: 'prod-para',
      tccsId: 'tccs-para',
      overallStatus: 'PASS',
      testDate: '2026-01-02',
      labName: 'Phòng Kiểm Nghiệm',
      results: [
        {
          criterionId: 'c1',
          criteriaName: 'Định lượng',
          value: '100.2',
          isPass: true,
          status: 'PASS',
        },
      ],
    } as any;

    const snapshot = buildEvaluationSnapshot(
      testResult,
      { email: 'qa_lead@pqm.com' },
      { tccs: mockTccs }
    );

    // Can thiệp sửa lén dữ liệu snapshot mà không cập nhật hash
    snapshot.criterionResults[0].value = '999.0 (Hacker Tampered)';
    testResult.evaluationSnapshot = snapshot;

    expect(() =>
      service.generateCoAPayload({
        batch: mockBatch,
        testResult,
        tccs: mockTccs,
        currentUser: { email: 'qa_lead@pqm.com' },
      })
    ).toThrow('CẢNH BÁO BẢO MẬT: Chữ ký băm toàn vẹn');
  });

  it('Báo lỗi nếu phiếu kiểm nghiệm chưa có EvaluationSnapshot', () => {
    const unsealedTestResult: TestResult = {
      id: 'tr-02',
      batchId: 'batch-01',
      overallStatus: 'PASS',
      results: [],
    } as any;

    expect(() =>
      service.generateCoAPayload({
        batch: mockBatch,
        testResult: unsealedTestResult,
        tccs: mockTccs,
        currentUser: { email: 'qa@pqm.com' },
      })
    ).toThrow('chưa có Bản chụp thẩm định niêm phong (EvaluationSnapshot)');
  });
});
