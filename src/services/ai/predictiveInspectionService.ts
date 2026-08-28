/**
 * predictiveInspectionService.ts
 * ================================
 * AI Predictive Incoming Inspection — Dự báo xác suất PASS/FAIL.
 * 
 * Phân tích historical data để dự báo nguy cơ chất lượng TRƯỚC KHI
 * có kết quả kiểm nghiệm, giúp QA ưu tiên nguồn lực kiểm tra.
 * 
 * Thuật toán đa nhân tố:
 * 1. Lịch sử phòng lab (Lab Track Record)
 * 2. Xu hướng mùa vụ của sản phẩm (Seasonal Pattern)
 * 3. Phát hiện drift Nelson Rules (Trend Detection)
 * 4. So sánh tương đồng lô (Batch Similarity)
 */

export interface CriterionRiskFactor {
  criteriaName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;    // 0-100
  reason: string;
  recentValues?: (string | number)[];
  trend?: 'INCREASING' | 'DECREASING' | 'STABLE' | 'OSCILLATING';
}

export interface PredictiveInspectionReport {
  batchId: string;
  batchNo: string;
  productName: string;
  generatedAt: string;

  // Điểm dự báo tổng thể
  overallPassProbability: number;       // 0-100%
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';  // Mức tin cậy
  confidenceReason: string;

  // Các yếu tố rủi ro
  riskFactors: {
    labPerformance: { score: number; label: string; detail: string };
    seasonalPattern: { score: number; label: string; detail: string };
    trendDrift: { score: number; label: string; detail: string };
    historicalSimilarity: { score: number; label: string; detail: string };
  };

  // Chỉ tiêu có rủi ro cao nhất
  highRiskCriteria: CriterionRiskFactor[];

  // Khuyến nghị
  recommendations: string[];
  actionPriority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

  summary: string;
  disclaimer: string;
}

interface PredictiveContext {
  batch: any;
  product?: any;
  tccs?: any;
  productTestResults: any[];    // Tất cả kết quả của sản phẩm này
  allBatches: any[];
}

const countTotalSamples = (ctx: PredictiveContext) =>
  ctx.productTestResults.length;

// ─────────────────────────────────────────────
// FACTOR 1: Lab Track Record
// Tỷ lệ FAIL của phòng lab liên quan
// ─────────────────────────────────────────────

const calcLabPerformanceFactor = (ctx: PredictiveContext): { score: number; label: string; detail: string } => {
  const labName = ctx.batch.labName || 'Nội bộ';
  
  // Tìm các phiếu cùng lab
  const labResults = ctx.productTestResults.filter(r => r.labName === labName);
  
  if (labResults.length === 0) {
    return {
      score: 70,
      label: 'Chưa có dữ liệu lab',
      detail: `Không có lịch sử kiểm nghiệm với "${labName}" cho sản phẩm này.`,
    };
  }

  const passCount = labResults.filter(r => r.overallStatus === 'PASS').length;
  const passRate = (passCount / labResults.length) * 100;

  return {
    score: passRate,
    label: passRate >= 90 ? '✅ Lab uy tín' : passRate >= 70 ? '⚠️ Cần chú ý' : '🔴 Tỷ lệ thất bại cao',
    detail: `"${labName}": ${passCount}/${labResults.length} phiếu ĐẠT (${passRate.toFixed(1)}%) trong lịch sử.`,
  };
};

// ─────────────────────────────────────────────
// FACTOR 2: Seasonal Pattern
// Xu hướng chất lượng theo tháng/quý
// ─────────────────────────────────────────────

const calcSeasonalFactor = (ctx: PredictiveContext): { score: number; label: string; detail: string } => {
  if (!ctx.batch.mfgDate) {
    return { score: 75, label: 'Không đủ dữ liệu', detail: 'Không có ngày sản xuất để phân tích mùa vụ.' };
  }

  const batchMonth = new Date(ctx.batch.mfgDate).getMonth() + 1;
  
  // Lọc kết quả cùng tháng
  const sameMonthResults = ctx.productTestResults.filter(r => {
    if (!r.testDate) return false;
    const batch = ctx.allBatches.find((b: any) => b.id === r.batchId);
    if (!batch?.mfgDate) return false;
    return new Date(batch.mfgDate).getMonth() + 1 === batchMonth;
  });

  if (sameMonthResults.length < 2) {
    return {
      score: 75,
      label: 'Dữ liệu mùa vụ ít',
      detail: `Chưa đủ dữ liệu tháng ${batchMonth} để phân tích (< 2 mẫu).`,
    };
  }

  const passCount = sameMonthResults.filter(r => r.overallStatus === 'PASS').length;
  const passRate = (passCount / sameMonthResults.length) * 100;

  return {
    score: passRate,
    label: passRate >= 85 ? `📅 Tháng ${batchMonth} tốt` : passRate >= 65 ? `⚠️ Tháng ${batchMonth} rủi ro` : `🔴 Tháng ${batchMonth} nguy hiểm`,
    detail: `Lịch sử tháng ${batchMonth}: ${passCount}/${sameMonthResults.length} phiếu ĐẠT (${passRate.toFixed(1)}%).`,
  };
};

