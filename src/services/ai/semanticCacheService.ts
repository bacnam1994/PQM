/**
 * semanticCacheService.ts
 * PQM AI Intelligence Suite - Multi-Tier Semantic & Normalized Cache
 * =================================================================
 * Giải pháp tối ưu chi phí & thời gian phản hồi suy luận AI:
 * 1. L1 In-Memory Map Cache: Phản hồi tức thì (< 5ms).
 * 2. L2 Local Storage Cache: Bền vững qua reload trang, có cơ chế thời gian sống TTL (Mặc định: 60 phút).
 * 3. Chuẩn hóa chuỗi truy vấn (Stop-words removal, Vietnamese Tone-stripping, Whitespace flattening).
 * 4. So khớp tương đồng ngữ nghĩa bằng Token Jaccard / Dice Similarity (ngưỡng tương đồng >= 0.88).
 */

import { AIGatewayRequest } from './AIGateway';

export interface CachedAIItem<T = any> {
  id: string;
  promptId: string;
  promptVersion?: string;
  normalizedText: string;
  tokens: string[];
  data: T;
  confidenceScore: number;
  cachedAt: number; // Timestamp ms
  expiresAt: number; // Timestamp ms
  hitCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  totalSavedLatencyMs: number;
  itemCount: number;
}

const STORAGE_KEY = 'pqm_ai_semantic_cache_v1';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 giờ
const SIMILARITY_THRESHOLD = 0.88; // 88% tương đồng token ngữ nghĩa

// Danh sách từ dừng phổ biến trong câu hỏi tiếng Việt
const STOP_WORDS = new Set([
  'la',
  'va',
  'cua',
  'cho',
  'toi',
  'biet',
  'hay',
  'vui',
  'long',
  'xem',
  'co',
  'phai',
  'khong',
  'nhung',
  'cac',
  'mot',
  'trong',
  'duoc',
  've',
  'giup',
  'em',
  'anh',
  'chi',
  'ad',
  'admin',
  'he',
  'thong',
  'thong_tin',
  'hoi',
  'can',
  'muon',
  'xin',
  'hay_cho_biet',
  'liet_ke',
]);

/**
 * Loại bỏ dấu tiếng Việt
 */
function removeDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Chuẩn hóa truy vấn text thành chuỗi tinh gọn và mảng tokens đặc trưng
 */
export function normalizeAIInput(input: any): { normalizedText: string; tokens: string[] } {
  const rawString = typeof input === 'string' ? input : JSON.stringify(input);
  const clean = removeDiacritics(rawString.toLowerCase())
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const allTokens = clean.split(' ').filter((t) => t.length > 1);
  const meaningfulTokens = allTokens.filter((t) => !STOP_WORDS.has(t));
  const uniqueTokens = Array.from(
    new Set(meaningfulTokens.length > 0 ? meaningfulTokens : allTokens)
  );

  return {
    normalizedText: clean,
    tokens: uniqueTokens.sort(),
  };
}

/**
 * Tính độ tương đồng Dice Coefficient giữa 2 tập tokens (0.0 -> 1.0)
 */
export function calculateTokenSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  const setB = new Set(tokensB);
  let intersectionCount = 0;
  for (const token of tokensA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  return (2 * intersectionCount) / (tokensA.length + tokensB.length);
}

export class SemanticCacheService {
  private memoryCache = new Map<string, CachedAIItem>();
  private statsRecord: CacheStats = {
    hits: 0,
    misses: 0,
    totalSavedLatencyMs: 0,
    itemCount: 0,
  };

  constructor() {
    this.hydrateFromStorage();
  }

  /**
   * Khôi phục cache từ LocalStorage vào bộ nhớ
   */
  private hydrateFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: CachedAIItem[] = JSON.parse(raw);
      const now = Date.now();

