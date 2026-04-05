import { evaluateCriterion } from './parsing';
import React from 'react';

export const safeParseFloat = (str: string): number => {
  if (!str) return NaN;
  // CHÚ Ý: Phải giữ lại e, E và + để không làm hỏng các số định dạng khoa học (VD: 1.5e-5)
  const cleaned = str.trim().replace(/[^\d.eE+-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
};

/**
 * Chuẩn hóa chuỗi số liệu nhập vào (xử lý dấu phẩy/chấm, số mũ, ký tự đặc biệt)
 */
export const normalizeNumericString = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // 1. Xử lý dấu thập phân an toàn (tránh lỗi JSON quote và rò rỉ state giữa các test case)
  let isComma = false;
  try {
    const stored = localStorage.getItem('app_decimal_separator');
    if (stored && stored.includes('comma')) {
      isComma = true;
    }
  } catch (e) {}

  // Normalize dashes (en-dash, em-dash to hyphen)
  str = str.replace(/[–—]/g, '-');

  if (isComma) {
    // Nếu dùng dấu phẩy là thập phân: Xóa dấu chấm (hàng nghìn) -> Thay phẩy bằng chấm
    str = str.replace(/\./g, '').replace(/,/g, '.');
  } else {
    // Nếu dùng dấu chấm là thập phân (mặc định): Xóa dấu phẩy (hàng nghìn)
    str = str.replace(/,/g, '');
  }

  // 2. Chuyển đổi ký tự số mũ đặc biệt về định dạng tiêu chuẩn (^)
  const superscripts: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁻': '-'
  };
  str = str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (match) => {
    return '^' + match.split('').map(c => superscripts[c] || c).join('');
  });

  // Chuẩn hóa dấu nhân và khoảng trắng xung quanh về 'x'
  str = str.replace(/\s*[xX*×]\s*/g, 'x');

  // 3. Xử lý định dạng khoa học có chứa hệ số nhân (VD: 1.5x10^5, 1.5x10 5)
  str = str.replace(/([+-]?\d*\.?\d+)\s*x\s*10(?:(?:\s*\^\s*)|(?:\s+))([+-]?\d+)/gi, (match, p1, p2) => {
    const num = parseFloat(p1);
    const exp = parseInt(p2, 10);
    return String(num * Math.pow(10, exp));
  });
  
  // 4. Xử lý định dạng khoa học đứng độc lập (VD: 10^3, khoảng trắng 10 3). Bắt buộc có ^ hoặc khoảng trắng để tránh lỗi số 100, 108.
  str = str.replace(/(^|[^\d.x])10(?:(?:\s*\^\s*)|(?:\s+))([+-]?\d+)/gi, (match, prefix, p1) => {
    const exp = parseInt(p1, 10);
    return prefix + String(Math.pow(10, exp));
  });

  // 5. Expand scientific notation to plain numbers (e.g. 1.6e9 -> 1600000000)
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
 * Phân tích chuỗi nhập liệu (có thể chứa đơn vị) thành số thực.
 * Hỗ trợ các định dạng lũy thừa: 10^3, 10 3, 1.5x10^5...
 * Dùng cho các form nhập liệu như Công thức sản phẩm.
 * Trích xuất phần số hợp lệ đầu tiên, bỏ qua mọi rác bám đuôi.
 */
