/**
 * userService.ts (Thin Adapter - VS-14 Rebuild)
 * =============================================
 * Chuyển tiếp tới Canonical Implementation tại `src/domains/system`.
 * Duy trì 100% khả năng tương thích ngược cho codebase hiện hữu.
 */

export { UserService, userService } from '../domains/system';

export type { UserRole, UserData, UserAuditLogEntry } from '../domains/system';
