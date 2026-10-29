/**
 * Lấy tóm tắt thông tin về các lô hàng: số lượng, trạng thái, lô cận hạn, lô không đạt, lô đang chờ duyệt/kiểm nghiệm
 */
export const getBatchSummary = (filter: string, appContext: any) => {
  const batches = appContext.batches || [];
  const testResults = appContext.testResults || [];
  const products = appContext.products || [];
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Map tên sản phẩm
  const productMap = new Map<string, string>();
  products.forEach((p: any) => {
    if (p.id) productMap.set(p.id, p.name || p.code || p.id);
  });

  const normalizedFilter = (filter || 'all').toLowerCase();
  let filteredBatches = batches;

  if (normalizedFilter === 'expiring') {
    filteredBatches = batches.filter((b: any) => {
      if (!b.expDate) return false;
      const exp = new Date(b.expDate);
      return exp <= in30Days && exp >= now;
    });
  } else if (normalizedFilter === 'failing') {
    const failBatchIds = new Set(
      testResults.filter((r: any) => r.overallStatus === 'FAIL').map((r: any) => r.batchId)
    );
    filteredBatches = batches.filter((b: any) => failBatchIds.has(b.id));
  } else if (normalizedFilter === 'pending') {
    filteredBatches = batches.filter((b: any) => b.status === 'PENDING');
  } else if (normalizedFilter === 'testing') {
    filteredBatches = batches.filter((b: any) => b.status === 'TESTING');
  } else if (normalizedFilter === 'released') {
    filteredBatches = batches.filter((b: any) => b.status === 'RELEASED');
  } else if (normalizedFilter === 'blocked' || normalizedFilter === 'rejected') {
    filteredBatches = batches.filter((b: any) => b.status === 'BLOCKED' || b.status === 'REJECTED');
  }

  const statusCount = batches.reduce((acc: any, b: any) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const getSummaryMessage = () => {
    switch (normalizedFilter) {
      case 'expiring':
        return `Có **${filteredBatches.length} lô** sắp hết hạn trong 30 ngày tới.`;
      case 'failing':
        return `Có **${filteredBatches.length} lô** có kết quả kiểm nghiệm KHÔNG ĐẠT.`;
      case 'pending':
        return `Có **${filteredBatches.length} lô** đang ở trạng thái **Chờ duyệt (PENDING)**.`;
      case 'testing':
        return `Có **${filteredBatches.length} lô** đang trong quá trình **Kiểm nghiệm (TESTING)**.`;
      case 'released':
        return `Có **${filteredBatches.length} lô** đã được phê duyệt **Xuất xưởng (RELEASED)**.`;
      case 'blocked':
      case 'rejected':
        return `Có **${filteredBatches.length} lô** bị **Từ chối / Tạm khóa (REJECTED/BLOCKED)**.`;
      default:
        return `Tổng cộng **${batches.length} lô** trong hệ thống (Đã xuất xưởng: ${statusCount['RELEASED'] || 0}, Đang kiểm: ${statusCount['TESTING'] || 0}, Chờ duyệt: ${statusCount['PENDING'] || 0}).`;
    }
  };

  return {
    filter: normalizedFilter,
    total: filteredBatches.length,
    statusBreakdown: statusCount,
    batches: filteredBatches.slice(0, 15).map((b: any) => ({
      batchNo: b.batchNo,
      productName: productMap.get(b.productId) || b.product?.name || b.productId,
      status: b.status,
      mfgDate: b.mfgDate,
      expDate: b.expDate,
      link: `/batches/${b.id}`,
    })),
    summary: getSummaryMessage(),
  };
};
