import { describe, it, expect } from 'vitest';
import { calculateStabilityKinetics, predictBatchRiskBeforeTesting } from './predictiveInspectionService';

describe('predictiveInspectionService - Kinetics & Batch Risk', () => {
  it('should correctly calculate first-order stability kinetics and t90', () => {
    // Giả lập dữ liệu suy giảm hoạt chất theo thời gian
    const points = [
      { date: '2025-01-01', value: 100 },
      { date: '2025-04-01', value: 98 },
      { date: '2025-07-01', value: 96 },
      { date: '2025-10-01', value: 94 },
      { date: '2026-01-01', value: 92 },
    ];

    const result = calculateStabilityKinetics('Vitamin C', points, 80, 24);

    expect(result).not.toBeNull();
    expect(result!.criteriaName).toBe('Vitamin C');
    expect(result!.decayRateConstantK).toBeGreaterThan(0);
    expect(result!.rSquared).toBeGreaterThan(0.9);
    expect(result!.t90Months).toBeGreaterThan(0);
    expect(result!.predictedExpiryValue).toBeGreaterThan(80);
    expect(result!.isEarlyExpiryRisk).toBe(false);
  });

  it('should detect rapid decay and early expiration risk', () => {
    // Suy giảm nhanh: từ 100 xuống 82 chỉ sau 6 tháng
    const rapidPoints = [
      { date: '2025-01-01', value: 100 },
      { date: '2025-03-01', value: 92 },
      { date: '2025-05-01', value: 85 },
      { date: '2025-07-01', value: 80 },
    ];

    const result = calculateStabilityKinetics('Men Vi Sinh', rapidPoints, 80, 24);

    expect(result).not.toBeNull();
    expect(result!.isEarlyExpiryRisk).toBe(true);
    expect(result!.status).toBe('RAPID_DECAY');
    expect(result!.message).toContain('🚨 Cảnh báo nguy cơ hết hạn sớm');
  });

  it('should handle batch risk prediction before testing', () => {
    const appContext = {
      batches: [
        { id: 'b_01', batchNo: '010126', productId: 'p_01', tccsId: 't_01', labName: 'Quatest 3' }
      ],
      products: [
        { id: 'p_01', name: 'Siro Ho V-Biotech' }
      ],
      tccsList: [
        { id: 't_01', code: 'TCCS-01', productId: 'p_01', isActive: true, mainQualityCriteria: [{ name: 'Độ ẩm', min: 0, max: 5 }] }
      ],
      testResults: [
        { id: 'tr_01', batchId: 'b_01', labName: 'Quatest 3', overallStatus: 'PASS', testDate: '2026-01-10' }
      ]
    };

    const riskReport = predictBatchRiskBeforeTesting('010126', appContext);
    expect(riskReport).toBeDefined();
    expect('batchNo' in riskReport).toBe(true);
    if ('batchNo' in riskReport) {
      expect(riskReport.batchNo).toBe('010126');
      expect(riskReport.overallPassProbability).toBeGreaterThan(0);
    }
  });
});
