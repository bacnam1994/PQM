import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TESTING_LABORATORIES,
  matchLaboratory,
  normalizeLabQuery,
  resolveCanonicalLab,
  detectUnmappedTestResults,
} from './laboratoryService';
import { TestingLaboratory } from '../types/laboratory';

describe('laboratoryService - Master Data & Matching Engine', () => {
  it('DEFAULT_TESTING_LABORATORIES contains primary Vietnamese analytical centers', () => {
    expect(DEFAULT_TESTING_LABORATORIES.length).toBeGreaterThanOrEqual(5);

    const codes = DEFAULT_TESTING_LABORATORIES.map((l) => l.code);
    expect(codes).toContain('QUATEST3');
    expect(codes).toContain('CASE');
    expect(codes).toContain('NIFC');
    expect(codes).toContain('EUROFINS');
    expect(codes).toContain('INTERNAL');
  });

  describe('normalizeLabQuery', () => {
    it('normalizes symbols and excess spaces while preserving accents', () => {
      expect(normalizeLabQuery('  Trung tâm Kỹ thuật 3 (QUATEST 3)  ')).toBe(
        'trung tâm kỹ thuật 3 quatest 3'
      );
      expect(normalizeLabQuery('CASE - TP.HCM')).toBe('case - tp.hcm');
    });
  });

  describe('matchLaboratory', () => {
    it('matches exact canonical name and code', () => {
      const match1 = matchLaboratory('Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3');
      expect(match1).not.toBeNull();
      expect(match1?.lab.id).toBe('lab_quatest3');
      expect(match1?.confidence).toBe('EXACT');

      const match2 = matchLaboratory('QUATEST3');
      expect(match2).not.toBeNull();
      expect(match2?.lab.id).toBe('lab_quatest3');
      expect(match2?.confidence).toBe('EXACT');
    });

    it('matches common aliases for Quatest 3', () => {
      const aliases = ['Quatest 3', 'KT3', 'Trung tâm KT 3', 'Trung tâm Kỹ thuật 3'];
      aliases.forEach((alias) => {
        const match = matchLaboratory(alias);
        expect(match).not.toBeNull();
        expect(match?.lab.id).toBe('lab_quatest3');
      });
    });

    it('matches CASE aliases', () => {
      const match = matchLaboratory('Trung tâm Dịch vụ Phân tích Thí nghiệm');
      expect(match).not.toBeNull();
      expect(match?.lab.id).toBe('lab_case');
    });

    it('matches NIFC aliases', () => {
      const match = matchLaboratory('Viện Kiểm nghiệm An toàn Vệ sinh Thực phẩm');
      expect(match).not.toBeNull();
      expect(match?.lab.id).toBe('lab_nifc');
    });

    it('matches Eurofins variations', () => {
      const match1 = matchLaboratory('Eurofins Vietnam');
      expect(match1).not.toBeNull();
      expect(match1?.lab.id).toBe('lab_eurofins');

      const match2 = matchLaboratory('Sắc Ký Hải Đăng');
      expect(match2).not.toBeNull();
      expect(match2?.lab.id).toBe('lab_eurofins');
    });

    it('matches internal lab aliases', () => {
      const match = matchLaboratory('Phòng QC');
      expect(match).not.toBeNull();
      expect(match?.lab.id).toBe('lab_internal');
      expect(match?.lab.type).toBe('INTERNAL');
    });

    it('matches fuzzy strings with high similarity', () => {
      // Minor typo / spelling difference
      const match = matchLaboratory('Trung tam KT3 Ho Chi Minh');
      expect(match).not.toBeNull();
      expect(match?.lab.id).toBe('lab_quatest3');
    });

    it('returns null for completely unrelated or generic strings', () => {
      expect(matchLaboratory('')).toBeNull();
      expect(matchLaboratory('   ')).toBeNull();
      expect(matchLaboratory('Phòng xét nghiệm tư nhân Hoàng Gia')).toBeNull();
    });
  });

  describe('resolveCanonicalLab', () => {
    it('resolves directly by labId', () => {
      const res = resolveCanonicalLab('lab_quatest3');
      expect(res.labId).toBe('lab_quatest3');
      expect(res.labName).toBe('Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3');
      expect(res.lab).toBeDefined();
    });

    it('resolves alias to canonical name and labId', () => {
      const res = resolveCanonicalLab('Quatest 3');
      expect(res.labId).toBe('lab_quatest3');
      expect(res.labName).toBe('Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3');
    });

    it('falls back to raw text for unmapped laboratories', () => {
      const res = resolveCanonicalLab('Phòng Thí nghiệm Lạ 123');
      expect(res.labId).toBe('');
      expect(res.labName).toBe('Phòng Thí nghiệm Lạ 123');
      expect(res.lab).toBeUndefined();
    });
  });

  describe('detectUnmappedTestResults', () => {
    it('detects test results without labId and matches against known laboratories', () => {
      const mockTestResults = [
        {
          id: 'tr-01',
          batchId: 'b-01',
          labName: 'Quatest 3',
          testDate: '2026-03-01',
          overallStatus: 'PASS' as const,
        },
        {
          id: 'tr-02',
          batchId: 'b-02',
          labId: 'lab_case',
          labName: 'Trung tâm Dịch vụ Phân tích Thí nghiệm TP.HCM',
          testDate: '2026-03-02',
          overallStatus: 'PASS' as const,
        },
        {
          id: 'tr-03',
          batchId: 'b-03',
          labName: 'Phòng kiểm nghiệm Chưa Biết ABC',
          testDate: '2026-03-03',
          overallStatus: 'FAIL' as const,
        },
      ];

      const mockBatches = [
        { id: 'b-01', batchNo: 'L26001', product: { name: 'Ginkgo Biloba 120mg' } },
        { id: 'b-02', batchNo: 'L26002', product: { name: 'Vitamin C 500mg' } },
        { id: 'b-03', batchNo: 'L26003', product: { name: 'Canxi Nano' } },
      ];

      const unmapped = detectUnmappedTestResults(
        mockTestResults,
        DEFAULT_TESTING_LABORATORIES,
        mockBatches
      );

      // tr-02 already has lab_case which exists in DEFAULT_TESTING_LABORATORIES, so it should NOT be unmapped
      expect(unmapped.length).toBe(2);

      const item1 = unmapped.find((u) => u.testResultId === 'tr-01');
      expect(item1).toBeDefined();
      expect(item1?.batchNo).toBe('L26001');
      expect(item1?.matchedLab?.id).toBe('lab_quatest3');
      expect(item1?.similarity).toBeGreaterThan(0.8);

      const item3 = unmapped.find((u) => u.testResultId === 'tr-03');
      expect(item3).toBeDefined();
      expect(item3?.batchNo).toBe('L26003');
      expect(item3?.matchedLab).toBeUndefined();
      expect(item3?.confidence).toBe('NONE');
    });
  });
});
