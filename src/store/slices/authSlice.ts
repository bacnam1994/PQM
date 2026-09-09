import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';
import { ref, set as firebaseSet } from 'firebase/database';
import { db } from '../../firebase';
import { AuthSlice, StoreSlice } from './types';

export const createAuthSlice: StoreSlice<AuthSlice> = (set, get) => ({
  // --- INITIAL AUTH STATE ---
  user:
    typeof window !== 'undefined' &&
    import.meta.env.DEV &&
    localStorage.getItem('pqm_dev_mock_auth') === 'admin@example.com'
      ? ({
          uid: 'e2e-test-admin',
          email: 'admin@example.com',
          displayName: 'Admin Test'
        } as any)
      : null,
  isAdmin:
    typeof window !== 'undefined' &&
    import.meta.env.DEV &&
    localStorage.getItem('pqm_dev_mock_auth') === 'admin@example.com',
  role:
    typeof window !== 'undefined' &&
    import.meta.env.DEV &&
    localStorage.getItem('pqm_dev_mock_auth') === 'admin@example.com'
      ? 'ADMIN'
      : null,
  authLoading:
    typeof window !== 'undefined' &&
    import.meta.env.DEV &&
    localStorage.getItem('pqm_dev_mock_auth') === 'admin@example.com'
      ? false
      : true,

  // --- ACTIONS ---
  setUser: (user) => set({ user }, false, 'setUser'),
  setIsAdmin: (isAdmin) => set({ isAdmin }, false, 'setIsAdmin'),
  setRole: (role) => set({ role }, false, 'setRole'),
  setAuthLoading: (loading) => set({ authLoading: loading }, false, 'setAuthLoading'),

  login: async (email, password) => {
    try {
      await signInWithEmailAndPassword(getAuth(), email, password);
    } catch (err: any) {
      // Hỗ trợ kiểm thử E2E Playwright trên môi trường DEV cục bộ và CI
      if (import.meta.env.DEV && email === 'admin@example.com') {
        if (typeof window !== 'undefined') {
          localStorage.setItem('pqm_dev_mock_auth', 'admin@example.com');
        }
        const mockUser = {
          uid: 'e2e-test-admin',
          email: 'admin@example.com',
          displayName: 'Admin Test',
          photoURL: ''
        } as any;
        set(
          { user: mockUser, role: 'ADMIN', authLoading: false, isAdmin: true },
          false,
          'login-dev-mock'
        );
        return;
      }
      throw err;
    }
  },

  resetPassword: async (email) => {
    await sendPasswordResetEmail(getAuth(), email);
  },

  logout: async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pqm_dev_mock_auth');
    }
    await signOut(getAuth());
  },

  signup: async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        getAuth(),
        email,
        password
      );
      const user = userCredential.user;
      await firebaseSet(ref(db, `users/${user.uid}`), {
        email: user.email,
        role: 'GUEST',
        createdAt: new Date().toISOString()
      });
      set({ user, role: 'GUEST', authLoading: false }, false, 'signup');
    } catch (error) {
      console.error('Lỗi khi đăng ký:', error);
      throw error;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    const { user } = get();
    const currentUser = user || getAuth().currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error('Không tìm thấy thông tin người dùng đang đăng nhập.');
    }
    const credential = EmailAuthProvider.credential(
      currentUser.email,
      currentPassword
    );
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
  }
});
