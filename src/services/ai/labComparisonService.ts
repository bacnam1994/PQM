/**
 * labComparisonService.ts
 * =======================
 * Dịch vụ đối chiếu đa phiếu và đánh giá sai lệch giữa các phòng kiểm nghiệm (Lab Bias).
 * Cho phép so sánh Phiếu nội bộ vs Phiếu gửi ngoài (Quatest, CASE, Eurofins) hoặc CoA Nhà cung cấp.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey, getGeminiModel } from './geminiService';
import { TestResultEntry } from '../../types';
import { isCriteriaMatch } from '../../utils/aiMapping';

export interface ComparisonEntry {
  criteriaName: string;
  source1Name: string;
  source1Value: string | number;
  source1Unit?: string;
  source1Pass?: boolean;
  source2Name: string;
  source2Value: string | number;
  source2Unit?: string;
  source2Pass?: boolean;
  limit?: string;
  rpd?: number; // Relative Percent Difference (%)
  deviationLevel: 'EXCELLENT' | 'ACCEPTABLE' | 'WARNING' | 'CRITICAL' | 'QUALITATIVE_DIFF' | 'SINGLE_SOURCE';
  analysis?: string;
}

export interface LabReportSource {
  title: string;
  labName: string;
  testDate?: string;
  batchNo?: string;
  overallStatus?: string;
  results: TestResultEntry[];
  notes?: string;
}

export interface LabComparisonResult {
  comparisonId: string;
  generatedAt: string;
  report1: { title: string; labName: string; testDate?: string; batchNo?: string; overallStatus?: string };
  report2: { title: string; labName: string; testDate?: string; batchNo?: string; overallStatus?: string };
  entries: ComparisonEntry[];
  metrics: {
    totalEvaluated: number;
    consistentCount: number;
    minorDiffCount: number;
    criticalDiffCount: number;
    agreementRatePercent: number;
    avgRpdPercent: number;
  };
  aiAnalysis: {
    summary: string;
    systematicBiasAssessment: string;
    potentialCauses: string[];
    actionRecommendations: string[];
  };
}

/**
 * Tính phần trăm sai lệch tương đối (Relative Percent Difference - %RPD)
 * RPD = (|X1 - X2| / ((X1 + X2) / 2)) * 100
 */
export const calculateRPD = (v1: number, v2: number): number => {
  if (isNaN(v1) || isNaN(v2)) return 0;
  const avg = (Math.abs(v1) + Math.abs(v2)) / 2;
  if (avg === 0) return 0;
  const rpd = (Math.abs(v1 - v2) / avg) * 100;
  return Math.round(rpd * 100) / 100;
};

/**
 * Phân loại mức độ sai lệch theo RPD và tính chất chỉ tiêu
 */
export const classifyDeviation = (
  rpd: number | undefined,
  v1: string | number,
  v2: string | number,
  pass1?: boolean,
  pass2?: boolean
): ComparisonEntry['deviationLevel'] => {
  // Nếu 1 bên đạt, 1 bên không đạt -> CRITICAL
  if (pass1 !== undefined && pass2 !== undefined && pass1 !== pass2) {
    return 'CRITICAL';
  }

  // Nếu là số
  if (rpd !== undefined) {
    if (rpd <= 5.0) return 'EXCELLENT';        // Sai lệch <= 5%: Rất tốt
    if (rpd <= 12.0) return 'ACCEPTABLE';     // Sai lệch <= 12%: Chấp nhận được trong phân tích dược
    if (rpd <= 25.0) return 'WARNING';        // Sai lệch 12-25%: Cần lưu ý
    return 'CRITICAL';                        // Sai lệch > 25%: Bất thường nghiêm trọng
  }

  // Nếu là định tính (chuỗi)
  const s1 = String(v1).trim().toLowerCase();
  const s2 = String(v2).trim().toLowerCase();
  if (s1 === s2) return 'EXCELLENT';
  if ((s1.includes('đạt') || s1.includes('pass') || s1.includes('dương tính')) && (s2.includes('không') || s2.includes('fail') || s2.includes('âm tính'))) {
    return 'CRITICAL';
  }
  return 'QUALITATIVE_DIFF';
};

