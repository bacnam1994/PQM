/**
 * PQM 3.0 - Permission & RBAC Types
 * Ma trận phân quyền theo vai trò (Role-Based Access Control) chuẩn GMP / 21 CFR Part 11
 */

export type Role = 
  | 'ADMIN'       // Quản trị viên tối cao: Toàn quyền cấu hình, tài khoản, dữ liệu
  | 'QA'          // Quality Assurance: Ký duyệt xuất xưởng lô, duyệt TCCS, ban hành CoA, OOS/CAPA
  | 'QC'          // Quality Control: Soát xét kết quả kiểm nghiệm, quản lý chỉ tiêu, theo dõi xu hướng
  | 'LAB'         // Kiểm nghiệm viên (Analyst): Tạo và nhập phiếu kiểm nghiệm, đính kèm dữ liệu phân tích
  | 'PRODUCTION'  // Bộ phận Sản xuất: Tạo lô sản xuất, cập nhật sản lượng thực tế, quy cách đóng gói
  | 'VIEWER'      // Quan sát viên / Thanh tra: Chỉ đọc các báo cáo và chứng chỉ được cấp phép
  | 'USER'        // [Legacy Compatibility] Vai trò cũ tương thích (Tương đương Production + Lab nhập liệu)
  | 'GUEST';      // Người dùng mới chưa được phân quyền

export type Module = 
  | 'product'
  | 'tccs'
  | 'formula'
  | 'material'
  | 'batch'
  | 'test_result'
  | 'coa'
  | 'quality_alert'
  | 'audit_log'
  | 'settings'
  | 'user_management'
  | 'ai_copilot';

export type PermissionAction =
  // Product
  | 'product:create'
  | 'product:read'
  | 'product:update'
  | 'product:delete'
  // TCCS
  | 'tccs:create'
  | 'tccs:read'
  | 'tccs:update'
  | 'tccs:delete'
  | 'tccs:publish'
  // Formula
  | 'formula:create'
  | 'formula:read'
  | 'formula:update'
  | 'formula:delete'
  // Raw Material
  | 'material:create'
  | 'material:read'
  | 'material:update'
  | 'material:delete'
  // Batch
  | 'batch:create'
  | 'batch:read'
  | 'batch:update'
  | 'batch:delete'
  | 'batch:release'
  | 'batch:reject'
  // Test Result
  | 'test_result:create'
  | 'test_result:read'
  | 'test_result:update'
  | 'test_result:delete'
  | 'test_result:submit'
  | 'test_result:review'
  | 'test_result:approve'
  // CoA (Certificate of Analysis)
  | 'coa:read'
  | 'coa:issue'
  | 'coa:revoke'
  | 'coa:print'
  // Quality Alerts & Anomaly
  | 'quality_alert:read'
  | 'quality_alert:create'
  | 'quality_alert:dismiss'
  // Audit Trail
  | 'audit:read'
  | 'audit:export'
  // System & Users
  | 'settings:read'
  | 'settings:update'
  | 'user:read'
  | 'user:manage'
  // AI Platform
  | 'ai:query'
  | 'ai:execute_action';

export interface UserIdentity {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  role: Role;
  isAdmin?: boolean;
}

export interface ResourceContext {
  id?: string;
  createdBy?: string;
  status?: string;
  batchId?: string;
  [key: string]: any;
}

/**
 * Ma trận Phân quyền Chuẩn GMP (Permission Matrix)
 */
export const ROLE_PERMISSIONS: Record<Role, readonly PermissionAction[]> = {
  ADMIN: [
    'product:create', 'product:read', 'product:update', 'product:delete',
    'tccs:create', 'tccs:read', 'tccs:update', 'tccs:delete', 'tccs:publish',
    'formula:create', 'formula:read', 'formula:update', 'formula:delete',
    'material:create', 'material:read', 'material:update', 'material:delete',
    'batch:create', 'batch:read', 'batch:update', 'batch:delete', 'batch:release', 'batch:reject',
    'test_result:create', 'test_result:read', 'test_result:update', 'test_result:delete', 'test_result:submit', 'test_result:review', 'test_result:approve',
    'coa:read', 'coa:issue', 'coa:revoke', 'coa:print',
    'quality_alert:read', 'quality_alert:create', 'quality_alert:dismiss',
    'audit:read', 'audit:export',
    'settings:read', 'settings:update',
    'user:read', 'user:manage',
    'ai:query', 'ai:execute_action'
  ],

  QA: [
    'product:read',
    'tccs:create', 'tccs:read', 'tccs:update', 'tccs:publish',
    'formula:create', 'formula:read', 'formula:update',
    'material:read',
    'batch:read', 'batch:release', 'batch:reject',
    'test_result:read', 'test_result:approve',
    'coa:read', 'coa:issue', 'coa:revoke', 'coa:print',
    'quality_alert:read', 'quality_alert:create', 'quality_alert:dismiss',
    'audit:read', 'audit:export',
    'ai:query', 'ai:execute_action'
  ],

  QC: [
    'product:read',
    'tccs:read',
    'formula:read',
    'material:read',
    'batch:read',
    'test_result:create', 'test_result:read', 'test_result:update', 'test_result:submit', 'test_result:review',
    'coa:read', 'coa:print',
    'quality_alert:read', 'quality_alert:create',
    'audit:read',
    'ai:query'
  ],

  LAB: [
    'product:read',
    'tccs:read',
    'formula:read',
    'material:read',
    'batch:read',
    'test_result:create', 'test_result:read', 'test_result:update', 'test_result:submit',
    'coa:read',
    'quality_alert:read',
    'ai:query'
  ],

  PRODUCTION: [
    'product:read',
    'tccs:read',
    'formula:read',
    'material:read',
    'batch:create', 'batch:read', 'batch:update',
    'test_result:read',
    'coa:read',
    'quality_alert:read',
    'ai:query'
  ],

  VIEWER: [
    'product:read',
    'tccs:read',
    'formula:read',
    'material:read',
    'batch:read',
    'test_result:read',
    'coa:read',
    'quality_alert:read',
    'ai:query'
  ],

  // Tương thích ngược: USER cũ có quyền tạo lô và phiếu kiểm nghiệm
  USER: [
    'product:read',
    'tccs:read',
    'formula:read',
    'material:read',
    'batch:create', 'batch:read', 'batch:update',
    'test_result:create', 'test_result:read', 'test_result:update', 'test_result:submit',
    'coa:read', 'coa:print',
    'quality_alert:read',
    'ai:query'
  ],

  GUEST: []
};
