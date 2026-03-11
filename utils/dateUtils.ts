/**
 * Chuyển đổi chuỗi ngày ISO hoặc timestamp sang định dạng hiển thị VN (dd/mm/yyyy)
 */
export const formatDateStandard = (dateStr: string | number | undefined | null) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB');
  } catch (e) {
    return 'Invalid Date';
  }
};

/**
 * Chuyển đổi chuỗi ngày sang định dạng input type="date" (YYYY-MM-DD)
 * Hỗ trợ cả định dạng ddmmyy (VD: 311224)
 */
export const toInputDate = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  // Hỗ trợ format ddmmyy (VD: 311224 -> 2024-12-31)
  if (/^\d{6}$/.test(dateStr)) {
    const d = dateStr.slice(0, 2);
    const m = dateStr.slice(2, 4);
    const y = '20' + dateStr.slice(4, 6);
    return `${y}-${m}-${d}`;
  }
  // Hỗ trợ ISO string
  if (dateStr.includes('T')) return dateStr.split('T')[0];
  return dateStr;
};

/**
 * Parse các định dạng ngày nhập tay (ddmmyy, d/m/yy,...) về chuẩn ISO YYYY-MM-DD
 */
export const parseDateToISO = (dateStr: string | undefined): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  const trimmedDate = dateStr.trim();

  // ddmmyy
  if (/^\d{6}$/.test(trimmedDate)) {
    const d = trimmedDate.slice(0, 2);
    const m = trimmedDate.slice(2, 4);
    const y = '20' + trimmedDate.slice(4, 6);
    return `${y}-${m}-${d}`;
  }

  // d/m/yy or d-m-yy or d/m/yyyy
  const dateMatch = trimmedDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{1,4})$/);
  if (dateMatch) {
    const d = dateMatch[1].padStart(2, '0');
    const m = dateMatch[2].padStart(2, '0');
    let y = dateMatch[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }
  
  // ISO format
  if (trimmedDate.includes('T')) return trimmedDate.split('T')[0];
  return trimmedDate;
};