import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getConsentStatus } from '../hooks/useCookieConsent';

const memoryStorage = new Map<string, string>();

const consentAwareStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null;
    if (getConsentStatus() === 'DECLINED') {
      return memoryStorage.get(name) || null;
    }
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return;
    if (getConsentStatus() === 'DECLINED') {
      memoryStorage.set(name, value);
      return;
    }
    localStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    if (getConsentStatus() === 'DECLINED') {
      memoryStorage.delete(name);
      return;
    }
    localStorage.removeItem(name);
  },
};


type ViewMode = 'grid' | 'list';

// Tên key mặc định (không có userId) — dùng khi chưa đăng nhập
const BASE_STORAGE_KEY = 'PQM_UI_Preferences';

/**
 * Tạo storage key theo userId để mỗi người dùng có preferences riêng biệt.
 * Khi chưa đăng nhập, dùng key chung.
 */
export function getUserStorageKey(userId?: string | null): string {
  return userId ? `PQM_UI_${userId}` : BASE_STORAGE_KEY;
}

interface UIState {
  // --- GLOBAL SETTINGS ---
  decimalSeparator: 'dot' | 'comma';
  dateFormat: string;

  // --- GOOGLE DRIVE STORAGE ---
  googleDriveFolderUrl: string;
  googleDriveFolderId: string;
  googleDriveClientId: string;
  googleDriveApiKey: string;
  useGoogleDriveUpload: boolean;

  // --- CÁ NHÂN HÓA THÓI QUEN ---
  /** Số dòng hiển thị mặc định trên mỗi trang danh sách */
  rowsPerPage: 10 | 20 | 50 | 100;
  /** Sidebar thu gọn hay mở rộng */
  sidebarCollapsed: boolean;
  /** Lịch sử tìm kiếm (tối đa 10 mục gần nhất) */
  searchHistory: string[];
  /** Trang cuối cùng người dùng truy cập */
  lastVisitedPath: string;
  /** Bộ lọc mặc định trang Lô hàng */
  defaultBatchFilter: 'ALL' | 'PENDING' | 'TESTING' | 'RELEASED' | 'REJECTED';
  /** Bộ lọc mặc định trang Kết quả kiểm nghiệm */
  defaultTestResultFilter: 'ALL' | 'PASS' | 'FAIL';
  /** Thứ tự widget Dashboard */
  dashboardWidgets: string[];

  // --- VIEW MODE ---
  productViewMode: ViewMode;
  tccsViewMode: ViewMode;
  formulaViewMode: ViewMode;
  materialViewMode: ViewMode;
  criteriaViewMode: ViewMode;
  batchViewMode: ViewMode;
  testResultViewMode: ViewMode;

  // --- FILTER & SORT: Product ---
  productSort: { key: string; direction: 'asc' | 'desc' };
  productFilterType: 'ALL' | 'SELF' | 'OUTSOURCE';
  productFilterStatus: 'ALL' | 'ACTIVE' | 'DISCONTINUED' | 'RECALLED';

  // --- FILTER & SORT: Batch ---
  batchFilterStatus: 'ALL' | 'PENDING' | 'TESTING' | 'RELEASED' | 'REJECTED';
  batchFilterYear: string;
  batchFilterMonth: string;
  batchFilterProductId: string;
  batchSortConfig: { key: 'createdAt' | 'mfgDate' | 'batchNo'; direction: 'asc' | 'desc' };

  // --- FILTER & SORT: TestResult ---
  testResultFilterYear: string;
  testResultFilterMonth: string;
  testResultFilterProductId: string;
  testResultSortConfig: { key: 'testDate' | 'batchNo'; direction: 'asc' | 'desc' };

  // --- ACTIONS ---
  setDecimalSeparator: (separator: 'dot' | 'comma') => void;
  setDateFormat: (format: string) => void;

  setGoogleDriveFolderUrl: (url: string) => void;
  setGoogleDriveClientId: (clientId: string) => void;
  setGoogleDriveApiKey: (apiKey: string) => void;
  setUseGoogleDriveUpload: (useUpload: boolean) => void;

  setRowsPerPage: (rows: 10 | 20 | 50 | 100) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  setLastVisitedPath: (path: string) => void;
  setDefaultBatchFilter: (filter: 'ALL' | 'PENDING' | 'TESTING' | 'RELEASED' | 'REJECTED') => void;
  setDefaultTestResultFilter: (filter: 'ALL' | 'PASS' | 'FAIL') => void;
  setDashboardWidgets: (widgets: string[]) => void;

  setProductViewMode: (mode: ViewMode) => void;
  setTccsViewMode: (mode: ViewMode) => void;
  setFormulaViewMode: (mode: ViewMode) => void;
  setMaterialViewMode: (mode: ViewMode) => void;
  setCriteriaViewMode: (mode: ViewMode) => void;
  setBatchViewMode: (mode: ViewMode) => void;
  setTestResultViewMode: (mode: ViewMode) => void;

