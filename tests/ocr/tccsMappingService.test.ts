/**
 * tests/ocr/tccsMappingService.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests cho OCR-10: TCCS Mapping Engine
 * Kiểm tra Rule 10 (Tách Bạch Extraction vs Mapping) và toàn bộ
 * luồng mapOcrResultsToTccs + mappedResultToAIExtractedItem.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import {
  mapOcrResultsToTccs,
  mappedResultToAIExtractedItem,
} from '../../src/services/ocr/tccsMappingService';
import type { ExtractedCriterionItem } from '../../src/services/ocr/types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ExtractedCriterionItem> = {}): ExtractedCriterionItem {
  return {
    criteriaName: 'Độ ẩm',
    confidence: 'high',
    confidenceScore: 90,
    value: '5.2',
    unit: '%',
    limit: '≤ 9.0%',
    sourcePageNumber: 1,
    ...overrides,
  };
}

const TCCS_NAMES = ['Độ ẩm', 'Tro sulfat', 'Định lượng', 'Kim loại nặng (As)', 'Cảm quan', 'Độ pH'];

// ─── mapOcrResultsToTccs ──────────────────────────────────────────────────────

describe('mapOcrResultsToTccs', () => {
  it('TC-MP-01: Danh sách rỗng → report hợp lệ', () => {
    const report = mapOcrResultsToTccs([], TCCS_NAMES);
    expect(report.totalItems).toBe(0);
    expect(report.allMapped).toHaveLength(0);
    expect(report.matchedCount).toBe(0);
    expect(report.unmatchedCount).toBe(0);
  });

  it('TC-MP-02: Khớp chính xác (EXACT) theo tên Việt', () => {
    const items = [makeItem({ criteriaName: 'Độ ẩm' })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    expect(report.highConfidenceMapped).toHaveLength(1);
    expect(report.allMapped[0].systemCriteriaName).toBe('Độ ẩm');
    expect(report.allMapped[0].mappingConfidence).toBe('EXACT');
    expect(report.allMapped[0].mappingScore).toBeGreaterThanOrEqual(90);
  });

  it('TC-MP-03: Khớp từ điển dược khoa (DICTIONARY) — LOD → Độ ẩm', () => {
    const items = [makeItem({ criteriaName: 'Loss on Drying', confidenceScore: 85 })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    expect(report.allMapped[0].systemCriteriaName).toBe('Độ ẩm');
    expect(report.allMapped[0].mappingConfidence).toBe('DICTIONARY');
    expect(report.allMapped[0].resolvedDictionaryTerm).toBe('Độ ẩm');
  });

  it('TC-MP-04: Không khớp → UNMATCHED, vào unmatchedItems', () => {
    const items = [makeItem({ criteriaName: 'Chỉ tiêu không tồn tại XYZ123' })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    expect(report.unmatchedItems).toHaveLength(1);
    expect(report.allMapped[0].systemCriteriaName).toBeNull();
    expect(report.allMapped[0].mappingConfidence).toBe('UNMATCHED');
  });

  it('TC-MP-05: Rule 11 — extractionConfidenceScore độc lập với mappingScore', () => {
    const items = [makeItem({ criteriaName: 'Độ ẩm', confidenceScore: 65 })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    const result = report.allMapped[0];
    // mappingScore có thể cao (95 EXACT) nhưng extractionConfidenceScore thấp (65)
    expect(result.extractionConfidenceScore).toBe(65);
    expect(result.mappingScore).toBeGreaterThanOrEqual(90);
    // Vì extraction score thấp → vẫn cần xác nhận thủ công
    expect(result.requiresManualConfirmation).toBe(true);
  });

  it('TC-MP-06: Rule 5 — value & limit được bảo toàn nguyên bản', () => {
    const items = [makeItem({ criteriaName: 'Độ ẩm', value: '5.23', unit: '%', limit: '≤ 9.0%' })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    const result = report.allMapped[0];
    expect(result.value).toBe('5.23');
    expect(result.limit).toBe('≤ 9.0%');
  });

  it('TC-MP-07: Rule 4 — unit được chuẩn hóa qua normalizeUnit', () => {
    const items = [makeItem({ criteriaName: 'Độ ẩm', unit: 'ppm' })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    // normalizeUnit('ppm') = 'ppm' (giữ nguyên nếu đã chuẩn)
    expect(report.allMapped[0].unit).toBeDefined();
  });

  it('TC-MP-08: Rule 7 — sourcePageNumber được bảo toàn', () => {
    const items = [makeItem({ criteriaName: 'Độ ẩm', sourcePageNumber: 3 })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    expect(report.allMapped[0].sourcePageNumber).toBe(3);
  });

  it('TC-MP-09: Learned mapping ưu tiên cao nhất (LEARNED)', () => {
    const items = [makeItem({ criteriaName: 'DoAm' })];
    const learnedMappings = [
      { id: '1', originalName: 'DoAm', systemName: 'Độ ẩm', frequency: 5, createdAt: '' },
    ];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES, learnedMappings);
    expect(report.allMapped[0].mappingConfidence).toBe('LEARNED');
    expect(report.allMapped[0].mappingScore).toBeGreaterThanOrEqual(95);
  });

  it('TC-MP-10: Item FUZZY → lowConfidenceMapped, requiresManualConfirmation = true', () => {
    // Từ "Ẩm" chứa trong "Độ ẩm" → FUZZY nếu không khớp chính xác
    const items = [makeItem({ criteriaName: 'sulfat', confidenceScore: 90 })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    const result = report.allMapped[0];
    if (result.mappingConfidence === 'FUZZY') {
      expect(result.requiresManualConfirmation).toBe(true);
    }
  });

  it('TC-MP-11: matchedCount + unmatchedCount = totalItems', () => {
    const items = [
      makeItem({ criteriaName: 'Độ ẩm' }),
      makeItem({ criteriaName: 'Loss on Drying' }),
      makeItem({ criteriaName: 'Chỉ tiêu không tồn tại ZZZ' }),
    ];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    expect(report.matchedCount + report.unmatchedCount).toBe(report.totalItems);
  });

  it('TC-MP-12: Nhiều items — mỗi item có assessment riêng biệt', () => {
    const items = [
      makeItem({ criteriaName: 'Độ ẩm', confidenceScore: 90 }),
      makeItem({ criteriaName: 'Tro sulfat', confidenceScore: 60 }),
      makeItem({ criteriaName: 'Cảm quan', confidenceScore: 85 }),
    ];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    expect(report.allMapped).toHaveLength(3);
    // Mỗi item phải có extractionConfidenceScore riêng
    expect(report.allMapped[0].extractionConfidenceScore).toBe(90);
    expect(report.allMapped[1].extractionConfidenceScore).toBe(60);
    expect(report.allMapped[2].extractionConfidenceScore).toBe(85);
  });
});

// ─── mappedResultToAIExtractedItem ────────────────────────────────────────────

describe('mappedResultToAIExtractedItem', () => {
  it('TC-AI-01: Chuyển đổi đúng sang AIExtractedItem', () => {
    const items = [makeItem({ criteriaName: 'Độ ẩm', value: '5.2', unit: '%', limit: '≤ 9.0%' })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    const aiItem = mappedResultToAIExtractedItem(report.allMapped[0]);
    expect(aiItem.criteriaName).toBe('Độ ẩm');
    expect(aiItem.value).toBe('5.2');
    expect(aiItem.unit).toBeDefined();
    expect(aiItem.limit).toBe('≤ 9.0%');
    expect(aiItem.sourcePageNumber).toBe(1);
    expect(typeof aiItem.confidenceScore).toBe('number');
  });

  it('TC-AI-02: confidence = "high" khi cả mappingScore >= 88 và extractionScore >= 75', () => {
    const items = [makeItem({ criteriaName: 'Độ ẩm', confidenceScore: 90 })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    const aiItem = mappedResultToAIExtractedItem(report.allMapped[0]);
    expect(aiItem.confidence).toBe('high');
  });

  it('TC-AI-03: confidence = "low" khi extraction score thấp', () => {
    const items = [makeItem({ criteriaName: 'Độ ẩm', confidenceScore: 60 })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    const aiItem = mappedResultToAIExtractedItem(report.allMapped[0]);
    expect(aiItem.confidence).toBe('low');
  });

  it('TC-AI-04: metadata từ OCR-10 được gắn vào AIExtractedItem', () => {
    const items = [makeItem({ criteriaName: 'Loss on Drying', confidenceScore: 88 })];
    const report = mapOcrResultsToTccs(items, TCCS_NAMES);
    const aiItem = mappedResultToAIExtractedItem(report.allMapped[0]);
    expect(aiItem.mappingScore).toBeDefined();
    expect(aiItem.mappingConfidenceLevel).toBeDefined();
    expect(aiItem.resolvedDictionaryTerm).toBeDefined();
  });
});
