
import { CriterionType } from '../types';

// --- HELPER: Parse Microbiological Values (e.g., "10⁴", "≤ 1.5x10⁵") ---
export const parseFlexibleValue = (input: string | number): number | null => {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return input;

  // Standardize input for US/UK format: remove thousand separators (,) and trim.
  const str = input.toString().trim().replace(/,/g, '');
  if (str === '') return null;
  
  // --- Priority 1: Superscript or Caret notation (e.g., "10⁴", "1.5x10^5") ---
  const supers: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
  const superChars = Object.keys(supers).join('');
  
  // Regex to find "10" followed by superscript characters OR "10^" followed by regular digits
  const powerRegex = new RegExp(`10(?:([${superChars}]+)|\\^(\\-?[\\d\\.]+))`);
  const powerMatch = str.match(powerRegex);
  
  if (powerMatch) {
    // powerMatch[1] will be the superscript exponent, powerMatch[2] will be the caret exponent
    const expStr = powerMatch[1] ? powerMatch[1].split('').map(c => supers[c]).join('') : powerMatch[2];
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

  const negatives = ['âm tính', 'negative', 'không phát hiện', 'không có', 'not detected', 'kph', 'không được có'];
  const strVal = String(value).trim();
  const lowerStrVal = strVal.toLowerCase();
  
  const isZeroOrAbsent = (v: string) => {
    const lower = v.toLowerCase();
    return negatives.some(n => lower.includes(n)) || v.trim() === '0';
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

  // Path 2a: Requirement is "absent" type.
  if (isRequirementAbsent) {
    return isResultAbsent;
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
              tolerance = base * (tolerance / 100);
            }
            return resultAsNumber >= base - tolerance && resultAsNumber <= base + tolerance;
          }
        }
        return resultAsNumber === limitVal;
    }
  }

  // Fallback to text comparison.
  return lowerStrVal.includes(limitText.toLowerCase());
};