/**
 * Ghép nối và đối chiếu các chỉ tiêu giữa 2 phiếu kiểm nghiệm
 */
export const matchAndCompareEntries = (
  results1: TestResultEntry[],
  results2: TestResultEntry[],
  learnedMappings: any[] = []
): ComparisonEntry[] => {
  const matchedEntries: ComparisonEntry[] = [];
  const usedIdx2 = new Set<number>();

  results1.forEach(item1 => {
    const name1 = item1.criteriaName;
    let bestMatchIdx = -1;

    // Tìm trong results2
    for (let i = 0; i < results2.length; i++) {
      if (usedIdx2.has(i)) continue;
      const item2 = results2[i];
      if (isCriteriaMatch(name1, item2.criteriaName, learnedMappings)) {
        bestMatchIdx = i;
        break;
      }
    }

    if (bestMatchIdx !== -1) {
      usedIdx2.add(bestMatchIdx);
      const item2 = results2[bestMatchIdx];
      
      const num1 = parseFloat(String(item1.value).replace(',', '.'));
      const num2 = parseFloat(String(item2.value).replace(',', '.'));
      const hasNumbers = !isNaN(num1) && !isNaN(num2);
      const rpd = hasNumbers ? calculateRPD(num1, num2) : undefined;
      const deviationLevel = classifyDeviation(rpd, item1.value, item2.value, item1.isPass, item2.isPass);

      matchedEntries.push({
        criteriaName: name1,
        source1Name: name1,
        source1Value: item1.value,
        source1Unit: item1.unit,
        source1Pass: item1.isPass,
        source2Name: item2.criteriaName,
        source2Value: item2.value,
        source2Unit: item2.unit,
        source2Pass: item2.isPass,
        limit: item1.limit || item2.limit,
        rpd,
        deviationLevel
      });
    } else {
      matchedEntries.push({
        criteriaName: name1,
        source1Name: name1,
        source1Value: item1.value,
        source1Unit: item1.unit,
        source1Pass: item1.isPass,
        source2Name: '—',
        source2Value: 'Không kiểm',
        limit: item1.limit,
        deviationLevel: 'SINGLE_SOURCE'
      });
    }
  });

  // Thêm các chỉ tiêu chỉ có ở phiếu 2
  results2.forEach((item2, idx) => {
    if (!usedIdx2.has(idx)) {
      matchedEntries.push({
        criteriaName: item2.criteriaName,
        source1Name: '—',
        source1Value: 'Không kiểm',
        source2Name: item2.criteriaName,
        source2Value: item2.value,
        source2Unit: item2.unit,
        source2Pass: item2.isPass,
        limit: item2.limit,
        deviationLevel: 'SINGLE_SOURCE'
      });
    }
  });

  return matchedEntries;
};

/**
 * Sinh phân tích đối chiếu Rule-based khi không có AI API Key
 */