// ─────────────────────────────────────────────
// FACTOR 3: Trend Drift (Nelson Rules simplified)
// Phát hiện xu hướng trong chuỗi dữ liệu gần nhất
// ─────────────────────────────────────────────

const calcTrendDriftFactor = (ctx: PredictiveContext): { score: number; label: string; detail: string } => {
  // Lấy 10 kết quả gần nhất
  const recentResults = ctx.productTestResults
    .sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''))
    .slice(0, 10);

  if (recentResults.length < 4) {
    return { score: 75, label: 'Dữ liệu xu hướng ít', detail: `Chỉ có ${recentResults.length} phiếu gần nhất (cần ≥ 4).` };
  }

  const statuses = recentResults.map(r => r.overallStatus === 'PASS' ? 1 : 0);
  const recentPassRate = statuses.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const olderPassRate = statuses.slice(3).reduce((a, b) => a + b, 0) / Math.max(statuses.slice(3).length, 1);

  // Nelson Rule: 3 consecutive fail
  const last3 = statuses.slice(0, 3);
  if (last3.every(s => s === 0)) {
    return {
      score: 15,
      label: '🔴 3 phiếu liên tiếp FAIL',
      detail: '3 phiếu kiểm nghiệm gần nhất đều KHÔNG ĐẠT — dấu hiệu vấn đề nghiêm trọng.',
    };
  }

  const trendDiff = (recentPassRate - olderPassRate) * 100;
  
  if (trendDiff <= -20) {
    return {
      score: Math.max(30, olderPassRate * 100 + trendDiff),
      label: '📉 Xu hướng giảm rõ rệt',
      detail: `Chất lượng gần đây giảm ${Math.abs(trendDiff).toFixed(0)}% so với trước. Xu hướng xấu.`,
    };
  } else if (trendDiff <= -10) {
    return {
      score: Math.max(50, olderPassRate * 100 + trendDiff),
      label: '⚠️ Xu hướng giảm nhẹ',
      detail: `Chất lượng gần đây giảm ${Math.abs(trendDiff).toFixed(0)}%. Cần theo dõi.`,
    };
  } else if (trendDiff >= 10) {
    return {
      score: Math.min(95, olderPassRate * 100 + trendDiff),
      label: '📈 Xu hướng cải thiện',
      detail: `Chất lượng gần đây tốt hơn ${trendDiff.toFixed(0)}% so với trước.`,
    };
  }

  const overallRate = (statuses.reduce((a, b) => a + b, 0) / statuses.length) * 100;
  return {
    score: overallRate,
    label: '➡️ Xu hướng ổn định',
    detail: `Tỷ lệ ĐẠT 10 phiếu gần nhất: ${overallRate.toFixed(1)}%. Không có xu hướng rõ ràng.`,
  };
};

// ─────────────────────────────────────────────
// FACTOR 4: Historical Similarity
// Lô này giống lô nào nhất đã kiểm → dùng kết quả đó làm prior
// ─────────────────────────────────────────────