export const parseNumberFromText = (text: string | number | null | undefined): number => {
  if (text === null || text === undefined) return NaN;
  // Khử khoảng trắng đầu cuối
  const str = normalizeNumericString(text).trim();
  // Trích xuất phần số hợp lệ đầu tiên, bỏ qua mọi rác bám đuôi (VD: 108.0abc -> 108.0)
  const match = str.match(/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  return match ? parseFloat(match[0]) : NaN;
};

/**
 * Hỗ trợ nhập nhanh các ký tự đặc biệt trong form:
 * - 10e3 -> 10^3 (Thay e/E bằng ^ nếu sau đó là số)
 * - * -> x (Thay dấu sao bằng chữ x)
 */
export const autoFormatInput = (text: string): string => {
  if (!text) return '';
  // Tối ưu 3: Dùng includes (siêu nhanh trong JS) để chặn Regex chạy dư thừa
  if (!text.includes('e') && !text.includes('E') && !text.includes('*')) return text;
  // Chỉ tự động đổi 'e' thành '^' nếu nó đi ngay sau số 10 (VD: 10e3 -> 10^3).
  // KHÔNG đổi các trường hợp như 1.5e5 để bảo toàn giá trị khoa học nguyên bản.
  return text.replace(/10[eE](?=[+-]?\d)/g, '10^').replace(/\*/g, 'x');
};

/**
 * Kiểm tra giá trị có nằm trong khoảng quy định (dạng text "min - max" hoặc "≤ 10")
 */
export const checkRange = (limit: string, value: string): boolean | null => {
  // 0. Xử lý logic ND (Not Detected) / Âm tính / Không phát hiện
  const limitUpper = limit.toUpperCase();
  const valueUpper = String(value).toUpperCase();
  
  const isLimitND = ND_KEYWORDS.some(kw => limitUpper.includes(kw));
  const isValueND = ND_KEYWORDS.some(kw => valueUpper.includes(kw));
  
  const isLimitPos = POS_KEYWORDS.some(kw => limitUpper.includes(kw));
  const isValuePos = POS_KEYWORDS.some(kw => valueUpper.includes(kw));

  if (isLimitND) {
    // Nếu Yêu cầu là ND -> Kết quả thực tế phải chứa từ khóa ND hoặc là số <= 0
    if (isValueND) return true;
    if (isValuePos) return false; // Fail ngay nếu kết quả là Dương tính
    const valNum = parseNumberFromText(value);
    if (!isNaN(valNum)) return valNum <= 0;
    return false;
  }
  
  if (isLimitPos) {
    // Nếu Yêu cầu là Dương tính (VD: Test đối chứng sinh học)
    return isValuePos;
  }

  if (isValueND) {
    // Nếu Kết quả nhập là ND nhưng Yêu cầu là Số (VD: <= 10) -> Tạm quy đổi ND thành 0 để tính toán
    value = "0";
  }

  const actualVal = parseNumberFromText(value);
  if (isNaN(actualVal)) return null;

  const normLimit = normalizeNumericString(limit).trim();

  // 1. Xử lý trường hợp ± (Cộng/Trừ) hoặc +/-
  const pmSymbol = normLimit.includes('±') ? '±' : normLimit.includes('+/-') ? '+/-' : null;
  if (pmSymbol) {
    const parts = normLimit.split(pmSymbol);
    if (parts.length === 2) {
      const base = parseNumberFromText(parts[0]);
      let tolerance = parseNumberFromText(parts[1]);

      if (!isNaN(base) && !isNaN(tolerance)) {
        if (parts[1].includes('%')) {
          // Trị tuyệt đối base để tránh lỗi đảo ngược min/max nếu base là số âm (VD: -20 ± 10%)
          tolerance = Math.abs(base) * (tolerance / 100);
        }
        
        // Bù trừ sai số thập phân (floating-point precision) của Javascript bằng EPSILON
        // Thay bằng EPSILON tương đối để không làm hỏng đánh giá các chỉ tiêu vi lượng (< 1e-6)
        const relativeEpsilon = Math.max(Math.abs(base), Math.abs(actualVal)) * 1e-10;
        return actualVal >= (base - tolerance - relativeEpsilon) && actualVal <= (base + tolerance + relativeEpsilon);
      }
    }
  }

  // Kiểm tra định dạng khoảng "min - max"
  const parts = normLimit.split(/\s*[-~]\s*/);
  if (parts.length === 2) {
    const min = parseNumberFromText(parts[0]);
    const max = parseNumberFromText(parts[1]);
    if (!isNaN(min) && !isNaN(max)) {
      // Bù trừ sai số thập phân tương đối
      const relativeEpsilon = Math.max(Math.abs(min), Math.abs(max), Math.abs(actualVal)) * 1e-10;
      return actualVal >= (min - relativeEpsilon) && actualVal <= (max + relativeEpsilon);
    }
  }
  
  // Hỗ trợ đánh giá các toán tử so sánh hoặc giới hạn đơn (mặc định là Max)
  const cleanLimit = normLimit.trim();
  if (/^<=|≤/.test(cleanLimit)) return actualVal <= parseNumberFromText(cleanLimit.replace(/<=|≤/, ''));
  if (/^>=|≥/.test(cleanLimit)) return actualVal >= parseNumberFromText(cleanLimit.replace(/>=|≥/, ''));
  if (/^</.test(cleanLimit)) return actualVal < parseNumberFromText(cleanLimit.replace(/</, ''));
  if (/^>/.test(cleanLimit)) return actualVal > parseNumberFromText(cleanLimit.replace(/>/, ''));
  
  const limitNum = parseNumberFromText(cleanLimit);
  if (!isNaN(limitNum)) return actualVal <= limitNum;

  return null;
};

/**
 * Làm tròn một giá trị số dựa trên số chữ số thập phân của một chuỗi tham chiếu
 * (hỗ trợ cả số thập phân và số mũ).
 */
const roundValue = (actualValue: number, reference: string): number => {
  if (!reference) return actualValue;

  // 1. Nhận diện dạng số mũ (Ví dụ: "1.5 x 10^3", "1.54*10^4", "1.5e3")
  const sciMatch = reference.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:x|\*|X)?\s*(?:10\^|e|E)\s*(-?[0-9]+)/);
  if (sciMatch) {
    const mantissaStr = sciMatch[1]; // Phần định trị (VD: "1.5")
    const exponent = parseInt(sciMatch[2], 10); // Phần mũ (VD: 3)
    const decimals = mantissaStr.includes('.') ? mantissaStr.split('.')[1].length : 0;
    
    const valueMantissa = actualValue / Math.pow(10, exponent);
    const multiplier = Math.pow(10, decimals);
    // Bù trừ sai số dấu phẩy động (VD: 1.005 * 100 = 100.499999)
    const roundedMantissa = Math.round((valueMantissa + Number.EPSILON) * multiplier) / multiplier;
    
    return roundedMantissa * Math.pow(10, exponent);
  }

  // 2. Nhận diện dạng số thập phân thông thường
  const decimalMatch = reference.match(/[.,](\d+)/);
  if (decimalMatch && decimalMatch[1]) {
    const decimalPlaces = decimalMatch[1].length;
    const factor = Math.pow(10, decimalPlaces);
    // Bù trừ sai số dấu phẩy động
    return Math.round((actualValue + Number.EPSILON) * factor) / factor;
  }
  return actualValue;
};

