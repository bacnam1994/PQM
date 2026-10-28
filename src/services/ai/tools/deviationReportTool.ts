import { generateRuleBasedDeviationReport } from '../deviationReportService';

/**
 * Tạo Báo cáo Sai lệch (Deviation Report) chuẩn GMP-WHO/FDA đầy đủ 6 phần cho lô không đạt
 */
export const generateDeviationReport = (batchNo: string, appContext: any) => {
  const batches = appContext.batches || [];
  const products = appContext.products || [];
  const testResults = appContext.testResults || [];
  const productFormulas = appContext.productFormulas || [];

  const batch = batches.find((b: any) => b.batchNo?.toLowerCase() === batchNo?.toLowerCase() || b.id === batchNo);
  if (!batch) {
    return { error: `Không tìm thấy lô "${batchNo}" trong hệ thống.` };
  }

  const product = products.find((p: any) => p.id === batch.productId);
  const batchResults = testResults.filter((r: any) => r.batchId === batch.id);
  const latestResult = batchResults.sort((a: any, b: any) => (b.testDate || '').localeCompare(a.testDate || ''))[0];
  const formula = productFormulas.find((f: any) => f.productId === batch.productId);

  if (!latestResult) {
    return { error: `Lô "${batchNo}" chưa có kết quả kiểm nghiệm.` };
  }

  const failedCriteria = (latestResult.results || [])
    .filter((r: any) => r.isPass === false)
    .map((r: any) => ({
      name: r.criteriaName,
      actualValue: r.value,
      unit: r.unit,
      specification: 'Theo TCCS',
    }));

  if (failedCriteria.length === 0) {
    return { message: `Lô "${batchNo}" không có chỉ tiêu nào không đạt trong phiếu kiểm nghiệm gần nhất.` };
  }

  const report = generateRuleBasedDeviationReport({
    productName: product?.name || batch.productId,
    batchNo: batch.batchNo,
    mfgDate: batch.mfgDate,
    expDate: batch.expDate,
    labName: latestResult.labName,
    testDate: latestResult.testDate,
    failedCriteria,
    formulaIngredients: formula?.ingredients || [],
  });

  return {
    reportId: report.reportId,
    decision: report.decision,
    decisionLabel: {
      RELEASE_WITH_NOTE: 'Xuất với điều kiện',
      REPROCESS: 'Tái chế',
      REJECT: 'Từ chối / Tiêu hủy',
      PENDING_INVESTIGATION: 'Chờ điều tra',
    }[report.decision] || report.decision,
    executiveSummary: report.executiveSummary,
    rootCause: report.rootCauseStatement,
    immediateActions: report.capaItems.filter(c => c.type === 'IMMEDIATE').map(c => c.action),
    patientSafetyRisk: report.immediateImpact.patientSafetyRisk,
    capaCount: report.capaItems.length,
    note: `Để xem báo cáo đầy đủ, hãy vào trang Chi tiết lô ${batchNo} → click nút "Deviation Report" bên cạnh phiếu kiểm nghiệm KHÔNG ĐẠT.`,
  };
};