      for (const item of parsed) {
        if (item.expiresAt > now) {
          this.memoryCache.set(item.id, item);
        }
      }
      this.statsRecord.itemCount = this.memoryCache.size;
    } catch {
      // Bỏ qua lỗi parse storage
    }
  }

  /**
   * Lưu lại cache vào LocalStorage
   */
  private persistToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const items = Array.from(this.memoryCache.values())
        .filter((item) => item.expiresAt > Date.now())
        .slice(-100); // Giới hạn 100 cache entries gần nhất để bảo vệ dung lượng LocalStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      this.statsRecord.itemCount = items.length;
    } catch {
      // Bỏ qua nếu LocalStorage bị đầy
    }
  }

  /**
   * Tìm kiếm kết quả cache cho một yêu cầu AI
   */
  get<T = any>(
    request: AIGatewayRequest
  ): { data: T; confidenceScore: number; isExactMatch: boolean; similarity: number } | null {
    if (request.options?.bypassCache) {
      this.statsRecord.misses++;
      return null;
    }

    const { normalizedText, tokens } = normalizeAIInput(request.input);
    const now = Date.now();
    let bestMatch: CachedAIItem<T> | null = null;
    let highestSimilarity = 0;

    for (const [id, item] of this.memoryCache.entries()) {
      // Kiểm tra hết hạn TTL
      if (item.expiresAt <= now) {
        this.memoryCache.delete(id);
        continue;
      }

      // Chỉ so khớp nếu cùng promptId
      if (item.promptId !== request.promptId) {
        continue;
      }

      // 1. Kiểm tra Exact Match trên chuỗi chuẩn hóa
      if (item.normalizedText === normalizedText) {
        item.hitCount++;
        this.statsRecord.hits++;
        this.statsRecord.totalSavedLatencyMs += 2500; // Ước tính trung bình 2.5s mỗi cuộc gọi Gemini
        return {
          data: item.data as T,
          confidenceScore: item.confidenceScore,
          isExactMatch: true,
          similarity: 1.0,
        };
      }

      // 2. So khớp tương đồng ngữ nghĩa qua Dice Coefficient
      const sim = calculateTokenSimilarity(tokens, item.tokens);
      if (sim >= SIMILARITY_THRESHOLD && sim > highestSimilarity) {
        highestSimilarity = sim;
        bestMatch = item as CachedAIItem<T>;
      }
    }

    if (bestMatch && highestSimilarity >= SIMILARITY_THRESHOLD) {
      bestMatch.hitCount++;
      this.statsRecord.hits++;
      this.statsRecord.totalSavedLatencyMs += 2500;
      return {
        data: bestMatch.data,
        confidenceScore: bestMatch.confidenceScore,
        isExactMatch: false,
        similarity: Number(highestSimilarity.toFixed(2)),
      };
    }

    this.statsRecord.misses++;
    return null;
  }

  /**
   * Lưu kết quả vào Semantic Cache
   */
  set<T = any>(
    request: AIGatewayRequest,
    data: T,
    confidenceScore = 0.95,
    ttlMs: number = DEFAULT_TTL_MS
  ): void {
    if (!data || request.options?.bypassCache) return;

    const { normalizedText, tokens } = normalizeAIInput(request.input);
    const now = Date.now();
    const id = `${request.promptId}_${Math.abs(this.hashCode(normalizedText))}`;

    const cacheItem: CachedAIItem<T> = {
      id,
      promptId: request.promptId,
      promptVersion: request.promptVersion,
      normalizedText,
      tokens,
      data,
      confidenceScore,
      cachedAt: now,
      expiresAt: now + ttlMs,
      hitCount: 0,
    };

    this.memoryCache.set(id, cacheItem);
    this.persistToStorage();
  }

  /**
   * Xóa toàn bộ cache (hỗ trợ kiểm thử hoặc làm mới hệ thống)
   */
  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.statsRecord = {
      hits: 0,
      misses: 0,
      totalSavedLatencyMs: 0,
      itemCount: 0,
    };
  }

  /**
   * Lấy thống kê hiệu năng cache
   */
  getStats(): CacheStats {
    return { ...this.statsRecord, itemCount: this.memoryCache.size };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

export const semanticCache = new SemanticCacheService();
