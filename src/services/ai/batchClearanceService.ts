import { Batch, TestResult, TCCS, ProductFormula, Product, Criterion } from '../../types';
import { ensureArray, parseNumberFromText, formatDateStandard } from '../../utils';
import { CanonicalStatusResolver } from '../../domain/canonical/canonicalResolver';
import { ReleaseRules } from '../../domain/rules/ReleaseRules';
import { getApiKey, geminiService } from './geminiService';
import { SchemaType } from '@google/generative-ai';

export type ClearanceVerdict =
  | 'READY_FOR_RELEASE'
  | 'CONDITIONAL_RELEASE'
  | 'HOLD_FOR_INVESTIGATION';

export interface CriterionClearanceItem {
  criteriaName: string;
  expectedLimit: string;
  actualValue: string | number;
  unit?: string;
  isPass: boolean;
  isNearLimit?: boolean;
  nearLimitWarning?: string;
}

export interface BatchClearanceDossier {
  batchId: string;
  batchNo: string;
  productName: string;
  mfgDate?: string;
  expDate?: string;
  totalRequiredCriteria: number;
  testedCriteriaCount: number;
  missingCriteria: string[];
  passedCount: number;
  failedCount: number;
  verdict: ClearanceVerdict;
  readinessScore: number; // 0 - 100
  nearLimitItems: CriterionClearanceItem[];
  testedItems: CriterionClearanceItem[];
  riskFactors: string[];
  recommendations: string[];
  executiveSummary: string;
  generatedAt: string;
  decisionTrace?: any;
}

/**
 * Tính toán Thẩm định Chất lượng Lô sản xuất:
 * KIẾN TRÚC MỚI: Canonical Evaluation -> Release Gate -> Clearance Dossier -> AI Narrative.
 * Tuyệt đối không duy trì công thức đánh giá thứ 2; toàn bộ sự thật thuộc về CanonicalStatusResolver & ReleaseRules.
 */
