/**
 * Chuyển đổi đường dẫn tương đối trong ứng dụng thành URL đầy đủ bao gồm BASE_URL của Vite.
 * Giúp các lệnh window.open hoặc thẻ <a> mở đúng đường dẫn trên cả Local (/) và GitHub Pages (/PQM/).
 * 
 * @param path Đường dẫn nội bộ, ví dụ: '/test-results/print/123456'
 * @returns Đường dẫn có tiền tố BASE_URL, ví dụ: '/PQM/test-results/print/123456'
 */
export const getAppUrl = (path: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
};
