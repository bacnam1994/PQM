
import React, { useState, useMemo, useEffect, memo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Plus, Search, Layers, Trash2, Hash, History, CheckCircle2, AlertTriangle, CalendarOff, Upload, Download, FileSpreadsheet, Info, LayoutGrid, List, Edit2, Loader2, ClipboardCheck, FlaskConical, ListChecks, ArrowUpDown, Filter, CalendarRange, X, ShieldCheck, Clock, FileUp, Eye, Printer, PackageOpen, RefreshCcw } from 'lucide-react';
import { Batch, Product, TestResult, TestResultEntry } from '../../types';
import { logAuditAction } from '../../services/auditService';
import { PageHeader, Modal, StatusBadge, Pagination, ConfirmationModal, DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable, DSFormInput, ActionButtons, DeleteModal, AddButton, BatchCriteriaHistory, DSEmptyState, CircularProgress } from '../../components';
import { useDataGraph, HydratedTestResult, useDebounce, useCrud } from '../../hooks';
import { useUIStore } from '../../store/useUIStore';
import { BATCH_STATUS, formatDateStandard, toInputDate, parseDateToISO, generateId, parseNumberFromText, calculateOverallStatus, ensureArray, normalizeSearch } from '../../utils';
import { useNavigate } from 'react-router-dom';
const CoAReport = React.lazy(() => import('../../components/features/CoAReport'));
import { fetchTestResultsByBatchId } from '../../services/testResultService';

// --- HELPER: Tính toán tiến độ kiểm nghiệm ---
const calculateBatchProgress = (batch: any, batchResults: TestResult[]) => {
  const tccs = batch.tccs;
  const requiredCriteria = tccs ? [
    ...ensureArray(tccs.mainQualityCriteria),
    ...ensureArray(tccs.safetyCriteria)
  ].filter(c => c && c.name && c.name.trim() !== '') : [];

  if (requiredCriteria.length === 0) {
    return { progressPercent: 0, missingCriteria: [], requiredCriteria: [] };
  }
  
  const testedCriteriaNames = new Set<string>();
  const latestResultsMap = new Map<string, { value: any, isPass: boolean }>();

  // Sắp xếp tăng dần theo thời gian để kết quả mới nhất ghi đè kết quả cũ
  // Tối ưu 1: Dùng localeCompare để so sánh chuỗi ISO date tránh khởi tạo Date object
  if (batchResults.length > 0) {
    const sortedBatchResults = [...batchResults]
      .filter(r => r.batchId === batch.id)
      .sort((a,b) => {
        const dateCmp = a.testDate.localeCompare(b.testDate);
        if (dateCmp !== 0) return dateCmp;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });
    sortedBatchResults.forEach(r => {
      ensureArray(r.results).forEach(res => { 
        if (res && res.criteriaName) {
          const cName = res.criteriaName.trim().toLowerCase();
          testedCriteriaNames.add(cName);
          latestResultsMap.set(cName, { value: res.value, isPass: res.isPass });
        }
      });
    });
  }

  // Chuyển alternateRules thành Map để tra cứu O(1)
  const rulesMap = new Map<string, any>();
  if (tccs && tccs.alternateRules) {
    tccs.alternateRules.forEach((r: any) => {
      if (r && r.alt && r.alt.trim() !== '') rulesMap.set(r.alt.trim().toLowerCase(), r);
    });
  }

  const missingCriteria = requiredCriteria.filter(c => {
    if (!c || !c.name || c.name.trim() === '') return false;
    const cName = c.name.trim().toLowerCase();
    if (testedCriteriaNames.has(cName)) return false;

    const rule = rulesMap.get(cName);
    if (rule) {
      const mainName = (rule.main || '').trim().toLowerCase();
      const mainRes = latestResultsMap.get(mainName);
      if (mainRes !== undefined) {
        if (rule.type === 'CONDITIONAL_CHECK') {
          const extractNum = (val: any) => {
              const str = String(val || '').trim().toUpperCase();
              if (['ND', 'KPH', 'K.P.H', 'KHÔNG PHÁT HIỆN', 'NOT DETECTED', 'ÂM TÍNH', 'NEGATIVE', 'KHÔNG CÓ'].some(kw => str.includes(kw))) return 0;
              const parsed = parseNumberFromText(str);
              if (!isNaN(parsed)) return parsed;
              const match = str.match(/[-+]?[0-9]*[.,]?[0-9]+/);
              return match ? Number(match[0].replace(',', '.')) : 0;
          };
          if (mainRes.isPass && extractNum(mainRes.value) <= extractNum(rule.conditionValue)) return false;
        } else {
          if (mainRes.isPass) return false;
        }
      }
    }
    return true;
  });

  const progressPercent = Math.round(((requiredCriteria.length - missingCriteria.length) / requiredCriteria.length) * 100);
  return { progressPercent, missingCriteria, requiredCriteria };
};