  setProductSort: (sort: { key: string; direction: 'asc' | 'desc' }) => void;
  setProductFilterType: (type: 'ALL' | 'SELF' | 'OUTSOURCE') => void;
  setProductFilterStatus: (status: 'ALL' | 'ACTIVE' | 'DISCONTINUED' | 'RECALLED') => void;

  setBatchFilterStatus: (status: 'ALL' | 'PENDING' | 'TESTING' | 'RELEASED' | 'REJECTED') => void;
  setBatchFilterYear: (year: string) => void;
  setBatchFilterMonth: (month: string) => void;
  setBatchFilterProductId: (productId: string) => void;
  setBatchSortConfig: (sort: { key: 'createdAt' | 'mfgDate' | 'batchNo'; direction: 'asc' | 'desc' }) => void;

  setTestResultFilterYear: (year: string) => void;
  setTestResultFilterMonth: (month: string) => void;
  setTestResultFilterProductId: (productId: string) => void;
  setTestResultSortConfig: (sort: { key: 'testDate' | 'batchNo'; direction: 'asc' | 'desc' }) => void;

  /** Reset toàn bộ preferences về mặc định */
  resetPreferences: () => void;
}

const DEFAULT_STATE: Omit<UIState, 
  | 'setDecimalSeparator' | 'setDateFormat'
  | 'setRowsPerPage' | 'setSidebarCollapsed' | 'toggleSidebar'
  | 'addSearchHistory' | 'clearSearchHistory' | 'setLastVisitedPath'
  | 'setDefaultBatchFilter' | 'setDefaultTestResultFilter' | 'setDashboardWidgets'
  | 'setProductViewMode' | 'setTccsViewMode' | 'setFormulaViewMode'
  | 'setMaterialViewMode' | 'setCriteriaViewMode' | 'setBatchViewMode' | 'setTestResultViewMode'
  | 'setProductSort' | 'setProductFilterType' | 'setProductFilterStatus'
  | 'setBatchFilterStatus' | 'setBatchFilterYear' | 'setBatchFilterMonth' | 'setBatchFilterProductId' | 'setBatchSortConfig'
  | 'setTestResultFilterYear' | 'setTestResultFilterMonth' | 'setTestResultFilterProductId' | 'setTestResultSortConfig'
  | 'setGoogleDriveFolderUrl' | 'setGoogleDriveClientId' | 'setGoogleDriveApiKey' | 'setUseGoogleDriveUpload'
  | 'resetPreferences'
