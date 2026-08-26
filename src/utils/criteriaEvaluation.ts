import { evaluateCriterion } from './parsing';
import { useUIStore } from '../store/useUIStore';

export const getIsCommaDecimal = (): boolean => {
  try {
    return typeof window !== 'undefined' && useUIStore.getState().decimalSeparator === 'comma';
  } catch {
    return false;
  }
};

/**
 * Lấy locale tương ứng với tùy chọn decimalSeparator của người dùng:
 * - 'dot' (Mặc định chuẩn Dược): Dấu chấm thập phân (VD: 1,234.56) -> locale 'en-US'
 * - 'comma': Dấu phẩy thập phân (VD: 1.234,56) -> locale 'vi-VN'
 */
export const getActiveLocale = (): string => {
  try {
    const sep = typeof window !== 'undefined' ? useUIStore.getState().decimalSeparator : 'dot';
    return sep === 'comma' ? 'vi-VN' : 'en-US';
  } catch {
    return 'en-US';
  }
};

/**
 * Định dạng số hiển thị thống nhất trên toàn hệ thống theo cài đặt decimalSeparator của người dùng
 */
export const formatNumber = (
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : parseNumberFromText(value);
  if (isNaN(num)) return String(value);
  const locale = getActiveLocale();
  return num.toLocaleString(locale, options);
};

/**
 * Chuẩn hóa thông minh chuỗi số / giới hạn kiểm nghiệm:
 * - Thay thế các dấu phẩy thập phân (VD: "0,5" -> "0.5", "5,0 - 10,0" -> "5.0 - 10.0", "1.5x10^3" -> "1.5x10^3")
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

// Invalidate cache khi setting thay đổi (gọi trong SettingsPage khi save)
export const invalidateDecimalCache = () => {};
export const safeParseFloat = (str: string): number => {
  if (!str) return NaN;
  // Chuẩn hóa dấu phân cách trước khi parse
  const standardized = standardizeDecimalString(str);
  // CHÚ Ý: Phải giữ lại e, E và + để không làm hỏng các số định dạng khoa học (VD: 1.5e-5)
  const cleaned = standardized.trim().replace(/[^\d.eE+-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? NaN : num;
};

/**
 * Chuẩn hóa chuỗi số liệu nhập vào (xử lý dấu phẩy/chấm, số mũ, ký tự đặc biệt)
 */
