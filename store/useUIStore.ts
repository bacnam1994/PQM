import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'grid' | 'list';

interface UIState {
  // --- GLOBAL SETTINGS ---
  decimalSeparator: 'dot' | 'comma';
  dateFormat: string;

  // Trạng thái View Mode của các trang
  productViewMode: ViewMode;
  tccsViewMode: ViewMode;
  formulaViewMode: ViewMode;
  materialViewMode: ViewMode;
  criteriaViewMode: ViewMode;
  batchViewMode: ViewMode;
  testResultViewMode: ViewMode;
  
  // Trạng thái Filter/Sort (Ví dụ trang Product)
  productSort: { key: string; direction: 'asc' | 'desc' };
  productFilterType: 'ALL' | 'SELF' | 'OUTSOURCE';
  
  // Actions
  setDecimalSeparator: (separator: 'dot' | 'comma') => void;
  setDateFormat: (format: string) => void;
  
  setProductViewMode: (mode: ViewMode) => void;
  setTccsViewMode: (mode: ViewMode) => void;
  setFormulaViewMode: (mode: ViewMode) => void;
  setMaterialViewMode: (mode: ViewMode) => void;
  setCriteriaViewMode: (mode: ViewMode) => void;
  setBatchViewMode: (mode: ViewMode) => void;
  setTestResultViewMode: (mode: ViewMode) => void;

  setProductSort: (sort: { key: string; direction: 'asc' | 'desc' }) => void;
  setProductFilterType: (type: 'ALL' | 'SELF' | 'OUTSOURCE') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // --- GIÁ TRỊ MẶC ĐỊNH ---
      decimalSeparator: 'dot',
      dateFormat: 'DD/MM/YYYY',

      productViewMode: 'grid',
      tccsViewMode: 'grid',
      formulaViewMode: 'list',
      materialViewMode: 'grid',
      criteriaViewMode: 'list',
      batchViewMode: 'grid',
      testResultViewMode: 'grid',
      
      productSort: { key: 'createdAt', direction: 'desc' },
      productFilterType: 'ALL',

      // --- HÀM CẬP NHẬT STATE ---
      setDecimalSeparator: (separator) => set({ decimalSeparator: separator }),
      setDateFormat: (format) => set({ dateFormat: format }),

      setProductViewMode: (mode) => set({ productViewMode: mode }),
      setTccsViewMode: (mode) => set({ tccsViewMode: mode }),
      setFormulaViewMode: (mode) => set({ formulaViewMode: mode }),
      setMaterialViewMode: (mode) => set({ materialViewMode: mode }),
      setCriteriaViewMode: (mode) => set({ criteriaViewMode: mode }),
      setBatchViewMode: (mode) => set({ batchViewMode: mode }),
      setTestResultViewMode: (mode) => set({ testResultViewMode: mode }),

      setProductSort: (sort) => set({ productSort: sort }),
      setProductFilterType: (type) => set({ productFilterType: type }),
    }),
    {
      name: 'PQM_UI_Preferences', // Tên key sẽ lưu trong localStorage
      // partialize: (state) => ({ ... }) // Nếu bạn chỉ muốn lưu một vài state cụ thể, dùng partialize
    }
  )
);