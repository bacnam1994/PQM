import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { clearEntireCache } from '../utils';
import { Role } from '../types';

const AUTH_ROLE_CACHE_KEY = 'pqm_auth_role_cache_v1';

interface CachedAuthRole {
  uid: string;
  role: Role;
  isAdmin: boolean;
  cachedAt: number;
}

function readCachedAuthRole(uid: string): CachedAuthRole | null {
  try {
    const raw = localStorage.getItem(AUTH_ROLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAuthRole;
    if (parsed && parsed.uid === uid && parsed.role && parsed.role !== 'GUEST') {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedAuthRole(uid: string, role: Role, isAdmin: boolean): void {
  try {
    const payload: CachedAuthRole = { uid, role, isAdmin, cachedAt: Date.now() };
    localStorage.setItem(AUTH_ROLE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function clearCachedAuthRole(): void {
  try {
    localStorage.removeItem(AUTH_ROLE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export const useAuthSync = () => {
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (
        !currentUser &&
        (import.meta.env.DEV || import.meta.env.VITE_E2E === 'true') &&
        useAppStore.getState().user?.email === 'admin@example.com'
      ) {
        useAppStore.getState().setAuthLoading(false);
        return;
      }

      if (currentUser) {
        // 1. ZERO-RTT INSTANT BOOT (Stale-While-Revalidate):
        // Nếu đã có cache role hợp lệ của đúng uid trong localStorage, mở khóa App Shell ngay lập tức (~15ms)
        // không bắt người dùng chờ 1-3 giây kết nối WebSocket Firebase RTDB.
        const cachedRole = readCachedAuthRole(currentUser.uid);
        if (cachedRole) {
          const store = useAppStore.getState();
          store.setIsAdmin(cachedRole.isAdmin);
          store.setRole(cachedRole.role);
          store.setUser({
            ...currentUser,
            role: cachedRole.role,
            isAdmin: cachedRole.isAdmin,
          } as any);
          store.setAuthLoading(false);
        } else {
          useAppStore.getState().setUser(currentUser);
        }

        // 2. Xác thực và làm mới quyền hạn thực tế từ Firebase RTDB (Background Revalidation)
        try {
          const timeout = (ms: number) =>
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms));

          const fetchRoleAndAdmin = async () => {
            const [adminSnap, userSnap] = await Promise.all([
              get(ref(db, `users/admins/${currentUser.uid}`)),
              get(ref(db, `users/${currentUser.uid}`)),
            ]);

            const isListedInAdmins = adminSnap.exists();
            const userData = userSnap.exists() ? userSnap.val() : null;
            const userRole = userData?.role;

            const isUserAdmin = isListedInAdmins || userRole === 'ADMIN';
            const validRoles: Role[] = ['ADMIN', 'QA', 'QC', 'LAB', 'PRODUCTION', 'VIEWER', 'USER'];
            let role: Role = 'GUEST';

            if (isUserAdmin) {
              role = 'ADMIN';
            } else if (userRole && validRoles.includes(userRole)) {
              role = userRole;
            } else {
              role = 'GUEST';
            }

            return { isUserAdmin, role };
          };

          const { isUserAdmin, role } = await Promise.race([fetchRoleAndAdmin(), timeout(8000)]);

          writeCachedAuthRole(currentUser.uid, role, isUserAdmin);
          const store = useAppStore.getState();
          store.setIsAdmin(isUserAdmin);
          store.setRole(role);
          store.setUser({
            ...currentUser,
            role,
            isAdmin: isUserAdmin,
          } as any);
        } catch (e) {
          // Nếu đã mở khóa từ cache hợp lệ thì giữ nguyên phiên làm việc ngoại tuyến/mạng chậm
          if (!cachedRole) {
            console.warn('Đang thử kết nối lại để xác thực quyền hạn:', e);
            try {
              const [adminSnap, userSnap] = await Promise.all([
                get(ref(db, `users/admins/${currentUser.uid}`)),
                get(ref(db, `users/${currentUser.uid}`)),
              ]);
              const isUserAdmin = adminSnap.exists() || userSnap.val()?.role === 'ADMIN';
              const rawRole = userSnap.val()?.role;
              const validRoles: Role[] = [
                'ADMIN',
                'QA',
                'QC',
                'LAB',
                'PRODUCTION',
                'VIEWER',
                'USER',
              ];
              const role: Role = isUserAdmin
                ? 'ADMIN'
                : rawRole && validRoles.includes(rawRole)
                  ? rawRole
                  : 'GUEST';
              writeCachedAuthRole(currentUser.uid, role, isUserAdmin);
              useAppStore.getState().setIsAdmin(isUserAdmin);
              useAppStore.getState().setRole(role);
              useAppStore.getState().setUser({
                ...currentUser,
                role,
                isAdmin: isUserAdmin,
              } as any);
            } catch (retryErr) {
              console.error('Lỗi xác thực quyền hạn:', retryErr);
              useAppStore.getState().setIsAdmin(false);
              useAppStore.getState().setRole('GUEST');
              useAppStore.getState().setUser({
                ...currentUser,
                role: 'GUEST',
                isAdmin: false,
              } as any);
            }
          }
        }
      } else {
        clearCachedAuthRole();
        useAppStore.getState().setUser(null);
        useAppStore.getState().setIsAdmin(false);
        useAppStore.getState().setRole(null);

        // Tự động dọn dẹp sạch sẽ bộ nhớ cục bộ (IndexedDB) khi Đăng xuất
        clearEntireCache().catch((e) => console.warn('Lỗi dọn dẹp cache khi đăng xuất:', e));
      }
      useAppStore.getState().setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
};
