import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useBatchTestingProgress } from './useBatchTestingProgress';
import { TCCS, TestResult, Batch, Criterion, CriterionType } from '../types';

// Mock Data
const mockBatch: Batch = { id: 'batch-1', productId: 'prod-1' } as Batch;

const mockTCCS: TCCS = {
  id: 'tccs-1',
  productId: 'prod-1',
  mainQualityCriteria: [
    { name: 'Độ ẩm', type: CriterionType.NUMBER, max: 5, unit: '%' },
    { name: 'Protein', type: CriterionType.NUMBER, min: 10, unit: '%' },
  ],
  safetyCriteria: [
    { name: 'E. coli', type: CriterionType.TEXT, expectedText: 'KPH', unit: '' },
    { name: 'Salmonella', type: CriterionType.TEXT, expectedText: 'KPH', unit: '' },
    { name: 'Vi nấm', type: CriterionType.NUMBER, expectedText: '<= 100', unit: 'CFU/g' },
  ],
  alternateRules: [
    // Nếu 'E. coli' đạt -> 'Salmonella' được miễn
    { main: 'E. coli', alt: 'Salmonella', type: 'FAIL_RETRY' },
    // Nếu 'Vi nấm' <= 100 -> 'Độc tố A' được miễn
    { main: 'Vi nấm', alt: 'Độc tố A', type: 'CONDITIONAL_CHECK', conditionValue: '<= 100' },
  ],
} as TCCS;

// Thêm 'Độc tố A' vào TCCS để test rule conditional
(mockTCCS.safetyCriteria as Criterion[]).push({ name: 'Độc tố A', type: CriterionType.TEXT, expectedText: 'KPH', unit: '' });

describe('useBatchTestingProgress', () => {
  it('should return zero values when no TCCS is provided', () => {
    const { result } = renderHook(() => useBatchTestingProgress({
      batch: mockBatch,
      testResults: [],
      tccs: undefined,
    }));

    expect(result.current.requiredCount).toBe(0);
    expect(result.current.completedCount).toBe(0);
    expect(result.current.progressPercent).toBe(0);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.missingCriteria).toEqual([]);
  });

  it('should calculate basic progress correctly', () => {
    const testResults: TestResult[] = [{
      batchId: 'batch-1',
      results: [{ criteriaName: 'Độ ẩm', value: '4', isPass: true }],
    } as TestResult];

    const { result } = renderHook(() => useBatchTestingProgress({
      batch: mockBatch,
      testResults,
      tccs: { ...mockTCCS, alternateRules: [] }, // Test không có rule
    }));

    expect(result.current.requiredCount).toBe(6);
    expect(result.current.completedCount).toBe(1);
    expect(result.current.progressPercent).toBe(Math.round(1/6 * 100));
    expect(result.current.missingCriteria.map(c => c.name)).toContain('Protein');
  });

  describe('with FAIL_RETRY rule', () => {
    it('should exempt alternate criterion if main criterion passes', () => {
      const testResults: TestResult[] = [{
        batchId: 'batch-1',
        results: [{ criteriaName: 'E. coli', value: 'KPH', isPass: true }], // TC1 Đạt
      } as TestResult];

      const { result } = renderHook(() => useBatchTestingProgress({ batch: mockBatch, testResults, tccs: mockTCCS }));

      // 'Salmonella' (TC2) không còn trong danh sách thiếu
      expect(result.current.missingCriteria.map(c => c.name)).not.toContain('Salmonella');
      // Hoàn thành 2 (E.coli + Salmonella) trên tổng 6
      expect(result.current.completedCount).toBe(2); 
    });

    it('should NOT exempt alternate criterion if main criterion fails', () => {
      const testResults: TestResult[] = [{
        batchId: 'batch-1',
        results: [{ criteriaName: 'E. coli', value: 'Phát hiện', isPass: false }], // TC1 Rớt
      } as TestResult];

      const { result } = renderHook(() => useBatchTestingProgress({ batch: mockBatch, testResults, tccs: mockTCCS }));

      // 'Salmonella' (TC2) vẫn nằm trong danh sách thiếu
      expect(result.current.missingCriteria.map(c => c.name)).toContain('Salmonella');
      // Chỉ hoàn thành 1 (E.coli) trên tổng 6
      expect(result.current.completedCount).toBe(1);
    });
  });

  describe('with CONDITIONAL_CHECK rule', () => {
    it('should exempt alternate criterion if condition is met', () => {
      const testResults: TestResult[] = [{
        batchId: 'batch-1',
        results: [{ criteriaName: 'Vi nấm', value: '50', isPass: true }], // Giá trị 50 <= 100
      } as TestResult];

      const { result } = renderHook(() => useBatchTestingProgress({ batch: mockBatch, testResults, tccs: mockTCCS }));

      // 'Độc tố A' được miễn
      expect(result.current.missingCriteria.map(c => c.name)).not.toContain('Độc tố A');
      expect(result.current.completedCount).toBe(2);
    });

    it('should NOT exempt alternate criterion if condition is NOT met', () => {
      const testResults: TestResult[] = [{
        batchId: 'batch-1',
        results: [{ criteriaName: 'Vi nấm', value: '150', isPass: false }], // Giá trị 150 > 100
      } as TestResult];

      const { result } = renderHook(() => useBatchTestingProgress({ batch: mockBatch, testResults, tccs: mockTCCS }));

      // 'Độc tố A' vẫn phải kiểm
      expect(result.current.missingCriteria.map(c => c.name)).toContain('Độc tố A');
      expect(result.current.completedCount).toBe(1);
    });
  });

  it('should be complete when all required criteria are tested or exempted', () => {
    const testResults: TestResult[] = [{
      batchId: 'batch-1',
      results: [
        { criteriaName: 'Độ ẩm', value: '4', isPass: true },
        { criteriaName: 'Protein', value: '12', isPass: true },
        { criteriaName: 'E. coli', value: 'KPH', isPass: true }, // Miễn cho Salmonella
        { criteriaName: 'Vi nấm', value: '50', isPass: true },  // Miễn cho Độc tố A
      ],
    } as TestResult];

    const { result } = renderHook(() => useBatchTestingProgress({ batch: mockBatch, testResults, tccs: mockTCCS }));

    expect(result.current.isComplete).toBe(true);
    expect(result.current.completedCount).toBe(6);
    expect(result.current.progressPercent).toBe(100);
  });
});