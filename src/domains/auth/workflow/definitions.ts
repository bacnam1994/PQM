/**
 * AUTH DOMAIN: WORKFLOW DEFINITIONS (VS-16)
 * ==========================================
 * Định danh các action IDs trong chu trình xác thực người dùng.
 */

export const AUTH_WORKFLOW_ACTIONS = {
  LOGIN: 'AUTH_LOGIN',
  LOGOUT: 'AUTH_LOGOUT',
  SIGNUP: 'AUTH_SIGNUP',
  PASSWORD_CHANGE: 'AUTH_PASSWORD_CHANGE',
  PASSWORD_RESET: 'AUTH_PASSWORD_RESET',
} as const;

export const AUTH_ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: 'Đăng nhập vào hệ thống',
  AUTH_LOGOUT: 'Đăng xuất khỏi hệ thống',
  AUTH_SIGNUP: 'Đăng ký tài khoản người dùng mới',
  AUTH_PASSWORD_CHANGE: 'Thay đổi mật khẩu tài khoản',
  AUTH_PASSWORD_RESET: 'Yêu cầu đặt lại mật khẩu qua email',
};
