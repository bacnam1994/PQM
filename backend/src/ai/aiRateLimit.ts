/**
 * backend/src/ai/aiRateLimit.ts
 * In-memory sliding window rate limiter for Server-Side AI calls (Phase 13)
 *
 * Prevents API abuse, accidental infinite loops, and unbounded Gemini billings.
 */

import { AppError } from '../utils/errors';

interface RateLimitRecord {
  count: number;
  resetTime: number; // epoch ms
}

export class AIRateLimiter {
  private static userLimits = new Map<string, RateLimitRecord>();
  private static readonly WINDOW_MS = 60 * 1000; // 1 minute window
  private static readonly MAX_REQUESTS_PER_WINDOW = 20; // 20 requests per minute

  /**
   * Checks and consumes a rate limit token for a user or IP.
   */
  public static checkRateLimit(
    identifier: string,
    maxRequests = AIRateLimiter.MAX_REQUESTS_PER_WINDOW
  ): void {
    const now = Date.now();
    const record = this.userLimits.get(identifier);

    if (!record || now > record.resetTime) {
      this.userLimits.set(identifier, {
        count: 1,
        resetTime: now + this.WINDOW_MS,
      });
      return;
    }

    if (record.count >= maxRequests) {
      const waitSeconds = Math.ceil((record.resetTime - now) / 1000);
      throw new AppError(
        'AI_RATE_LIMITED',
        `Tần suất yêu cầu AI vượt quá giới hạn cho phép (${maxRequests} lượt/phút). Vui lòng thử lại sau ${waitSeconds} giây.`,
        429,
        { retryAfterSeconds: waitSeconds }
      );
    }

    record.count += 1;
  }

  /**
   * Resets limit for a specific user (useful in testing)
   */
  public static reset(identifier?: string): void {
    if (identifier) {
      this.userLimits.delete(identifier);
    } else {
      this.userLimits.clear();
    }
  }
}
