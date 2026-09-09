
import React, { useState, useMemo, useCallback, memo, useEffect, lazy, Suspense } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TrashIcon,
  CalendarDaysIcon,
  BeakerIcon,
  DocumentTextIcon,
  ClockIcon,
  PrinterIcon,
  EyeIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  CubeIcon,
  FunnelIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { TestResult, TestResultEntry } from '../../types';
import { TEST_RESULT_STATUS, BATCH_STATUS, ensureArray, formatDateStandard, normalizeSearch } from '../../utils';
const CoAReport = lazy(() => import('../../components/features/CoAReport'));
import { PageHeader, DSFilterBar, DSSearchInput, DSSelect, DSCard, DSViewToggle, DSTable, ActionButtons, DeleteModal, AddButton, DSEmptyState, Pagination } from '../../components';
import { OOSInvestigationModal } from '../../components/features/OOSInvestigationModal';
import { LabComparisonModal } from '../../components/features/LabComparisonModal';
import { useDataGraph, HydratedTestResult, useDebounce } from '../../hooks';
import { useTestResultList } from '../../hooks/test-results/useTestResultList';
import { useUIStore } from '../../store/useUIStore';


interface ExtraTestResultEntry extends TestResultEntry {
  limit?: string;
}

// --- SUB-COMPONENT: Grid Item (Memoized) ---
const TestResultGridItem = memo(({ res, onEdit, onDelete, onPrint, onOOS, isAdmin }: { 
  res: HydratedTestResult, 
  onEdit: (res: HydratedTestResult) => void, 
  onDelete: (res: HydratedTestResult) => void, 
  onPrint: (res: HydratedTestResult) => void,
  onOOS: (res: HydratedTestResult) => void,
  isAdmin: boolean
}) => {
  const isPass = res.overallStatus === TEST_RESULT_STATUS.PASS;

  return (
    <DSCard className="p-5 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group relative overflow-hidden h-full bg-surface border border-border">
      {/* Header: Product and Status */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted truncate pr-2" title={res.product?.name}>
          <ClipboardDocumentCheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">{res.product?.name || 'Sản phẩm'}</span>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
          isPass 
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40' 
            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/40'
        }`}>
          {res.overallStatus}
        </span>
      </div>

      {/* Main Content Box */}
      <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-3 relative z-10 flex-grow">
        {/* Main Info */}
        <div className="flex items-center gap-3.5">
          <div className={`p-2.5 rounded-lg shrink-0 border ${
            isPass 
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' 
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
          }`}>
            {isPass ? <CheckCircleIcon className="w-6 h-6" /> : <ExclamationCircleIcon className="w-6 h-6" />}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            {res.batch?.id ? (
              <Link
                to={`/batches/${res.batch.id}`}
                onClick={e => e.stopPropagation()}
                className={`font-semibold text-ink text-base leading-tight transition-colors line-clamp-1 hover:underline ${
                  isPass ? 'hover:text-emerald-600 dark:hover:text-emerald-400' : 'hover:text-rose-600 dark:hover:text-rose-400'
                }`}
              >
                {res.batch?.batchNo || `Lô ${res.batchId || 'N/A'}`}
              </Link>
            ) : (
              <h3 className="font-semibold text-ink text-base leading-tight line-clamp-1">
                {res.batch?.batchNo || `Lô ${res.batchId || 'N/A'}`}
              </h3>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-xs text-ink-muted">Phiếu số: {res.id.slice(-6)}</span>
              {res.tccs && (
                <Link
                  to={`/tccs/detail/${res.tccs.id}`}
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-surface text-ink-soft border border-border hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                >
                  <DocumentTextIcon className="w-3 h-3" /> {res.tccs.code}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Meta Info */}
        <div className="space-y-1.5 pt-2.5 border-t border-border mt-auto text-xs">
          <div className="flex justify-between items-start gap-2">
            <span className="text-ink-muted whitespace-nowrap shrink-0">Ngày xuất phiếu:</span>
            <span className="text-ink font-medium text-right">{formatDateStandard(res.testDate)}</span>
          </div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-ink-muted whitespace-nowrap shrink-0">Phòng Lab:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium text-right break-words">{res.labName}</span>
          </div>
        </div>
      </div>

      {/* Footer: Actions */}
      <div className="flex items-center justify-between pt-3 mt-auto border-t border-border relative z-10">
        <div className="flex gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <ActionButtons 
            onEdit={isAdmin ? () => onEdit(res) : undefined}
            onDelete={isAdmin ? () => onDelete(res) : undefined}
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {!isPass && (
            <button 
              onClick={() => onOOS(res)} 
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/60 transition-all shadow-xs"
            >
              <ShieldExclamationIcon className="w-3.5 h-3.5" /> OOS (AI)
            </button>
          )}
          <button 
            onClick={() => onPrint(res)} 
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-2 text-ink-soft hover:bg-surface-3 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all border border-border"
          >
            <PrinterIcon className="w-3.5 h-3.5" /> Xem phiếu
          </button>
        </div>
      </div>
    </DSCard>
  );
});

// --- SUB-COMPONENT: List Item (Memoized) ---
const TestResultListItem = memo(({ res, onEdit, onDelete, onPrint, onOOS, isAdmin }: { 
  res: HydratedTestResult, 
  onEdit: (res: HydratedTestResult) => void, 
  onDelete: (res: HydratedTestResult) => void, 
  onPrint: (res: HydratedTestResult) => void,
  onOOS: (res: HydratedTestResult) => void,
  isAdmin: boolean
}) => {
  const isPass = res.overallStatus === TEST_RESULT_STATUS.PASS;

  return (
    <tr className="hover:bg-surface-2 transition-colors">
      <td className="px-4 py-3 font-medium text-ink text-xs">{formatDateStandard(res.testDate)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          {res.batch?.id ? (
            <Link to={`/batches/${res.batch.id}`} className="font-semibold text-ink hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm">
              {res.batch?.batchNo || `Lô ${res.batchId || 'N/A'}`}
            </Link>
          ) : (
            <span className="font-semibold text-ink text-sm">{res.batch?.batchNo || `Lô ${res.batchId || 'N/A'}`}</span>
          )}
          {res.tccs && (
            <Link to={`/tccs/detail/${res.tccs.id}`} className="text-xs text-ink-muted hover:text-emerald-600 transition-colors inline-flex items-center gap-1">
              <DocumentTextIcon className="w-3 h-3" /> {res.tccs.code}
            </Link>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-medium">
        {res.product ? (
          <Link to={`/products/${res.product.id}`} className="text-ink-soft hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            {res.product.name}
          </Link>
        ) : <span className="text-ink-muted">Sản phẩm đã xóa</span>}
      </td>
      <td className="px-4 py-3 text-xs text-ink font-medium">{res.labName}</td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
          isPass 
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40' 
            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/40'
        }`}>
          {res.overallStatus}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end items-center gap-1.5">
          {!isPass && (
            <button 
              onClick={() => onOOS(res)} 
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/60 transition-all"
            >
              <ShieldExclamationIcon className="w-3.5 h-3.5" /> OOS
            </button>
          )}
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

const TestResultDataList = ({ viewMode, data, onEdit, onDelete, onPrint, onOOS, isAdmin, isLoading }: any) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 bg-surface rounded-xl border border-border">
        <ArrowPathIcon className="animate-spin text-emerald-600 dark:text-emerald-400 w-8 h-8" />
        <p className="text-xs font-medium text-ink-muted">Đang tải dữ liệu kết quả kiểm nghiệm...</p>
      </div>
    );
  }

  if (data.length === 0) {
     return <DSEmptyState icon={MagnifyingGlassIcon} title="Không có phiếu kiểm nghiệm" message="Hệ thống chưa ghi nhận kết quả kiểm nghiệm nào khớp với thông tin tìm kiếm." />;
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 no-print">
        {data.map((res: any) => (
          <TestResultGridItem key={res.id} res={res} onEdit={onEdit} onDelete={onDelete} onPrint={onPrint} onOOS={onOOS} isAdmin={isAdmin} />
        ))}
      </div>
    );
  }
  return (
    <DSTable>
      <thead className="bg-surface-2 border-b border-border">
        <tr className="text-ink-muted text-xs font-semibold uppercase tracking-wider">
          <th className="px-4 py-3">Ngày xuất phiếu</th>
          <th className="px-4 py-3">Lô hàng</th>
          <th className="px-4 py-3">Sản phẩm</th>
          <th className="px-4 py-3">Phòng Lab</th>
          <th className="px-4 py-3 text-center">Kết quả</th>
          <th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((res: any) => (
          <TestResultListItem key={res.id} res={res} onEdit={onEdit} onDelete={onDelete} onPrint={onPrint} onOOS={onOOS} isAdmin={isAdmin} />
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
  const { testResults: hydratedResults, allTestResultsHydrated } = useDataGraph();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const viewMode = useUIStore(s => s.testResultViewMode);
  const setViewMode = useUIStore(s => s.setTestResultViewMode);
  const filterYear = useUIStore(s => s.testResultFilterYear);
  const filterMonth = useUIStore(s => s.testResultFilterMonth);
  const filterProductId = useUIStore(s => s.testResultFilterProductId);
  const sortConfig = useUIStore(s => s.testResultSortConfig);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;

  const handleSetFilterProductId = (v: string) => { useUIStore.getState().setTestResultFilterProductId(v); useAppStore.setState({ testResultLimit: 50 }); };
  const handleSetFilterMonth = (v: string) => { useUIStore.getState().setTestResultFilterMonth(v); useAppStore.setState({ testResultLimit: 50 }); };
  const handleSetFilterYear = (v: string) => { useUIStore.getState().setTestResultFilterYear(v); useAppStore.setState({ testResultLimit: 50 }); };

  const {
    crud,
    handleEditResult,
    handleDeleteClick,
    handleConfirmDelete,
    handlePrint,
    handleOpenAdd,
  } = useTestResultList();

  const [isOOSOpen, setIsOOSOpen] = useState(false);
  const [oosModalData, setOosModalData] = useState<any>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  const handleOpenOOS = useCallback((res: HydratedTestResult) => {
    const failedCriteria: { criteriaName: string; actualValue: string | number; specification: string; unit?: string }[] = [];
    const passedCriteria: { criteriaName: string; actualValue: string | number }[] = [];

    (res.results || []).forEach((item: any) => {
      if (item.isPass === false) {
        failedCriteria.push({
          criteriaName: item.criteriaName,
          actualValue: item.value,
          specification: item.limit || 'Theo tiêu chuẩn',
          unit: item.unit,
        });
      } else {
        passedCriteria.push({
          criteriaName: item.criteriaName,
          actualValue: item.value,
        });
      }
    });

    const formula = productFormulas.find((f: any) => f.productId === res.batch?.productId);

    setOosModalData({
      productName: res.product?.name || 'Sản phẩm',
      batchNo: res.batch?.batchNo || `Lô ${res.batchId}`,
      mfgDate: res.batch?.mfgDate,
      expDate: res.batch?.expDate,
      failedCriteria: failedCriteria.length > 0 ? failedCriteria : [{ criteriaName: 'Chỉ tiêu kiểm nghiệm', actualValue: 'Không đạt', specification: 'TCCS' }],
      passedCriteria,
      formulaIngredients: formula?.ingredients || [],
    });
    setIsOOSOpen(true);
  }, [productFormulas]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterProductId, filterMonth, filterYear, sortConfig, viewMode]);

  useEffect(() => {
    if (debouncedSearchTerm.length >= 2 && allTestResultsHydrated.length === 0) {
      fetchAllTestResultsForDashboard();
    }
  }, [debouncedSearchTerm, allTestResultsHydrated.length, fetchAllTestResultsForDashboard]);

  const filteredResults = useMemo(() => {
    const sourceData = (debouncedSearchTerm.length >= 2 && allTestResultsHydrated.length > 0) ? allTestResultsHydrated : hydratedResults;
    const searchNormalized = normalizeSearch(debouncedSearchTerm);
    
    return sourceData.filter(r => {
      const matchesSearch = !searchNormalized || normalizeSearch(r.batch?.batchNo).includes(searchNormalized) || normalizeSearch(r.product?.name).includes(searchNormalized);
      const matchesProduct = filterProductId === '' || r.batch?.productId === filterProductId;
      
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
        return sortConfig.direction === 'asc' ? batchA.localeCompare(batchB) : batchB.localeCompare(a.batch?.batchNo || '');
      }
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
  
  const hasMoreData = hydratedResults.length >= testResultLimit && debouncedSearchTerm.length < 2;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader 
          title="Kết quả Lab (QC)" 
          subtitle="Ghi nhận dữ liệu phân tích dựa trên hồ sơ Lô hàng hiện có." 
          icon={ClipboardDocumentCheckIcon}
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsComparisonOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface text-ink-soft hover:text-emerald-600 dark:hover:text-emerald-400 font-medium text-xs border border-border shadow-xs transition-all"
              >
                <ScaleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Đối chiếu Lab (AI)
              </button>
              {isAdmin && <AddButton onClick={handleOpenAdd} label="NHẬP KẾT QUẢ MỚI" />}
            </div>
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

        <DSSelect icon={FunnelIcon} value={filterProductId} onChange={(e) => handleSetFilterProductId(e.target.value)} className="w-full md:w-64">
          <option value="">Tất cả sản phẩm</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </DSSelect>

        <DSSelect icon={ChevronUpDownIcon} value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => {
             const [key, direction] = e.target.value.split('-');
             useUIStore.getState().setTestResultSortConfig({ key: key as any, direction: direction as any });
           }} className="w-36">
           <option value="testDate-desc">Mới nhất</option>
           <option value="testDate-asc">Cũ nhất</option>
           <option value="batchNo-asc">Số lô (A-Z)</option>
        </DSSelect>

        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={Squares2X2Icon} listIcon={ListBulletIcon} />
      </DSFilterBar>

      <TestResultDataList 
        viewMode={viewMode}
        data={paginatedResults}
        onEdit={handleEditResult}
        onDelete={handleDeleteClick}
        onPrint={handlePrint}
        onOOS={handleOpenOOS}
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
            className="text-xs font-medium text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-all inline-flex items-center gap-2 bg-surface px-4 py-2 rounded-lg border border-border hover:border-emerald-300 disabled:opacity-50 disabled:pointer-events-none shadow-xs"
          >
            {syncStatus === 'SAVING' ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ClockIcon className="w-4 h-4" />}
            Tải thêm dữ liệu cũ hơn ({hydratedResults.length} bản ghi đang hiển thị)
          </button>
        </div>
      )}

      {!hasMoreData && hydratedResults.length > 0 && (
        <div className="text-center mt-6 text-xs text-ink-muted no-print italic">
          Đã tải toàn bộ {hydratedResults.length} kết quả kiểm nghiệm hiện có trên hệ thống.
        </div>
      )}

      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleConfirmDelete} 
        itemName={crud.selectedItem?.batch?.batchNo}
      />

      {isOOSOpen && oosModalData && (
        <OOSInvestigationModal
          isOpen={isOOSOpen}
          onClose={() => setIsOOSOpen(false)}
          initialData={oosModalData}
        />
      )}

      {isComparisonOpen && (
        <LabComparisonModal
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
        />
      )}

    </div>
  );
};

export default TestResultList;

