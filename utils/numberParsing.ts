/**
 * Chuẩn hóa chuỗi số liệu nhập vào (xử lý dấu phẩy/chấm, số mũ, ký tự đặc biệt)
 */
export const normalizeNumericString = (text: string): string => {
  if (!text) return '';
  if (typeof window === 'undefined') return text;

  let separator: string | null = 'dot';
  try {
    separator = localStorage.getItem('app_decimal_separator');
    // Xử lý trường hợp useLocalStorage lưu string dưới dạng JSON (có dấu ngoặc kép)
    if (separator && separator.startsWith('"') && separator.endsWith('"')) {
      separator = separator.slice(1, -1);
    }
  } catch (e) {
    // localStorage can be unavailable in some environments (e.g. private browsing).
  }
  separator = separator || 'dot';

  const superscripts: { [key: string]: string } = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
  };

  // First, convert patterns like 10³ -> 10^3 so they are treated as exponents
  let normalized = text.replace(/10([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, sup) => {
    const digits = sup.split('').map(c => superscripts[c] || c).join('');
    return `10^${digits}`;
  });

  // Then replace any remaining superscript numerals with their digit equivalents
  normalized = normalized.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (char) => superscripts[char]);
  
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
  normalized = normalized.replace(/10(\s+|\^)\s*/g, '10^');
  // Regex bắt định dạng khoa học: số + 'x' + '10^' + số mũ -> chuyển về dạng e
  normalized = normalized.replace(/(\d+(?:\.\d+)?)x10\^(-?\d+)/g, '$1e$2');
  // Xử lý trường hợp 10^x đứng một mình (không có số đứng trước) -> 1e x
  // Sử dụng callback để tránh lỗi tham chiếu nhóm $11 (có thể bị hiểu nhầm là group 11 thay vì group 1 + '1')
  normalized = normalized.replace(/(^|[^\d\.x])10\^(-?\d+)/g, (match, p1, p2) => {
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
 * Chuyển đổi các giá trị đặc biệt về số.
 * - "KPH", "KPHĐ", "NĐ", "Neg", "Negative", "ND" -> 0
 * - Các giá trị số thông thường -> parseFloat bình thường
 */
export const parseSpecialValue = (value: any): number => {
  if (value === null || value === undefined) return 0;
  
  const strValue = String(value).trim().toUpperCase();
  
  // Danh sách các giá trị đặc biệt được coi là "Không Phát Hiện" = 0
  const specialValues = ['KPH', 'KPHĐ', 'NĐ', 'NEG', 'NEGATIVE', 'ND', 'NONE', 'NOT DETECTED', 'NOT DETECT'];
  
  if (specialValues.some(sv => strValue.includes(sv))) {
    return 0;
  }
  
  // Nếu không phải giá trị đặc biệt, parse như bình thường
  const normalized = normalizeNumericString(strValue);
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
};