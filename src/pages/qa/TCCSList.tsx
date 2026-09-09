
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  DocumentTextIcon,
  ChevronDownIcon,
  CalendarDaysIcon,
  CubeIcon,
  Square3Stack3DIcon,
  BeakerIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  EyeIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  FunnelIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowRightIcon,
  ChevronUpDownIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
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
    <DSCard isExpanded={isExpanded} className={`group ${isExpanded ? 'md:col-span-2 xl:col-span-3' : 'hover:-translate-y-1 hover:shadow-lg transition-all duration-300'} relative overflow-hidden bg-surface border border-border`}>
      <div className="p-5 flex flex-col gap-4 relative z-10 h-full">
        {/* Header: Product Name and Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            <CubeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate max-w-[200px]" title={product?.name}>{product?.name || 'Chưa rõ sản phẩm'}</span>
          </div>
          {tccs.isActive 
            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">Hiệu lực</span> 
            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink-muted border border-border">Hết hiệu lực</span>}
        </div>

        {/* Content Box */}
        <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-3 flex-grow">
          {/* Main Info: TCCS Code and Date */}
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100 dark:border-emerald-900/30">
              <DocumentTextIcon className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="font-semibold text-ink text-base leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">{tccs.code}</h3>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-ink-muted">
                <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Ban hành: {formatDateStandard(tccs.issueDate)}</span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
            <Link
              to={`/batches?productId=${tccs.productId}`}
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-ink-soft text-xs font-medium border border-border hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <Square3Stack3DIcon className="w-3.5 h-3.5" />
              {tccs.batchesCount > 0 ? `${tccs.batchesCount} lô` : 'Chưa có lô'}
            </Link>
            {tccs.testResultsCount > 0 && (
              <Link
                to={`/test-results?productId=${tccs.productId}`}
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-ink-soft text-xs font-medium border border-border hover:border-sky-300 dark:hover:border-sky-700 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              >
                <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
                {tccs.testResultsCount} phiếu KN
              </Link>
            )}
            {tccs.testResultsCount > 0 && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
                tccs.passRate >= 80
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                  : tccs.passRate >= 50
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40'
              }`}>
                <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
                Đạt: {tccs.passRate}%
              </span>
            )}
          </div>
        </div>

        {/* Footer: Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
          <div className="relative z-10 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => handleViewHistory(tccs.productId)} 
              className="p-1.5 text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-2 rounded-lg transition-colors" 
              title="Lịch sử phiên bản"
            >
              <ClockIcon className="w-4 h-4" />
            </button>
            <ActionButtons
              onView={() => onView(tccs)}
              onClone={isAdmin ? () => onClone(tccs) : undefined}
              onEdit={isAdmin ? () => onEdit(tccs) : undefined}
              onDelete={isAdmin ? () => onDelete(tccs) : undefined}
            />
          </div>
          <button 
            onClick={() => onExpand(tccs.id)} 
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ml-auto ${
              isExpanded 
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                : 'bg-surface-2 text-ink-soft hover:bg-surface-3 border border-border'
            }`}
          >
            {isExpanded ? 'Đóng lại' : 'Xem cấu trúc'} 
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
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
        <h5 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-2 ${color}`}>
          <BeakerIcon className="w-3.5 h-3.5" /> {title}
        </h5>
        <div className="bg-surface rounded-lg border border-border overflow-hidden mb-3 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 border-b border-border text-[11px] font-semibold text-ink-muted uppercase">
              <tr><th className="px-3.5 py-2">Chỉ tiêu</th><th className="px-3.5 py-2">Mức quy định</th><th className="px-3.5 py-2 text-center">ĐVT</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {criteria.map((c: any, i: number) => c ? (
                <tr key={i} className="hover:bg-surface-2 transition-colors">
                  <td className="px-3.5 py-2 font-medium text-ink">{c.name}</td>
                  <td className="px-3.5 py-2 font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{renderReq(c)}</td>
                  <td className="px-3.5 py-2 text-center text-ink-muted">{c.unit}</td>
                </tr>
              ) : null)}
            </tbody>
          </table>
        </div>
      </div>
    ) : null
  );

  return (
    <div className="px-5 pb-5 pt-3 border-t border-border animate-in slide-in-from-top-4 duration-300 space-y-2 bg-surface-2/40">
      <CriteriaTable title="Chỉ tiêu Lý hóa & Cảm quan" criteria={ensureArray(tccs?.mainQualityCriteria)} color="text-emerald-600 dark:text-emerald-400" />
      <CriteriaTable title="Giới hạn Vi sinh vật" criteria={micro} color="text-teal-600 dark:text-teal-400" />
      <CriteriaTable title="Giới hạn Kim loại nặng" criteria={metal} color="text-rose-600 dark:text-rose-400" />
      {ensureArray(tccs?.mainQualityCriteria).length === 0 && micro.length === 0 && metal.length === 0 && (
        <p className="text-center text-ink-muted italic text-xs py-3">Chưa có chỉ tiêu nào được khai báo.</p>
      )}
    </div>
  );
};

const TCCSListItem = React.memo(({ tccs, product, onView, onClone, onEdit, onDelete, isAdmin }: any) => (
  <tr className="hover:bg-surface-2 transition-colors">
    <td className="px-4 py-3 font-semibold text-ink">{tccs.code}</td>
    <td className="px-4 py-3 font-medium text-ink-soft">{product?.name}</td>
    <td className="px-4 py-3 text-xs text-ink-muted">{formatDateStandard(tccs.issueDate)}</td>
    <td className="px-4 py-3">
      <div className="flex flex-wrap gap-1">
        <Link
          to={`/batches?productId=${tccs.productId}`}
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface text-ink-soft border border-border hover:text-emerald-600 hover:border-emerald-300 transition-colors"
        >
          <Square3Stack3DIcon className="w-3 h-3" /> {tccs.batchesCount} lô
        </Link>
        {tccs.testResultsCount > 0 && (
          <Link
            to={`/test-results?productId=${tccs.productId}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface text-ink-soft border border-border hover:text-sky-600 hover:border-sky-300 transition-colors"
          >
            <ClipboardDocumentCheckIcon className="w-3 h-3" /> {tccs.testResultsCount} KN
          </Link>
        )}
        {tccs.testResultsCount > 0 && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
            tccs.passRate >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
            : tccs.passRate >= 50 ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40'
          }`}>
            <ArrowTrendingUpIcon className="w-3 h-3" /> {tccs.passRate}%
          </span>
        )}
      </div>
    </td>
    <td className="px-4 py-3 text-center">
      {tccs.isActive ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">Hiệu lực</span>
      ) : (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink-muted border border-border">Hết hiệu lực</span>
      )}
    </td>
    <td className="px-4 py-3 text-right">
      <div className="relative z-10 flex justify-end gap-1.5">
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
      <thead className="bg-surface-2 border-b border-border">
        <tr className="text-ink-muted text-xs font-semibold uppercase tracking-wider">
          <th className="px-4 py-3">Mã TCCS</th>
          <th className="px-4 py-3">Sản phẩm</th>
          <th className="px-4 py-3">Ngày ban hành</th>
          <th className="px-4 py-3">Thống kê</th>
          <th className="px-4 py-3 text-center">Trạng thái</th>
          <th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((tccs: any) => (
          <TCCSListItem 
            key={tccs.id} 
            tccs={tccs} 
            product={products.find((p: any) => p.id === tccs.productId)} 
            onView={onView} 
            onClone={onClone} 
            onEdit={onEdit} 
            onDelete={onDelete} 
            isAdmin={isAdmin} 
          />
        ))}
      </tbody>
    </DSTable>
  );
};


const TCCSList: React.FC = () => {
  const products = useAppStore(s => s.products);
  const tccsList = useAppStore(s => s.tccsList);
  const batches = useAppStore(s => s.batches);
  const addTCCS = useAppStore(s => s.addTCCS);
  const updateTCCS = useAppStore(s => s.updateTCCS);
  const deleteTCCS = useAppStore(s => s.deleteTCCS);
  const isAdmin = useAppStore(s => s.isAdmin);
  const notify = useAppStore(s => s.notify);
  const user = useAppStore(s => s.user);
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

  const crud = useCrud<TCCS>();

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteTCCS = useCallback(async (tccs: TCCS) => {
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
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: `Đã xóa TCCS ${crud.selectedItem!.code}` });
        
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
      }
    } else {
      crud.close();
    }
  }, [crud.selectedItem, deleteTCCS, user, crud]);

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
      <tr className="border-b border-border last:border-none hover:bg-surface-2">
        <td className="py-2.5 px-4 text-xs font-medium text-ink-muted">{label}</td>
        <td className="py-2.5 px-4 text-xs text-ink">{val1 || '-'}</td>
        <td className={`py-2.5 px-4 text-xs font-semibold ${isDiff ? 'text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20' : 'text-ink'}`}>
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
    <div className="space-y-6">
      <PageHeader 
        title="Tiêu chuẩn Cơ sở (TCCS)" 
        subtitle="Quản lý định mức kỹ thuật và chỉ tiêu chất lượng sản phẩm." 
        icon={DocumentTextIcon} 
        action={
          isAdmin && <AddButton onClick={() => navigate('/tccs/new')} label="Lập hồ sơ mới" />
        }
      />

      {/* Filter & Search */}
      <DSFilterBar>
        <DSSearchInput placeholder="Tìm theo mã TCCS hoặc tên sản phẩm..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        
        <DSSelect icon={FunnelIcon} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-36">
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

        <DSSelect icon={ChevronUpDownIcon} value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => {
             const [key, direction] = e.target.value.split('-');
             setSortConfig({ key: key as any, direction: direction as any });
           }} className="w-36">
           <option value="code-asc">Mã TCCS (A-Z)</option>
           <option value="code-desc">Mã TCCS (Z-A)</option>
           <option value="issueDate-desc">Mới ban hành</option>
           <option value="issueDate-asc">Cũ nhất</option>
        </DSSelect>

        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={Squares2X2Icon} listIcon={ListBulletIcon} />
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
      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title="Lịch sử Phiên bản TCCS" icon={ClockIcon} color="bg-emerald-600">
        <div className="flex justify-between items-center mb-4 p-3 bg-surface-2 rounded-xl border border-border">
          <p className="text-xs font-medium text-ink flex items-center gap-2">
            <InformationCircleIcon className="w-4 h-4 text-emerald-600" /> Chọn 2 phiên bản để so sánh
          </p>
          <button 
            onClick={() => setIsCompareModalOpen(true)}
            disabled={compareSelection.length !== 2}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-all shadow-xs"
          >
            <ArrowsRightLeftIcon className="w-4 h-4" /> So sánh ({compareSelection.length}/2)
          </button>
        </div>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
           {historyVersions.length > 0 ? (
             <div className="relative border-l-2 border-border ml-3 space-y-4 py-2">
               {historyVersions.map((ver, idx) => (
                 <div key={ver.id} className="relative pl-6">
                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-surface ${idx === 0 ? 'bg-emerald-600' : 'bg-surface-3'}`} />
                    <div className="bg-surface-2 p-3.5 rounded-xl border border-border hover:bg-surface hover:shadow-xs transition-all">
                       <div className="flex justify-between items-start mb-2 gap-3">
                          <input 
                            type="checkbox" 
                            checked={compareSelection.includes(ver.id)}
                            onChange={() => toggleCompareSelection(ver.id)}
                            className="mt-1 w-4 h-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                             <h4 className={`font-semibold text-sm ${idx === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink'}`}>{ver.code}</h4>
                             <p className="text-xs text-ink-muted">Ban hành: {formatDateStandard(ver.issueDate)}</p>
                          </div>
                          {idx === 0 && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Hiện hành</span>}
                       </div>
                       <button onClick={() => { setIsHistoryModalOpen(false); handleEdit(ver); }} className="w-full mt-2 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium text-ink-soft hover:text-emerald-600 hover:border-emerald-300 transition-all">Xem chi tiết / Chỉnh sửa</button>
                    </div>
                 </div>
               ))}
             </div>
           ) : (
             <p className="text-center text-ink-muted text-xs py-4">Chưa có dữ liệu lịch sử cho sản phẩm này.</p>
           )}
        </div>
      </Modal>

      {/* Modal So sánh */}
      <Modal isOpen={isCompareModalOpen} onClose={() => setIsCompareModalOpen(false)} title="So sánh Phiên bản" icon={ArrowsRightLeftIcon} color="bg-emerald-600">
        {compareVersions && (
          <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
             <div className="grid grid-cols-2 gap-4 mb-4 sticky top-0 bg-surface z-10 pb-3 border-b border-border">
                <div className="p-3.5 bg-surface-2 rounded-xl border border-border">
                   <p className="text-xs font-medium text-ink-muted uppercase mb-1">Phiên bản cũ</p>
                   <h4 className="font-semibold text-ink text-sm">{compareVersions[0].code}</h4>
                   <p className="text-xs text-ink-muted">{formatDateStandard(compareVersions[0].issueDate)}</p>
                </div>
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 relative">
                   <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-surface rounded-full p-1 border border-border text-emerald-600 z-20">
                     <ArrowRightIcon className="w-3.5 h-3.5" />
                   </div>
                   <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase mb-1">Phiên bản mới</p>
                   <h4 className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm">{compareVersions[1].code}</h4>
                   <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">{formatDateStandard(compareVersions[1].issueDate)}</p>
                </div>
             </div>
             
             <table className="w-full text-left border-collapse text-xs">
               <thead>
                 <tr className="text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border bg-surface-2">
                   <th className="py-2.5 px-4 w-1/3">Thông tin / Chỉ tiêu</th>
                   <th className="py-2.5 px-4 w-1/3">Bản cũ</th>
                   <th className="py-2.5 px-4 w-1/3">Bản mới</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border">
                 <tr><td colSpan={3} className="py-2 px-4 bg-surface-2/60 text-xs font-semibold text-ink-muted uppercase tracking-wider">Chỉ tiêu chất lượng</td></tr>
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
             <div className="mt-4 flex justify-end">
                <button onClick={() => setIsCompareModalOpen(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-ink rounded-lg text-xs font-medium transition-colors border border-border">Đóng</button>
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TCCSList;
