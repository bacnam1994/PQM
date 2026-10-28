/**
 * SYSTEM DOMAIN: CANONICAL ENTRYPOINT (VS-14)
 * ===========================================
 * Điểm xuất khẩu duy nhất của System Domain.
 */

export * from './domain/types';
export * from './domain/rules';
export * from './infrastructure/repository';
export * from './application/systemAppService';
export * from './application/userService';
export * from './application/permissionService';
export * from './application/queries';
export * from './workflow/definitions';
