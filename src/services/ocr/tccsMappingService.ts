/**
 * src/services/ocr/tccsMappingService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * OCR-10: TCCS / Criteria Mapping Engine (Tầng Ánh Xạ Chỉ Tiêu Độc Lập)
 *
 * Thực thi Rule 10 (Tách Bạch Tuyệt Đối Extraction vs Mapping):
 * - Bước Extraction đã hoàn thành trong `geminiService.ts` / `tesseractFallback.ts`.
 * - Module này chỉ nhận dữ liệu thô đã trích xuất rồi đối chiếu với danh mục TCCS.
 * - Lỗi ở tầng Mapping TUYỆT ĐỐI KHÔNG ghi đè dữ liệu thô đã trích xuất.
 *
 * Đầu vào: Mảng `ExtractedCriterionItem[]` (từ Gemini / Tesseract)
 * Đầu ra:  `MappingReport` — danh sách chỉ tiêu đã ánh xạ, kèm đầy đủ
 *           metadata: `unit`, `limit`, `confidence`, `sourcePageNumber`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { isCriteriaMatch, normalizeUnit, lookupPharmaTerm } from '../../utils/aiMapping';
import type { AILearnedMapping } from '../../types';
import type { ExtractedCriterionItem } from './types';

// ─── Public Types ─────────────────────────────────────────────────────────────

/** Cấp độ tin cậy của kết quả ánh xạ */
export type MappingConfidenceLevel = 'LEARNED' | 'EXACT' | 'DICTIONARY' | 'FUZZY' | 'UNMATCHED';

/** Kết quả ánh xạ của một chỉ tiêu duy nhất */
export interface MappedCriterionResult {
  /** Tên gốc trích xuất từ phiếu (bất biến, không được sửa đổi) */
  rawCriteriaName: string;
  /** Tên chuẩn trong danh mục TCCS (null nếu không khớp) */
  systemCriteriaName: string | null;
  /** Cấp độ tin cậy của bước ánh xạ */
  mappingConfidence: MappingConfidenceLevel;
  /** Điểm số ánh xạ (0–100) — độc lập với extractionConfidence (Rule 11) */
  mappingScore: number;
  /** Giá trị kết quả thực tế — bảo toàn nguyên bản từ extraction (Rule 1, 3) */
  value: string;
  /** Đơn vị đo đã chuẩn hóa (Rule 4) */
  unit: string;
  /** Mức giới hạn/tiêu chuẩn — phân tách tuyệt đối với value (Rule 5) */
  limit: string;
  /** Số trang nguồn (Rule 7) */
  sourcePageNumber: number;
  /** Điểm tin cậy trích xuất OCR gốc (Rule 11: không bao giờ bị ghi đè bởi mappingScore) */
  extractionConfidenceScore: number;
  /** Tên thuật ngữ chuẩn hóa tìm được trong từ điển dược khoa */
  resolvedDictionaryTerm: string | null;
  /** Có bị gắn cờ cần xác nhận thủ công không */
  requiresManualConfirmation: boolean;
}

