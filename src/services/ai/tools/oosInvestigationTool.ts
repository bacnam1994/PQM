import { generateRuleBasedOOSReport } from '../oosInvestigationService';

/**
 * Khởi tạo hồ sơ điều tra sự cố Out-of-Specification (OOS) 2 giai đoạn theo chuẩn GMP WHO/FDA
 */
export const generateOOSInvestigation = (args: { batchNo: string; criteriaName?: string }, appContext: any) => {
  const batches = appContext.batches || [];
  const testResults = appContext.testResults || [];
  const products = appContext.products || [];
  const productFormulas = appContext.productFormulas || [];
  const targetBatch = batches.find((b: any) => b.batchNo === args.batchNo || b.id === args.batchNo);
  if (!targetBatch) {
    return { error: `Không tìm thấy thông tin lô hàng "${args.batchNo}" trong hệ thống.` };
  }
  const product = products.find((p: any) => p.id === targetBatch.productId);
  const resultsForBatch = testResults.filter((r: any) => r.batchId === targetBatch.id);
  const allEntries = resultsForBatch.flatMap((r: any) => r.results || []);
  const failed = allEntries.filter((e: any) => e.isPass === false);
  const passed = allEntries.filter((e: any) => e.isPass === true);
  const formula = productFormulas.find((f: any) => f.productId === targetBatch.productId);

  const oosReport = generateRuleBasedOOSReport({
    productName: product?.name || 'Sản phẩm',
    batchNo: targetBatch.batchNo,
    mfgDate: targetBatch.mfgDate,
    expDate: targetBatch.expDate,
    failedCriteria: failed.length > 0 ? failed.map((f: any) => ({
      criteriaName: f.criteriaName,
      actualValue: f.value,
      specification: f.limit || 'TCCS',
      unit: f.unit,
    })) : [{ criteriaName: args.criteriaName || 'Chỉ tiêu chất lượng', actualValue: 'Không đạt', specification: 'TCCS' }],
    passedCriteria: passed.map((p: any) => ({ criteriaName: p.criteriaName, actualValue: p.value })),
    formulaIngredients: formula?.ingredients || [],
  });

  const capaList = oosReport.capaPlan.map(c => `- **[${c.type}]** ${c.action} *(Phụ trách: ${c.responsible}, Hạn: ${c.deadline})*`).join('\n');
  const ishikawaCauses = oosReport.ishikawaDiagram.map(cat => `  • **${cat.vietnameseLabel}**: ${cat.causes.join('; ')}`).join('\n');

  return {
    success: true,
    reportId: oosReport.reportId,
    productName: oosReport.productName,
    batchNo: oosReport.batchNo,
    message: `### 🚨 HỒ SƠ ĐIỀU TRA OOS (GMP): Lô **${oosReport.batchNo}** - ${oosReport.productName}\n\n**1. Tóm tắt sự cố:**\n${oosReport.executiveSummary}\n\n**2. Đánh giá nguyên nhân gốc rễ (Root Cause):**\n${oosReport.rootCauseStatement}\n\n**3. Sơ đồ xương cá Ishikawa 6M:**\n${ishikawaCauses}\n\n**4. Kế hoạch hành động khắc phục & phòng ngừa (CAPA):**\n${capaList}\n\n*Bạn có thể xem đầy đủ và in biên bản OOS trực tiếp tại trang [Chi tiết Lô hàng](/batches/${targetBatch.id}).*`,
    action: 'REDIRECT',
    path: `/batches/${targetBatch.id}`
  };
};