export const normalizeNumericString = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  let str = standardizeDecimalString(value);

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
  // Trích xuất phần số hợp lệ đầu tiên ở bất kỳ đâu trong chuỗi, bỏ qua tiền tố/hậu tố rác (VD: "< 0.5" -> 0.5)
  const match = str.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
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
  const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  
  const limitNorm = normalizeStr(limit);
  const valueNorm = normalizeStr(String(value));
  
  const ndWords = ND_KEYWORDS.map(normalizeStr);
  const posWords = POS_KEYWORDS.map(normalizeStr);

  const isLimitND = ndWords.some(kw => limitNorm.includes(kw));
  const isValueND = ndWords.some(kw => valueNorm.includes(kw));
  const isLimitPos = posWords.some(kw => limitNorm.includes(kw));
  const isValuePos = posWords.some(kw => valueNorm.includes(kw));
  
  // Phát hiện value có tiền tố toán tử so sánh (VD: "<10" nghĩa là thực tế < 10, dưới ngưỡng LOD)
  // Khi user nhập "<10" (below detection limit), actualVal phải < 10 để không bị FAIL oan khi Limit là "< 10"
  // VD: Coliforms limit "< 10 CFU/g" + value "<10" → 10 < 10 = FALSE (sai!) → cần dùng 10 - epsilon
  const valueTrimmed = String(value).trim();
  const isValueStrictLt = /^<(?!=|≤)/.test(valueTrimmed); // "<10" nhưng KHÔNG phải "<=" hay "≤"
  const isValueStrictGt = /^>(?!=|≥)/.test(valueTrimmed); // ">10" nhưng KHÔNG phải ">=" hay "≥"

  if (isLimitND) {
    // Nếu Yêu cầu là ND -> Kết quả thực tế phải chứa từ khóa ND, có tiền tố "<" (dưới ngưỡng LOD/LOQ), hoặc là số <= 0
    if (isValueND || isValueStrictLt) return true;
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
    // Nếu Kết quả nhập là ND nhưng Yêu cầu là Số (VD: <= 10, <= 3) -> Tạm quy đổi ND thành 0 để tính toán
    value = "0";
  }

  let actualVal = parseNumberFromText(value);
  if (!isNaN(actualVal)) {
    if (isValueStrictLt) {
      // "<10" → giá trị thực tế là nhỏ hơn 10 → dùng 10 - epsilon để so sánh đúng
      actualVal = actualVal - Math.max(Math.abs(actualVal), 1) * 1e-9;
    } else if (isValueStrictGt) {
      // ">10" → giá trị thực tế là lớn hơn 10 → dùng 10 + epsilon
      actualVal = actualVal + Math.max(Math.abs(actualVal), 1) * 1e-9;
    }
  }
  if (isNaN(actualVal)) return null;

  const normLimit = normalizeNumericString(limit).trim();

  // Helper xử lý ngoại lệ giới hạn phát hiện phòng kiểm nghiệm (LOD / LOQ Exception):
  // Trong kiểm nghiệm Dược & Vi sinh (Dược điển VN V, ISO 4833, BAM-FDA):
  // Khi phương pháp đếm đĩa không mọc khuẩn lạc nào (0 CFU) ở độ pha loãng 10^-1, lab xuất phiếu là "< 10" (hoặc "< 10 CFU/g", "< 10^1", "< 1", "< LOD").
  // Nồng độ/số lượng thực tế là 0 (Zero / Not Detected). Với các chỉ tiêu có giới hạn trên (<= 3, <= 5, <= 10, < 3, NMT 3), 0 <= limitNum nên luôn ĐẠT (PASS).
  const isLODOrZero = (limitNum: number): boolean => {
    if (!isValueStrictLt) return false;
    const rawNum = parseNumberFromText(valueTrimmed);
    if (limitNum >= 0 && (isValueND || isNaN(rawNum) || rawNum <= 10)) {
      return true;
    }
    return false;
  };

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

  // Kiểm tra định dạng khoảng "min - max" (Bắt buộc có khoảng trắng quanh dấu trừ để không cắt nhầm số âm) hoặc "min ~ max"
  const parts = normLimit.split(/\s+-\s+|\s*~\s*/);
  if (parts.length === 2) {
    const min = parseNumberFromText(parts[0]);
    const max = parseNumberFromText(parts[1]);
    if (!isNaN(min) && !isNaN(max)) {
      // Bù trừ sai số thập phân tương đối
      const relativeEpsilon = Math.max(Math.abs(min), Math.abs(max), Math.abs(actualVal)) * 1e-10;
      if (actualVal >= (min - relativeEpsilon) && actualVal <= (max + relativeEpsilon)) {
        return true;
      }
      if (min <= 0 && isLODOrZero(max)) {
        return true;
      }
      return false;
    }
  }
  
  // Hỗ trợ đánh giá các toán tử so sánh hoặc giới hạn đơn (mặc định là Max)
  // BUG FIX: Áp dụng relative epsilon để chống lỗi floating-point precision của JS
  // VD: 0.1 + 0.2 = 0.30000000000000004 → phải được tính là <= 0.3
  const cleanLimit = normLimit.trim();

  // FIX 4: Hỗ trợ NMT (Not More Than = ≤) và NLT (Not Less Than = ≥)
  // Phổ biến trong USP, BP, EP. VD: "NMT 10.0", "NLT 95.0%", "nmt 0.5"
  const upperLimit = cleanLimit.toUpperCase();
  if (/^NMT\b/.test(upperLimit)) {
    const limitNum = parseNumberFromText(cleanLimit.replace(/^NMT\b/i, ''));
    if (!isNaN(limitNum)) {
      const eps = Math.max(Math.abs(limitNum), Math.abs(actualVal)) * 1e-10;
      return (actualVal <= limitNum + eps) || isLODOrZero(limitNum);
    }
  }
  if (/^NLT\b/.test(upperLimit)) {
    const limitNum = parseNumberFromText(cleanLimit.replace(/^NLT\b/i, ''));
    if (!isNaN(limitNum)) {
      const eps = Math.max(Math.abs(limitNum), Math.abs(actualVal)) * 1e-10;
      return actualVal >= limitNum - eps;
    }
  }

  if (/^<=|≤/.test(cleanLimit)) {
    const limitNum = parseNumberFromText(cleanLimit.replace(/<=|≤/, ''));
    const eps = Math.max(Math.abs(limitNum), Math.abs(actualVal)) * 1e-10;
    return (actualVal <= limitNum + eps) || isLODOrZero(limitNum);
  }
  if (/^>=|≥/.test(cleanLimit)) {
    const limitNum = parseNumberFromText(cleanLimit.replace(/>=|≥/, ''));
    const eps = Math.max(Math.abs(limitNum), Math.abs(actualVal)) * 1e-10;
    return actualVal >= limitNum - eps;
  }
  if (/^</.test(cleanLimit)) {
    const limitNum = parseNumberFromText(cleanLimit.replace(/</, ''));
    return (actualVal < limitNum) || isLODOrZero(limitNum);
  }
  if (/^>/.test(cleanLimit)) return actualVal > parseNumberFromText(cleanLimit.replace(/>/, ''));
  
  const limitNum = parseNumberFromText(cleanLimit);
  if (!isNaN(limitNum)) {
    const eps = Math.max(Math.abs(limitNum), Math.abs(actualVal)) * 1e-10;
    return (actualVal <= limitNum + eps) || isLODOrZero(limitNum);
  }

  return null;
};


