import { TestResult } from '../../../types';
import { compareLabReports } from '../labComparisonService';

/**
 * Đối chiếu kết quả giữa 2 phiếu kiểm nghiệm, tính %RPD và đánh giá Lab Bias
 */
export const compareLabResults = async (
  args: { batchNo: string; lab1Name?: string; lab2Name?: string },
  appContext: any
) => {
  try {
    const testResults: TestResult[] = appContext.testResults || [];
    const batches = appContext.batches || [];
    const learned = appContext.aiLearnedMappings || [];

    const targetBatch = batches.find((b: any) => b.batchNo === args.batchNo || b.id === args.batchNo);
    if (!targetBatch) {
      return { error: `Không tìm thấy thông tin lô hàng "${args.batchNo}" trong hệ thống.` };
    }

    const batchResults = testResults.filter((r: any) => r.batchId === targetBatch.id);
    if (batchResults.length < 2) {
      return {
        error: `Lô "${targetBatch.batchNo}" hiện chỉ có ${batchResults.length} phiếu kiểm nghiệm. Cần ít nhất 2 phiếu kiểm nghiệm để thực hiện đối chiếu chéo.`
      };
    }

    let r1 = batchResults[0];
    let r2 = batchResults[1];

    if (args.lab1Name) {
      const found = batchResults.find(r => r.labName?.toLowerCase().includes(args.lab1Name!.toLowerCase()));
      if (found) r1 = found;
    }
    if (args.lab2Name) {
      const found = batchResults.find(r => r !== r1 && r.labName?.toLowerCase().includes(args.lab2Name!.toLowerCase()));
      if (found) r2 = found;
    }

    const comparison = await compareLabReports(
      { title: `Phiếu 1 (${r1.labName || 'Nội bộ'})`, labName: r1.labName || 'Nội bộ', testDate: r1.testDate, batchNo: targetBatch.batchNo, overallStatus: r1.overallStatus, results: r1.results || [] },
      { title: `Phiếu 2 (${r2.labName || 'Ngoại kiểm'})`, labName: r2.labName || 'Ngoại kiểm', testDate: r2.testDate, batchNo: targetBatch.batchNo, overallStatus: r2.overallStatus, results: r2.results || [] },
      learned
    );

    const entryLines = comparison.entries
      .filter(e => e.deviationLevel !== 'SINGLE_SOURCE')
      .map(e => `| ${e.criteriaName} | ${e.source1Value} ${e.source1Unit || ''} | ${e.source2Value} ${e.source2Unit || ''} | ${e.rpd !== undefined ? `${e.rpd}%` : '---'} | **${e.deviationLevel}** |`)
      .join('\n');

    const mdTable = `| Chỉ tiêu | ${comparison.report1.labName} | ${comparison.report2.labName} | Độ lệch (%RPD) | Đánh giá |\n| --- | --- | --- | --- | --- |\n${entryLines}`;

    return {
      success: true,
      comparisonId: comparison.comparisonId,
      metrics: comparison.metrics,
      message: `### 🔬 ĐỐI CHIẾU KẾT QUẢ KIỂM NGHIỆM: Lô **${targetBatch.batchNo}**\n\n- **Đơn vị 1:** ${comparison.report1.labName} (${comparison.report1.testDate || 'N/A'})\n- **Đơn vị 2:** ${comparison.report2.labName} (${comparison.report2.testDate || 'N/A'})\n- **Tỷ lệ đồng thuận:** **${comparison.metrics.agreementRatePercent}%** (Độ lệch TB: **${comparison.metrics.avgRpdPercent}%**)\n\n${mdTable}\n\n**Nhận định chuyên môn:**\n${comparison.aiAnalysis.summary}\n\n**Đánh giá sai số hệ thống (Lab Bias):**\n${comparison.aiAnalysis.systematicBiasAssessment}`
    };
  } catch (e: any) {
    return { error: e.message };
  }
};
