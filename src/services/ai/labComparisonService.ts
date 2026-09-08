/**
 * labComparisonService.ts
 * =======================
 * Dịch vụ đối chiếu đa phiếu và đánh giá sai lệch giữa các phòng kiểm nghiệm (Lab Bias).
 * Cho phép so sánh Phiếu nội bộ vs Phiếu gửi ngoài (QUATEST 3, CASE, NIFC, Eurofins) hoặc CoA Nhà cung cấp.
 * 
 * Hỗ trợ:
 * - Xử lý dữ liệu dưới ngưỡng phát hiện (Censored Data: LOD, LOQ, KPH) theo chuẩn ICH Q2 & US EPA
 * - Phân tích sai số hệ thống có định hướng (Directional Lab Bias Engine)
 * - Khuyến nghị hành động QA chuyên sâu (Re-test, Chromatogram overlay, Spike Recovery)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey, getGeminiModel } from './geminiService';
import { TestResultEntry } from '../../types';
import { isCriteriaMatch } from '../../utils/aiMapping';
import { parseLabResultValue, ParsedLabValue, detectLabOrganization, RecognizedLab } from './externalLabTemplates';

export interface ComparisonEntry {
  criteriaName: string;
  source1Name: string;
  source1Value: string | number;
  source1Unit?: string;
  source1Pass?: boolean;
  source1Method?: string;
  source2Name: string;
  source2Value: string | number;
  source2Unit?: string;
  source2Pass?: boolean;
  source2Method?: string;
  limit?: string;
  rpd?: number; // Relative Percent Difference (%)
  deviationLevel: 'EXCELLENT' | 'ACCEPTABLE' | 'WARNING' | 'CRITICAL' | 'QUALITATIVE_DIFF' | 'SINGLE_SOURCE';
  analysis?: string;
  isCensoredDataComparison?: boolean;
  censoredDetails?: string;
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

export interface LabBiasAssessment {
  direction: 'SOURCE1_HIGHER' | 'SOURCE2_HIGHER' | 'BALANCED' | 'NEUTRAL';
  source1HigherCount: number;
  source2HigherCount: number;
  equalCount: number;
  biasRatioPercent: number;
  isSystematic: boolean;
  meanBiasPercent: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  assessmentSummary: string;
  potentialCauses: string[];
  actionRecommendations: string[];
}

export interface LabComparisonResult {
  comparisonId: string;
  generatedAt: string;
  report1: { 
    title: string; 
    labName: string; 
    testDate?: string; 
    batchNo?: string; 
    overallStatus?: string;
    detectedLabOrg?: RecognizedLab;
  };
  report2: { 
    title: string; 
    labName: string; 
    testDate?: string; 
    batchNo?: string; 
    overallStatus?: string;
    detectedLabOrg?: RecognizedLab;
  };
  entries: ComparisonEntry[];
  metrics: {
    totalEvaluated: number;
    consistentCount: number;
    minorDiffCount: number;
    criticalDiffCount: number;
    agreementRatePercent: number;
    avgRpdPercent: number;
  };
  biasAssessment: LabBiasAssessment;
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

  // Nếu là số có %RPD
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
 * Xử lý đánh giá chuyên sâu cho dữ liệu ngưỡng phát hiện (Censored Data: KPH, < LOD, < LOQ)
 * theo chuẩn ICH Q2 & US EPA Methods
 */
