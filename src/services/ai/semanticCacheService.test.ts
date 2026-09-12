import { describe, it, expect, beforeEach } from 'vitest';
import {
  SemanticCacheService,
  normalizeAIInput,
  calculateTokenSimilarity,
} from './semanticCacheService';
import { PromptIdentifier } from './promptRegistry';

describe('SemanticCacheService - AI Semantic & Query Caching', () => {
  let cache: SemanticCacheService;

  beforeEach(() => {
    cache = new SemanticCacheService();
    cache.clear();
  });

  describe('Chuẩn hóa đầu vào (normalizeAIInput)', () => {
    it('loại bỏ dấu tiếng Việt, ký tự đặc biệt và đưa về lowercase', () => {
      const input = 'Có Lô nào SẮP HẾT HẠN không???';
      const { normalizedText, tokens } = normalizeAIInput(input);

      expect(normalizedText).toContain('co lo nao sap het han khong');
      expect(tokens).toContain('lo');
      expect(tokens).toContain('sap');
      expect(tokens).toContain('het');
      expect(tokens).toContain('han');
      // Từ dừng "co", "khong" bị lọc khỏi meaningful tokens
      expect(tokens).not.toContain('khong');
    });

    it('xử lý đầu vào là JSON object an toàn', () => {
      const input = { productId: 'p-101', criteria: 'Độ ẩm' };
      const { normalizedText, tokens } = normalizeAIInput(input);

      expect(normalizedText).toContain('productid');
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('Độ tương đồng ngữ nghĩa (calculateTokenSimilarity)', () => {
    it('trả về 1.0 cho 2 mảng token giống hệt nhau', () => {
      const tokensA = ['lo', 'sap', 'het', 'han'];
      const tokensB = ['lo', 'sap', 'het', 'han'];
      expect(calculateTokenSimilarity(tokensA, tokensB)).toBe(1.0);
    });

    it('trả về độ tương đồng cao cho 2 câu hỏi cùng ý nhưng đổi thứ tự từ', () => {
      const tokensA = ['lo', 'san', 'xuat', 'het', 'han'];
      const tokensB = ['san', 'xuat', 'lo', 'het', 'han'];
      expect(calculateTokenSimilarity(tokensA, tokensB)).toBe(1.0);
    });

    it('trả về độ tương đồng thấp cho 2 chủ đề khác biệt', () => {
      const tokensA = ['lo', 'sap', 'het', 'han'];
      const tokensB = ['cong', 'thuc', 'dinh', 'luong', 'hoat', 'chat'];
      expect(calculateTokenSimilarity(tokensA, tokensB)).toBe(0);
    });
  });

  describe('Cơ chế Cache Hit & Miss', () => {
    const mockRequest = {
      promptId: 'TEST_PROMPT' as PromptIdentifier,
      input: 'Có lô nào sắp hết hạn trong 30 ngày tới không?',
      options: {},
    };

    const mockResponseData = {
      warningCount: 2,
      batches: ['L001', 'L002'],
    };

    it('trả về null khi chưa có cache (Cache Miss)', () => {
      const cached = cache.get(mockRequest);
      expect(cached).toBeNull();
      expect(cache.getStats().misses).toBe(1);
    });

    it('trả về kết quả chính xác khi trùng lặp câu hỏi (Exact Match)', () => {
      cache.set(mockRequest, mockResponseData, 0.95);

      const cached = cache.get(mockRequest);
      expect(cached).not.toBeNull();
      expect(cached?.isExactMatch).toBe(true);
      expect(cached?.data).toEqual(mockResponseData);
      expect(cache.getStats().hits).toBe(1);
    });

    it('trả về kết quả khi câu hỏi có biến thể từ ngữ tương đồng (Semantic Fuzzy Match)', () => {
      // Đã lưu câu: "Có lô nào sắp hết hạn trong 30 ngày tới không?"
      cache.set(mockRequest, mockResponseData, 0.95);

      // Người dùng hỏi biến thể: "Vui lòng cho biết các lô sắp hết hạn trong 30 ngày tới"
      const variantRequest = {
        promptId: 'TEST_PROMPT' as PromptIdentifier,
        input: 'Vui lòng cho biết các lô sắp hết hạn trong 30 ngày tới',
        options: {},
      };

      const cached = cache.get(variantRequest);
      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual(mockResponseData);
      expect(cached?.similarity).toBeGreaterThanOrEqual(0.88);
      expect(cache.getStats().hits).toBe(1);
    });

    it('không cache khi có cờ bypassCache: true', () => {
      cache.set(mockRequest, mockResponseData, 0.95);

      const bypassRequest = {
        ...mockRequest,
        options: { bypassCache: true },
      };

      const cached = cache.get(bypassRequest);
      expect(cached).toBeNull();
    });

    it('tự động bỏ qua khi cache đã hết hạn TTL', () => {
      // Set cache với TTL = 1ms
      cache.set(mockRequest, mockResponseData, 0.95, 1);

      // Chờ 10ms để hết hạn
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cached = cache.get(mockRequest);
          expect(cached).toBeNull();
          resolve();
        }, 15);
      });
    });
  });
});
