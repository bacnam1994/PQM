/**
 * QualityEvaluationEngine.ts
 * Facade điều phối trung tâm của Động cơ Thẩm định Chất lượng PQM Domain.
 * Đảm bảo 100% Deterministic, ALCOA+ Data Integrity, không để AI can thiệp vào quyết định PASS/FAIL.
 */

import { CriterionEvaluator } from './CriterionEvaluator';
import { AlternateRuleEvaluator } from './AlternateRuleEvaluator';
import { OverallResultEvaluator } from './OverallResultEvaluator';
import { SpecificationParser } from './SpecificationParser';
import {
  normalizeValue,
  standardizeDecimalString,
  normalizeNumericString,
  parseNumberFromText,
  safeParseFloat,
  ND_KEYWORDS,
  POS_KEYWORDS,
} from './ValueNormalizer';
import {
  TestResultEntry,
  TestResult,
  EvaluationSnapshot,
  TCCS,
  AlternateRule,
  CanonicalQualityStatus,
} from '../../types';
import { useUIStore } from '../../store/useUIStore';
import { buildEvaluationSnapshot } from './EvaluationSnapshotBuilder';

export class QualityEvaluationEngine {
  /**
   * Đánh giá một chỉ tiêu thông minh theo logic chuẩn Dược
   */
  static evaluateCriterionSmart(criterion: unknown, value: unknown): boolean {
    const res = CriterionEvaluator.evaluateCriterion(criterion, value);
    return res.isPass === true;
  }

  /**
   * Kiểm tra giá trị có nằm trong khoảng quy định (dạng text "min - max" hoặc "≤ 10")
   */
  static checkRange(limit: string, value: string): boolean | null {
    return CriterionEvaluator.checkRange(limit, value);
  }

  /**
   * Đánh giá chỉ tiêu có xem xét alternateRules từ TCCS
   */
  static evaluateCriterionWithAlternates(
    criterion: unknown,
    value: unknown,
    allValues: Record<string, unknown> = {},
    tccsAlternateRules: AlternateRule[] = []
  ) {
    return AlternateRuleEvaluator.evaluateCriterionWithAlternates(
      criterion,
      value,
      allValues,
      tccsAlternateRules
    );
  }

  /**
   * Tính toán kết quả tổng thể toàn phiếu (PASS / FAIL / PENDING / UNKNOWN)
   */
  static calculateOverallStatus(
    results: TestResultEntry[],
    tccs: TCCS | null
  ): CanonicalQualityStatus {
    return OverallResultEvaluator.calculateOverallStatus(results, tccs);
  }

  /**
   * Tái thẩm định toàn diện phiếu kiểm nghiệm và niêm phong EvaluationSnapshot hợp lệ (ALCOA+ Compliance).
   * Tự động sinh evaluationHash khớp 100% với trạng thái mới, loại bỏ nguy cơ bị đánh dấu Giả mạo/Tampered.
   * Tuân thủ Evidence-First: Thiếu kết quả -> UNKNOWN, Có FAIL -> FAIL.
   */
  static evaluate(
    testResult: TestResult,
    tccs?: TCCS | null,
    currentUser?: { email?: string; [key: string]: unknown } | null
  ): EvaluationSnapshot {
    let overallStatus: CanonicalQualityStatus = 'UNKNOWN';

    if (!testResult.results || testResult.results.length === 0) {
      overallStatus = 'UNKNOWN';
    } else {
      overallStatus = this.calculateOverallStatus(testResult.results, tccs || null);
    }

    return buildEvaluationSnapshot(
      { ...testResult, overallStatus },
      currentUser || { email: 'system-auto-heal@vbiotech.vn' },
      { tccs: tccs || undefined }
    );
  }

  /**
   * Kiểm tra quy tắc miễn kiểm (Rule Exemption)
   */
  static checkRuleExemption(
    cName: string,
    getMapVal: (n: string) => any,
    activeTCCS: any,
    tccsMaps: any,
    existingResultsMap: Map<string, any>
  ): boolean {
    return AlternateRuleEvaluator.checkRuleExemption(
      cName,
      getMapVal,
      activeTCCS,
      tccsMaps,
      existingResultsMap
    );
  }

