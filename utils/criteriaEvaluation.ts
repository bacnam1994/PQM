import { evaluateCriterion } from './parsing';

/**
 * Chuẩn hóa chuỗi số liệu nhập vào (xử lý dấu phẩy/chấm, số mũ, ký tự đặc biệt)
 */
export const normalizeNumericString = (text: string): string => {
  if (!text) return '';
  if (typeof window === 'undefined') return text;
  
  let separator = localStorage.getItem('app_decimal_separator');
  // Xử lý trường hợp useLocalStorage lưu string dưới dạng JSON (có dấu ngoặc kép)
  if (separator && separator.startsWith('"') && separator.endsWith('"')) {
    separator = separator.slice(1, -1);
  }
  separator = separator || 'dot';

  const superscripts: { [key: string]: string } = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
  };
  let normalized = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (char) => superscripts[char]);
  
  // Normalize dashes (en-dash, em-dash to hyphen)
  normalized = normalized.replace(/[–—]/g, '-');

  if (separator === 'comma') {
    // Nếu dùng dấu phẩy là thập phân: Xóa dấu chấm (hàng nghìn) -> Thay phẩy bằng chấm
    normalized = normalized.replace(/\./g, '');
    normalized = normalized.replace(/,/g, '.');
  } else {
    // Nếu dùng dấu chấm là thập phân (mặc định): Xóa dấu phẩy (hàng nghìn)
    normalized = normalized.replace(/,/g, '');
  }

  // Chuẩn hóa dấu nhân và khoảng trắng xung quanh về 'x'
  normalized = normalized.replace(/\s*[xX*×]\s*/g, 'x');
  // Chuẩn hóa phần cơ số 10 (VD: "10 9", "10^9" -> "10^9")
  normalized = normalized.replace(/10\s*\^?\s*/g, '10^');
  // Regex bắt định dạng khoa học: số + 'x' + '10^' + số mũ -> chuyển về dạng e
  normalized = normalized.replace(/(\d+(?:\.\d+)?)x10\^?(-?\d+)/g, '$1e$2');
  // Xử lý trường hợp 10^x đứng một mình (không có số đứng trước) -> 1e x
  // Sử dụng callback để tránh lỗi tham chiếu nhóm $11 (có thể bị hiểu nhầm là group 11 thay vì group 1 + '1')
  normalized = normalized.replace(/(^|[^\d\.x])10\^?(-?\d+)/g, (match, p1, p2) => {
    return p1 + '1e' + p2;
  });
  
  // Expand scientific notation to plain numbers (e.g. 1.6e9 -> 1600000000)
  normalized = normalized.replace(/(\d+(\.\d+)?)e([+-]?\d+)/g, (match) => {
    try {
      const num = Number(match);
      // Sử dụng en-US để đảm bảo dấu thập phân là dấu chấm, tránh lỗi khi parse lại sau này
      if (!isNaN(num) && Math.abs(num) < 1e21) return num.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
    } catch {}
    return match;
  });
  
  return normalized;
};

/**
 * Phân tích chuỗi nhập liệu (có thể chứa đơn vị) thành số thực.
 * Hỗ trợ các định dạng lũy thừa: 10^3, 10 3, 1.5x10^5...
 * Dùng cho các form nhập liệu như Công thức sản phẩm.
 */
export const parseNumberFromText = (text: string): number => {
  if (!text) return 0;
  const normalized = normalizeNumericString(text);
  const val = parseFloat(normalized);
  return isNaN(val) ? 0 : val;
};

/**
 * Hỗ trợ nhập nhanh các ký tự đặc biệt trong form:
 * - 10e3 -> 10^3 (Thay e/E bằng ^ nếu sau đó là số)
 * - * -> x (Thay dấu sao bằng chữ x)
 */
export const autoFormatInput = (text: string): string => {
  if (!text) return '';
  return text.replace(/(\d)[eE](?=[+-]?\d)/g, '$1^').replace(/\*/g, 'x');
};

/**
 * Kiểm tra giá trị có nằm trong khoảng quy định (dạng text "min - max" hoặc "≤ 10")
 */