const calcHistoricalSimilarityFactor = (ctx: PredictiveContext): { score: number; label: string; detail: string } => {
  const batchMonth = ctx.batch.mfgDate ? new Date(ctx.batch.mfgDate).getMonth() + 1 : null;
  
  // Tìm các lô tương đồng: cùng sản phẩm, cùng khoảng mfgDate
  const similarBatches = ctx.allBatches
    .filter((b: any) => {
      if (b.id === ctx.batch.id || b.productId !== ctx.batch.productId) return false;
      if (!b.mfgDate) return false;
      const m = new Date(b.mfgDate).getMonth() + 1;
      return Math.abs((m - (batchMonth || m))) <= 1; // ±1 tháng
    })
    .slice(-5);

  if (similarBatches.length === 0) {
    return { score: 70, label: 'Không có lô tương đồng', detail: 'Không tìm thấy lô lịch sử tương đồng để so sánh.' };
  }

  const similarResults = similarBatches
    .map((b: any) => ctx.productTestResults
      .filter(r => r.batchId === b.id)
      .sort((a: any, bl: any) => (bl.testDate || '').localeCompare(a.testDate || ''))[0])
    .filter(Boolean);

  if (similarResults.length === 0) {
    return { score: 70, label: 'Chưa có kết quả lô tương đồng', detail: 'Các lô tương đồng chưa có phiếu kiểm nghiệm.' };
  }

  const passCount = similarResults.filter((r: any) => r.overallStatus === 'PASS').length;
  const passRate = (passCount / similarResults.length) * 100;

  return {
    score: passRate,
    label: passRate >= 80 ? '✅ Lô tương tự đạt tốt' : passRate >= 60 ? '⚠️ Lô tương tự có lô fail' : '🔴 Lô tương tự fail nhiều',
    detail: `${similarBatches.length} lô tương đồng: ${passCount}/${similarResults.length} ĐẠT (${passRate.toFixed(1)}%).`,
  };
};

// ─────────────────────────────────────────────
// CRITERIA RISK ANALYSIS
// Tìm các chỉ tiêu có xu hướng bất thường
// ─────────────────────────────────────────────

const analyzeHighRiskCriteria = (
  ctx: PredictiveContext,
  tccs: any
): CriterionRiskFactor[] => {
  if (!tccs) return [];

  const mainCriteria = [...(tccs.mainQualityCriteria || []), ...(tccs.safetyCriteria || [])]
    .filter((c: any) => c && c.name && c.type === 'NUMBER');

  return mainCriteria
    .map((criterion: any) => {
      const recentResults = ctx.productTestResults
        .sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''))
        .slice(0, 8);

      const values: number[] = [];
      let failCount = 0;

      recentResults.forEach(r => {
        const entry = (r.results || []).find((res: any) =>
          res.criteriaName?.toLowerCase() === criterion.name?.toLowerCase()
        );
        if (!entry) return;
        const val = parseFloat(String(entry.value).replace(',', '.'));
        if (!isNaN(val)) values.push(val);
        if (!entry.isPass) failCount++;
      });

      if (values.length < 2) return null;

      // Tính xu hướng
      let trend: CriterionRiskFactor['trend'] = 'STABLE';
      if (values.length >= 3) {
        const deltas = values.slice(0, -1).map((v, i) => values[i + 1] - v);
        const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const std = Math.sqrt(deltas.map(d => (d - avgDelta) ** 2).reduce((a, b) => a + b, 0) / deltas.length);
        if (Math.abs(avgDelta) > std * 0.5) {
          trend = avgDelta > 0 ? 'INCREASING' : 'DECREASING';
        } else if (std > Math.abs(avgDelta) * 2) {
          trend = 'OSCILLATING';
        }
      }

      // Tính rủi ro dựa trên khoảng cách tới giới hạn
      const latest = values[0];
      let riskScore = 0;
      let riskReason = '';

      if (criterion.max !== undefined && criterion.min !== undefined) {
        const range = criterion.max - criterion.min;
        const mid = (criterion.max + criterion.min) / 2;
        if (range > 0) {
          const normalizedDist = Math.abs(latest - mid) / (range / 2);
          riskScore = normalizedDist * 100;
          if (normalizedDist > 0.85) riskReason = `Giá trị gần đây (${latest}) tiệm cận ngưỡng giới hạn`;
          else if (normalizedDist > 0.7) riskReason = `Giá trị gần đây (${latest}) ở vùng cảnh báo`;
          else riskReason = `Giá trị gần đây (${latest}) trong vùng an toàn`;
        }
      } else if (criterion.max !== undefined) {
        const ratio = latest / criterion.max;
        riskScore = ratio * 100;
        riskReason = `${latest} / ${criterion.max} = ${(ratio * 100).toFixed(1)}% giới hạn`;
      } else if (criterion.min !== undefined && criterion.min > 0) {
        const ratio = criterion.min / latest;
        riskScore = ratio * 100;
        riskReason = `Cách Min ${criterion.min}: ${(ratio * 100).toFixed(1)}%`;
      }

      if (failCount > 0) riskScore = Math.max(riskScore, failCount / values.length * 100);

      const riskLevel: CriterionRiskFactor['riskLevel'] = riskScore > 80 ? 'HIGH' : riskScore > 55 ? 'MEDIUM' : 'LOW';

      if (riskLevel === 'LOW') return null; // Chỉ báo cáo HIGH và MEDIUM

      return {
        criteriaName: criterion.name,
        riskLevel,
        riskScore: Math.min(100, riskScore),
        reason: riskReason,
        recentValues: values.slice(0, 5).map(v => v),
        trend,
      } as CriterionRiskFactor;
    })
    .filter(Boolean)
    .sort((a, b) => (b?.riskScore || 0) - (a?.riskScore || 0))
    .slice(0, 5) as CriterionRiskFactor[];
};

