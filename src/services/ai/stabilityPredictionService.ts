/**
 * stabilityPredictionService.ts
 * ==============================
 * Dịch vụ dự báo xu hướng suy giảm hàm lượng và độ ổn định chất lượng (Stability & Shelf-Life Forecasting).
 * Sử dụng động học phân hủy (Kinetics) và Hồi quy tuyến tính để dự báo thời gian còn lại trước khi vi phạm TCCS.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey, getGeminiModel } from './geminiService';
import { TestResult, Batch, Product, TCCS } from '../../types';

export interface StabilityDataPoint {
  batchNo: string;
  mfgDate?: string;
  testDate: string;
  timeMonths: number; // Số tháng kể từ ngày sản xuất
  value: number;
}

export interface CriteriaStabilityForecast {
  criteriaName: string;
  unit: string;
  minLimit?: number;
  maxLimit?: number;
  initialValue: number;
  latestValue: number;
  decayRatePerMonth: number; // Tốc độ suy giảm / tháng (% hoặc đơn vị tuyệt đối)
  rSquared: number; // Hệ số tương quan R2
  projectedMonthToMinLimit?: number; // Số tháng dự kiến sẽ chạm ngưỡng Min
  shelfLifeMonths: number; // Hạn dùng thiết kế (ví dụ 24, 36 tháng)
  riskLevel: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_EXPIRY_RISK';
  recommendation: string;
  dataPoints: StabilityDataPoint[];
}

export interface StabilityPredictionReport {
  productId: string;
  productName: string;
  analyzedBatchesCount: number;
  forecasts: CriteriaStabilityForecast[];
  executiveSummary: string;
  generatedAt: string;
}

/**
 * Tính số tháng giữa 2 ngày (ISO date string YYYY-MM-DD hoặc DD/MM/YYYY)
 */
export const calculateMonthsBetween = (startDateStr: string, endDateStr: string): number => {
  try {
    const parse = (s: string) => {
      if (s.includes('/')) {
        const [d, m, y] = s.split('/');
        return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
      }
      return new Date(s);
    };

    const d1 = parse(startDateStr);
    const d2 = parse(endDateStr);
    const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + (d2.getDate() - d1.getDate()) / 30.4375;
    return Math.max(0, Math.round(months * 10) / 10);
  } catch {
    return 0;
  }
};

/**
 * Tính toán hồi quy tuyến tính (Linear Regression)
 * y = a + b * x
 */
export const linearRegression = (points: { x: number; y: number }[]) => {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0, rSquared: 1 };

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;

  // Tính R-squared
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (const p of points) {
    const yPred = intercept + slope * p.x;
    ssTot += Math.pow(p.y - meanY, 2);
    ssRes += Math.pow(p.y - yPred, 2);
  }
  const rSquared = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return {
    slope: Math.round(slope * 10000) / 10000,
    intercept: Math.round(intercept * 100) / 100,
    rSquared: Math.round(rSquared * 100) / 100
  };
};

/**
 * Phân tích và dự báo độ ổn định của sản phẩm từ lịch sử dữ liệu
 */
