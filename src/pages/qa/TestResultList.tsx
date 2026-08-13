
import React, { useState, useMemo, useCallback, memo, useEffect, lazy, Suspense } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  Plus, Search, ClipboardCheck, CheckCircle2, AlertCircle, Trash2,
  Calendar, Beaker, X, FileText,
  History, ListPlus, FlaskConical, Printer, Eye, Edit2, Loader2,
  Package, Hash, Clock, Filter, ShieldCheck, LayoutGrid, List, ArrowUpDown, FileSearch, RefreshCcw
} from 'lucide-react';
import { TestResult, TestResultEntry } from '../../types';
import { TEST_RESULT_STATUS, BATCH_STATUS, ensureArray, formatDateStandard, normalizeSearch } from '../../utils';
const CoAReport = lazy(() => import('../../components/features/CoAReport'));
import { PageHeader, DSFilterBar, DSSearchInput, DSSelect, DSCard, DSViewToggle, DSTable, ActionButtons, DeleteModal, AddButton, DSEmptyState, Pagination } from '../../components';
import { useDataGraph, HydratedTestResult, useDebounce } from '../../hooks';
import { useTestResultList } from '../../hooks/test-results/useTestResultList';
import { useUIStore } from '../../store/useUIStore';


interface ExtraTestResultEntry extends TestResultEntry {
  limit?: string;
}

