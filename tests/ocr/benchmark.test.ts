import { describe, it, expect } from 'vitest';
import {
  evaluateOcrAccuracy,
  normalizeOcrText,
  normalizeValue,
  type ExtractedDataInput,
} from '../../src/services/ocr/ocrBenchmarkService';
import type { OcrGroundTruth } from '../../src/services/ocr/types';

describe('OCR Benchmark Engine (OCR-01)', () => {
  const sampleGroundTruth: OcrGroundTruth = {
    docId: 'PKN-QUATEST-001',
    batchNo: '702601',
    labName: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3 (QUATEST 3)',
    testDate: '2026-08-15',
    criteria: [
      { criteriaName: 'Cảm quan', expectedResult: 'Viên nang cứng màu nâu', unit: '' },
      { criteriaName: 'Độ ẩm', expectedResult: '≤ 9.0', unit: '%' },
      { criteriaName: 'Định lượng Paracetamol', expectedResult: '502.5', unit: 'mg/viên' },
      { criteriaName: 'Chì (Pb)', expectedResult: '≤ 2.0', unit: 'ppm' },
      { criteriaName: 'Tổng số vi sinh vật hiếu khí', expectedResult: '120', unit: 'CFU/g' },
    ],
  };

  it('tính toán chính xác 100% khi kết quả trích xuất khớp hoàn toàn với Ground Truth', () => {
    const extracted: ExtractedDataInput = {
      docId: 'PKN-QUATEST-001',
      batchNo: '702601',
      labName: 'QUATEST 3',
      testDate: '2026-08-15',
      criteria: [
        { criteriaName: 'Cảm quan', actualResult: 'Viên nang cứng màu nâu' },
        { criteriaName: 'Độ ẩm', actualResult: '<= 9.0' }, // Kiểm tra chuẩn hóa <= vs ≤
        { criteriaName: 'Định lượng Paracetamol', actualResult: '502.5' },
        { criteriaName: 'Chì (Pb)', actualResult: '<= 2.0' },
        { criteriaName: 'Tổng số vi sinh vật hiếu khí', actualResult: '120' },
      ],
      renderDurationMs: 450,
      ocrDurationMs: 1200,
      totalImageBytes: 1540000,
    };

    const metric = evaluateOcrAccuracy(sampleGroundTruth, extracted);

    expect(metric.fieldAccuracy.accuracyPercent).toBe(100);
    expect(metric.criteriaMetrics.correctlyMatched).toBe(5);
    expect(metric.criteriaMetrics.precision).toBe(1);
    expect(metric.criteriaMetrics.recall).toBe(1);
    expect(metric.criteriaMetrics.f1Score).toBe(1);
    expect(metric.performance.totalDurationMs).toBe(1650);
  });

  it('phản ánh đúng Precision và Recall khi phát hiện trích xuất thiếu hoặc sai lệch', () => {
    const extractedWithErrors: ExtractedDataInput = {
      docId: 'PKN-QUATEST-001',
      batchNo: '702601-SAI', // Sai số lô
      labName: 'QUATEST 3',
      testDate: '2026-08-15',
      criteria: [
        { criteriaName: 'Cảm quan', actualResult: 'Viên nang cứng màu nâu' }, // Đúng
        { criteriaName: 'Độ ẩm', actualResult: '12.5' }, // Sai giá trị
        { criteriaName: 'Định lượng Paracetamol', actualResult: '502.5' }, // Đúng
        // Thiếu Chì và Vi sinh vật
        { criteriaName: 'Tạp chất lạ', actualResult: 'Không có' }, // Chỉ tiêu dư thừa/ảo
      ],
      renderDurationMs: 500,
      ocrDurationMs: 1500,
    };

    const metric = evaluateOcrAccuracy(sampleGroundTruth, extractedWithErrors);

    expect(metric.fieldAccuracy.batchNoMatched).toBe(false);
    expect(metric.fieldAccuracy.labNameMatched).toBe(true);
    expect(metric.fieldAccuracy.accuracyPercent).toBe(67); // 2/3 trường đúng

    // Đúng 2 chỉ tiêu (Cảm quan & Paracetamol)
    expect(metric.criteriaMetrics.correctlyMatched).toBe(2);
    // Extracted có 4 -> Precision = 2/4 = 0.5
    expect(metric.criteriaMetrics.precision).toBe(0.5);
    // Expected có 5 -> Recall = 2/5 = 0.4
    expect(metric.criteriaMetrics.recall).toBe(0.4);
    // F1 = 2 * (0.5 * 0.4) / (0.5 + 0.4) = 0.4 / 0.9 ≈ 0.4444
    expect(metric.criteriaMetrics.f1Score).toBeCloseTo(0.4444, 3);
  });

  it('chuẩn hóa chính xác ký tự toán học và chuỗi rác trong normalizeValue & normalizeOcrText', () => {
    expect(normalizeValue(' ≤ 10.0 ppm ')).toBe('<=10.0ppm');
    expect(normalizeValue('≥ 95%')).toBe('>=95%');
    expect(normalizeOcrText('  Độ   ẩm (Karl Fischer)  ')).toBe('độ ẩm (karl fischer)');
  });
});