export const predictProductStability = (
  product: Product,
  batches: Batch[],
  testResults: TestResult[],
  tccs?: TCCS,
  defaultShelfLifeMonths = 24
): StabilityPredictionReport => {
  const productBatches = batches.filter(b => b.productId === product.id);
  const batchIdMap = new Map(productBatches.map(b => [b.id, b]));

  // Lọc các kết quả kiểm nghiệm của sản phẩm này
  const relevantResults = testResults.filter(tr => batchIdMap.has(tr.batchId));

  // Gom nhóm dữ liệu theo từng chỉ tiêu
  const criteriaDataMap = new Map<string, StabilityDataPoint[]>();

  relevantResults.forEach(tr => {
    const batch = batchIdMap.get(tr.batchId);
    if (!batch) return;
    const mfgDate = batch.mfgDate;
    const testDate = tr.testDate;
    const timeMonths = mfgDate && testDate ? calculateMonthsBetween(mfgDate, testDate) : 0;

    tr.results.forEach(entry => {
      const numVal = parseFloat(String(entry.value).replace(',', '.'));
      if (!isNaN(numVal)) {
        const list = criteriaDataMap.get(entry.criteriaName) || [];
        list.push({
          batchNo: batch.batchNo,
          mfgDate,
          testDate,
          timeMonths,
          value: numVal
        });
        criteriaDataMap.set(entry.criteriaName, list);
      }
    });
  });

  const allCriteria = [...(tccs?.mainQualityCriteria || []), ...(tccs?.safetyCriteria || [])];
  const forecasts: CriteriaStabilityForecast[] = [];

  criteriaDataMap.forEach((points, criteriaName) => {
    if (points.length < 2) return;

    // Sắp xếp điểm theo thời gian
    points.sort((a, b) => a.timeMonths - b.timeMonths);

    const regPoints = points.map(p => ({ x: p.timeMonths, y: p.value }));
    const reg = linearRegression(regPoints);

    const tccsCrit = allCriteria.find(c => c.name.toLowerCase() === criteriaName.toLowerCase());
    const minLimit = tccsCrit?.min;
    const maxLimit = tccsCrit?.max;
    const unit = tccsCrit?.unit || points[0]?.value ? '%' : '';

    const initialValue = points[0].value;
    const latestValue = points[points.length - 1].value;
    const decayRate = -reg.slope; // tốc độ giảm dương nếu slope âm

    let projectedMonthToMinLimit: number | undefined = undefined;
    let riskLevel: CriteriaStabilityForecast['riskLevel'] = 'LOW_RISK';
    let recommendation = 'Chỉ tiêu duy trì độ ổn định tốt trong hạn dùng thiết kế.';

    // Nếu chỉ tiêu có xu hướng giảm và có giới hạn Min
    if (reg.slope < 0 && minLimit !== undefined) {
      // minLimit = intercept + slope * t => t = (minLimit - intercept) / slope
      const monthsToMin = (minLimit - reg.intercept) / reg.slope;
      if (monthsToMin > 0) {
        projectedMonthToMinLimit = Math.round(monthsToMin * 10) / 10;

        if (projectedMonthToMinLimit <= defaultShelfLifeMonths) {
          riskLevel = 'HIGH_EXPIRY_RISK';
          recommendation = `CẢNH BÁO: Tốc độ suy giảm (${Math.abs(reg.slope * 12).toFixed(1)}${unit}/năm) có nguy cơ làm chỉ tiêu rơi dưới giới hạn Min (${minLimit}${unit}) vào tháng thứ ${projectedMonthToMinLimit}, trước hạn dùng ${defaultShelfLifeMonths} tháng.`;
        } else if (projectedMonthToMinLimit <= defaultShelfLifeMonths * 1.25) {
          riskLevel = 'MODERATE_RISK';
          recommendation = `Lưu ý: Chỉ tiêu suy giảm đều theo thời gian. Dự kiến chạm ngưỡng Min sau ${projectedMonthToMinLimit} tháng. Cần theo dõi thêm ở mốc kiểm nghiệm tiếp theo.`;
        }
      }
    }

    forecasts.push({
      criteriaName,
      unit,
      minLimit,
      maxLimit,
      initialValue,
      latestValue,
      decayRatePerMonth: Math.round(decayRate * 1000) / 1000,
      rSquared: reg.rSquared,
      projectedMonthToMinLimit,
      shelfLifeMonths: defaultShelfLifeMonths,
      riskLevel,
      recommendation,
      dataPoints: points
    });
  });

  const highRiskCount = forecasts.filter(f => f.riskLevel === 'HIGH_EXPIRY_RISK').length;
  const modRiskCount = forecasts.filter(f => f.riskLevel === 'MODERATE_RISK').length;

  let summary = `Đã phân tích xu hướng độ ổn định của ${product.name} trên ${forecasts.length} chỉ tiêu từ ${relevantResults.length} phiếu kiểm nghiệm. `;
  if (highRiskCount > 0) {
    summary += `Phát hiện ${highRiskCount} chỉ tiêu có nguy cơ vi phạm tiêu chuẩn trước hạn dùng.`;
  } else if (modRiskCount > 0) {
    summary += `Có ${modRiskCount} chỉ tiêu cần chú ý theo dõi độ trôi.`;
  } else {
    summary += `Tất cả các chỉ tiêu đều có hồ sơ ổn định tốt.`;
  }

  return {
    productId: product.id,
    productName: product.name,
    analyzedBatchesCount: productBatches.length,
    forecasts,
    executiveSummary: summary,
    generatedAt: new Date().toISOString()
  };
};

/**
 * Gọi AI sinh báo cáo phân tích độ ổn định nâng cao
 */
export const generateStabilityForecastWithAI = async (
  report: StabilityPredictionReport
): Promise<StabilityPredictionReport> => {
  const apiKey = getApiKey();
  if (!apiKey) return report;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: getGeminiModel() });

    const prompt = `
Bạn là Chuyên gia Thẩm định Độ ổn định Thuốc (Stability & Shelf-life Specialist) theo hướng dẫn ICH Q1A(R2) và Dược điển Việt Nam V.
Hãy phân tích dữ liệu động học suy giảm chất lượng của sản phẩm sau:

SẢN PHẨM: ${report.productName}
DỮ LIỆU DỰ BÁO:
${JSON.stringify(report.forecasts.map(f => ({
  criteria: f.criteriaName,
  initial: f.initialValue,
  latest: f.latestValue,
  decayRatePerMonth: f.decayRatePerMonth,
  r2: f.rSquared,
  minLimit: f.minLimit,
  projectedMonthToMin: f.projectedMonthToMinLimit,
  shelfLife: f.shelfLifeMonths,
  risk: f.riskLevel
})), null, 2)}

YÊU CẦU:
1. Đánh giá tính phù hợp của hạn sử dụng hiện tại.
2. Nêu rõ các yếu tố môi trường (nhiệt độ, độ ẩm, ánh sáng, bao bì) có thể đẩy nhanh tốc độ phân hủy của các chỉ tiêu có rủi ro.
3. Đề xuất điều chỉnh công thức (tăng tỷ lệ bù hao hụt - overage) hoặc điều kiện bảo quản nếu cần thiết.
4. Trả về nhận định tóm tắt súc tích (1 đoạn văn Markdown).
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (text) {
      report.executiveSummary = text.trim();
    }
  } catch (err) {
    console.warn('AI Stability Forecast fallback:', err);
  }

  return report;
};