// Debug helper (remove in prod)
const debugRange = (limit: string, value: string, result: boolean) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`Range check: "${limit}" vs "${value}" = ${result}`);
  }
};


/**
 * Đánh giá chỉ tiêu thông minh: Tự động chuẩn hóa và chọn phương pháp đánh giá phù hợp
 */
export const evaluateCriterionSmart = (criterion: any, value: any): boolean => {
  // Tối ưu 5: Bỏ clone object vô nghĩa ({ ...criterion }).
  // Giảm hàng nghìn thao tác Memory Allocation dư thừa (Rác bộ nhớ) khi render danh sách lớn.

  // Chuẩn hóa giá trị
  const normalizedValue = typeof value === 'string' ? normalizeNumericString(value) : value;
  
  // Tái tạo lại chuỗi tham chiếu để tận dụng độ thông minh của checkRange
  // Ngay cả khi người dùng không nhập expectedText mà chỉ nhập min/max tĩnh
  let referenceText = criterion.expectedText;
  if (!referenceText && criterion.type === 'NUMBER') {
    if (criterion.min != null && criterion.max != null) {
      referenceText = `${criterion.min} - ${criterion.max}`;
    } else if (criterion.min != null) {
      referenceText = `>= ${criterion.min}`;
    } else if (criterion.max != null) {
      referenceText = `<= ${criterion.max}`;
    }
  }
  
  if (referenceText) {
     const rangeCheck = checkRange(referenceText, String(normalizedValue));
     if (rangeCheck !== null) {
       debugRange(referenceText, String(normalizedValue), rangeCheck);
       return rangeCheck;
     }
  }
  
  // Fallback về hàm đánh giá cơ bản
  return evaluateCriterion(criterion, normalizedValue);
};

