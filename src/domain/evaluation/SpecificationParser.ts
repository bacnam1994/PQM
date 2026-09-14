/**
 * SpecificationParser.ts
 * Module bóc tách giới hạn/tiêu chuẩn kỹ thuật TCCS (Specifications Parser).
 * Hỗ trợ mọi cú pháp tiêu chuẩn kiểm nghiệm Dược điển:
 * - Dung sai: "10 ± 2", "100 ± 10%", "+/-"
 * - Dải khoảng: "5.0 - 10.0", "5.0 ~ 10.0", "-20.0 - -10.0"
 * - Bất đẳng thức: "<= 10", "≤ 10", ">= 5", "≥ 5", "< 10", "> 5", "NMT 10", "NLT 95%"
 * - Định tính: "Không phát hiện", "Âm tính", "Dương tính", "Màu vàng sáng"...
 */

import { ParsedSpecification } from './EvaluationTypes';
import {
  normalizeNumericString,
  parseNumberFromText,
  ND_KEYWORDS,
  POS_KEYWORDS,
} from './ValueNormalizer';

const normalizeTextForComparison = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

export class SpecificationParser {
  static parse(
    limit: string | number | null | undefined,
    criterionType?: 'NUMBER' | 'TEXT'
  ): ParsedSpecification {
    const raw = limit === null || limit === undefined ? '' : String(limit).trim();
    if (!raw) {
      return { type: 'EXACT_TEXT', raw: '', expectedText: '' };
    }

    const normText = normalizeTextForComparison(raw);
    const ndKeywordsNorm = ND_KEYWORDS.map(normalizeTextForComparison);
    const posKeywordsNorm = POS_KEYWORDS.map(normalizeTextForComparison);

    // 1. Kiểm tra giới hạn Không phát hiện / Âm tính (ND)
    if (ndKeywordsNorm.some((kw) => normText.includes(kw))) {
      return {
        type: 'NOT_DETECTED',
        raw,
        expectedText: raw,
        isLODCapable: true,
      };
    }

    // 2. Kiểm tra giới hạn Dương tính
    if (posKeywordsNorm.some((kw) => normText.includes(kw))) {
      return {
        type: 'POSITIVE',
        raw,
        expectedText: raw,
      };
    }

    const normNumeric = normalizeNumericString(raw).trim();

    // 3. Kiểm tra định dạng Dung sai ± hoặc +/-
    const pmSymbol = normNumeric.includes('±') ? '±' : normNumeric.includes('+/-') ? '+/-' : null;
    if (pmSymbol) {
      const parts = normNumeric.split(pmSymbol);
      if (parts.length === 2) {
        const base = parseNumberFromText(parts[0]);
        const tolerance = parseNumberFromText(parts[1]);
        if (!isNaN(base) && !isNaN(tolerance)) {
          const isPercentage = parts[1].includes('%');
          return {
            type: 'TOLERANCE',
            raw,
            baseValue: base,
            toleranceValue: tolerance,
            isPercentageTolerance: isPercentage,
          };
        }
      }
    }

    // 4. Kiểm tra định dạng Dải khoảng: "min - max" hoặc "min ~ max"
    // Lưu ý: regex \s+-\s+|\s*~\s* để không cắt nhầm dấu trừ của số âm (VD: -20 - -10)
    const rangeParts = normNumeric.split(/\s+-\s+|\s*~\s*/);
    if (rangeParts.length === 2) {
      const min = parseNumberFromText(rangeParts[0]);
      const max = parseNumberFromText(rangeParts[1]);
      if (!isNaN(min) && !isNaN(max)) {
        return {
          type: 'RANGE',
          raw,
          min,
          max,
          isLODCapable: min <= 0,
        };
      }
    }

    // 5. Kiểm tra các toán tử bất đẳng thức: NMT, NLT, <=, ≥, <, >
    const cleanLimit = normNumeric.trim();
    const upperLimit = cleanLimit.toUpperCase();

    if (/^NMT\b/i.test(upperLimit)) {
      const num = parseNumberFromText(cleanLimit.replace(/^NMT\b/i, ''));
      if (!isNaN(num)) {
        return {
          type: 'COMPARISON',
          raw,
          operator: 'NMT',
          targetValue: num,
          isLODCapable: true,
        };
      }
    }

    if (/^NLT\b/i.test(upperLimit)) {
      const num = parseNumberFromText(cleanLimit.replace(/^NLT\b/i, ''));
      if (!isNaN(num)) {
        return {
          type: 'COMPARISON',
          raw,
          operator: 'NLT',
          targetValue: num,
        };
      }
    }

    if (/^<=|≤/.test(cleanLimit)) {
      const num = parseNumberFromText(cleanLimit.replace(/^<=|≤/, ''));
      if (!isNaN(num)) {
        return {
          type: 'COMPARISON',
          raw,
          operator: '<=',
          targetValue: num,
          isLODCapable: true,
        };
      }
    }

    if (/^>=|≥/.test(cleanLimit)) {
      const num = parseNumberFromText(cleanLimit.replace(/^>=|≥/, ''));
      if (!isNaN(num)) {
        return {
          type: 'COMPARISON',
          raw,
          operator: '>=',
          targetValue: num,
        };
      }
    }

    if (/^</.test(cleanLimit)) {
      const num = parseNumberFromText(cleanLimit.replace(/^</, ''));
      if (!isNaN(num)) {
        return {
          type: 'COMPARISON',
          raw,
          operator: '<',
          targetValue: num,
          isLODCapable: true,
        };
      }
    }

    if (/^>/.test(cleanLimit)) {
      const num = parseNumberFromText(cleanLimit.replace(/^>/, ''));
      if (!isNaN(num)) {
        return {
          type: 'COMPARISON',
          raw,
          operator: '>',
          targetValue: num,
        };
      }
    }

    // 6. Số đơn lẻ (Mặc định trong kiểm nghiệm Dược: số đơn lẻ là giới hạn trên Max / <=)
    const singleNum = parseNumberFromText(cleanLimit);
    if (!isNaN(singleNum) && criterionType !== 'TEXT') {
      return {
        type: 'COMPARISON',
        raw,
        operator: '<=',
        targetValue: singleNum,
        isLODCapable: true,
      };
    }

    // 7. Định tính thuần chuỗi (EXACT_TEXT / SENSORY)
    return {
      type: 'EXACT_TEXT',
      raw,
      expectedText: raw,
    };
  }
}
