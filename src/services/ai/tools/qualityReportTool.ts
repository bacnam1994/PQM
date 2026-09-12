import { generateQualityReport as _generateReport, detectQualityAnomalies as _detectAnomalies, QualityReportOptions } from '../../reportService';

/**
 * Xuất báo cáo chất lượng tổng hợp ra file Excel (.xlsx) đa sheet
 */
export const generateQualityReport = (args: any, appContext: any) => {
  const opts: QualityReportOptions = {
    period: (args.period as any) || 'all',
    year: args.year ? Number(args.year) : undefined,
    month: args.month ? Number(args.month) : undefined,
    quarter: args.quarter ? Number(args.quarter) : undefined,
    productId: args.productId || undefined,
  };
  try {
    const result = _generateReport(appContext, opts);
    return {
      success: true,
      filename: result.filename,
      message: `✅ Đã xuất báo cáo Excel **${result.summary.periodLabel}** với **${result.rowCount} phiếu kiểm nghiệm**.\n- Tỷ lệ đạt: **${result.summary.passRate}**\n- Đạt: ${result.summary.pass} | Không đạt: ${result.summary.fail}\n- File **.xlsx** (4 sheet): Tóm tắt · Tất cả phiếu · Đạt · Không đạt\n- File \`${result.filename}\` đã được tải về máy.`
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/**
 * Phát hiện bất thường chất lượng: lô sắp hết hạn, xu hướng trôi chỉ tiêu, tỷ lệ thất bại cao
 */
export const detectQualityAnomalies = (daysAhead: number | undefined, appContext: any) => {
  const anomalies = _detectAnomalies(appContext, daysAhead || 30);
  if (anomalies.length === 0) {
    return {
      count: 0,
      message: '✅ Không phát hiện bất thường chất lượng nào trong dữ liệu hiện tại.',
      anomalies: []
    };
  }
  const highCount = anomalies.filter(a => a.severity === 'HIGH').length;
  const summary = anomalies.map(a => `**[${a.severity}]** ${a.title}: ${a.detail}`).join('\n\n');
  return {
    count: anomalies.length,
    highPriorityCount: highCount,
    message: `⚠️ Phát hiện **${anomalies.length} bất thường chất lượng** (${highCount} mức HIGH).\n\n${summary}`,
    anomalies
  };
};
