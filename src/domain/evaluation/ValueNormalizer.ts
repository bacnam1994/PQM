/**
 * ValueNormalizer.ts
 * Module chuẩn hóa các giá trị kiểm nghiệm thô (Raw Test Values).
 * Xử lý: dấu chấm/phẩy theo quy chuẩn Dược, số mũ khoa học (1.5x10^5, 10^3, Unicode superscripts),
 * các giá trị định tính (ND, Không phát hiện, Âm tính, Dương tính) và ký hiệu toán học (<10, >10).
 */

import { NormalizedValue } from './EvaluationTypes';

export const ND_KEYWORDS = [
  'ND',
  'NOT DETECTED',
  'KHÔNG PHÁT HIỆN',
  'K.P.H',
  'KPH',
  'ÂM TÍNH',
  'NEGATIVE',
  'KHÔNG CÓ',
  'KHÔNG ĐƯỢC CÓ',
];

export const POS_KEYWORDS = [
  'POSITIVE',
  'DƯƠNG TÍNH',
  'PHÁT HIỆN',
  'CÓ PHÁT HIỆN',
  'DETECTED',
  'CÓ',
];

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
};

/**
 * Chuẩn hóa chuỗi số / dấu thập phân thông minh:
 * - Thay thế các dấu phẩy thập phân (VD: "0,5" -> "0.5", "5,0 - 10,0" -> "5.0 - 10.0")
 * - Xử lý đúng phân cách hàng nghìn (VD: "1,000,000" -> "1000000", "1.000.000" -> "1000000")
 */
export const standardizeDecimalString = (str: string | number | null | undefined): string => {
  if (str === null || str === undefined) return '';
  let s = String(str).trim().replace(/[–—]/g, '-');

  // 1. Số có cả chấm và phẩy (VD: 1,234.56 hoặc 1.234,56)
  s = s.replace(/(\d{1,3}(?:,\d{3})+)\.(\d+)/g, (_, p1, p2) => p1.replace(/,/g, '') + '.' + p2);
  s = s.replace(/(\d{1,3}(?:\.\d{3})+),(\d+)/g, (_, p1, p2) => p1.replace(/\./g, '') + '.' + p2);

  // 2. Số có nhiều dấu phẩy/chấm phân cách hàng nghìn (VD: 1,000,000 hoặc 1.000.000)
  s = s.replace(/(\d{1,3}(?:,\d{3}){2,})/g, (match) => match.replace(/,/g, ''));
  s = s.replace(/(\d{1,3}(?:\.\d{3}){2,})/g, (match) => match.replace(/\./g, ''));

  // 3. Đổi các dấu phẩy đơn lẻ giữa 2 số thành dấu chấm thập phân (VD: "0,5" -> "0.5", "10,0" -> "10.0")
  s = s.replace(/(\d+),(\d+)/g, '$1.$2');

  return s;
};

/**
 * Chuẩn hóa chuỗi số liệu nhập vào (xử lý dấu phẩy/chấm, số mũ, ký tự đặc biệt)
 */
export const normalizeNumericString = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  let str = standardizeDecimalString(value);

  // 1. Chuyển đổi số mũ nhỏ về ^
  str = str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (match) => {
    return (
      '^' +
      match
        .split('')
        .map((c) => SUPERSCRIPTS[c] || c)
        .join('')
    );
  });

  // 2. VÁ LỖI BACILLUS: Nhận diện định dạng khoa học linh hoạt (bỏ qua mọi khoảng trắng, dấu x, dấu *)
  str = str.replace(/([+-]?\d*\.?\d+)\s*[xX*×]\s*10\s*(?:\^)?\s*([+-]?\d+)/gi, (_, p1, p2) => {
    const num = parseFloat(p1);
    const exp = parseInt(p2, 10);
    return String(num * Math.pow(10, exp));
  });

  // 3. Xử lý định dạng khoa học đứng độc lập (VD: 10^3, khoảng trắng 10 3)
  str = str.replace(/(^|[^\d.xX*×])10(?:\s*\^\s*|\s+)([+-]?\d+)/gi, (_, prefix, p1) => {
    const exp = parseInt(p1, 10);
    return prefix + String(Math.pow(10, exp));
  });

  // 4. Mở rộng khoa học dạng e (VD: 1.6e9)
  str = str.replace(/([+-]?\d+(\.\d+)?)e([+-]?\d+)/gi, (match) => {
    try {
      const num = Number(match);
      if (!isNaN(num) && Math.abs(num) < 1e21) {
        return num.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
      }
    } catch {}
    return match;
  });

  return str;
};

/**
 * Phân tích chuỗi nhập liệu thành số thực
 */
export const parseNumberFromText = (text: string | number | null | undefined): number => {
  if (text === null || text === undefined) return NaN;
  const str = normalizeNumericString(text).trim();
  const match = str.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  return match ? parseFloat(match[0]) : NaN;
};

export const safeParseFloat = (str: string): number => {
  if (!str) return NaN;
  const standardized = standardizeDecimalString(str);
  const cleaned = standardized.trim().replace(/[^\d.eE+-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
};

const normalizeTextForComparison = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

/**
 * Chuẩn hóa toàn diện giá trị kiểm nghiệm thành đối tượng NormalizedValue
 */
export const normalizeValue = (rawValue: any): NormalizedValue => {
  const stringValue = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();
  const normalizedStr = normalizeTextForComparison(stringValue);

  const ndKeywordsNorm = ND_KEYWORDS.map(normalizeTextForComparison);
  const posKeywordsNorm = POS_KEYWORDS.map(normalizeTextForComparison);

  const isND = ndKeywordsNorm.some((kw) => normalizedStr.includes(kw));
  const isPositive = posKeywordsNorm.some((kw) => normalizedStr.includes(kw));

  const isStrictLessThan = /^<(?!=|≤)/.test(stringValue);
  const isStrictGreaterThan = /^>(?!=|≥)/.test(stringValue);

  let numericValue: number | null = null;
  if (isND) {
    numericValue = 0;
  } else {
    const parsed = parseNumberFromText(stringValue);
    if (!isNaN(parsed)) {
      if (isStrictLessThan) {
        numericValue = parsed - Math.max(Math.abs(parsed), 1) * 1e-9;
      } else if (isStrictGreaterThan) {
        numericValue = parsed + Math.max(Math.abs(parsed), 1) * 1e-9;
      } else {
        numericValue = parsed;
      }
    }
  }

  return {
    rawValue,
    stringValue,
    numericValue,
    isND,
    isPositive,
    isStrictLessThan,
    isStrictGreaterThan,
  };
};