  /**
   * Tính toán độ hoàn thiện của phiếu kiểm nghiệm
   */
  static calculateCompletionStatus(
    activeTCCS: any,
    tccsMaps: any,
    formValues: any,
    existingResultsMap: Map<string, any>
  ) {
    return OverallResultEvaluator.calculateCompletionStatus(
      activeTCCS,
      tccsMaps,
      formValues,
      existingResultsMap
    );
  }

  // --- TIỆN ÍCH ĐỊNH DẠNG & BÓC TÁCH SỐ LIỆU ---

  static standardizeDecimalString(str: string | number | null | undefined): string {
    return standardizeDecimalString(str);
  }

  static normalizeNumericString(value: string | number | null | undefined): string {
    return normalizeNumericString(value);
  }

  static parseNumberFromText(text: string | number | null | undefined): number {
    return parseNumberFromText(text);
  }

  static safeParseFloat(str: string): number {
    return safeParseFloat(str);
  }

  static getActiveLocale(): string {
    try {
      const sep = typeof window !== 'undefined' ? useUIStore.getState().decimalSeparator : 'dot';
      return sep === 'comma' ? 'vi-VN' : 'en-US';
    } catch {
      return 'en-US';
    }
  }

  static formatNumber(
    value: number | string | null | undefined,
    options?: Intl.NumberFormatOptions
  ): string {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'number' ? value : parseNumberFromText(value);
    if (isNaN(num)) return String(value);
    const locale = QualityEvaluationEngine.getActiveLocale();
    return num.toLocaleString(locale, options);
  }

  static autoFormatInput(text: string): string {
    if (!text) return '';
    if (!text.includes('e') && !text.includes('E') && !text.includes('*')) return text;
    return text.replace(/10[eE](?=[+-]?\d)/g, '10^').replace(/\*/g, 'x');
  }

  static formatScientific(value: string | number): string {
    const stringValue = String(value).trim();
    const stringUpper = stringValue.toUpperCase();

    if (ND_KEYWORDS.includes(stringUpper)) {
      return 'Không phát hiện';
    }
    if (POS_KEYWORDS.includes(stringUpper)) {
      return 'Dương tính';
    }

    const hasText = /[a-df-wy-zA-DF-WY-Zà-ỹÀ-Ỹ]/.test(stringValue);
    if (hasText) {
      return stringValue;
    }

    let num = Number(value);
    const isSciFormat =
      stringUpper.includes('E') ||
      stringValue.includes('10') ||
      stringValue.includes('^') ||
      stringUpper.includes('X');

    if (isNaN(num) || isSciFormat) {
      num = parseNumberFromText(stringValue);
      if (num === 0 && String(value).trim() !== '0') return stringValue;
    }

    if (num === 0) return stringValue;

    if (
      isSciFormat ||
      Math.abs(num) >= 1000000 ||
      (Math.abs(num) > 0 && Math.abs(num) <= 0.00001)
    ) {
      const exponent = Math.floor(Math.log10(Math.abs(num)));
      const mantissa = num / Math.pow(10, exponent);
      const roundedMantissa = Math.round((mantissa + Number.EPSILON) * 100000) / 100000;

      const superscripts: Record<string, string> = {
        '0': '⁰',
        '1': '¹',
        '2': '²',
        '3': '³',
        '4': '⁴',
        '5': '⁵',
        '6': '⁶',
        '7': '⁷',
        '8': '⁸',
        '9': '⁹',
        '-': '⁻',
      };
      const expStr = String(exponent)
        .split('')
        .map((c) => superscripts[c] || c)
        .join('');

      if (roundedMantissa !== 1) return `${roundedMantissa} × 10${expStr}`;
      return `10${expStr}`;
    }

    const locale = QualityEvaluationEngine.getActiveLocale();
    return num.toLocaleString(locale, { maximumFractionDigits: 10 });
  }
}