export const generateRuleBasedComparisonAnalysis = (
  report1: LabReportSource,
  report2: LabReportSource,
  entries: ComparisonEntry[]
) => {
  const commonEntries = entries.filter(e => e.deviationLevel !== 'SINGLE_SOURCE');
  const critical = commonEntries.filter(e => e.deviationLevel === 'CRITICAL');
  const warnings = commonEntries.filter(e => e.deviationLevel === 'WARNING');
  const excellent = commonEntries.filter(e => e.deviationLevel === 'EXCELLENT' || e.deviationLevel === 'ACCEPTABLE');

  // Đánh giá xu hướng sai số hệ thống
  let num1Higher = 0;
  let num2Higher = 0;
  commonEntries.forEach(e => {
    if (e.rpd && e.rpd > 3.0) {
      const n1 = parseFloat(String(e.source1Value).replace(',', '.'));
      const n2 = parseFloat(String(e.source2Value).replace(',', '.'));
      if (n1 > n2) num1Higher++;
      if (n2 > n1) num2Higher++;
    }
  });

  let systematicBias = 'Không phát hiện sai số hệ thống rõ rệt giữa hai đơn vị thử nghiệm.';
  if (num1Higher >= 3 && num2Higher === 0) {
    systematicBias = `Phát hiện xu hướng sai số hệ thống: ${report1.labName || 'Phiếu 1'} có xu hướng đo giá trị cao hơn ${report2.labName || 'Phiếu 2'} ở hầu hết các chỉ tiêu định lượng.`;
  } else if (num2Higher >= 3 && num1Higher === 0) {
    systematicBias = `Phát hiện xu hướng sai số hệ thống: ${report2.labName || 'Phiếu 2'} có xu hướng đo giá trị cao hơn ${report1.labName || 'Phiếu 1'} ở hầu hết các chỉ tiêu định lượng.`;
  }

  const causes: string[] = [];
  if (critical.length > 0) {
    causes.push(`Có ${critical.length} chỉ tiêu lệch mức nghiêm trọng (>25% hoặc mâu thuẫn Đạt/Không đạt). Cần rà soát độ chuẩn xác phương pháp phân tích.`);
  }
  if (warnings.length > 0) {
    causes.push(`Có ${warnings.length} chỉ tiêu có độ lệch từ 12-25%, có thể do kỹ thuật chuẩn bị mẫu thử hoặc độ tinh khiết chất chuẩn khác nhau.`);
  }
  if (causes.length === 0) {
    causes.push('Hai phòng kiểm nghiệm cho kết quả có độ tương đồng cao, nằm trong khoảng dung sai cho phép của phương pháp thử.');
  }

  const recommendations: string[] = [];
  if (critical.length > 0) {
    recommendations.push(`Thực hiện kiểm tra chéo lại (Re-test) các chỉ tiêu: ${critical.map(c => c.criteriaName).join(', ')} trên mẫu lưu.`);
    recommendations.push('Yêu cầu phòng lab ngoại kiểm cung cấp sắc ký đồ (chromatogram) và nhật ký hiệu chuẩn thiết bị để đối chiếu.');
  }
  recommendations.push('Lưu hồ sơ đối chiếu vào báo cáo đánh giá năng lực phòng lab định kỳ.');

  return {
    summary: `Đối chiếu giữa "${report1.labName || 'Phiếu 1'}" và "${report2.labName || 'Phiếu 2'}" trên ${commonEntries.length} chỉ tiêu chung: ${excellent.length} chỉ tiêu đồng thuận, ${warnings.length} chỉ tiêu lệch vừa, ${critical.length} chỉ tiêu lệch nghiêm trọng.`,
    systematicBiasAssessment: systematicBias,
    potentialCauses: causes,
    actionRecommendations: recommendations
  };
};

/**
 * Thực hiện đối chiếu toàn diện 2 phiếu kiểm nghiệm với sự hỗ trợ của AI
 */
