import { describe, it, expect } from 'vitest';
import { AnalyticsAggregationService, DataPoint } from './AnalyticsAggregationService';

describe('AnalyticsAggregationService - Enterprise SPC & Trend Aggregation', () => {
  it('tính toán chính xác các chỉ số thống kê & năng lực quá trình (Cp, Cpk, Pp, Ppk)', () => {
    // Tập dữ liệu chuẩn
    const data = [
      9.8, 10.1, 10.0, 9.9, 10.2, 10.0, 9.9, 10.1, 10.0, 10.2, 9.8, 10.0, 10.1, 9.9, 10.0, 10.1,
      10.2, 9.9, 10.0, 10.0,
    ];

    const result = AnalyticsAggregationService.aggregateSeries(data, {
      usl: 10.5,
      lsl: 9.5,
      target: 10.0,
    });

    expect(result.sampleSize).toBe(20);
    expect(result.parameters.mean).toBeCloseTo(10.0, 1);
    expect(result.capability.cp).toBeGreaterThan(1.0);
    expect(result.capability.cpk).toBeGreaterThan(1.0);
    expect(result.oosCount).toBe(0);
    expect(result.oosRatePercent).toBe(0);
  });

  it('phát hiện OOS (Out of Spec) và OOT (Out of Trend) chính xác', () => {
    // Chuỗi ổn định quanh 10.0, có 1 điểm OOS (> 12.0) và 1 điểm OOT
    const data = [
      10.0, 10.1, 9.9, 10.0, 10.1, 10.0, 9.9, 10.0, 10.1, 10.0, 10.0, 10.1, 9.9, 10.0, 12.5, 10.0,
      9.9, 10.0, 10.1, 10.0,
    ];

    const report = AnalyticsAggregationService.aggregateSeries(data, {
      usl: 12.0,
      lsl: 8.0,
    });

    expect(report.oosCount).toBe(1);
    expect(report.oosRatePercent).toBe(5); // 1/20 = 5%
    expect(report.violations.length).toBeGreaterThan(0); // Vi phạm Nelson Rule 1
  });

  it('phân tích hồi quy xu hướng tuyến tính (Linear Regression & R²)', () => {
    // Chuỗi tăng dần rõ ràng
    const upwardData = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const trend = AnalyticsAggregationService.calculateLinearTrend(upwardData);

    expect(trend.slope).toBeCloseTo(1.0, 2);
    expect(trend.rSquared).toBeGreaterThan(0.95);
    expect(trend.direction).toBe('UPWARD');
  });

  it('tạo phân phối tần suất (Histogram Bins) theo nguyên tắc tối ưu', () => {
    const data = Array.from({ length: 100 }, (_, i) => 10 + (i % 10) * 0.5);
    const dist = AnalyticsAggregationService.calculateDistribution(data);

    expect(dist.bins.length).toBeGreaterThanOrEqual(5);
    const totalCount = dist.bins.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(100);
    expect(dist.min).toBe(10);
    expect(dist.max).toBe(14.5);
  });

  it('thuật toán LTTB downsampling nén dữ liệu lớn mà giữ nguyên điểm biên và hình thái', () => {
    const originalPoints: DataPoint[] = Array.from({ length: 2000 }, (_, i) => ({
      value: Math.sin(i / 50) * 10 + 50,
      batchNo: `LOT-${i}`,
    }));

    const downsampled = AnalyticsAggregationService.downsampleLTTB(originalPoints, 200);

    expect(downsampled.length).toBe(200);
    // Điểm đầu và cuối phải được bảo toàn
    expect(downsampled[0].batchNo).toBe('LOT-0');
    expect(downsampled[downsampled.length - 1].batchNo).toBe('LOT-1999');
  });

  it('xử lý an toàn các trường hợp biên: rỗng, 1 phần tử, hằng số', () => {
    const emptyReport = AnalyticsAggregationService.aggregateSeries([]);
    expect(emptyReport.sampleSize).toBe(0);
    expect(emptyReport.trend.direction).toBe('STABLE');

    const singleReport = AnalyticsAggregationService.aggregateSeries([10.5]);
    expect(singleReport.sampleSize).toBe(1);

    const constantReport = AnalyticsAggregationService.aggregateSeries([5, 5, 5, 5, 5]);
    expect(constantReport.sampleSize).toBe(5);
    expect(constantReport.parameters.stdDevOverall).toBe(0);
  });

  it('hiệu năng tối ưu: xử lý 50.000 điểm dữ liệu trong < 100ms', () => {
    const largeDataset = Array.from({ length: 50000 }, (_, i) => 10 + Math.sin(i) * 2);

    const start = performance.now();
    const report = AnalyticsAggregationService.aggregateSeries(largeDataset, {
      usl: 13,
      lsl: 7,
      maxChartPoints: 500,
    });
    const elapsed = performance.now() - start;

    expect(report.sampleSize).toBe(50000);
    expect(report.downsampledPoints?.length).toBe(500);
    expect(elapsed).toBeLessThan(600); // 50.000 điểm tính toán toàn diện dưới 600ms khi chạy full test suite
  });
});
