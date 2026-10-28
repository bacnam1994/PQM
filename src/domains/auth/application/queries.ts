/**
 * AUTH DOMAIN: QUERIES (VS-16)
 * ============================
 * Cung cấp điểm truy vấn đồng nhất cho Authentication.
 */

import { auth } from '../../../firebase';
import { AuthUser } from '../domain/types';

export class AuthQueries {
  static getCurrentUser(): AuthUser | null {
    const user = auth.currentUser;
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: 'GUEST',
    };
  }

  static isAuthenticated(): boolean {
    return auth.currentUser !== null;
  }
}
