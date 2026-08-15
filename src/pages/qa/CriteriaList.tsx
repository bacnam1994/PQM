import React, { useState, useMemo, memo, useCallback, useEffect } from 'react';
import { Activity, Edit, Save, AlertCircle, Loader2, ChevronLeft, ChevronRight, LayoutGrid, List, FileText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DSFilterBar, DSSearchInput, DSTable, DSFormInput, DSViewToggle, DSCard, PageHeader, Modal } from '../../components';
import { useUIStore } from '../../store/useUIStore';
import { bulkRenameCriteriaInAllTestResults } from '../../services/testResultService';

interface CriteriaSummary {
  id: string;
  name: string;
  count: number;
  relatedTCCS: { id: string; code: string; product: string; productId?: string }[];
  types: Set<string>; // 'MAIN' | 'SAFETY'
}

const CriteriaGridItem = memo(({ item, onEdit, isAdmin }: { item: CriteriaSummary, onEdit: (item: CriteriaSummary) => void, isAdmin: boolean }) => (
  <DSCard className="p-5 flex flex-col gap-5 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(139,52,235,0.15)] transition-all duration-500 group relative overflow-hidden h-full bg-gradient-to-br from-violet-50/80 via-white to-purple-50/80 dark:from-violet-950/20 dark:via-slate-800 dark:to-purple-950/20 dark:border-slate-700/50">
    {/* Decorative Blob */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-400/10 to-purple-400/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>

    {/* Header */}
    <div className="flex items-start justify-between gap-2 relative z-10">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        <Activity size={14} className="text-violet-500" />
        <span>Chỉ tiêu phân tích</span>
      </div>
      <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest dark:bg-slate-800 dark:text-slate-400">
        Tần suất: {item.count}
      </span>
    </div>

    {/* Glass Box Highlighting Main Content */}
    <div className="bg-gradient-to-br from-white/60 to-white/30 dark:from-slate-800/60 dark:to-slate-900/30 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-[0_4px_20px_-5px_rgba(139,52,235,0.1)] dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)] rounded-2xl p-4 flex flex-col gap-4 relative z-10 mt-2 flex-grow">
      {/* Main Info */}
      <div className="flex items-center gap-4">
        <div className="bg-violet-50/80 dark:bg-violet-950/30 p-3.5 rounded-xl text-violet-600 dark:text-violet-400 shrink-0 border border-violet-100/50 dark:border-violet-800/30 shadow-inner">
          <Activity size={24} />
        </div>
        <div className="flex flex-col">
          <h3 className="font-black text-slate-800 dark:text-slate-200 text-base leading-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-2">{item.name}</h3>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Sử dụng trong {item.relatedTCCS.length} hồ sơ</p>
        </div>
      </div>

      {/* Meta Info */}
      <div className="space-y-2 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 mt-auto">
        <div className="flex flex-wrap gap-1.5">
          {item.relatedTCCS.slice(0, 3).map((t, idx) => (
            <div key={idx} className="bg-white/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-full shadow-sm" title={t.product}>
              {t.code}
            </div>
          ))}
          {item.relatedTCCS.length > 3 && <span className="bg-slate-100/60 dark:bg-slate-800/60 px-2 py-1 rounded-lg text-[10px] text-slate-500 dark:text-slate-400 font-bold border border-slate-200/50 dark:border-slate-700/50">+{item.relatedTCCS.length - 3}</span>}
        </div>
      </div>
    </div>

    {/* Footer */}
    {isAdmin && (
      <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-200/50 dark:border-slate-700/50 relative z-10">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button 
                onClick={() => onEdit(item)}
                className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-950/30 rounded-lg transition-all"
                title="Đổi tên chỉ tiêu"
            >
                <Edit size={16} />
            </button>
        </div>
        <button onClick={() => onEdit(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:text-violet-700 dark:hover:text-violet-400 transition-all ml-auto border border-slate-200/50 dark:border-slate-700/50">
          Đổi tên <Edit size={14} className="opacity-0 group-hover:opacity-100 hidden" />
        </button>
      </div>
    )}
  </DSCard>
));

const CriteriaListItem = memo(({ item, onEdit, isAdmin }: { item: CriteriaSummary, onEdit: (item: CriteriaSummary) => void, isAdmin: boolean }) => (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
        <td className="px-6 py-4">
            <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{item.name}</span>
        </td>
        <td className="px-6 py-4 text-center">
            <span className="bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
            {item.count}
            </span>
        </td>
        <td className="px-6 py-4">
            <div className="flex flex-wrap gap-1">
            {item.relatedTCCS.slice(0, 3).map((t, idx) => (
                <span key={idx} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[150px]" title={t.product}>
                {t.code}
                </span>
            ))}
            {item.relatedTCCS.length > 3 && (
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 font-bold">
                +{item.relatedTCCS.length - 3}
                </span>
            )}
            </div>
        </td>
        <td className="px-6 py-4 text-right">
            {isAdmin && (
                <button 
                onClick={() => onEdit(item)}
                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 dark:hover:text-primary-400 rounded-lg transition-all"
                title="Đổi tên chỉ tiêu"
                >
                <Edit size={16} />
                </button>
            )}
        </td>
    </tr>
));

const CriteriaList = () => {
  const tccsList = useAppStore(state => state.tccsList);
  const products = useAppStore(state => state.products);
  const updateTCCS = useAppStore(state => state.updateTCCS);
  const notify = useAppStore(state => state.notify);
  const isAdmin = useAppStore(state => state.isAdmin);
  const testResults = useAppStore(state => state.testResults);
  const allTestResults = useAppStore(state => state.allTestResults);
  const fetchAllTestResultsForDashboard = useAppStore(state => state.fetchAllTestResultsForDashboard);
  const batches = useAppStore(state => state.batches);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCriteria, setSelectedCriteria] = useState<CriteriaSummary | null>(null);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameScope, setRenameScope] = useState<'global' | 'product'>('global');
  const [targetProductId, setTargetProductId] = useState<string>('');
  const viewMode = useUIStore(s => s.criteriaViewMode);
  const setViewMode = useUIStore(s => s.setCriteriaViewMode);
  
  // Tự động tải đầy đủ phiếu kiểm nghiệm để thống kê danh mục chỉ tiêu 100% chính xác
  useEffect(() => {
    fetchAllTestResultsForDashboard().catch(() => {});
  }, [fetchAllTestResultsForDashboard]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;

  // 1. Tổng hợp dữ liệu chỉ tiêu từ tất cả TCCS và Phiếu kiểm nghiệm
  const criteriaList = useMemo(() => {
    const map = new Map<string, CriteriaSummary>();
    const productMap = new Map(products.map(p => [p.id, p]));
    const batchMap = new Map(batches.map(b => [b.id, b]));
    const tccsMap = new Map(tccsList.map(t => [t.id, t]));
    const effectiveTestResults = allTestResults && allTestResults.length > 0 ? allTestResults : testResults;

    // 1.1. Duyệt qua toàn bộ TCCS hiện có
    tccsList.forEach((tccs) => {
      const product = productMap.get(tccs.productId);
      const productName = product ? product.name : (tccs.productId ? `Sản phẩm đã xóa (${tccs.productId.slice(-6)})` : 'Chưa gán sản phẩm');

      // Helper để xử lý danh sách chỉ tiêu trong TCCS
      const processCriteria = (list: any[], type: string) => {
        if (!list) return;
        list.forEach((c) => {
          if (!c || !c.name) return;
          const normalizedName = c.name.trim();
          
          if (!map.has(normalizedName)) {
            map.set(normalizedName, {
              id: normalizedName,
              name: normalizedName,
              count: 0,
              relatedTCCS: [],
              types: new Set()
            });
          }

          const entry = map.get(normalizedName)!;
          entry.count++;
          entry.types.add(type);
          
          if (!entry.relatedTCCS.some(r => r.id === tccs.id)) {
            entry.relatedTCCS.push({
              id: tccs.id,
              code: tccs.code,
              product: productName,
              productId: tccs.productId
            });
          }
        });
      };

      processCriteria(tccs.mainQualityCriteria, 'MAIN');
      processCriteria(tccs.safetyCriteria, 'SAFETY');
    });

    // 1.2. Thêm các chỉ tiêu từ Phiếu kiểm nghiệm (Test Results)
    effectiveTestResults.forEach((result) => {
      // Tra cứu batch qua batchMap vì result.batch là virtual join trên UI
      const batch = (result.batchId ? batchMap.get(result.batchId) : null) || result.batch;
      
      let productId = batch?.productId;
      if (!productId && batch?.tccsId) {
        const linkedTccs = tccsMap.get(batch.tccsId);
        productId = linkedTccs?.productId;
      }

      const product = productId ? productMap.get(productId) : null;
      const batchNo = batch?.batchNo || 'Không rõ số lô';
      const productName = product 
        ? product.name 
        : (productId ? `Sản phẩm đã xóa (${productId.slice(-6)})` : `Lô ${batchNo}`);
      
      (result.results || []).forEach(entry => {
        if (!entry || !entry.criteriaName) return;
        const normalizedName = entry.criteriaName.trim();
        
        if (!map.has(normalizedName)) {
          map.set(normalizedName, {
            id: normalizedName,
            name: normalizedName,
            count: 0,
            relatedTCCS: [],
            types: new Set()
          });
        }
        
        const mapEntry = map.get(normalizedName)!;
        if (entry.isExtra) {
          mapEntry.types.add('EXTRA');
        }

        const tccsId = batch?.tccsId;
        const existingTCCS = tccsId ? mapEntry.relatedTCCS.find(r => r.id === tccsId) : null;
        
        if (!existingTCCS) {
           if (!mapEntry.relatedTCCS.some(r => r.id === result.id)) {
              mapEntry.relatedTCCS.push({
                 id: result.id,
                 code: `Phiếu: Lô ${batchNo}`,
                 product: productName,
                 productId: productId
              });
              mapEntry.count++;
           }
        }
      });
    });

    // Chuyển Map thành Array và sắp xếp A-Z
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tccsList, products, testResults, allTestResults, batches]);

  // 2. Lọc dữ liệu theo tìm kiếm
  const filteredList = useMemo(() => {
    let result = criteriaList;
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(lowerTerm));
    }
    return result;
  }, [criteriaList, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredList, currentPage, ITEMS_PER_PAGE]);

  // Reset page on search
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode]);

  // 2.5. Lấy danh sách sản phẩm liên quan đến chỉ tiêu được chọn
  const productsUsingCriteria = useMemo(() => {
    if (!selectedCriteria) return [];
    const prodMap = new Map<string, string>(); // id -> name
    selectedCriteria.relatedTCCS.forEach(r => {
      if (r.productId) {
        prodMap.set(r.productId, r.product);
      } else {
        const tccs = tccsList.find(t => t.id === r.id);
        if (tccs) {
          const prod = products.find(p => p.id === tccs.productId);
          if (prod) prodMap.set(prod.id, prod.name);
        }
      }
    });
    return Array.from(prodMap.entries()).map(([id, name]) => ({ id, name }));
  }, [selectedCriteria, tccsList, products]);

  // 3. Xử lý mở Modal sửa
  const handleOpenEdit = useCallback((item: CriteriaSummary) => {
    setSelectedCriteria(item);
    setNewName(item.name);
    setRenameScope('global');
    setTargetProductId('');
  }, []);

  // 4. Logic Đổi tên hàng loạt (Core Feature)
  const handleRename = async () => {
    if (!selectedCriteria || !newName.trim()) return;
    if (renameScope === 'product' && !targetProductId) {
      notify({
        type: 'WARNING',
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn sản phẩm cần áp dụng đổi tên.'
      });
      return;
    }
    if (newName.trim() === selectedCriteria.name) {
      setSelectedCriteria(null);
      return;
    }

    setIsRenaming(true);
    try {
      const oldName = selectedCriteria.name;
      const targetName = newName.trim();
      const tccsUpdates: Promise<void>[] = [];

      // Duyệt qua tất cả TCCS để tìm và thay thế
      tccsList.forEach((tccs) => {
        if (renameScope === 'product' && tccs.productId !== targetProductId) {
          return;
        }

        let hasChange = false;

        // Clone mảng để tránh mutate state trực tiếp
        const newMainCriteria = (tccs.mainQualityCriteria || []).map(c => {
          if (c.name === oldName) {
            hasChange = true;
            return { ...c, name: targetName };
          }
          return c;
        });

        const newSafetyCriteria = (tccs.safetyCriteria || []).map(c => {
          if (c.name === oldName) {
            hasChange = true;
            return { ...c, name: targetName };
          }
          return c;
        });

        // Nếu có thay đổi trong TCCS này, thêm vào danh sách cần update
        if (hasChange) {
          tccsUpdates.push(updateTCCS({
            ...tccs,
            mainQualityCriteria: newMainCriteria,
            safetyCriteria: newSafetyCriteria
          }));
        }
      });
      
      // Cập nhật 100% phiếu kiểm nghiệm liên quan trên toàn bộ database
      const { updatedCount } = await bulkRenameCriteriaInAllTestResults(
        oldName,
        targetName,
        renameScope === 'product' ? targetProductId : undefined
      );

      await Promise.all(tccsUpdates);
      
      notify({
        type: 'SUCCESS',
        title: 'Đổi tên thành công',
        message: renameScope === 'product'
          ? `Đã cập nhật chỉ tiêu từ "${oldName}" thành "${targetName}" cho sản phẩm được chọn (${tccsUpdates.length} hồ sơ TCCS, ${updatedCount} phiếu kiểm nghiệm).`
          : `Đã cập nhật "${oldName}" thành "${targetName}" trên toàn hệ thống (${tccsUpdates.length} hồ sơ TCCS và ${updatedCount} phiếu kiểm nghiệm).`
      });
      
      setSelectedCriteria(null);
    } catch (error) {
      console.error("Lỗi đổi tên chỉ tiêu:", error);
      notify({
        type: 'ERROR',
        title: 'Lỗi hệ thống',
        message: 'Không thể cập nhật tên chỉ tiêu. Vui lòng thử lại.'
      });
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Danh mục Chỉ tiêu" 
        subtitle="Rà soát và chuẩn hóa tên gọi các chỉ tiêu kiểm nghiệm trên toàn hệ thống." 
        icon={Activity}
      />

      <DSFilterBar>
        <DSSearchInput 
          placeholder="Tìm kiếm chỉ tiêu..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold whitespace-nowrap">
          Tổng: {filteredList.length} chỉ tiêu
        </div>
        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      {paginatedList.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            Không tìm thấy chỉ tiêu nào phù hợp.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedList.map((item) => (
                <CriteriaGridItem key={item.id} item={item} onEdit={handleOpenEdit} isAdmin={isAdmin} />
            ))}
        </div>
      ) : (
        <DSTable>
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <tr className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <th className="px-6 py-4">Tên Chỉ tiêu</th>
                    <th className="px-6 py-4 text-center">Tần suất</th>
                    <th className="px-6 py-4">Sử dụng trong (Ví dụ)</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {paginatedList.map((item) => (
                    <CriteriaListItem key={item.id} item={item} onEdit={handleOpenEdit} isAdmin={isAdmin} />
                ))}
            </tbody>
        </DSTable>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                <ChevronLeft size={20} className="dark:text-slate-400" />
            </button>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                Trang {currentPage} / {totalPages}
            </span>
            <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                <ChevronRight size={20} className="dark:text-slate-400" />
            </button>
        </div>
      )}

      {/* Rename Modal */}
      <Modal 
        isOpen={!!selectedCriteria} 
        onClose={() => setSelectedCriteria(null)}
        title="Đổi tên Chỉ tiêu"
        icon={Edit}
      >
        <div className="space-y-6">
          <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 flex gap-3">
            <AlertCircle className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {renameScope === 'product' ? (
                <>
                  Bạn đang đổi tên chỉ tiêu này cho <strong>sản phẩm đã chọn</strong>. 
                  Hệ thống sẽ cập nhật hồ sơ TCCS và toàn bộ các phiếu kết quả cũ của riêng sản phẩm này.
                </>
              ) : (
                <>
                  Bạn đang đổi tên cho <strong>{selectedCriteria?.count}</strong> vị trí sử dụng. 
                  Hành động này sẽ cập nhật đồng loạt trên tất cả các hồ sơ TCCS liên quan.
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2">Tên hiện tại</label>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {selectedCriteria?.name}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2">Phạm vi áp dụng</label>
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => { setRenameScope('global'); setTargetProductId(''); }}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                  renameScope === 'global'
                    ? 'bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                }`}
              >
                Toàn hệ thống
              </button>
              <button
                type="button"
                onClick={() => { setRenameScope('product'); if (productsUsingCriteria.length > 0) setTargetProductId(productsUsingCriteria[0].id); }}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                  renameScope === 'product'
                    ? 'bg-white dark:bg-slate-850 text-slate-850 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                }`}
              >
                Chỉ một sản phẩm
              </button>
            </div>
          </div>

          {renameScope === 'product' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2">Chọn sản phẩm cần đổi tên chỉ tiêu *</label>
              <select
                value={targetProductId}
                onChange={(e) => setTargetProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-slate-300 dark:focus:border-slate-700 rounded-xl font-medium outline-none text-sm text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
              >
                <option value="">-- Chọn sản phẩm --</option>
                {productsUsingCriteria.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <DSFormInput
            label="Tên mới"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nhập tên chuẩn hóa..."
            autoFocus
          />
        </div>

        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button 
            type="button"
            onClick={() => setSelectedCriteria(null)}
            className="px-6 py-2.5 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            type="button"
            onClick={handleRename}
            disabled={isRenaming || !newName.trim() || newName === selectedCriteria?.name || (renameScope === 'product' && !targetProductId)}
            className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-xs uppercase rounded-lg shadow-lg shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 transition-all"
          >
            {isRenaming ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            Lưu thay đổi
          </button>
        </div>
      </Modal>
    </div>
  );
};
export default CriteriaList;