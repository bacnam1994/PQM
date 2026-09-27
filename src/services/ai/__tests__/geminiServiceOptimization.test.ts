import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIsThinkingEnabled,
  formatGeminiError,
  DEFAULT_GEMINI_MODEL,
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

  it('formatGeminiError nên phân loại lỗi chính xác và thân thiện', () => {
    const error429 = new Error('Resource has been exhausted (e.g. check quota): 429');
    expect(formatGeminiError(error429)).toContain('429 - Rate Limit');

    const error503 = new Error('Service Unavailable: 503');
    expect(formatGeminiError(error503)).toContain('503');

    const errorKey = new Error('API_KEY_INVALID');
    expect(formatGeminiError(errorKey)).toContain('Khóa API Gemini không hợp lệ');
  });

  it('Các model chuẩn được đăng ký đầy đủ trong danh sách', () => {
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-2.5-flash');
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gemini-2.5-flash')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gemini-2.5-pro')).toBe(true);
    expect(AVAILABLE_GEMINI_MODELS.some((m) => m.id === 'gemini-2.0-flash')).toBe(true);
  });

  it('Semantic Cache hoạt động chính xác với PromptIdentifier TCCS_ASSISTANT (Phase 15)', () => {
    const input = '[gemini-2.5-flash] Dược điển quy định giới hạn vi sinh vật thế nào?';

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
