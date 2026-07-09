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
            
            const isUserAdmin = adminSnap.exists();
            let role: 'ADMIN' | 'USER' | 'GUEST' = 'GUEST';
            
            if (isUserAdmin) {
              role = 'ADMIN';
            } else if (userSnap.exists()) {
              const userData = userSnap.val();
              role = userData?.role || 'GUEST';
            }
            
            return { isUserAdmin, role };
          };

          const { isUserAdmin, role } = await Promise.race([fetchRoleAndAdmin(), timeout(2500)]);
          
          useAppStore.getState().setIsAdmin(isUserAdmin);
          useAppStore.getState().setRole(role);
        } catch (e) {
          console.error("Lỗi kiểm tra quyền hạn hoặc Hết thời gian kết nối:", e);
          useAppStore.getState().setIsAdmin(false);
          useAppStore.getState().setRole('GUEST');
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
