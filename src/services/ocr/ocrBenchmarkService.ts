/**
 * src/services/ocr/ocrBenchmarkService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Engine tính toán độ chính xác và hiệu năng benchmark cho pipeline OCR (OCR-01).
 * Cung cấp các thuật toán đối sánh ký tự, làm sạch chuỗi chuyên dụng cho ngành Dược,
 * và sinh báo cáo đo lường Precision / Recall / F1-Score trước và sau tối ưu.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { OcrGroundTruth, OcrBenchmarkMetric } from './types';

/** Chuẩn hóa chuỗi để so sánh linh hoạt (bỏ dấu cách thừa, lowercase, xóa ký tự đặc biệt phụ) */
export function normalizeOcrText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[,\s]+/g, ' ')
    .trim();
}

/** Chuẩn hóa giá trị kết quả kiểm nghiệm (ví dụ "≤ 10", "<= 10", "10 ppm") */
export function normalizeValue(val: string | null | undefined): string {
  if (!val) return '';
  return val.toLowerCase().replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/\s+/g, '').trim();
}

export interface ExtractedDataInput {
  docId: string;
  batchNo?: string;
  labName?: string;
  testDate?: string;
  criteria: Array<{
    criteriaName: string;
    actualResult: string;
    unit?: string;
    limitText?: string;
  }>;
  renderDurationMs?: number;
  ocrDurationMs?: number;
  totalImageBytes?: number;
}

/**
 * Đánh giá độ chính xác kết quả trích xuất so với Ground Truth chuẩn
 */
export function evaluateOcrAccuracy(
  groundTruth: OcrGroundTruth,
  extracted: ExtractedDataInput
): OcrBenchmarkMetric {
  // 1. So sánh Header Fields
  const batchMatched =
    !!groundTruth.batchNo &&
    normalizeOcrText(groundTruth.batchNo) === normalizeOcrText(extracted.batchNo);
  const labMatched =
    (!!groundTruth.labName &&
      normalizeOcrText(groundTruth.labName).includes(normalizeOcrText(extracted.labName))) ||
    (!!extracted.labName &&
      normalizeOcrText(extracted.labName).includes(normalizeOcrText(groundTruth.labName)));
  const dateMatched =
    !!groundTruth.testDate &&
    normalizeOcrText(groundTruth.testDate) === normalizeOcrText(extracted.testDate);

  let headerMatchedCount = 0;
  let headerTotalCount = 0;
  if (groundTruth.batchNo) {
    headerTotalCount++;
    if (batchMatched) headerMatchedCount++;
  }
  if (groundTruth.labName) {
    headerTotalCount++;
    if (labMatched) headerMatchedCount++;
  }
  if (groundTruth.testDate) {
    headerTotalCount++;
    if (dateMatched) headerMatchedCount++;
  }

  const accuracyPercent =
    headerTotalCount > 0 ? Math.round((headerMatchedCount / headerTotalCount) * 100) : 100;

  // 2. So sánh danh sách chỉ tiêu (Criteria)
  const totalExpected = groundTruth.criteria.length;
  const totalExtracted = extracted.criteria.length;
  let correctlyMatched = 0;

  for (const expectedItem of groundTruth.criteria) {
    const expName = normalizeOcrText(expectedItem.criteriaName);
    const expVal = normalizeValue(expectedItem.expectedResult);

    // Tìm trong kết quả trích xuất
    const matched = extracted.criteria.find((extItem) => {
      const extName = normalizeOcrText(extItem.criteriaName);
      const extVal = normalizeValue(extItem.actualResult);

      const nameMatches =
        extName === expName || extName.includes(expName) || expName.includes(extName);
      const valMatches = extVal === expVal;

      return nameMatches && valMatches;
    });

    if (matched) {
      correctlyMatched++;
    }
  }

  const precision = totalExtracted > 0 ? Number((correctlyMatched / totalExtracted).toFixed(4)) : 0;
  const recall = totalExpected > 0 ? Number((correctlyMatched / totalExpected).toFixed(4)) : 0;
  const f1Score =
    precision + recall > 0
      ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
      : 0;

  const renderDurationMs = extracted.renderDurationMs || 0;
  const ocrDurationMs = extracted.ocrDurationMs || 0;

  return {
    docId: groundTruth.docId,
    fieldAccuracy: {
      batchNoMatched: batchMatched,
      labNameMatched: labMatched,
      testDateMatched: dateMatched,
      accuracyPercent,
    },
    criteriaMetrics: {
      totalExpected,
      totalExtracted,
      correctlyMatched,
      precision,
      recall,
      f1Score,
    },
    performance: {
      renderDurationMs,
      ocrDurationMs,
      totalDurationMs: renderDurationMs + ocrDurationMs,
      totalImageBytes: extracted.totalImageBytes || 0,
    },
  };
}
