import { describe, it, expect } from 'vitest';
import { isCriteriaMatch, mapAIExtractedResultsToCriteria } from './aiMapping';
import { Criterion, CriterionType } from '../types';

describe('aiMapping - Elemental vs Salt form matching', () => {
  it('tự động khớp nguyên tố từ phiếu vào dạng muối trong TCCS', () => {
    // Trường hợp: Phiếu ghi "Kẽm (Zn)", TCCS ghi "Kẽm (Kẽm gluconat)"
    expect(isCriteriaMatch('Kẽm (Zn)', 'Kẽm (Kẽm gluconat)')).toBe(true);
    expect(isCriteriaMatch('Hàm lượng Kẽm', 'Kẽm (Kẽm gluconat)')).toBe(true);
    expect(isCriteriaMatch('Zinc content', 'Kẽm (Kẽm gluconat)')).toBe(true);

    // Trường hợp Sắt
    expect(isCriteriaMatch('Sắt (Fe)', 'Sắt (Sắt fumarat)')).toBe(true);
    expect(isCriteriaMatch('Hàm lượng Sắt', 'Sắt (Sắt sulfat)')).toBe(true);

    // Trường hợp Canxi
    expect(isCriteriaMatch('Canxi (Ca)', 'Canxi (Canxi glucoheptonat)')).toBe(true);
    expect(isCriteriaMatch('Calcium', 'Canxi (Canxi carbonat)')).toBe(true);

    // Trường hợp Magie
    expect(isCriteriaMatch('Magie (Mg)', 'Magie (Magnesi lactat)')).toBe(true);
    expect(isCriteriaMatch('Magnesium content', 'Magie (Magnesi oxyd)')).toBe(true);
  });

  it('tự động map kết quả AI vào danh sách chỉ tiêu TCCS đúng vị trí', () => {
    const mockTccsCriteria: Criterion[] = [
      { name: 'Kẽm (Kẽm gluconat)', unit: 'mg', type: CriterionType.NUMBER, min: 10, max: 15 },
      { name: 'Sắt (Sắt fumarat)', unit: 'mg', type: CriterionType.NUMBER, min: 20, max: 30 },
      { name: 'Độ ẩm', unit: '%', type: CriterionType.NUMBER, max: 9.0 }
    ];

    const aiExtractedResults = [
      { criteriaName: 'Hàm lượng Kẽm (Zn)', value: '12.5', unit: 'mg' },
      { criteriaName: 'Loss on Drying (LOD)', value: '6.8', unit: '%' },
      { criteriaName: 'Sắt (Fe)', value: '25.0', unit: 'mg' }
    ];

    const mapped = mapAIExtractedResultsToCriteria(aiExtractedResults, mockTccsCriteria);
    expect(mapped.length).toBe(3);

    const zinc = mapped.find(m => m.criteriaName === 'Kẽm (Kẽm gluconat)');
    expect(zinc).toBeDefined();
    expect(zinc?.value).toBe('12.5');

    const iron = mapped.find(m => m.criteriaName === 'Sắt (Sắt fumarat)');
    expect(iron).toBeDefined();
    expect(iron?.value).toBe('25.0');

    const moisture = mapped.find(m => m.criteriaName === 'Độ ẩm');
    expect(moisture).toBeDefined();
    expect(moisture?.value).toBe('6.8');
  });

  it('tự động khớp thành phần Probiotics / Bacillus phức tạp vào chỉ tiêu Tổng số lợi khuẩn Bacillus', () => {
    // Trường hợp theo câu hỏi của user:
    // Thành phần: "probiotics (lactobacillus sporogenes, bacillus clausii, bacillus subtilis)"
    // Chỉ tiêu TCCS: "Tổng số lợi khuẩn Bacillus"
    expect(
      isCriteriaMatch(
        'probiotics (lactobacillus sporogenes, bacillus clausii, bacillus subtilis)',
        'Tổng số lợi khuẩn Bacillus'
      )
    ).toBe(true);

    expect(isCriteriaMatch('Bacillus clausii', 'Tổng số lợi khuẩn Bacillus')).toBe(true);
    expect(isCriteriaMatch('Bacillus subtilis', 'Tổng số lợi khuẩn Bacillus')).toBe(true);
    expect(isCriteriaMatch('Lactobacillus sporogenes', 'Tổng số lợi khuẩn Bacillus')).toBe(true);
    expect(isCriteriaMatch('Bào tử lợi khuẩn Bacillus', 'Tổng số lợi khuẩn Bacillus')).toBe(true);
    expect(isCriteriaMatch('Tổng số bào tử Bacillus', 'Tổng số lợi khuẩn Bacillus')).toBe(true);

    const mockTccsCriteria: Criterion[] = [
      { name: 'Tổng số lợi khuẩn Bacillus', unit: 'CFU/g', type: CriterionType.NUMBER, min: 1000000000 }
    ];

    const aiExtractedResults = [
      {
        criteriaName: 'probiotics (lactobacillus sporogenes, bacillus clausii, bacillus subtilis)',
        value: '1.5 x 10^9',
        unit: 'CFU/g'
      }
    ];

    const mapped = mapAIExtractedResultsToCriteria(aiExtractedResults, mockTccsCriteria);
    expect(mapped.length).toBe(1);
    expect(mapped[0].criteriaName).toBe('Tổng số lợi khuẩn Bacillus');
    expect(mapped[0].value).toBe('1.5 x 10^9');
  });
});

