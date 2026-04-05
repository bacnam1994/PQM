
import { CriterionType } from '../types';

// Tối ưu 1: Cache localStorage để tránh blocking I/O khi gọi hàm hàng ngàn lần
let cachedDecimalSeparator: string | null = null;
const getDecimalSeparator = () => {
  if (cachedDecimalSeparator !== null) return cachedDecimalSeparator;
  if (typeof window === 'undefined') return 'dot';
  try {
    let separator = localStorage.getItem('app_decimal_separator');
    if (separator && separator.startsWith('"') && separator.endsWith('"')) {
      separator = separator.slice(1, -1);
    }
    cachedDecimalSeparator = separator || 'dot';
  } catch {
    cachedDecimalSeparator = 'dot';
  }
  return cachedDecimalSeparator;
};

// Tối ưu 2: Đưa các object, array, RegExp tĩnh ra ngoài scope hàm
// Tránh việc Engine JS phải khởi tạo lại bộ nhớ (Memory Allocation) và compile RegExp mỗi lần gọi hàm.
const SUPERS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
const SUPER_CHARS = Object.keys(SUPERS).join('');
const POWER_REGEX = new RegExp(`10(?:([${SUPER_CHARS}]+)|\\^(\\-?[\\d\\.]+))`);
const NEGATIVE_KEYWORDS = ['âm tính', 'negative', 'không phát hiện', 'không có', 'not detected', 'kph', 'k.p.h', 'nd', 'không được có'];
const POSITIVE_KEYWORDS = ['dương tính', 'positive', 'phát hiện', 'có phát hiện', 'detected', 'có'];

// --- HELPER: Parse Microbiological Values (e.g., "10⁴", "≤ 1.5x10⁵") ---
export const parseFlexibleValue = (input: string | number): number | null => {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return input;

  // Standardize input based on locale settings
  let separator = getDecimalSeparator();

  let str = input.toString().trim();
  if (separator === 'comma') {
    str = str.replace(/\./g, '').replace(/,/g, '.');
  } else {
    str = str.replace(/,/g, '');
  }

  if (str === '') return null;
  
  // --- Priority 1: Superscript or Caret notation (e.g., "10⁴", "1.5x10^5") ---
  const powerMatch = str.match(POWER_REGEX);
  
  if (powerMatch) {
    // powerMatch[1] will be the superscript exponent, powerMatch[2] will be the caret exponent
    const expStr = powerMatch[1] ? powerMatch[1].split('').map(c => SUPERS[c]).join('') : powerMatch[2];
    if (expStr !== undefined) {
        const exp = parseFloat(expStr);
        
        const matchIndex = powerMatch.index || 0;
        const prefix = str.substring(0, matchIndex).trim();
        
        let base = 1;
        if (prefix) {
          // Remove non-numeric characters to get the base
          // FIX: Dùng match để tìm số thay vì replace, tránh trường hợp "Max. 1.5" bị biến thành ".1.5" (sai giá trị)
          const numberMatches = prefix.replace(/[x*]/gi, '').match(/-?[\d\.]+/g);
          if (numberMatches) {
            const validNumbers = numberMatches.filter(n => !isNaN(parseFloat(n)));
            if (validNumbers.length > 0) base = parseFloat(validNumbers[validNumbers.length - 1]);
          }
        }
        if (!isNaN(exp)) {
            return base * Math.pow(10, exp);
        }
    }
  }

  // --- Priority 2: Full scientific e-notation (e.g., 1.5e5) ---
  // This regex captures base and exponent for e-notation.
  let sciMatch = str.toLowerCase().match(/(-?[\d\.]+)\s*e\s*(-?[\d\.]+)/);
  if (sciMatch) {
    const base = parseFloat(sciMatch[1]);
    const exp = parseFloat(sciMatch[2]);
    if (!isNaN(base) && !isNaN(exp)) {
      return base * Math.pow(10, exp);
    }
  }

  // --- Priority 3: Plain number (strips any surrounding text) ---
  // This will catch numbers in strings like "<= 100" or "5.5"
  const numericMatch = str.match(/-?[\d\.]+/);
  if (numericMatch) {
    const num = parseFloat(numericMatch[0]);
    if (!isNaN(num)) {
      return num;
    }
  }
  
  return null;
};