// --- SUB-COMPONENT: Batch Status Selector ---
const BatchStatusSelect = ({ status, batchId, onUpdate, isAdmin }: { status: string, batchId: string, onUpdate: (s: string, id: string) => void, isAdmin: boolean }) => {
  const getStatusColor = (s: string) => {
    switch(s) {
      case 'RELEASED': return 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm';
      case 'REJECTED': return 'bg-red-600 text-white border-red-600 hover:bg-red-700 shadow-sm';
      case 'TESTING': return 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700';
    }
  };

  const getStatusIcon = (s: string) => {
     switch(s) {
      case 'RELEASED': return ShieldCheck;
      case 'REJECTED': return X;
      case 'TESTING': return Loader2;
      default: return Clock;
    }
  };

  const Icon = getStatusIcon(status);
  const iconColor = status === 'PENDING' ? 'text-slate-500 dark:text-slate-400' : 'text-white';

  if (!isAdmin) {
     return <StatusBadge type="BATCH" status={status} />;
  }

  return (
    <div className="relative inline-block group/select" onClick={(e) => e.stopPropagation()}>
      <div className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`}>
         <Icon size={12} className={status === 'TESTING' ? 'animate-spin' : ''} />
      </div>
      <select
        value={status}
        onChange={(e) => onUpdate(e.target.value, batchId)}
        className={`appearance-none pl-7 pr-6 py-1 rounded text-[10px] font-black uppercase border cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-all ${getStatusColor(status)}`}
      >
        <option value="PENDING" className="dark:bg-slate-800 dark:text-slate-300">Chờ kiểm</option>
        <option value="TESTING" className="dark:bg-slate-800 dark:text-slate-300">Đang kiểm</option>
        <option value="RELEASED" className="dark:bg-slate-800 dark:text-slate-300">Phê duyệt</option>
        <option value="REJECTED" className="dark:bg-slate-800 dark:text-slate-300">Từ chối</option>
      </select>
      <div className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover/select:opacity-100 transition-opacity ${iconColor}`}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
  );
};

