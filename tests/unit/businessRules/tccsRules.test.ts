/**
 * tests/unit/businessRules/tccsRules.test.ts
 * ============================================
 * Bộ kiểm thử toàn diện cho TCCSRules (BR-TCS) tuân thủ 100% Business Rule Catalog:
 * - BR-TCS-001: Lấy TCCS hiệu lực duy nhất (getActiveTCCS)
 * - BR-TCS-002: Kiểm tra phiên bản hiệu lực (validateActiveStatus: NO_ACTIVE_TCCS, MULTIPLE_ACTIVE_TCCS)
 * - BR-TCS-003: Tính hợp lệ cấu trúc chỉ tiêu (validateCriteriaDefinitions: rỗng, trùng tên, min > max)
 * - BR-TCS-004: Điều kiện kích hoạt TCCS (canActivate)
 * - BR-TCS-005: Điều kiện xóa TCCS (canDelete)
 */

import { describe, it, expect } from 'vitest';
import { TCCSRules } from '../../../src/domain/rules/TCCSRules';
import { TCCS, Batch, CriterionType } from '../../../src/types';

describe('BR-TCS: TCCSRules Business Logic Suite', () => {
  const createTccs = (overrides?: Partial<TCCS>): TCCS =>
    ({
      id: 'tccs-001',
      productId: 'prod-001',
      code: 'TCCS-001',
      productName: 'Paracetamol 500mg',
      isActive: true,
      mainQualityCriteria: [
        { name: 'Định lượng', unit: '%', min: 95, max: 105, type: CriterionType.NUMBER },
        { name: 'Cảm quan', unit: '', expectedText: 'Đạt', type: CriterionType.TEXT },
      ],
      safetyCriteria: [],
      ...overrides,
    }) as TCCS;

  describe('BR-TCS-001 & BR-TCS-002: getActiveTCCS & validateActiveStatus', () => {
    it('Lấy đúng TCCS duy nhất đang hiệu lực', () => {
      const tccs1 = createTccs({ id: 'tccs-1', isActive: false });
      const tccs2 = createTccs({ id: 'tccs-2', isActive: true });
      const active = TCCSRules.getActiveTCCS('prod-001', [tccs1, tccs2]);
      expect(active?.id).toBe('tccs-2');
    });

    it('Báo lỗi NO_ACTIVE_TCCS nếu sản phẩm có TCCS nhưng không có cái nào active', () => {
      const tccs1 = createTccs({ id: 'tccs-1', isActive: false });
      const res = TCCSRules.validateActiveStatus('prod-001', [tccs1]);
      expect(res.isValid).toBe(false);
      expect(res.issue).toBe('NO_ACTIVE_TCCS');
      expect(res.description).toContain('không có tiêu chuẩn nào được đánh dấu hiệu lực');
    });

    it('Báo lỗi MULTIPLE_ACTIVE_TCCS nếu sản phẩm có hơn 1 TCCS active cùng lúc', () => {
      const tccs1 = createTccs({ id: 'tccs-1', isActive: true });
      const tccs2 = createTccs({ id: 'tccs-2', isActive: true });
      const res = TCCSRules.validateActiveStatus('prod-001', [tccs1, tccs2]);
      expect(res.isValid).toBe(false);
      expect(res.issue).toBe('MULTIPLE_ACTIVE_TCCS');
      expect(res.description).toContain('cùng được đánh dấu hiệu lực');
    });

    it('Hợp lệ khi có đúng 1 TCCS active', () => {
      const tccs1 = createTccs({ id: 'tccs-1', isActive: false });
      const tccs2 = createTccs({ id: 'tccs-2', isActive: true });
      const res = TCCSRules.validateActiveStatus('prod-001', [tccs1, tccs2]);
      expect(res.isValid).toBe(true);
      expect(res.activeCount).toBe(1);
    });
  });

  describe('BR-TCS-003: validateCriteriaDefinitions', () => {
    it('Báo lỗi khi TCCS không có bất kỳ chỉ tiêu kỹ thuật nào', () => {
      const emptyTccs = createTccs({ mainQualityCriteria: [], safetyCriteria: [] });
      const res = TCCSRules.validateCriteriaDefinitions(emptyTccs);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('phải có ít nhất một chỉ tiêu kỹ thuật');
    });

    it('Báo lỗi khi tên chỉ tiêu bị rỗng', () => {
      const tccs = createTccs({
        mainQualityCriteria: [{ name: '  ', unit: '', type: CriterionType.TEXT }],
      });
      const res = TCCSRules.validateCriteriaDefinitions(tccs);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('Tồn tại chỉ tiêu chưa có tên');
    });

    it('Báo lỗi khi trùng lặp tên chỉ tiêu trong cùng TCCS', () => {
      const tccs = createTccs({
        mainQualityCriteria: [
          { name: 'Định lượng', unit: '%', min: 95, max: 105, type: CriterionType.NUMBER },
          { name: 'định lượng', unit: 'mg', min: 450, max: 550, type: CriterionType.NUMBER },
        ],
      });
      const res = TCCSRules.validateCriteriaDefinitions(tccs);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('Trùng lặp tên chỉ tiêu'))).toBe(true);
    });

    it('Báo lỗi khi min > max đối với chỉ tiêu số', () => {
      const tccs = createTccs({
        mainQualityCriteria: [
          { name: 'Độ ẩm', unit: '%', min: 10, max: 5, type: CriterionType.NUMBER },
        ],
      });
      const res = TCCSRules.validateCriteriaDefinitions(tccs);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('lớn hơn cận trên'))).toBe(true);
    });

    it('Hợp lệ khi cấu trúc chỉ tiêu chuẩn', () => {
      const tccs = createTccs();
      const res = TCCSRules.validateCriteriaDefinitions(tccs);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });
  });

  describe('BR-TCS-004: canActivate', () => {
    it('Cho phép QA hoặc ADMIN kích hoạt TCCS hợp lệ', () => {
      const tccs = createTccs();
      const res = TCCSRules.canActivate(tccs, [], 'QA');
      expect(res.allowed).toBe(true);
    });

    it('Chặn kích hoạt nếu vai trò không phải QA hoặc ADMIN', () => {
      const tccs = createTccs();
      const res = TCCSRules.canActivate(tccs, [], 'QC');
      expect(res.allowed).toBe(false);
      expect(res.blockers[0]).toContain('không có thẩm quyền kích hoạt');
    });

    it('Chặn kích hoạt nếu cấu trúc chỉ tiêu không hợp lệ', () => {
      const invalidTccs = createTccs({ mainQualityCriteria: [] });
      const res = TCCSRules.canActivate(invalidTccs, [], 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers.length).toBeGreaterThan(0);
    });
  });

  describe('BR-TCS-005: canDelete', () => {
    it('Chặn xóa nếu người dùng không phải QA hoặc ADMIN', () => {
      const tccs = createTccs();
      const res = TCCSRules.canDelete(tccs, [], 'QC');
      expect(res.allowed).toBe(false);
      expect(res.blockers[0]).toContain('Chỉ Quản trị viên (ADMIN) hoặc Đảm bảo chất lượng (QA)');
    });

    it('Chặn xóa TCCS nếu đang có Lô sản xuất liên kết (ALCOA+ Traceability)', () => {
      const tccs = createTccs();
      const linkedBatches: Batch[] = [{ id: 'b-1', tccsId: tccs.id } as Batch];
      const res = TCCSRules.canDelete(tccs, linkedBatches, 'QA');
      expect(res.allowed).toBe(false);
      expect(res.blockers.some((b) => b.includes('đang được liên kết'))).toBe(true);
    });

    it('Cho phép QA/ADMIN xóa TCCS khi không có Lô liên kết', () => {
      const tccs = createTccs();
      const res = TCCSRules.canDelete(tccs, [], 'QA');
      expect(res.allowed).toBe(true);
      expect(res.blockers).toHaveLength(0);
    });
  });
});
