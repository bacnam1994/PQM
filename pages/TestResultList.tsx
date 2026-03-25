
import React, { useState, useMemo, useCallback, memo, useEffect, lazy, Suspense } from 'react';
import { useAppContext } from '../context/AppContext';
import { useTestResultContext } from '../context/TestResultContext';
import { 
  Plus, Search, ClipboardCheck, CheckCircle2, AlertCircle, Trash2, 
  Calendar, Beaker, X, FileText, ChevronLeft, ChevronRight,
  History, ListPlus, FlaskConical, Printer, Eye, Edit2, Loader2,
  Package, Hash, Clock, Filter, ShieldCheck, Keyboard, LayoutGrid, List, ArrowUpDown,
} from 'lucide-react';
import { TestResult, TestResultEntry } from '../types';
import { ensureArray } from '../utils/parsing';
import { PageHeader, Modal, Pagination } from '../components/CommonUI';
import { useDataGraph, HydratedTestResult } from '../hooks/useDataGraph';
import { DSFilterBar, DSSearchInput, DSSelect, DSCard, DSViewToggle, DSTable, DSFormInput } from '../components/DesignSystem';
import CriteriaInputGroup from '../components/CriteriaInputGroup';
import { TEST_RESULT_STATUS, BATCH_STATUS, CRITERION_TYPE_CONST } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ActionButtons, DeleteModal, AddButton } from '../components/CrudControls';
const CoAReport = lazy(() => import('../components/CoAReport'));
import { useTestResultLogic } from '../hooks/useTestResultLogic';
import SpecialCharToolbar from '../components/SpecialCharToolbar';
import { useDebounce } from '../hooks/useDebounce';


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
    <DSCard className="p-4 relative group">
       <div className={`absolute top-0 left-0 w-2 h-full ${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'bg-emerald-500' : 'bg-red-500'}`} />
       <div className="mb-4">
          <h4 className="font-black text-slate-800 uppercase text-base">Lô: {res.batch?.batchNo}</h4>
          <p className="text-[9px] font-black text-slate-400 uppercase truncate">{res.product?.name}</p>
       </div>
       <div className="space-y-2 mb-6">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400 uppercase">Ngày xuất phiếu:</span>
            <span className="text-slate-700">{new Date(res.testDate).toLocaleDateString('en-GB')}</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400 uppercase">Phòng Lab:</span>
            <span className="text-indigo-600">{res.labName}</span>
          </div>
       </div>
       <div className="flex items-center justify-between">
          <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase ${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
            {res.overallStatus}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ActionButtons 
              onView={() => onPrint(res)}
              onEdit={isAdmin ? () => onEdit(res) : undefined}
              onDelete={isAdmin ? () => onDelete(res) : undefined}
            />
          </div>
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
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 font-bold text-slate-700 text-xs">{new Date(res.testDate).toLocaleDateString('en-GB')}</td>
      <td className="px-4 py-3 font-black text-slate-800">{res.batch?.batchNo}</td>
      <td className="px-4 py-3 text-xs font-medium text-slate-600">{res.product?.name}</td>
      <td className="px-4 py-3 text-xs text-indigo-600 font-bold">{res.labName}</td>
      <td className="px-4 py-3 text-center">
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${res.overallStatus === TEST_RESULT_STATUS.PASS ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
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

// --- CSS Styles for Printing ---
const printStyles = `
@media print {
  body.print-active * {
    visibility: hidden;
  }
  body.print-active .print-container,
  body.print-active .print-container * {
    visibility: visible;
  }
  body.print-active .print-container {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    z-index: 9999 !important;
  }
  .no-print {
    display: none !important;
  }
}
`;

const TestResultDataList = ({ viewMode, data, onEdit, onDelete, onPrint, isAdmin }: any) => {
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
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Ngày xuất phiếu</th>
          <th className="px-4 py-3">Lô hàng</th>
          <th className="px-4 py-3">Sản phẩm</th>
          <th className="px-4 py-3">Phòng Lab</th>
          <th className="px-4 py-3 text-center">Kết quả</th>
          <th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {data.map((res: any) => (
          <TestResultListItem key={res.id} res={res} onEdit={onEdit} onDelete={onDelete} onPrint={onPrint} isAdmin={isAdmin} />
        ))}
      </tbody>
    </DSTable>
  );
};

const TestResultList: React.FC = () => {
  const { state, isAdmin, notify } = useAppContext();
  const { loadMoreTestResults } = useTestResultContext();
  const { testResults: hydratedResults, batches: hydratedBatches } = useDataGraph();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // --- STATE MANAGEMENT ---
  const [filterProductId, setFilterProductId] = useState('');
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('test_result_view_mode', 'grid');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: 'testDate' | 'batchNo'; direction: 'asc' | 'desc' }>({ key: 'testDate', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;

  // --- USE CUSTOM HOOK ---
  const {
    crud,
    formValues,
    setFieldValue,
    addToArray,
    removeFromArray,
    updateInArray,
    isSubmitting,
    batchSearch,
    setBatchSearch,
    showBatchDropdown,
    setShowBatchDropdown,
    activeTCCS,
    manualTccsId,
    setManualTccsId,
    defaultTCCS,
    latestTCCS,
    availableTCCSList,
    existingResultsForBatch,
    isPrintModalOpen,
    setIsPrintModalOpen,
    selectedResultForPrint,    
    handleBatchSelect,
    handleEditResult,
    handleSaveResult,
    handleDeleteClick,
    handleConfirmDelete,
    handlePrint,
    closeFormModal,
    switchToEditMode,
    handleOpenAdd,
    handlePrintConsolidatedCoa,
  } = useTestResultLogic((batchNo) => setSearchTerm(batchNo));

  const availableBatchesForDropdown = useMemo(() => {
    return hydratedBatches.filter(b => 
      (b.status === BATCH_STATUS.PENDING || b.status === BATCH_STATUS.TESTING) && 
      (!batchSearch || b.batchNo.toLowerCase().includes(batchSearch.toLowerCase()) || (b.product?.name || '').toLowerCase().includes(batchSearch.toLowerCase()))
    );
  }, [hydratedBatches, batchSearch]);

  // Handle ESC key to close CoA modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPrintModalOpen) setIsPrintModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isPrintModalOpen]);

  // Thêm/xóa class trên body để tối ưu hóa cho việc in ấn
  useEffect(() => {
    if (isPrintModalOpen) {
      document.body.classList.add('print-active');
    } else {
      document.body.classList.remove('print-active');
    }
    // Cleanup function
    return () => {
      document.body.classList.remove('print-active');
    };
  }, [isPrintModalOpen]);

  const filteredResults = useMemo(() => {
    return hydratedResults.filter(r => {
      const matchesSearch = (r.batch?.batchNo || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
             (r.product?.name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesProduct = filterProductId === '' || r.batch?.productId === filterProductId;
      const testDate = new Date(r.testDate);
      const matchesYear = filterYear === 'ALL' || testDate.getFullYear().toString() === filterYear;
      const matchesMonth = filterMonth === 'ALL' || (testDate.getMonth() + 1).toString() === filterMonth;
      
      return matchesSearch && matchesProduct && matchesYear && matchesMonth;
    }).sort((a, b) => {
      if (sortConfig.key === 'batchNo') {
        const batchA = a.batch?.batchNo || '';
        const batchB = b.batch?.batchNo || '';
        return sortConfig.direction === 'asc' ? batchA.localeCompare(batchB) : batchB.localeCompare(batchA);
      }
      const dateA = new Date(a.testDate).getTime();
      const dateB = new Date(b.testDate).getTime();
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [hydratedResults, debouncedSearchTerm, filterProductId, filterMonth, filterYear, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterProductId, filterMonth, filterYear, sortConfig, viewMode]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredResults.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  
  return (
    <div className="space-y-6">
      <style>{printStyles}</style>
      {/* Datalist cho Lab Name */}
      <datalist id="lab-suggestions">
        <option value="Phòng QC (Nội bộ)" />
        <option value="CASE" />
        <option value="Quatest 3" />
        <option value="Eurofins" />
        <option value="Viện Pasteur" />
      </datalist>

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
        <DSSearchInput placeholder="Tìm theo số lô hoặc tên sản phẩm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        
        <DSSelect value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-24">
          <option value="ALL">Năm</option>
          {Array.from(new Set(hydratedResults.map(r => new Date(r.testDate).getFullYear()))).sort((a: number, b: number) => b - a).map(y => <option key={y} value={y}>{y}</option>)}
        </DSSelect>

        <DSSelect value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-24">
          <option value="ALL">Tháng</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </DSSelect>

        <DSSelect icon={Filter} value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)} className="w-full md:w-64">
            <option value="">Tất cả sản phẩm</option>
            {state.products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </DSSelect>

        <DSSelect icon={ArrowUpDown} value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => {
             const [key, direction] = e.target.value.split('-');
             setSortConfig({ key: key as any, direction: direction as any });
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
      />

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      
      <div className="flex justify-center mt-4 no-print">
        <button onClick={loadMoreTestResults} className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 hover:border-indigo-200">
          <History size={14} /> Tải thêm dữ liệu cũ hơn ({hydratedResults.length} bản ghi đang hiển thị)
        </button>
      </div>

      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleConfirmDelete} 
        itemName={crud.selectedItem?.batch?.batchNo}
      />

      {/* --- REFACTORED: Unified Add/Edit Modal --- */}
      <Modal 
        isOpen={crud.mode === 'ADD' || crud.mode === 'EDIT'} 
        onClose={closeFormModal} 
        title={crud.mode === 'EDIT' ? "Cập nhật Kết quả Lab" : "Nhập Kết quả Mới"} 
        icon={crud.mode === 'EDIT' ? Edit2 : Plus}
      >
            <form onSubmit={handleSaveResult}>
               <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
               {/* Special Char Toolbar */}
               <SpecialCharToolbar className="-mx-2 px-2" />

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Chọn Lô hàng cần test *</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text"
                        value={batchSearch}
                        onChange={(e) => {
                          setBatchSearch(e.target.value);
                          setShowBatchDropdown(true);
                          if (!e.target.value) setFieldValue('batchId', '');
                        }}
                        onFocus={() => setShowBatchDropdown(true)}
                        onBlur={() => setTimeout(() => setShowBatchDropdown(false), 200)}
                        placeholder="Tìm kiếm Lô hàng (Số lô hoặc Tên SP)..."
                        disabled={crud.mode === 'EDIT'}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                      {formValues.batchId && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600" size={16} />}
                      
                      {showBatchDropdown && (
                        <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                          {availableBatchesForDropdown.map(b => {
                            return (
                              <div 
                                key={b.id}
                                onClick={() => {
                                  handleBatchSelect(b.id);
                                  setBatchSearch(`${b.batchNo} - ${b.product?.name}`);
                                  setShowBatchDropdown(false);
                                }}
                                className={`px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors ${formValues.batchId === b.id ? 'bg-indigo-50' : ''}`}
                              >
                                <p className="text-sm font-bold text-slate-700 uppercase">Lô: {b.batchNo}</p>
                                <p className="text-[10px] font-medium text-slate-500">{b.product?.name}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <DSFormInput 
                        label="Tên đơn vị kiểm nghiệm *" 
                        name="labName" 
                        list="lab-suggestions"
                        value={formValues.labName}
                        onChange={(e) => setFieldValue('labName', e.target.value)}
                        required 
                        placeholder="VD: Phòng QC, CASE..." />
                    </div>
                    <div className="col-span-2">
                      <DSFormInput 
                        type="date"
                        label="Ngày xuất phiếu *" 
                        name="testDate" 
                        value={formValues.testDate}
                        onChange={(e: any) => setFieldValue('testDate', e.target.value)}
                        required 
                      />
                    </div>
                  </div>
               </div>

               {/* Hiển thị tóm tắt thông tin Lô đã chọn để đối chiếu */}
               {formValues.batchId && (() => {
                 const b = hydratedBatches.find(batch => batch.id === formValues.batchId);
                 if (!b) return null;
                 return (
                   <div className="space-y-3 animate-in fade-in">
                     <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex flex-wrap gap-4 text-xs">
                        <div className="flex items-center gap-1"><Package size={14} className="text-indigo-400"/> <span className="font-bold text-slate-700">{b.product?.name}</span></div>
                        <div className="flex items-center gap-1"><Hash size={14} className="text-indigo-400"/> <span className="font-bold text-indigo-700">{b.batchNo}</span></div>
                        <div className="flex items-center gap-1"><Calendar size={14} className="text-indigo-400"/> <span className="font-bold text-slate-700">SX: {b.mfgDate ? new Date(b.mfgDate).toLocaleDateString('en-GB') : '---'}</span></div>
                        <div className="flex items-center gap-1"><Clock size={14} className="text-indigo-400"/> <span className="font-bold text-slate-700">HD: {b.expDate ? new Date(b.expDate).toLocaleDateString('en-GB') : '---'}</span></div>
                     </div>

                     {/* Cảnh báo nếu lô đã có kết quả */}
                     {existingResultsForBatch.length > 0 && (
                       <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 animate-in fade-in">
                         <div className="flex justify-between items-center mb-2">
                           <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                             <AlertCircle size={12}/> Lô này đã có {existingResultsForBatch.length} phiếu kết quả:
                           </p>
                           <button type="button" onClick={() => handlePrintConsolidatedCoa(formValues.batchId)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100">
                              <Printer size={12} /> Xem CoA Tổng hợp
                           </button>
                         </div>
                         <div className="space-y-1">
                           {existingResultsForBatch.map(r => (
                             <div key={r.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-amber-100/50">
                               <span className="font-bold text-slate-600">{r.labName} <span className="font-normal text-slate-400">({new Date(r.testDate).toLocaleDateString('en-GB')})</span></span>
                               <div className="flex items-center gap-2">
                                 <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${r.overallStatus === TEST_RESULT_STATUS.PASS ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.overallStatus}</span>
                                 <button type="button" onClick={() => switchToEditMode(r)} className="text-[9px] font-bold text-blue-600 hover:underline">Sửa phiếu này</button>
                               </div>
                             </div>
                           ))}
                         </div>
                         <p className="text-[10px] text-amber-600/70 italic mt-2 text-center">Bạn đang tạo phiếu kết quả <b>MỚI</b> (ví dụ: gửi mẫu thêm cho đơn vị khác).</p>
                       </div>
                     )}
                   </div>
                 );
               })()}

               {activeTCCS ? (
                 <div className="space-y-6 animate-in fade-in">
                    {/* Selector for TCCS Version */}
                    <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.3em] flex items-center gap-2">
                              <History size={20} /> TIÊU CHUẨN ÁP DỤNG
                            </h4>
                            {defaultTCCS && activeTCCS.id !== defaultTCCS.id && (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                    Đang dùng phiên bản khác với mặc định
                                </span>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2">
                            <select 
                                value={activeTCCS.id} 
                                onChange={(e) => setManualTccsId(e.target.value)}
                                className="flex-1 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {availableTCCSList.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.code} (Ban hành: {new Date(t.issueDate).toLocaleDateString('en-GB')}) 
                                        {defaultTCCS && t.id === defaultTCCS.id ? " - [Mặc định theo lô]" : ""}
                                        {latestTCCS && t.id === latestTCCS.id ? " - [Hiệu lực]" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Cảnh báo khi dùng TCCS cũ so với hiện hành */}
                        {activeTCCS && latestTCCS && activeTCCS.id !== latestTCCS.id && (
                          <div className="mt-2 flex items-start gap-2 text-[10px] text-slate-500">
                              <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                              <p>
                                Phiên bản hiệu lực mới nhất của sản phẩm là <strong>{latestTCCS.code}</strong>.
                              </p>
                          </div>
                        )}
                    </div>

                    <p className="text-[10px] text-slate-400 italic -mt-4 pl-4">Lưu ý: Chỉ nhập kết quả cho các chỉ tiêu được kiểm tra trong lần này. Các chỉ tiêu khác để trống.</p>
                    
                    {(() => {
                        if (!activeTCCS) return null;
                        const allTccsCriteria = [
                            ...ensureArray(activeTCCS.mainQualityCriteria),
                            ...ensureArray(activeTCCS.safetyCriteria)
                        ].filter(c => c && c.name);

                        const totalCount = allTccsCriteria.length;
                        const filledCount = allTccsCriteria.filter(c => {
                            const val = formValues.testResultsMap[c.name];
                            return val !== undefined && String(val).trim() !== '';
                        }).length;

                        const progress = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

                        return (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 my-4">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Tiến độ nhập liệu (TCCS)
                                    </p>
                                    <p className="text-sm font-black text-indigo-600">
                                        {filledCount} / {totalCount}
                                    </p>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2.5"><div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
                            </div>
                        );
                    })()}
                    
                    {/* Render Main Criteria */}
                    <CriteriaInputGroup
                        title="Lý hóa & Cảm quan"
                        criteria={ensureArray(activeTCCS.mainQualityCriteria)}
                        icon={<Beaker size={16}/>}
                        colorClass="text-indigo-600"
                        activeTCCS={activeTCCS}
                        testResultsMap={formValues.testResultsMap}
                        setTestResultsMap={(map) => setFieldValue('testResultsMap', map)}
                        existingResultsForBatch={existingResultsForBatch}
                    />
                    {/* Render Safety Criteria (Split Micro & Metal) */}
                    {(() => {
                       const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
                       const safety = ensureArray(activeTCCS.safetyCriteria);
                       const micro = safety.filter(c => {
                           if (!c) return false;
                           const nameLower = (c.name || '').toLowerCase();
                           if ((c as any).category === 'micro') return true;
                           if (!(c as any).category && !HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
                           return false;
                       });
                       const metal = safety.filter(c => {
                           if (!c) return false;
                           const nameLower = (c.name || '').toLowerCase();
                           if ((c as any).category === 'metal') return true;
                           if (!(c as any).category && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
                           return false;
                       });
                       return (
                         <>
                           <CriteriaInputGroup
                                title="Vi sinh vật"
                                criteria={micro}
                                icon={<FlaskConical size={16}/>}
                                colorClass="text-emerald-600"
                                activeTCCS={activeTCCS}
                                testResultsMap={formValues.testResultsMap}
                                setTestResultsMap={(map) => setFieldValue('testResultsMap', map)}
                                existingResultsForBatch={existingResultsForBatch}
                           />
                           <CriteriaInputGroup
                                title="Kim loại nặng"
                                criteria={metal}
                                icon={<ShieldCheck size={16}/>}
                                colorClass="text-red-600"
                                activeTCCS={activeTCCS}
                                testResultsMap={formValues.testResultsMap}
                                setTestResultsMap={(map) => setFieldValue('testResultsMap', map)}
                                existingResultsForBatch={existingResultsForBatch}
                           />
                         </>
                       );
                    })()}
                 </div>
               ) : formValues.batchId && (
                 <div className="p-8 text-center bg-indigo-50/30 rounded-2xl border-4 border-dashed border-indigo-100">
                    <AlertCircle size={48} className="mx-auto text-indigo-200 mb-4" />
                    <p className="text-sm font-black text-indigo-800 uppercase">Không tìm thấy hồ sơ TCCS hiệu lực!</p>
                 </div>
               )}

               {/* Phần nhập chỉ tiêu bổ sung ngoài TCCS */}
               <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <ListPlus size={20} /> CHỈ TIÊU BỔ SUNG (NGOÀI TCCS)
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => addToArray('extraCriteria', { id: 'extra_' + Date.now(), name: '', value: '', unit: '', limit: '' })}
                      className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-1"
                    >
                      <Plus size={14}/> Thêm dòng
                    </button>
                  </div>
                  
                  {formValues.extraCriteria.map((item, idx) => (
                    <div key={item.id} className="flex gap-2 items-start animate-in slide-in-from-left-2">
                      <input placeholder="Tên chỉ tiêu" value={item.name} onChange={e => updateInArray('extraCriteria', idx, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500" />
                      <input placeholder="Kết quả" value={item.value} onChange={e => updateInArray('extraCriteria', idx, 'value', e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-black text-indigo-700 outline-none focus:ring-1 focus:ring-indigo-500 text-right" />
                      <input placeholder="ĐVT" value={item.unit} onChange={e => updateInArray('extraCriteria', idx, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-slate-50 border-none rounded-lg text-sm font-bold outline-none text-center" />
                      <input placeholder="Mức giới hạn (để đánh giá)" value={item.limit} onChange={e => updateInArray('extraCriteria', idx, 'limit', e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 border-none rounded-lg text-xs font-medium outline-none" />
                      <button type="button" onClick={() => removeFromArray('extraCriteria', idx)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  
                  {formValues.extraCriteria.length === 0 && (
                    <p className="text-center text-[10px] text-slate-300 italic py-2">
                      Chưa có chỉ tiêu bổ sung. Nhấn "Thêm dòng" nếu cần nhập các chỉ tiêu không nằm trong TCCS.
                    </p>
                  )}
               </div>

               <div className="space-y-2 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Ghi chú / File đính kèm</label>
                  <textarea name="notes" value={formValues.notes} onChange={(e) => setFieldValue('notes', e.target.value)} rows={2} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="VD: Mẫu gửi ngày 12/10, File kết quả: KQ_123.pdf..." />
               </div>
               </div>

               <div className="pt-6 flex justify-end gap-3 border-t bg-white mt-2">
                 <button type="button" onClick={closeFormModal} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl">Hủy</button>
                 <button type="submit" disabled={!activeTCCS || isSubmitting} className={`px-8 py-3 text-white font-black rounded-xl shadow-2xl transition-all uppercase text-xs tracking-widest ${crud.mode === 'EDIT' ? 'bg-blue-600 shadow-blue-100 hover:bg-blue-700' : 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700'} disabled:opacity-20 flex items-center gap-2`}>
                    {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                    {crud.mode === 'EDIT' ? 'Cập nhật' : 'Lưu kết quả'}
                 </button>
               </div>
            </form>
      </Modal>

      {/* CoA Viewer modal */}
      {isPrintModalOpen && selectedResultForPrint && (
        <div className="print-container fixed inset-0 z-[150] flex flex-col bg-slate-900/98 backdrop-blur-2xl overflow-y-auto p-4 md:p-12 animate-in fade-in duration-300 print:static print:p-0 print:bg-white print:overflow-visible">
          <button 
            onClick={() => setIsPrintModalOpen(false)} 
            className="fixed top-6 right-6 z-[80] p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10 shadow-xl no-print"
            title="Đóng (Esc)"
          >
            <X size={24}/>
          </button>
          <div className="max-w-[21cm] mx-auto w-full print:block print:h-auto print:max-w-full">
            <div className="flex items-center justify-between mb-10 text-white no-print">
               <h3 className="text-2xl font-black uppercase tracking-tighter">Xuất Phiếu CoA</h3>
               <div className="flex items-center gap-4">
                  <button onClick={() => window.print()} className="px-10 py-4 bg-white text-slate-900 rounded-[2rem] font-black hover:bg-slate-100 shadow-2xl transition-all uppercase text-xs tracking-widest flex items-center gap-2"><Printer size={18}/> In phiếu</button>
               </div>
            </div>
            <div className="bg-white shadow-2xl rounded-sm animate-in zoom-in-95 duration-500 print:shadow-none">
              <Suspense fallback={<div className="p-20 text-center font-bold text-slate-400">Đang tải phiếu CoA...</div>}>
                <CoAReport 
                  res={selectedResultForPrint} 
                  batch={selectedResultForPrint.batch}
                  product={selectedResultForPrint.product}
                  tccs={selectedResultForPrint.batch?.tccs}
                  formula={state.productFormulas.find(f => f.productId === selectedResultForPrint.product?.id)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestResultList;
