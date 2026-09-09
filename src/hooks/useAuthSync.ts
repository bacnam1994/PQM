import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { clearEntireCache } from '../utils';
import { Role } from '../types';

export const useAuthSync = () => {
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser && import.meta.env.DEV && useAppStore.getState().user?.email === 'admin@example.com') {
        useAppStore.getState().setAuthLoading(false);
        return;
      }
      useAppStore.getState().setUser(currentUser);
      if (currentUser) {
        try {
          const timeout = (ms: number) => new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error("TIMEOUT")), ms)
          );
          
          const fetchRoleAndAdmin = async () => {
            const [adminSnap, userSnap] = await Promise.all([
              get(ref(db, `users/admins/${currentUser.uid}`)),
              get(ref(db, `users/${currentUser.uid}`))
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
          
          useAppStore.getState().setIsAdmin(isUserAdmin);
          useAppStore.getState().setRole(role);
        } catch (e) {
          console.warn("Đang thử kết nối lại để xác thực quyền hạn:", e);
          try {
            const [adminSnap, userSnap] = await Promise.all([
              get(ref(db, `users/admins/${currentUser.uid}`)),
              get(ref(db, `users/${currentUser.uid}`))
            ]);
            const isUserAdmin = adminSnap.exists() || userSnap.val()?.role === 'ADMIN';
            const rawRole = userSnap.val()?.role;
            const validRoles: Role[] = ['ADMIN', 'QA', 'QC', 'LAB', 'PRODUCTION', 'VIEWER', 'USER'];
            const role: Role = isUserAdmin ? 'ADMIN' : (rawRole && validRoles.includes(rawRole) ? rawRole : 'GUEST');
            useAppStore.getState().setIsAdmin(isUserAdmin);
            useAppStore.getState().setRole(role);
          } catch (retryErr) {
            console.error("Lỗi xác thực quyền hạn:", retryErr);
            useAppStore.getState().setIsAdmin(false);
            useAppStore.getState().setRole('GUEST');
          }
        }
      } else {
        useAppStore.getState().setIsAdmin(false);
        useAppStore.getState().setRole(null);
        
        // Tự động dọn dẹp sạch sẽ bộ nhớ cục bộ (IndexedDB) khi Đăng xuất
        clearEntireCache().catch(e => console.warn("Lỗi dọn dẹp cache khi đăng xuất:", e));
      }
      useAppStore.getState().setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
};
