/**
 * AI BOUNDARY DOMAIN: CANONICAL ENTRYPOINT (VS-15)
 * =================================================
 * Điểm xuất khẩu duy nhất của AI Domain.
 */

export * from './domain/types';
export * from './domain/rules';
export * from './infrastructure/gateway';
export * from './application/aiActionGuard';
export * from './application/aiDraftManager';
export * from './application/queries';
export * from './workflow/definitions';
