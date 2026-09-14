/**
 * CriterionEvaluator.ts
 * Đánh giá một chỉ tiêu kiểm nghiệm độc lập (Single Criterion Evaluation).
 * Thực thi deterministic 100% không qua AI, bao hàm đầy đủ các quy tắc chuyên môn Dược:
 * - Xử lý giá trị dưới ngưỡng phát hiện (LOD / LOQ: "< 10 CFU/g")
 * - Bù trừ sai số thập phân tương đối (Relative Epsilon) chống lỗi floating-point
 * - Dung sai ± phần trăm hoặc tuyệt đối
 * - Dải chấp nhận min - max
 */

import { ParsedSpecification, NormalizedValue, SingleCriterionResult } from './EvaluationTypes';
import { SpecificationParser } from './SpecificationParser';
import { normalizeValue, parseNumberFromText } from './ValueNormalizer';
import { evaluateCriterion as legacyEvaluateCriterion } from '../../utils/parsing';

export class CriterionEvaluator {
  /**
   * Đánh giá một chỉ tiêu dựa trên đặc tả tiêu chuẩn đã phân tích và giá trị đã chuẩn hóa
   */
  static evaluateParsed(spec: ParsedSpecification, val: NormalizedValue): boolean | null {
    // 1. Tiêu chuẩn yêu cầu Không phát hiện (ND) / Âm tính
    if (spec.type === 'NOT_DETECTED') {
      if (val.isND || val.isStrictLessThan) return true;
      if (val.isPositive) return false;
      if (val.numericValue !== null) return val.numericValue <= 0;
      return false;
    }

    // 2. Tiêu chuẩn yêu cầu Dương tính
    if (spec.type === 'POSITIVE') {
      return val.isPositive;
    }

    // Giá trị số thực tế của kết quả kiểm nghiệm
    const actualVal = val.numericValue;
    if (actualVal === null || isNaN(actualVal)) {
      // Nếu không parse được số và tiêu chuẩn là EXACT_TEXT
      if (spec.type === 'EXACT_TEXT' && spec.expectedText) {
        return null; // chuyển cho text evaluator xử lý
      }
      return null;
    }

    // Ngoại lệ giới hạn phát hiện phòng kiểm nghiệm (LOD / LOQ Exception):
    // Khi phương pháp đếm đĩa không mọc khuẩn lạc nào (0 CFU) ở độ pha loãng 10^-1, lab xuất "< 10".
    // Nồng độ thực tế là 0. Với các chỉ tiêu có giới hạn trên (<= 3, <= 5, NMT 3), 0 <= limitNum nên luôn ĐẠT (PASS).
    const isLODOrZero = (limitNum: number): boolean => {
      if (!val.isStrictLessThan) return false;
      const rawNum = parseNumberFromText(val.stringValue);
      if (limitNum >= 0 && (val.isND || isNaN(rawNum) || rawNum <= 10)) {
        return true;
      }
      return false;
    };

    // 3. Tiêu chuẩn Dung sai: base ± tolerance
    if (spec.type === 'TOLERANCE') {
      const base = spec.baseValue ?? 0;
      let tol = spec.toleranceValue ?? 0;
      if (spec.isPercentageTolerance) {
        tol = Math.abs(base) * (tol / 100);
      }
      const eps = Math.max(Math.abs(base), Math.abs(actualVal)) * 1e-10;
      return actualVal >= base - tol - eps && actualVal <= base + tol + eps;
    }

    // 4. Tiêu chuẩn Dải khoảng: min - max hoặc min ~ max
    if (spec.type === 'RANGE') {
      const min = spec.min ?? 0;
      const max = spec.max ?? 0;
      const eps = Math.max(Math.abs(min), Math.abs(max), Math.abs(actualVal)) * 1e-10;
      if (actualVal >= min - eps && actualVal <= max + eps) {
        return true;
      }
      if (min <= 0 && isLODOrZero(max)) {
        return true;
      }
      return false;
    }

    // 5. Tiêu chuẩn Toán tử so sánh: <=, >=, <, >, NMT, NLT
    if (spec.type === 'COMPARISON') {
      const target = spec.targetValue ?? 0;
      const eps = Math.max(Math.abs(target), Math.abs(actualVal)) * 1e-10;

      switch (spec.operator) {
        case '<=':
        case 'NMT':
          return actualVal <= target + eps || isLODOrZero(target);
        case '>=':
        case 'NLT':
          return actualVal >= target - eps;
        case '<':
          return actualVal < target || isLODOrZero(target);
        case '>':
          return actualVal > target;
        case '==':
          return Math.abs(actualVal - target) <= eps;
        default:
          return actualVal <= target + eps || isLODOrZero(target);
      }
    }

    return null;
  }

  /**
   * Đánh giá trực tiếp chuỗi giới hạn (limit text) và chuỗi giá trị (value text)
   */
  static checkRange(limit: string, value: string): boolean | null {
    const val = normalizeValue(value);
    const spec = SpecificationParser.parse(limit);
    return CriterionEvaluator.evaluateParsed(spec, val);
  }

  /**
   * Đánh giá toàn diện một Criterion entity và raw value
   */
  static evaluateCriterion(criterion: any, value: any): SingleCriterionResult {
    const val = normalizeValue(value);

    // Xác định chuỗi tham chiếu cho criterion
    let referenceText: string | undefined;
    if (criterion.type === 'NUMBER') {
      if (criterion.min != null && criterion.max != null) {
        referenceText = `${criterion.min} - ${criterion.max}`;
      } else if (criterion.min != null) {
        referenceText = `>= ${criterion.min}`;
      } else if (criterion.max != null) {
        referenceText = `<= ${criterion.max}`;
      } else {
        referenceText = criterion.expectedText;
      }
    } else {
      referenceText = criterion.expectedText;
    }

    const spec = SpecificationParser.parse(referenceText, criterion.type);
    let isPass: boolean | null = null;

    if (referenceText) {
      isPass = CriterionEvaluator.evaluateParsed(spec, val);
    }

    // Nếu chưa có kết luận qua checkRange, fallback về legacy evaluator
    if (isPass === null) {
      isPass = legacyEvaluateCriterion(criterion, val.stringValue);
    }

    return {
      criterionName: criterion.name,
      rawValue: value,
      normalizedValue: val,
      specification: spec,
      isPass,
    };
  }
}
