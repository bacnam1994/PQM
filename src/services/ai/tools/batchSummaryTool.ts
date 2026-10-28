/**
 * Lấy tóm tắt thông tin về các lô hàng: số lượng, trạng thái, lô cận hạn, lô không đạt
 */
export const getBatchSummary = (filter: string, appContext: any) => {
  const batches = appContext.batches || [];
  const testResults = appContext.testResults || [];
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let filteredBatches = batches;

  if (filter === 'expiring') {
    filteredBatches = batches.filter((b: any) => {
      if (!b.expDate) return false;
      const exp = new Date(b.expDate);
      return exp <= in30Days && exp >= now;
    });
  } else if (filter === 'failing') {
    const failBatchIds = new Set(
      testResults.filter((r: any) => r.overallStatus === 'FAIL').map((r: any) => r.batchId)
    );
    filteredBatches = batches.filter((b: any) => failBatchIds.has(b.id));
  }

  const statusCount = filteredBatches.reduce((acc: any, b: any) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  return {
    filter,
    total: filteredBatches.length,
    statusBreakdown: statusCount,
    batches: filteredBatches.slice(0, 10).map((b: any) => ({
      batchNo: b.batchNo,
      product: b.product?.name || b.productId,
      status: b.status,
      expDate: b.expDate
    })),
    summary: filter === 'expiring'
      ? `Có **${filteredBatches.length} lô** sắp hết hạn trong 30 ngày tới.`
      : filter === 'failing'
        ? `Có **${filteredBatches.length} lô** có kết quả kiểm nghiệm KHÔNG ĐẠT.`
        : `Tổng cộng **${filteredBatches.length} lô** trong hệ thống.`
  };
};
