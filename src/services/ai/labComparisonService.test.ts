import { describe, it, expect } from 'vitest';
import { 
  calculateRPD, 
  classifyDeviation, 
  evaluateCensoredDataRPD, 
  matchAndCompareEntries, 
  computeLabBias, 
  generateRuleBasedComparisonAnalysis 
} from './labComparisonService';
import { detectLabOrganization, parseLabResultValue } from './externalLabTemplates';
import { TestResultEntry } from '../../types';

describe('labComparisonService - Cross-Lab Comparison & Bias Detection', () => {
  describe('calculateRPD', () => {
    it('should correctly calculate Relative Percent Difference (RPD)', () => {
      // ( |100 - 95| / ((100 + 95)/2) ) * 100 = (5 / 97.5) * 100 = 5.128%
      const rpd = calculateRPD(100, 95);
      expect(rpd).toBeCloseTo(5.13, 2);
    });

    it('should return 0 when values are identical', () => {
      expect(calculateRPD(50, 50)).toBe(0);
    });

    it('should return 0 when both are 0 or NaN', () => {
      expect(calculateRPD(0, 0)).toBe(0);
      expect(calculateRPD(NaN, 10)).toBe(0);
    });
  });

  describe('classifyDeviation', () => {
    it('should classify RPD <= 5% as EXCELLENT', () => {
      expect(classifyDeviation(3.5, 100, 103.5, true, true)).toBe('EXCELLENT');
    });

    it('should classify RPD 5-12% as ACCEPTABLE', () => {
      expect(classifyDeviation(8.0, 100, 108.3, true, true)).toBe('ACCEPTABLE');
    });

    it('should classify RPD 12-25% as WARNING', () => {
      expect(classifyDeviation(18.0, 100, 120, true, true)).toBe('WARNING');
    });

    it('should classify RPD > 25% as CRITICAL', () => {
      expect(classifyDeviation(30.0, 100, 135, true, true)).toBe('CRITICAL');
    });

    it('should classify conflicting pass/fail statuses as CRITICAL', () => {
      expect(classifyDeviation(4.0, 100, 104, true, false)).toBe('CRITICAL');
    });

    it('should handle qualitative strings correctly', () => {
      expect(classifyDeviation(undefined, 'Đạt', 'Đạt')).toBe('EXCELLENT');
      expect(classifyDeviation(undefined, 'Đạt', 'Không đạt')).toBe('CRITICAL');
    });
  });

  describe('evaluateCensoredDataRPD (QUATEST 3 / CASE / NIFC Censored Data)', () => {
    it('should evaluate both non-detect results as EXCELLENT with 0% RPD', () => {
      const p1 = parseLabResultValue('KPH');
      const p2 = parseLabResultValue('KPH (LOD = 0.01 mg/kg)');

      const res = evaluateCensoredDataRPD(p1, p2, true, true);
      expect(res.deviationLevel).toBe('EXCELLENT');
      expect(res.rpd).toBe(0);
      expect(res.isCensored).toBe(true);
    });

    it('should evaluate numeric value within LOD as ACCEPTABLE without false alarm', () => {
      const p1 = parseLabResultValue('0.003'); // Giá trị định lượng nhỏ
      const p2 = parseLabResultValue('KPH (LOD = 0.005 mg/kg)'); // Ngưỡng phát hiện của Quatest 3

      const res = evaluateCensoredDataRPD(p1, p2, true, true);
      expect(res.deviationLevel).toBe('ACCEPTABLE');
      expect(res.rpd).toBe(0);
      expect(res.analysis).toContain('Tương thích ngưỡng phát hiện');
    });

    it('should calculate estimated RPD via substitution when numeric value exceeds LOD', () => {
      const p1 = parseLabResultValue('0.08'); // Giá trị phát hiện thực tế
      const p2 = parseLabResultValue('KPH (LOD = 0.01 mg/kg)'); // Ngưỡng phát hiện ngoại kiểm

      const res = evaluateCensoredDataRPD(p1, p2, true, true);
      expect(res.deviationLevel).toBe('CRITICAL');
      expect(res.rpd).toBeGreaterThan(25);
      expect(res.analysis).toContain('LOD/2');
    });
  });

  describe('detectLabOrganization', () => {
    it('should correctly detect QUATEST 3', () => {
      expect(detectLabOrganization('Phiếu Quatest 3 mẫu thử KT3-1234')).toBe('QUATEST3');
      expect(detectLabOrganization('Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3')).toBe('QUATEST3');
    });

    it('should correctly detect CASE', () => {
      expect(detectLabOrganization('Phiếu phân tích CASE TP.HCM số MM24-001')).toBe('CASE');
      expect(detectLabOrganization('Trung tâm Dịch vụ Phân tích Thí nghiệm TP.HCM')).toBe('CASE');
    });

    it('should correctly detect NIFC', () => {
      expect(detectLabOrganization('Viện Kiểm nghiệm An toàn Vệ sinh Thực phẩm Quốc gia NIFC')).toBe('NIFC');
      expect(detectLabOrganization('Phiếu thử nghiệm VKN.24.1234')).toBe('NIFC');
    });

    it('should fallback to GENERIC when unknown', () => {
      expect(detectLabOrganization('Phòng thí nghiệm ngẫu nhiên ABC')).toBe('GENERIC');
    });
  });

  describe('matchAndCompareEntries', () => {
    it('should match common criteria between two lab test results including methods', () => {
      const results1: TestResultEntry[] = [
        { criteriaName: 'Độ ẩm', value: '4.5', isPass: true, unit: '%' },
        { criteriaName: 'Định lượng Paracetamol', value: '500', isPass: true, unit: 'mg' },
        { criteriaName: 'Độ rã', value: '8 phút', isPass: true }
      ];

      const results2: TestResultEntry[] = [
        { criteriaName: 'Moisture (LOD)', value: '4.8', isPass: true, unit: '%' },
        { criteriaName: 'Hàm lượng Paracetamol', value: '495', isPass: true, unit: 'mg' },
        { criteriaName: 'Giới hạn vi sinh', value: 'Đạt', isPass: true }
      ];

      const comparison = matchAndCompareEntries(results1, results2);
      expect(comparison.length).toBe(4); // 2 matched + 1 only in 1 + 1 only in 2

      const moistureEntry = comparison.find(c => c.criteriaName === 'Độ ẩm');
      expect(moistureEntry).toBeDefined();
      expect(moistureEntry?.source2Value).toBe('4.8');
      expect(moistureEntry?.rpd).toBeDefined();
      expect(moistureEntry?.deviationLevel).toBe('ACCEPTABLE');
    });
  });

  describe('computeLabBias & generateRuleBasedComparisonAnalysis', () => {
    it('should detect systematic lab bias when one lab is consistently higher', () => {
      const report1 = {
        title: 'Nội bộ',
        labName: 'Phòng QC Nhà máy',
        results: []
      };
      const report2 = {
        title: 'Quatest 3',
        labName: 'Quatest 3',
        results: []
      };

      const entries = [
        { criteriaName: 'Hoạt chất A', source1Name: 'Hoạt chất A', source1Value: '105', source2Name: 'Hoạt chất A', source2Value: '98', rpd: 6.89, deviationLevel: 'ACCEPTABLE' as const },
        { criteriaName: 'Hoạt chất B', source1Name: 'Hoạt chất B', source1Value: '52', source2Name: 'Hoạt chất B', source2Value: '48', rpd: 8.0, deviationLevel: 'ACCEPTABLE' as const },
        { criteriaName: 'Hoạt chất C', source1Name: 'Hoạt chất C', source1Value: '210', source2Name: 'Hoạt chất C', source2Value: '195', rpd: 7.4, deviationLevel: 'ACCEPTABLE' as const },
        { criteriaName: 'Hoạt chất D', source1Name: 'Hoạt chất D', source1Value: '15.5', source2Name: 'Hoạt chất D', source2Value: '14.2', rpd: 8.7, deviationLevel: 'ACCEPTABLE' as const },
      ];

      const bias = computeLabBias(report1, report2, entries);
      expect(bias.isSystematic).toBe(true);
      expect(bias.direction).toBe('SOURCE1_HIGHER');
      expect(bias.biasRatioPercent).toBe(100);
      expect(bias.assessmentSummary).toContain('Phòng QC Nhà máy');
      expect(bias.actionRecommendations.length).toBeGreaterThan(0);

      const analysis = generateRuleBasedComparisonAnalysis(report1, report2, entries);
      expect(analysis.systematicBiasAssessment).toContain('Phòng QC Nhà máy');
      expect(analysis.systematicBiasAssessment).toContain('cao hơn');
    });
  });
});
