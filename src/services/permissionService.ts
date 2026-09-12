/**
 * PQM 3.0 - Permission Service
 * Dịch vụ kiểm soát phân quyền tập trung chuẩn GMP & ALCOA+
 * Thay thế toàn bộ logic rải rác 'isAdmin' bằng kiểm tra năng lực ngữ cảnh (Capability-Based Authorization).
 */

import { 
  Role, 
  PermissionAction, 
  ROLE_PERMISSIONS, 
  UserIdentity, 
  ResourceContext 
} from '../types/permissions';

/**
 * Chuẩn hóa đối tượng người dùng thành UserIdentity
 */
export function normalizeUser(user: any): UserIdentity | null {
  if (!user) {
    if (typeof window !== 'undefined' && typeof (window as any).__PQM_GET_CURRENT_USER__ === 'function') {
      user = (window as any).__PQM_GET_CURRENT_USER__();
    }
  }
  if (!user) return null;
  
  // 1. Kiểm tra cờ trực tiếp trên user
  let isAdminFlag = user.role === 'ADMIN' || !!user.isAdmin;
  let role: Role = isAdminFlag ? 'ADMIN' : (user.role || 'GUEST');
  
  // 2. Fallback nếu user object thiếu role/isAdmin nhưng store đang có phiên đăng nhập Admin
  if (!isAdminFlag && typeof window !== 'undefined') {
    try {
      if (typeof (window as any).__PQM_GET_CURRENT_USER__ === 'function') {
        const storeUser = (window as any).__PQM_GET_CURRENT_USER__();
        if (storeUser && (storeUser.uid === user.uid || storeUser.email === user.email || !user.uid)) {
          if (storeUser.isAdmin || storeUser.role === 'ADMIN') {
            isAdminFlag = true;
            role = 'ADMIN';
          } else if (storeUser.role && role === 'GUEST') {
            role = storeUser.role;
          }
        }
      }
    } catch {}
  }

  // 3. Fallback dev mock auth
  if (!isAdminFlag && typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('pqm_dev_mock_auth') === 'admin@example.com' && (user.email === 'admin@example.com' || !user.email)) {
        isAdminFlag = true;
        role = 'ADMIN';
      }
    } catch {}
  }
  
  return {
    uid: user.uid || '',
    email: user.email || null,
    displayName: user.displayName || null,
    role: role,
    isAdmin: isAdminFlag
  };
}

/**
 * Kiểm tra xem người dùng có quyền thực thi một Action cụ thể hay không.
 * Hỗ trợ kiểm tra quyền cấp tài nguyên (Resource-level context).
 */
export function can(
  user: UserIdentity | any | null | undefined, 
  action: PermissionAction, 
  resource?: ResourceContext
): boolean {
  const identity = normalizeUser(user);
  if (!identity) return false;

  // 1. ADMIN luôn có toàn quyền
  if (identity.isAdmin || identity.role === 'ADMIN') {
    return true;
  }

  // 2. Kiểm tra quyền cơ bản theo vai trò từ Permission Matrix
  const allowedActions = ROLE_PERMISSIONS[identity.role] || [];
  if (!allowedActions.includes(action)) {
    return false;
  }

  // 3. Kiểm soát quyền chuyên sâu theo ngữ cảnh tài nguyên (Resource-Level Rules)
  if (resource) {
    // 3.1. Ràng buộc chỉnh sửa Lô sản xuất:
    // Chỉ được sửa khi Lô chưa RELEASED / REJECTED (trừ Admin)
    if (action === 'batch:update') {
      if (resource.status === 'RELEASED' || resource.status === 'REJECTED') {
        return false;
      }
    }

    // 3.2. Ràng buộc phát hành CoA / Xuất xưởng Lô:
    // Bắt buộc vai trò QA (Admin đã được bypass ở bước 1)
    if (action === 'batch:release' || action === 'coa:issue') {
      if (identity.role !== 'QA') {
        return false;
      }
    }

    // 3.3. Ràng buộc chỉnh sửa Phiếu kiểm nghiệm:
    // Không cho phép sửa nếu phiếu đã được phê duyệt hoặc khóa (APPROVED/LOCKED)
    if (action === 'test_result:update' || action === 'test_result:delete') {
      if (resource.status === 'APPROVED' || resource.status === 'LOCKED') {
        return false;
      }
    }

    // 3.4. Ràng buộc phê duyệt Phiếu kiểm nghiệm:
    // Bắt buộc vai trò QA (Admin đã được bypass ở bước 1)
    if (action === 'test_result:approve') {
      if (identity.role !== 'QA') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Kiểm tra người dùng có ít nhất một trong các quyền trong danh sách (OR logic)
 */
export function canAny(
  user: UserIdentity | any | null | undefined, 
  actions: PermissionAction[], 
  resource?: ResourceContext
): boolean {
  return actions.some(action => can(user, action, resource));
}

/**
 * Kiểm tra người dùng có toàn bộ quyền trong danh sách (AND logic)
 */
export function canAll(
  user: UserIdentity | any | null | undefined, 
  actions: PermissionAction[], 
  resource?: ResourceContext
): boolean {
  return actions.every(action => can(user, action, resource));
}

/**
 * Kiểm tra vai trò cụ thể
 */
export function hasRole(
  user: UserIdentity | any | null | undefined, 
  roles: Role | Role[]
): boolean {
  const identity = normalizeUser(user);
  if (!identity) return false;
  // Quản trị viên (ADMIN) có đầy đủ mọi vai trò và thẩm quyền
  if (identity.isAdmin || identity.role === 'ADMIN') {
    return true;
  }
  const targetRoles = Array.isArray(roles) ? roles : [roles];
  return targetRoles.includes(identity.role);
}

// ============================================================================
// CÁC HÀM TIỆN ÍCH NGHIỆP VỤ & TƯƠNG THÍCH NGƯỢC (BACKWARD COMPATIBILITY)
// ============================================================================

/**
 * Kiểm tra xem người dùng có phải Quản trị viên
 */
export function isAdmin(user: any): boolean {
  const identity = normalizeUser(user);
  return !!identity?.isAdmin || identity?.role === 'ADMIN';
}

/**
 * Kiểm tra quyền ký duyệt xuất xưởng lô (Release Batch)
 */
export function canReleaseBatch(user: any, batch?: ResourceContext): boolean {
  return can(user, 'batch:release', batch);
}

/**
 * Kiểm tra quyền phê duyệt kết quả kiểm nghiệm
 */
export function canApproveTestResult(user: any, testResult?: ResourceContext): boolean {
  return can(user, 'test_result:approve', testResult);
}

/**
 * Kiểm tra quyền ban hành giấy chứng nhận kiểm nghiệm (CoA)
 */
export function canIssueCoA(user: any): boolean {
  return can(user, 'coa:issue');
}

/**
 * Kiểm tra quyền biên tập tiêu chuẩn cơ sở (TCCS) và công thức sản phẩm
 */
export function canEditStandard(user: any): boolean {
  return canAny(user, ['tccs:update', 'tccs:publish', 'formula:update', 'material:update']);
}

/**
 * Kiểm tra quyền quản lý người dùng và cấu hình hệ thống
 */
export function canManageSystem(user: any): boolean {
  return canAny(user, ['user:manage', 'settings:update']);
}

export const permissionService = {
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
  canManageSystem
};

export default permissionService;
