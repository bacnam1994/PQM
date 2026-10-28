import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveClientApiKey,
  clearClientApiKey,
  getApiKey,
  hasClientApiKey,
  testClientGeminiConnection,
  DEFAULT_GEMINI_MODEL,
} from '../../src/services/ai/geminiService';

vi.mock('../../src/services/ai/geminiClientLoader', () => ({
  createGoogleGenerativeAI: vi.fn().mockImplementation((key: string) => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: Promise.resolve({
          text: () => 'OK',
        }),
      }),
    }),
  })),
  SchemaType: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    ARRAY: 'ARRAY',
  },
}));

describe('Client Direct Gemini Helpers (Firebase Free Spark Plan)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('saves and clears client api key in localStorage', () => {
    expect(hasClientApiKey()).toBe(false);
    saveClientApiKey('AQ.TestKey1234567890');
    expect(hasClientApiKey()).toBe(true);
    expect(getApiKey()).toBe('AQ.TestKey1234567890');
    expect(localStorage.getItem('GEMINI_API_KEY')).toBe('AQ.TestKey1234567890');

    clearClientApiKey();
    expect(hasClientApiKey()).toBe(false);
    expect(localStorage.getItem('GEMINI_API_KEY')).toBeNull();
  });

  it('tests client direct connection successfully with candidate key and default model', async () => {
    const res = await testClientGeminiConnection('AQ.CandidateKey987654321', 'gemini-3.5-flash');
    expect(res).toBeDefined();
    expect(res.model).toBe('gemini-3.5-flash');
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);

    // Test when model is omitted (should use DEFAULT_GEMINI_MODEL: gemini-3.5-flash-lite)
    const resDefault = await testClientGeminiConnection('AQ.CandidateKey987654321');
    expect(resDefault.model).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('fails gracefully when key is missing', async () => {
    await expect(testClientGeminiConnection('')).rejects.toThrow('Vui lòng nhập API Key');
  });
});
