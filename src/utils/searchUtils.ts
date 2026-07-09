/**
 * Khử dấu Tiếng Việt và đưa về chữ thường để tối ưu hóa tìm kiếm (Fuzzy Search)
 * Ví dụ: "Kiểm Nghiệm" -> "kiem nghiem"
 */
export const normalizeSearch = (str: string | null | undefined): string => {
  if (!str) return '';
  return String(str)
    .normalize('NFD') // Tách tổ hợp dấu (VD: ễ -> e + ˜)
    .replace(/[\u0300-\u036f]/g, '') // Loại bỏ các dấu thanh
    .replace(/đ/g, 'd').replace(/Đ/g, 'D') // Xử lý ký tự đ đặc thù
    .toLowerCase()
    .trim();
};