// --- SUB-COMPONENT: Grid Item (Memoized) ---
const TestResultGridItem = memo(({ res, onEdit, onDelete, onPrint, isAdmin }: { 
  res: HydratedTestResult, 
  onEdit: (res: HydratedTestResult) => void, 
  onDelete: (res: HydratedTestResult) => void, 
  onPrint: (res: HydratedTestResult) => void,
  isAdmin: boolean
}) => {
  return (
    <DSCard className="p-5 flex flex-col gap-5 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.08)] transition-all duration-500 group relative overflow-hidden h-full bg-gradient-to-br from-cyan-50/80 via-white to-blue-50/80 dark:from-cyan-950/20 dark:via-slate-800 dark:to-blue-950/20 dark:border-slate-700/50">
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-40 blur-2xl transition-transform group-hover:scale-150 duration-700 -mr-10 -mt-10 ${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'bg-emerald-400/30' : 'bg-red-400/30'}`} />

      {/* Header: Eyebrow and Status */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 truncate pr-2" title={res.product?.name}>
          <ClipboardCheck size={14} className="text-cyan-500 shrink-0" />
          <span className="truncate">{res.product?.name || 'Sản phẩm'}</span>
        </div>
        <span className={`shrink-0 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'}`}>
          {res.overallStatus}
        </span>
      </div>

      {/* Glass Box Highlighting Main Content */}
      <div className={`bg-gradient-to-br from-white/60 to-white/30 dark:from-slate-900/60 dark:to-slate-900/30 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-sm rounded-2xl p-4 flex flex-col gap-4 relative z-10 mt-2 flex-grow ${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'shadow-[0_4px_20px_-5px_rgba(16,185,129,0.1)] dark:shadow-[0_4px_20px_-5px_rgba(16,185,129,0.05)]' : 'shadow-[0_4px_20px_-5px_rgba(239,68,68,0.1)]'}`}>
        {/* Main Info */}
        <div className="flex items-center gap-4 cursor-pointer group/link" onClick={() => onPrint(res)}>
          <div className={`bg-gradient-to-br p-3.5 rounded-xl shrink-0 border shadow-inner ${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' : 'from-red-50 to-red-100/50 dark:from-red-950/50 dark:to-red-900/20 text-red-650 dark:text-red-400 border-red-100 dark:border-red-900/30'}`}>
            {res.overallStatus === TEST_RESULT_STATUS.PASS ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          </div>
          <div className="flex flex-col">
            <h3 className={`font-black text-slate-800 dark:text-slate-100 text-base leading-tight transition-colors line-clamp-1 group-hover/link:${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{res.batch?.batchNo}</h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Phiếu số: {res.id.slice(-6)}</p>
          </div>
        </div>

        {/* Meta Info */}
        <div className="space-y-1.5 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 mt-auto">
            <div className="flex justify-between items-start gap-2 text-[11px] font-bold">
              <span className="text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap shrink-0">Ngày xuất phiếu:</span>
              <span className="text-slate-700 dark:text-slate-300 text-right">{formatDateStandard(res.testDate)}</span>
            </div>
            <div className="flex justify-between items-start gap-2 text-[11px] font-bold">
              <span className="text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap shrink-0">Phòng Lab:</span>
              <span className="text-cyan-600 dark:text-cyan-400 text-right break-words">{res.labName}</span>
            </div>
        </div>
      </div>

      {/* Footer: Actions */}
      <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-200/50 dark:border-slate-700/50 relative z-10">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <ActionButtons 
            onEdit={isAdmin ? () => onEdit(res) : undefined}
            onDelete={isAdmin ? () => onDelete(res) : undefined}
          />
        </div>
        <button onClick={() => onPrint(res)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] bg-slate-50/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 hover:text-cyan-700 dark:hover:text-cyan-400 transition-all ml-auto border border-slate-200/50 dark:border-slate-700">
          Xem phiếu <Printer size={14} className="opacity-0 group-hover:opacity-100 hidden" />
        </button>
      </div>
    </DSCard>
  );
});

// --- SUB-COMPONENT: List Item (Memoized) ---
const TestResultListItem = memo(({ res, onEdit, onDelete, onPrint, isAdmin }: { 
  res: HydratedTestResult, 
  onEdit: (res: HydratedTestResult) => void, 
  onDelete: (res: HydratedTestResult) => void, 
  onPrint: (res: HydratedTestResult) => void,
  isAdmin: boolean
}) => {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">{formatDateStandard(res.testDate)}</td>
      <td className="px-4 py-3 font-black text-slate-800 dark:text-slate-200">{res.batch?.batchNo}</td>
      <td className="px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400">{res.product?.name}</td>
      <td className="px-4 py-3 text-xs text-indigo-600 dark:text-indigo-400 font-bold">{res.labName}</td>
      <td className="px-4 py-3 text-center">
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'}`}>
          {res.overallStatus}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <ActionButtons 
            onView={() => onPrint(res)}
            onEdit={isAdmin ? () => onEdit(res) : undefined}
            onDelete={isAdmin ? () => onDelete(res) : undefined}
          />
        </div>
      </td>
    </tr>
  );
});

const TestResultDataList = ({ viewMode, data, onEdit, onDelete, onPrint, isAdmin, isLoading }: any) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <Loader2 className="animate-spin text-cyan-600 dark:text-cyan-400" size={32} />
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Đang tải dữ liệu kết quả kiểm nghiệm...</p>
      </div>
    );
  }

  if (data.length === 0) {
     return <DSEmptyState icon={FileSearch} title="Không có phiếu kiểm nghiệm" message="Hệ thống chưa ghi nhận kết quả kiểm nghiệm nào khớp với thông tin tìm kiếm." />;
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 no-print">
        {data.map((res: any) => (
          <TestResultGridItem key={res.id} res={res} onEdit={onEdit} onDelete={onDelete} onPrint={onPrint} isAdmin={isAdmin} />
        ))}
      </div>
    );
  }
  return (
    <DSTable>
      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
        <tr className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Ngày xuất phiếu</th>
          <th className="px-4 py-3">Lô hàng</th>
          <th className="px-4 py-3">Sản phẩm</th>
          <th className="px-4 py-3">Phòng Lab</th>
          <th className="px-4 py-3 text-center">Kết quả</th>
          <th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
        {data.map((res: any) => (
          <TestResultListItem key={res.id} res={res} onEdit={onEdit} onDelete={onDelete} onPrint={onPrint} isAdmin={isAdmin} />
        ))}
      </tbody>
    </DSTable>
  );
};

