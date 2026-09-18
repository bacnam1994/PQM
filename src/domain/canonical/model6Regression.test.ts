import { describe, it, expect } from 'vitest';
import { BatchRules } from '../rules/BatchRules';
import { ReleaseRules } from '../rules/ReleaseRules';
import { TestResultRules } from '../rules/TestResultRules';
import { TCCSRules } from '../rules/TCCSRules';
import { Batch, TestResult, TCCS, QualityDeviation, CriterionType } from '../../types';

describe('Model 6 Regression Suite: Business Rules Engine', () => {
  const mockTccs: TCCS = {
    id: 'tccs-001',
    productId: 'prod-001',
    code: 'TCCS-001',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      { name: 'Định lượng', unit: '%', min: 90, max: 110, type: CriterionType.NUMBER },
      { name: 'Độ ẩm', unit: '%', min: 0, max: 5, type: CriterionType.NUMBER },
    ],
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const mockBatch: Batch = {
    id: 'batch-001',
    productId: 'prod-001',
    tccsId: 'tccs-001',
    batchNo: 'B260901',
    mfgDate: '2026-09-01',
    expDate: '2028-09-01',
    theoreticalYield: 1000,
    actualYield: 995,
    yieldUnit: 'chai',
    status: 'TESTING',
    createdAt: '2026-09-01T08:00:00.000Z',
  };

  const mockTestResultPass: TestResult = {
    id: 'tr-001',
    batchId: 'batch-001',
    tccsId: 'tccs-001',
    labName: 'Phòng Kiểm Nghiệm Trung Tâm',
    testDate: '2026-09-05',
    overallStatus: 'PASS',
    results: [
      { criteriaName: 'Định lượng', value: 100.2, isPass: true },
      { criteriaName: 'Độ ẩm', value: 3.5, isPass: true },
    ],
    createdAt: '2026-09-05T08:00:00.000Z',
  };

  const mockTestResultFail: TestResult = {
    id: 'tr-002',
    batchId: 'batch-001',
    tccsId: 'tccs-001',
    labName: 'Phòng Kiểm Nghiệm Trung Tâm',
    testDate: '2026-09-05',
    overallStatus: 'FAIL',
    results: [
      { criteriaName: 'Định lượng', value: 85.0, isPass: false },
      { criteriaName: 'Độ ẩm', value: 3.5, isPass: true },
    ],
    createdAt: '2026-09-05T08:00:00.000Z',
  };

  describe('1. BatchRules', () => {
    it('cho phép xuất xưởng khi đủ điều kiện: QA role, test đạt, không có sai lệch', () => {
      const res = BatchRules.canRelease(mockBatch, [mockTestResultPass], 'QA', mockTccs);
      expect(res.allowed).toBe(true);
      expect(res.blockers).toHaveLength(0);
    });

    it('chặn xuất xưởng khi vai trò không có thẩm quyền (chỉ QA/ADMIN)', () => {
      const res = BatchRules.canRelease(mockBatch, [mockTestResultPass], 'USER', mockTccs);
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('không có thẩm quyền');
    });

    it('chặn xuất xưởng khi Lô đã xuất xưởng hoặc đã bị từ chối', () => {
      const resReleased = BatchRules.canRelease(
        { ...mockBatch, status: 'RELEASED' },
        [mockTestResultPass],
        'QA',
        mockTccs
      );
      expect(resReleased.allowed).toBe(false);
      expect(resReleased.blockers?.[0]).toContain('đã ở trạng thái Xuất xưởng');

      const resRejected = BatchRules.canRelease(
        { ...mockBatch, status: 'REJECTED' },
        [mockTestResultPass],
        'QA',
        mockTccs
      );
      expect(resRejected.allowed).toBe(false);
      expect(resRejected.blockers?.[0]).toContain('đã bị Từ chối');
    });

    it('chặn xuất xưởng khi kết quả kiểm nghiệm không đạt PASS', () => {
      const res = BatchRules.canRelease(mockBatch, [mockTestResultFail], 'QA', mockTccs);
      expect(res.allowed).toBe(false);
      expect(res.blockers?.some((b) => b.includes('chưa đạt chuẩn PASS'))).toBe(true);
    });

    it('chặn xuất xưởng khi Lô đã quá hạn sử dụng (Biological Expired Batch)', () => {
      const expiredBatch: Batch = {
        ...mockBatch,
        expDate: '2025-01-01',
      };
      const res = BatchRules.canRelease(expiredBatch, [mockTestResultPass], 'QA', mockTccs, [], {
        asOfDate: '2026-09-18',
      });
      expect(res.allowed).toBe(false);
      expect(res.blockers?.some((b) => b.includes('đã hết hạn sử dụng'))).toBe(true);
    });

    it('chặn xuất xưởng khi có sai lệch nghiêm trọng (CRITICAL) chưa đóng', () => {
      const openDev: QualityDeviation = {
        id: 'dev-001',
        deviationNo: 'DEV-2026-0001',
        batchId: 'batch-001',
        severity: 'CRITICAL',
        status: 'LOGGED',
        title: 'Nhiệt độ phòng sấy vượt ngưỡng',
        source: 'STORAGE_ENVIRONMENT',
        description: 'Vượt nhiệt độ 5 độ C',
        loggedBy: 'qa-user',
        loggedAt: '2026-09-02T00:00:00Z',
        version: 1,
        updatedAt: '2026-09-02T00:00:00Z',
      };

      const res = BatchRules.canRelease(mockBatch, [mockTestResultPass], 'QA', mockTccs, [openDev]);
      expect(res.allowed).toBe(false);
      expect(res.blockers?.some((b) => b.includes('CRITICAL'))).toBe(true);
    });

    it('cho phép xuất xưởng khi sai lệch nghiêm trọng đã được đóng (CLOSED)', () => {
      const closedDev: QualityDeviation = {
        id: 'dev-001',
        deviationNo: 'DEV-2026-0001',
        batchId: 'batch-001',
        severity: 'CRITICAL',
        status: 'CLOSED',
        title: 'Nhiệt độ phòng sấy vượt ngưỡng',
        source: 'STORAGE_ENVIRONMENT',
        description: 'Vượt nhiệt độ 5 độ C',
        loggedBy: 'qa-user',
        loggedAt: '2026-09-02T00:00:00Z',
        version: 1,
        updatedAt: '2026-09-02T00:00:00Z',
      };

      const res = BatchRules.canRelease(mockBatch, [mockTestResultPass], 'QA', mockTccs, [
        closedDev,
      ]);
      expect(res.allowed).toBe(true);
    });

    it('canEditReleased: chỉ cho phép ADMIN sửa lô đã xuất xưởng', () => {
      const releasedBatch: Batch = { ...mockBatch, status: 'RELEASED' };
      expect(BatchRules.canEditReleased(releasedBatch, 'QA').allowed).toBe(false);
      expect(BatchRules.canEditReleased(releasedBatch, 'ADMIN').allowed).toBe(true);
      expect(BatchRules.canEditReleased(mockBatch, 'QA').allowed).toBe(true);
    });

    it('canReject: yêu cầu lý do bắt buộc và vai trò QA/ADMIN, chặn từ chối lô đã xuất xưởng', () => {
      expect(BatchRules.canReject(mockBatch, '', 'QA').allowed).toBe(false);
      expect(BatchRules.canReject(mockBatch, 'Lô nhiễm tạp chất', 'USER').allowed).toBe(false);
      expect(BatchRules.canReject(mockBatch, 'Lô nhiễm tạp chất', 'QA').allowed).toBe(true);

      const releasedBatch: Batch = { ...mockBatch, status: 'RELEASED' };
      expect(BatchRules.canReject(releasedBatch, 'Lô hư hỏng', 'QA').allowed).toBe(false);
    });

    it('canRecall: chỉ cho phép thu hồi lô đã xuất xưởng kèm lý do', () => {
      expect(BatchRules.canRecall(mockBatch, 'Thu hồi khẩn cấp', 'QA').allowed).toBe(false);
      const releasedBatch: Batch = { ...mockBatch, status: 'RELEASED' };
      expect(BatchRules.canRecall(releasedBatch, '', 'QA').allowed).toBe(false);
      expect(BatchRules.canRecall(releasedBatch, 'Thu hồi do khiếu nại', 'QA').allowed).toBe(true);
    });

    it('canTransitionStatus: chặn bước chuyển bất hợp pháp REJECTED -> RELEASED', () => {
      expect(BatchRules.canTransitionStatus('TESTING', 'RELEASED', 'QA').allowed).toBe(true);
      expect(BatchRules.canTransitionStatus('REJECTED', 'RELEASED', 'QA').allowed).toBe(false);
      expect(BatchRules.canTransitionStatus('RELEASED', 'TESTING', 'QA').allowed).toBe(false);
      expect(BatchRules.canTransitionStatus('RELEASED', 'TESTING', 'ADMIN').allowed).toBe(true);
    });
  });

  describe('2. ReleaseRules', () => {
    it('evaluateReleasePrerequisites: đánh giá toàn diện các điều kiện tiên quyết và tính điểm 100', () => {
      const res = ReleaseRules.evaluateReleasePrerequisites({
        batch: mockBatch,
        testResults: [mockTestResultPass],
        boundTccs: mockTccs,
        userRole: 'QA',
      });
      expect(res.isEligibleForRelease).toBe(true);
      expect(res.score).toBe(100);
      expect(res.criteriaMet.hasAuthoritativeTestResult).toBe(true);
      expect(res.criteriaMet.allTestCriteriaPassed).toBe(true);
      expect(res.criteriaMet.isNotExpired).toBe(true);
      expect(res.criteriaMet.isNotAlreadyClosed).toBe(true);
    });

    it('evaluateReleasePrerequisites: trừ điểm và chặn xuất xưởng khi có chỉ tiêu kiểm nghiệm không đạt', () => {
      const res = ReleaseRules.evaluateReleasePrerequisites({
        batch: mockBatch,
        testResults: [mockTestResultFail],
        boundTccs: mockTccs,
        userRole: 'QA',
      });
      expect(res.isEligibleForRelease).toBe(false);
      expect(res.score).toBeLessThan(100);
      expect(res.blockers.some((b) => b.includes('chưa đạt chuẩn PASS'))).toBe(true);
    });

    it('canSignRelease: phương thức tiện ích trả về chính xác kết quả thẩm định', () => {
      expect(ReleaseRules.canSignRelease(mockBatch, [mockTestResultPass], 'QA').allowed).toBe(true);
      expect(ReleaseRules.canSignRelease(mockBatch, [mockTestResultFail], 'QA').allowed).toBe(
        false
      );
    });
  });

  describe('3. TestResultRules', () => {
    it('canApprove: cho phép duyệt phiếu đạt chuẩn khi có đủ thẩm quyền QA/QC/ADMIN', () => {
      expect(TestResultRules.canApprove(mockTestResultPass, 'QA').allowed).toBe(true);
      expect(TestResultRules.canApprove(mockTestResultPass, 'QC').allowed).toBe(true);
      expect(TestResultRules.canApprove(mockTestResultPass, 'ADMIN').allowed).toBe(true);
      expect(TestResultRules.canApprove(mockTestResultPass, 'USER').allowed).toBe(false);
    });

    it('canApprove: chặn phê duyệt phiếu không có chỉ tiêu', () => {
      const emptyResult: TestResult = { ...mockTestResultPass, results: [] };
      const res = TestResultRules.canApprove(emptyResult, 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('chưa có dữ liệu');
    });

    it('canApprove: chặn phê duyệt phiếu có chỉ tiêu đang PENDING', () => {
      const pendingResult: TestResult = {
        ...mockTestResultPass,
        results: [{ criteriaName: 'Định lượng', value: '', isPass: null as any }],
      };
      const res = TestResultRules.canApprove(pendingResult, 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.some((b) => b.includes('chưa hoàn tất'))).toBe(true);
    });

    it('canApprove: BẤT BIẾN - chặn phê duyệt ĐẠT (overallStatus: PASS) khi có chỉ tiêu FAIL', () => {
      const corruptedResult: TestResult = {
        ...mockTestResultFail,
        overallStatus: 'PASS', // Cố tình khai man trạng thái
      };
      const res = TestResultRules.canApprove(corruptedResult, 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.some((b) => b.includes('Không thể phê duyệt ĐẠT (PASS)'))).toBe(true);
    });

    it('canEdit & canDelete: bảo vệ phiếu của Lô đã xuất xưởng hoặc đã niêm phong snapshot', () => {
      const releasedBatch: Batch = { ...mockBatch, status: 'RELEASED' };
      expect(TestResultRules.canEdit(mockTestResultPass, releasedBatch, 'QA').allowed).toBe(false);
      expect(TestResultRules.canEdit(mockTestResultPass, releasedBatch, 'ADMIN').allowed).toBe(
        true
      );

      expect(TestResultRules.canDelete(mockTestResultPass, releasedBatch, 'ADMIN').allowed).toBe(
        false
      );
      expect(TestResultRules.canDelete(mockTestResultPass, mockBatch, 'USER').allowed).toBe(false);
      expect(TestResultRules.canDelete(mockTestResultPass, mockBatch, 'QA').allowed).toBe(true);
    });

    it('canOverrideStatus: chỉ cho phép QA/ADMIN có lý do, và cấm ghi đè PASS khi có chỉ tiêu OOS', () => {
      expect(TestResultRules.canOverrideStatus(mockTestResultPass, 'FAIL', '', 'QA').allowed).toBe(
        false
      );
      expect(
        TestResultRules.canOverrideStatus(mockTestResultPass, 'FAIL', 'Ghi đè thử nghiệm', 'USER')
          .allowed
      ).toBe(false);
      expect(
        TestResultRules.canOverrideStatus(
          mockTestResultPass,
          'FAIL',
          'Mẫu bị nhiễm ngoại lai',
          'QA'
        ).allowed
      ).toBe(true);

      // Cố tình ghi đè phiếu hỏng thành PASS mà không có bằng chứng
      const overridePassFail = TestResultRules.canOverrideStatus(
        mockTestResultFail,
        'PASS',
        'Cố ý ghi đè',
        'QA'
      );
      expect(overridePassFail.allowed).toBe(false);
      expect(overridePassFail.blockers?.[0]).toContain('Không thể ghi đè trạng thái thành PASS');
    });
  });

  describe('4. TCCSRules', () => {
    it('getActiveTCCS: lấy chính xác TCCS hiệu lực của sản phẩm', () => {
      const active = TCCSRules.getActiveTCCS('prod-001', [mockTccs]);
      expect(active?.id).toBe('tccs-001');
    });

    it('validateActiveStatus: phát hiện lỗi thiếu TCCS hoặc nhiều TCCS cùng hiệu lực', () => {
      const inactiveTccs = { ...mockTccs, isActive: false };
      expect(TCCSRules.validateActiveStatus('prod-001', [inactiveTccs]).issue).toBe(
        'NO_ACTIVE_TCCS'
      );

      const dupActive = [mockTccs, { ...mockTccs, id: 'tccs-002', isActive: true }];
      expect(TCCSRules.validateActiveStatus('prod-001', dupActive).issue).toBe(
        'MULTIPLE_ACTIVE_TCCS'
      );
    });

    it('validateCriteriaDefinitions: phát hiện chỉ tiêu rỗng, tên trùng lặp, hoặc min > max', () => {
      const invalidTccs: TCCS = {
        ...mockTccs,
        mainQualityCriteria: [
          { name: 'Định lượng', unit: '%', min: 110, max: 90, type: CriterionType.NUMBER },
          { name: 'Định lượng', unit: '%', min: 0, max: 10, type: CriterionType.NUMBER },
          { name: '', unit: '%', min: 0, max: 5, type: CriterionType.NUMBER },
        ],
      };

      const check = TCCSRules.validateCriteriaDefinitions(invalidTccs);
      expect(check.isValid).toBe(false);
      expect(check.errors.some((e) => e.includes('lớn hơn cận trên'))).toBe(true);
      expect(check.errors.some((e) => e.includes('Trùng lặp tên chỉ tiêu'))).toBe(true);
      expect(check.errors.some((e) => e.includes('chưa có tên'))).toBe(true);
    });

    it('canActivate: kiểm tra thẩm quyền QA/ADMIN và cấu trúc chỉ tiêu trước khi kích hoạt', () => {
      expect(TCCSRules.canActivate(mockTccs, [], 'USER').allowed).toBe(false);
      expect(TCCSRules.canActivate(mockTccs, [], 'QA').allowed).toBe(true);

      const emptyCriteriaTccs: TCCS = {
        ...mockTccs,
        mainQualityCriteria: [],
        safetyCriteria: [],
      };
      expect(TCCSRules.canActivate(emptyCriteriaTccs, [], 'QA').allowed).toBe(false);
    });

    it('canDelete: bảo vệ TCCS đang được liên kết với các Lô sản xuất', () => {
      expect(TCCSRules.canDelete(mockTccs, [mockBatch], 'QA').allowed).toBe(false);
      expect(TCCSRules.canDelete(mockTccs, [mockBatch], 'QA').blockers[0]).toContain(
        'đang được liên kết với 1 Lô'
      );
      expect(TCCSRules.canDelete(mockTccs, [], 'USER').allowed).toBe(false);
      expect(TCCSRules.canDelete(mockTccs, [], 'QA').allowed).toBe(true);
    });
  });
});