export const evaluateBatchQualityClearance = (
  batch: any,
  batchTestResults: TestResult[],
  tccs?: TCCS,
  formula?: ProductFormula
): BatchClearanceDossier => {
  const batchId = batch?.id || '';
  const batchNo = batch?.batchNo || `Lô ${batchId}`;
  const productName = batch?.product?.name || 'Sản phẩm';

  // 1. Phân giải chất lượng chuẩn hóa từ CanonicalStatusResolver (SSoT)
  const qualityRes = CanonicalStatusResolver.resolveBatchQuality(batch, batchTestResults, tccs);
  const trace = qualityRes.decisionTrace;

  // 2. Thẩm định điều kiện xuất xưởng từ Release Gate
  const releasePrereq = ReleaseRules.evaluateReleasePrerequisites({
    batch,
    testResults: batchTestResults,
    boundTccs: tccs,
  });

  const missingCriteria: string[] = trace?.completion.missingCriteria || [];
  const testedItems: CriterionClearanceItem[] = [];
  const nearLimitItems: CriterionClearanceItem[] = [];
  const riskFactors: string[] = [...(releasePrereq.blockers || [])];
  const recommendations: string[] = [];

  // 3. Trích xuất danh sách chỉ tiêu đã kiểm nghiệm kèm rà soát cận ngưỡng (Near-Limit Check)
  const critDetails = trace?.criterionEvaluations || [];
  critDetails.forEach((crit) => {
    if (crit.status === 'PENDING') return; // Chưa kiểm thì nằm trong missingCriteria

    let isNearLimit = false;
    let nearLimitWarning: string | undefined;

    const actualValNum =
      typeof crit.actualValue === 'number'
        ? crit.actualValue
        : parseNumberFromText(String(crit.actualValue));

    // Rà soát khoảng min - max hoặc cận 1 phía để phát hiện tiệm cận ngưỡng trong vòng 8% biên
    if (!isNaN(actualValNum) && crit.expectedLimit) {
      const matchRange = crit.expectedLimit.match(/([0-9.]+)\s*(?:~|-)\s*([0-9.]+)/);
      const matchMaxOnly = crit.expectedLimit.match(/(?:≤|<=|\bmax\b)\s*([0-9.]+)/i);
      const matchMinOnly = crit.expectedLimit.match(/(?:≥|>=|\bmin\b)\s*([0-9.]+)/i);

      if (matchRange) {
        const minNum = parseFloat(matchRange[1]);
        const maxNum = parseFloat(matchRange[2]);
        const range = maxNum - minNum;
        if (range > 0) {
          if (actualValNum <= minNum + range * 0.08) {
            isNearLimit = true;
            nearLimitWarning = `Sát giới hạn tối thiểu (${actualValNum} ≈ Min ${minNum})`;
          } else if (actualValNum >= maxNum - range * 0.08) {
            isNearLimit = true;
            nearLimitWarning = `Sát giới hạn tối đa (${actualValNum} ≈ Max ${maxNum})`;
          }
        }
      } else if (matchMaxOnly) {
        const maxNum = parseFloat(matchMaxOnly[1]);
        if (maxNum > 0 && actualValNum >= maxNum * 0.92) {
          isNearLimit = true;
          nearLimitWarning = `Sát giới hạn tối đa (${actualValNum} ≈ Max ${maxNum})`;
        }
      } else if (matchMinOnly) {
        const minNum = parseFloat(matchMinOnly[1]);
        if (minNum > 0 && actualValNum <= minNum * 1.08) {
          isNearLimit = true;
          nearLimitWarning = `Sát giới hạn tối thiểu (${actualValNum} ≈ Min ${minNum})`;
        }
      }
    }

    const item: CriterionClearanceItem = {
      criteriaName: crit.criterionName,
      expectedLimit: crit.expectedLimit,
      actualValue: crit.actualValue,
      unit: crit.unit,
      isPass: crit.isPass === true,
      isNearLimit,
      nearLimitWarning,
    };

    testedItems.push(item);
    if (isNearLimit) {
      nearLimitItems.push(item);
    }
  });

  if (qualityRes.criteriaSummary.fail > 0) {
    riskFactors.push(
      `Có ${qualityRes.criteriaSummary.fail} chỉ tiêu KHÔNG ĐẠT (OOS) so với tiêu chuẩn cơ sở.`
    );
  }

  if (nearLimitItems.length > 0) {
    riskFactors.push(
      `Có ${nearLimitItems.length} chỉ tiêu đạt nhưng ở vùng ranh giới tiệm cận ngưỡng giới hạn.`
    );
    recommendations.push(
      `Theo dõi chặt chẽ độ ổn định các chỉ tiêu cận ngưỡng: ${nearLimitItems.map((i) => i.criteriaName).join(', ')}.`
    );
  }

  // 4. Quyết định Verdict dựa trên Release Gate và Canonical Quality
  let verdict: ClearanceVerdict = 'READY_FOR_RELEASE';
  if (
    qualityRes.batchQualityStatus === 'FAIL' ||
    qualityRes.criteriaSummary.fail > 0 ||
    releasePrereq.criteriaMet.noCriticalOpenDeviations === false
  ) {
    verdict = 'HOLD_FOR_INVESTIGATION';
    recommendations.push(
      'Bắt buộc mở quy trình điều tra OOS/CAPA hoặc giải quyết sai lệch trước khi xem xét lại.'
    );
  } else if (
    !releasePrereq.isEligibleForRelease ||
    qualityRes.batchQualityStatus !== 'PASS' ||
    nearLimitItems.length > 0
  ) {
    verdict = 'CONDITIONAL_RELEASE';
    if (missingCriteria.length > 0) {
      recommendations.push(
        `Cần bổ sung kết quả kiểm nghiệm cho các chỉ tiêu còn thiếu: ${missingCriteria.join(', ')}.`
      );
    }
  }

  let readinessScore = releasePrereq.score;
  if (qualityRes.criteriaSummary.fail > 0) {
    readinessScore = Math.min(
      readinessScore,
      Math.max(0, 100 - qualityRes.criteriaSummary.fail * 30)
    );
  }
  if (nearLimitItems.length > 0) {
    readinessScore = Math.max(0, readinessScore - nearLimitItems.length * 5);
  }

  // 5. Tóm tắt Executive Summary chuẩn mực
  let summary = '';
  if (verdict === 'READY_FOR_RELEASE') {
    summary = `Lô ${batchNo} (${productName}) đạt 100% các chỉ tiêu kiểm nghiệm theo TCCS. Dữ liệu chất lượng ổn định, không ghi nhận bất thường. ĐỦ ĐIỀU KIỆN XUẤT XƯỞNG (RELEASE).`;
  } else if (verdict === 'CONDITIONAL_RELEASE') {
    summary = `Lô ${batchNo} (${productName}) đáp ứng phần lớn chỉ tiêu (Điểm sẵn sàng: ${readinessScore}/100), tuy nhiên còn ${missingCriteria.length > 0 ? `${missingCriteria.length} chỉ tiêu chưa hoàn tất` : ''}${missingCriteria.length > 0 && nearLimitItems.length > 0 ? ' và ' : ''}${nearLimitItems.length > 0 ? `${nearLimitItems.length} chỉ tiêu tiệm cận giới hạn` : ''}. CẦN XEM XÉT DUYỆT CÓ ĐIỀU KIỆN HOẶC KIỂM TRA LẠI.`;
  } else {
    summary = `Lô ${batchNo} (${productName}) KHÔNG ĐỦ ĐIỀU KIỆN XUẤT XƯỞNG (Điểm sẵn sàng: ${readinessScore}/100). Ghi nhận ${qualityRes.criteriaSummary.fail > 0 ? `${qualityRes.criteriaSummary.fail} chỉ tiêu OOS không đạt` : `${missingCriteria.length} chỉ tiêu quan trọng chưa kiểm nghiệm`}. YÊU CẦU TẠM GIỮ LÔ ĐỂ ĐIỀU TRA (HOLD FOR INVESTIGATION).`;
  }

  return {
    batchId,
    batchNo,
    productName,
    mfgDate: batch?.mfgDate,
    expDate: batch?.expDate,
    totalRequiredCriteria: trace?.completion.requiredCount || testedItems.length,
    testedCriteriaCount: testedItems.length,
    missingCriteria,
    passedCount: qualityRes.criteriaSummary.pass,
    failedCount: qualityRes.criteriaSummary.fail,
    verdict,
    readinessScore,
    nearLimitItems,
    testedItems,
    riskFactors,
    recommendations,
    executiveSummary: summary,
    generatedAt: new Date().toISOString(),
    decisionTrace: trace,
  };
};

