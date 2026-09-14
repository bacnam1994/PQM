import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TESTING_LABORATORIES,
  matchLaboratory,
  normalizeLabQuery,
  resolveCanonicalLab,
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
});
