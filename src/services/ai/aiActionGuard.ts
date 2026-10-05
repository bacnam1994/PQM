import {
  AIActionGuard,
  aiActionGuard,
  validateAIAction,
  resolveToolPermission,
  isRegulatedToolAction,
  REGULATED_ACTIONS,
} from '../../domains/ai/application/aiActionGuard';
import { AIBoundaryRules } from '../../domains/ai/domain/rules';
import type { AIActionProposal, GuardValidationResult } from '../../domains/ai/domain/types';

export {
  AIActionGuard,
  aiActionGuard,
  AIBoundaryRules,
  validateAIAction,
  resolveToolPermission,
  isRegulatedToolAction,
  REGULATED_ACTIONS,
};

export type { AIActionProposal, GuardValidationResult };

export default aiActionGuard;
