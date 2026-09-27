/**
 * permissionService.ts (Thin Adapter - VS-14 Rebuild)
 * ===================================================
 * Chuyển tiếp tới Canonical Implementation tại `src/domains/system`.
 * Duy trì 100% khả năng tương thích ngược cho codebase hiện hữu.
 */

import { permissionService } from '../domains/system';

export {
  permissionService,
  normalizeUser,
  can,
  canAny,
  canAll,
  hasRole,
  isAdmin,
  canReleaseBatch,
  canApproveTestResult,
  canIssueCoA,
  canEditStandard,
  canManageSystem,
} from '../domains/system';

export default permissionService;