const TestResultList: React.FC = () => {
  const products = useAppStore(state => state.products);
  const isAdmin = useAppStore(state => state.isAdmin);
  const notify = useAppStore(state => state.notify);
  const productFormulas = useAppStore(state => state.productFormulas);
  const loadMoreTestResults = useAppStore(state => state.loadMoreTestResults);
  const testResultLimit = useAppStore(state => state.testResultLimit);
  const fetchAllTestResultsForDashboard = useAppStore(state => state.fetchAllTestResultsForDashboard);
  const syncStatus = useAppStore(state => state.syncStatus);
  const { testResults: hydratedResults, allTestResultsHydrated, batches: hydratedBatches } = useDataGraph();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const viewMode = useUIStore(s => s.testResultViewMode);
  const setViewMode = useUIStore(s => s.setTestResultViewMode);
  // --- FILTER & SORT (persisted via UIStore / localStorage) ---
  const filterYear = useUIStore(s => s.testResultFilterYear);
  const filterMonth = useUIStore(s => s.testResultFilterMonth);
  const filterProductId = useUIStore(s => s.testResultFilterProductId);
  const sortConfig = useUIStore(s => s.testResultSortConfig);

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;

  // Reset phân trang về đầu khi đổi filter để tránh hành vi không nhất quán
  const handleSetFilterProductId = (v: string) => { useUIStore.getState().setTestResultFilterProductId(v); useAppStore.setState({ testResultLimit: 50 }); };
  const handleSetFilterMonth = (v: string) => { useUIStore.getState().setTestResultFilterMonth(v); useAppStore.setState({ testResultLimit: 50 }); };
  const handleSetFilterYear = (v: string) => { useUIStore.getState().setTestResultFilterYear(v); useAppStore.setState({ testResultLimit: 50 }); };

  // --- USE CUSTOM HOOK ---
  const {
    crud,
    handleEditResult,
    handleDeleteClick,
    handleConfirmDelete,
    handlePrint,
    handleOpenAdd,
  } = useTestResultList();

  // Reset trang hiện tại khi thay đổi tìm kiếm, bộ lọc hoặc chế độ hiển thị
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterProductId, filterMonth, filterYear, sortConfig, viewMode]);

  // Giải quyết "Hố đen tìm kiếm": Tải toàn bộ dữ liệu (Index) một lần duy nhất khi người dùng bắt đầu tìm kiếm
  useEffect(() => {
    if (debouncedSearchTerm.length >= 2 && allTestResultsHydrated.length === 0) {
      fetchAllTestResultsForDashboard();
    }
  }, [debouncedSearchTerm, allTestResultsHydrated.length, fetchAllTestResultsForDashboard]);

  const filteredResults = useMemo(() => {
    // Nếu đang search và đã có full data thì dùng full data, ngược lại dùng data giới hạn mặc định
    const sourceData = (debouncedSearchTerm.length >= 2 && allTestResultsHydrated.length > 0) ? allTestResultsHydrated : hydratedResults;
    const searchNormalized = normalizeSearch(debouncedSearchTerm);
    
    return sourceData.filter(r => {
      const matchesSearch = !searchNormalized || normalizeSearch(r.batch?.batchNo).includes(searchNormalized) || normalizeSearch(r.product?.name).includes(searchNormalized);
      const matchesProduct = filterProductId === '' || r.batch?.productId === filterProductId;
      
      // TỐI ƯU CPU: Lọc Năm/Tháng bằng xử lý chuỗi (String manipulation) cực nhanh
      // Tránh khởi tạo new Date() trong vòng lặp lớn
      let matchesYear = true;
      let matchesMonth = true;
      
      if (filterYear !== 'ALL' || filterMonth !== 'ALL') {
        if (!r.testDate) return false;
        if (filterYear !== 'ALL' && r.testDate.substring(0, 4) !== filterYear) matchesYear = false;
        if (filterMonth !== 'ALL') {
           const month = parseInt(r.testDate.substring(5, 7), 10).toString();
           if (month !== filterMonth) matchesMonth = false;
        }
      }

      return matchesSearch && matchesProduct && matchesYear && matchesMonth;
    }).sort((a, b) => {
      if (sortConfig.key === 'batchNo') {
        const batchA = a.batch?.batchNo || '';
        const batchB = b.batch?.batchNo || '';
        return sortConfig.direction === 'asc' ? batchA.localeCompare(batchB) : batchB.localeCompare(batchA);
      }
      // TỐI ƯU CPU: So sánh chuỗi ISO Date trực tiếp bằng localeCompare thay vì new Date().getTime()
      const dateA = a.testDate || '';
      const dateB = b.testDate || '';
      return sortConfig.direction === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });
  }, [hydratedResults, allTestResultsHydrated, debouncedSearchTerm, filterProductId, filterMonth, filterYear, sortConfig]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredResults.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredResults, currentPage, ITEMS_PER_PAGE]);
  
  // Kiểm tra xem còn dữ liệu trên Server để tải thêm không
  const hasMoreData = hydratedResults.length >= testResultLimit && debouncedSearchTerm.length < 2;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader 
          title="Kết quả Lab (QC)" 
          subtitle="Ghi nhận dữ liệu phân tích dựa trên hồ sơ Lô hàng hiện có." 
          icon={ClipboardCheck}
          action={
            isAdmin && <AddButton onClick={handleOpenAdd} label="NHẬP KẾT QUẢ MỚI" />
          }
        />
      </div>

      {/* Filter Bar */}
      <DSFilterBar>
        <DSSearchInput placeholder="Tìm theo số lô hoặc tên sản phẩm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClear={() => setSearchTerm('')} />
        
        <DSSelect value={filterYear} onChange={(e) => handleSetFilterYear(e.target.value)} className="w-24">
          <option value="ALL">Năm</option>
          {Array.from(new Set(hydratedResults.map(r => new Date(r.testDate).getFullYear()))).sort((a: number, b: number) => b - a).map(y => <option key={y} value={y}>{y}</option>)}
        </DSSelect>

        <DSSelect value={filterMonth} onChange={(e) => handleSetFilterMonth(e.target.value)} className="w-24">
          <option value="ALL">Tháng</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </DSSelect>

        <DSSelect icon={Filter} value={filterProductId} onChange={(e) => handleSetFilterProductId(e.target.value)} className="w-full md:w-64">
            <option value="">Tất cả sản phẩm</option>
        {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </DSSelect>

        <DSSelect icon={ArrowUpDown} value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => {
             const [key, direction] = e.target.value.split('-');
             useUIStore.getState().setTestResultSortConfig({ key: key as any, direction: direction as any });
           }} className="w-32">
           <option value="testDate-desc">Mới nhất</option>
           <option value="testDate-asc">Cũ nhất</option>
           <option value="batchNo-asc">Số lô (A-Z)</option>
        </DSSelect>

        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      <TestResultDataList 
        viewMode={viewMode}
        data={paginatedResults}
        onEdit={handleEditResult}
        onDelete={handleDeleteClick}
        onPrint={handlePrint}
        isAdmin={isAdmin}
        isLoading={hydratedResults.length === 0 && syncStatus === 'SAVING'}
      />

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      
      {/* --- NÚT TẢI THÊM PHÂN TRANG (LOAD MORE) --- */}
      {hasMoreData && (
        <div className="flex justify-center mt-6 no-print">
          <button 
            onClick={loadMoreTestResults} 
            disabled={syncStatus === 'SAVING'}
            className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-2 bg-white dark:bg-slate-800 px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-900/50 disabled:opacity-50 disabled:pointer-events-none shadow-sm active:scale-95"
          >
            {syncStatus === 'SAVING' ? <RefreshCcw size={14} className="animate-spin" /> : <History size={14} />}
            Tải thêm dữ liệu cũ hơn ({hydratedResults.length} bản ghi đang hiển thị)
          </button>
        </div>
      )}

      {!hasMoreData && hydratedResults.length > 0 && (
        <div className="text-center mt-6 text-[11px] font-medium text-slate-400 dark:text-slate-500 no-print italic">
          Đã tải toàn bộ {hydratedResults.length} kết quả kiểm nghiệm hiện có trên hệ thống.
        </div>
      )}

      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleConfirmDelete} 
        itemName={crud.selectedItem?.batch?.batchNo}
      />

    </div>
  );
};

export default TestResultList;
