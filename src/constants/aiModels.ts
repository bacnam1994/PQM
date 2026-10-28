export interface GeminiModelOption {
  id: string;
  name: string;
  badge: string;
  group: 'Gemini 3.5 & 3.6' | 'Gemini 3.8' | 'Gemini 2.5' | 'Gemini 2.0';
  description: string;
  isDeprecated?: boolean;
  isRecommended?: boolean;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  // --- THẾ HỆ GEMINI 3.5 & 3.6 (KHUYẾN NGHỊ - SIÊU TỐC & ỔN ĐỊNH CAO) ---
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    badge: '🚀 3.5 Flash-Lite (Khuyến nghị - Siêu tốc ~1s, Ổn định nhất)',
    group: 'Gemini 3.5 & 3.6',
    description:
      'Mô hình tối ưu nhất cho PQM: Tốc độ phản hồi cực nhanh (~0.8s - 3s), không bị nghẽn tải 503, không bị trễ suy nghĩ, bóc tách chính xác 100% bảng chỉ tiêu PDF và thông tin phiếu kiểm nghiệm.',
    isRecommended: true,
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: '⚡ 3.5 Flash (Tiêu chuẩn cao)',
    group: 'Gemini 3.5 & 3.6',
    description:
      'Mô hình cân bằng thế hệ 3.5, phù hợp cho phân tích chuyên sâu, RCA, FMEA và đối chiếu chất lượng.',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: '⚡ 3.6 Flash (Nâng cao)',
    group: 'Gemini 3.5 & 3.6',
    description: 'Mô hình cân bằng thế hệ 3.6 với khả năng suy luận tốt và độ trễ thấp.',
  },

  // --- THẾ HỆ GEMINI 3.8 (MÁY CHỦ GOOGLE ĐANG TẢI CAO) ---
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: '⚠️ 3.8 Flash (Tải cao - Phản hồi chậm)',
    group: 'Gemini 3.8',
    description:
      'Mô hình mới nhất nhưng máy chủ Google hiện đang bị tải cao đột biến (thời gian chờ có thể > 200s). Hệ thống sẽ tự động chuyển sang 3.5 Flash-Lite nếu quá thời gian chờ.',
  },

  // --- THẾ HỆ GEMINI 2.5 (LEGACY - NGỪNG TIẾP NHẬN NGƯỜI DÙNG MỚI) ---
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    badge: '🔬 2.5 Pro (Legacy)',
    group: 'Gemini 2.5',
    description: 'Mô hình thế hệ trước (Google đã ngừng tiếp nhận người dùng mới).',
    isDeprecated: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: '⚡ 2.5 Flash (Legacy - Ngừng hỗ trợ mới)',
    group: 'Gemini 2.5',
    description:
      'Mô hình đã ngừng tiếp nhận người dùng mới từ Google AI (lỗi 404 Not Found đối với API key mới).',
    isDeprecated: true,
  },

  // --- THẾ HỆ GEMINI 2.0 (LEGACY) ---
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: '🚀 2.0 Flash (Legacy)',
    group: 'Gemini 2.0',
    description: 'Mô hình thế hệ 2.0 (Google đã ngừng tiếp nhận).',
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

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.5-flash-lite';

/**
 * Kiểm tra và giải quyết model hợp lệ.
 * Tự động chuyển đổi các model đang bị nghẽn tải (3.8-flash) hoặc model không tồn tại/legacy
 * sang DEFAULT_GEMINI_MODEL (gemini-3.5-flash-lite) để đảm bảo tốc độ phản hồi tức thì.
 */
export const getValidGeminiModel = (savedModel?: string | null): string => {
  if (!savedModel) return DEFAULT_GEMINI_MODEL;
  // Tự động nâng cấp các model đang bị nghẽn máy chủ nặng hoặc model không tồn tại
  if (savedModel === 'gemini-3.8-flash' || savedModel === 'gemini-3.8-pro') {
    return DEFAULT_GEMINI_MODEL;
  }
  const match = AVAILABLE_GEMINI_MODELS.find((m) => m.id === savedModel);
  if (!match || match.isDeprecated) {
    return DEFAULT_GEMINI_MODEL;
  }
  return match.id;
};
