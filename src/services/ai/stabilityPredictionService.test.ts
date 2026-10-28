import { describe, it, expect } from 'vitest';
import { linearRegression, calculateMonthsBetween, predictProductStability } from './stabilityPredictionService';
import { Product, Batch, TestResult, TCCS, CriterionType } from '../../types';

describe('stabilityPredictionService - Predictive Quality & Stability', () => {
  describe('calculateMonthsBetween', () => {
    it('should accurately calculate months difference between ISO dates', () => {
      const m1 = calculateMonthsBetween('2026-01-01', '2026-07-01');
      expect(m1).toBeCloseTo(6.0, 1);
    });

    it('should handle DD/MM/YYYY dates', () => {
      const m2 = calculateMonthsBetween('01/01/2026', '01/04/2026');
      expect(m2).toBeCloseTo(3.0, 1);
    });
  });

  describe('linearRegression', () => {
    it('should compute slope, intercept, and R-squared for linear decay', () => {
      // y = 100 - 2*x
      const points = [
        { x: 0, y: 100 },
        { x: 3, y: 94 },
        { x: 6, y: 88 },
        { x: 12, y: 76 }
      ];

      const reg = linearRegression(points);
      expect(reg.slope).toBeCloseTo(-2, 2);
      expect(reg.intercept).toBeCloseTo(100, 2);
      expect(reg.rSquared).toBeCloseTo(1.0, 2);
    });
  });

  describe('predictProductStability', () => {
    it('should identify high risk when degradation breaches min limit before shelf life', () => {
      const mockProduct: Product = {
        id: 'p1',
        code: 'PROD-01',
        name: 'Siro Bổ Khí',
        group: 'Thuốc nước',
        registrationNo: 'VD-12345-20',
        registrationDate: '2025-01-01',
        registrant: 'V-Biotech',
        status: 'ACTIVE',
        description: '',
        createdAt: '',
        updatedAt: ''
      };

      const mockTccs: TCCS = {
        id: 'tccs1',
        productId: 'p1',
        code: 'TCCS-01',
        issueDate: '2025-01-01',
        isActive: true,
        mainQualityCriteria: [
          { name: 'Hàm lượng Vitamin C', unit: '%', min: 90, max: 110, type: CriterionType.NUMBER }
        ],
        safetyCriteria: [],
        createdAt: ''
      };

      const mockBatches: Batch[] = [
        { id: 'b1', productId: 'p1', tccsId: 'tccs1', batchNo: 'L01', mfgDate: '2026-01-01', expDate: '2028-01-01', theoreticalYield: 100, actualYield: 98, yieldUnit: 'lọ', status: 'RELEASED', createdAt: '' },
        { id: 'b2', productId: 'p1', tccsId: 'tccs1', batchNo: 'L01-T6', mfgDate: '2026-01-01', expDate: '2028-01-01', theoreticalYield: 100, actualYield: 98, yieldUnit: 'lọ', status: 'RELEASED', createdAt: '' }
      ];

      const mockTestResults: TestResult[] = [
        {
          id: 'tr1',
          batchId: 'b1',
          labName: 'QC',
          testDate: '2026-01-01', // T = 0 tháng
          overallStatus: 'PASS',
          results: [{ criteriaName: 'Hàm lượng Vitamin C', value: '100', isPass: true }],
          createdAt: ''
        },
        {
          id: 'tr2',
          batchId: 'b2',
          labName: 'QC',
          testDate: '2026-07-01', // T = 6 tháng
          overallStatus: 'PASS',
          results: [{ criteriaName: 'Hàm lượng Vitamin C', value: '92', isPass: true }],
          createdAt: ''
        }
      ];

      const report = predictProductStability(mockProduct, mockBatches, mockTestResults, mockTccs, 24);
      expect(report.forecasts.length).toBe(1);

      const vitC = report.forecasts[0];
      expect(vitC.decayRatePerMonth).toBeGreaterThan(1.0); // Giảm 8% trong 6 tháng => ~1.33%/tháng
      expect(vitC.projectedMonthToMinLimit).toBeLessThanOrEqual(24);
      expect(vitC.riskLevel).toBe('HIGH_EXPIRY_RISK');
    });
  });
});