/**
 * Đánh giá chỉ tiêu thông minh: Tự động chuẩn hóa và chọn phương pháp đánh giá phù hợp
 */
export const evaluateCriterionSmart = (criterion: any, value: any): boolean => {
  // Tối ưu 5: Bỏ clone object vô nghĩa ({ ...criterion }).
  // Giảm hàng nghìn thao tác Memory Allocation dư thừa (Rác bộ nhớ) khi render danh sách lớn.

  // Chuẩn hóa giá trị
  const normalizedValue = typeof value === 'string' ? normalizeNumericString(value) : value;
  
  // Tái tạo lại chuỗi tham chiếu để tận dụng độ thông minh của checkRange.
  // BUG FIX: Với type NUMBER có min/max, LUÔN ưu tiên dùng min/max để build referenceText
  // cho việc đánh giá số. Tránh lỗi khi criterion có cả max=10 lẫn expectedText cũ/sai
  // (VD: "KHÔNG ĐƯỢC CÓ") khiến logic ND bị kích hoạt nhầm:
  //   <0 → 0<=0 → PASS (trùng hợp đúng), <1 → 1<=0 → FAIL (sai!)
  // expectedText chỉ được dùng khi type không phải NUMBER hoặc không có min/max.
  let referenceText: string | undefined;
  if (criterion.type === 'NUMBER') {
    if (criterion.min != null && criterion.max != null) {
      referenceText = `${criterion.min} - ${criterion.max}`;
    } else if (criterion.min != null) {
      referenceText = `>= ${criterion.min}`;
    } else if (criterion.max != null) {
      referenceText = `<= ${criterion.max}`;
    } else {
      // Không có min/max → fallback sang expectedText (có thể là định tính: ND, text...)
      referenceText = criterion.expectedText;
    }
  } else {
    referenceText = criterion.expectedText;
  }
  
  if (referenceText) {
     const rangeCheck = checkRange(referenceText, String(normalizedValue));
     if (rangeCheck !== null) {
       return rangeCheck;
     }
  }
  
  // Fallback về hàm đánh giá cơ bản
  return evaluateCriterion(criterion, normalizedValue);
};

/**
 * FIX 7: Đánh giá chỉ tiêu có xem xét alternateRules từ TCCS.
 * alternateRules cho phép định nghĩa quy tắc thay thế khi chỉ tiêu chính không đạt.
 * Ví dụ: Nếu Độ hòa tan (chỉ tiêu A) FAIL, có thể kiểm tra lại với điều kiện thay thế (chỉ tiêu B).
 *
 * @param criterion Chỉ tiêu cần đánh giá
 * @param value Giá trị kết quả
 * @param allValues Map toàn bộ giá trị đã nhập (criteriaName → value) — để tra cứu chỉ tiêu liên quan
 * @param tccsAlternateRules Danh sách alternateRules từ TCCS
 * @returns { isPass: boolean; usedAlternate: boolean; alternateNote?: string }
 */
