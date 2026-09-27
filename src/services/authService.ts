/**
 * authService.ts (Thin Adapter - VS-16 Rebuild)
 * ============================================
 * Chuyển tiếp tới Canonical Implementation tại `src/domains/auth`.
 * Duy trì 100% khả năng tương thích ngược cho codebase hiện hữu.
 */

import { authAppService } from '../domains/auth';

export const authService = {
  login: (email: string, pass: string) => authAppService.login(email, pass),
  signup: (email: string, pass: string) => authAppService.signup(email, pass),
  logout: () => authAppService.logout(),
  changePassword: (currentPass: string, newPass: string) =>
    authAppService.changePassword(currentPass, newPass),
  resetPassword: (email: string) => authAppService.resetPassword(email),
  setPersistence: () => authAppService.setPersistence(),
};

export { AuthAppService, authAppService, AuthRules, AuthQueries } from '../domains/auth';

export type {
  AuthUser,
  LoginCredentials,
  SignupCredentials,
  PasswordChangeRequest,
  AuthSessionState,
} from '../domains/auth';

export default authService;