// ─── JSON Schema cho phản hồi AI Thẩm định Lô ─────────────────────────────
const CLEARANCE_AI_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    executiveSummary: {
      type: SchemaType.STRING,
      description:
        'Đoạn văn ngắn 3-4 câu nhận xét tổng quan chất lượng lô và khuyến nghị xuất xưởng chính thức theo tiêu chuẩn GMP-WHO',
    },
    riskFactors: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING, description: 'Một yếu tố rủi ro chất lượng tiềm ẩn' },
      description: 'Danh sách 2-3 rủi ro chất lượng tiềm ẩn của lô này',
    },
    recommendations: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING, description: 'Một hành động khuyến nghị cụ thể' },
      description: 'Danh sách 2-3 hành động khuyến nghị cho Trưởng phòng QA trước khi ký duyệt',
    },
  },
  required: ['executiveSummary', 'riskFactors', 'recommendations'],
} as const;

/**
 * Làm giàu thẩm định Lô bằng AI Gemini – tuân thủ nghiêm ngặt PRINCIPLE-009 (AI is Advisory).
 * AI chỉ cung cấp lời giải thích và nhận định hỗ trợ, tuyệt đối không được ghi đè verdict,
 * điểm sẵn sàng, hoặc các số liệu thực chứng đã được Canonical Engine thẩm định.
 */
export const enrichBatchClearanceWithAI = async (
  dossier: BatchClearanceDossier
): Promise<BatchClearanceDossier> => {
  const apiKey = getApiKey();
  if (!apiKey) return dossier;

  try {
    const prompt = `Bạn là Chuyên gia Đảm bảo Chất lượng Dược phẩm (Senior QA Manager) theo tiêu chuẩn GMP-WHO.
Hãy thẩm định và đưa ra nhận xét chuyên môn hỗ trợ Trưởng phòng QA cho hồ sơ lô sản xuất sau:

- Sản phẩm: ${dossier.productName}
- Số lô: ${dossier.batchNo} (Ngày SX: ${dossier.mfgDate || 'N/A'}, Hạn dùng: ${dossier.expDate || 'N/A'})
- Tổng số chỉ tiêu TCCS: ${dossier.totalRequiredCriteria} (Đã kiểm: ${dossier.testedCriteriaCount}, Chưa kiểm: ${dossier.missingCriteria.join(', ') || '0'})
- Kết quả kiểm nghiệm: ${dossier.passedCount} Đạt / ${dossier.failedCount} Không Đạt
- Chỉ tiêu sát ngưỡng giới hạn: ${dossier.nearLimitItems.map((i) => `${i.criteriaName}: ${i.actualValue} (Ngưỡng: ${i.expectedLimit})`).join('; ') || 'Không có'}
- Điểm đánh giá sẵn sàng: ${dossier.readinessScore}/100
- Trạng thái thẩm định kỹ thuật (Canonical Verdict): ${dossier.verdict}

Lưu ý: Bạn là trợ lý tư vấn (Advisory). Hãy giải thích nguyên nhân rủi ro, phân tích xu hướng chất lượng và đưa ra các khuyến nghị hành động thiết thực cho Trưởng phòng QA.`;

    const parsed = await geminiService.generateStructuredJson<{
      executiveSummary: string;
      riskFactors: string[];
      recommendations: string[];
    }>(prompt, CLEARANCE_AI_SCHEMA, undefined, undefined, 0.2);

    return {
      ...dossier,
      executiveSummary: parsed.executiveSummary || dossier.executiveSummary,
      riskFactors:
        Array.isArray(parsed.riskFactors) && parsed.riskFactors.length > 0
          ? parsed.riskFactors
          : dossier.riskFactors,
      recommendations:
        Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
          ? parsed.recommendations
          : dossier.recommendations,
    };
  } catch (err) {
    console.warn('AI clearance enrichment error:', err);
    return dossier;
  }
};
