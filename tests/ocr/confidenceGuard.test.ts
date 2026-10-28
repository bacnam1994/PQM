/**
 * tests/ocr/confidenceGuard.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests cho OCR-09: Confidence Scoring & LOW Confidence Guard
 * Kiểm tra thực thi Rule 11 (Decoupled Confidence Score) và
 * Rule 12 (LOW Confidence Guard < 75%).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import {
  assessCriterionConfidence,
  detectSuspiciousPatternsInValue,
  detectSuspiciousPatternsInCriteriaName,
  evaluateDocumentConfidenceGuard,
} from '../../src/services/ocr/confidenceGuard';
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

// ─── detectSuspiciousPatternsInValue ─────────────────────────────────────────

describe('detectSuspiciousPatternsInValue', () => {
  it('TC-DV-01: Giá trị rỗng bị đánh là nghi ngờ', () => {
    const result = detectSuspiciousPatternsInValue('');
    expect(result.isSuspicious).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('TC-DV-02: Giá trị undefined bị đánh là nghi ngờ', () => {
    const result = detectSuspiciousPatternsInValue(undefined);
    expect(result.isSuspicious).toBe(true);
  });

  it('TC-DV-03: Nhiều dấu thập phân (1.2.3) bị phát hiện', () => {
    const result = detectSuspiciousPatternsInValue('1.2.3');
    expect(result.isSuspicious).toBe(true);
    expect(result.reasons.some((r) => r.includes('thập phân'))).toBe(true);
  });

  it('TC-DV-04: Chứa dấu hỏi chấm nghi vấn', () => {
    const result = detectSuspiciousPatternsInValue('10.?5');
    expect(result.isSuspicious).toBe(true);
  });

  it('TC-DV-05: Nhầm lẫn chữ O với số 0 (O.05)', () => {
    const result = detectSuspiciousPatternsInValue('O.05');
    expect(result.isSuspicious).toBe(true);
    expect(result.reasons.some((r) => r.includes('"O"'))).toBe(true);
  });

  it('TC-DV-06: Nhầm lẫn chữ l với số 1 (1l.5)', () => {
    const result = detectSuspiciousPatternsInValue('1l.5');
    expect(result.isSuspicious).toBe(true);
  });

  it('TC-DV-07: Khoảng trắng quanh dấu thập phân (10 . 5)', () => {
    const result = detectSuspiciousPatternsInValue('10 . 5');
    expect(result.isSuspicious).toBe(true);
  });

  it('TC-DV-08: Giá trị hợp lệ không bị đánh nghi ngờ', () => {
    expect(detectSuspiciousPatternsInValue('5.23').isSuspicious).toBe(false);
    expect(detectSuspiciousPatternsInValue('98.5').isSuspicious).toBe(false);
    expect(detectSuspiciousPatternsInValue('TRẮNG').isSuspicious).toBe(false);
  });
});

// ─── detectSuspiciousPatternsInCriteriaName ──────────────────────────────────

describe('detectSuspiciousPatternsInCriteriaName', () => {
  it('TC-DN-01: Tên quá ngắn (< 2 ký tự) bị đánh nghi ngờ', () => {
    expect(detectSuspiciousPatternsInCriteriaName('').isSuspicious).toBe(true);
    expect(detectSuspiciousPatternsInCriteriaName('A').isSuspicious).toBe(true);
  });

  it('TC-DN-02: Tên chứa dấu hỏi chấm', () => {
    const result = detectSuspiciousPatternsInCriteriaName('Độ ẩm???');
    expect(result.isSuspicious).toBe(true);
  });

  it('TC-DN-03: Tên chỉ gồm số và ký hiệu', () => {
    const result = detectSuspiciousPatternsInCriteriaName('12345-./');
    expect(result.isSuspicious).toBe(true);
  });

  it('TC-DN-04: Tên hợp lệ không bị đánh nghi ngờ', () => {
    expect(detectSuspiciousPatternsInCriteriaName('Độ ẩm').isSuspicious).toBe(false);
    expect(detectSuspiciousPatternsInCriteriaName('Kim loại nặng As').isSuspicious).toBe(false);
  });
});

// ─── assessCriterionConfidence ────────────────────────────────────────────────

describe('assessCriterionConfidence', () => {
  it('TC-AC-01: Item HIGH score sạch → overallScore cao, level HIGH, isLowConfidence false', () => {
    const item = makeItem({ confidence: 'high', confidenceScore: 90, value: '5.2' });
    const result = assessCriterionConfidence(item);
    expect(result.overallScore).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe('HIGH');
    expect(result.isLowConfidence).toBe(false);
    expect(result.requiresManualConfirmation).toBe(false);
  });

  it('TC-AC-02: Item có confidenceScore = 60 → isLowConfidence true (Rule 12)', () => {
    const item = makeItem({ confidence: 'low', confidenceScore: 60, value: '5.2' });
    const result = assessCriterionConfidence(item);
    expect(result.isLowConfidence).toBe(true);
    expect(result.requiresManualConfirmation).toBe(true);
  });

  it('TC-AC-03: Item AI=high nhưng giá trị nghi ngờ (O.05) → bị hạ xuống LOW', () => {
    const item = makeItem({ confidence: 'high', confidenceScore: 88, value: 'O.05' });
    const result = assessCriterionConfidence(item);
    expect(result.isLowConfidence).toBe(true);
    expect(result.suspiciousFields).toContain('value');
    expect(result.requiresManualConfirmation).toBe(true);
  });

  it('TC-AC-04: Giá trị trùng với giới hạn → suspect value', () => {
    const item = makeItem({
      value: '≤ 9.0%',
      limit: '≤ 9.0%',
      confidence: 'high',
      confidenceScore: 85,
    });
    const result = assessCriterionConfidence(item);
    expect(result.suspiciousFields).toContain('value');
    expect(result.warningMessages.some((m) => m.includes('trùng'))).toBe(true);
  });

  it('TC-AC-05: Tên chỉ tiêu bất thường → hạ điểm và đánh suspect criteriaName', () => {
    const item = makeItem({ criteriaName: 'A', confidence: 'medium', confidenceScore: 75 });
    const result = assessCriterionConfidence(item);
    expect(result.suspiciousFields).toContain('criteriaName');
    expect(result.isLowConfidence).toBe(true);
  });

  it('TC-AC-06: Score chuẩn hóa không vượt 100 hoặc âm', () => {
    const item = makeItem({ confidence: 'low', confidenceScore: 10, value: 'O.05' });
    const result = assessCriterionConfidence(item);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});

// ─── evaluateDocumentConfidenceGuard ─────────────────────────────────────────

describe('evaluateDocumentConfidenceGuard', () => {
  it('TC-EG-01: Danh sách rỗng → report hợp lệ với 0 items', () => {
    const report = evaluateDocumentConfidenceGuard([]);
    expect(report.totalItems).toBe(0);
    expect(report.guardedItems).toHaveLength(0);
    expect(report.averageConfidenceScore).toBe(0);
    expect(report.hasCriticalSuspicion).toBe(false);
  });

  it('TC-EG-02: 2 item HIGH sạch → highConfidenceItems = 2, low = 0', () => {
    const items = [
      makeItem({ criteriaName: 'Độ ẩm', confidenceScore: 90, value: '5.2' }),
      makeItem({ criteriaName: 'Tro sulfat', confidenceScore: 88, value: '0.15' }),
    ];
    const report = evaluateDocumentConfidenceGuard(items);
    expect(report.highConfidenceItems).toHaveLength(2);
    expect(report.lowConfidenceItems).toHaveLength(0);
    expect(report.hasCriticalSuspicion).toBe(false);
  });

  it('TC-EG-03: 1 item nghi ngờ value → hasCriticalSuspicion true', () => {
    const items = [
      makeItem({ criteriaName: 'Độ ẩm', confidenceScore: 90, value: '5.2' }),
      makeItem({ criteriaName: 'Kim loại As', confidenceScore: 85, value: 'O.05' }),
    ];
    const report = evaluateDocumentConfidenceGuard(items);
    expect(report.hasCriticalSuspicion).toBe(true);
    expect(report.lowConfidenceItems.length).toBeGreaterThanOrEqual(1);
  });

  it('TC-EG-04: Item AI=high nhưng giá trị lỗi → guard buộc vào lowConfidenceItems', () => {
    const items = [
      makeItem({
        criteriaName: 'Thử vô trùng',
        confidence: 'high',
        confidenceScore: 88,
        value: '1.2.3',
      }),
    ];
    const report = evaluateDocumentConfidenceGuard(items);
    expect(report.lowConfidenceItems).toHaveLength(1);
    expect(report.highConfidenceItems).toHaveLength(0);
  });

  it('TC-EG-05: assessment luôn được gắn vào từng guardedItem', () => {
    const items = [makeItem()];
    const report = evaluateDocumentConfidenceGuard(items);
    const guarded = report.guardedItems[0];
    expect(guarded.assessment).toBeDefined();
    expect(typeof guarded.assessment.overallScore).toBe('number');
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(guarded.assessment.level);
  });

  it('TC-EG-06: averageConfidenceScore nằm trong khoảng 0-100', () => {
    const items = [
      makeItem({ confidenceScore: 90 }),
      makeItem({ confidenceScore: 60, value: 'O.05' }),
    ];
    const report = evaluateDocumentConfidenceGuard(items);
    expect(report.averageConfidenceScore).toBeGreaterThanOrEqual(0);
    expect(report.averageConfidenceScore).toBeLessThanOrEqual(100);
  });
});
