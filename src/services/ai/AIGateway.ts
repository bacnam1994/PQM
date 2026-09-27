/**
 * AIGateway.ts (Thin Adapter - VS-15 Rebuild)
 * ===========================================
 * Chuyển tiếp tới Canonical Implementation tại `src/domains/ai`.
 * Duy trì 100% khả năng tương thích ngược cho codebase hiện hữu.
 */

export { AIGatewayService, aiGateway } from '../../domains/ai';

export type { AIGatewayRequest, AIGatewayResponse } from '../../domains/ai';
