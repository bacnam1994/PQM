/**
 * aiActionGuard.ts (Thin Adapter - VS-15 Rebuild)
 * ===============================================
 * Chuyển tiếp tới Canonical Implementation tại `src/domains/ai`.
 * Duy trì 100% khả năng tương thích ngược cho codebase hiện hữu.
 */

import { aiActionGuard } from '../../domains/ai';

export {
  AIActionGuard,
  aiActionGuard,
  AIBoundaryRules,
  validateAIAction,
  resolveToolPermission,
  isRegulatedToolAction,
  REGULATED_ACTIONS,
} from '../../domains/ai';

export type { AIActionProposal, GuardValidationResult } from '../../domains/ai';

export default aiActionGuard;
