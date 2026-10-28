/**
 * src/services/ai/aiConfig.ts
 * ===========================
 * Module cấu hình tập trung cho AI Services (Gemini API Key, Model Management & Error Formatting).
 * Tách biệt để khử circular dependencies giữa geminiService, aiTools và các AI domain services.
 */

import {
  AVAILABLE_GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  getValidGeminiModel,
  type GeminiModelOption,
} from '../../constants/aiModels';

export {
  AVAILABLE_GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  getValidGeminiModel,
  type GeminiModelOption,
};

/**
 * Trả về cấu hình thinkingConfig phù hợp cho từng model.
 * - Các model Lite (gemini-3.5-flash-lite) không có thinking engine -> return undefined (tránh lỗi 400 Bad Request).
 * - Các model Flash (3.5-flash, 3.6-flash, 3.8-flash) có thinking mặc định -> cần ép thinkingBudget: 0 khi chạy OCR hoặc tác vụ có cấu trúc để tránh lag và không làm cắt cụt JSON.
 */
export const getThinkingConfigForModel = (
  modelName: string,
  enableThinking = false
): { thinkingConfig: { thinkingBudget: number } } | undefined => {
  const supportsThinking =
    (modelName.includes('3.5-flash') && !modelName.includes('lite')) ||
    modelName.includes('3.6-flash') ||
    modelName.includes('3.8-flash') ||
    modelName.includes('3.7-flash');

  if (!supportsThinking) {
    return undefined;
  }

  return {
    thinkingConfig: {
      thinkingBudget: enableThinking ? 2048 : 0,
    },
  };
};

export const getApiKey = (): string => {
  const localKey =
    typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY')?.trim() : '';
  if (localKey) return localKey;
  return import.meta.env.VITE_GEMINI_API_KEY || '';
};

export const hasClientApiKey = (): boolean => {
  return Boolean(getApiKey());
};

export const saveClientApiKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('GEMINI_API_KEY', key.trim());
  }
};

export const clearClientApiKey = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('GEMINI_API_KEY');
  }
};

export const getGeminiModel = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_GEMINI_MODEL;
  }
  const saved = localStorage.getItem('GEMINI_MODEL');
  const validModel = getValidGeminiModel(saved);

  // Tự động nâng cấp nếu localStorage chứa model cũ hoặc model không hợp lệ
  if (saved !== validModel) {
    if (saved) {
      console.warn(
        `[AI Model Sync] Phát hiện model cũ không còn khả dụng ("${saved}"). Tự động nâng cấp sang model "${validModel}".`
      );
    }
    localStorage.setItem('GEMINI_MODEL', validModel);
  }

  return validModel;
};

export const formatGeminiError = (error: any): string => {
  const msg = error?.message || String(error || '');

  // 1. Lỗi 401/403: API Key không hợp lệ hoặc bị chặn
  if (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('API_KEY_SERVICE_BLOCKED') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('401') ||
    msg.includes('403')
  ) {
    return 'Khóa API Gemini không hợp lệ, không có quyền truy cập hoặc đã hết hạn (Lỗi 401/403). Vui lòng vào mục "Cài đặt" > "Cấu hình AI" để cập nhật API Key mới (lấy miễn phí tại https://aistudio.google.com/app/apikey) hoặc cập nhật file .env.local.';
  }

  // 2. Lỗi 404: Mô hình không tồn tại hoặc đã ngừng cung cấp
  if (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('is not supported for generateContent')
  ) {
    return `Mô hình AI yêu cầu không tồn tại hoặc đã ngừng tiếp nhận người dùng mới (Lỗi 404 Not Found). Hệ thống đã tự động chuyển sang mô hình mặc định "${DEFAULT_GEMINI_MODEL}". Vui lòng thử lại hoặc cập nhật trong Cài đặt.`;
  }

  // 3. Lỗi 400: Tham số hoặc yêu cầu không tương thích
  if (msg.includes('400') || msg.includes('INVALID_ARGUMENT') || msg.includes('bad request')) {
    return `Yêu cầu không hợp lệ hoặc cấu hình tham số không tương thích với mô hình AI (Lỗi 400 Bad Request). Chi tiết: ${msg}`;
  }

  // 4. Lỗi 429: Hạn mức truy vấn (Rate limit / Quota exceeded)
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return 'Đã vượt quá hạn mức truy vấn API của Google Gemini (Lỗi 429 - Rate Limit / Quota Exceeded). Vui lòng thử lại sau giây lát hoặc cấu hình API Key cá nhân trong Cài đặt.';
  }

  // 5. Lỗi 503/502: Quá tải máy chủ hoặc gián đoạn dịch vụ
  if (
    msg.includes('503') ||
    msg.includes('Service Unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('502') ||
    msg.includes('Bad Gateway')
  ) {
    return 'Máy chủ Google AI hiện đang quá tải hoặc tạm thời gián đoạn (Lỗi 503/502). Vui lòng thử lại sau vài giây.';
  }

  // 6. Lỗi an toàn (Safety filters)
  if (msg.includes('SAFETY') || msg.includes('blocked due to safety')) {
    return 'Yêu cầu bị từ chối do vi phạm bộ lọc an toàn nội dung của Google AI.';
  }

  return `Đã xảy ra sự cố khi giao tiếp với AI: ${msg}`;
};