/** Báo cáo kết quả toàn bộ quá trình ánh xạ tài liệu */
export interface MappingReport {
  /** Tất cả các chỉ tiêu đã xử lý */
  allMapped: MappedCriterionResult[];
  /** Chỉ tiêu khớp chắc chắn với TCCS (LEARNED / EXACT / DICTIONARY) → an toàn điền tự động */
  highConfidenceMapped: MappedCriterionResult[];
  /** Chỉ tiêu không khớp hoặc FUZZY → cần xác nhận thủ công */
  lowConfidenceMapped: MappedCriterionResult[];
  /** Chỉ tiêu không khớp với bất kỳ chỉ tiêu nào trong TCCS → extra criteria */
  unmatchedItems: MappedCriterionResult[];
  totalItems: number;
  matchedCount: number;
  unmatchedCount: number;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Tra cứu trong Learned Mappings và trả về tên hệ thống nếu tìm thấy */
function findLearnedMapping(
  rawName: string,
  tccsName: string,
  learnedMappings: AILearnedMapping[]
): boolean {
  const relevant = learnedMappings
    .filter((m) => m.systemName === tccsName)
    .sort((a, b) => b.frequency - a.frequency);
  for (const mapping of relevant) {
    if (rawName.trim().toLowerCase() === mapping.originalName.trim().toLowerCase()) {
      return true;
    }
  }
  return false;
}

/** Xác định cấp độ ánh xạ và điểm số */
function determineMappingLevel(
  rawName: string,
  tccsName: string,
  learnedMappings: AILearnedMapping[]
): { level: MappingConfidenceLevel; score: number } {
  const normRaw = rawName.trim().toLowerCase();
  const normTccs = tccsName.trim().toLowerCase();

  // 1. Khớp từ Learned Mappings (cao nhất)
  if (findLearnedMapping(rawName, tccsName, learnedMappings)) {
    return { level: 'LEARNED', score: 98 };
  }

  // 2. Khớp chính xác (exact)
  if (normRaw === normTccs) {
    return { level: 'EXACT', score: 95 };
  }

  // 3. Khớp từ điển dược khoa
  const dictRaw = lookupPharmaTerm(rawName);
  const dictTccs = lookupPharmaTerm(tccsName);
  if (dictRaw && dictTccs && dictRaw === dictTccs) {
    return { level: 'DICTIONARY', score: 88 };
  }
  if (dictRaw && dictRaw.trim().toLowerCase() === normTccs) {
    return { level: 'DICTIONARY', score: 85 };
  }
  if (dictTccs && dictTccs.trim().toLowerCase() === normRaw) {
    return { level: 'DICTIONARY', score: 85 };
  }

  // 4. Fuzzy (chứa nhau)
  if (
    normRaw.length >= 4 &&
    normTccs.length >= 4 &&
    (normRaw.includes(normTccs) || normTccs.includes(normRaw))
  ) {
    return { level: 'FUZZY', score: 70 };
  }

  return { level: 'UNMATCHED', score: 0 };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Ánh xạ danh sách chỉ tiêu OCR thô vào danh sách tên chỉ tiêu chuẩn TCCS.
 *
 * @param extractedItems  - Kết quả trích xuất từ Gemini / Tesseract
 * @param tccsNames       - Danh sách tên chỉ tiêu chuẩn từ TCCS đang áp dụng
 * @param learnedMappings - Ánh xạ đã học từ các lần xác nhận trước của người dùng
 * @returns MappingReport
 */
export function mapOcrResultsToTccs(
  extractedItems: ExtractedCriterionItem[],
  tccsNames: string[],
  learnedMappings: AILearnedMapping[] = []
): MappingReport {
  const allMapped: MappedCriterionResult[] = [];
  const highConfidenceMapped: MappedCriterionResult[] = [];
  const lowConfidenceMapped: MappedCriterionResult[] = [];
  const unmatchedItems: MappedCriterionResult[] = [];

  for (const item of extractedItems) {
    // Tìm tên TCCS khớp nhất
    let bestMatch: { tccsName: string; level: MappingConfidenceLevel; score: number } | null = null;

    for (const tccsName of tccsNames) {
      if (!isCriteriaMatch(item.criteriaName, tccsName, learnedMappings)) continue;

      const { level, score } = determineMappingLevel(item.criteriaName, tccsName, learnedMappings);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { tccsName, level, score };
      }
    }

    // Tra từ điển để ghi nhận tên thuật ngữ chuẩn
    const resolvedDictionaryTerm = lookupPharmaTerm(item.criteriaName);

    const baseExtractionScore =
      typeof item.confidenceScore === 'number' && !isNaN(item.confidenceScore)
        ? item.confidenceScore
        : item.confidence === 'high'
          ? 90
          : item.confidence === 'medium'
            ? 75
            : 55;

    const result: MappedCriterionResult = {
      rawCriteriaName: item.criteriaName,
      systemCriteriaName: bestMatch?.tccsName ?? null,
      mappingConfidence: bestMatch?.level ?? 'UNMATCHED',
      mappingScore: bestMatch?.score ?? 0,
      // Rule 1, 3, 4: Bảo toàn nguyên bản dữ liệu thô
      value: item.value ?? '',
      unit: normalizeUnit(item.unit ?? ''),
      limit: item.limit ?? '',
      sourcePageNumber: item.sourcePageNumber ?? 1,
      // Rule 11: Điểm extraction hoàn toàn độc lập với mappingScore
      extractionConfidenceScore: baseExtractionScore,
      resolvedDictionaryTerm,
      // Cần xác nhận thủ công nếu: không khớp hoặc chỉ FUZZY hoặc extraction thấp
      requiresManualConfirmation:
        !bestMatch ||
        bestMatch.level === 'UNMATCHED' ||
        bestMatch.level === 'FUZZY' ||
        baseExtractionScore < 75,
    };

    allMapped.push(result);

    if (result.systemCriteriaName === null || result.mappingConfidence === 'UNMATCHED') {
      unmatchedItems.push(result);
    } else if (result.requiresManualConfirmation) {
      lowConfidenceMapped.push(result);
    } else {
      highConfidenceMapped.push(result);
    }
  }

  return {
    allMapped,
    highConfidenceMapped,
    lowConfidenceMapped,
    unmatchedItems,
    totalItems: extractedItems.length,
    matchedCount: allMapped.length - unmatchedItems.length,
    unmatchedCount: unmatchedItems.length,
  };
}

/**
 * Chuyển đổi `MappedCriterionResult` thành định dạng `AIExtractedItem`
 * tương thích với `MappingConfirmModal`.
 * Bảo toàn đầy đủ: value, unit, limit, sourcePageNumber, confidenceScore.
 */
export function mappedResultToAIExtractedItem(result: MappedCriterionResult) {
  return {
    criteriaName: result.rawCriteriaName,
    mappedName: result.systemCriteriaName ?? '',
    confidence:
      result.mappingScore >= 88 && result.extractionConfidenceScore >= 75
        ? ('high' as const)
        : ('low' as const),
    confidenceScore: result.extractionConfidenceScore,
    value: result.value,
    unit: result.unit,
    limit: result.limit,
    sourcePageNumber: result.sourcePageNumber,
    // Metadata bổ sung cho Review UI (OCR-11)
    mappingScore: result.mappingScore,
    mappingConfidenceLevel: result.mappingConfidence,
    resolvedDictionaryTerm: result.resolvedDictionaryTerm,
    requiresManualConfirmation: result.requiresManualConfirmation,
  };
}
