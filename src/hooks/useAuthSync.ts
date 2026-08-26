import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { clearEntireCache } from '../utils';

export const useAuthSync = () => {
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
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
            let role: 'ADMIN' | 'USER' | 'GUEST' = 'GUEST';
            
            if (isUserAdmin) {
              role = 'ADMIN';
            } else if (userRole === 'USER') {
              role = 'USER';
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
            const role: 'ADMIN' | 'USER' | 'GUEST' = isUserAdmin ? 'ADMIN' : (userSnap.val()?.role || 'GUEST');
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
