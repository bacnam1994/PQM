import { getApiKey, getGeminiModel } from './geminiService';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface PQRQualityMetricsSummary {
  periodLabel: string;
  productName?: string;
  totalBatches: number;
  passedBatches: number;
  failedBatches: number;
  passRate: number;
  criteriaCpkList: Array<{
    name: string;
    cpk?: number | null;
    mean?: number;
    stdDev?: number;
    isCapable?: boolean; // Cpk >= 1.33
  }>;
  totalOOSCount: number;
  criticalNotes?: string[];
}

export interface PQRExecutiveNarrative {
  overviewSection: string;
  cpkEvaluationSection: string;
  deviationSection: string;
  conclusionAndPlanSection: string;
  fullNarrative: string;
  generatedAt: string;
  isAiEnriched: boolean;
}

/**
 * Sinh nội dung Báo cáo Đánh giá Chất lượng Sản phẩm (PQR/APR) Rule-based
 */
export const generatePQRRuleBasedNarrative = (
  summary: PQRQualityMetricsSummary
): PQRExecutiveNarrative => {
  const { periodLabel, productName, totalBatches, passedBatches, failedBatches, passRate, criteriaCpkList, totalOOSCount } = summary;
  const prodTitle = productName ? `sản phẩm ${productName}` : 'toàn bộ các dòng sản phẩm';

  // 1. Tổng quan
  const overview = `Trong kỳ đánh giá (${periodLabel}), hệ thống ghi nhận tổng cộng ${totalBatches} lô ${prodTitle} đã được sản xuất và kiểm nghiệm. Tỷ lệ lô đạt tiêu chuẩn chất lượng xuất xưởng đạt ${passRate.toFixed(1)}% (${passedBatches}/${totalBatches} lô Đạt, ${failedBatches} lô Không Đạt). Quy trình sản xuất duy trì sự ổn định cơ bản theo tiêu chuẩn GMP.`;

  // 2. Đánh giá Cpk
  const validCpkItems = criteriaCpkList.filter(c => c.cpk != null && !isNaN(c.cpk));
  const capableCount = validCpkItems.filter(c => c.cpk! >= 1.33).length;
  const lowCpkItems = validCpkItems.filter(c => c.cpk! < 1.33);

  let cpkText = '';
  if (validCpkItems.length === 0) {
    cpkText = `Chưa đủ cỡ mẫu thống kê để tính toán năng lực quá trình Cpk cho các chỉ tiêu định lượng trong kỳ này.`;
  } else if (lowCpkItems.length === 0) {
    cpkText = `Năng lực quá trình (SPC) đạt mức lý tưởng: 100% (${capableCount}/${validCpkItems.length}) các chỉ tiêu định lượng có chỉ số Cpk ≥ 1.33. Biến thiên quá trình được kiểm soát chặt chẽ, không có dấu hiệu trôi dạt có hệ thống.`;
  } else {
    cpkText = `Có ${capableCount}/${validCpkItems.length} chỉ tiêu đạt năng lực quá trình chuẩn (Cpk ≥ 1.33). Tuy nhiên, ghi nhận ${lowCpkItems.length} chỉ tiêu có Cpk < 1.33 (${lowCpkItems.map(c => `${c.name}: Cpk ${c.cpk?.toFixed(2)}`).join(', ')}), cần theo dõi sát các yếu tố biến thiên từ nguyên liệu đầu vào và thông số vận hành máy.`;
  }

  // 3. Sai lệch & OOS
  let devText = '';
  if (totalOOSCount === 0) {
    devText = `Trong kỳ không phát sinh bất kỳ sự cố ngoài tiêu chuẩn (OOS) nghiêm trọng nào. Mọi chỉ tiêu kiểm nghiệm đều nằm trong khoảng chấp nhận theo TCCS.`;
  } else {
    devText = `Ghi nhận ${totalOOSCount} trường hợp vi phạm tiêu chuẩn (OOS/OOT). Các sự cố đã được mở hồ sơ điều tra nguyên nhân gốc rễ và triển khai hành động khắc phục phòng ngừa (CAPA) kịp thời.`;
  }

  // 4. Kết luận & Kế hoạch
  const conclusion = `KẾT LUẬN: Chất lượng ${prodTitle} trong kỳ ${periodLabel} được đánh giá là ${passRate >= 95 ? 'ĐẠT YÊU CẦU VÀ ỔN ĐỊNH' : 'CẦN TẬP TRUNG CẢI THIỆN'}. Tiếp tục duy trì giám sát SPC thời gian thực và rà soát định kỳ toàn vẹn dữ liệu ALCOA+.`;

  const full = `${overview}\n\n${cpkText}\n\n${devText}\n\n${conclusion}`;

  return {
    overviewSection: overview,
    cpkEvaluationSection: cpkText,
    deviationSection: devText,
    conclusionAndPlanSection: conclusion,
    fullNarrative: full,
    generatedAt: new Date().toISOString(),
    isAiEnriched: false
  };
};

