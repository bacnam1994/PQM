import { parseNumberFromText } from './criteriaEvaluation';

export type OOTRuleType = 'MONOTONIC_DRIFT' | 'NEAR_SPEC_LIMIT' | 'SIGMA_SHIFT' | 'HIGH_VARIABILITY';

export interface OOTAnomaly {
  type: OOTRuleType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  criteriaName: string;
  affectedBatches: string[];
  currentValue: number;
  expectedRange?: string;
  historicalMean?: number;
  consecutiveCount?: number;
  recommendation: string;
}

export interface BatchCriterionDataPoint {
  batchId: string;
  batchNo: string;
  testDate: string;
  value: number | string;
  criteriaName: string;
  unit?: string;
  minLimit?: number;
  maxLimit?: number;
}

/**
 * Tính toán độ lệch chuẩn (Standard Deviation)
 */
export const calculateStandardDeviation = (values: number[]): { mean: number; stdDev: number } => {
  if (!values || values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (values.length === 1) return { mean, stdDev: 0 };
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return { mean, stdDev: Math.sqrt(variance) };
};

/**
 * Thuật toán phát hiện xu hướng trôi chỉ tiêu chất lượng (Out-of-Trend - OOT)
 * Chuẩn phân tích dữ liệu Dược phẩm (Nelson / Western Electric Rules)
 */
export const detectOOTForCriterion = (
  criteriaName: string,
  dataPoints: BatchCriterionDataPoint[],
  specs?: { minLimit?: number; maxLimit?: number; declaredValue?: number }
): OOTAnomaly[] => {
  const anomalies: OOTAnomaly[] = [];

  // Lọc và sắp xếp theo ngày kiểm nghiệm / sản xuất tăng dần
  const validPoints = dataPoints
    .map(p => {
      const num = typeof p.value === 'number' ? p.value : parseNumberFromText(String(p.value));
      return { ...p, numericValue: num };
    })
    .filter(p => !isNaN(p.numericValue) && isFinite(p.numericValue))
    .sort((a, b) => (a.testDate || '').localeCompare(b.testDate || ''));

  if (validPoints.length < 3) {
    return anomalies; // Cần ít nhất 3 lô để phân tích xu hướng
  }

  const numericValues = validPoints.map(p => p.numericValue);
  const { mean, stdDev } = calculateStandardDeviation(numericValues);
  const latestPoint = validPoints[validPoints.length - 1];
  const latestVal = latestPoint.numericValue;

  const minLim = specs?.minLimit ?? latestPoint.minLimit;
  const maxLim = specs?.maxLimit ?? latestPoint.maxLimit;

  // -------------------------------------------------------------
  // RULE 1: Xu hướng trôi đơn điệu liên tiếp (Monotonic Trend >= 3 lô)
  // -------------------------------------------------------------
  if (validPoints.length >= 3) {
    const recentPoints = validPoints.slice(-5); // Xét tối đa 5 lô gần nhất
    let decreasingCount = 1;
    let increasingCount = 1;

    for (let i = recentPoints.length - 1; i > 0; i--) {
      if (recentPoints[i].numericValue < recentPoints[i - 1].numericValue) {
        decreasingCount++;
      } else {
        break;
      }
    }

    for (let i = recentPoints.length - 1; i > 0; i--) {
      if (recentPoints[i].numericValue > recentPoints[i - 1].numericValue) {
        increasingCount++;
      } else {
        break;
      }
    }

    if (decreasingCount >= 3) {
      const affected = recentPoints.slice(-decreasingCount).map(p => p.batchNo);
      anomalies.push({
        type: 'MONOTONIC_DRIFT',
        severity: decreasingCount >= 4 ? 'HIGH' : 'MEDIUM',
        title: `Xu hướng suy giảm liên tiếp ${decreasingCount} lô`,
        description: `Chỉ tiêu "${criteriaName}" liên tục giảm dần qua ${decreasingCount} lô gần nhất (${affected.join(' ➔ ')}), giá trị hiện tại: ${latestVal}.`,
        criteriaName,
        affectedBatches: affected,
        currentValue: latestVal,
        consecutiveCount: decreasingCount,
        historicalMean: Number(mean.toFixed(3)),
        recommendation: 'Kiểm tra độ suy giảm hoạt chất nguyên liệu đầu vào, thông số sấy/trộn và điều kiện bảo quản bán thành phẩm.',
      });
    } else if (increasingCount >= 3) {
      const affected = recentPoints.slice(-increasingCount).map(p => p.batchNo);
      anomalies.push({
        type: 'MONOTONIC_DRIFT',
        severity: increasingCount >= 4 ? 'HIGH' : 'MEDIUM',
        title: `Xu hướng gia tăng liên tiếp ${increasingCount} lô`,
        description: `Chỉ tiêu "${criteriaName}" liên tục tăng dần qua ${increasingCount} lô gần nhất (${affected.join(' ➔ ')}), giá trị hiện tại: ${latestVal}.`,
        criteriaName,
        affectedBatches: affected,
        currentValue: latestVal,
        consecutiveCount: increasingCount,
        historicalMean: Number(mean.toFixed(3)),
        recommendation: 'Kiểm tra độ tích tụ sai số cân chia, độ đồng đều khối lượng hoặc độ bay hơi dung môi trong pha chế.',
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 2: Cảnh báo tiệm cận biên giới hạn (Near-Spec Limit Warning: cận 5%)
  // -------------------------------------------------------------
  if (minLim !== undefined && maxLim !== undefined && maxLim > minLim) {
    const range = maxLim - minLim;
    const lowerBuffer = minLim + range * 0.08; // Vùng nguy hiểm sát biên dưới 8%
    const upperBuffer = maxLim - range * 0.08; // Vùng nguy hiểm sát biên trên 8%

    if (latestVal <= lowerBuffer && latestVal >= minLim) {
      anomalies.push({
        type: 'NEAR_SPEC_LIMIT',
        severity: 'HIGH',
        title: 'Tiệm cận giới hạn dưới TCCS',
        description: `Giá trị lô ${latestPoint.batchNo} đạt ${latestVal}, chỉ cách giới hạn dưới (${minLim}) một khoảng rất nhỏ (dưới 8% dung sai).`,
        criteriaName,
        affectedBatches: [latestPoint.batchNo],
        currentValue: latestVal,
        expectedRange: `${minLim} ~ ${maxLim}`,
        recommendation: 'Cần hiệu chỉnh ngay tỷ lệ bổ sung hao hụt (overage) hoặc rà soát độ ẩm/tạp chất để tránh lô kế tiếp rớt tiêu chuẩn.',
      });
    } else if (latestVal >= upperBuffer && latestVal <= maxLim) {
      anomalies.push({
        type: 'NEAR_SPEC_LIMIT',
        severity: 'MEDIUM',
        title: 'Tiệm cận giới hạn trên TCCS',
        description: `Giá trị lô ${latestPoint.batchNo} đạt ${latestVal}, đang tiến sát trần tối đa cho phép (${maxLim}).`,
        criteriaName,
        affectedBatches: [latestPoint.batchNo],
        currentValue: latestVal,
        expectedRange: `${minLim} ~ ${maxLim}`,
        recommendation: 'Kiểm tra hàm lượng nguyên liệu thực tế và độ chính xác của cân nạp hoạt chất.',
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 3: Dịch chuyển thống kê 2-Sigma (2-Sigma Statistical Shift)
  // -------------------------------------------------------------
  if (validPoints.length >= 5 && stdDev > 0) {
    const zScore = Math.abs(latestVal - mean) / stdDev;
    if (zScore >= 2.0 && zScore < 3.0) {
      anomalies.push({
        type: 'SIGMA_SHIFT',
        severity: 'MEDIUM',
        title: 'Độ lệch bất thường > 2-Sigma',
        description: `Lô ${latestPoint.batchNo} có kết quả ${latestVal}, lệch ${zScore.toFixed(1)}σ so với giá trị trung bình lịch sử (${mean.toFixed(2)} ± ${stdDev.toFixed(2)}).`,
        criteriaName,
        affectedBatches: [latestPoint.batchNo],
        currentValue: latestVal,
        historicalMean: Number(mean.toFixed(3)),
        recommendation: 'Đối chiếu phương pháp phân tích, người thực hiện kiểm nghiệm hoặc xem xét sự thay đổi nhà cung ứng nguyên liệu.',
      });
    }
  }

  return anomalies;
};
