import React, { useState, useMemo, memo } from 'react';
import { Activity, Edit, Save, AlertCircle, Loader2, ChevronLeft, ChevronRight, LayoutGrid, List, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useTestResultContext } from '../context/TestResultContext';
import { PageHeader, Modal } from '../components/CommonUI';
import { DSFilterBar, DSSearchInput, DSTable, DSFormInput, DSViewToggle, DSCard } from '../components/DesignSystem';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { debug } from '../utils/debug';

interface CriteriaSummary {
  id: string;
  name: string;
  count: number;
  relatedTCCS: { id: string; code: string; product: string }[];
  types: Set<string>; // 'MAIN' | 'SAFETY'
}

const CriteriaGridItem = memo(({ item, onEdit }: { item: CriteriaSummary, onEdit: (item: CriteriaSummary) => void }) => (
  <DSCard className="p-5 flex flex-col group h-full">
    <div className="flex justify-between items-start mb-3">
      <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
        <Activity size={20}/>
      </div>
      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
        Tần suất: {item.count}
      </span>
    </div>
    <div className="flex-grow">
      <h3 className="font-black text-slate-800 text-sm mb-4 line-clamp-2 min-h-[2.5em]">{item.name}</h3>
    </div>
    <div className="space-y-2 border-t border-slate-100 pt-3 mt-auto">
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><FileText size={12}/> Dùng trong ({item.relatedTCCS.length}) TCCS</p>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button 
                onClick={() => onEdit(item)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Đổi tên chỉ tiêu"
            >
                <Edit size={16} />
            </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {item.relatedTCCS.slice(0, 3).map((t, idx) => (
          <div key={idx} className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[10px] text-slate-600 font-medium truncate max-w-full" title={t.product}>
            {t.code}
          </div>
        ))}
        {item.relatedTCCS.length > 3 && <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[10px] text-slate-400 font-bold">+{item.relatedTCCS.length - 3}</span>}
      </div>
    </div>
  </DSCard>
));

const CriteriaListItem = memo(({ item, onEdit }: { item: CriteriaSummary, onEdit: (item: CriteriaSummary) => void }) => (
    <tr className="hover:bg-slate-50 transition-colors group">
        <td className="px-6 py-4">
            <span className="font-bold text-slate-700 text-sm">{item.name}</span>
        </td>
        <td className="px-6 py-4 text-center">
            <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-xs font-bold">
            {item.count}
            </span>
        </td>
        <td className="px-6 py-4">
            <div className="flex flex-wrap gap-1">
            {item.relatedTCCS.slice(0, 3).map((t, idx) => (
                <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 truncate max-w-[150px]" title={t.product}>
                {t.code}
                </span>
            ))}
            {item.relatedTCCS.length > 3 && (
                <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-1 rounded border border-slate-200 font-bold">
                +{item.relatedTCCS.length - 3}
                </span>
            )}
            </div>
        </td>
        <td className="px-6 py-4 text-right">
            <button 
            onClick={() => onEdit(item)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Đổi tên chỉ tiêu"
            >
            <Edit size={16} />
            </button>
        </td>
    </tr>
));

const CriteriaList = () => {
  const { state, updateTCCS, notify } = useAppContext();
  const { testResults, updateTestResult } = useTestResultContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCriteria, setSelectedCriteria] = useState<CriteriaSummary | null>(null);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('criteria_view_mode', 'list');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;

  // 1. Tổng hợp dữ liệu chỉ tiêu từ tất cả TCCS
  const criteriaList = useMemo(() => {
    const map = new Map<string, CriteriaSummary>();

    state.tccsList.forEach((tccs) => {
      const product = state.products.find(p => p.id === tccs.productId);
      const productName = product ? product.name : 'Unknown Product';

      // Helper để xử lý danh sách chỉ tiêu
      const processCriteria = (list: any[], type: string) => {
        if (!list) return;
        list.forEach((c) => {
          if (!c || !c.name) return;
          const normalizedName = c.name.trim();
          
          if (!map.has(normalizedName)) {
            map.set(normalizedName, {
              id: normalizedName, // Dùng tên làm ID tạm
              name: normalizedName,
              count: 0,
              relatedTCCS: [],
              types: new Set()
            });
          }

          const entry = map.get(normalizedName)!;
          entry.count++;
          entry.types.add(type);
          
          // Chỉ thêm vào danh sách liên quan nếu chưa có (tránh duplicate nếu 1 TCCS dùng 2 lần - hiếm nhưng có thể)
          if (!entry.relatedTCCS.some(r => r.id === tccs.id)) {
            entry.relatedTCCS.push({
              id: tccs.id,
              code: tccs.code,
              product: productName
            });
          }
        });
      };

      processCriteria(tccs.mainQualityCriteria, 'MAIN');
      processCriteria(tccs.safetyCriteria, 'SAFETY');
    });

    // Chuyển Map thành Array và sắp xếp A-Z
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.tccsList, state.products]);

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
  }, [filteredList, currentPage]);

  // Reset page on search
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, viewMode]);

  // 3. Xử lý mở Modal sửa
  const handleOpenEdit = (item: CriteriaSummary) => {
    setSelectedCriteria(item);
    setNewName(item.name);
  };

  // 4. Logic Đổi tên hàng loạt (Core Feature)
  const handleRename = async () => {
    if (!selectedCriteria || !newName.trim()) return;
    if (newName.trim() === selectedCriteria.name) {
      setSelectedCriteria(null);
      return;
    }

    setIsRenaming(true);
    try {
      const oldName = selectedCriteria.name;
      const targetName = newName.trim();
      const tccsUpdates: Promise<void>[] = [];
      const testResultUpdates: Promise<void>[] = [];

      // Duyệt qua tất cả TCCS để tìm và thay thế
      state.tccsList.forEach((tccs) => {
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
            safetyCriteria: newSafetyCriteria,
            updatedAt: new Date().toISOString() // Cập nhật thời gian sửa
          }));
        }
      });
      
      // Duyệt qua tất cả Test Results để tìm và thay thế
      testResults.forEach(result => {
        let hasChange = false;
        const newResults = result.results.map(entry => {
          if (entry.criteriaName === oldName) {
            hasChange = true;
            return { ...entry, criteriaName: targetName };
          }
          return entry;
        });

        if (hasChange) {
          // updateTestResult expects the full object, not just the changed part
          testResultUpdates.push(updateTestResult({
            ...result,
            results: newResults,
          }));
        }
      });

      await Promise.all([...tccsUpdates, ...testResultUpdates]);
      
      notify({
        type: 'SUCCESS',
        title: 'Đổi tên thành công',
        message: `Đã cập nhật "${oldName}" thành "${targetName}" trong ${tccsUpdates.length} hồ sơ TCCS và ${testResultUpdates.length} phiếu kết quả.`
      });
      
      setSelectedCriteria(null);
    } catch (error) {
      debug.error("Lỗi đổi tên chỉ tiêu:", error);
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
        <div className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold whitespace-nowrap">
          Tổng: {filteredList.length} chỉ tiêu
        </div>
        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      {paginatedList.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm italic bg-white rounded-2xl border border-slate-100 shadow-sm">
            Không tìm thấy chỉ tiêu nào phù hợp.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedList.map((item) => (
                <CriteriaGridItem key={item.id} item={item} onEdit={handleOpenEdit} />
            ))}
        </div>
      ) : (
        <DSTable>
            <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    <th className="px-6 py-4">Tên Chỉ tiêu</th>
                    <th className="px-6 py-4 text-center">Tần suất</th>
                    <th className="px-6 py-4">Sử dụng trong (Ví dụ)</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {paginatedList.map((item) => (
                    <CriteriaListItem key={item.id} item={item} onEdit={handleOpenEdit} />
                ))}
            </tbody>
        </DSTable>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-slate-100">
            <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-slate-600">
                Trang {currentPage} / {totalPages}
            </span>
            <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                <ChevronRight size={20} />
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
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-800 leading-relaxed">
              Bạn đang đổi tên cho <strong>{selectedCriteria?.count}</strong> vị trí sử dụng. 
              Hành động này sẽ cập nhật đồng loạt trên tất cả các hồ sơ TCCS liên quan.
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Tên hiện tại</label>
            <div className="p-3 bg-slate-100 rounded-xl text-sm font-bold text-slate-500 border border-slate-200">
              {selectedCriteria?.name}
            </div>
          </div>

          <DSFormInput
            label="Tên mới"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nhập tên chuẩn hóa..."
            autoFocus
          />
        </div>

        <div className="pt-4 mt-4 border-t flex justify-end gap-3">
          <button 
            type="button"
            onClick={() => setSelectedCriteria(null)}
            className="px-6 py-2.5 text-slate-500 font-bold uppercase text-xs hover:bg-slate-50 rounded-lg transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            type="button"
            onClick={handleRename}
            disabled={isRenaming || !newName.trim() || newName === selectedCriteria?.name}
            className="px-6 py-2.5 bg-indigo-600 text-white font-bold text-xs uppercase rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 transition-all"
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