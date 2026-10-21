export interface GeminiModelOption {
  id: string;
  name: string;
  badge: string;
  group: 'Gemini 3.8' | 'Gemini 2.5' | 'Gemini 2.0';
  description: string;
  isDeprecated?: boolean;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  // --- THẾ HỆ GEMINI 3.8 (TIÊU CHUẨN MỚI & MẶC ĐỊNH) ---
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: '⚡ 3.8 Flash (Tiêu chuẩn)',
    group: 'Gemini 3.8',
    description:
      'Mô hình thế hệ mới với tốc độ xử lý nhanh, tối ưu cho OCR phiếu kiểm nghiệm, trích xuất JSON và tra cứu dược điển.',
  },
  {
    id: 'gemini-3.8-pro',
    name: 'Gemini 3.8 Pro',
    badge: '🔬 3.8 Pro (Suy luận sâu)',
    group: 'Gemini 3.8',
    description:
      'Xử lý ngữ cảnh lớn, phân tích nguyên nhân gốc rễ RCA và tính toán thống kê chất lượng chuyên sâu.',
  },
  // --- THẾ HỆ GEMINI 2.5 (LEGACY - NGỪNG TIẾP NHẬN NGƯỜI DÙNG MỚI) ---
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: '🔬 2.5 Pro (Legacy)',
    group: 'Gemini 2.5',
    description: 'Mô hình thế hệ trước (chỉ dành cho tài khoản cũ đã được cấp quyền trước đó).',
    isDeprecated: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: '⚡ 2.5 Flash (Legacy - Ngừng hỗ trợ mới)',
    group: 'Gemini 2.5',
    description:
      'Mô hình đã ngừng tiếp nhận người dùng mới từ Google AI (có thể gặp lỗi 404 Not Found).',
    isDeprecated: true,
  },
  // --- THẾ HỆ GEMINI 2.0 (LEGACY) ---
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: '🚀 2.0 Flash (Legacy)',
    group: 'Gemini 2.0',
    description: 'Mô hình thế hệ 2.0 (chỉ khả dụng nếu tài khoản của bạn được cấp quyền).',
    isDeprecated: true,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    badge: '💡 2.0 Flash-Lite (Legacy)',
    group: 'Gemini 2.0',
    description: 'Phiên bản gọn nhẹ thế hệ 2.0.',
    isDeprecated: true,
  },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * Kiểm tra và giải quyết model hợp lệ.
 * Nếu modelId không tồn tại trong danh sách hoặc là model đã ngừng hỗ trợ (isDeprecated),
 * tự động trả về DEFAULT_GEMINI_MODEL (gemini-3.8-flash).
 */
export const getValidGeminiModel = (savedModel?: string | null): string => {
  if (!savedModel) return DEFAULT_GEMINI_MODEL;
  const match = AVAILABLE_GEMINI_MODELS.find((m) => m.id === savedModel);
  if (!match || match.isDeprecated) {
    return DEFAULT_GEMINI_MODEL;
  }
  return match.id;
};