/**
 * Helper: Format số sang dạng mũ (VD: 1000 -> 10³) để hiển thị đẹp trên toàn UI
 */
export const formatScientific = (value: string | number): React.ReactNode => {
  const stringValue = String(value).trim();
  const stringUpper = stringValue.toUpperCase();

  // Đồng bộ hóa hiển thị các biến thể của "Không phát hiện"
  if (ND_KEYWORDS.includes(stringUpper)) {
    return 'Không phát hiện';
  }
  
  if (POS_KEYWORDS.includes(stringUpper)) {
    return 'Dương tính';
  }

  // Ngăn chặn việc ép kiểu sai các chuỗi văn bản định tính có chứa số (VD: "Âm tính / 25g", "pH 5.5")
  // Chỉ cho phép các ký tự dùng trong toán học cơ bản. Chữ cái (khác e, E, x, X) sẽ được tính là văn bản thuần.
  const hasText = /[a-df-wy-zA-DF-WY-Zà-ỹÀ-Ỹ]/.test(stringValue);
  if (hasText) {
    return value;
  }

  let num = Number(value);

  // Kiểm tra xem người dùng có cố tình nhập định dạng mũ không
  const isSciFormat = stringUpper.includes('E') || stringValue.includes('10') || stringValue.includes('^') || stringUpper.includes('X');
  
  if (isNaN(num) || isSciFormat) {
    num = parseNumberFromText(stringValue);
    if (num === 0 && String(value).trim() !== '0') return value;
  }
  
  if (num === 0) return value;

  // Chỉ tự động biến thành mũ nếu là dạng mũ gốc, hoặc số siêu lớn/siêu nhỏ
  if (isSciFormat || Math.abs(num) >= 1000000 || (Math.abs(num) > 0 && Math.abs(num) <= 0.00001)) {
    const exponent = Math.floor(Math.log10(Math.abs(num)));
    const mantissa = num / Math.pow(10, exponent);
    // Tăng độ chính xác làm tròn lên 5 chữ số để không làm mất phần định trị dài
    const roundedMantissa = Math.round((mantissa + Number.EPSILON) * 100000) / 100000;

    const elements: React.ReactNode[] = [];
    if (roundedMantissa !== 1) elements.push(`${roundedMantissa} × `);
    elements.push('10');
    elements.push(React.createElement('sup', { key: 'exp' }, exponent));

    return React.createElement('span', { className: 'whitespace-nowrap' }, ...elements);
  }
  // Chặn lỗi toLocaleString tự động cắt xén chuỗi nếu vượt quá 3 chữ số thập phân
  return num.toLocaleString('vi-VN', { maximumFractionDigits: 10 });
};

// Tối ưu 4: Đưa các mảng hằng số ra ngoài hàm (Module scope) 
// Giúp tránh việc khởi tạo lại mảng và cấp phát bộ nhớ mới ở mỗi lần gọi hàm
const ND_KEYWORDS = ['ND', 'NOT DETECTED', 'KHÔNG PHÁT HIỆN', 'K.P.H', 'KPH', 'ÂM TÍNH', 'NEGATIVE', 'KHÔNG CÓ'];
const POS_KEYWORDS = ['POSITIVE', 'DƯƠNG TÍNH', 'PHÁT HIỆN', 'CÓ PHÁT HIỆN', 'DETECTED', 'CÓ'];