/**
 * Nâng cao nội dung Báo cáo PQR bằng AI Gemini
 */
export const enrichPQRNarrativeWithAI = async (
  summary: PQRQualityMetricsSummary
): Promise<PQRExecutiveNarrative> => {
  const base = generatePQRRuleBasedNarrative(summary);
  const apiKey = getApiKey();
  if (!apiKey) return base;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = getGeminiModel();
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `Bạn là Trưởng phòng Đảm bảo Chất lượng Dược phẩm (QA Director) viết Báo cáo Đánh giá Chất lượng Sản phẩm Hàng năm (Annual Product Quality Review - PQR / APR) theo hướng dẫn GMP-WHO và ICH Q10.

Số liệu thống kê chất lượng trong kỳ:
- Kỳ báo cáo: ${summary.periodLabel}
- Tên sản phẩm: ${summary.productName || 'Toàn bộ sản phẩm'}
- Tổng số lô sản xuất: ${summary.totalBatches} lô (${summary.passedBatches} Đạt, ${summary.failedBatches} Hỏng, Tỷ lệ Đạt: ${summary.passRate.toFixed(1)}%)
- Năng lực quá trình Cpk: ${summary.criteriaCpkList.map(c => `${c.name}: Cpk ${c.cpk != null ? c.cpk.toFixed(2) : 'N/A'}`).join('; ')}
- Số lượng sự cố OOS: ${summary.totalOOSCount} sự cố

Hãy viết một bản Báo cáo Đánh giá Tổng thể Chất lượng (Executive Quality Conclusion) chuyên nghiệp, hành văn chuẩn mực ngành Dược gồm 4 phần:
1. Tổng quan tình hình sản xuất & tỷ lệ đạt
2. Đánh giá năng lực quá trình (SPC/Cpk Analysis)
3. Tổng kết các sai lệch chất lượng và hiệu quả CAPA
4. Kết luận của Trưởng phòng QA & Kiến nghị hành động tiếp theo

Trả về kết quả dưới định dạng JSON:
{
  "overviewSection": "Đoạn 1...",
  "cpkEvaluationSection": "Đoạn 2...",
  "deviationSection": "Đoạn 3...",
  "conclusionAndPlanSection": "Đoạn 4...",
  "fullNarrative": "Toàn văn ghép lại..."
}`;

    const res = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
    });

    const parsed = JSON.parse(res.response.text());

    return {
      overviewSection: parsed.overviewSection || base.overviewSection,
      cpkEvaluationSection: parsed.cpkEvaluationSection || base.cpkEvaluationSection,
      deviationSection: parsed.deviationSection || base.deviationSection,
      conclusionAndPlanSection: parsed.conclusionAndPlanSection || base.conclusionAndPlanSection,
      fullNarrative: parsed.fullNarrative || `${parsed.overviewSection}\n\n${parsed.cpkEvaluationSection}\n\n${parsed.deviationSection}\n\n${parsed.conclusionAndPlanSection}`,
      generatedAt: new Date().toISOString(),
      isAiEnriched: true
    };
  } catch (err) {
    console.warn('AI PQR enrichment error:', err);
    return base;
  }
};