export const evaluateCriterionWithAlternates = (
  criterion: any,
  value: any,
  allValues: Record<string, any> = {},
  tccsAlternateRules: Array<{ main: string; alt: string; type?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK'; conditionValue?: string }> = []
): { isPass: boolean; usedAlternate: boolean; alternateNote?: string } => {
  // Đánh giá chỉ tiêu chính trước
  const baseResult = evaluateCriterionSmart(criterion, value);

  // Nếu đạt ngay → không cần kiểm tra alternate rules
  if (baseResult) {
    return { isPass: true, usedAlternate: false };
  }

  // Tìm alternate rule áp dụng cho chỉ tiêu này
  const applicableRule = tccsAlternateRules.find(
    rule => rule.main.trim().toLowerCase() === criterion.name.trim().toLowerCase()
  );

  if (!applicableRule) {
    // Không có rule thay thế → kết quả là FAIL
    return { isPass: false, usedAlternate: false };
  }

  // Tìm giá trị của chỉ tiêu thay thế (alt) từ allValues
  const altCriteriaName = applicableRule.alt;
  const altValue = allValues[altCriteriaName] ?? allValues[altCriteriaName.toLowerCase()];

  if (altValue === undefined || altValue === null || String(altValue).trim() === '') {
    // Không có dữ liệu chỉ tiêu thay thế → không thể áp dụng alternate rule
    return { isPass: false, usedAlternate: false };
  }

  if (applicableRule.type === 'FAIL_RETRY') {
    // Loại FAIL_RETRY: Cho phép tính PASS dựa trên chỉ tiêu thay thế (Stage 2 test)
    // Điều kiện: altValue phải đạt theo conditionValue hoặc một ngưỡng mặc định
    const conditionText = applicableRule.conditionValue || '';
    if (conditionText) {
      const altPass = checkRange(conditionText, String(altValue));
      if (altPass === true) {
        return {
          isPass: true,
          usedAlternate: true,
          alternateNote: `Đạt theo quy tắc thay thế: ${altCriteriaName} (${altValue}) đáp ứng điều kiện "${conditionText}"`,
        };
      }
    }
    return { isPass: false, usedAlternate: false };
  }

  if (applicableRule.type === 'CONDITIONAL_CHECK') {
    // Loại CONDITIONAL_CHECK: Chỉ yêu cầu kiểm tra chỉ tiêu alt nếu chỉ tiêu main fail
    // Kết quả cuối dựa vào alt criterion đạt hay không
    const conditionText = applicableRule.conditionValue || '';
    if (conditionText) {
      const altPass = checkRange(conditionText, String(altValue));
      if (altPass !== null) {
        return {
          isPass: altPass,
          usedAlternate: true,
          alternateNote: `Kiểm tra điều kiện: ${altCriteriaName} (${altValue}) so với "${conditionText}"`,
        };
      }
    }
  }

  return { isPass: false, usedAlternate: false };
};

/**
 * Helper: Format số sang dạng mũ (VD: 1000 -> 10³) để hiển thị đẹp trên toàn UI
 * Trả về chuỗi thuần (Pure String) sử dụng Unicode để tránh rò rỉ React Object
 */
export const formatScientific = (value: string | number): string => {
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
    return stringValue;
  }

  let num = Number(value);

  // Kiểm tra xem người dùng có cố tình nhập định dạng mũ không
  const isSciFormat = stringUpper.includes('E') || stringValue.includes('10') || stringValue.includes('^') || stringUpper.includes('X');
  
  if (isNaN(num) || isSciFormat) {
    num = parseNumberFromText(stringValue);
    if (num === 0 && String(value).trim() !== '0') return stringValue;
  }
  
  if (num === 0) return stringValue;

  // Chỉ tự động biến thành mũ nếu là dạng mũ gốc, hoặc số siêu lớn/siêu nhỏ
  if (isSciFormat || Math.abs(num) >= 1000000 || (Math.abs(num) > 0 && Math.abs(num) <= 0.00001)) {
    const exponent = Math.floor(Math.log10(Math.abs(num)));
    const mantissa = num / Math.pow(10, exponent);
    // Tăng độ chính xác làm tròn lên 5 chữ số để không làm mất phần định trị dài
    const roundedMantissa = Math.round((mantissa + Number.EPSILON) * 100000) / 100000;

    // Sử dụng mã Unicode thay vì HTML/ReactNode để giữ tính toàn vẹn của chuỗi
    const superscripts: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻'
    };
    const expStr = String(exponent).split('').map(c => superscripts[c] || c).join('');

    if (roundedMantissa !== 1) return `${roundedMantissa} × 10${expStr}`;
    return `10${expStr}`;
  }
  // Định dạng số theo chuẩn locale tương ứng với decimalSeparator (en-US cho dot, vi-VN cho comma)
  const locale = getActiveLocale();
  return num.toLocaleString(locale, { maximumFractionDigits: 10 });
};

// Tối ưu 4: Đưa các mảng hằng số ra ngoài hàm (Module scope) 
// Giúp tránh việc khởi tạo lại mảng và cấp phát bộ nhớ mới ở mỗi lần gọi hàm
const ND_KEYWORDS = ['ND', 'NOT DETECTED', 'KHÔNG PHÁT HIỆN', 'K.P.H', 'KPH', 'ÂM TÍNH', 'NEGATIVE', 'KHÔNG CÓ', 'KHÔNG ĐƯỢC CÓ'];
const POS_KEYWORDS = ['POSITIVE', 'DƯƠNG TÍNH', 'PHÁT HIỆN', 'CÓ PHÁT HIỆN', 'DETECTED', 'CÓ'];