export const evaluateCensoredDataRPD = (
  parsed1: ParsedLabValue,
  parsed2: ParsedLabValue,
  pass1?: boolean,
  pass2?: boolean
): {
  rpd: number | undefined;
  deviationLevel: ComparisonEntry['deviationLevel'];
  analysis?: string;
  isCensored: boolean;
} => {
  // Nếu có mâu thuẫn trực tiếp giữa cờ Đạt/Không đạt
  if (pass1 !== undefined && pass2 !== undefined && pass1 !== pass2) {
    return {
      rpd: undefined,
      deviationLevel: 'CRITICAL',
      analysis: 'Mâu thuẫn kết luận chất lượng: Một bên Đạt và một bên Không đạt.',
      isCensored: true
    };
  }

  // TH 1: Cả hai bên đều là Non-detect (KPH vs KPH, hoặc <0.05 vs <0.01)
  if (parsed1.isNonDetect && parsed2.isNonDetect) {
    return {
      rpd: 0,
      deviationLevel: 'EXCELLENT',
      analysis: 'Cả hai phòng lab đều không phát hiện (KPH / Âm tính) - Kết quả hoàn toàn đồng thuận.',
      isCensored: true
    };
  }

  // TH 2: Một bên là Non-detect và một bên là số thực
  if (parsed1.isNonDetect !== parsed2.isNonDetect) {
    const nonDetect = parsed1.isNonDetect ? parsed1 : parsed2;
    const numeric = parsed1.isNonDetect ? parsed2 : parsed1;
    const nonDetectLab = parsed1.isNonDetect ? 'Phiếu 1' : 'Phiếu 2';
    const numericLab = parsed1.isNonDetect ? 'Phiếu 2' : 'Phiếu 1';

    const numVal = numeric.numericValue;
    const limit = nonDetect.quantificationLimit ?? nonDetect.detectionLimit ?? nonDetect.numericValue;

    if (numVal !== undefined && limit !== undefined) {
      // Nếu giá trị định lượng nằm trong ngưỡng không phát hiện của bên kia (numVal <= limit)
      if (numVal <= limit) {
        return {
          rpd: 0,
          deviationLevel: 'ACCEPTABLE',
          analysis: `Tương thích ngưỡng phát hiện: ${numericLab} định lượng được ${numVal}, nằm trong giới hạn phát hiện (${limit}) của ${nonDetectLab}.`,
          isCensored: true
        };
      } else {
        // Giá trị thực vượt quá ngưỡng phát hiện: Áp dụng phương pháp thay thế L/2 theo chuẩn EPA
        const substitutedLimit = limit / 2;
        const rpd = calculateRPD(numVal, substitutedLimit);
        const level = rpd <= 25 ? 'WARNING' : 'CRITICAL';
        return {
          rpd,
          deviationLevel: level,
          analysis: `${numericLab} phát hiện (${numVal}) trong khi ${nonDetectLab} báo KPH (ngưỡng ${limit}). RPD ước lượng qua phương pháp thay thế LOD/2 là ${rpd}%.`,
          isCensored: true
        };
      }
    }

    return {
      rpd: undefined,
      deviationLevel: 'QUALITATIVE_DIFF',
      analysis: `${numericLab} ghi nhận định lượng trong khi ${nonDetectLab} ghi nhận không phát hiện.`,
      isCensored: true
    };
  }

  // TH 3: Cả hai bên đều là số thực
  if (parsed1.numericValue !== undefined && parsed2.numericValue !== undefined) {
    const rpd = calculateRPD(parsed1.numericValue, parsed2.numericValue);
    const deviationLevel = classifyDeviation(rpd, parsed1.rawValue, parsed2.rawValue, pass1, pass2);
    return {
      rpd,
      deviationLevel,
      isCensored: false
    };
  }

  // TH 4: Dạng định tính chuỗi thông thường
  const deviationLevel = classifyDeviation(undefined, parsed1.rawValue, parsed2.rawValue, pass1, pass2);
  return {
    rpd: undefined,
    deviationLevel,
    isCensored: false
  };
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
      
      const parsed1 = parseLabResultValue(item1.value, item1.unit, (item1 as any).analysisMethod);
      const parsed2 = parseLabResultValue(item2.value, item2.unit, (item2 as any).analysisMethod);

      const evalResult = evaluateCensoredDataRPD(parsed1, parsed2, item1.isPass, item2.isPass);

      matchedEntries.push({
        criteriaName: name1,
        source1Name: name1,
        source1Value: item1.value,
        source1Unit: item1.unit,
        source1Pass: item1.isPass,
        source1Method: (item1 as any).analysisMethod,
        source2Name: item2.criteriaName,
        source2Value: item2.value,
        source2Unit: item2.unit,
        source2Pass: item2.isPass,
        source2Method: (item2 as any).analysisMethod,
        limit: item1.limit || item2.limit,
        rpd: evalResult.rpd,
        deviationLevel: evalResult.deviationLevel,
        analysis: evalResult.analysis,
        isCensoredDataComparison: evalResult.isCensored,
        censoredDetails: evalResult.analysis
      });
    } else {
      matchedEntries.push({
        criteriaName: name1,
        source1Name: name1,
        source1Value: item1.value,
        source1Unit: item1.unit,
        source1Pass: item1.isPass,
        source1Method: (item1 as any).analysisMethod,
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
        source2Method: (item2 as any).analysisMethod,
        limit: item2.limit,
        deviationLevel: 'SINGLE_SOURCE'
      });
    }
  });

  return matchedEntries;
};

/**
 * Động cơ tính toán sai số hệ thống (Directional Lab Bias Engine)
 */
