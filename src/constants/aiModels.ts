export interface GeminiModelOption {
  id: string;
  name: string;
  badge: string;
  group: 'Gemini 2.5' | 'Gemini 2.0';
  description: string;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  // --- THẾ HỆ GEMINI 2.5 ---
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: '⚡ 2.5 Flash (Tiêu chuẩn)',
    group: 'Gemini 2.5',
    description:
      'Mô hình chuẩn cân bằng tốt giữa tốc độ phản hồi và khả năng hiểu ngôn ngữ dược điển.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: '🔬 2.5 Pro (Suy luận)',
    group: 'Gemini 2.5',
    description: 'Xử lý ngữ cảnh lớn, phân tích dữ liệu chuyên sâu và tính toán thống kê SPC.',
  },
  // --- THẾ HỆ GEMINI 2.0 ---
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: '🚀 2.0 Flash (Tốc độ cao)',
    group: 'Gemini 2.0',
    description: 'Tốc độ phản hồi cực nhanh, phù hợp cho phân loại nhanh và tra cứu đơn giản.',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    badge: '💡 2.0 Flash-Lite (Tiết kiệm)',
    group: 'Gemini 2.0',
    description: 'Phiên bản gọn nhẹ, tối ưu chi phí và hạn mức truy vấn.',
  },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
