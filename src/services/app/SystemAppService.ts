/**
 * SystemAppService.ts (Thin Adapter - VS-14 Rebuild)
 * ==================================================
 * Chuyển tiếp tới Canonical Implementation tại `src/domains/system`.
 * Duy trì 100% khả năng tương thích ngược cho codebase hiện hữu.
 */

export { SystemAppService, systemAppService } from '../../domains/system';

export type { SystemActionContext, SystemActionResult } from '../../domains/system';
