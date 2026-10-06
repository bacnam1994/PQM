/**
 * backend/src/middleware/auth.ts
 * Server-Authoritative Authentication & RBAC Middleware
 *
 * Verifies Firebase ID Token, checks session freshness (auth_time <= 300s),
 * loads profile from RTDB (never trusts client claims), and enforces RBAC.
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { getAuth, getDb } from '../config/firebaseAdmin';
import { AppError, sendErrorResponse } from '../utils/errors';
import { extractCorrelationId } from '../utils/correlationId';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
  authTime: number; // Epoch seconds
  token: admin.auth.DecodedIdToken;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      correlationId?: string;
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const correlationId = req.correlationId || extractCorrelationId(req);
  req.correlationId = correlationId;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendErrorResponse(
        res,
        'UNAUTHENTICATED',
        'Thiếu Authorization Bearer token hợp lệ.',
        401,
        correlationId
      );
      return;
    }

    const tokenString = authHeader.substring(7).trim();
    if (!tokenString) {
      sendErrorResponse(res, 'UNAUTHENTICATED', 'Bearer token rỗng.', 401, correlationId);
      return;
    }

    const auth = getAuth();
    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await auth.verifyIdToken(tokenString);
    } catch (err: any) {
      sendErrorResponse(
        res,
        'UNAUTHENTICATED',
        'Token xác thực không hợp lệ hoặc đã hết hạn.',
        401,
        correlationId
      );
      return;
    }

    const uid = decodedToken.uid;
    if (!uid) {
      sendErrorResponse(
        res,
        'UNAUTHENTICATED',
        'Không tìm thấy UID trong token.',
        401,
        correlationId
      );
      return;
    }

    // Server Authority: Read fresh user data from RTDB (Never trust client body)
    const db = getDb();
    const [userSnap, adminSnap] = await Promise.all([
      db.ref(`users/${uid}`).once('value'),
      db.ref(`users/admins/${uid}`).once('value'),
    ]);

    const userData = userSnap.val() || {};
    const isAdmin =
      decodedToken.isAdmin === true ||
      decodedToken.role === 'ADMIN' ||
      adminSnap.exists() ||
      userData.role === 'ADMIN';

    const role = isAdmin ? 'ADMIN' : userData.role || decodedToken.role || 'USER';
    const displayName =
      userData.displayName || decodedToken.name || userData.email || decodedToken.email || 'User';
    const email = userData.email || decodedToken.email || 'unknown';
    const authTime = decodedToken.auth_time ? Number(decodedToken.auth_time) : 0;

    req.user = {
      uid,
      email,
      displayName,
      role,
      isAdmin,
      authTime,
      token: decodedToken,
    };

    next();
  } catch (err: any) {
    console.error(`[AuthMiddleware][${correlationId}] Unexpected auth error:`, err);
    sendErrorResponse(res, 'INTERNAL', 'Lỗi hệ thống khi xác thực danh tính.', 500, correlationId);
  }
}

/**
 * Enforces fresh authentication (auth_time <= maxAgeSeconds, default 300s)
 * Required for 21 CFR Part 11 compliant electronic signatures.
 */
export function requireFreshSession(maxAgeSeconds = 300) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = req.correlationId || extractCorrelationId(req);
    const user = req.user;

    if (!user) {
      sendErrorResponse(
        res,
        'UNAUTHENTICATED',
        'Yêu cầu đăng nhập trước khi thực hiện thao tác.',
        401,
        correlationId
      );
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const sessionAge = nowSeconds - user.authTime;

    if (sessionAge > maxAgeSeconds) {
      sendErrorResponse(
        res,
        'AUTH_REQUIRED',
        'Phiên xác thực đã hết hạn cho chữ ký điện tử có độ tin cậy cao. Vui lòng nhập lại mật khẩu để xác thực tài khoản (Fresh Session Required).',
        401,
        correlationId
      );
      return;
    }

    next();
  };
}

/**
 * Enforces server-side RBAC
 */
export function requireRoles(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = req.correlationId || extractCorrelationId(req);
    const user = req.user;

    if (!user) {
      sendErrorResponse(res, 'UNAUTHENTICATED', 'Yêu cầu xác thực tài khoản.', 401, correlationId);
      return;
    }

    if (user.isAdmin || allowedRoles.includes(user.role)) {
      next();
      return;
    }

    sendErrorResponse(
      res,
      'PERMISSION_DENIED',
      `Từ chối quyền: Vai trò '${user.role}' không có thẩm quyền thực hiện thao tác này.`,
      403,
      correlationId
    );
  };
}