export const checkRange = (limit: string, value: string): boolean | null => {
  // 1. Xử lý trường hợp ± (Cộng/Trừ) hoặc +/-
  const pmSymbol = limit.includes('±') ? '±' : limit.includes('+/-') ? '+/-' : null;
  if (pmSymbol) {
    const parts = limit.split(pmSymbol);
    if (parts.length === 2) {
      const base = parseFloat(parts[0]);
      let tolerance = parseFloat(parts[1]);
      const val = parseFloat(value);

      if (!isNaN(base) && !isNaN(tolerance) && !isNaN(val)) {
        if (parts[1].includes('%')) {
          tolerance = base * (tolerance / 100);
        }
        return val >= (base - tolerance) && val <= (base + tolerance);
      }
    }
  }

  // Kiểm tra định dạng khoảng "min - max"
  const parts = limit.split(/\s*[-~]\s*/);
  if (parts.length === 2) {
    const min = parseFloat(parts[0]);
    const max = parseFloat(parts[1]);
    const val = parseFloat(value);
    if (!isNaN(min) && !isNaN(max) && !isNaN(val)) {
      return val >= min && val <= max;
    }
  }
  
  // Hỗ trợ đánh giá các toán tử so sánh hoặc giới hạn đơn (mặc định là Max)
  const val = parseFloat(value);
  if (!isNaN(val)) {
    const cleanLimit = limit.trim();
    if (/^<=|≤/.test(cleanLimit)) return val <= parseFloat(cleanLimit.replace(/<=|≤/, ''));
    if (/^>=|≥/.test(cleanLimit)) return val >= parseFloat(cleanLimit.replace(/>=|≥/, ''));
    if (/^</.test(cleanLimit)) return val < parseFloat(cleanLimit.replace(/</, ''));
    if (/^>/.test(cleanLimit)) return val > parseFloat(cleanLimit.replace(/>/, ''));
    
    const limitNum = parseFloat(cleanLimit);
    if (!isNaN(limitNum)) return val <= limitNum;
  }
  return null;
};

/**
 * Làm tròn một giá trị số dựa trên số chữ số thập phân của một chuỗi tham chiếu.
 * Ví dụ: roundValue(0.501, "0.50") sẽ trả về 0.50
 */
const roundValue = (value: number, reference: string): number => {
  const decimalMatch = reference.match(/\.(\d+)/);
  if (decimalMatch && decimalMatch[1]) {
    const decimalPlaces = decimalMatch[1].length;
    const factor = Math.pow(10, decimalPlaces);
    // Sử dụng làm tròn toán học thông thường
    return Math.round(value * factor) / factor;
  }
  return value;
};

/**
 * Đánh giá chỉ tiêu thông minh: Tự động chuẩn hóa và chọn phương pháp đánh giá phù hợp
 */
export const evaluateCriterionSmart = (criterion: any, value: any): boolean => {
  const normalizedCriterion = { ...criterion };
  
  // Chuẩn hóa expectedText nếu có
  if (normalizedCriterion.expectedText) {
     normalizedCriterion.expectedText = normalizeNumericString(normalizedCriterion.expectedText);
  }
  
  // Chuẩn hóa giá trị
  const normalizedValue = typeof value === 'string' ? normalizeNumericString(value) : value;
  
  // Ưu tiên dùng checkRange nếu có expectedText (xử lý cả trường hợp NUMBER nhưng quy định dạng text)
  if (normalizedCriterion.expectedText) {
    let valueToCompare = String(normalizedValue);
    const numericValue = parseFloat(valueToCompare);
    if (!isNaN(numericValue)) {
      const roundedValue = roundValue(numericValue, normalizedCriterion.expectedText);
      valueToCompare = String(roundedValue);
    }
     const rangeCheck = checkRange(normalizedCriterion.expectedText, valueToCompare);
     if (rangeCheck !== null) return rangeCheck;
  }
  
  // Fallback về hàm đánh giá cơ bản
  return evaluateCriterion(normalizedCriterion, normalizedValue);
};