export const compareLabReports = async (
  report1: LabReportSource,
  report2: LabReportSource,
  learnedMappings: any[] = []
): Promise<LabComparisonResult> => {
  const comparisonId = `COMP-${Date.now().toString(36).toUpperCase()}`;
  const entries = matchAndCompareEntries(report1.results, report2.results, learnedMappings);

  const commonEntries = entries.filter(e => e.deviationLevel !== 'SINGLE_SOURCE');
  const evaluatedCount = commonEntries.length;
  const consistentCount = commonEntries.filter(e => e.deviationLevel === 'EXCELLENT' || e.deviationLevel === 'ACCEPTABLE').length;
  const minorDiffCount = commonEntries.filter(e => e.deviationLevel === 'WARNING').length;
  const criticalDiffCount = commonEntries.filter(e => e.deviationLevel === 'CRITICAL').length;

  const validRpds = commonEntries.map(e => e.rpd).filter((r): r is number => r !== undefined);
  const avgRpd = validRpds.length > 0 ? Math.round((validRpds.reduce((a, b) => a + b, 0) / validRpds.length) * 100) / 100 : 0;
  const agreementRate = evaluatedCount > 0 ? Math.round((consistentCount / evaluatedCount) * 1000) / 10 : 100;

  const baseResult: LabComparisonResult = {
    comparisonId,
    generatedAt: new Date().toISOString(),
    report1: {
      title: report1.title,
      labName: report1.labName,
      testDate: report1.testDate,
      batchNo: report1.batchNo,
      overallStatus: report1.overallStatus
    },
    report2: {
      title: report2.title,
      labName: report2.labName,
      testDate: report2.testDate,
      batchNo: report2.batchNo,
      overallStatus: report2.overallStatus
    },
    entries,
    metrics: {
      totalEvaluated: evaluatedCount,
      consistentCount,
      minorDiffCount,
      criticalDiffCount,
      agreementRatePercent: agreementRate,
      avgRpdPercent: avgRpd
    },
    aiAnalysis: generateRuleBasedComparisonAnalysis(report1, report2, entries)
  };

  // Thử gọi AI nâng cao nếu có API Key
  const apiKey = getApiKey();
  if (!apiKey) return baseResult;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: getGeminiModel() });

    const prompt = `
Bạn là Chuyên gia Đảm bảo Chất lượng Dược phẩm (QA Expert) và Thẩm định Phương pháp Kiểm nghiệm (Method Validation Specialist).
Hãy phân tích kết quả đối chiếu dữ liệu giữa 2 phòng kiểm nghiệm sau:

THÔNG TIN PHIẾU:
- Đơn vị 1: ${report1.labName || 'Phiếu 1'} (Lô: ${report1.batchNo || 'N/A'}, Ngày kiểm: ${report1.testDate || 'N/A'}, Trạng thái: ${report1.overallStatus || 'N/A'})
- Đơn vị 2: ${report2.labName || 'Phiếu 2'} (Lô: ${report2.batchNo || 'N/A'}, Ngày kiểm: ${report2.testDate || 'N/A'}, Trạng thái: ${report2.overallStatus || 'N/A'})

KẾT QUẢ ĐỐI CHIẾU CHỈ TIÊU (RPD = Relative Percent Difference):
${JSON.stringify(entries.filter(e => e.deviationLevel !== 'SINGLE_SOURCE'), null, 2)}

YÊU CẦU:
Trả về định dạng JSON thuần túy (không markdown) với cấu trúc:
{
  "summary": "Tóm tắt ngắn gọn nhận xét chuyên môn về độ tương thích giữa 2 phiếu (2-3 câu)",
  "systematicBiasAssessment": "Đánh giá chi tiết xem có hiện tượng sai số hệ thống (Lab Bias) không (ví dụ Lab A luôn đo cao hơn Lab B do chất chuẩn, đường chuẩn hay thiết bị)",
  "potentialCauses": ["Nguyên nhân tiềm ẩn 1", "Nguyên nhân tiềm ẩn 2"],
  "actionRecommendations": ["Đề xuất hành động 1", "Đề xuất hành động 2"]
}
`;

    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.summary) {
      baseResult.aiAnalysis = {
        summary: parsed.summary,
        systematicBiasAssessment: parsed.systematicBiasAssessment || baseResult.aiAnalysis.systematicBiasAssessment,
        potentialCauses: parsed.potentialCauses || baseResult.aiAnalysis.potentialCauses,
        actionRecommendations: parsed.actionRecommendations || baseResult.aiAnalysis.actionRecommendations
      };
    }
  } catch (error) {
    console.warn('AI Lab Comparison Analysis fallback to rule-based:', error);
  }

  return baseResult;
};
