/**
 * SYSTEM DOMAIN: TYPES (VS-14)
 * ============================
 * Định nghĩa các kiểu dữ liệu cốt lõi cho System Domain:
 * Quản trị phân quyền RBAC, Người dùng, Giám sát hệ thống, và Các thao tác nguy hiểm (Destructive Actions).
 */

import {
  Role,
  UserIdentity,
  ResourceContext,
  PermissionAction,
  ROLE_PERMISSIONS,
} from '../../../types/permissions';

export type UserRole = Role;
export type { UserIdentity, ResourceContext, PermissionAction };
export { ROLE_PERMISSIONS };

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: string;
}

export interface UserAuditLogEntry {
  id: string;
  action: string;
  targetEmail?: string;
  targetUid?: string;
  performedBy: string;
  oldRole?: string;
  newRole?: string;
  timestamp: string | any;
  details?: string;
}

export type ConfirmationToken = 'CONFIRM_RESTORE' | 'CONFIRM_WIPE' | 'CONFIRM_RESET_DEMO';

export interface SystemActionContext {
  actorId: string;
  actorRole: string;
  actorEmail?: string;
  reason?: string;
  confirmationToken?: string;
}

export interface SystemActionResult {
  executionId: string;
  success: boolean;
  action:
    | 'DATABASE_BACKUP'
    | 'DATABASE_RESTORE'
    | 'DATABASE_WIPE'
    | 'DATABASE_RESET_DEMO'
    | 'SYSTEM_CONFIG_UPDATE'
    | 'SYSTEM_USER_ROLE_ASSIGN';
  timestamp: string;
  message?: string;
  data?: Record<string, any>;
}

export interface SystemHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'MAINTENANCE';
  databaseConnected: boolean;
  activeUsersCount?: number;
  lastBackupTimestamp?: string;
}
