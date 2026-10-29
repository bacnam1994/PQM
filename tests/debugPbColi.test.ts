import { describe, it, expect } from 'vitest';
import {
  isCriteriaMatch,
  lookupPharmaTerm,
  normalizeString,
  tokenizeWords,
  containsPhraseTokens,
  getCriterionCategory,
} from '../src/utils/aiMapping';
import { mapOcrResultsToTccs } from '../src/services/ocr/tccsMappingService';

describe('Fix Pb vs E. coli and Criteria Matching', () => {
  it('correctly tokenizes words without substring pollution', () => {
    expect(tokenizeWords('Escherichia coli (E. coli)')).toEqual([
      'escherichia',
      'coli',
      'e',
      'coli',
    ]);
    expect(tokenizeWords('Chì (Pb)')).toEqual(['chi', 'pb']);
    expect(tokenizeWords('Đồng (Cu)')).toEqual(['dong', 'cu']);
    expect(tokenizeWords('Độ đồng đều khối lượng')).toEqual(['do', 'dong', 'deu', 'khoi', 'luong']);
  });

  it('correctly detects phrase tokens in sentence', () => {
    expect(containsPhraseTokens('Hàm lượng Chì (Pb)', 'Chì')).toBe(true);
    expect(containsPhraseTokens('Escherichia coli (E. coli)', 'Chì')).toBe(false);
    expect(containsPhraseTokens('Escherichia coli (E. coli)', 'Pb')).toBe(false);
    expect(containsPhraseTokens('Escherichia coli (E. coli)', 'E. coli')).toBe(true);
  });

  it('categorizes criteria accurately into mutually exclusive classes', () => {
    expect(getCriterionCategory('Pb')).toBe('HEAVY_METAL');
    expect(getCriterionCategory('Chì')).toBe('HEAVY_METAL');
    expect(getCriterionCategory('Chì (Pb)')).toBe('HEAVY_METAL');
    expect(getCriterionCategory('Lead (Pb)')).toBe('HEAVY_METAL');
    expect(getCriterionCategory('Escherichia coli (E. coli)')).toBe('MICROBIAL');
    expect(getCriterionCategory('E. coli')).toBe('MICROBIAL');
    expect(getCriterionCategory('Tổng số vi sinh vật hiếu khí')).toBe('MICROBIAL');
    expect(getCriterionCategory('Cảm quan')).toBe('PHYSICAL');
    expect(getCriterionCategory('Độ ẩm')).toBe('PHYSICAL');
  });

  it('NEVER matches Heavy Metals with Microbial or Physical criteria', () => {
    // Pb / Chì / Lead vs E. coli
    expect(isCriteriaMatch('Pb', 'Escherichia coli (E. coli)')).toBe(false);
    expect(isCriteriaMatch('Chì', 'Escherichia coli (E. coli)')).toBe(false);
    expect(isCriteriaMatch('Lead', 'Escherichia coli (E. coli)')).toBe(false);
    expect(isCriteriaMatch('Escherichia coli (E. coli)', 'Pb')).toBe(false);
    expect(isCriteriaMatch('Escherichia coli (E. coli)', 'Chì')).toBe(false);

    // Asen / As vs Salmonella
    expect(isCriteriaMatch('As', 'Salmonella')).toBe(false);
    expect(isCriteriaMatch('Asen', 'Salmonella')).toBe(false);
    expect(isCriteriaMatch('Arsenic', 'Salmonella')).toBe(false);

    // Cadmi vs TAMC
    expect(isCriteriaMatch('Cd', 'Tổng số vi sinh vật hiếu khí')).toBe(false);
    expect(isCriteriaMatch('Cadmi', 'Tổng số vi sinh vật hiếu khí')).toBe(false);

    // Chì vs Độ ẩm
    expect(isCriteriaMatch('Chì', 'Độ ẩm')).toBe(false);
  });

  it('correctly matches valid aliases to standard TCCS names', () => {
    // Chì / Pb
    expect(isCriteriaMatch('Pb', 'Chì (Pb)')).toBe(true);
    expect(isCriteriaMatch('Chì', 'Chì (Pb)')).toBe(true);
    expect(isCriteriaMatch('Lead', 'Chì (Pb)')).toBe(true);
    expect(isCriteriaMatch('Hàm lượng Chì (Pb)', 'Chì (Pb)')).toBe(true);

    // E. coli
    expect(isCriteriaMatch('E. coli', 'Escherichia coli (E. coli)')).toBe(true);
    expect(isCriteriaMatch('E.coli', 'Escherichia coli (E. coli)')).toBe(true);
    expect(isCriteriaMatch('Escherichia coli', 'Escherichia coli (E. coli)')).toBe(true);

    // Vi sinh khác
    expect(isCriteriaMatch('TVKHK', 'Tổng số vi khuẩn hiếu khí')).toBe(true);
    expect(isCriteriaMatch('TAMC', 'Tổng số vi sinh vật hiếu khí')).toBe(true);
    expect(isCriteriaMatch('TSNM', 'Tổng số nấm mốc và nấm men')).toBe(true);
    expect(isCriteriaMatch('TYMC', 'Tổng số nấm mốc và nấm men')).toBe(true);
  });

  it('correctly maps in mapOcrResultsToTccs without cross-matching', () => {
    const tccsNames = [
      'Độ ẩm',
      'pH',
      'Escherichia coli (E. coli)',
      'Tổng số vi sinh vật hiếu khí',
      'Chì (Pb)',
      'Cadmi (Cd)',
      'Asen (As)',
    ];

    const report = mapOcrResultsToTccs(
      [
        {
          criteriaName: 'Pb',
          value: '< 0.05',
          unit: 'mg/kg',
          limit: '≤ 0.5 mg/kg',
          confidence: 'high',
          sourcePageNumber: 1,
        },
        {
          criteriaName: 'E. coli',
          value: 'Không phát hiện',
          unit: 'CFU/g',
          limit: 'Không được có',
          confidence: 'high',
          sourcePageNumber: 1,
        },
      ],
      tccsNames
    );

    const pbItem = report.allMapped.find((m) => m.rawCriteriaName === 'Pb');
    expect(pbItem).toBeDefined();
    expect(pbItem?.systemCriteriaName).toBe('Chì (Pb)');
    expect(pbItem?.systemCriteriaName).not.toBe('Escherichia coli (E. coli)');

    const ecoliItem = report.allMapped.find((m) => m.rawCriteriaName === 'E. coli');
    expect(ecoliItem).toBeDefined();
    expect(ecoliItem?.systemCriteriaName).toBe('Escherichia coli (E. coli)');
    expect(ecoliItem?.systemCriteriaName).not.toBe('Chì (Pb)');
  });
});