const BatchGridItem = memo(({ batch, isExpanded, onExpand, onEdit, onDelete, onView, testResults, onUpdateBatchStatus, isAdmin }: {
  batch: ReturnType<typeof useDataGraph>['batches'][0],
  isExpanded: boolean,
  onExpand: (id: string) => void,
  onEdit: (batch: Batch) => void,
  onDelete: (batch: Batch) => void,
  onView: (batch: Batch) => void,
  testResults: TestResult[],
  onUpdateBatchStatus: (status: string, batchId: string) => void,
  isAdmin: boolean
}) => {
  // Logic tính hạn dùng
  const expDate = new Date(batch.expDate);
  const today = new Date();
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = diffDays < 0;
  const isNearExpiry = diffDays > 0 && diffDays <= 90; // Cảnh báo trước 90 ngày

  const { missingCriteria, progressPercent: calculatedProgress } = useMemo(() => calculateBatchProgress(batch, testResults), [batch, testResults]);
  
  const hasLocalResults = useMemo(() => testResults.some(r => r.batchId === batch.id), [testResults, batch.id]);
  const progressPercent = (isExpanded || hasLocalResults) ? calculatedProgress : (batch.progressPercent ?? 0);

  return (
    <DSCard isExpanded={isExpanded} className={`p-5 flex flex-col gap-5 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.15)] transition-all duration-500 group relative overflow-hidden h-full bg-gradient-to-br from-indigo-50/80 via-white to-fuchsia-50/80 dark:from-indigo-950/20 dark:via-slate-800 dark:to-fuchsia-950/20 dark:border-slate-700/50 ${isExpanded ? 'col-span-2' : ''}`}>
      {/* Decorative Blob */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/10 to-fuchsia-400/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>
      {/* Date Warnings */}
      {isExpired && <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest flex items-center gap-1 z-20"><CalendarOff size={10}/> Đã hết hạn</div>}
      {isNearExpiry && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest flex items-center gap-1 z-20"><AlertTriangle size={10}/> Cận date ({diffDays} ngày)</div>}

      {/* Header: Eyebrow text and Status */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 truncate pr-2" title={batch.product?.name}>
          <PackageOpen size={14} className="text-indigo-400 shrink-0" />
          <span className="truncate">{batch.product?.name || 'Sản phẩm'}</span>
        </div>
        <div className="shrink-0 mt-[-4px]">
          <BatchStatusSelect 
            status={batch.status} 
            batchId={batch.id} 
            onUpdate={onUpdateBatchStatus} 
            isAdmin={isAdmin} 
          />
        </div>
      </div>

      {/* Glass Box Highlighting Main Content */}
      <div className="bg-gradient-to-br from-white/60 to-white/30 dark:from-slate-800/60 dark:to-slate-900/30 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-[0_4px_20px_-5px_rgba(79,70,229,0.1)] dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)] rounded-2xl p-4 flex flex-col gap-4 relative z-10 mt-2">
        
        {/* Main Info: Batch No and Icon */}
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50/80 dark:bg-indigo-950/30 p-3.5 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-100/50 dark:border-indigo-800/30 shadow-inner">
            <Hash size={24} />
          </div>
          <div className="flex flex-col group/link cursor-pointer" onClick={() => onView(batch)}>
            <h3 className="font-black text-slate-800 dark:text-slate-200 text-xl uppercase leading-tight group-hover/link:text-indigo-600 dark:group-hover/link:text-indigo-400 transition-colors line-clamp-1">{batch.batchNo}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{batch.product?.code}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
              <span className="text-[11px] font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
                <FlaskConical size={10} /> {progressPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Meta Info */}
        <div className="space-y-1.5 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
            <div className="flex justify-between items-start gap-2 text-[11px] font-bold">
              <span className="text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 whitespace-nowrap shrink-0">Ngày SX</span>
              <span className="text-slate-700 dark:text-slate-300 text-right">{formatDateStandard(batch.mfgDate)}</span>
            </div>
            <div className="flex justify-between items-start gap-2 text-[11px] font-bold">
              <span className="text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 whitespace-nowrap shrink-0">Hạn dùng</span>
              <span className={`text-right break-all ${isExpired ? 'text-red-600 dark:text-red-400 font-black' : isNearExpiry ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-700 dark:text-slate-300'}`}>{formatDateStandard(batch.expDate)}</span>
            </div>
        </div>
      </div>

      {/* Footer: Actions */}
      <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-100 dark:border-slate-700/50 relative z-10">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ActionButtons 
              onEdit={() => onEdit(batch)}
              onDelete={() => onDelete(batch)}
            />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => onExpand(batch.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
            <History size={14} /> {isExpanded ? 'Ẩn' : 'Lịch sử'}
          </button>
          <button onClick={() => onView(batch)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all">
            Chi tiết
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 animate-in fade-in">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CircularProgress progress={progressPercent} />
              <div>
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><FlaskConical size={12}/> Tiến độ kiểm nghiệm</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Hoàn thành {progressPercent}% chỉ tiêu</p>
              </div>
            </div>
            {missingCriteria.length > 0 ? (
              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1"><ListChecks size={12}/> Còn thiếu {missingCriteria.length} chỉ tiêu:</p>
                <div className="flex flex-wrap gap-1">
                  {missingCriteria.map((c, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-350 text-[9px] font-bold rounded-md">{c.name}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500"/>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Đã kiểm đủ tất cả chỉ tiêu theo TCCS.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </DSCard>
  );
});

const BatchListItem = memo(({ batch, onEdit, onDelete, onView, onUpdateBatchStatus, isAdmin, testResults }: { batch: any, onEdit: (b: any) => void, onDelete: (batch: any) => void, onView: (batch: any) => void, onUpdateBatchStatus: (status: string, batchId: string) => void, isAdmin: boolean, testResults: TestResult[] }) => {
  const { progressPercent: calculatedProgress } = useMemo(() => calculateBatchProgress(batch, testResults), [batch, testResults]);
  const hasLocalResults = useMemo(() => testResults.some(r => r.batchId === batch.id), [testResults, batch.id]);
  const progressPercent = hasLocalResults ? calculatedProgress : (batch.progressPercent ?? 0);

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3 font-black text-slate-800 dark:text-slate-200">{batch.batchNo}</td>
      <td className="px-4 py-3">
        <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">{batch.product?.name}</div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">{batch.product?.code}</div>

      </td>
      <td className="px-4 py-3 text-xs">
        <div className="font-medium text-slate-600 dark:text-slate-400">SX: {formatDateStandard(batch.mfgDate)}</div>
        <div className="font-bold text-red-500 dark:text-red-400">HD: {formatDateStandard(batch.expDate)}</div>
      </td>

      <td className="px-4 py-3 text-center">
        <BatchStatusSelect 
          status={batch.status} 
          batchId={batch.id} 
          onUpdate={onUpdateBatchStatus} 
          isAdmin={isAdmin} 
        />
        <div className="mt-1.5 text-[9px] font-bold text-slate-400 dark:text-slate-555">Tiến độ: {progressPercent}%</div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end items-center gap-2">
          <ActionButtons 
            onView={() => onView(batch)}
            onEdit={() => onEdit(batch)}
            onDelete={() => onDelete(batch)}
          />
        </div>
      </td>
    </tr>
  );
});

const BatchDataList = ({ viewMode, data, expandedId, onExpand, onEdit, onDelete, onView, testResults, onUpdateBatchStatus, isAdmin }: any) => {
  if (data.length === 0) {
     return <DSEmptyState icon={PackageOpen} title="Không tìm thấy Lô hàng" message="Không có lô hàng nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại của bạn." />;
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.map((batch: any) => (
          <BatchGridItem 
            key={batch.id}
            batch={batch}
            isExpanded={expandedId === batch.id}
            onExpand={onExpand}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={onView}
            testResults={testResults}
            onUpdateBatchStatus={onUpdateBatchStatus}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    );
  }
  return (
    <DSTable>
      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
        <tr className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Số Lô</th>
          <th className="px-4 py-3">Sản phẩm</th>
          <th className="px-4 py-3">Ngày SX / Hạn dùng</th>

          <th className="px-4 py-3 text-center">Trạng thái</th>
          <th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
        {data.map((batch: any) => (
          <BatchListItem 
            key={batch.id} 
            batch={batch} 
            onEdit={onEdit} 
            onDelete={onDelete} 
            onView={onView}
            onUpdateBatchStatus={onUpdateBatchStatus}
            isAdmin={isAdmin}
            testResults={testResults}
          />
        ))}
      </tbody>
    </DSTable>
  );
};

const BatchList: React.FC = () => {
  const products = useAppStore(s => s.products);
  const batches = useAppStore(s => s.batches);
  const tccsList = useAppStore(s => s.tccsList);
  const addBatch = useAppStore(s => s.addBatch);
  const updateBatch = useAppStore(s => s.updateBatch);
  const deleteBatch = useAppStore(s => s.deleteBatch);
  const updateBatchStatus = useAppStore(s => s.updateBatchStatus);
  const isAdmin = useAppStore(s => s.isAdmin);
  const notify = useAppStore(s => s.notify);
  const productFormulas = useAppStore(s => s.productFormulas);

  const testResults = useAppStore(s => s.testResults); // Quay lại dùng dữ liệu phân trang mặc định
  const allTestResults = useAppStore(s => s.allTestResults);
  const sourceResults = (allTestResults && allTestResults.length > 0) ? allTestResults : testResults;
  const user = useAppStore(s => s.user);
  const { batches: hydratedBatches } = useDataGraph(); // Sử dụng dữ liệu đã liên kết
  const [isImportResultModalOpen, setIsImportResultModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const viewMode = useUIStore(s => s.batchViewMode);
  const setViewMode = useUIStore(s => s.setBatchViewMode);
  // --- FILTER & SORT (persisted via UIStore / localStorage) ---
  const filterStatus = useUIStore(s => s.batchFilterStatus);
  const setFilterStatus = useUIStore(s => s.setBatchFilterStatus);
  const filterYear = useUIStore(s => s.batchFilterYear);
  const setFilterYear = useUIStore(s => s.setBatchFilterYear);
  const filterMonth = useUIStore(s => s.batchFilterMonth);
  const setFilterMonth = useUIStore(s => s.setBatchFilterMonth);
  const filterProductId = useUIStore(s => s.batchFilterProductId);
  const setFilterProductId = useUIStore(s => s.setBatchFilterProductId);
  const sortConfig = useUIStore(s => s.batchSortConfig);
  const setSortConfig = useUIStore(s => s.setBatchSortConfig);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number, errors: string[] }>({ count: 0, errors: [] });
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: string, to: string }>({ from: '', to: '' });
  const itemsPerPage = 12;

  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{status: string, batchId: string} | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  const crud = useCrud<Batch>();
  // Dùng trực tiếp hàm fetch từ service để không phụ thuộc vào logic hook
  const fetchTestResultsForStore = fetchTestResultsByBatchId;
  const navigate = useNavigate();

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalOpen(true);
  }

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    hydratedBatches.forEach(b => {
      if (b.mfgDate) {
        years.add(new Date(b.mfgDate).getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [hydratedBatches]);

  const filteredBatches = useMemo(() => {
    const searchNormalized = normalizeSearch(debouncedSearchTerm);
    const hasSearch = searchNormalized.length > 0;

    return hydratedBatches.filter(b => {
      // Tối ưu: Dùng early return (thoát sớm) để tránh tính toán thừa
      if (filterProductId !== '' && b.productId !== filterProductId) return false;
      if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;

      if (hasSearch) {
        if (!normalizeSearch(b.batchNo).includes(searchNormalized) && !normalizeSearch(b.product?.name).includes(searchNormalized)) {
           return false;
        }
      }
      
      if (isAdvancedFilterOpen) {
         if (dateRange.from && (!b.mfgDate || b.mfgDate < dateRange.from)) return false;
         if (dateRange.to && (!b.mfgDate || b.mfgDate > dateRange.to)) return false;
      } else {
         // Tối ưu: Lọc theo Năm/Tháng bằng xử lý chuỗi thay vì parse Date object
         if (filterYear !== 'ALL' || filterMonth !== 'ALL') {
           if (!b.mfgDate) return false;
           if (filterYear !== 'ALL' && b.mfgDate.substring(0, 4) !== filterYear) return false;
           if (filterMonth !== 'ALL') {
              const month = parseInt(b.mfgDate.substring(5, 7), 10).toString();
              if (month !== filterMonth) return false;
           }
         }
      }

      return true;
    }).sort((a, b) => {
      if (sortConfig.key === 'batchNo') {
        return sortConfig.direction === 'asc' 
          ? a.batchNo.localeCompare(b.batchNo)
          : b.batchNo.localeCompare(a.batchNo);
      } else if (sortConfig.key === 'mfgDate') {
        // Tối ưu: Chuỗi ISO ngày tháng có thể so sánh trực tiếp không cần parse Date
        const dateA = a.mfgDate || '';
        const dateB = b.mfgDate || '';
        return sortConfig.direction === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      } else {
        // Default createdAt
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return sortConfig.direction === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
    });  }, [hydratedBatches, debouncedSearchTerm, filterProductId, filterStatus, filterMonth, filterYear, sortConfig, isAdvancedFilterOpen, dateRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterProductId, filterStatus, filterMonth, filterYear, sortConfig, isAdvancedFilterOpen, dateRange]);

  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const currentBatches = filteredBatches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    const lines = importText.trim().split('\n');
    let count = 0;
    const errors: string[] = [];
    const processedBatchNos = new Set<string>(); // Theo dõi các lô đã xử lý trong lần nhập này
    setIsSubmitting(true);
    
    try {
      const productCodeMap = new Map(products.map(p => [p.code.toUpperCase(), p]));
      const existingBatchesSet = new Set(batches.map(b => `${b.productId}-${b.batchNo}`));

      for (const line of lines) {
        // Format: Mã SP | Số Lô | Ngày SX | Hạn dùng
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        const pCode = parts[0]?.trim().toUpperCase();
        const batchNo = parts[1]?.trim().toUpperCase();
        
        if (!pCode || !batchNo) continue;

        const product = productCodeMap.get(pCode);
        if (!product) {
          errors.push(`Không tìm thấy sản phẩm mã "${pCode}" cho lô ${batchNo}`);
          continue;
        }

        // Tìm TCCS theo ngày sản xuất (Backdate logic)
        const availableTccs = tccsList
          .filter(t => t.productId === product.id)
          .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

        if (availableTccs.length === 0) {
          errors.push(`Sản phẩm "${pCode}" chưa có TCCS để gán cho lô ${batchNo}`);
          continue;
        }

        const mfgDateStr = parseDateToISO(parts[2]);
        let assignedTccs = availableTccs[0];
        if (mfgDateStr) {
          const mfgTime = new Date(mfgDateStr).getTime();
          const match = availableTccs.find(t => new Date(t.issueDate).getTime() <= mfgTime);
          assignedTccs = match || availableTccs[availableTccs.length - 1];
        }

        const compositeKey = `${product.id}-${batchNo}`;
        // Kiểm tra trùng trong DB hoặc trùng trong chính file đang nhập
        if (existingBatchesSet.has(compositeKey) || processedBatchNos.has(compositeKey)) {
          errors.push(`Lô "${batchNo}" của sản phẩm "${pCode}" đã tồn tại (hoặc bị trùng lặp)`);
          continue;
        }

        await addBatch({
          id: generateId('batch'),
          productId: product.id,
          tccsId: assignedTccs.id,
          batchNo: batchNo,
          mfgDate: mfgDateStr,
          expDate: parseDateToISO(parts[3]),
          theoreticalYield: 0,
          actualYield: 0,
          yieldUnit: '',
          packaging: '',
          status: BATCH_STATUS.PENDING,
          createdAt: new Date().toISOString()
        });
        processedBatchNos.add(compositeKey);
        count++;
      }

      if (count > 0) {
        logAuditAction({
          action: 'IMPORT',
          collection: 'BATCHES',
          details: `Nhập khẩu ${count} lô hàng từ Excel`,
          performedBy: user?.email || 'unknown'
        });
      }

      notify({ type: 'SUCCESS', title: 'Nhập liệu hoàn tất', message: `Đã nhập thành công ${count} lô hàng.` });
      setImportResult({ count, errors });
      setIsImportResultModalOpen(true);
      setIsImportModalOpen(false); // Chỉ đóng form khi chạy hết vòng lặp thành công
      setImportText('');
    } catch (e) {
      console.error("Lỗi nhập liệu:", e);
      // Không đóng form, giữ nguyên để user sửa
    } finally {
      setIsSubmitting(false); // Luôn tắt loading
    }
  };

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportExcel = () => {
    if (filteredBatches.length === 0) return notify({ type: 'WARNING', message: 'Không có dữ liệu để xuất!' });
    const headers = ['Số Lô', 'Mã SP', 'Tên Sản phẩm', 'Ngày SX', 'Hạn dùng', 'Trạng thái'];
    const rows = filteredBatches.map(b => [
      b.batchNo,
      b.product?.code || '',
      `"${b.product?.name || ''}"`, // Bọc ngoặc kép để tránh lỗi dấu phẩy trong tên SP
      formatDateStandard(b.mfgDate),
      formatDateStandard(b.expDate),
      b.status === 'RELEASED' ? 'Phê duyệt' : b.status === 'REJECTED' ? 'Từ chối' : b.status === 'TESTING' ? 'Đang kiểm' : 'Kế hoạch'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // Thêm BOM để Excel đọc đúng Tiếng Việt
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Danh_sach_lo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditClick = useCallback((batch: Batch) => {
    navigate(`/batches/edit/${batch.id}`);
  }, [navigate]);

  const handleViewClick = useCallback(async (batch: Batch) => {
    navigate(`/batches/${batch.id}`);
  }, [navigate]);

  const handleDeleteClick = useCallback((batch: Batch) => {
    crud.openDelete(batch);
  }, []);

  const handleExpandClick = useCallback((id: string) => {
    setExpandedBatchId(prevId => {
      const isExpanding = prevId !== id;
      
      if (isExpanding) {
        fetchTestResultsForStore(id);
      }
      
      return isExpanding ? id : null;
    });
  }, [fetchTestResultsForStore]);

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteBatch(crud.selectedItem.id);
        // Đóng modal ngay khi xóa thành công
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: `Đã xóa lô ${crud.selectedItem!.batchNo}` });
        
        // Ghi log an toàn
        try {
          logAuditAction({
            action: 'DELETE',
            collection: 'BATCHES',
            documentId: crud.selectedItem!.id,
            details: `Xóa lô ID: ${crud.selectedItem!.id}`,
            performedBy: user?.email || 'unknown'
          });
        } catch (logErr) {
          console.warn("Ghi log thất bại:", logErr);
        }
      } catch (error) {
        console.error("Failed to delete batch:", error);
        // Không đóng modal để người dùng biết có lỗi
      }
    } else {
      crud.close();
    }
  }, [crud.selectedItem, deleteBatch, user]);

  const handleUpdateBatchStatusClick = useCallback((newStatus: string, batchId: string) => {
      setRejectReason('');
      setPendingStatusUpdate({ status: newStatus, batchId });
      setIsStatusConfirmOpen(true);
  }, []);

  const confirmBatchStatusUpdate = async () => {
    if (!pendingStatusUpdate) return;
    try {
      await updateBatchStatus(pendingStatusUpdate.batchId, pendingStatusUpdate.status, rejectReason);
      notify({ type: 'SUCCESS', title: 'Cập nhật trạng thái', message: `Đã chuyển trạng thái lô sang: ${pendingStatusUpdate.status}` });
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái:", error);
      notify({ type: 'ERROR', message: 'Không thể cập nhật trạng thái lô.' });
    } finally {
      setIsStatusConfirmOpen(false);
      setPendingStatusUpdate(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Quản lý Lô & Tồn kho" 
        subtitle="Quản lý dòng đời sản phẩm." 
        icon={Layers} 
        action={
          <div className="flex gap-3">
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-black uppercase text-[10px] transition-all shadow-sm">
              <Download size={16} /> Xuất Excel
            </button>
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-black uppercase text-[10px] transition-all shadow-sm">
              <Upload size={16} /> Nhập Excel
            </button>
            <AddButton onClick={() => navigate('/batches/new')} label="Đăng ký Lô mới" />
          </div>
        } 
      />

      <DSFilterBar>
        <DSSearchInput placeholder="Tìm số lô..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClear={() => setSearchTerm('')} />
        
        {!isAdvancedFilterOpen && (
          <>
            <DSSelect value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-32">
              <option value="ALL">Tất cả năm</option>
              {availableYears.map(year => <option key={year} value={year}>Năm {year}</option>)}
            </DSSelect>
            <DSSelect value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-32">
              <option value="ALL">Tất cả tháng</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => <option key={month} value={month}>Tháng {month}</option>)}
            </DSSelect>
          </>
        )}
        <DSSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-32">
          <option value="ALL">Tất cả trạng thái</option>
          <option value={BATCH_STATUS.PENDING}>Kế hoạch</option>
          <option value={BATCH_STATUS.TESTING}>Đang kiểm</option>
          <option value={BATCH_STATUS.RELEASED}>Phê duyệt</option>
          <option value={BATCH_STATUS.REJECTED}>Loại bỏ</option>
        </DSSelect>
        <DSSelect icon={ArrowUpDown} value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => {
             const [key, direction] = e.target.value.split('-');
             setSortConfig({ key: key as any, direction: direction as any });
           }} className="w-32">
             <option value="createdAt-desc">Mới tạo nhất</option>
             <option value="mfgDate-desc">Ngày SX (Mới)</option>
             <option value="mfgDate-asc">Ngày SX (Cũ)</option>
             <option value="batchNo-asc">Số lô (A-Z)</option>
             <option value="batchNo-desc">Số lô (Z-A)</option>
        </DSSelect>
        
        <button 
          onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
          className={`p-2 rounded-lg border transition-colors ${isAdvancedFilterOpen ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          title="Lọc nâng cao"
        >
          <Filter size={20} />
        </button>

        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      {isAdvancedFilterOpen && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
           <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1"><CalendarRange size={12}/> Từ ngày (SX)</label>
              <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" />
           </div>
           <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1"><CalendarRange size={12}/> Đến ngày (SX)</label>
              <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" />
           </div>
           <div className="space-y-1 md:col-span-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Sản phẩm cụ thể</label>
                <button onClick={() => { setDateRange({ from: '', to: '' }); setFilterProductId(''); setFilterStatus('ALL' as any); }} className="text-[10px] font-bold text-red-500 dark:text-red-400 hover:underline flex items-center gap-1"><X size={10}/> Xóa bộ lọc</button>
              </div>
              <select 
                value={filterProductId} 
                onChange={e => setFilterProductId(e.target.value)} 
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                 <option value="" className="dark:bg-slate-800 dark:text-slate-300">-- Tất cả sản phẩm --</option>
                 {products.map(p => <option key={p.id} value={p.id} className="dark:bg-slate-800 dark:text-slate-300">{p.name} - {p.code}</option>)}
              </select>
           </div>
        </div>
      )}

      <BatchDataList 
        viewMode={viewMode}
        data={currentBatches}
        expandedId={expandedBatchId}
        onExpand={handleExpandClick}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        onView={handleViewClick}
        testResults={sourceResults}
        onUpdateBatchStatus={handleUpdateBatchStatusClick}
        isAdmin={isAdmin}
      />

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Nhập dữ liệu hàng loạt" icon={FileSpreadsheet} color="bg-indigo-600">
        <div className="space-y-6">
          <div className="bg-indigo-50 dark:bg-indigo-950/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
             <h4 className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-4">
                <Info size={16}/> Hướng dẫn xếp cột (Excel/Google Sheets)
             </h4>
             <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-4 leading-relaxed">
                Bạn có thể copy trực tiếp các vùng dữ liệu từ Excel và dán vào ô bên dưới. 
                Hệ thống sẽ tự nhận diện theo thứ tự các cột như sau:
             </p>
             <div className="grid grid-cols-1 gap-2">
                {[
                  "1. Mã Sản phẩm (Bắt buộc - Phải tồn tại)",
                  "2. Số Lô (Bắt buộc)",
                  "3. Ngày SX (YYYY-MM-DD)",
                  "4. Hạn dùng (YYYY-MM-DD)"
                ].map((txt, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-indigo-800 dark:text-indigo-300 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30">
                    <CheckCircle2 size={12} className="text-indigo-400" /> {txt}
                  </div>
                ))}
             </div>
             <div className="mt-6 pt-4 border-t border-indigo-200/50 dark:border-indigo-900/30">
                <p className="text-[9px] font-black text-indigo-400 uppercase mb-2">Ví dụ dữ liệu chuẩn:</p>
                <code className="block p-3 bg-white dark:bg-slate-800 rounded-xl text-[10px] text-slate-600 dark:text-slate-300 font-mono shadow-inner border border-indigo-100 dark:border-indigo-950">
                  VB-001, B010124, 2024-01-01, 2027-01-01
                </code>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="relative">
                <input 
                  type="file" 
                  accept=".csv,.txt" 
                  onChange={handleFileRead} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                />
                <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors">
                   <FileUp size={16} /> Tải lên file CSV/TXT
                </button>
             </div>
             <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">Hỗ trợ file văn bản (.txt, .csv) ngăn cách bởi dấu phẩy hoặc tab.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Dán dữ liệu vào đây</label>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} className="w-full p-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] font-mono text-xs focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-950/30 outline-none transition-all dark:text-slate-250" placeholder="Copy từ Excel và dán tại đây..." />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setIsImportModalOpen(false)} className="px-8 py-4 text-slate-400 dark:text-slate-500 font-black uppercase text-xs">Hủy</button>
            <button onClick={handleBulkImport} disabled={!importText.trim() || isSubmitting} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-100 disabled:opacity-30 disabled:shadow-none flex items-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Tiến hành nhập
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Xác nhận xóa */}
      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleConfirmDelete}
        itemName={crud.selectedItem?.batchNo}
        warningMessage="Tất cả kết quả kiểm nghiệm liên quan cũng sẽ bị xóa. Hành động này không thể hoàn tác."
      />

      {/* Modal Kết quả Nhập Excel */}
      <Modal isOpen={isImportResultModalOpen} onClose={() => setIsImportResultModalOpen(false)} title="Kết quả nhập hàng loạt" icon={Info}>
        <div>
          <p>Đã nhập thành công {importResult.count} lô hàng.</p>
          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="font-bold">Lỗi:</p>
              <ul className="list-disc list-inside max-h-40 overflow-y-auto bg-slate-50 p-2 rounded-lg">
                {importResult.errors.map((error, index) => (
                  <li key={index} className="text-red-600 text-xs">{error}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <button type="button" onClick={() => setIsImportResultModalOpen(false)} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs">Đóng</button>
          </div>
        </div>
      </Modal>

      {/* Modal Lỗi */}
      <Modal isOpen={errorModalOpen} onClose={() => setErrorModalOpen(false)} title="Lỗi" icon={AlertTriangle}>
        <div>
          <p>{errorMessage}</p>
          <div className="flex justify-end pt-4">
            <button type="button" onClick={() => setErrorModalOpen(false)} className="px-10 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-xs">Đóng</button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={isStatusConfirmOpen}
        onClose={() => setIsStatusConfirmOpen(false)}
        onConfirm={confirmBatchStatusUpdate}
        title="Xác nhận chuyển trạng thái"
        message={
          <div className="space-y-3">
            <p>
              Bạn có chắc chắn muốn chuyển trạng thái lô hàng sang{' '}
              <strong className="text-indigo-600">{pendingStatusUpdate?.status === 'RELEASED' ? 'PHÊ DUYỆT' : pendingStatusUpdate?.status === 'REJECTED' ? 'TỪ CHỐI' : pendingStatusUpdate?.status}</strong> không?
            </p>
            {pendingStatusUpdate?.status === 'REJECTED' && (
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Lý do từ chối:</label>
                <textarea 
                  className="w-full border rounded-xl p-3 text-xs bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none"
                  placeholder="Nhập lý do từ chối..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        }
        confirmText="Đồng ý"
        icon={ShieldCheck}
      />
    </div>
  );
};

export default BatchList;
