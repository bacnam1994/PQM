/**
 * src/services/ocr/confidenceGuard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Động cơ Đánh giá Độ tin cậy & Rào chắn Bảo vệ Dữ liệu Dược phẩm
 * (OCR-09: Confidence Scoring & LOW Confidence Guard).
 *
 * Thực thi các quy tắc bất biến:
 * - Rule 11 (Decoupled Confidence Score): Tách riêng điểm số tin cậy cho từng trường
 *   (Tên chỉ tiêu, Giá trị, Đơn vị, Giới hạn) thay vì gộp chung một nhãn mơ hồ.
 * - Rule 12 (LOW Confidence Guard): Bắt buộc cảnh báo và yêu cầu xác nhận thủ công
 *   đối với các chỉ tiêu có độ tin cậy < 75% hoặc có dấu hiệu nghi ngờ (OCR artifact).
 * - Chống nâng hạng tùy tiện: Khớp tên TCCS chỉ nâng mappingConfidence, tuyệt đối
 *   không ghi đè extractionConfidence nếu giá trị thực tế bị mờ/nghi ngờ.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ExtractedCriterionItem } from './types';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface FieldConfidenceAssessment {
  /** Điểm số tổng hợp (0 - 100) */
  overallScore: number;
  /** Mức độ tin cậy */
  level: ConfidenceLevel;
  /** Cờ cảnh báo độ tin cậy thấp (< 75% hoặc phát hiện mẫu nghi ngờ) */
  isLowConfidence: boolean;
  /** Bắt buộc người dùng phải xem xét và xác nhận thủ công */
  requiresManualConfirmation: boolean;
  /** Danh sách các trường có nghi vấn */
  suspiciousFields: ('criteriaName' | 'value' | 'unit' | 'limit')[];
  /** Danh sách các thông báo cảnh báo cụ thể */
  warningMessages: string[];
}

export interface GuardedCriterionItem extends ExtractedCriterionItem {
  assessment: FieldConfidenceAssessment;
}

export interface ConfidenceGuardReport {
  /** Toàn bộ danh sách chỉ tiêu đã gắn đánh giá */
  guardedItems: GuardedCriterionItem[];
  /** Danh sách chỉ tiêu độ tin cậy cao, an toàn để điền tự động */
  highConfidenceItems: GuardedCriterionItem[];
  /** Danh sách chỉ tiêu cần người dùng kiểm tra lại */
  lowConfidenceItems: GuardedCriterionItem[];
  totalItems: number;
  lowConfidenceCount: number;
  averageConfidenceScore: number;
  hasCriticalSuspicion: boolean;
}

/**
 * Phát hiện các mẫu ký tự bất thường hoặc nghi ngờ lỗi OCR trong giá trị kiểm nghiệm
 */
