import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './useAppStore';

// Mock Firebase Realtime Database
vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn(() => ({})),
  set: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  get: vi.fn(() => Promise.resolve({ exists: () => false, val: () => null })),
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  signInWithEmailAndPassword: vi.fn(() => Promise.resolve({ user: { uid: 'u1', email: 'test@example.com' } })),
  signOut: vi.fn(() => Promise.resolve()),
  createUserWithEmailAndPassword: vi.fn(() => Promise.resolve({ user: { uid: 'u2', email: 'new@example.com' } })),
  updatePassword: vi.fn(() => Promise.resolve()),
  reauthenticateWithCredential: vi.fn(() => Promise.resolve()),
  EmailAuthProvider: { credential: vi.fn() },
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
}));

describe('useAppStore — Modular Slices Architecture', () => {
  beforeEach(() => {
    // Reset state cơ bản trước mỗi test case
    useAppStore.setState({
      products: [],
      batches: [],
      tccsList: [],
      productFormulas: [],
      rawMaterials: [],
      testResults: [],
      allTestResults: [],
      toasts: [],
      syncStatus: 'IDLE',
      user: null,
      isAdmin: false,
      role: null,
    });
  });

  describe('System Slice', () => {
    it('quản lý SyncStatus và Theme chính xác', () => {
      const store = useAppStore.getState();
      expect(store.syncStatus).toBe('IDLE');

      store.setSyncStatus('SAVING');
      expect(useAppStore.getState().syncStatus).toBe('SAVING');

      store.setTheme('dark');
      expect(useAppStore.getState().theme).toBe('dark');
    });

    it('thêm và xóa Toast notifications', () => {
      const store = useAppStore.getState();
      store.notify({ type: 'SUCCESS', message: 'Thao tác thành công' });

      const toasts = useAppStore.getState().toasts;
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Thao tác thành công');

      store.removeToast(toasts[0].id);
      expect(useAppStore.getState().toasts.length).toBe(0);
    });
  });

  describe('Auth Slice', () => {
    it('cập nhật user, role và isAdmin', () => {
      const store = useAppStore.getState();
      expect(store.user).toBeNull();
      expect(store.isAdmin).toBe(false);

      store.setUser({ uid: 'admin-1', email: 'admin@pqm.com' } as any);
      store.setRole('ADMIN');
      store.setIsAdmin(true);

      const updated = useAppStore.getState();
      expect(updated.user?.email).toBe('admin@pqm.com');
      expect(updated.role).toBe('ADMIN');
      expect(updated.isAdmin).toBe(true);
    });

    it('hỗ trợ mock login cho môi trường kiểm thử E2E với email admin@example.com', async () => {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(new Error('Firebase auth network error'));

      const store = useAppStore.getState();
      await store.login('admin@example.com', 'password123');

      const updated = useAppStore.getState();
      expect(updated.user?.email).toBe('admin@example.com');
      expect(updated.role).toBe('ADMIN');
      expect(updated.isAdmin).toBe(true);
    });
  });

  describe('TestResult Slice', () => {
    it('loadMoreTestResults tăng giới hạn hiển thị theo bước 50', () => {
      const initialLimit = useAppStore.getState().testResultLimit;
      useAppStore.getState().loadMoreTestResults();
      expect(useAppStore.getState().testResultLimit).toBe(initialLimit + 50);
    });

    it('mergeTestResults gộp dữ liệu và sắp xếp theo ngày kiểm nghiệm giảm dần', () => {
      const r1 = { id: 'r1', batchId: 'b1', testDate: '2026-03-01', criteriaResults: {} } as any;
      const r2 = { id: 'r2', batchId: 'b2', testDate: '2026-03-05', criteriaResults: {} } as any;

      useAppStore.getState().mergeTestResults([r1, r2]);
      const results = useAppStore.getState().testResults;

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('r2'); // Ngày 05/03 đứng trước 01/03
      expect(results[1].id).toBe('r1');
    });
  });

  describe('Product & Batch State Interaction', () => {
    it('setAppState cập nhật đồng loạt các tập dữ liệu từ Firebase', () => {
      useAppStore.getState().setAppState({
        products: [{ id: 'p1', code: 'P01', name: 'Product 1' } as any],
        batches: [{ id: 'b1', batchNo: 'B01', productId: 'p1' } as any]
      });

      const state = useAppStore.getState();
      expect(state.products.length).toBe(1);
      expect(state.batches.length).toBe(1);
      expect(state.products[0].code).toBe('P01');
      expect(state.batches[0].batchNo).toBe('B01');
    });
  });
});
