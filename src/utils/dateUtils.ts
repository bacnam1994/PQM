/**
 * Chuyển đổi chuỗi ngày ISO hoặc timestamp sang định dạng hiển thị VN (dd/mm/yyyy)
 * Chuẩn hiển thị cho toàn bộ ứng dụng — luôn dùng hàm này thay vì gọi trực tiếp toLocaleDateString()
 */
export const formatDateStandard = (dateStr: string | number | undefined | null): string => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    
    return `${dd}/${mm}/${yyyy}`;
  } catch (e) {
    return '---';
  }
};

/**
 * Hiển thị ngày kèm giờ phút (dd/mm/yyyy HH:MM)
 */
export const formatDateTime = (dateStr: string | number | undefined | null): string => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch (e) {
    return '---';
  }
};

/**
 * Hiển thị thời gian tương đối (vÐ´: "2 ngày trước", "Đhôm nay", "3 tuần trước").
 * Nếu quá 30 ngày thì hiển thị ngày chuẩn formatDateStandard.
 */
export const formatDateRelative = (dateStr: string | number | undefined | null): string => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    return formatDateStandard(dateStr);
  } catch (e) {
    return '---';
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