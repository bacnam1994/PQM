/**
 * AnalyticsAggregationService.ts
 * =======================================================
 * Dịch vụ tổng hợp thống kê & phân tích chất lượng (SPC/Analytics).
 * Kiến trúc:
 * UI -> Analytics Hook -> Aggregation Service -> SPC Engine
 *
 * Ngăn chặn:
 * - UI tải toàn bộ 50.000 testResults vào browser gây tràn RAM/freeze giao diện.
 * - Tính toán lặp đi lặp lại không memoize.
 *
 * Cung cấp:
 * 1. Single-pass Statistical Aggregation (Cp, Cpk, Pp, Ppk, Cpm, Nelson Rules 1-8).
 * 2. OOS (Out of Spec) & OOT (Out of Trend) detection dựa trên hồi quy tuyến tính.
 * 3. Phân bố tần suất (Histogram Distribution) theo chuẩn Scott/Sturges rule.
 * 4. Thuật toán gom mẫu / Downsampling (LTTB - Largest Triangle Three Buckets)
 *    khi vẽ biểu đồ > 1.000 điểm để bảo vệ DOM/Canvas không bị đơ.
 */

import {
  calcMean,
  calcStdDev,
  calcWithinStdDev,
  calcProcessCapability,
  detectNelsonRules,
  calculateSPCParameters,
  SPCParameters,
  ProcessCapabilityResult,
  NelsonViolation,
} from '../../utils/spcEngine';

export interface DataPoint {
  value: number;
  timestamp?: number | string;
  batchNo?: string;
  id?: string;
}

export interface AggregatedDistributionBin {
  binStart: number;
  binEnd: number;
  label: string;
  count: number;
  frequency: number; // Tỷ lệ %
}

export interface TrendAnalysis {
  slope: number;
  intercept: number;
  rSquared: number;
  direction: 'UPWARD' | 'DOWNWARD' | 'STABLE';
}

export interface SPCAnalyticsReport {
  sampleSize: number;
  parameters: SPCParameters;
  capability: ProcessCapabilityResult;
  violations: NelsonViolation[];
  violationsCount: number;
  oosCount: number;
  oosRatePercent: number;
  ootCount: number;
  ootRatePercent: number;
  trend: TrendAnalysis;
  distribution: {
    bins: AggregatedDistributionBin[];
    min: number;
    max: number;
    median: number;
  };
  downsampledPoints?: DataPoint[];
  durationMs: number;
}

export interface AnalyticsOptions {
  usl?: number;
  lsl?: number;
  target?: number;
  maxChartPoints?: number; // Mặc định 500 điểm khi hiển thị biểu đồ
  confidenceLevel?: number; // Mặc định 0.95
}

