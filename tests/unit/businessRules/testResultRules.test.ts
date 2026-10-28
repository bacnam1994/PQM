/**
 * tests/unit/businessRules/testResultRules.test.ts
 * ==================================================
 * Bộ kiểm thử toàn diện cho TestResultRules (BR-TST) tuân thủ 100% Business Rule Catalog:
 * - BR-TST-001: Đánh giá kết quả phiếu kiểm nghiệm (evaluate)
 * - BR-TST-002: Điều kiện phê duyệt phiếu kiểm nghiệm (canApprove)
 * - BR-TST-003: Điều kiện chỉnh sửa phiếu (canEdit)
 * - BR-TST-004: Điều kiện xóa phiếu (canDelete)
 * - BR-TST-005: Điều kiện gửi duyệt phiếu (canSubmit)
 * - BR-TST-006: Điều kiện ghi đè trạng thái (canOverrideStatus & BR-QEV-001 No Implicit Pass)
 */

import { describe, it, expect } from 'vitest';
import { TestResultRules } from '../../../src/domain/rules/TestResultRules';
import { TestResult, Batch, TestResultEntry } from '../../../src/types';

describe('BR-TST: TestResultRules Business Logic Suite', () => {
  const createTestResult = (overrides?: Partial<TestResult>): TestResult =>
    ({
      id: 'tr-001',
      batchId: 'batch-001',
      productId: 'prod-001',
      tccsId: 'tccs-001',
      overallStatus: 'PASS',
      results: [
        { criteriaName: 'Định lượng', value: '100', isPass: true, status: 'PASS' },
        { criteriaName: 'Cảm quan', value: 'Đạt', isPass: true, status: 'PASS' },
      ],
      ...overrides,
    }) as TestResult;

  const createBatch = (status: any = 'TESTING'): Batch =>
    ({
      id: 'batch-001',
      batchNumber: 'LOT-2026-001',
      productId: 'prod-001',
      productName: 'Paracetamol',
      tccsId: 'tccs-001',
      status,
      createdAt: new Date().toISOString(),
      manufacturingDate: '2026-01-01',
      expiryDate: '2028-01-01',
    }) as Batch;

  describe('BR-TST-001: evaluate', () => {
    it('Đánh giá chính xác số lượng chỉ tiêu PASS, FAIL, PENDING', () => {
      const tr = createTestResult({
        results: [
          { criteriaName: 'C1', value: '100', isPass: true, status: 'PASS' },
          { criteriaName: 'C2', value: '80', isPass: false, status: 'FAIL' },
          { criteriaName: 'C3', value: '', isPass: null as any, status: 'PENDING' },
        ],
      });

      const evaluation = TestResultRules.evaluate(tr);
      expect(evaluation.totalCriteria).toBe(3);
      expect(evaluation.passedCriteria).toBe(1);
      expect(evaluation.failedCriteria).toBe(1);
      expect(evaluation.pendingCriteria).toBe(1);
      expect(evaluation.status).toBe('FAIL'); // Canonical: có FAIL thì là FAIL
    });
  });

  describe('BR-TST-002: canApprove', () => {
    it('Cho phép phê duyệt khi kết quả đầy đủ và người duyệt là QA/QC/ADMIN', () => {
      const tr = createTestResult();
      const res = TestResultRules.canApprove(tr, 'QA');
      expect(res.allowed).toBe(true);
      expect(res.blockers).toHaveLength(0);
    });

    it('Chặn duyệt nếu người thực hiện không có thẩm quyền (ví dụ LAB)', () => {
      const tr = createTestResult();
      const res = TestResultRules.canApprove(tr, 'LAB');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('không có thẩm quyền');
    });

    it('Chặn duyệt phiếu rỗng không có chỉ tiêu', () => {
      const tr = createTestResult({ results: [] });
      const res = TestResultRules.canApprove(tr, 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.some((b) => b.includes('chưa có dữ liệu'))).toBe(true);
    });

    it('Chặn duyệt phiếu khi còn chỉ tiêu PENDING', () => {
      const tr = createTestResult({
        results: [
          { criteriaName: 'C1', value: '100', isPass: true, status: 'PASS' },
          { criteriaName: 'C2', value: '', isPass: null as any, status: 'PENDING' },
        ],
      });
      const res = TestResultRules.canApprove(tr, 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.some((b) => b.includes('chưa hoàn tất'))).toBe(true);
    });

    it('Chặn duyệt ĐẠT (PASS) khi có chỉ tiêu FAIL', () => {
      const tr = createTestResult({
        overallStatus: 'PASS',
        results: [{ criteriaName: 'C1', value: '80', isPass: false, status: 'FAIL' }],
      });
      const res = TestResultRules.canApprove(tr, 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.some((b) => b.includes('chỉ tiêu không đạt'))).toBe(true);
    });
  });

  describe('BR-TST-003: canEdit', () => {
    it('Cho phép chỉnh sửa bình thường khi phiếu chưa niêm phong và lô đang kiểm nghiệm', () => {
      const tr = createTestResult();
      const batch = createBatch('TESTING');
      const res = TestResultRules.canEdit(tr, batch, 'QC');
      expect(res.allowed).toBe(true);
    });

    it('Chặn sửa nếu Lô liên kết đã RELEASED (chỉ ADMIN mới được sửa)', () => {
      const tr = createTestResult();
      const batch = createBatch('RELEASED');

      const qcRes = TestResultRules.canEdit(tr, batch, 'QC');
      expect(qcRes.allowed).toBe(false);
      expect(qcRes.blockers?.[0]).toContain('Lô sản xuất đã Xuất xưởng');

      const adminRes = TestResultRules.canEdit(tr, batch, 'ADMIN');
      expect(adminRes.allowed).toBe(true);
    });

    it('Chặn sửa nếu phiếu đã niêm phong evaluationSnapshot (chỉ QA/ADMIN được sửa)', () => {
      const tr = createTestResult({
        evaluationSnapshot: {
          snapshotId: 'snap-1',
          alcoaIntegrityHash: 'hash',
        } as any,
      });
      const batch = createBatch('TESTING');

      const labRes = TestResultRules.canEdit(tr, batch, 'LAB');
      expect(labRes.allowed).toBe(false);
      expect(labRes.blockers?.[0]).toContain('niêm phong dữ liệu');

      const qaRes = TestResultRules.canEdit(tr, batch, 'QA');
      expect(qaRes.allowed).toBe(true);
    });
  });

  describe('BR-TST-004: canDelete', () => {
    it('Chỉ ADMIN hoặc QA mới có quyền xóa phiếu kiểm nghiệm', () => {
      const tr = createTestResult();
      const batch = createBatch('TESTING');

      const qcRes = TestResultRules.canDelete(tr, batch, 'QC');
      expect(qcRes.allowed).toBe(false);
      expect(qcRes.blockers?.[0]).toContain(
        'Chỉ Quản trị viên (ADMIN) hoặc Đảm bảo chất lượng (QA)'
      );

      const qaRes = TestResultRules.canDelete(tr, batch, 'QA');
      expect(qaRes.allowed).toBe(true);

      const adminRes = TestResultRules.canDelete(tr, batch, 'ADMIN');
      expect(adminRes.allowed).toBe(true);
    });

    it('Tuyệt đối cấm xóa phiếu của Lô đã RELEASED', () => {
      const tr = createTestResult();
      const batch = createBatch('RELEASED');

      const adminRes = TestResultRules.canDelete(tr, batch, 'ADMIN');
      expect(adminRes.allowed).toBe(false);
      expect(adminRes.blockers?.[0]).toContain(
        'Không thể xóa phiếu kiểm nghiệm của Lô đã Xuất xưởng'
      );
    });
  });

  describe('BR-TST-005: canSubmit', () => {
    it('Cho phép gửi duyệt khi vai trò hợp lệ và có dữ liệu chỉ tiêu', () => {
      const tr = createTestResult();
      const res = TestResultRules.canSubmit(tr, 'LAB');
      expect(res.allowed).toBe(true);
    });

    it('Chặn gửi duyệt khi phiếu không có kết quả chỉ tiêu', () => {
      const tr = createTestResult({ results: [] });
      const res = TestResultRules.canSubmit(tr, 'LAB');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('chưa có kết quả chỉ tiêu');
    });

    it('Chặn gửi duyệt với vai trò không được phép', () => {
      const tr = createTestResult();
      const res = TestResultRules.canSubmit(tr, 'GUEST' as any);
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('không có quyền gửi duyệt');
    });
  });

  describe('BR-TST-006: canOverrideStatus & BR-QEV-001 No Implicit Pass', () => {
    it('QA hoặc ADMIN có thể ghi đè trạng thái hợp lệ khi có lý do chính đáng', () => {
      const tr = createTestResult();
      const res = TestResultRules.canOverrideStatus(
        tr,
        'RETEST',
        'Yêu cầu kiểm nghiệm lại do nghi ngờ sai số thiết bị',
        'QA'
      );
      expect(res.allowed).toBe(true);
    });

    it('Chặn ghi đè trạng thái nếu thiếu lý do', () => {
      const tr = createTestResult();
      const res = TestResultRules.canOverrideStatus(tr, 'RETEST', '', 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('Bắt buộc phải ghi rõ lý do');
    });

    it('Chặn vai trò không phải QA hoặc ADMIN ghi đè trạng thái', () => {
      const tr = createTestResult();
      const res = TestResultRules.canOverrideStatus(tr, 'RETEST', 'Lý do', 'QC');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('Chỉ QA hoặc ADMIN');
    });

    it('TUYỆT ĐỐI CẤM GHI ĐÈ THÀNH PASS NẾU CÒN CHỈ TIÊU FAIL (BR-QEV-001 No Implicit Pass)', () => {
      const tr = createTestResult({
        results: [
          {
            criteriaName: 'Độ rã',
            value: '45 phút (vượt quy định)',
            isPass: false,
            status: 'FAIL',
          },
        ],
      });
      const res = TestResultRules.canOverrideStatus(
        tr,
        'PASS',
        'Muốn cho qua để kịp tiến độ xuất xưởng',
        'QA'
      );
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('Không thể ghi đè trạng thái thành PASS khi phiếu còn');
    });
  });
});