> = {
  // Google Drive
  googleDriveFolderUrl: 'https://drive.google.com/drive/folders/10tDp_k40fk8iuotqazP1BsROiN5jXzK-?usp=sharing',
  googleDriveFolderId: '10tDp_k40fk8iuotqazP1BsROiN5jXzK-',
  googleDriveClientId: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || '1012122917408-cghpfis2qisbu6fb37qk4gnceicqpc0o.apps.googleusercontent.com',
  googleDriveApiKey: '',
  useGoogleDriveUpload: false,
  // Format
  decimalSeparator: 'dot',
  dateFormat: 'DD/MM/YYYY',
  // Thói quen
  rowsPerPage: 20,
  sidebarCollapsed: false,
  searchHistory: [],
  lastVisitedPath: '/',
  defaultBatchFilter: 'ALL',
  defaultTestResultFilter: 'ALL',
  dashboardWidgets: ['summary', 'batches', 'testResults', 'products'],
  // View mode
  productViewMode: 'grid',
  tccsViewMode: 'grid',
  formulaViewMode: 'list',
  materialViewMode: 'grid',
  criteriaViewMode: 'list',
  batchViewMode: 'grid',
  testResultViewMode: 'grid',
  // Sort & filter: Product
  productSort: { key: 'createdAt', direction: 'desc' },
  productFilterType: 'ALL',
  productFilterStatus: 'ALL',
  // Sort & filter: Batch
  batchFilterStatus: 'ALL',
  batchFilterYear: 'ALL',
  batchFilterMonth: 'ALL',
  batchFilterProductId: '',
  batchSortConfig: { key: 'createdAt', direction: 'desc' },
  // Sort & filter: TestResult
  testResultFilterYear: 'ALL',
  testResultFilterMonth: 'ALL',
  testResultFilterProductId: '',
  testResultSortConfig: { key: 'testDate', direction: 'desc' },
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      // --- FORMAT ---
      setDecimalSeparator: (separator) => set({ decimalSeparator: separator }),
      setDateFormat: (format) => set({ dateFormat: format }),

      // --- GOOGLE DRIVE STORAGE ---
      setGoogleDriveFolderUrl: (url) => {
        let folderId = '';
        const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          folderId = match[1];
        } else {
          folderId = url.trim();
        }
        set({ googleDriveFolderUrl: url, googleDriveFolderId: folderId });
      },
      setGoogleDriveClientId: (clientId) => set({ googleDriveClientId: clientId }),
      setGoogleDriveApiKey: (apiKey) => set({ googleDriveApiKey: apiKey }),
      setUseGoogleDriveUpload: (useUpload) => set({ useGoogleDriveUpload: useUpload }),

      // --- CÁ NHÂN HÓA ---
      setRowsPerPage: (rows) => set({ rowsPerPage: rows }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      addSearchHistory: (query) => {
        if (!query.trim()) return;
        set((s) => {
          const trimmed = query.trim();
          // Loại bỏ mục trùng, đưa mục mới lên đầu, giữ tối đa 10
          const filtered = s.searchHistory.filter(
            (h) => h.toLowerCase() !== trimmed.toLowerCase()
          );
          return { searchHistory: [trimmed, ...filtered].slice(0, 10) };
        });
      },
      clearSearchHistory: () => set({ searchHistory: [] }),
      setLastVisitedPath: (path) => set({ lastVisitedPath: path }),
      setDefaultBatchFilter: (filter) => set({ defaultBatchFilter: filter }),
      setDefaultTestResultFilter: (filter) => set({ defaultTestResultFilter: filter }),
      setDashboardWidgets: (widgets) => set({ dashboardWidgets: widgets }),

      // --- VIEW MODE ---
      setProductViewMode: (mode) => set({ productViewMode: mode }),
      setTccsViewMode: (mode) => set({ tccsViewMode: mode }),
      setFormulaViewMode: (mode) => set({ formulaViewMode: mode }),
      setMaterialViewMode: (mode) => set({ materialViewMode: mode }),
      setCriteriaViewMode: (mode) => set({ criteriaViewMode: mode }),
      setBatchViewMode: (mode) => set({ batchViewMode: mode }),
      setTestResultViewMode: (mode) => set({ testResultViewMode: mode }),

      // --- FILTER & SORT: Product ---
      setProductSort: (sort) => set({ productSort: sort }),
      setProductFilterType: (type) => set({ productFilterType: type }),
      setProductFilterStatus: (status) => set({ productFilterStatus: status }),

      // --- FILTER & SORT: Batch ---
      setBatchFilterStatus: (status) => set({ batchFilterStatus: status }),
      setBatchFilterYear: (year) => set({ batchFilterYear: year }),
      setBatchFilterMonth: (month) => set({ batchFilterMonth: month }),
      setBatchFilterProductId: (productId) => set({ batchFilterProductId: productId }),
      setBatchSortConfig: (sort) => set({ batchSortConfig: sort }),

      // --- FILTER & SORT: TestResult ---
      setTestResultFilterYear: (year) => set({ testResultFilterYear: year }),
      setTestResultFilterMonth: (month) => set({ testResultFilterMonth: month }),
      setTestResultFilterProductId: (productId) => set({ testResultFilterProductId: productId }),
      setTestResultSortConfig: (sort) => set({ testResultSortConfig: sort }),

      // --- RESET ---
      resetPreferences: () => set({ ...DEFAULT_STATE }),
    }),
    {
      name: BASE_STORAGE_KEY,
      storage: createJSONStorage(() => consentAwareStorage),
      merge: (persistedState: any, currentState: UIState) => {
        const merged = { ...currentState, ...(persistedState as any) };
        if (persistedState && !persistedState.googleDriveClientId) {
          merged.googleDriveClientId = currentState.googleDriveClientId;
        }
        return merged;
      },
    }
  )
);

/**
 * Chuyển storage key sang per-user key sau khi đăng nhập.
 * Gọi hàm này khi user đăng nhập thành công.
 * Nó migrate dữ liệu từ key chung sang key của user.
 */
export function migrateToUserKey(userId: string): void {
  if (!userId) return;
  const userKey = getUserStorageKey(userId);

  // Nếu đã có data riêng của user, không cần migrate
  if (localStorage.getItem(userKey)) return;

  // Nếu có data từ key chung, copy sang key user
  const sharedData = localStorage.getItem(BASE_STORAGE_KEY);
  if (sharedData) {
    localStorage.setItem(userKey, sharedData);
  }
}

/**
 * Tải preferences của một user cụ thể vào store.
 * Gọi sau khi đăng nhập.
 */
export function loadUserPreferences(userId: string): void {
  if (!userId) return;
  const userKey = getUserStorageKey(userId);
  migrateToUserKey(userId);

  try {
    const raw = localStorage.getItem(userKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      const state = parsed?.state;
      if (state && typeof state === 'object') {
        const updatedState = { ...state };
        if (!updatedState.googleDriveClientId) {
          updatedState.googleDriveClientId = useUIStore.getState().googleDriveClientId || DEFAULT_STATE.googleDriveClientId;
        }
        useUIStore.setState((current) => ({ ...current, ...updatedState }));
      }
    }
    // Đổi storage name để persist ghi vào đúng key của user
    // (Cần rehydrate lại sau khi login)
    (useUIStore.persist as any).setOptions({ name: userKey });
    useUIStore.persist.rehydrate?.();
  } catch (e) {
    console.warn('Không thể tải preferences của user:', e);
  }
}

/**
 * Reset storage về key chung khi logout.
 */
export function resetToSharedKey(): void {
  (useUIStore.persist as any).setOptions({ name: BASE_STORAGE_KEY });
}