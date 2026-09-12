import { StateCreator } from 'zustand';
import { User } from 'firebase/auth';
import {
  AppState,
  SyncStatus,
  Product,
  Batch,
  TCCS,
  TestResult,
  ProductFormula,
  RawMaterial,
  AILearnedMapping,
  CriteriaAlias,
  Role,
  ElectronicSignature,
  QualityAnomaly
} from '../../types';

export type ToastType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

export type AuthUser = User & {
  role?: Role | null;
  isAdmin?: boolean;
};

// 1. AUTH SLICE
export interface AuthSliceState {
  user: AuthUser | null;
  isAdmin: boolean;
  role: Role | null;
  authLoading: boolean;
}

export interface AuthSliceActions {
  setUser: (user: AuthUser | any | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setRole: (role: Role | null) => void;
  setAuthLoading: (loading: boolean) => void;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export type AuthSlice = AuthSliceState & AuthSliceActions;

// 2. SYSTEM SLICE
export interface SystemSliceState {
  syncStatus: SyncStatus;
  toasts: ToastMessage[];
  theme: 'light' | 'dark';
  lastSync: string | null;
  qualityAlerts: QualityAnomaly[];
  navigate: (path: string, options?: any) => void;
}

export interface SystemSliceActions {
  setAppState: (partialState: Partial<AppState>) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  notify: (msg: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  resetToDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  loadBackup: (data: AppState) => Promise<void>;
  syncQualityAlerts: () => Promise<void>;
}

export type SystemSlice = SystemSliceState & SystemSliceActions;

// 3. PRODUCT SLICE
export interface ProductSliceState {
  products: Product[];
  productFormulas: ProductFormula[];
  rawMaterials: RawMaterial[];
}

export interface ProductSliceActions {
  addProduct: (p: Product) => Promise<void>;
  updateProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkAddProducts: (products: Product[]) => Promise<void>;

  addProductFormula: (f: ProductFormula) => Promise<void>;
  updateProductFormula: (f: ProductFormula) => Promise<void>;
  deleteProductFormula: (id: string) => Promise<void>;

  addRawMaterial: (rm: RawMaterial) => Promise<void>;
  updateRawMaterial: (rm: RawMaterial) => Promise<void>;
  deleteRawMaterial: (id: string) => Promise<void>;
}

export type ProductSlice = ProductSliceState & ProductSliceActions;

// 4. BATCH SLICE
export interface BatchSliceState {
  batches: Batch[];
}

export interface BatchSliceActions {
  addBatch: (b: Batch) => Promise<void>;
  updateBatch: (b: Batch) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  updateBatchStatus: (id: string, status: string, rejectReason?: string, signature?: ElectronicSignature) => Promise<void>;
  updateBatchProgress: (id: string, progressPercent: number) => Promise<void>;
}

export type BatchSlice = BatchSliceState & BatchSliceActions;

// 5. TEST RESULT SLICE
export interface TestResultSliceState {
  testResults: TestResult[];
  allTestResults?: TestResult[];
  testResultLimit: number;
}

export interface TestResultSliceActions {
  addTestResult: (r: TestResult) => Promise<void>;
  updateTestResult: (r: TestResult) => Promise<void>;
  deleteTestResult: (id: string) => Promise<void>;
  loadMoreTestResults: () => void;
  mergeTestResults: (list: TestResult[]) => void;
  fetchAllTestResultsForDashboard: () => Promise<void>;
}

export type TestResultSlice = TestResultSliceState & TestResultSliceActions;

// 6. TCCS SLICE
export interface TCCSSliceState {
  tccsList: TCCS[];
  criteriaAliases: CriteriaAlias[];
  aiLearnedMappings: AILearnedMapping[];
}

export interface TCCSSliceActions {
  addTCCS: (t: TCCS) => Promise<void>;
  updateTCCS: (t: TCCS) => Promise<void>;
  deleteTCCS: (id: string) => Promise<void>;

  addAiLearnedMapping: (originalName: string, systemName: string) => Promise<void>;

  addCriteriaAlias: (alias: CriteriaAlias) => Promise<void>;
  updateCriteriaAlias: (alias: CriteriaAlias) => Promise<void>;
  deleteCriteriaAlias: (id: string) => Promise<void>;
  confirmCriteriaAlias: (id: string) => Promise<void>;
  addAliasToExisting: (aliasId: string, newAlias: string) => Promise<void>;
}

export type TCCSSlice = TCCSSliceState & TCCSSliceActions;

// ROOT STORE STATE & ACTIONS (Tương thích 100% với useAppStore cũ)
export type AppStoreState = AuthSliceState &
  SystemSliceState &
  ProductSliceState &
  BatchSliceState &
  TestResultSliceState &
  TCCSSliceState;

export type AppStoreActions = AuthSliceActions &
  SystemSliceActions &
  ProductSliceActions &
  BatchSliceActions &
  TestResultSliceActions &
  TCCSSliceActions;

export type AppStore = AppStoreState & AppStoreActions;

export type StoreSlice<T> = StateCreator<
  AppStore,
  [['zustand/devtools', never]],
  [],
  T
>;