export function detectSuspiciousPatternsInValue(value?: string): {
  isSuspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!value || value.trim() === '') {
    return { isSuspicious: true, reasons: ['Giá trị kết quả bị bỏ trống'] };
  }

  const clean = value.trim();

  // 1. Dấu chấm/phẩy thập phân kép (ví dụ: "1.2.3" hoặc "4,5,6")
  if (/\d+[\.,]\d+[\.,]\d+/.test(clean)) {
    reasons.push('Phát hiện nhiều dấu thập phân trong cùng một giá trị');
  }

  // 2. Chứa dấu hỏi chấm hoặc ký hiệu không đọc được
  if (/\?|\[\?\]|unreadable|không rõ|bị mờ|\.{3,}/i.test(clean)) {
    reasons.push('Văn bản chứa ký hiệu không đọc rõ hoặc nghi vấn OCR');
  }

  // 3. Nhầm lẫn ký tự chữ trong chuỗi số (ví dụ: "1l.5", "5O2", "O.05")
  if (/\d+[lI]\.\d+|\d+[lI]\d+/.test(clean)) {
    reasons.push('Nghi ngờ nhầm lẫn chữ "l" hoặc "I" với số 1');
  }
  if (/\d+[oO]\.\d+|\b[oO]\.\d+/.test(clean)) {
    reasons.push('Nghi ngờ nhầm lẫn chữ "O" với số 0');
  }

  // 4. Khoảng trắng bất thường giữa dấu thập phân (ví dụ: "10 . 5")
  if (/\d+\s+[\.,]\s*\d+|\d+\s*[\.,]\s+\d+/.test(clean)) {
    reasons.push('Khoảng trắng đứt gãy quanh dấu thập phân');
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Phát hiện mẫu bất thường trong tên chỉ tiêu
 */
export function detectSuspiciousPatternsInCriteriaName(name?: string): {
  isSuspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!name || name.trim().length < 2) {
    return { isSuspicious: true, reasons: ['Tên chỉ tiêu quá ngắn hoặc bị trống'] };
  }

  const clean = name.trim();
  if (/\?|\[\?\]|\.{3,}/.test(clean)) {
    reasons.push('Tên chỉ tiêu chứa ký hiệu nghi vấn');
  }

  if (/^[0-9\-_./\s]+$/.test(clean)) {
    reasons.push('Tên chỉ tiêu chỉ toàn ký số hoặc ký hiệu');
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Đánh giá chi tiết độ tin cậy của một chỉ tiêu kiểm nghiệm
 */
export function assessCriterionConfidence(item: ExtractedCriterionItem): FieldConfidenceAssessment {
  const suspiciousFields: ('criteriaName' | 'value' | 'unit' | 'limit')[] = [];
  const warningMessages: string[] = [];

  // 1. Xác định điểm cơ sở (Base Score)
  let baseScore =
    typeof item.confidenceScore === 'number' && !isNaN(item.confidenceScore)
      ? item.confidenceScore
      : item.confidence === 'high'
        ? 90
        : item.confidence === 'medium'
          ? 75
          : 55;

  // 2. Kiểm tra tên chỉ tiêu
  const nameCheck = detectSuspiciousPatternsInCriteriaName(item.criteriaName);
  if (nameCheck.isSuspicious) {
    suspiciousFields.push('criteriaName');
    warningMessages.push(...nameCheck.reasons);
    baseScore -= 20;
  }

  // 3. Kiểm tra giá trị kết quả
  const valCheck = detectSuspiciousPatternsInValue(item.value);
  if (valCheck.isSuspicious) {
    suspiciousFields.push('value');
    warningMessages.push(...valCheck.reasons);
    baseScore -= 25;
  }

  // 4. Kiểm tra sự trùng lẫn giữa giá trị và giới hạn (Rule 5 violation)
  if (item.value && item.limit && item.value.trim() === item.limit.trim()) {
    suspiciousFields.push('value');
    warningMessages.push('Giá trị kết quả trùng hoàn toàn với mức giới hạn tiêu chuẩn');
    baseScore -= 15;
  }

  // 5. Chuẩn hóa điểm trong khoảng 0 - 100
  const overallScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  // 6. Xác định mức độ
  let level: ConfidenceLevel = 'HIGH';
  if (overallScore < 70 || suspiciousFields.length > 0) {
    level = 'LOW';
  } else if (overallScore < 80) {
    level = 'MEDIUM';
  }

  // 7. Rào chắn: Nếu điểm < 75 hoặc có trường nghi vấn -> Bắt buộc review thủ công (Rule 12)
  const isLowConfidence = overallScore < 75 || level === 'LOW' || suspiciousFields.length > 0;
  const requiresManualConfirmation = isLowConfidence;

  return {
    overallScore,
    level,
    isLowConfidence,
    requiresManualConfirmation,
    suspiciousFields,
    warningMessages,
  };
}

/**
 * Đánh giá toàn bộ tài liệu và phân loại chỉ tiêu vào 2 nhóm an toàn / cần xác nhận
 */
export function evaluateDocumentConfidenceGuard(
  items: ExtractedCriterionItem[]
): ConfidenceGuardReport {
  const guardedItems: GuardedCriterionItem[] = [];
  const highConfidenceItems: GuardedCriterionItem[] = [];
  const lowConfidenceItems: GuardedCriterionItem[] = [];

  let totalScore = 0;
  let hasCriticalSuspicion = false;

  for (const item of items) {
    const assessment = assessCriterionConfidence(item);
    const guarded: GuardedCriterionItem = {
      ...item,
      assessment,
    };

    guardedItems.push(guarded);
    totalScore += assessment.overallScore;

    if (assessment.requiresManualConfirmation) {
      lowConfidenceItems.push(guarded);
      if (assessment.suspiciousFields.includes('value')) {
        hasCriticalSuspicion = true;
      }
    } else {
      highConfidenceItems.push(guarded);
    }
  }

  const totalItems = items.length;
  const averageConfidenceScore = totalItems > 0 ? Math.round(totalScore / totalItems) : 0;

  return {
    guardedItems,
    highConfidenceItems,
    lowConfidenceItems,
    totalItems,
    lowConfidenceCount: lowConfidenceItems.length,
    averageConfidenceScore,
    hasCriticalSuspicion,
  };
}