export class AnalyticsAggregationService {
  /**
   * Tính toán toàn diện báo cáo SPC & phân tích xu hướng
   */
  public static aggregateSeries(
    points: (DataPoint | number)[],
    options: AnalyticsOptions = {}
  ): SPCAnalyticsReport {
    const startTime = performance.now();

    // 1. Chuẩn hóa dữ liệu & lọc giá trị không hợp lệ
    const normalizedPoints: DataPoint[] = [];
    const values: number[] = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const val = typeof p === 'number' ? p : p.value;
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        values.push(val);
        normalizedPoints.push(typeof p === 'number' ? { value: val } : p);
      }
    }

    const n = values.length;
    const usl = options.usl;
    const lsl = options.lsl;
    const target = options.target;

    // 2. Tính toán SPC & Năng lực quá trình (Cp, Cpk, Pp, Ppk)
    const parameters = calculateSPCParameters(values);
    const capability = calcProcessCapability(values, usl, lsl, target);
    const effectiveSigma =
      parameters.stdDevWithin > 0 ? parameters.stdDevWithin : parameters.stdDevOverall;
    const violations = detectNelsonRules(values, parameters.mean, effectiveSigma);

    // 3. Đếm Out of Specification (OOS)
    let oosCount = 0;
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (usl !== undefined && v > usl) oosCount++;
      else if (lsl !== undefined && v < lsl) oosCount++;
    }
    const oosRatePercent = n > 0 ? Number(((oosCount / n) * 100).toFixed(2)) : 0;

    // 4. Phân tích Xu hướng (Linear Regression: y = slope * x + intercept)
    const trend = this.calculateLinearTrend(values);

    // 5. Phát hiện Out of Trend (OOT): Điểm lệch > 2 sigma so với đường xu hướng dự báo
    let ootCount = 0;
    if (n >= 5 && effectiveSigma > 0) {
      for (let i = 0; i < n; i++) {
        const expectedY = trend.slope * i + trend.intercept;
        const residual = Math.abs(values[i] - expectedY);
        if (residual > 2 * effectiveSigma) {
          ootCount++;
        }
      }
    }
    const ootRatePercent = n > 0 ? Number(((ootCount / n) * 100).toFixed(2)) : 0;

    // 6. Phân bố tần suất Histogram (Scott/Sturges rule)
    const distribution = this.calculateDistribution(values);

    // 7. LTTB Downsampling nếu số lượng điểm lớn hơn maxChartPoints
    const maxPoints = options.maxChartPoints || 500;
    let downsampledPoints: DataPoint[] | undefined;
    if (n > maxPoints) {
      downsampledPoints = this.downsampleLTTB(normalizedPoints, maxPoints);
    } else {
      downsampledPoints = normalizedPoints;
    }

    const durationMs = Number((performance.now() - startTime).toFixed(2));

    return {
      sampleSize: n,
      parameters,
      capability,
      violations,
      violationsCount: violations.length,
      oosCount,
      oosRatePercent,
      ootCount,
      ootRatePercent,
      trend,
      distribution,
      downsampledPoints,
      durationMs,
    };
  }

  /**
   * Hồi quy tuyến tính đơn biến (Least Squares) để tìm trend slope & R²
   */
  public static calculateLinearTrend(values: number[]): TrendAnalysis {
    const n = values.length;
    if (n < 2) {
      return { slope: 0, intercept: values[0] || 0, rSquared: 0, direction: 'STABLE' };
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    let sumYY = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = values[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
      sumYY += y * y;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) {
      return {
        slope: 0,
        intercept: Number((sumY / n).toFixed(4)),
        rSquared: 0,
        direction: 'STABLE',
      };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // Tính hệ số tương quan R² (Coefficient of Determination)
    const totalSS = sumYY - (sumY * sumY) / n;
    const regressionSS = slope * (sumXY - (sumX * sumY) / n);
    const rSquared = totalSS > 0 ? Math.max(0, Math.min(1, regressionSS / totalSS)) : 0;

    let direction: TrendAnalysis['direction'] = 'STABLE';
    // Đánh giá xu hướng nếu độ dốc khác biệt đáng kể
    const mean = sumY / n;
    const relativeSlope = mean !== 0 ? Math.abs(slope / mean) : Math.abs(slope);
    if (relativeSlope > 0.005) {
      direction = slope > 0 ? 'UPWARD' : 'DOWNWARD';
    }

    return {
      slope: Number(slope.toFixed(5)),
      intercept: Number(intercept.toFixed(4)),
      rSquared: Number(rSquared.toFixed(4)),
      direction,
    };
  }

  /**
   * Tính toán phân phối tần suất (Histogram Bins)
   */
  public static calculateDistribution(values: number[]): {
    bins: AggregatedDistributionBin[];
    min: number;
    max: number;
    median: number;
  } {
    const n = values.length;
    if (n === 0) {
      return { bins: [], min: 0, max: 0, median: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[n - 1];
    const median =
      n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : Number(((sorted[n / 2 - 1] + sorted[n / 2]) / 2).toFixed(4));

    if (min === max || n < 3) {
      return {
        bins: [
          {
            binStart: min,
            binEnd: max,
            label: `${min}`,
            count: n,
            frequency: 100,
          },
        ],
        min,
        max,
        median,
      };
    }

    // Quy tắc chọn số lượng bin (Sturges / Rice rule): k = ceil(2 * n^(1/3))
    const numBins = Math.max(5, Math.min(25, Math.ceil(2 * Math.cbrt(n))));
    const binWidth = (max - min) / numBins;

    const bins: AggregatedDistributionBin[] = [];
    for (let b = 0; b < numBins; b++) {
      const bStart = min + b * binWidth;
      const bEnd = b === numBins - 1 ? max : min + (b + 1) * binWidth;
      bins.push({
        binStart: Number(bStart.toFixed(3)),
        binEnd: Number(bEnd.toFixed(3)),
        label: `${bStart.toFixed(2)} - ${bEnd.toFixed(2)}`,
        count: 0,
        frequency: 0,
      });
    }

    for (let i = 0; i < n; i++) {
      const v = sorted[i];
      let placed = false;
      for (let b = 0; b < numBins; b++) {
        const isLast = b === numBins - 1;
        if ((v >= bins[b].binStart && v < bins[b].binEnd) || (isLast && v <= bins[b].binEnd)) {
          bins[b].count++;
          placed = true;
          break;
        }
      }
      if (!placed) {
        bins[numBins - 1].count++;
      }
    }

    for (let b = 0; b < numBins; b++) {
      bins[b].frequency = Number(((bins[b].count / n) * 100).toFixed(2));
    }

    return { bins, min, max, median };
  }

  /**
   * Thuật toán gom mẫu LTTB (Largest Triangle Three Buckets)
   * Giữ nguyên biên dạng đặc trưng và các điểm cực trị khi nén từ 50.000 điểm xuống 500 điểm.
   */
  public static downsampleLTTB(data: DataPoint[], threshold: number): DataPoint[] {
    if (threshold >= data.length || threshold <= 2) {
      return data;
    }

    const sampled: DataPoint[] = [];
    const bucketSize = (data.length - 2) / (threshold - 2);

    let a = 0;
    sampled.push(data[a]);

    for (let i = 0; i < threshold - 2; i++) {
      let avgX = 0;
      let avgY = 0;
      const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
      const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

      const avgRangeLength = avgRangeEnd - avgRangeStart;
      for (let j = avgRangeStart; j < avgRangeEnd; j++) {
        avgX += j;
        avgY += data[j].value;
      }
      avgX /= avgRangeLength || 1;
      avgY /= avgRangeLength || 1;

      const rangeOffs = Math.floor(i * bucketSize) + 1;
      const rangeTo = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length);

      const pointAX = a;
      const pointAY = data[a].value;

      let maxArea = -1;
      let nextA = rangeOffs;

      for (let j = rangeOffs; j < rangeTo; j++) {
        const area =
          Math.abs(
            (pointAX - avgX) * (data[j].value - pointAY) - (pointAX - j) * (avgY - pointAY)
          ) * 0.5;

        if (area > maxArea) {
          maxArea = area;
          nextA = j;
        }
      }

      sampled.push(data[nextA]);
      a = nextA;
    }

    sampled.push(data[data.length - 1]);
    return sampled;
  }
}