export const computeLabBias = (
  report1: LabReportSource,
  report2: LabReportSource,
  entries: ComparisonEntry[]
): LabBiasAssessment => {
  const commonEntries = entries.filter(e => e.deviationLevel !== 'SINGLE_SOURCE');
  
  let num1Higher = 0;
  let num2Higher = 0;
  let equalCount = 0;
  const biasValues: number[] = [];

  commonEntries.forEach(e => {
    const p1 = parseLabResultValue(e.source1Value);
    const p2 = parseLabResultValue(e.source2Value);

    if (p1.numericValue !== undefined && p2.numericValue !== undefined) {
      const v1 = p1.numericValue;
      const v2 = p2.numericValue;
      const avg = (Math.abs(v1) + Math.abs(v2)) / 2;

      if (avg > 0) {
        const signedDiffPercent = ((v1 - v2) / avg) * 100;
        biasValues.push(signedDiffPercent);

        if (Math.abs(v1 - v2) <= (avg * 0.02)) {
          equalCount++;
        } else if (v1 > v2) {
          num1Higher++;
        } else {
          num2Higher++;
        }
      }
    }
  });

  const totalNumericPairs = num1Higher + num2Higher + equalCount;
  const meanBiasPercent = biasValues.length > 0
    ? Math.round((biasValues.reduce((a, b) => a + b, 0) / biasValues.length) * 100) / 100
    : 0;

  const lab1Name = report1.labName || 'Phiếu 1';
  const lab2Name = report2.labName || 'Phiếu 2';

  let direction: LabBiasAssessment['direction'] = 'BALANCED';
  let biasRatio = 0;
  let isSystematic = false;
  let confidence: LabBiasAssessment['confidence'] = 'LOW';

  if (totalNumericPairs >= 3) {
    const ratio1 = (num1Higher / totalNumericPairs) * 100;
    const ratio2 = (num2Higher / totalNumericPairs) * 100;

    if (ratio1 >= 70 && Math.abs(meanBiasPercent) >= 3.0) {
      direction = 'SOURCE1_HIGHER';
      biasRatio = Math.round(ratio1);
      isSystematic = true;
      confidence = totalNumericPairs >= 5 ? 'HIGH' : 'MEDIUM';
    } else if (ratio2 >= 70 && Math.abs(meanBiasPercent) >= 3.0) {
      direction = 'SOURCE2_HIGHER';
      biasRatio = Math.round(ratio2);
      isSystematic = true;
      confidence = totalNumericPairs >= 5 ? 'HIGH' : 'MEDIUM';
    } else if (totalNumericPairs >= 4) {
      confidence = 'HIGH';
    }
  }

  let assessmentSummary = 'Không phát hiện sai số hệ thống rõ rệt giữa hai đơn vị thử nghiệm (độ lệch ngẫu nhiên trong giới hạn cho phép).';
  if (direction === 'SOURCE1_HIGHER') {
    assessmentSummary = `Phát hiện Sai số Hệ thống (Lab Bias): ${lab1Name} đo giá trị cao hơn ${lab2Name} ở ${biasRatio}% chỉ tiêu định lượng (độ lệch thiên vị trung bình +${Math.abs(meanBiasPercent)}%).`;
  } else if (direction === 'SOURCE2_HIGHER') {
    assessmentSummary = `Phát hiện Sai số Hệ thống (Lab Bias): ${lab2Name} đo giá trị cao hơn ${lab1Name} ở ${biasRatio}% chỉ tiêu định lượng (độ lệch thiên vị trung bình -${Math.abs(meanBiasPercent)}%).`;
  }

  const causes: string[] = [];
  if (isSystematic) {
    causes.push(`Độ lệch hệ thống ${direction === 'SOURCE1_HIGHER' ? lab1Name : lab2Name} đo cao hơn: Nghi ngờ chất chuẩn đối chiếu (Reference Standard) có độ tinh khiết công bố khác nhau.`);
    causes.push('Khác biệt về hiệu suất thu hồi mẫu (Extraction Recovery Rate) hoặc phương pháp chiết tách mẫu thử.');
    causes.push('Độ tuyến tính của đường chuẩn thiết bị phân tích (HPLC / GC / UV-Vis Detector Response Factor).');
  } else {
    causes.push('Độ dao động giữa hai phòng lab nằm trong giới hạn dung sai cho phép của phương pháp thử nghiệm liên phòng.');
  }

  const recommendations: string[] = [];
  if (isSystematic) {
    recommendations.push('Yêu cầu phòng lab ngoại kiểm cung cấp sắc ký đồ (Chromatogram Overlay) và hệ số đáp ứng pic để kiểm tra đối chiếu.');
    recommendations.push('Thực hiện thử nghiệm độ thu hồi mẫu thêm chuẩn (Spike Recovery Test) trên cùng một lô chất chuẩn đối chiếu.');
    recommendations.push('Rà soát lại quy trình hiệu chuẩn cân phân tích và micropipette tại cả hai phòng thử nghiệm.');
  } else {
    recommendations.push('Lưu hồ sơ đối chiếu vào báo cáo đánh giá năng lực phòng lab định kỳ (Inter-laboratory Proficiency Review).');
  }

  return {
    direction,
    source1HigherCount: num1Higher,
    source2HigherCount: num2Higher,
    equalCount,
    biasRatioPercent: biasRatio,
    isSystematic,
    meanBiasPercent,
    confidence,
    assessmentSummary,
    potentialCauses: causes,
    actionRecommendations: recommendations
  };
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

  const biasAssessment = computeLabBias(report1, report2, entries);

  const causes = [...biasAssessment.potentialCauses];
  if (critical.length > 0) {
    causes.unshift(`Có ${critical.length} chỉ tiêu lệch mức nghiêm trọng (>25% hoặc mâu thuẫn Đạt/Không đạt). Cần rà soát độ chuẩn xác phương pháp phân tích.`);
  }
  if (warnings.length > 0) {
    causes.unshift(`Có ${warnings.length} chỉ tiêu có độ lệch từ 12-25%, có thể do kỹ thuật chuẩn bị mẫu thử hoặc độ tinh khiết chất chuẩn khác nhau.`);
  }

  const recommendations = [...biasAssessment.actionRecommendations];
  if (critical.length > 0) {
    recommendations.unshift(`Thực hiện kiểm tra chéo lại (Re-test) các chỉ tiêu: ${critical.map(c => c.criteriaName).join(', ')} trên mẫu lưu.`);
  }

  return {
    summary: `Đối chiếu giữa "${report1.labName || 'Phiếu 1'}" và "${report2.labName || 'Phiếu 2'}" trên ${commonEntries.length} chỉ tiêu chung: ${excellent.length} chỉ tiêu đồng thuận, ${warnings.length} chỉ tiêu lệch vừa, ${critical.length} chỉ tiêu lệch nghiêm trọng.`,
    systematicBiasAssessment: biasAssessment.assessmentSummary,
    potentialCauses: causes,
    actionRecommendations: recommendations
  };
};

