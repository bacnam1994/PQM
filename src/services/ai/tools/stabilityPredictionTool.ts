import { predictProductStability, generateStabilityForecastWithAI } from '../stabilityPredictionService';

/**
 * Dự báo động học suy giảm hàm lượng và độ ổn định chất lượng theo thời gian (Stability Forecasting)
 */
export const predictQualityStability = async (
  args: { productId: string; shelfLifeMonths?: number },
  appContext: any
) => {
  try {
    const products = appContext.products || [];
    const batches = appContext.batches || [];
    const testResults = appContext.testResults || [];
    const tccsList = appContext.tccsList || [];

    const targetProduct = products.find((p: any) => p.id === args.productId || p.name?.toLowerCase().includes(String(args.productId).toLowerCase()));
    if (!targetProduct) {
      return { error: `Không tìm thấy sản phẩm "${args.productId}" trong hệ thống.` };
    }

    const tccs = tccsList.find((t: any) => t.productId === targetProduct.id && t.isActive) || tccsList.find((t: any) => t.productId === targetProduct.id);
    const report = predictProductStability(targetProduct, batches, testResults, tccs, args.shelfLifeMonths || 24);
    const enrichedReport = await generateStabilityForecastWithAI(report);

    const forecastLines = enrichedReport.forecasts.map(f => {
      const icon = f.riskLevel === 'HIGH_EXPIRY_RISK' ? '🚨' : f.riskLevel === 'MODERATE_RISK' ? '⚠️' : '✅';
      return `- ${icon} **${f.criteriaName}**: Ban đầu: ${f.initialValue}${f.unit} → Mới nhất: ${f.latestValue}${f.unit} (Giảm: ${(f.decayRatePerMonth * 12).toFixed(1)}${f.unit}/năm, R²=${f.rSquared}). ${f.projectedMonthToMinLimit ? `Dự kiến chạm Min (${f.minLimit}${f.unit}) sau **${f.projectedMonthToMinLimit} tháng**.` : 'Duy trì ổn định.'}`;
    }).join('\n');

    return {
      success: true,
      productId: targetProduct.id,
      productName: targetProduct.name,
      forecasts: enrichedReport.forecasts,
      message: `### 📈 BÁO CÁO DỰ BÁO ĐỘ ỔN ĐỊNH & HẠN DÙNG: **${targetProduct.name}**\n\n**1. Tóm tắt chuyên môn:**\n${enrichedReport.executiveSummary}\n\n**2. Chi tiết động học suy giảm theo chỉ tiêu:**\n${forecastLines}\n\n*Xem biểu đồ xu hướng trực quan tại trang [Phân tích Xu hướng](/trend-analysis).*`,
      action: 'REDIRECT',
      path: '/trend-analysis'
    };
  } catch (e: any) {
    return { error: e.message };
  }
};
