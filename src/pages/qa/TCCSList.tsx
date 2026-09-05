
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  Plus, Search, FileText, ChevronDown, Trash2,
  Calendar, Package, Layers, Beaker, ShieldCheck,
  X, Info, Eye, LayoutGrid, List, CornerDownRight, ArrowRightLeft, Loader2, FlaskConical,
  CheckCircle2, Clock, Copy, Filter, Activity, Thermometer, Edit2, History, GitCompare, ArrowRight, ArrowUpDown, ClipboardCheck, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { TCCS, Product, Criterion, TestResultEntry, CriterionType } from '../../types';
import { logAuditAction } from '../../services/auditService';
import { StatusBadge, PageHeader, Modal, Pagination, DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable, ActionButtons, DeleteModal, AddButton } from '../../components';
import { useCrud, useDataGraph } from '../../hooks';
import { useUIStore } from '../../store/useUIStore';
import { ensureArray, generateId, formatDateStandard } from '../../utils';
import { useNavigate } from 'react-router-dom';


const TCCSGridItem = React.memo(({ tccs, product, isExpanded, onExpand, onView, onClone, onEdit, onDelete, handleViewHistory, isAdmin }: any) => {
  return (
    <DSCard isExpanded={isExpanded} className={`group ${isExpanded ? 'md:col-span-2 xl:col-span-3' : 'hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.08)] transition-all duration-500'} relative overflow-hidden bg-gradient-to-br from-blue-50/80 via-white to-sky-50/80 dark:from-blue-950/20 dark:via-slate-800 dark:to-sky-950/20 dark:border-slate-700/50`}>
      {/* Decorative Blob */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/10 to-sky-400/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>

      <div className="p-5 flex flex-col gap-5 relative z-10 h-full">
        {/* Header: Product Name and Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <Package size={14} className="text-blue-500" />
            <span className="truncate max-w-[200px]" title={product?.name}>{product?.name || 'Chưa rõ sản phẩm'}</span>
          </div>
          {tccs.isActive 
            ? <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest">Hiệu lực</span> 
            : <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-widest">Hết hiệu lực</span>}
        </div>

        {/* Glass Box Highlighting Main Content */}
        <div className="bg-gradient-to-br from-white/60 to-white/30 dark:from-slate-900/60 dark:to-slate-900/30 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-[0_4px_20px_-5px_rgba(59,130,246,0.1)] dark:shadow-[0_4px_20px_-5px_rgba(59,130,246,0.05)] rounded-2xl p-4 flex flex-col gap-4 mt-2 flex-grow">
          {/* Main Info: TCCS Code and Date */}
          <div className="flex items-center gap-4">
            <div className="bg-blue-50/80 dark:bg-blue-950/50 p-3.5 rounded-xl text-blue-600 dark:text-blue-400 shrink-0 border border-blue-100/50 dark:border-blue-900/30 shadow-inner">
              <FileText size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="font-black text-slate-800 dark:text-slate-200 text-lg leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{tccs.code}</h3>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <Calendar size={12} />
                <span>Ban hành: {formatDateStandard(tccs.issueDate)}</span>
              </div>
            </div>
          </div>

          {/* --- BADGES LIÊN KẾT DỮ LIỆU --- */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100/60 dark:border-slate-700/40">
            {/* Badge: Số lô áp dụng */}
            <Link
              to={`/batches?productId=${tccs.productId}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-black border border-blue-100 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Layers size={10} />
              {tccs.batchesCount > 0 ? `${tccs.batchesCount} lô` : 'Chưa có lô'}
            </Link>
            {/* Badge: Số phiếu KN */}
            {tccs.testResultsCount > 0 && (
              <Link
                to={`/test-results?productId=${tccs.productId}`}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 text-[10px] font-black border border-cyan-100 dark:border-cyan-900/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
              >
                <ClipboardCheck size={10} />
                {tccs.testResultsCount} phiếu KN
              </Link>
            )}
            {/* Badge: Tỷ lệ đạt */}
            {tccs.testResultsCount > 0 && (
              <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border ${
                tccs.passRate >= 80
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40'
                  : tccs.passRate >= 50
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/40'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/40'
              }`}>
                <TrendingUp size={10} />
                Đạt: {tccs.passRate}%
              </span>
            )}
          </div>
        </div>

        {/* Footer: Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-slate-700/50 mt-auto">
          <div className="relative z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={() => handleViewHistory(tccs.productId)} className="p-2 text-slate-400 dark:text-slate-550 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors" title="Lịch sử phiên bản"><History size={16} /></button>
            <ActionButtons
              onView={() => onView(tccs)}
              onClone={isAdmin ? () => onClone(tccs) : undefined}
              onEdit={isAdmin ? () => onEdit(tccs) : undefined}
              onDelete={isAdmin ? () => onDelete(tccs) : undefined}
            />
          </div>
          <button onClick={() => onExpand(tccs.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all ml-auto ${isExpanded ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-slate-50/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700'}`}>
            {isExpanded ? 'Đóng lại' : 'Xem cấu trúc'} <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isExpanded && <TCCSExpandedStructure tccs={tccs} />}
    </DSCard>
  );
});


const TCCSExpandedStructure = ({ tccs }: { tccs: any }) => {
  const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
  const safety = ensureArray(tccs?.safetyCriteria);
  const micro = safety.filter((c: any) => {
    if (!c) return false;
    const nl = (c.name || '').toLowerCase();
    return c.category === 'micro' || (!c.category && !HEAVY_METAL_KEYWORDS.some(kw => nl.includes(kw)));
  });
  const metal = safety.filter((c: any) => {
    if (!c) return false;
    const nl = (c.name || '').toLowerCase();
    return c.category === 'metal' || (!c.category && HEAVY_METAL_KEYWORDS.some(kw => nl.includes(kw)));
  });

  const renderReq = (c: any) => {
    if (c.type === 'NUMBER') {
      if (c.min != null && c.max != null) return `${c.min} ~ ${c.max}`;
      if (c.min != null) return `≥ ${c.min}`;
      if (c.max != null) return `≤ ${c.max}`;
      return '?';
    }
    return c.expectedText || '';
  };

  const CriteriaTable = ({ title, criteria, color }: { title: string; criteria: any[]; color: string }) => (
    criteria.length > 0 ? (
      <div>
        <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 mb-2 ${color}`}>
          <Activity size={12}/> {title}
        </h5>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden mb-4 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-400 dark:text-slate-555 uppercase">
              <tr><th className="px-4 py-2.5">Chỉ tiêu</th><th className="px-4 py-2.5">Mức quy định</th><th className="px-4 py-2.5 text-center">ĐVT</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
              {criteria.map((c: any, i: number) => c ? (
                <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
                  <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-200">{c.name}</td>
                  <td className="px-4 py-2.5 font-black text-blue-600 dark:text-blue-400 font-mono">{renderReq(c)}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400">{c.unit}</td>
                </tr>
              ) : null)}
            </tbody>
          </table>
        </div>
      </div>
    ) : null
  );

  return (
    <div className="px-6 pb-6 pt-4 border-t border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300 space-y-2 bg-slate-50/50 dark:bg-slate-900/10">
      <CriteriaTable title="Chỉ tiêu Lý hóa & Cảm quan" criteria={ensureArray(tccs?.mainQualityCriteria)} color="text-indigo-600" />
      <CriteriaTable title="Giới hạn Vi sinh vật" criteria={micro} color="text-emerald-600" />
      <CriteriaTable title="Giới hạn Kim loại nặng" criteria={metal} color="text-red-600" />
      {ensureArray(tccs?.mainQualityCriteria).length === 0 && micro.length === 0 && metal.length === 0 && (
        <p className="text-center text-slate-400 dark:text-slate-500 italic text-xs py-4">Chưa có chỉ tiêu nào được khai báo.</p>
      )}
    </div>
  );
};

const TCCSListItem = React.memo(({ tccs, product, onView, onClone, onEdit, onDelete, isAdmin }: any) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
    <td className="px-4 py-3 font-black text-slate-800 dark:text-slate-200">{tccs.code}</td>
    <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">{product?.name}</td>
    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{formatDateStandard(tccs.issueDate)}</td>
    <td className="px-4 py-3">
      <div className="flex flex-wrap gap-1">
        <Link
          to={`/batches?productId=${tccs.productId}`}
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-black hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border border-blue-100 dark:border-blue-900/40"
        >
          <Layers size={9} /> {tccs.batchesCount} lô
        </Link>
        {tccs.testResultsCount > 0 && (
          <Link
            to={`/test-results?productId=${tccs.productId}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 text-[10px] font-black hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors border border-cyan-100 dark:border-cyan-900/40"
          >
            <ClipboardCheck size={9} /> {tccs.testResultsCount} KN
          </Link>
        )}
        {tccs.testResultsCount > 0 && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black border ${
            tccs.passRate >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40'
            : tccs.passRate >= 50 ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/40'
            : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/40'
          }`}>
            <TrendingUp size={9} /> {tccs.passRate}%
          </span>
        )}
      </div>
    </td>
    <td className="px-4 py-3 text-center">
      {tccs.isActive ? <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[10px] font-black uppercase">Hiệu lực</span> : <span className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase">Hết hiệu lực</span>}
    </td>
    <td className="px-4 py-3 text-right">
      <div className="relative z-10 flex justify-end gap-2">
        <ActionButtons
          onView={() => onView(tccs)}
          onClone={isAdmin ? () => onClone(tccs) : undefined}
          onEdit={isAdmin ? () => onEdit(tccs) : undefined}
          onDelete={isAdmin ? () => onDelete(tccs) : undefined}
        />
      </div>
    </td>
  </tr>
));


const TCCSDataList = ({ viewMode, data, products, expandedIds, onExpand, onView, onClone, onEdit, onDelete, handleViewHistory, isAdmin }: any) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {data.map((tccs: any) => (
          <TCCSGridItem 
            key={tccs.id}
            tccs={tccs}
            product={products.find((p: any) => p.id === tccs.productId)}
            isExpanded={expandedIds.has(tccs.id)}
            onExpand={onExpand}
            onView={onView}
            onClone={onClone}
            onEdit={onEdit}
            onDelete={onDelete}
            handleViewHistory={handleViewHistory}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    );
  }
  return (
    <DSTable>
      <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80">
        <tr className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Mã TCCS</th><th className="px-4 py-3">Sản phẩm</th><th className="px-4 py-3">Ngày ban hành</th><th className="px-4 py-3">Thống kê</th><th className="px-4 py-3 text-center">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50 dark:divide-zinc-850">
        {data.map((tccs: any) => (
          <TCCSListItem key={tccs.id} tccs={tccs} product={products.find((p: any) => p.id === tccs.productId)} onView={onView} onClone={onClone} onEdit={onEdit} onDelete={onDelete} isAdmin={isAdmin} />
        ))}
      </tbody>
    </DSTable>
  );
};


const TCCSList: React.FC = () => {
  const products = useAppStore(s => s.products);
  const tccsList = useAppStore(s => s.tccsList);
  const batches = useAppStore(s => s.batches);
  const productFormulas = useAppStore(s => s.productFormulas);
  const addTCCS = useAppStore(s => s.addTCCS);
  const updateTCCS = useAppStore(s => s.updateTCCS);
  const deleteTCCS = useAppStore(s => s.deleteTCCS);
  const isAdmin = useAppStore(s => s.isAdmin);
  const notify = useAppStore(s => s.notify);
  const user = useAppStore(s => s.user);
  // Dùng useDataGraph để lấy HydratedTCCS (có batchesCount, testResultsCount, passRate)
  const { tccsList: hydratedTccsList } = useDataGraph();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: 'issueDate' | 'code'; direction: 'asc' | 'desc' }>({ key: 'code', direction: 'asc' });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const viewMode = useUIStore(s => s.tccsViewMode);
  const setViewMode = useUIStore(s => s.setTccsViewMode);
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;

  // Use CRUD Hook
  const crud = useCrud<TCCS>();

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteTCCS = useCallback(async (tccs: TCCS) => {
    // Check if the TCCS is used by any valid batch object
    const isUsed = batches.some(b => b && b.tccsId === tccs.id);
    if (isUsed) {
      notify({ type: 'WARNING', title: 'Không thể xóa', message: 'TCCS này đang được sử dụng bởi một hoặc nhiều Lô sản xuất.' });
      return;
    }
    crud.openDelete(tccs);
  }, [batches, notify, crud]);

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteTCCS(crud.selectedItem.id);
        // Đóng modal ngay khi xóa thành công
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: `Đã xóa TCCS ${crud.selectedItem!.code}` });
        
        // Ghi log an toàn
        try {
          logAuditAction({
            action: 'DELETE',
            collection: 'TCCS',
            documentId: crud.selectedItem!.id,
            details: `Xóa TCCS: ${crud.selectedItem!.code}`,
            performedBy: user?.email || 'unknown'
          });
        } catch (logErr) {
          console.warn("Ghi log thất bại:", logErr);
        }
      } catch (error) {
        console.error("Failed to delete TCCS:", error);
        // AppContext handles error notification
      }
    } else {
      crud.close();
    }
  }, [crud.selectedItem, deleteTCCS, user]);

  const handleEdit = useCallback((tccs: TCCS) => {
    navigate(`/tccs/edit/${tccs.id}`);
  }, [navigate]);

  const handleClone = useCallback((tccs: TCCS) => {
    navigate(`/tccs/new?cloneId=${tccs.id}`);
  }, [navigate]);

  const handleViewHistory = useCallback((pid: string) => {
    setHistoryProductId(pid);
    setCompareSelection([]);
    setIsHistoryModalOpen(true);
  }, []);

  const handleView = useCallback((tccs: TCCS) => {
    navigate(`/tccs/detail/${tccs.id}`);
  }, [navigate]);

  const historyVersions = useMemo(() => {
    if (!historyProductId) return [];
    return tccsList
      .filter(t => t.productId === historyProductId)
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [tccsList, historyProductId]);

  const toggleCompareSelection = (id: string) => {
    setCompareSelection(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const compareVersions = useMemo(() => {
    if (compareSelection.length !== 2) return null;
    const v1 = tccsList.find(t => t.id === compareSelection[0]);
    const v2 = tccsList.find(t => t.id === compareSelection[1]);
    if (!v1 || !v2) return null;
    return new Date(v1.issueDate) < new Date(v2.issueDate) ? [v1, v2] : [v2, v1];
  }, [compareSelection, tccsList]);

  const filteredTCCS = useMemo(() => {
    const productMap = new Map(products.map(p => [p.id, p]));
    // Dùng hydratedTccsList để có batchesCount, testResultsCount, passRate
    const sourceList = hydratedTccsList.length > 0 ? hydratedTccsList : tccsList;

    return sourceList.filter(t => {
      const p = productMap.get(t.productId);
      const matchesSearch = t.code.toLowerCase().includes(searchTerm.toLowerCase()) || (p?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProduct = !filterProductId || t.productId === filterProductId;
      const matchesStatus = filterStatus === 'ALL' ? true : filterStatus === 'ACTIVE' ? t.isActive : !t.isActive;
      const issueDate = new Date(t.issueDate);
      const matchesYear = filterYear === 'ALL' || issueDate.getFullYear().toString() === filterYear;
      const matchesMonth = filterMonth === 'ALL' || (issueDate.getMonth() + 1).toString() === filterMonth;
      return matchesSearch && matchesProduct && matchesStatus && matchesYear && matchesMonth;
    }).sort((a, b) => {
      if (sortConfig.key === 'code') {
        return sortConfig.direction === 'asc' 
          ? a.code.localeCompare(b.code)
          : b.code.localeCompare(a.code);
      }
      const dateA = new Date(a.issueDate).getTime();
      const dateB = new Date(b.issueDate).getTime();
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [tccsList, hydratedTccsList, products, searchTerm, filterProductId, filterStatus, sortConfig, filterMonth, filterYear]);


  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProductId, filterStatus, sortConfig, filterMonth, filterYear]);

  const totalPages = Math.ceil(filteredTCCS.length / ITEMS_PER_PAGE);
  const paginatedTCCS = filteredTCCS.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const renderComparisonRow = (label: string, val1: any, val2: any) => {
    const isDiff = val1 !== val2;
    return (
      <tr className="border-b border-slate-100 last:border-none hover:bg-slate-50">
        <td className="py-3 px-4 text-xs font-bold text-slate-500">{label}</td>
        <td className="py-3 px-4 text-xs text-slate-700 font-medium">{val1 || '-'}</td>
        <td className={`py-3 px-4 text-xs font-bold ${isDiff ? 'text-blue-600 bg-blue-50' : 'text-slate-700'}`}>
          {val2 || '-'}
        </td>
      </tr>
    );
  };

  const formatCriterion = (c?: Criterion) => {
    if (!c) return '-';
    if (c.type === CriterionType.NUMBER) {
      if (c.min !== undefined && c.max !== undefined) return `${c.min} ~ ${c.max} ${c.unit || ''}`;
      if (c.min !== undefined) return `≥ ${c.min} ${c.unit || ''}`;
      if (c.max !== undefined) return `≤ ${c.max} ${c.unit || ''}`;
      return `? ~ ? ${c.unit || ''}`;
    }
    return c.expectedText || '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Tiêu chuẩn Cơ sở (TCCS)" 
        subtitle="Quản lý định mức kỹ thuật và chỉ tiêu chất lượng sản phẩm." 
        icon={FileText} 
        action={
              isAdmin && <AddButton onClick={() => navigate('/tccs/new')} label="Lập hồ sơ mới" />
        }
      />

      {/* Filter & Search */}
      <DSFilterBar>
        <DSSearchInput placeholder="Tìm theo mã TCCS hoặc tên sản phẩm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        
        <DSSelect icon={Filter} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-32">
           <option value="ALL">Tất cả trạng thái</option>
           <option value="ACTIVE">Đang hiệu lực</option>
           <option value="INACTIVE">Hết hiệu lực</option>
        </DSSelect>

        <DSSelect value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-24">
          <option value="ALL">Năm</option>
        {Array.from(new Set(tccsList.map(t => new Date(t.issueDate).getFullYear()))).sort((a, b) => (b as number) - (a as number)).map(y => <option key={String(y)} value={String(y)}>{y}</option>)}
        </DSSelect>

        <DSSelect value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-24">
          <option value="ALL">Tháng</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </DSSelect>

        <DSSelect value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)} className="w-full md:w-48">
          <option value="">Tất cả sản phẩm</option>
        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </DSSelect>

        <DSSelect icon={ArrowUpDown} value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => {
             const [key, direction] = e.target.value.split('-');
             setSortConfig({ key: key as any, direction: direction as any });
           }} className="w-32">
           <option value="code-asc">Mã TCCS (A-Z)</option>
           <option value="code-desc">Mã TCCS (Z-A)</option>
           <option value="issueDate-desc">Mới ban hành</option>
           <option value="issueDate-asc">Cũ nhất</option>
        </DSSelect>

        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      <TCCSDataList 
        viewMode={viewMode}
        data={paginatedTCCS}
      products={products}
        expandedIds={expandedIds}
        onExpand={toggleExpand}
        onView={handleView}
        onClone={handleClone}
        onEdit={handleEdit}
        onDelete={handleDeleteTCCS}
        handleViewHistory={handleViewHistory}
        isAdmin={isAdmin}
      />

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Modal Xóa */}
      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleConfirmDelete} 
        itemName={crud.selectedItem?.code}
      />

      {/* Modal Lịch sử Phiên bản */}
      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title="Lịch sử Phiên bản TCCS" icon={History} color="bg-indigo-600">
        <div className="flex justify-between items-center mb-4 px-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
          <p className="text-xs font-bold text-indigo-800 flex items-center gap-2"><Info size={14}/> Chọn 2 phiên bản để so sánh</p>
          <button 
            onClick={() => setIsCompareModalOpen(true)}
            disabled={compareSelection.length !== 2}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-all shadow-md"
          >
            <GitCompare size={14} /> So sánh ({compareSelection.length}/2)
          </button>
        </div>
        <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
           {historyVersions.length > 0 ? (
             <div className="relative border-l-2 border-indigo-100 ml-3 space-y-6 py-2">
               {historyVersions.map((ver, idx) => (
                 <div key={ver.id} className="relative pl-6">
                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${idx === 0 ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group">
                       <div className="flex justify-between items-start mb-2 gap-3">
                          <input 
                            type="checkbox" 
                            checked={compareSelection.includes(ver.id)}
                            onChange={() => toggleCompareSelection(ver.id)}
                            className="mt-1 w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                          />
                          <div>
                             <h4 className={`font-bold text-sm ${idx === 0 ? 'text-indigo-700' : 'text-slate-700'}`}>{ver.code}</h4>
                             <p className="text-[10px] font-bold text-zinc-400 uppercase">Ban hành: {formatDateStandard(ver.issueDate)}</p>
                          </div>
                          {idx === 0 && <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-2 py-1 rounded uppercase">Hiện hành</span>}
                       </div>
                       <button onClick={() => { setIsHistoryModalOpen(false); handleEdit(ver); }} className="w-full mt-2 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all">Xem chi tiết / Chỉnh sửa</button>
                    </div>
                 </div>
               ))}
             </div>
           ) : (
             <p className="text-center text-slate-400 text-sm py-4">Chưa có dữ liệu lịch sử cho sản phẩm này.</p>
           )}
        </div>
      </Modal>

      {/* Modal So sánh */}
      <Modal isOpen={isCompareModalOpen} onClose={() => setIsCompareModalOpen(false)} title="So sánh Phiên bản" icon={GitCompare} color="bg-blue-600">
        {compareVersions && (
          <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
             <div className="grid grid-cols-2 gap-4 mb-6 sticky top-0 bg-white z-10 pb-4 border-b border-slate-100">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Phiên bản cũ</p>
                   <h4 className="font-bold text-slate-700 text-sm">{compareVersions[0].code}</h4>
                   <p className="text-[10px] font-bold text-zinc-500">{formatDateStandard(compareVersions[0].issueDate)}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 relative">
                   <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-white rounded-full p-1 border border-blue-100 text-blue-400 z-20"><ArrowRight size={14}/></div>
                   <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Phiên bản mới</p>
                   <h4 className="font-bold text-blue-700 text-sm">{compareVersions[1].code}</h4>
                   <p className="text-[10px] font-bold text-blue-500">{formatDateStandard(compareVersions[1].issueDate)}</p>
                </div>
             </div>
             
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100">
                   <th className="py-2 px-4 w-1/3">Thông tin / Chỉ tiêu</th>
                   <th className="py-2 px-4 w-1/3">Bản cũ</th>
                   <th className="py-2 px-4 w-1/3">Bản mới</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {/* Criteria Comparison */}
                 <tr><td colSpan={3} className="py-3 px-4 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Chỉ tiêu chất lượng</td></tr>
                 {Array.from(new Set([
                    ...(compareVersions[0].mainQualityCriteria || []).filter(c => c?.name).map(c => c.name),
                    ...(compareVersions[0].safetyCriteria || []).filter(c => c?.name).map(c => c.name),
                    ...(compareVersions[1].mainQualityCriteria || []).filter(c => c?.name).map(c => c.name),
                    ...(compareVersions[1].safetyCriteria || []).filter(c => c?.name).map(c => c.name)
                 ])).sort().map(name => {
                    const c1 = [...(compareVersions[0].mainQualityCriteria || []), ...(compareVersions[0].safetyCriteria || [])].find(c => c?.name === name);
                    const c2 = [...(compareVersions[1].mainQualityCriteria || []), ...(compareVersions[1].safetyCriteria || [])].find(c => c?.name === name);
                    const val1 = formatCriterion(c1);
                    const val2 = formatCriterion(c2);
                    return renderComparisonRow(name, val1, val2);
                 })}
               </tbody>
             </table>
             <div className="mt-6 flex justify-end">
                <button onClick={() => setIsCompareModalOpen(false)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase transition-colors">Đóng</button>
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TCCSList;
