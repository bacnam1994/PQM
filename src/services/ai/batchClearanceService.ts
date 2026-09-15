import { Batch, TestResult, TCCS, ProductFormula, Product, Criterion } from '../../types';
import { ensureArray, parseNumberFromText, formatDateStandard } from '../../utils';
import { EVALUATION_RULE } from '../../utils/constants';
import { isCriteriaMatch } from '../../utils/aiMapping';
import { CriterionEvaluator } from '../../domain/evaluation/CriterionEvaluator';
import { normalizeCriterionPassStatus } from '../../domain/test-result/testResultStatusResolver';
import { normalizeName } from '../../services/criteriaAliasService';
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
}

/**
 * Tính toán Thẩm định Chất lượng Lô sản xuất (Rule-based)
 */
export const evaluateBatchQualityClearance = (
  batch: any,
  batchTestResults: TestResult[],
  tccs?: TCCS,
  formula?: ProductFormula
): BatchClearanceDossier => {
  const batchId = batch.id;
  const batchNo = batch.batchNo || `Lô ${batchId}`;
  const productName = batch.product?.name || 'Sản phẩm';

  // 1. Tập hợp các chỉ tiêu bắt buộc từ TCCS
  const requiredCriteriaList: Criterion[] = tccs
    ? [...ensureArray(tccs.mainQualityCriteria), ...ensureArray(tccs.safetyCriteria)].filter(
        (c) => c && c.name && c.name.trim() !== ''
      )
    : [];

  // 2. Gom kết quả kiểm nghiệm của Lô
  const flatResults = batchTestResults
    .filter((r) => r.batchId === batchId)
    .flatMap((r) => ensureArray(r.results))
    .filter(Boolean);

  const testedMap = new Map<string, any>();
  flatResults.forEach((res) => {
    if (res && res.criteriaName) {
      testedMap.set(res.criteriaName.trim().toLowerCase(), res);
    }
  });

  const missingCriteria: string[] = [];
  const testedItems: CriterionClearanceItem[] = [];
  const nearLimitItems: CriterionClearanceItem[] = [];
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  let passedCount = 0;
  let failedCount = 0;

  const rules = tccs?.alternateRules || [];

  requiredCriteriaList.forEach((crit) => {
    const cName = crit.name.trim();
    // Tìm trong kết quả đã test
    let matchedRes = testedMap.get(cName.toLowerCase());
    if (!matchedRes) {
      // Thử tìm theo match
      for (const [resName, resObj] of testedMap.entries()) {
        if (isCriteriaMatch(cName, resName, [])) {
          matchedRes = resObj;
          break;
        }
      }
    }

    const minNum = crit.min !== undefined && crit.min !== null ? Number(crit.min) : undefined;
    const maxNum = crit.max !== undefined && crit.max !== null ? Number(crit.max) : undefined;
    const limitText =
      minNum !== undefined && maxNum !== undefined
        ? `${minNum} ~ ${maxNum}`
        : minNum !== undefined
          ? `≥ ${minNum}`
          : maxNum !== undefined
            ? `≤ ${maxNum}`
            : crit.expectedText || 'Theo TCCS';

    if (!matchedRes) {
      // CONDITIONAL_CHECK: Kiểm tra xem chỉ tiêu chưa kiểm tra này có thuộc chỉ tiêu phụ được miễn kiểm không?
      const condRuleWhereThisIsAlt = rules.find(
        (r) =>
          r.type === EVALUATION_RULE.CONDITIONAL_CHECK &&
          (isCriteriaMatch(cName, r.alt, []) || normalizeName(cName) === normalizeName(r.alt))
      );

      let isExempted = false;
      if (condRuleWhereThisIsAlt) {
        const mainRes =
          testedMap.get(condRuleWhereThisIsAlt.main.toLowerCase()) ||
          Array.from(testedMap.values()).find((res) =>
            isCriteriaMatch(condRuleWhereThisIsAlt.main, res.criteriaName, [])
          );
        if (mainRes && mainRes.value !== undefined && mainRes.value !== '') {
          const isTriggered = CriterionEvaluator.checkRange(
            condRuleWhereThisIsAlt.conditionValue || '',
            String(mainRes.value)
          );
          if (isTriggered !== true) {
            isExempted = true; // Điều kiện không kích hoạt -> Miễn kiểm theo Dược điển
          }
        }
      }

      if (!isExempted) {
        missingCriteria.push(cName);
      }
    } else {
      let isPass = normalizeCriterionPassStatus(matchedRes.isPass) !== false;

      // Nếu rớt, kiểm tra xem có quy tắc alternateRules nào cứu không
      if (!isPass) {
        // 1. CONDITIONAL_CHECK: Nếu chỉ tiêu phụ này được miễn kiểm
        const condRule = rules.find(
          (r) =>
            r.type === EVALUATION_RULE.CONDITIONAL_CHECK &&
            (isCriteriaMatch(cName, r.alt, []) || normalizeName(cName) === normalizeName(r.alt))
        );
        if (condRule) {
          const mainRes =
            testedMap.get(condRule.main.toLowerCase()) ||
            Array.from(testedMap.values()).find((res) =>
              isCriteriaMatch(condRule.main, res.criteriaName, [])
            );
          if (mainRes && mainRes.value !== undefined && mainRes.value !== '') {
            const isTriggered = CriterionEvaluator.checkRange(
              condRule.conditionValue || '',
              String(mainRes.value)
            );
            if (isTriggered !== true) {
              isPass = true; // Được miễn kiểm
            }
          }
        }

        // 2. FAIL_RETRY: Nếu có chỉ tiêu thử lại đạt
        if (!isPass) {
          const retryRule = rules.find(
            (r) =>
              (!r.type || r.type === EVALUATION_RULE.FAIL_RETRY) &&
              (isCriteriaMatch(cName, r.main, []) || normalizeName(cName) === normalizeName(r.main))
          );
          if (retryRule) {
            const altRes =
              testedMap.get(retryRule.alt.toLowerCase()) ||
              Array.from(testedMap.values()).find((res) =>
                isCriteriaMatch(retryRule.alt, res.criteriaName, [])
              );
            if (altRes && normalizeCriterionPassStatus(altRes.isPass) === true) {
              isPass = true; // Đã được cứu bởi kết quả thử lại đạt
            }
          }
        }
      }

      if (isPass) passedCount++;
      else failedCount++;

      let isNearLimit = false;
      let nearLimitWarning: string | undefined = undefined;

      // Kiểm tra xem giá trị đo có tiệm cận ngưỡng giới hạn không (trong khoảng 5% biên)
      if (typeof matchedRes.value === 'number' || !isNaN(Number(matchedRes.value))) {
        const valNum = Number(matchedRes.value);
        if (minNum !== undefined && maxNum !== undefined) {
          const range = maxNum - minNum;
          if (range > 0) {
            if (valNum <= minNum + range * 0.08) {
              isNearLimit = true;
              nearLimitWarning = `Sát giới hạn tối thiểu (${valNum} ≈ Min ${minNum})`;
            } else if (valNum >= maxNum - range * 0.08) {
              isNearLimit = true;
              nearLimitWarning = `Sát giới hạn tối đa (${valNum} ≈ Max ${maxNum})`;
            }
          }
        } else if (minNum !== undefined && valNum <= minNum * 1.03) {
          isNearLimit = true;
          nearLimitWarning = `Sát giới hạn dưới (${valNum} ≈ ${minNum})`;
        } else if (maxNum !== undefined && valNum >= maxNum * 0.97) {
          isNearLimit = true;
          nearLimitWarning = `Sát giới hạn trên (${valNum} ≈ ${maxNum})`;
        }
      }

      const clearanceItem: CriterionClearanceItem = {
        criteriaName: cName,
        expectedLimit: limitText,
        actualValue: matchedRes.value,
        unit: crit.unit || matchedRes.unit,
        isPass,
        isNearLimit,
        nearLimitWarning,
      };

      testedItems.push(clearanceItem);
      if (isNearLimit) {
        nearLimitItems.push(clearanceItem);
      }
    }
  });

  // 3. Tính điểm sẵn sàng xuất xưởng (Readiness Score 0 - 100)
  let readinessScore = 100;

  if (requiredCriteriaList.length > 0) {
    const testedRatio =
      (requiredCriteriaList.length - missingCriteria.length) / requiredCriteriaList.length;
    if (testedRatio < 1) {
      readinessScore -= Math.round((1 - testedRatio) * 40);
      riskFactors.push(
        `Chưa kiểm tra đầy đủ ${missingCriteria.length}/${requiredCriteriaList.length} chỉ tiêu theo TCCS.`
      );
      recommendations.push(
        `Cần bổ sung kết quả kiểm nghiệm cho các chỉ tiêu còn thiếu: ${missingCriteria.join(', ')}.`
      );
    }
  }

  if (failedCount > 0) {
    readinessScore -= failedCount * 30;
    riskFactors.push(`Có ${failedCount} chỉ tiêu KHÔNG ĐẠT (OOS) so với tiêu chuẩn cơ sở.`);
    recommendations.push(`Bắt buộc mở quy trình điều tra OOS/CAPA trước khi đưa ra quyết định.`);
  }

  if (nearLimitItems.length > 0) {
    readinessScore -= nearLimitItems.length * 5;
    riskFactors.push(
      `Có ${nearLimitItems.length} chỉ tiêu đạt nhưng ở vùng ranh giới tiệm cận ngưỡng giới hạn.`
    );
    recommendations.push(
      `Theo dõi chặt chẽ độ ổn định các chỉ tiêu cận ngưỡng: ${nearLimitItems.map((i) => i.criteriaName).join(', ')}.`
    );
  }

  readinessScore = Math.max(0, Math.min(100, readinessScore));

  // 4. Kết luận Verdict
  let verdict: ClearanceVerdict = 'READY_FOR_RELEASE';
  if (failedCount > 0 || missingCriteria.length > 2 || readinessScore < 60) {
    verdict = 'HOLD_FOR_INVESTIGATION';
  } else if (missingCriteria.length > 0 || nearLimitItems.length > 0 || readinessScore < 90) {
    verdict = 'CONDITIONAL_RELEASE';
  }

  // 5. Tóm tắt Executive Summary
  let summary = '';
  if (verdict === 'READY_FOR_RELEASE') {
    summary = `Lô ${batchNo} (${productName}) đạt 100% các chỉ tiêu kiểm nghiệm theo TCCS. Dữ liệu chất lượng ổn định, không ghi nhận bất thường. ĐỦ ĐIỀU KIỆN XUẤT XƯỞNG (RELEASE).`;
  } else if (verdict === 'CONDITIONAL_RELEASE') {
    summary = `Lô ${batchNo} (${productName}) đáp ứng phần lớn chỉ tiêu (Điểm chất lượng: ${readinessScore}/100), tuy nhiên còn ${missingCriteria.length > 0 ? `${missingCriteria.length} chỉ tiêu chưa hoàn tất` : ''}${missingCriteria.length > 0 && nearLimitItems.length > 0 ? ' và ' : ''}${nearLimitItems.length > 0 ? `${nearLimitItems.length} chỉ tiêu tiệm cận giới hạn` : ''}. CẦN XEM XÉT DUYỆT CÓ ĐIỀU KIỆN HOẶC KIỂM TRA LẠI.`;
  } else {
    summary = `Lô ${batchNo} (${productName}) KHÔNG ĐỦ ĐIỀU KIỆN XUẤT XƯỞNG (Điểm chất lượng: ${readinessScore}/100). Ghi nhận ${failedCount > 0 ? `${failedCount} chỉ tiêu OOS không đạt` : `${missingCriteria.length} chỉ tiêu quan trọng chưa kiểm nghiệm`}. YÊU CẦU TẠM GIỮ LÔ ĐỂ ĐIỀU TRA (HOLD FOR INVESTIGATION).`;
  }

  return {
    batchId,
    batchNo,
    productName,
    mfgDate: batch.mfgDate,
    expDate: batch.expDate,
    totalRequiredCriteria: requiredCriteriaList.length,
    testedCriteriaCount: testedItems.length,
    missingCriteria,
    passedCount,
    failedCount,
    verdict,
    readinessScore,
    nearLimitItems,
    testedItems,
    riskFactors,
    recommendations,
    executiveSummary: summary,
    generatedAt: new Date().toISOString(),
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
 * Làm giàu thẩm định Lô bằng AI Gemini – dùng Structured Outputs (JSON Schema)
 * để đảm bảo phản hồi luôn đúng cấu trúc, loại bỏ rủi ro JSON.parse thủ công.
 */
export const enrichBatchClearanceWithAI = async (
  dossier: BatchClearanceDossier
): Promise<BatchClearanceDossier> => {
  const apiKey = getApiKey();
  if (!apiKey) return dossier;

  try {
    const prompt = `Bạn là Chuyên gia Đảm bảo Chất lượng Dược phẩm (Senior QA Manager) theo tiêu chuẩn GMP-WHO.
Hãy thẩm định và đưa ra nhận xét chuyên môn cho hồ sơ lô sản xuất sau:

- Sản phẩm: ${dossier.productName}
- Số lô: ${dossier.batchNo} (Ngày SX: ${dossier.mfgDate || 'N/A'}, Hạn dùng: ${dossier.expDate || 'N/A'})
- Tổng số chỉ tiêu TCCS: ${dossier.totalRequiredCriteria} (Đã kiểm: ${dossier.testedCriteriaCount}, Chưa kiểm: ${dossier.missingCriteria.join(', ') || '0'})
- Kết quả: ${dossier.passedCount} Đạt / ${dossier.failedCount} Không Đạt
- Chỉ tiêu sát ngưỡng giới hạn: ${dossier.nearLimitItems.map((i) => `${i.criteriaName}: ${i.actualValue} (Ngưỡng: ${i.expectedLimit})`).join('; ') || 'Không có'}
- Điểm đánh giá sẵn sàng: ${dossier.readinessScore}/100
- Đề xuất sơ bộ: ${dossier.verdict}

Hãy viết nhận xét chuyên môn, đưa ra các rủi ro tiềm ẩn và các khuyến nghị hành động cho Trưởng phòng QA.`;

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
