import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTestResultEvaluation } from './useTestResultEvaluation';
import { evaluateCriterionSmart } from '../utils';

// 1. Mock các hàm tiện ích từ utils
vi.mock('../utils', () => ({
  ensureArray: (arr: any) => arr || [],
  parseNumberFromText: (text: string) => Number(text),
  evaluateCriterionSmart: vi.fn(),
}));

describe('useTestResultEvaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nên trả về 0% nếu không có TCCS nào được chọn', () => {
    const { result } = renderHook(() => 
      useTestResultEvaluation(null, {}, { rulesMap: new Map(), criteriaMap: new Map() })
    );

    expect(result.current.completionStatus).toEqual({
      progress: 0,
      isComplete: false,
      total: 0,
      completed: 0,
    });
  });

  it('nên tính toán tiến độ bình thường khi không có quy tắc thay thế', () => {
    const activeTCCS = {
      mainQualityCriteria: [{ name: 'Độ ẩm' }, { name: 'Hàm lượng' }],
      safetyCriteria: [],
    } as any;
    const tccsMaps = { rulesMap: new Map(), criteriaMap: new Map() };
    
    // Chỉ mới nhập 1/2 chỉ tiêu
    const testResultsMap = { 'Độ ẩm': '5%' };

    const { result } = renderHook(() => 
      useTestResultEvaluation(activeTCCS, testResultsMap, tccsMaps)
    );

    expect(result.current.completionStatus.total).toBe(2);
    expect(result.current.completionStatus.completed).toBe(1);
    expect(result.current.completionStatus.progress).toBe(50);
    expect(result.current.completionStatus.isComplete).toBe(false);
  });

  describe('Logic Quy tắc thay thế (Alternate Rules)', () => {
    const activeTCCS = {
      mainQualityCriteria: [{ name: 'Chỉ tiêu 1' }, { name: 'Chỉ tiêu 2 (Phụ)' }],
      safetyCriteria: [],
    } as any;

    const rulesMap = new Map([
      ['Chỉ tiêu 2 (Phụ)', { type: 'FAIL_RETRY', main: 'Chỉ tiêu 1', alt: 'Chỉ tiêu 2 (Phụ)' }]
    ]);
    const criteriaMap = new Map([
      ['Chỉ tiêu 1', { name: 'Chỉ tiêu 1', expectedText: 'Đạt' }]
    ]);
    const tccsMaps = { rulesMap, criteriaMap };

    it('nên TỰ ĐỘNG hoàn thành TC2 nếu TC1 ĐẠT (isMainPass === true)', () => {
      // Giả lập hàm đánh giá utils trả về true (TC1 Đạt) bằng Vitest
      (evaluateCriterionSmart as Mock).mockReturnValue(true);

      const testResultsMap = { 'Chỉ tiêu 1': 'Kết quả tốt' }; // Không nhập TC2

      const { result } = renderHook(() => 
        useTestResultEvaluation(activeTCCS, testResultsMap, tccsMaps)
      );

      expect(result.current.completionStatus.total).toBe(2);
      // Mặc dù chỉ nhập 1, nhưng completed phải là 2 nhờ quy tắc thay thế
      expect(result.current.completionStatus.completed).toBe(2); 
      expect(result.current.completionStatus.isComplete).toBe(true);
      expect(result.current.completionStatus.progress).toBe(100);
    });

    it('KHÔNG tự động hoàn thành TC2 nếu TC1 KHÔNG ĐẠT (isMainPass === false)', () => {
      // Giả lập hàm đánh giá utils trả về false (TC1 Rớt) bằng Vitest
      (evaluateCriterionSmart as Mock).mockReturnValue(false);

      const testResultsMap = { 'Chỉ tiêu 1': 'Kết quả xấu' }; // Không nhập TC2

      const { result } = renderHook(() => 
        useTestResultEvaluation(activeTCCS, testResultsMap, tccsMaps)
      );

      expect(result.current.completionStatus.total).toBe(2);
      // Do TC1 rớt, TC2 bắt buộc phải nhập -> completed chỉ là 1
      expect(result.current.completionStatus.completed).toBe(1); 
      expect(result.current.completionStatus.isComplete).toBe(false);
    });
  });

  describe('Logic Conditional Check (Điều kiện kích hoạt)', () => {
    const activeTCCS = {
      mainQualityCriteria: [{ name: 'Cảm quan' }, { name: 'Định lượng khuẩn' }],
    } as any;

    const rulesMap = new Map([
      ['Định lượng khuẩn', { type: 'CONDITIONAL_CHECK', main: 'Cảm quan', alt: 'Định lượng khuẩn', conditionValue: '10' }]
    ]);
    const criteriaMap = new Map([
      ['Cảm quan', { name: 'Cảm quan' }]
    ]);
    const tccsMaps = { rulesMap, criteriaMap };

    it('nên được phép bỏ qua TC2 nếu giá trị TC1 thỏa mãn điều kiện kích hoạt (<= conditionValue)', () => {
      (evaluateCriterionSmart as Mock).mockReturnValue(true);
      // TC1 nhập giá trị 5 (<= 10 là điều kiện)
      const testResultsMap = { 'Cảm quan': '5' };

      const { result } = renderHook(() => 
        useTestResultEvaluation(activeTCCS, testResultsMap, tccsMaps)
      );

      // Kích hoạt điều kiện bỏ qua -> Hoàn thành 100%
      expect(result.current.completionStatus.completed).toBe(2);
      expect(result.current.completionStatus.isComplete).toBe(true);
    });

    it('bắt buộc nhập TC2 nếu giá trị TC1 vượt quá điều kiện kích hoạt (> conditionValue)', () => {
      (evaluateCriterionSmart as Mock).mockReturnValue(true);
      // TC1 nhập giá trị 15 (> 10)
      const testResultsMap = { 'Cảm quan': '15' };

      const { result } = renderHook(() => 
        useTestResultEvaluation(activeTCCS, testResultsMap, tccsMaps)
      );

      // Không được bỏ qua TC2 -> Mới hoàn thành 50%
      expect(result.current.completionStatus.completed).toBe(1);
      expect(result.current.completionStatus.isComplete).toBe(false);
    });
  });
});