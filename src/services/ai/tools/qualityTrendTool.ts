import { TestResult } from '../../../types';
import { resolveQualityStatus } from '../../../domain';

/**
 * Phân tích xu hướng chất lượng của một sản phẩm dựa trên lịch sử kết quả kiểm nghiệm.
 */
export const analyzeQualityTrends = (productId: string, appContext: any) => {
  const allResults: TestResult[] = appContext.testResults || [];
  const allBatches = appContext.batches || [];

  const productResults = allResults.filter((tr) => {
    const batch = allBatches.find((b: any) => b.id === tr.batchId);
    return batch && batch.productId === productId;
  });

  if (productResults.length === 0) {
    return {
      message: 'Không tìm thấy dữ liệu kiểm nghiệm cho sản phẩm này để phân tích xu hướng.',
    };
  }

  const total = productResults.length;
  const passCount = productResults.filter((r) => resolveQualityStatus(r) === 'PASS').length;
  const failCount = total - passCount;
  const passRate = ((passCount / total) * 100).toFixed(1);

  const criteriaStats: Record<string, any> = {};
  productResults.forEach((res) => {
    res.results.forEach((entry) => {
      if (typeof entry.value === 'string') {
        const numValue = parseFloat(entry.value.replace(',', '.'));
        if (!isNaN(numValue)) {
          if (!criteriaStats[entry.criteriaName]) {
            criteriaStats[entry.criteriaName] = { values: [], unit: entry.unit };
          }
          criteriaStats[entry.criteriaName].values.push(numValue);
        }
      }
    });
  });

  const trends = Object.entries(criteriaStats).map(([name, stats]: [string, any]) => {
    const values = stats.values;
    const avg = (values.reduce((a: number, b: number) => a + b, 0) / values.length).toFixed(3);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      criteriaName: name,
      average: avg,
      min,
      max,
      unit: stats.unit,
      sampleSize: values.length,
    };
  });

  const productName = (() => {
    const batch = allBatches.find((b: any) => b.productId === productId);
    const prod = batch?.product;
    return typeof prod === 'string' ? prod : prod?.name || 'Sản phẩm';
  })();

  return {
    productName,
    totalBatchesAnalyzed: total,
    passCount,
    failCount,
    passRate: `${passRate}%`,
    trends,
    summary: `Sản phẩm **${productName}** có tỷ lệ đạt **${passRate}%** trên ${total} phiếu kiểm nghiệm (${passCount} đạt, ${failCount} không đạt).`,
  };
};
