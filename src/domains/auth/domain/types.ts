/**
 * AUTH DOMAIN: TYPES (VS-16)
 * ==========================
 * Định nghĩa kiểu dữ liệu cho Xác thực & Phiên làm việc người dùng (GMP 21 CFR Part 11).
 */

import { UserRole } from '../../system/domain/types';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role: UserRole;
  isAdmin?: boolean;
}

export interface LoginCredentials {
  email: string;
  pass: string;
}

export interface SignupCredentials {
  email: string;
  pass: string;
  displayName?: string;
}

export interface PasswordChangeRequest {
  currentPass: string;
  newPass: string;
}

export interface AuthSessionState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  error?: string | null;
}