// ─────────────────────────────────────────────
// MAIN: Tạo báo cáo dự báo
// ─────────────────────────────────────────────

export const predictInspectionOutcome = (ctx: PredictiveContext): PredictiveInspectionReport => {
  const now = new Date().toISOString();
  const totalSamples = countTotalSamples(ctx);

  // Tính 4 yếu tố
  const labFactor = calcLabPerformanceFactor(ctx);
  const seasonalFactor = calcSeasonalFactor(ctx);
  const trendFactor = calcTrendDriftFactor(ctx);
  const similarityFactor = calcHistoricalSimilarityFactor(ctx);

  // Trọng số: Lịch sử (35%) + Xu hướng (30%) + Mùa vụ (20%) + Lab (15%)
  const weightedScore =
    similarityFactor.score * 0.35 +
    trendFactor.score * 0.30 +
    seasonalFactor.score * 0.20 +
    labFactor.score * 0.15;

  const passProb = Math.round(Math.max(5, Math.min(99, weightedScore)));

  // Mức tin cậy dựa trên số lượng dữ liệu
  const confidenceLevel: PredictiveInspectionReport['confidenceLevel'] =
    totalSamples >= 10 ? 'HIGH' : totalSamples >= 5 ? 'MEDIUM' : 'LOW';
  const confidenceReason = `Dựa trên ${totalSamples} phiếu kiểm nghiệm lịch sử của sản phẩm này.`;

  // Phân tích chỉ tiêu rủi ro
  const highRiskCriteria = analyzeHighRiskCriteria(ctx, ctx.tccs);

  // Khuyến nghị
  const recommendations: string[] = [];
  if (passProb < 60) recommendations.push('🔴 Tăng cường kiểm tra IPC và tất cả chỉ tiêu trong quá trình');
  if (labFactor.score < 70) recommendations.push(`⚠️ Cân nhắc kiểm tra chéo với phòng lab khác ngoài "${ctx.batch.labName || 'hiện tại'}"`);
  if (seasonalFactor.score < 70) recommendations.push('📅 Chú ý điều kiện môi trường đặc thù của tháng này');
  if (highRiskCriteria.length > 0) {
    const top = highRiskCriteria[0];
    recommendations.push(`🎯 Ưu tiên kiểm tra chặt chỉ tiêu "${top.criteriaName}" (rủi ro ${top.riskLevel})`);
  }
  if (trendFactor.score < 60) recommendations.push('📉 Điều tra nguyên nhân xu hướng giảm chất lượng gần đây');
  if (recommendations.length === 0) recommendations.push('✅ Tiến hành kiểm nghiệm theo kế hoạch bình thường');

  const actionPriority: PredictiveInspectionReport['actionPriority'] =
    passProb < 40 ? 'URGENT' : passProb < 60 ? 'HIGH' : passProb < 80 ? 'MEDIUM' : 'LOW';

  const summary = passProb >= 80
    ? `✅ Xác suất ĐẠT cao (${passProb}%). Lô có hồ sơ chất lượng tốt.`
    : passProb >= 60
      ? `⚠️ Xác suất ĐẠT trung bình (${passProb}%). Cần chú ý kiểm tra chặt một số chỉ tiêu.`
      : `🔴 Xác suất ĐẠT thấp (${passProb}%). Đây là lô rủi ro cao — cần tăng cường giám sát.`;

  return {
    batchId: ctx.batch.id,
    batchNo: ctx.batch.batchNo,
    productName: ctx.product?.name || 'N/A',
    generatedAt: now,
    overallPassProbability: passProb,
    confidenceLevel,
    confidenceReason,
    riskFactors: {
      labPerformance: labFactor,
      seasonalPattern: seasonalFactor,
      trendDrift: trendFactor,
      historicalSimilarity: similarityFactor,
    },
    highRiskCriteria,
    recommendations,
    actionPriority,
    summary,
    disclaimer: 'Đây là dự báo dựa trên dữ liệu lịch sử, không phải kết quả kiểm nghiệm chính thức. Quyết định xuất xưởng phải dựa trên kết quả kiểm nghiệm thực tế theo quy định GMP.',
  };
};
