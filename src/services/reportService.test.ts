import { describe, it, expect } from 'vitest';
import { detectQualityAnomalies } from './reportService';

describe('reportService - detectQualityAnomalies', () => {
  const mockProducts = [
    { id: 'p1', code: 'SP01', name: 'Cao Ích Mẫu' },
    { id: 'p2', code: 'SP02', name: 'Hoạt Huyết Dưỡng Não' },
  ];

  it('phát hiện lô sắp hết hạn trong vòng số ngày chỉ định', () => {
    const now = new Date();
    const expSoon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 ngày nữa
    const expFar = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000).toISOString(); // 100 ngày nữa

    const mockBatches = [
      { id: 'b1', productId: 'p1', batchNo: 'L2601', expDate: expSoon },
      { id: 'b2', productId: 'p2', batchNo: 'L2602', expDate: expFar },
    ];

    const anomalies = detectQualityAnomalies({
      products: mockProducts,
      batches: mockBatches,
      testResults: [],
    }, 30);

    const expiryAlerts = anomalies.filter(a => a.type === 'EXPIRY');
    expect(expiryAlerts.length).toBe(1);
    expect(expiryAlerts[0].batchNo).toBe('L2601');
    expect(expiryAlerts[0].severity).toBe('MEDIUM');
  });

  it('phát hiện sản phẩm có tỷ lệ không đạt cao (>= 30%)', () => {
    const mockBatches = [
      { id: 'b1', productId: 'p1', batchNo: 'L01' },
      { id: 'b2', productId: 'p1', batchNo: 'L02' },
      { id: 'b3', productId: 'p1', batchNo: 'L03' },
    ];

    const mockTestResults = [
      { id: 'tr1', batchId: 'b1', overallStatus: 'FAIL', testDate: '2026-01-01' },
      { id: 'tr2', batchId: 'b2', overallStatus: 'FAIL', testDate: '2026-01-02' },
      { id: 'tr3', batchId: 'b3', overallStatus: 'PASS', testDate: '2026-01-03' },
    ];

    const anomalies = detectQualityAnomalies({
      products: mockProducts,
      batches: mockBatches,
      testResults: mockTestResults,
    });

    const highFailAlerts = anomalies.filter(a => a.type === 'HIGH_FAIL_RATE');
    expect(highFailAlerts.length).toBe(1);
    expect(highFailAlerts[0].productName).toBe('Cao Ích Mẫu');
    expect(highFailAlerts[0].severity).toBe('HIGH');
  });

  it('phát hiện hiện tượng trôi chỉ tiêu (Drift) qua 3 lô liên tiếp', () => {
    const mockBatches = [
      { id: 'b1', productId: 'p1', batchNo: 'L01' },
      { id: 'b2', productId: 'p1', batchNo: 'L02' },
      { id: 'b3', productId: 'p1', batchNo: 'L03' },
    ];

    // Lô mới nhất (tr3: 2026-01-03) -> 12, tr2 (2026-01-02) -> 10, tr1 (2026-01-01) -> 8 (Tăng liên tục)
    const mockTestResults = [
      {
        id: 'tr1', batchId: 'b1', overallStatus: 'PASS', testDate: '2026-01-01',
        results: [{ criteriaName: 'Độ ẩm', value: '8.0' }]
      },
      {
        id: 'tr2', batchId: 'b2', overallStatus: 'PASS', testDate: '2026-01-02',
        results: [{ criteriaName: 'Độ ẩm', value: '10.0' }]
      },
      {
        id: 'tr3', batchId: 'b3', overallStatus: 'PASS', testDate: '2026-01-03',
        results: [{ criteriaName: 'Độ ẩm', value: '12.0' }]
      },
    ];

    const anomalies = detectQualityAnomalies({
      products: mockProducts,
      batches: mockBatches,
      testResults: mockTestResults,
    });

    const driftAlerts = anomalies.filter(a => a.type === 'DRIFT');
    expect(driftAlerts.length).toBe(1);
    expect(driftAlerts[0].title).toContain('Độ ẩm');
  });
});
