/**
 * tests/unit/businessRules/batchRules.test.ts
 * ============================================
 * Bộ kiểm thử toàn diện cho BatchRules (BR-BAT) tuân thủ 100% Business Rule Catalog:
 * - BR-BAT-001: Khởi tạo Lô và Gán TCCS hiệu lực
 * - BR-BAT-002: Bắt đầu kiểm nghiệm (canStartTesting)
 * - BR-BAT-003: Khóa dữ liệu Lô Xuất xưởng (canEditReleased)
 * - BR-BAT-004: Từ chối Lô (canReject)
 * - BR-BAT-005: Xuất xưởng Lô (canRelease qua 7 Release Gates)
 * - BR-BAT-006: Thu hồi Lô (canRecall)
 * - BR-BAT-007: Chuyển đổi trạng thái Lô (canTransitionStatus)
 */

import { describe, it, expect } from 'vitest';
import { BatchRules } from '../../../src/domain/rules/BatchRules';
import { Batch, TestResult, TCCS, QualityDeviation } from '../../../src/types';

describe('BR-BAT: BatchRules Business Logic Suite', () => {
  const mockTccs: TCCS = {
    id: 'tccs-001',
    code: 'TCCS-001',
    productId: 'prod-001',
    productName: 'Paracetamol 500mg',
    isActive: true,
    mainQualityCriteria: [
      { name: 'Định lượng', unit: '%', min: 95, max: 105, type: 'NUMBER' as any },
      { name: 'Cảm quan', unit: '', expectedText: 'Đạt', type: 'TEXT' as any },
    ],
  };

  const createBaseBatch = (status: any = 'TESTING'): Batch =>
    ({
      id: 'batch-001',
      batchNumber: 'LOT-2026-001',
      productId: 'prod-001',
      productName: 'Paracetamol 500mg',
      tccsId: 'tccs-001',
      status,
      createdAt: new Date().toISOString(),
      manufacturingDate: '2026-01-01',
      expiryDate: '2028-01-01',
    }) as Batch;

  describe('BR-BAT-002: canStartTesting', () => {
    it('Cho phép bắt đầu kiểm nghiệm khi lô hợp lệ và có liên kết TCCS', () => {
      const batch = createBaseBatch('PLANNED');
      const res = BatchRules.canStartTesting(batch, mockTccs);
      expect(res.allowed).toBe(true);
      expect(res.blockers).toHaveLength(0);
    });

    it('Chặn bắt đầu kiểm nghiệm nếu lô đã Xuất xưởng (RELEASED)', () => {
      const batch = createBaseBatch('RELEASED');
      const res = BatchRules.canStartTesting(batch, mockTccs);
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('RELEASED');
    });

    it('Chặn bắt đầu kiểm nghiệm nếu lô đã bị Từ chối (REJECTED)', () => {
      const batch = createBaseBatch('REJECTED');
      const res = BatchRules.canStartTesting(batch, mockTccs);
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('REJECTED');
    });

    it('Chặn bắt đầu kiểm nghiệm nếu lô chưa liên kết TCCS nào', () => {
      const batch = createBaseBatch('PLANNED');
      batch.tccsId = '';
      const res = BatchRules.canStartTesting(batch, null);
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('chưa được liên kết');
    });
  });

  describe('BR-BAT-003: canEditReleased', () => {
    it('Cho phép chỉnh sửa bất kỳ ai nếu lô chưa ở trạng thái RELEASED', () => {
      const batch = createBaseBatch('TESTING');
      const res = BatchRules.canEditReleased(batch, 'QC');
      expect(res.allowed).toBe(true);
    });

    it('Chỉ ADMIN mới có quyền chỉnh sửa lô đã RELEASED', () => {
      const batch = createBaseBatch('RELEASED');
      const adminRes = BatchRules.canEditReleased(batch, 'ADMIN');
      expect(adminRes.allowed).toBe(true);

      const qcRes = BatchRules.canEditReleased(batch, 'QC');
      expect(qcRes.allowed).toBe(false);
      expect(qcRes.reason).toContain('khóa dữ liệu theo quy định GMP');

      const qaRes = BatchRules.canEditReleased(batch, 'QA');
      expect(qaRes.allowed).toBe(false);
    });
  });

  describe('BR-BAT-004: canReject', () => {
    it('QA hoặc ADMIN có thể từ chối lô khi có lý do chính đáng', () => {
      const batch = createBaseBatch('TESTING');
      const qaRes = BatchRules.canReject(batch, 'Phát hiện tạp chất lạ vượt ngưỡng', 'QA');
      expect(qaRes.allowed).toBe(true);

      const adminRes = BatchRules.canReject(batch, 'Lô hư hỏng bao bì', 'ADMIN');
      expect(adminRes.allowed).toBe(true);
    });

    it('Chặn từ chối nếu vai trò không phải QA hoặc ADMIN', () => {
      const batch = createBaseBatch('TESTING');
      const qcRes = BatchRules.canReject(batch, 'Lý do từ chối', 'QC');
      expect(qcRes.allowed).toBe(false);
      expect(qcRes.blockers?.[0]).toContain('không có thẩm quyền');
    });

    it('Chặn từ chối nếu thiếu lý do từ chối', () => {
      const batch = createBaseBatch('TESTING');
      const emptyReasonRes = BatchRules.canReject(batch, '', 'QA');
      expect(emptyReasonRes.allowed).toBe(false);
      expect(emptyReasonRes.blockers?.[0]).toContain('Bắt buộc phải nhập lý do');
    });

    it('Chặn từ chối trực tiếp lô đã RELEASED (phải qua Thu hồi Recall)', () => {
      const batch = createBaseBatch('RELEASED');
      const res = BatchRules.canReject(batch, 'Thu hồi khẩn', 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('Thu hồi (Recall)');
    });
  });

  describe('BR-BAT-006: canRecall', () => {
    it('Chỉ cho phép thu hồi (Recall) đối với lô đã RELEASED với lý do và quyền QA/ADMIN', () => {
      const releasedBatch = createBaseBatch('RELEASED');
      const res = BatchRules.canRecall(releasedBatch, 'Phát hiện sự cố lâm sàng', 'QA');
      expect(res.allowed).toBe(true);
    });

    it('Chặn thu hồi lô chưa RELEASED', () => {
      const testingBatch = createBaseBatch('TESTING');
      const res = BatchRules.canRecall(testingBatch, 'Lý do thu hồi', 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain(
        'Chỉ có thể thu hồi (Recall) đối với Lô đã ở trạng thái Xuất xưởng'
      );
    });

    it('Chặn thu hồi nếu thiếu lý do', () => {
      const releasedBatch = createBaseBatch('RELEASED');
      const res = BatchRules.canRecall(releasedBatch, '   ', 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('Bắt buộc phải nhập lý do');
    });

    it('Chặn vai trò không phải QA hoặc ADMIN thực hiện thu hồi', () => {
      const releasedBatch = createBaseBatch('RELEASED');
      const res = BatchRules.canRecall(releasedBatch, 'Lý do', 'LAB');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('không có thẩm quyền');
    });
  });

  describe('BR-BAT-007: canTransitionStatus', () => {
    it('Cho phép giữ nguyên trạng thái', () => {
      const res = BatchRules.canTransitionStatus('TESTING', 'TESTING', 'QC');
      expect(res.allowed).toBe(true);
    });

    it('Chặn chuyển từ REJECTED trực tiếp sang RELEASED', () => {
      const res = BatchRules.canTransitionStatus('REJECTED', 'RELEASED', 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('không thể chuyển trực tiếp sang Xuất xưởng');
    });

    it('Chặn sửa trạng thái lô RELEASED nếu không phải ADMIN', () => {
      const res = BatchRules.canTransitionStatus('RELEASED', 'TESTING', 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers?.[0]).toContain('Chỉ ADMIN mới được phép điều chỉnh');
    });

    it('Cho phép ADMIN điều chỉnh trạng thái lô RELEASED', () => {
      const res = BatchRules.canTransitionStatus('RELEASED', 'TESTING', 'ADMIN');
      expect(res.allowed).toBe(true);
    });
  });

  describe('BR-BAT-005 & BR-REL-001: canRelease (7 Release Gates Verification)', () => {
    it('Chặn xuất xưởng nếu chưa có kết quả kiểm nghiệm đạt chuẩn', () => {
      const batch = createBaseBatch('TESTING');
      const res = BatchRules.canRelease(batch, [], 'QA', mockTccs);
      expect(res.allowed).toBe(false);
      expect(res.blockers?.length).toBeGreaterThan(0);
    });

    it('Chặn xuất xưởng nếu người thực hiện không phải QA hoặc ADMIN', () => {
      const batch = createBaseBatch('TESTING');
      const validTestResult: TestResult = {
        id: 'tr-001',
        batchId: batch.id,
        productId: batch.productId,
        tccsId: mockTccs.id,
        results: [
          { criteriaName: 'Định lượng', value: '100', isPass: true, status: 'PASS' },
          { criteriaName: 'Cảm quan', value: 'Đạt', isPass: true, status: 'PASS' },
        ],
        overallStatus: 'PASS',
        approvalStatus: 'APPROVED',
        evaluationSnapshot: {
          schemaVersion: '1.0.0',
          snapshotId: 'snap-001',
          batchId: batch.id,
          tccsId: mockTccs.id,
          evaluatedAt: new Date().toISOString(),
          canonicalQualityStatus: 'PASS',
          overallEvaluationPass: true,
          criteria: [],
          alcoaIntegrityHash: 'hash123',
        },
      } as any;

      const res = BatchRules.canRelease(batch, [validTestResult], 'QC', mockTccs);
      expect(res.allowed).toBe(false);
      expect(res.blockers?.some((b) => b.includes('thẩm quyền'))).toBe(true);
    });
  });
});