/**
 * Thực hiện đối chiếu toàn diện 2 phiếu kiểm nghiệm với sự hỗ trợ của AI và Censored Data Engine
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

  const biasAssessment = computeLabBias(report1, report2, entries);
  const detectedOrg1 = detectLabOrganization(report1.labName || report1.title);
  const detectedOrg2 = detectLabOrganization(report2.labName || report2.title);

  const baseResult: LabComparisonResult = {
    comparisonId,
    generatedAt: new Date().toISOString(),
    report1: {
      title: report1.title,
      labName: report1.labName,
      testDate: report1.testDate,
      batchNo: report1.batchNo,
      overallStatus: report1.overallStatus,
      detectedLabOrg: detectedOrg1
    },
    report2: {
      title: report2.title,
      labName: report2.labName,
      testDate: report2.testDate,
      batchNo: report2.batchNo,
      overallStatus: report2.overallStatus,
      detectedLabOrg: detectedOrg2
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
    biasAssessment,
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
- Đơn vị 1: ${report1.labName || 'Phiếu 1'} (${detectedOrg1}) (Lô: ${report1.batchNo || 'N/A'}, Ngày kiểm: ${report1.testDate || 'N/A'}, Trạng thái: ${report1.overallStatus || 'N/A'})
- Đơn vị 2: ${report2.labName || 'Phiếu 2'} (${detectedOrg2}) (Lô: ${report2.batchNo || 'N/A'}, Ngày kiểm: ${report2.testDate || 'N/A'}, Trạng thái: ${report2.overallStatus || 'N/A'})

KẾT QUẢ ĐỐI CHIẾU CHỈ TIÊU (RPD = Relative Percent Difference, Đã chuẩn hóa Censored Data):
${JSON.stringify(entries.filter(e => e.deviationLevel !== 'SINGLE_SOURCE'), null, 2)}

THỐNG KÊ LAB BIAS BAN ĐẦU:
${JSON.stringify(biasAssessment, null, 2)}

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
