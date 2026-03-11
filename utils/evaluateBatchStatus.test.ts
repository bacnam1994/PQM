import { describe, it, expect } from 'vitest';
import { evaluateBatchStatus } from './batchEvaluation';
import { TestResult } from '../types';

const mockBatch = { id: 'batch-1' };

const mockTccs = {
  mainQualityCriteria: [{ name: 'Độ ẩm' }, { name: 'Protein' }],
  safetyCriteria: [{ name: 'E. coli' }],
};

const mockTccsWithAlternateRules = {
  mainQualityCriteria: [{ name: 'Độ ẩm' }, { name: 'Protein' }],
  safetyCriteria: [{ name: 'E. coli' }],
  alternateRules: [
    { main: 'Độ ẩm', alt: 'Protein', type: 'FAIL_RETRY' }, // FAIL_RETRY: Độ ẩm đạt -> Protein auto đạt
    { main: 'Protein', alt: 'E. coli', type: 'CONDITIONAL_CHECK', conditionValue: '10' }, // CONDITIONAL_CHECK: Protein > 10 -> E. coli bắt buộc
  ],
};

describe('evaluateBatchStatus', () => {
  it('should return PENDING if no test results exist for the batch', () => {
    const result = evaluateBatchStatus(mockBatch, [], mockTccs);
    expect(result.suggestedStatus).toBe('PENDING');
    expect(result.reason).toBe('Chưa có kết quả kiểm nghiệm nào');
  });

  describe('with TCCS provided', () => {
    it('should return RELEASED if all criteria are checked and passed', () => {
      const testResults: TestResult[] = [
        {
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'PASS' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: true, value: '5' },
            { criteriaName: 'Protein', isPass: true, value: '12' },
            { criteriaName: 'E. coli', isPass: true, value: 'KPH' },
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccs);
      expect(result.suggestedStatus).toBe('RELEASED');
      expect(result.reason).toContain('Đã kiểm đủ 3 chỉ tiêu theo TCCS - Tất cả PASS');
    });

    it('should return REJECTED if all criteria are checked but some failed', () => {
      const testResults: TestResult[] = [
        {
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'FAIL' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: true, value: '5' },
            { criteriaName: 'Protein', isPass: false, value: '8' }, // FAIL
            { criteriaName: 'E. coli', isPass: true, value: 'KPH' },
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccs);
      expect(result.suggestedStatus).toBe('REJECTED');
      expect(result.reason).toContain('Có 1 chỉ tiêu không đạt: Protein');
    });

    it('should return TESTING if not all criteria are checked', () => {
      const testResults: TestResult[] = [
        {
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'PASS' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: true, value: '5' },
            // Missing 'Protein' and 'E. coli'
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccs);
      expect(result.suggestedStatus).toBe('TESTING');
      expect(result.reason).toContain('Đã kiểm 1/3 chỉ tiêu - Còn thiếu: Protein, E. coli');
    });

    it('should use the latest result for a criterion tested multiple times', () => {
      const testResults: TestResult[] = [
        { // Old result, Protein FAIL
          batchId: 'batch-1',
          testDate: '2024-01-05',
          overallStatus: 'FAIL' as const,
          results: [{ criteriaName: 'Protein', isPass: false, value: '9' }],
        } as TestResult,
        { // New result, Protein PASS
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'PASS' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: true, value: '5' },
            { criteriaName: 'Protein', isPass: true, value: '11' }, // Retested and passed
            { criteriaName: 'E. coli', isPass: true, value: 'KPH' },
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccs);
      expect(result.suggestedStatus).toBe('RELEASED');
      expect(result.allPassed).toBe(true);
    });
  });

  describe('with alternateRules (FAIL_RETRY)', () => {
    it('should return RELEASED when TC1 passes and TC2 is auto-passed (FAIL_RETRY)', () => {
      const testResults: TestResult[] = [
        {
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'PASS' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: true, value: '5' }, // TC1 Đạt
            // Protein (TC2) sẽ được auto-pass vì có rule FAIL_RETRY
            { criteriaName: 'E. coli', isPass: true, value: 'KPH' },
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccsWithAlternateRules);
      expect(result.suggestedStatus).toBe('RELEASED');
      expect(result.reason).toContain('Đã kiểm đủ 3 chỉ tiêu theo TCCS');
    });

    it('should return TESTING when TC1 fails (TC2 needs actual check)', () => {
      const testResults: TestResult[] = [
        {
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'FAIL' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: false, value: '15' }, // TC1 Không đạt
            // Protein (TC2) cần được kiểm thực tế vì TC1 fail
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccsWithAlternateRules);
      expect(result.suggestedStatus).toBe('TESTING');
      expect(result.reason).toContain('Còn thiếu: Protein');
    });
  });

  describe('with alternateRules (CONDITIONAL_CHECK)', () => {
    it('should return TESTING when TC1 > threshold and TC2 is not checked', () => {
      const testResults: TestResult[] = [
        {
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'PASS' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: true, value: '5' },
            { criteriaName: 'Protein', isPass: true, value: '15' }, // Protein = 15 > 10 (threshold)
            // E. coli (TC2) phải được kiểm vì Protein > threshold
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccsWithAlternateRules);
      expect(result.suggestedStatus).toBe('TESTING');
      expect(result.reason).toContain('Còn thiếu: E. coli');
    });

    it('should return RELEASED when TC1 > threshold and TC2 passes', () => {
      const testResults: TestResult[] = [
        {
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'PASS' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: true, value: '5' },
            { criteriaName: 'Protein', isPass: true, value: '15' }, // Protein = 15 > 10 (threshold)
            { criteriaName: 'E. coli', isPass: true, value: 'KPH' }, // E. coli đã kiểm và đạt
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccsWithAlternateRules);
      expect(result.suggestedStatus).toBe('RELEASED');
    });

    it('should return RELEASED when TC1 <= threshold (TC2 auto-passed)', () => {
      const testResults: TestResult[] = [
        {
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'PASS' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: true, value: '5' },
            { criteriaName: 'Protein', isPass: true, value: '8' }, // Protein = 8 <= 10 (threshold)
            // E. coli được auto-pass vì Protein <= threshold
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccsWithAlternateRules);
      expect(result.suggestedStatus).toBe('RELEASED');
    });

    it('should return REJECTED when TC1 > threshold and TC2 fails', () => {
      const testResults: TestResult[] = [
        {
          batchId: 'batch-1',
          testDate: '2024-01-10',
          overallStatus: 'FAIL' as const,
          results: [
            { criteriaName: 'Độ ẩm', isPass: true, value: '5' },
            { criteriaName: 'Protein', isPass: true, value: '15' }, // Protein = 15 > 10 (threshold)
            { criteriaName: 'E. coli', isPass: false, value: '2' }, // E. coli không đạt
          ],
        } as TestResult,
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, mockTccsWithAlternateRules);
      expect(result.suggestedStatus).toBe('REJECTED');
      expect(result.reason).toContain('E. coli');
    });
  });

  describe('without TCCS provided', () => {
    it('should return RELEASED if the latest test result is PASS', () => {
      const testResults: TestResult[] = [
        { batchId: 'batch-1', testDate: '2024-01-05', overallStatus: 'FAIL' as const, results: [] } as TestResult,
        { batchId: 'batch-1', testDate: '2024-01-10', overallStatus: 'PASS' as const, results: [] } as TestResult, // Latest is PASS
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, undefined);
      expect(result.suggestedStatus).toBe('RELEASED');
      expect(result.reason).toContain('Phiếu mới nhất');
      expect(result.reason).toContain('đạt');
    });

    it('should return REJECTED if the latest test result is FAIL', () => {
      const testResults: TestResult[] = [
        { batchId: 'batch-1', testDate: '2024-01-10', overallStatus: 'PASS' as const, results: [] } as TestResult,
        { batchId: 'batch-1', testDate: '2024-01-15', overallStatus: 'FAIL' as const, results: [] } as TestResult, // Latest is FAIL
      ];
      const result = evaluateBatchStatus(mockBatch, testResults, undefined);
      expect(result.suggestedStatus).toBe('REJECTED');
      expect(result.reason).toContain('Phiếu mới nhất');
      expect(result.reason).toContain('không đạt');
    });

    it('should return REJECTED if the only result is FAIL', () => {
        const testResults: TestResult[] = [
          { batchId: 'batch-1', testDate: '2024-01-15', overallStatus: 'FAIL' as const, results: [] } as TestResult,
        ];
        const result = evaluateBatchStatus(mockBatch, testResults, undefined);
        expect(result.suggestedStatus).toBe('REJECTED');
    });
  });
});
