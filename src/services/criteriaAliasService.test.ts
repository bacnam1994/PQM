import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  diceScore,
  similarityScore,
  detectCriteriaChanges,
  mergeAliases,
  buildAliasLookupMap,
  resolveCriteriaName,
  FUZZY_THRESHOLD,
  AUTO_CONFIRM_THRESHOLD,
} from './criteriaAliasService';
import { CriteriaAlias, TCCS, CriterionType } from '../types';

describe('criteriaAliasService', () => {
  describe('normalizeName', () => {
    it('chuẩn hóa chữ hoa, khoảng trắng và dấu câu cuối', () => {
      expect(normalizeName('  Độ Ẩm (Moisture) .  ')).toBe('độ ẩm (moisture)');
      expect(normalizeName('Hàm lượng   Curcumin: ')).toBe('hàm lượng curcumin');
      expect(normalizeName('pH - Giá trị')).toBe('ph - giá trị');
    });

    it('trả về chuỗi rỗng khi null hoặc undefined', () => {
      expect(normalizeName('')).toBe('');
      expect(normalizeName(null as any)).toBe('');
    });
  });

  describe('diceScore & similarityScore', () => {
    it('trả về 1.0 cho hai chuỗi giống hệt nhau (khác hoa thường)', () => {
      expect(diceScore('Độ ẩm', 'độ ẩm')).toBe(1.0);
      expect(similarityScore('Độ ẩm', 'ĐỘ ẨM')).toBe(1.0);
    });

    it('tính điểm cao cho các biến thể gần giống', () => {
      const score = similarityScore('Hàm lượng Curcumin', 'Hàm lượng Curcuminoid');
      expect(score).toBeGreaterThan(0.7);
    });

    it('tính điểm thấp cho hai chuỗi hoàn toàn khác nhau', () => {
      const score = similarityScore('Độ ẩm', 'Kim loại nặng Chì (Pb)');
      expect(score).toBeLessThan(0.3);
    });
  });

  describe('detectCriteriaChanges', () => {
    it('phát hiện chỉ tiêu được đổi tên với độ tương đồng cao', () => {
      const oldNames = ['Độ ẩm', 'Hàm lượng Curcumin'];
      const newNames = ['Độ ẩm (LOD)', 'Hàm lượng Curcumin toàn phần'];

      const changes = detectCriteriaChanges(oldNames, newNames);
      expect(changes.length).toBe(2);
      expect(changes.find(c => c.oldName === 'Độ ẩm')?.newName).toBe('Độ ẩm (LOD)');
    });

    it('không tạo thay đổi nếu danh sách chỉ tiêu giữ nguyên', () => {
      const oldNames = ['Độ ẩm', 'Độ đồng đều khối lượng'];
      const newNames = ['Độ ẩm', 'Độ đồng đều khối lượng'];

      const changes = detectCriteriaChanges(oldNames, newNames);
      expect(changes.length).toBe(0);
    });
  });

  describe('mergeAliases', () => {
    it('gộp các alias mới và loại trùng lặp', () => {
      const existing: CriteriaAlias = {
        id: 'ca_1',
        tccsId: 'tccs_1',
        canonicalName: 'Độ ẩm',
        aliases: ['do am', 'moisture'],
        autoDetected: false,
        confirmedByAdmin: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      const merged = mergeAliases(existing, ['moisture', 'Hàm lượng nước', 'DO AM']);
      expect(merged.aliases).toContain('do am');
      expect(merged.aliases).toContain('moisture');
      expect(merged.aliases).toContain('hàm lượng nước');
      expect(merged.aliases.length).toBe(3);
    });
  });

  describe('buildAliasLookupMap & resolveCriteriaName', () => {
    it('tra cứu chính xác tên chuẩn từ alias', () => {
      const aliases: CriteriaAlias[] = [
        {
          id: 'ca_1',
          tccsId: 'tccs_100',
          canonicalName: 'Curcuminoid toàn phần',
          aliases: ['hàm lượng curcumin', 'curcumin'],
          autoDetected: false,
          confirmedByAdmin: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];

      const lookupMap = buildAliasLookupMap(aliases, 'tccs_100');
      expect(lookupMap.get('hàm lượng curcumin')).toBe('Curcuminoid toàn phần');
      expect(lookupMap.get('curcumin')).toBe('Curcuminoid toàn phần');

      const mockTCCS: TCCS = {
        id: 'tccs_100',
        productId: 'p_1',
        code: 'TCCS 01',
        issueDate: '2026-01-01',
        isActive: true,
        mainQualityCriteria: [
          { name: 'Curcuminoid toàn phần', unit: '%', type: CriterionType.NUMBER, min: 95 }
        ],
        safetyCriteria: [],
        createdAt: '2026-01-01'
      };

      const resolved = resolveCriteriaName('Hàm lượng Curcumin', mockTCCS, lookupMap);
      expect(resolved).toBe('Curcuminoid toàn phần');
    });
  });
});
