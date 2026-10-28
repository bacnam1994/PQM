import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIsThinkingEnabled,
  formatGeminiError,
  getGeminiModel,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  AVAILABLE_GEMINI_MODELS,
} from '../geminiService';
import { semanticCache } from '../semanticCacheService';

describe('Gemini AI Optimization & Stability (Phases 7, 11, 12, 14, 15)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Thinking nên mặc định là false để tối ưu thời gian phản hồi (Phase 14)', () => {
    expect(getIsThinkingEnabled()).toBe(false);

    localStorage.setItem('GEMINI_THINKING_ENABLED', 'true');
    expect(getIsThinkingEnabled()).toBe(true);

    localStorage.setItem('GEMINI_THINKING_ENABLED', 'false');
    expect(getIsThinkingEnabled()).toBe(false);
  });

  it('formatGeminiError nên phân loại lỗi chính xác và thân thiện (400, 401/403, 404, 429, 503)', () => {
    // 429: Rate Limit
    const error429 = new Error('Resource has been exhausted (e.g. check quota): 429');
    expect(formatGeminiError(error429)).toContain('429 - Rate Limit');

    // 503: Service Unavailable
    const error503 = new Error('Service Unavailable: 503');
    expect(formatGeminiError(error503)).toContain('503');

    // 401/403: API Key Invalid / Permission Denied
    const errorKey = new Error('API_KEY_INVALID');
    expect(formatGeminiError(errorKey)).toContain('Khóa API Gemini không hợp lệ');

    const error403 = new Error(
      'Request had invalid authentication credentials (PERMISSION_DENIED): 403'
    );
    expect(formatGeminiError(error403)).toContain('401/403');

    // 404: Model Not Found / Deprecated
    const error404 = new Error(
      'models/gemini-2.5-flash is not found for API version v1beta, or is not supported for generateContent. 404'
    );
    expect(formatGeminiError(error404)).toContain('404 Not Found');
    expect(formatGeminiError(error404)).toContain(DEFAULT_GEMINI_MODEL);

    // 400: Bad Request / Invalid Argument
    const error400 = new Error(
      'Invalid argument: temperature is not supported for this model (INVALID_ARGUMENT): 400'
    );
    expect(formatGeminiError(error400)).toContain('400 Bad Request');
  });

  it('Các model chuẩn được đăng ký đầy đủ trong danh sách và mặc định là gemini-3.5-flash-lite', () => {
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
    expect(FALLBACK_GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gemini-3.5-flash')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gemini-3.5-flash-lite')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gemini-3.6-flash')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gemini-3.8-flash')).toBe(true);
    // Model legacy có cờ isDeprecated
    const legacy25 = AVAILABLE_GEMINI_MODELS.find((m) => m.id === 'gemini-2.5-flash');
    expect(legacy25?.isDeprecated).toBe(true);
  });

  it('Tự động nâng cấp model cũ trong localStorage sang gemini-3.5-flash-lite hợp lệ', () => {
    // Khi localStorage chứa model cũ gemini-2.5-flash
    localStorage.setItem('GEMINI_MODEL', 'gemini-2.5-flash');
    const resolvedModel1 = getGeminiModel();
    expect(resolvedModel1).toBe('gemini-3.5-flash-lite');
    expect(localStorage.getItem('GEMINI_MODEL')).toBe('gemini-3.5-flash-lite');

    // Khi localStorage chứa model cũ gemini-2.0-flash
    localStorage.setItem('GEMINI_MODEL', 'gemini-2.0-flash');
    const resolvedModel2 = getGeminiModel();
    expect(resolvedModel2).toBe('gemini-3.5-flash-lite');
    expect(localStorage.getItem('GEMINI_MODEL')).toBe('gemini-3.5-flash-lite');

    // Khi localStorage chứa model quá tải gemini-3.8-flash -> tự nâng cấp sang 3.5-flash-lite
    localStorage.setItem('GEMINI_MODEL', 'gemini-3.8-flash');
    const resolvedModel3 = getGeminiModel();
    expect(resolvedModel3).toBe('gemini-3.5-flash-lite');

    // Khi người dùng chọn model hợp lệ gemini-3.5-flash
    localStorage.setItem('GEMINI_MODEL', 'gemini-3.5-flash');
    const resolvedModel4 = getGeminiModel();
    expect(resolvedModel4).toBe('gemini-3.5-flash');

    // Khi localStorage rỗng
    localStorage.removeItem('GEMINI_MODEL');
    const resolvedModelEmpty = getGeminiModel();
    expect(resolvedModelEmpty).toBe('gemini-3.5-flash-lite');
  });

  it('Semantic Cache hoạt động chính xác với PromptIdentifier TCCS_ASSISTANT (Phase 15)', () => {
    const input = '[gemini-3.8-flash] Dược điển quy định giới hạn vi sinh vật thế nào?';

    semanticCache.set(
      { promptId: 'TCCS_ASSISTANT', input },
      { text: 'Quy định vi sinh vật theo Dược điển Việt Nam V...', thinking: undefined }
    );

    const match = semanticCache.get<{ text: string }>({
      promptId: 'TCCS_ASSISTANT',
      input,
    });

    expect(match).not.toBeNull();
    expect(match?.data.text).toContain('Dược điển Việt Nam V');
    expect(match?.isExactMatch).toBe(true);
  });
});
