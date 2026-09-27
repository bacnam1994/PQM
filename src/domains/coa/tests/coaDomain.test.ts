import { describe, it, expect, vi } from 'vitest';
import {
  CoARules,
  CoAStateMachine,
  CoAService,
  CoAQueries,
  COA_ACTIONS,
  COA_STATUS_LABELS,
} from '../index';
import { Batch, TestResult, TCCS, CriterionType } from '../../../types';
import { buildEvaluationSnapshot } from '../../../domain/evaluation/EvaluationSnapshotBuilder';

describe('VS-11: CoA Domain (BR-COA-001 -> BR-COA-004 & ALCOA+)', () => {
  const service = new CoAService();
  const queries = new CoAQueries(service);

  const mockTccs: TCCS = {
    id: 'tccs-para-01',
    productId: 'prod-para-500',
    code: 'TCCS-PARA-01',
    productName: 'Paracetamol 500mg',
    isActive: true,
    createdAt: new Date().toISOString(),
    mainQualityCriteria: [
      {
        id: 'crit_1',
        name: 'Định lượng',
        unit: '%',
        min: 95,
        max: 105,
        type: CriterionType.NUMBER,
      },
      { id: 'crit_2', name: 'Độ hòa tan', unit: '%', min: 75, type: CriterionType.NUMBER },
    ],
  } as any;

  const mockBatch: Batch = {
    id: 'batch_test_01',
    batchNo: 'LOT-2026-PARA',
    productId: 'prod-para-500',
    productName: 'Paracetamol 500mg',
    tccsId: 'tccs-para-01',
    status: 'RELEASED',
    mfgDate: '2026-01-15',
    expDate: '2028-01-15',
  } as any;

  describe('CoARules & ALCOA+ Data Integrity', () => {
    it('xác thực chữ ký băm snapshot nguyên vẹn (BR-COA-001 & BR-COA-003)', () => {
      const tr: TestResult = {
        id: 'tr_valid_01',
        batchId: 'batch_test_01',
        productId: 'prod-para-500',
        tccsId: 'tccs-para-01',
        overallStatus: 'PASS',
        testDate: '2026-01-16',
        labName: 'Phòng Lab Trung Tâm',
        results: [
          {
            criterionId: 'crit_1',
            criteriaName: 'Định lượng',
            value: '100.5',
            isPass: true,
            status: 'PASS',
          },
          {
            criterionId: 'crit_2',
            criteriaName: 'Độ hòa tan',
            value: '88.0',
            isPass: true,
            status: 'PASS',
          },
        ],
      } as any;

      const snapshot = buildEvaluationSnapshot(
        tr,
        { email: 'qa@v-biotech.com' },
        { tccs: mockTccs }
      );
      tr.evaluationSnapshot = snapshot;

      const isValid = CoARules.verifySnapshotIntegrity(snapshot, tr.id, tr.batchId);
      expect(isValid).toBe(true);

      // Thử can thiệp giá trị -> băm không khớp
      const tampered = {
        ...snapshot,
        criterionResults: [{ ...snapshot.criterionResults[0], value: '999' }],
      };
      const isTamperedValid = CoARules.verifySnapshotIntegrity(tampered, tr.id, tr.batchId);
      expect(isTamperedValid).toBe(false);
    });

    it('tự động thu thập Footnote cho chỉ tiêu Miễn kiểm / Thay thế (BR-COA-002)', () => {
      const mockSnapshot: any = {
        criterionResults: [
          {
            criteriaName: 'Độ đồng đều khối lượng',
            value: 'Đạt',
            isPass: true,
            alternateState: 'NONE',
          },
          {
            criteriaName: 'Tạp chất liên quan',
            value: '',
            isPass: true,
            alternateState: 'EXEMPTED',
            alternateNote: 'Miễn kiểm tra theo chuyên luận Dược điển',
          },
        ],
      };

      const { criteriaList, footnotes } = CoARules.buildCriteriaAndFootnotes(
        mockSnapshot,
        mockTccs
      );
      expect(criteriaList).toHaveLength(2);
      expect(criteriaList[1].isExempted).toBe(true);
      expect(criteriaList[1].result).toContain('Miễn kiểm');
      expect(footnotes).toHaveLength(1);
      expect(footnotes[0].text).toContain('Miễn kiểm tra theo chuyên luận Dược điển');
    });

    it('kiểm tra độ dài lý do thu hồi chứng nhận CoA (tối thiểu 20 ký tự)', () => {
      const shortReason = CoARules.validateRevocationReason('Lỗi dữ liệu');
      expect(shortReason.isValid).toBe(false);
      expect(shortReason.error).toContain('ERR_REVOCATION_REASON_TOO_SHORT');

      const validReason = CoARules.validateRevocationReason(
        'Phát hiện lỗi sai lệch nhiệt độ phòng lab trong ca kiểm nghiệm ngày 15/01/2026'
      );
      expect(validReason.isValid).toBe(true);
    });
  });

  describe('CoAStateMachine', () => {
    it('cho phép chuyển trạng thái hợp lệ', () => {
      expect(CoAStateMachine.canTransition('GENERATED', 'SIGNED').allowed).toBe(true);
      expect(CoAStateMachine.canTransition('GENERATED', 'REVOKED').allowed).toBe(true);
      expect(CoAStateMachine.canTransition('SIGNED', 'REVOKED').allowed).toBe(true);
    });

    it('từ chối chuyển trạng thái sau khi đã thu hồi (REVOKED)', () => {
      const res = CoAStateMachine.canTransition('REVOKED', 'SIGNED');
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('không hợp lệ');
    });
  });

  describe('CoAService & Queries', () => {
    it('sinh tài liệu CoA thành công từ Snapshot hợp lệ', () => {
      const tr: TestResult = {
        id: 'tr_test_02',
        batchId: 'batch_test_01',
        productId: 'prod-para-500',
        tccsId: 'tccs-para-01',
        overallStatus: 'PASS',
        testDate: '2026-01-16',
        labName: 'Phòng Lab Trung Tâm',
        results: [
          {
            criterionId: 'crit_1',
            criteriaName: 'Định lượng',
            value: '101.2',
            isPass: true,
            status: 'PASS',
          },
        ],
      } as any;

      const snapshot = buildEvaluationSnapshot(
        tr,
        { email: 'qa_manager@v-biotech.com' },
        { tccs: mockTccs }
      );
      tr.evaluationSnapshot = snapshot;

      const payload = service.generateCoAPayload({
        batch: mockBatch,
        testResult: tr,
        tccs: mockTccs,
        currentUser: { email: 'qa_manager@v-biotech.com', role: 'QA' },
      });

      expect(payload.coaNumber).toContain('LOT-2026-PARA');
      expect(payload.overallConclusion).toBe('ĐẠT TIÊU CHUẨN');
      expect(payload.canonicalStatus).toBe('PASS');
      expect(payload.isIntegrityVerified).toBe(true);
      expect(payload.alcoaHash).toBe(snapshot.evaluationHash);
    });

    it('từ chối sinh CoA nếu phiếu kiểm nghiệm chưa có EvaluationSnapshot', () => {
      const unsealedTR: TestResult = {
        id: 'tr_unsealed',
        batchId: 'batch_test_01',
        overallStatus: 'PASS',
        results: [],
      } as any;

      expect(() =>
        service.generateCoAPayload({
          batch: mockBatch,
          testResult: unsealedTR,
          tccs: mockTccs,
          currentUser: { email: 'qa@v-biotech.com' },
        })
      ).toThrow('chưa có Bản chụp thẩm định niêm phong (EvaluationSnapshot)');
    });

    it('truy vấn tài liệu CoA thông qua CoAQueries', () => {
      const tr: TestResult = {
        id: 'tr_test_03',
        batchId: 'batch_test_01',
        overallStatus: 'PASS',
        testDate: '2026-01-16',
        results: [
          {
            criterionId: 'crit_1',
            criteriaName: 'Định lượng',
            value: '99.8',
            isPass: true,
            status: 'PASS',
          },
        ],
      } as any;

      const snapshot = buildEvaluationSnapshot(
        tr,
        { email: 'qa@v-biotech.com' },
        { tccs: mockTccs }
      );
      tr.evaluationSnapshot = snapshot;

      const doc = queries.getDocumentPayload({
        batch: mockBatch,
        testResult: tr,
        tccs: mockTccs,
        currentUser: { email: 'qa@v-biotech.com' },
      });

      expect(doc.criteriaList[0].result).toBe('99.8');
      expect(doc.overallConclusion).toBe('ĐẠT TIÊU CHUẨN');
    });
  });

  describe('Workflow Metadata & Definitions', () => {
    it('định nghĩa đầy đủ action ID cho CoA', () => {
      expect(COA_ACTIONS.GENERATE).toBe('COA_GENERATE');
      expect(COA_ACTIONS.SIGN).toBe('COA_SIGN');
      expect(COA_ACTIONS.REVOKE).toBe('COA_REVOKE');
    });

    it('định nghĩa nhãn hiển thị CoA chuẩn xác', () => {
      expect(COA_STATUS_LABELS.GENERATED).toBe('Đã tạo bản chụp CoA');
      expect(COA_STATUS_LABELS.SIGNED).toBe('Đã ký số ban hành');
      expect(COA_STATUS_LABELS.REVOKED).toBe('Đã thu hồi hiệu lực');
    });
  });
});
