/**
 * Tạo ID ngẫu nhiên an toàn (hoạt động cả trên HTTP và HTTPS).
 * Tự động fallback về timestamp nếu crypto.randomUUID không khả dụng.
 * 
 * @param prefix Tiền tố tùy chọn cho ID (ví dụ: 'prod', 'batch')
 * @returns Chuỗi ID duy nhất (VD: "prod_123e4567-e89b...")
 */
export const generateId = (prefix?: string): string => {
  let id: string;
  
  try {
    // Kiểm tra kỹ hơn đối tượng crypto (hỗ trợ cả window.crypto)
    const cryptoObj = typeof crypto !== 'undefined' ? crypto : 
                      (typeof window !== 'undefined' ? window.crypto : undefined);

    // Ưu tiên dùng randomUUID nếu khả dụng (Secure Context)
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      id = cryptoObj.randomUUID();
    } else {
      throw new Error('Fallback needed');
    }
  } catch (e) {
    // Fallback: Timestamp + Random string (cho môi trường HTTP/Legacy hoặc khi crypto.randomUUID throw lỗi)
    id = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  return prefix ? `${prefix}_${id}` : id;
};