export const getOperator = (text: string): string => {
  if (text.includes('≤') || text.includes('=<')) return '<=';
  if (text.includes('≥') || text.includes('=>')) return '>=';
  if (text.includes('<')) return '<';
  if (text.includes('>')) return '>';
  return '=';
};

// --- HELPER: Ensure Array (Fix Firebase Object/Array issue) ---
export const ensureArray = (data: any) => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(item => item != null);
  if (typeof data === 'object') return Object.values(data).filter(item => item != null);
  return [];
};

// --- HELPER: Evaluate Criterion (PASS/FAIL) ---
export const evaluateCriterion = (c: any, value: string | number): boolean => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return false;
  }

  const strVal = String(value).trim();
  const lowerStrVal = strVal.toLowerCase();
  
  const isZeroOrAbsent = (v: string) => {
    const lower = v.toLowerCase();
    return NEGATIVE_KEYWORDS.some(n => lower.includes(n)) || v.trim() === '0';
  };

  const isPositive = (v: string) => {
    const lower = v.toLowerCase();
    return POSITIVE_KEYWORDS.some(p => lower.includes(p));
  };

  const isResultAbsent = isZeroOrAbsent(strVal);
  let resultAsNumber: number | null = parseFlexibleValue(strVal);
  if (resultAsNumber === null && isResultAbsent) {
    resultAsNumber = 0;
  }

  // Case 1: Criterion is defined with min/max (quantitative)
  if (c.type === CriterionType.NUMBER) {
    if (resultAsNumber === null) {
      // Result is non-numeric and not an "absent" word, e.g., "Cloudy" for a pH value.
      return false;
    }
    const min = (c.min !== undefined && c.min !== null && c.min !== '') ? parseFloat(String(c.min)) : -Infinity;
    const max = (c.max !== undefined && c.max !== null && c.max !== '') ? parseFloat(String(c.max)) : Infinity;
    return resultAsNumber >= min && resultAsNumber <= max;
  }

  // Case 2: Criterion is defined with expectedText (qualitative or text-based quantitative)
  const limitText = c.expectedText || '';
  if (!limitText) {
    return true; // No requirement text means any non-empty value passes.
  }
  
  const isRequirementAbsent = isZeroOrAbsent(limitText);
  const isRequirementPositive = isPositive(limitText);

  // Path 2a: Requirement is "absent" type.
  if (isRequirementAbsent) {
    return isResultAbsent;
  }
  
  // Path 2a-bis: Requirement is "positive" type.
  if (isRequirementPositive) {
    return isPositive(strVal);
  }
  
  // Path 2b: Requirement is not "absent", but result is.
  if (isResultAbsent) {
    // This means result is 0. We must compare with a numeric limit.
    const limitVal = parseFlexibleValue(limitText);
    if (limitVal === null) {
      // e.g. Requirement "Clear", Result "Negative". This is a fail.
      return false;
    }
    const op = getOperator(limitText);
    switch (op) {
      case '<=': return 0 <= limitVal;
      case '>=': return 0 >= limitVal;
      case '<':  return 0 < limitVal;
      case '>':  return 0 > limitVal;
      default:   return 0 === limitVal;
    }
  }

  // Path 2c: Neither are "absent". Compare them.
  // Try numeric first.
  const limitVal = parseFlexibleValue(limitText);
  if (resultAsNumber !== null && limitVal !== null) {
    const op = getOperator(limitText);
    switch (op) {
      case '<=': return resultAsNumber <= limitVal;
      case '>=': return resultAsNumber >= limitVal;
      case '<':  return resultAsNumber < limitVal;
      case '>':  return resultAsNumber > limitVal;
      default: // '='
        const pmSymbol = limitText.includes('±') ? '±' : limitText.includes('+/-') ? '+/-' : null;
        if (pmSymbol) {
          const parts = limitText.split(pmSymbol);
          const base = parseFlexibleValue(parts[0]);
          const tolerancePart = parts[1] || '';
          let tolerance = parseFlexibleValue(tolerancePart);
          if (base !== null && tolerance !== null) {
            if (tolerancePart.includes('%')) {
              tolerance = Math.abs(base) * (tolerance / 100);
            }
            
            const EPSILON = 1e-6;
            return resultAsNumber >= base - tolerance - EPSILON && resultAsNumber <= base + tolerance + EPSILON;
          }
        }
        return resultAsNumber === limitVal;
    }
  }

  // Fallback to text comparison.
  return lowerStrVal.includes(limitText.toLowerCase());
};
