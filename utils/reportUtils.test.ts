import { describe, it, expect } from 'vitest';
import { groupResultsForReport } from './reportUtils';
import { TCCS, TestResultEntry, CriterionType } from '../types';

// Mock data for testing
const mockTCCS: TCCS = {
  id: 'tccs-1',
  code: 'TCCS-01',
  productId: 'prod-1',
  issueDate: '2023-01-01',
  mainQualityCriteria: [
    { name: 'Độ ẩm', type: CriterionType.NUMBER, max: 5, unit: '%' },
    { name: 'Hàm lượng Protein', type: CriterionType.NUMBER, min: 10, unit: '%' },
  ],
  safetyCriteria: [
    { name: 'Tổng số vi sinh vật hiếu khí', type: CriterionType.NUMBER, max: 1000, unit: 'CFU/g' },
    { name: 'Chì (Pb)', type: CriterionType.NUMBER, max: 0.1, unit: 'mg/kg' },
    { name: 'Asen (As)', type: CriterionType.NUMBER, max: 0.2, unit: 'mg/kg' },
    { name: 'E. coli', type: CriterionType.TEXT, expectedText: 'Không phát hiện', unit: '' },
  ],
  isActive: true,
  createdAt: '2023-01-01',
};

const mockResults: TestResultEntry[] = [
  { criteriaName: 'Hàm lượng Protein', value: '12', isPass: true, isExtra: false, unit: '%' }, // Physical, should be sorted second
  { criteriaName: 'Chì (Pb)', value: '0.05', isPass: true, isExtra: false, unit: 'mg/kg' }, // Metal
  { criteriaName: 'Độ ẩm', value: '4', isPass: true, isExtra: false, unit: '%' }, // Physical, should be sorted first
  { criteriaName: 'E. coli', value: 'Không phát hiện', isPass: true, isExtra: false, unit: '' }, // Micro
  { criteriaName: 'Cảm quan', value: 'Bột mịn, không vón cục', isPass: true, isExtra: false, unit: '' }, // Physical, extra, should be sorted last
  { criteriaName: 'Asen (As)', value: '0.1', isPass: true, isExtra: false, unit: 'mg/kg' }, // Metal
];

describe('groupResultsForReport', () => {
  it('should return an empty array if results or tccs are not provided', () => {
    expect(groupResultsForReport([], mockTCCS)).toEqual([]);
    expect(groupResultsForReport(mockResults, undefined)).toEqual([]);
    expect(groupResultsForReport([], undefined)).toEqual([]);
  });

  it('should correctly group criteria into physical, micro, and metal', () => {
    const grouped = groupResultsForReport(mockResults, mockTCCS);

    const physicalGroup = grouped.find(g => g.title.includes('Lý hóa'));
    const microGroup = grouped.find(g => g.title.includes('Vi sinh vật'));
    const metalGroup = grouped.find(g => g.title.includes('Kim loại nặng'));

    expect(physicalGroup).toBeDefined();
    expect(microGroup).toBeDefined();
    expect(metalGroup).toBeDefined();

    expect(physicalGroup?.items.map(i => i.criteriaName)).toEqual(['Độ ẩm', 'Hàm lượng Protein', 'Cảm quan']);
    expect(microGroup?.items.map(i => i.criteriaName)).toEqual(['E. coli']);
    expect(metalGroup?.items.map(i => i.criteriaName)).toEqual(['Chì (Pb)', 'Asen (As)']);
  });

  it('should sort physical criteria based on mainQualityCriteria order', () => {
    const grouped = groupResultsForReport(mockResults, mockTCCS);
    const physicalGroup = grouped.find(g => g.title.includes('Lý hóa'));

    // 'Độ ẩm' is first in TCCS, 'Hàm lượng Protein' is second. 'Cảm quan' is not in TCCS main list.
    expect(physicalGroup?.items.map(i => i.criteriaName)).toEqual([
      'Độ ẩm',
      'Hàm lượng Protein',
      'Cảm quan',
    ]);
  });

  it('should filter out empty groups', () => {
    const resultsWithOnlyMetal: TestResultEntry[] = [
      { criteriaName: 'Chì (Pb)', value: '0.05', isPass: true, isExtra: false, unit: 'mg/kg' },
    ];
    const grouped = groupResultsForReport(resultsWithOnlyMetal, mockTCCS);

    expect(grouped.length).toBe(1);
    expect(grouped[0].title).toContain('Kim loại nặng');
    expect(grouped.find(g => g.title.includes('Lý hóa'))).toBeUndefined();
    expect(grouped.find(g => g.title.includes('Vi sinh vật'))).toBeUndefined();
  });

  it('should place criteria not in safety or main lists into the physical group', () => {
    const resultsWithExtra: TestResultEntry[] = [{ criteriaName: 'Màu sắc', value: 'Trắng ngà', isPass: true, isExtra: false, unit: '' }];
    const grouped = groupResultsForReport(resultsWithExtra, mockTCCS);
    const physicalGroup = grouped.find(g => g.title.includes('Lý hóa'));

    expect(physicalGroup).toBeDefined();
    expect(physicalGroup?.items[0].criteriaName).toBe('Màu sắc');
  });
});