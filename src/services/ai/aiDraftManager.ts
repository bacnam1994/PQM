/**
 * aiDraftManager.ts (Thin Adapter - VS-15 Rebuild)
 * ================================================
 * Chuyển tiếp tới Canonical Implementation tại `src/domains/ai`.
 * Duy trì 100% khả năng tương thích ngược cho codebase hiện hữu.
 */

export {
  writeAIDraft,
  peekAIDraft,
  consumeAIDraft,
  clearAIDraft,
  hasAIDraft,
  normalizeAIData,
} from '../../domains/ai';

export type {
  AIDraftEnvelope,
  NormalizedAIData,
  NormalizedAITestResultItem,
} from '../../domains/ai';
