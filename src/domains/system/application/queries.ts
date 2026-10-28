/**
 * SYSTEM DOMAIN: QUERIES (VS-14)
 * ==============================
 * Cung cấp điểm truy vấn đồng nhất cho System Domain (Read-Only side).
 */

import { UserIdentity, UserRole, PermissionAction, ResourceContext } from '../domain/types';
import { can, canAny, canAll, hasRole, isAdmin, normalizeUser } from './permissionService';

export class SystemQueries {
  static normalizeUser(user: any): UserIdentity | null {
    return normalizeUser(user);
  }

  static isAdmin(user: any): boolean {
    return isAdmin(user);
  }

  static can(user: any, action: PermissionAction, resource?: ResourceContext): boolean {
    return can(user, action, resource);
  }

  static canAny(user: any, actions: PermissionAction[], resource?: ResourceContext): boolean {
    return canAny(user, actions, resource);
  }

  static canAll(user: any, actions: PermissionAction[], resource?: ResourceContext): boolean {
    return canAll(user, actions, resource);
  }

  static hasRole(user: any, roles: UserRole | UserRole[]): boolean {
    return hasRole(user, roles);
  }
}
