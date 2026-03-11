
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, Search, FileText, ChevronDown, Trash2, 
  Calendar, Package, Layers, Beaker, ShieldCheck, Keyboard,
  X, Info, ListPlus, Box, Wand2, Eye, Type as TypeIcon, Hash as HashIcon, LayoutGrid, List, CornerDownRight, ArrowRightLeft, Loader2, FlaskConical,
  CheckCircle2, Clock, Copy, Filter, ChevronRight, Activity, Thermometer, BookOpen, Edit2, History, GitCompare, ArrowRight, ArrowUpDown, ChevronLeft
} from 'lucide-react';
import { CriterionType, TCCS, Product, Criterion, TestResultEntry, AuditAction } from '../types';
import { StatusBadge, PageHeader, Modal, Pagination } from '../components/CommonUI';
import { DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable } from '../components/DesignSystem';
import { useForm } from '../hooks/useForm';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCrud } from '../hooks/useCrud';
import { ActionButtons, DeleteModal, AddButton } from '../components/CrudControls';
import { logAuditAction } from '../services/auditService';
import { parseFlexibleValue, ensureArray } from '../utils/parsing';
import { useFormDraft } from '../hooks/useFormDraft';
import SpecialCharToolbar from '../components/SpecialCharToolbar';
import { generateId } from '../utils/idGenerator';
import { normalizeNumericString } from '../utils/criteriaEvaluation';

const calculateRangePreview = (text: string): string | null => {
  const fmt = (n: number): string => {
    if (isNaN(n)) return '...';
    const num = parseFloat(n.toPrecision(12));
    if (num === 0) return '0';

    if (Math.abs(num) >= 1000 || (Math.abs(num) > 0 && Math.abs(num) <= 0.001)) {
        const exponent = Math.floor(Math.log10(Math.abs(num)));
        const mantissa = num / Math.pow(10, exponent);
        const roundedMantissa = Math.round(mantissa * 1000) / 1000;
        
        if (roundedMantissa === 1) return `10^${exponent}`;
        return `${roundedMantissa} × 10^${exponent}`;
    }
    return num.toLocaleString('vi-VN');
  };

  const lower = normalizeNumericString(text.toLowerCase()); // Chuẩn hóa dấu thập phân và ký hiệu khoa học

  // 1. Kiểm tra các chuỗi văn bản đặc biệt
  if (['không được có', 'không có', 'âm tính', 'negative', 'kđc'].some(k => lower.includes(k))) {
    return 'Yêu cầu: Không phát hiện / Âm tính';
  }

  // 2. Kiểm tra ký hiệu cộng/trừ (VD: 10 ± 5%)
  const pmSymbol = text.includes('±') ? '±' : text.includes('+/-') ? '+/-' : null;
  if (pmSymbol) {
    const parts = text.split(pmSymbol);
    const base = parseFlexibleValue(parts[0]);
    const tolerancePart = parts[1] || '';
    let tolerance = parseFlexibleValue(tolerancePart);
    if (base !== null && tolerance !== null) {
      if (tolerancePart.includes('%')) {
        tolerance = base * (tolerance / 100);
      }
      return `Khoảng chấp nhận: ${fmt(base - tolerance)} ~ ${fmt(base + tolerance)}`;
    }
  }

  // 3. Trích xuất tất cả các số trong chuỗi
  const numbers = (lower.match(/-?\d+(\.\d+)?(e[+-]?\d+)?/g) || []).map(Number);

  // 4. Kiểm tra khoảng (VD: "10 - 20", "từ 10 đến 20")
  const isRange = lower.includes('đến') || lower.includes('~') || (lower.includes('-') && !lower.startsWith('-') && numbers.length > 1);
  if (isRange && numbers.length >= 2) {
    return `Khoảng chấp nhận: ${fmt(numbers[0])} ~ ${fmt(numbers[1])}`;
  }

  // 5. Kiểm tra các điều kiện lớn/nhỏ hơn
  const isGreater = /lớn hơn|>/g.test(lower);
  const isLess = /nhỏ hơn|bé hơn|</g.test(lower);

  if (numbers.length > 0) {
    // Trường hợp: "lớn hơn a và nhỏ hơn b"
    if (isGreater && isLess && numbers.length >= 2) {
      const sorted = numbers.sort((a, b) => a - b);
      return `Khoảng chấp nhận: ${fmt(sorted[0])} ~ ${fmt(sorted[1])}`;
    }
    // Trường hợp: "lớn hơn a"
    if (isGreater) {
      const operator = lower.includes('≥') || lower.includes('bằng') ? '≥' : '>';
      return `Yêu cầu: ${operator} ${fmt(numbers[0])}`;
    }
    // Trường hợp: "nhỏ hơn b"
    if (isLess) {
      const operator = lower.includes('≤') || lower.includes('bằng') ? '≤' : '<';
      return `Yêu cầu: ${operator} ${fmt(numbers[0])}`;
    }
  }

  return null; // Không nhận dạng được
};

const initialTccsFormState = {
  productId: '',
  code: '',
  issueDate: new Date().toISOString().split('T')[0],
  mainCriteria: [{ name: '', unit: '', min: undefined, max: undefined, type: CriterionType.NUMBER, notes: '' }] as (Criterion & { notes?: string })[],
  microbiologicalCriteria: [{ name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' }] as (Criterion & { notes?: string })[],
  heavyMetalCriteria: [{ name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' }] as (Criterion & { notes?: string })[],
  alternateRules: [] as { main: string, alt: string, type?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK', conditionValue?: string }[],
};

// Validation function
const validateTCCS = (values: typeof initialTccsFormState) => {
  const errors: Record<string, string> = {};
  if (!values.productId) errors.productId = 'Vui lòng chọn sản phẩm';
  if (!values.code) errors.code = 'Vui lòng nhập mã TCCS';
  if (!values.issueDate) errors.issueDate = 'Vui lòng chọn ngày ban hành';
  return errors;
};

const SensoryBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{label}</p>
    <p className="text-xs font-black text-slate-700">{value || '---'}</p>
  </div>
);

type TCCSGridItemProps = {
  tccs: TCCS;
  product?: Product;
  isExpanded: boolean;
  onExpand: (id: string) => void;
  onView: (tccs: TCCS) => void;
  onClone: (tccs: TCCS) => void;
  onEdit: (tccs: TCCS) => void;
  onDelete: (tccs: TCCS) => void;
  handleViewHistory: (productId: string) => void;
  isAdmin: boolean;
};

const TCCSGridItem: React.FC<TCCSGridItemProps> = ({ tccs, product, isExpanded, onExpand, onView, onClone, onEdit, onDelete, handleViewHistory, isAdmin }) => {
  return (
    <DSCard isExpanded={isExpanded} className={`group ${isExpanded ? 'md:col-span-2 xl:col-span-3' : ''}`}>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-xl text-[#009639] shrink-0"><FileText size={24} /></div>
            <div>
                <div className="flex items-center gap-2 mb-1">
                <h3 className="font-black text-slate-800 text-base">{tccs.code}</h3>
                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">{new Date(tccs.issueDate).toLocaleDateString('en-GB')}</span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-tight line-clamp-1">{product?.name}</p>
            </div>
          </div>
          <div>
            <button onClick={() => onExpand(tccs.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-black uppercase text-[10px] transition-all ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-[#009639]'}`}>
              {isExpanded ? 'Thu gọn' : 'Chi tiết'} <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-bold text-slate-400 uppercase">Trạng thái:</span>
             {tccs.isActive ? <span className="text-[10px] font-black text-emerald-600 uppercase">Hiệu lực</span> : <span className="text-[10px] font-black text-slate-400 uppercase">Hết hiệu lực</span>}
          </div>
          <div className="relative z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={() => handleViewHistory(tccs.productId)} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="Lịch sử phiên bản"><History size={16} /></button>
            <ActionButtons
              onView={() => onView(tccs)}
              onClone={isAdmin ? () => onClone(tccs) : undefined}
              onEdit={isAdmin ? () => onEdit(tccs) : undefined}
              onDelete={isAdmin ? () => onDelete(tccs) : undefined}
            />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 pt-4 border-t border-slate-50 animate-in slide-in-from-top-4 duration-300">
          <div className="space-y-6">
            {/* Criteria Tables (Simplified for brevity, logic remains same as original) */}
            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2"><Activity size={16}/> Chỉ tiêu Phân tích</h4>
            <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                  <tr><th className="px-4 py-3">Tên chỉ tiêu</th><th className="px-4 py-3">Đơn vị</th><th className="px-4 py-3">Mức quy định</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(tccs.mainQualityCriteria || []).map((c: Criterion, i: number) => c ? (
                    <tr key={i} className="hover:bg-white transition-colors">
                      <td className="px-4 py-2 font-bold text-slate-700">{c.name}</td>
                      <td className="px-4 py-2 text-slate-500 font-mono">{c.unit}</td>
                      <td className="px-4 py-2 font-black text-indigo-600">{c.type === 'NUMBER' ? `${c.min ?? '?'} ~ ${c.max ?? '?'}` : c.expectedText}</td>
                    </tr>
                  ) : null)}
                </tbody>
              </table>
            </div>
            {/* Safety Criteria would go here similarly */}
          </div>
        </div>
      )}
    </DSCard>
  );
};

type TCCSListItemProps = {
  tccs: TCCS;
  product?: Product;
  onView: (tccs: TCCS) => void;
  onClone: (tccs: TCCS) => void;
  onEdit: (tccs: TCCS) => void;
  onDelete: (tccs: TCCS) => void;
  isAdmin: boolean;
};

const TCCSListItem: React.FC<TCCSListItemProps> = ({ tccs, product, onView, onClone, onEdit, onDelete, isAdmin }) => (
  <tr className="hover:bg-slate-50 transition-colors">
    <td className="px-4 py-3 font-black text-slate-800">{tccs.code}</td>
    <td className="px-4 py-3 font-bold text-slate-600">{product?.name}</td>
    <td className="px-4 py-3 text-sm text-slate-600">{new Date(tccs.issueDate).toLocaleDateString('en-GB')}</td>
    <td className="px-4 py-3 text-center">
      {tccs.isActive ? <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-black uppercase">Hiệu lực</span> : <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-black uppercase">Hết hiệu lực</span>}
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
);

const TCCSDataList = ({ viewMode, data, products, expandedIds, onExpand, onView, onClone, onEdit, onDelete, handleViewHistory, isAdmin }: {
  viewMode: 'grid' | 'list';
  data: TCCS[];
  products: Product[];
  expandedIds: Set<string>;
  onExpand: (id: string) => void;
  onView: (tccs: TCCS) => void;
  onClone: (tccs: TCCS) => void;
  onEdit: (tccs: TCCS) => void;
  onDelete: (tccs: TCCS) => void;
  handleViewHistory: (productId: string) => void;
  isAdmin: boolean;
}) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {data.map((tccs: TCCS) => (
          <TCCSGridItem 
            key={tccs.id}
            tccs={tccs}
            product={products.find((p: Product) => p.id === tccs.productId)}
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
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Mã TCCS</th><th className="px-4 py-3">Sản phẩm</th><th className="px-4 py-3">Ngày ban hành</th><th className="px-4 py-3 text-center">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {data.map((tccs: TCCS) => (
          <TCCSListItem key={tccs.id} tccs={tccs} product={products.find((p: Product) => p.id === tccs.productId)} onView={onView} onClone={onClone} onEdit={onEdit} onDelete={onDelete} isAdmin={isAdmin} />
        ))}
      </tbody>
    </DSTable>
  );
};

const TCCSList: React.FC = () => {
  const { state, addTCCS, updateTCCS, deleteTCCS, isAdmin, notify } = useAppContext();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: 'issueDate' | 'code'; direction: 'asc' | 'desc' }>({ key: 'code', direction: 'asc' });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [isCloning, setIsCloning] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('tccs_view_mode', 'grid');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewTccs, setViewTccs] = useState<TCCS | null>(null);

  // Use CRUD Hook
  const crud = useCrud<TCCS>();

  const {
    values: formValues,
    errors,
    setValues: setFormValues,
    resetForm: resetHookForm,
    validate,
    handleChange,
    setFieldValue,
    updateInArray,
    addToArray,
    removeFromArray,
  } = useForm(initialTccsFormState, validateTCCS);

  const handleFetchCriteriaFromFormula = () => {
    if (!formValues.productId) {
      notify({ type: 'WARNING', message: 'Vui lòng chọn sản phẩm trước.' });
      return;
    }

    const formula = state.productFormulas.find(f => f.productId === formValues.productId);

    if (!formula || !formula.ingredients || formula.ingredients.length === 0) {
      notify({ type: 'INFO', message: 'Sản phẩm này chưa có công thức hoặc công thức không có hoạt chất nào.' });
      return;
    }

    const newCriteria = formula.ingredients.map(ing => ({
      name: ing.name,
      unit: ing.unit,
      min: undefined,
      max: undefined,
      type: CriterionType.NUMBER,
      notes: `Hàm lượng công bố: ${ing.declaredContent} ${ing.unit}`
    }));

    const hasExistingCriteria = formValues.mainCriteria.some(c => c.name.trim() !== '');
    if (hasExistingCriteria && !window.confirm('Thao tác này sẽ ghi đè lên các chỉ tiêu chất lượng chính hiện tại. Bạn có muốn tiếp tục?')) {
      return;
    }

    setFieldValue('mainCriteria', newCriteria);
    notify({ type: 'SUCCESS', message: `Đã lấy ${newCriteria.length} chỉ tiêu từ công thức.` });
  };

  // --- USE FORM DRAFT HOOK ---
  const { checkDraft, clearDraft } = useFormDraft({
    key: 'TCCS_NEW_DRAFT',
    formValues,
    setFormValues,
    isEnabled: crud.mode === 'ADD',
    onDraftLoaded: (data) => {
      setIsCloning(true); // Chặn auto-fill đè lên draft
      if (data.productId) {
        const p = state.products.find(x => x.id === data.productId);
        if (p) setProductSearch(`${p.code} - ${p.name}`);
      }
    }
  });
  
  // Tự động nạp dữ liệu từ phiên bản cũ khi chọn sản phẩm
  useEffect(() => {
    // Chỉ tự động điền nếu KHÔNG phải đang trong chế độ Copy (Cloning)
    if (formValues.productId && crud.mode === 'ADD' && !isCloning) {
      const latestVersion = state.tccsList
        .filter(t => t.productId === formValues.productId)
        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())[0];

      if (latestVersion) {
        setFormValues(prev => ({
          ...prev, // Keep code and issueDate
          mainCriteria: (latestVersion.mainQualityCriteria || []).filter(c => c).length > 0 ? (latestVersion.mainQualityCriteria || []).filter(c => c) : initialTccsFormState.mainCriteria,
          microbiologicalCriteria: (latestVersion.safetyCriteria || []).filter(c => c && (c as any).category === 'micro').length > 0 ? (latestVersion.safetyCriteria || []).filter(c => c && (c as any).category === 'micro') : initialTccsFormState.microbiologicalCriteria,
          heavyMetalCriteria: (latestVersion.safetyCriteria || []).filter(c => c && (c as any).category === 'metal').length > 0 ? (latestVersion.safetyCriteria || []).filter(c => c && (c as any).category === 'metal') : initialTccsFormState.heavyMetalCriteria,
          alternateRules: (latestVersion as any).alternateRules || [],
        }));
      }
    }
  }, [formValues.productId, crud.mode, state.tccsList, setFormValues, isCloning]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedIds(next);
  };

  const handleAddTCCS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      const newTCCS: TCCS = {
      id: generateId('tccs'),
      productId: formValues.productId,
      code: formValues.code.toUpperCase(),
      issueDate: formValues.issueDate,
      isActive: true,
      composition: '', // Đã bỏ trường này, set rỗng
      mainQualityCriteria: formValues.mainCriteria.filter(c => c.name),
      safetyCriteria: [
        ...formValues.microbiologicalCriteria.filter(c => c.name).map(c => ({ ...(c as any), category: 'micro' })),
        ...formValues.heavyMetalCriteria.filter(c => c.name).map(c => ({ ...(c as any), category: 'metal' }))
      ],
      alternateRules: formValues.alternateRules.filter(r => r.main && r.alt),
      createdAt: new Date().toISOString(),
    };
    
      await addTCCS(newTCCS);
      clearDraft(); // Xóa nháp sau khi lưu thành công
      crud.close();
      notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã tạo hồ sơ TCCS mới.' });
      resetForm();
    } catch (error: any) {
      console.error("Failed to add TCCS:", error);
      // Hiển thị thông báo lỗi thực tế để dễ debug
      // AppContext đã notify lỗi, ở đây chỉ cần log
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTCCS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!crud.selectedItem) return;
    
    setIsSubmitting(true);
    try {
      const existingTCCS = state.tccsList.find(t => t.id === crud.selectedItem?.id);
      if (!existingTCCS) return;

      const updatedTCCS: TCCS = {
      ...existingTCCS,
      code: formValues.code.toUpperCase(),
      issueDate: formValues.issueDate,
      updatedAt: new Date().toISOString(),
      composition: '', // Đã bỏ trường này, set rỗng
      mainQualityCriteria: formValues.mainCriteria.filter(c => c.name),
      safetyCriteria: [
        ...formValues.microbiologicalCriteria.filter(c => c.name).map(c => ({ ...(c as any), category: 'micro' })),
        ...formValues.heavyMetalCriteria.filter(c => c.name).map(c => ({ ...(c as any), category: 'metal' }))
      ],
      alternateRules: formValues.alternateRules.filter(r => r.main && r.alt),
    };
    
      await updateTCCS(updatedTCCS);
      crud.close();
      notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã cập nhật hồ sơ TCCS.' });
      resetForm();
    } catch (error: any) {
      console.error("Failed to update TCCS:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTCCS = async (tccs: TCCS) => {
    // Check if the TCCS is used by any valid batch object
    const isUsed = state.batches.some(b => b && b.tccsId === tccs.id);
    if (isUsed) {
      notify({ type: 'WARNING', title: 'Không thể xóa', message: 'TCCS này đang được sử dụng bởi một hoặc nhiều Lô sản xuất.' });
      return;
    }
    crud.openDelete(tccs);
  };

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteTCCS(crud.selectedItem.id);
        // Đóng modal ngay khi xóa thành công
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: `Đã xóa TCCS ${crud.selectedItem.code}` });
        
        // Ghi log an toàn
        try {
          logAuditAction({
            action: AuditAction.DELETE,
            collection: 'TCCS',
            documentId: crud.selectedItem.id,
            details: `Xóa TCCS: ${crud.selectedItem.code}`,
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

  const resetForm = (shouldCheckDraft = false) => {
    setIsCloning(false);
    setProductSearch('');
    setShowProductDropdown(false);
    
    if (shouldCheckDraft) {
      checkDraft(); // Sử dụng hàm từ hook
    }
    
    resetHookForm();
  };

  const handleEdit = (tccs: TCCS) => {
    crud.openEdit(tccs);
    const product = state.products.find(p => p.id === tccs.productId);
    setProductSearch(product ? `${product.code} - ${product.name}` : '');
    
    const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
    const micro = tccs.safetyCriteria.filter(c => {
        if (!c) return false;
        const nameLower = (c.name || '').toLowerCase();
        if ((c as any).category === 'micro') return true;
        if (!(c as any).category && !HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
        return false;
    });
    const metal = tccs.safetyCriteria.filter(c => {
        if (!c) return false;
        const nameLower = (c.name || '').toLowerCase();
        if ((c as any).category === 'metal') return true;
        if (!(c as any).category && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
        return false;
    });

    setFormValues({
      productId: tccs.productId,
      code: tccs.code,
      issueDate: tccs.issueDate,
      mainCriteria: (tccs.mainQualityCriteria || []).filter(c => c).length > 0 ? (tccs.mainQualityCriteria || []).filter(c => c) : initialTccsFormState.mainCriteria,
      microbiologicalCriteria: micro && micro.length > 0 ? micro : initialTccsFormState.microbiologicalCriteria,
      heavyMetalCriteria: metal && metal.length > 0 ? metal : initialTccsFormState.heavyMetalCriteria,
      alternateRules: (tccs as any).alternateRules || [],
    });
  };

  const handleClone = (tccs: TCCS) => {
    setIsCloning(true); // Đánh dấu đang Copy để chặn auto-fill
    crud.openAdd();
    
    const product = state.products.find(p => p.id === tccs.productId);
    setProductSearch(product ? `${product.code} - ${product.name}` : '');
    
    const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
    const micro = (tccs.safetyCriteria || []).filter(c => {
        if (!c) return false;
        const nameLower = (c.name || '').toLowerCase();
        if ((c as any).category === 'micro') return true;
        if (!(c as any).category && !HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
        return false;
    }).map(c => ({...c}));
    
    const metal = (tccs.safetyCriteria || []).filter(c => {
        if (!c) return false;
        const nameLower = (c.name || '').toLowerCase();
        if ((c as any).category === 'metal') return true;
        if (!(c as any).category && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
        return false;
    }).map(c => ({...c}));

    setFormValues({
      productId: tccs.productId, // Giữ nguyên sản phẩm cũ
      code: `${tccs.code}-COPY`,
      issueDate: new Date().toISOString().split('T')[0],
      mainCriteria: (tccs.mainQualityCriteria || []).filter(c => c).map(c => ({...c})),
      microbiologicalCriteria: micro.length > 0 ? micro : initialTccsFormState.microbiologicalCriteria,
      heavyMetalCriteria: metal.length > 0 ? metal : initialTccsFormState.heavyMetalCriteria,
      alternateRules: ((tccs as any).alternateRules || []).map((r: any) => ({...r})),
    });
  };

  const handleViewHistory = (pid: string) => {
    setHistoryProductId(pid);
    setCompareSelection([]);
    setIsHistoryModalOpen(true);
  };

  const handleView = (tccs: TCCS) => {
    setViewTccs(tccs);
  };

  const historyVersions = useMemo(() => {
    if (!historyProductId) return [];
    return state.tccsList
      .filter(t => t.productId === historyProductId)
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [state.tccsList, historyProductId]);

  const toggleCompareSelection = (id: string) => {
    setCompareSelection(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const compareVersions = useMemo(() => {
    if (compareSelection.length !== 2) return null;
    const v1 = state.tccsList.find(t => t.id === compareSelection[0]);
    const v2 = state.tccsList.find(t => t.id === compareSelection[1]);
    if (!v1 || !v2) return null;
    return new Date(v1.issueDate) < new Date(v2.issueDate) ? [v1, v2] : [v2, v1];
  }, [compareSelection, state.tccsList]);

  const filteredTCCS = useMemo(() => {
    return state.tccsList.filter(t => {
      const p = state.products.find(prod => prod.id === t.productId);
      const matchesSearch = t.code.toLowerCase().includes(searchTerm.toLowerCase()) || (p?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProduct = !filterProductId || t.productId === filterProductId;
      const matchesStatus = filterStatus === 'ALL' ? true : filterStatus === 'ACTIVE' ? t.isActive : !t.isActive;
      const issueDate = new Date(t.issueDate || 0);
      const matchesYear = filterYear === 'ALL' || issueDate.getFullYear().toString() === filterYear;
      const matchesMonth = filterMonth === 'ALL' || (issueDate.getMonth() + 1).toString() === filterMonth;
      return matchesSearch && matchesProduct && matchesStatus && matchesYear && matchesMonth;
    }).sort((a, b) => {
      if (sortConfig.key === 'code') {
        return sortConfig.direction === 'asc' 
          ? (a.code || '').localeCompare(b.code || '')
          : (b.code || '').localeCompare(a.code || '');
      }
      const dateA = new Date(a.issueDate || 0).getTime();
      const dateB = new Date(b.issueDate || 0).getTime();
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [state.tccsList, state.products, searchTerm, filterProductId, filterStatus, sortConfig, filterMonth, filterYear]);

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
      return `${c.min !== undefined ? c.min : '?'} ~ ${c.max !== undefined ? c.max : '?'} ${c.unit}`;
    }
    return c.expectedText || '';
  };

  const allCriteriaNames = useMemo(() => {
    const names = new Set<string>();
    state.tccsList.forEach(tccs => {
        (tccs.mainQualityCriteria || []).forEach(c => c && c.name && names.add(c.name));
        (tccs.safetyCriteria || []).forEach(c => c && c.name && names.add(c.name));
    });
    return Array.from(names).sort();
  }, [state.tccsList]);

  // Helper lấy danh sách tất cả tên chỉ tiêu hiện tại để bind vào dropdown
  const getAllCurrentCriteriaNames = () => {
    return [
      ...formValues.mainCriteria.map(c => c.name),
      ...formValues.microbiologicalCriteria.map(c => c.name),
      ...formValues.heavyMetalCriteria.map(c => c.name)
    ].filter(n => n.trim() !== '');
  };

  // Helper render form content để dùng chung cho cả 2 modal (tránh lặp code quá dài)
  const renderFormContent = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
      <datalist id="criteria-name-suggestions">
        {allCriteriaNames.map(name => <option key={name} value={name} />)}
      </datalist>

      {crud.mode === 'ADD' && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
            <Info className="text-blue-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-blue-800 leading-relaxed">
                Để đổi tên một chỉ tiêu đã có trên toàn hệ thống (sửa lỗi chính tả, chuẩn hóa...), vui lòng sử dụng trang <a href="/criteria" target="_blank" rel="noopener noreferrer" className="font-bold underline">Danh mục Chỉ tiêu</a>.
                Việc sửa tên trực tiếp ở đây sẽ được coi là tạo một chỉ tiêu mới.
            </div>
        </div>
      )}
      {/* Special Char Toolbar */}
      <SpecialCharToolbar className="-mx-4 px-4" />

      {/* Section 1: Thông tin gốc */}
      <div className="space-y-3">
          <div className="flex items-center gap-2 text-[#009639] font-black text-[10px] uppercase tracking-widest"><Package size={14}/> 1. Thông tin Sản phẩm</div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setShowProductDropdown(true);
                if (!e.target.value) setFieldValue('productId', '');
              }}
              onFocus={() => setShowProductDropdown(true)}
              onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
              placeholder="Tìm sản phẩm để tạo TCCS mới..."
              className={`w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-[#009639] ${errors.productId ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
              disabled={crud.mode === 'EDIT'} // Không cho sửa sản phẩm khi đang edit
            />
            {formValues.productId && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-[#009639]" size={16} />}
            
            {showProductDropdown && crud.mode !== 'EDIT' && (
              <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                {state.products.filter(p => 
                  !productSearch || 
                  p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                  p.code.toLowerCase().includes(productSearch.toLowerCase())
                ).length > 0 ? (
                  state.products.filter(p => 
                    !productSearch || 
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                    p.code.toLowerCase().includes(productSearch.toLowerCase())
                  ).map(p => (
                    <div 
                      key={p.id}
                      onClick={() => {
                        setFieldValue('productId', p.id);
                        setProductSearch(`${p.code} - ${p.name}`);
                        setShowProductDropdown(false);
                      }}
                      className={`px-4 py-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors ${formValues.productId === p.id ? 'bg-emerald-50' : ''}`}
                    >
                      <p className="text-sm font-bold text-slate-700">{p.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase">{p.code}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs font-bold">Không tìm thấy sản phẩm</div>
                )}
              </div>
            )}
            {errors.productId && <p className="text-red-500 text-[10px] font-bold mt-1 pl-2 flex items-center gap-1"><Info size={10}/> {errors.productId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <input placeholder="Mã hiệu TCCS (VD: TCCS 01:2024/VB)" name="code" value={formValues.code} onChange={handleChange} className={`w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-black outline-none shadow-inner text-sm ${errors.code ? 'ring-2 ring-red-500 bg-red-50' : ''}`} />
              {errors.code && <p className="text-red-500 text-[10px] font-bold pl-2">{errors.code}</p>}
            </div>
            <div className="space-y-1">
              <input type="date" name="issueDate" value={formValues.issueDate} onChange={handleChange} className={`w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-black outline-none shadow-inner text-sm ${errors.issueDate ? 'ring-2 ring-red-500 bg-red-50' : ''}`} />
              {errors.issueDate && <p className="text-red-500 text-[10px] font-bold pl-2">{errors.issueDate}</p>}
            </div>
          </div>
      </div>

      {/* Section 2: Chỉ tiêu chất lượng */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest"><Activity size={14}/> 2. Chỉ tiêu Chất lượng chính</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleFetchCriteriaFromFormula} disabled={!formValues.productId} className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <FlaskConical size={12} /> Lấy từ công thức
            </button>
            <button type="button" onClick={() => addToArray('mainCriteria', { name: '', unit: '', min: undefined, max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors">
              <Plus size={16}/>
            </button>
          </div>
        </div>
        {formValues.mainCriteria.map((c, i) => (
          <div key={i} className="flex flex-col gap-1 animate-in slide-in-from-right-2 duration-200 bg-slate-50/50 p-1.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all group">
            <div className="flex gap-2 items-center">
              <select 
                value={c.type} 
                onChange={(e) => updateInArray('mainCriteria', i, 'type', e.target.value as any)}
                className="w-16 px-1 py-2 bg-white rounded-lg text-[10px] font-bold outline-none cursor-pointer text-center border border-slate-100 shadow-sm"
              >
                <option value={CriterionType.NUMBER || 'NUMBER'}>Số</option>
                <option value={CriterionType.TEXT || 'TEXT'}>Chữ</option>
              </select>
              <input placeholder="Tên chỉ tiêu" value={c.name} onChange={(e) => updateInArray('mainCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 shadow-sm" list="criteria-name-suggestions" />
              <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('mainCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-center border border-slate-100 shadow-sm" />
              {c.type === CriterionType.NUMBER ? (
                <>
                  <input type="number" placeholder="Min" value={c.min ?? ''} onChange={(e) => updateInArray('mainCriteria', i, 'min', e.target.value ? parseFloat(e.target.value) : undefined)} className="w-20 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-right border border-slate-100 shadow-sm" />
                  <input type="number" placeholder="Max" value={c.max ?? ''} onChange={(e) => updateInArray('mainCriteria', i, 'max', e.target.value ? parseFloat(e.target.value) : undefined)} className="w-20 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-right border border-slate-100 shadow-sm" />
                </>
              ) : (
                <div className="flex-[2] flex flex-col gap-1">
                  <input type="text" placeholder="Mức quy định (VD: 15 ± 20%...)" value={c.expectedText || ''} onChange={(e) => updateInArray('mainCriteria', i, 'expectedText', e.target.value)} className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 shadow-sm" />
                  {c.expectedText && calculateRangePreview(c.expectedText) && (
                    <span className="text-[9px] text-emerald-600 font-black pl-1 animate-in fade-in">{calculateRangePreview(c.expectedText)}</span>
                  )}
                </div>
              )}
              <button type="button" onClick={() => removeFromArray('mainCriteria', i)} className="p-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
            </div>
            <div className="flex items-center gap-2 px-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <CornerDownRight size={12} className="text-slate-300 shrink-0" />
                <input 
                  placeholder="Ghi chú / Điều kiện (VD: Phương pháp thử, điều kiện đặc biệt...)"
                  value={(c as any).notes || ''}
                  onChange={(e) => updateInArray('mainCriteria', i, 'notes', e.target.value)}
                  className="w-full bg-transparent text-[10px] font-medium text-slate-500 placeholder:text-slate-300 outline-none border-b border-transparent focus:border-slate-300 focus:text-slate-700 transition-colors"
                />
            </div>
          </div>
        ))}
      </div>

      {/* Section 3: Chỉ tiêu an toàn */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-red-600 font-black text-[10px] uppercase tracking-widest"><ShieldCheck size={14}/> 3. Giới hạn về vi sinh vật</div>
          <button type="button" onClick={() => addToArray('microbiologicalCriteria', { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"><Plus size={16}/></button>
        </div>
        {formValues.microbiologicalCriteria.map((c, i) => (
          <div key={i} className="flex flex-col gap-1 animate-in slide-in-from-right-2 duration-200 bg-slate-50/50 p-1.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all group">
            <div className="flex gap-2 items-center">
              <select 
                value={c.type} 
                onChange={(e) => updateInArray('microbiologicalCriteria', i, 'type', e.target.value as any)}
                className="w-16 px-1 py-2 bg-white rounded-lg text-[10px] font-bold outline-none cursor-pointer text-center border border-slate-100 shadow-sm"
              >
                <option value={CriterionType.NUMBER || 'NUMBER'}>Số</option>
                <option value={CriterionType.TEXT || 'TEXT'}>Chữ</option>
              </select>
              <input placeholder="Tên chỉ tiêu (VD: Tổng số VSVK hiếu khí)" value={c.name} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 shadow-sm" list="criteria-name-suggestions" />
              <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-center border border-slate-100 shadow-sm" />
              {c.type === CriterionType.NUMBER ? (
                <div className="flex items-center gap-2 bg-white px-3 rounded-lg w-24 border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400">≤</span>
                    <input type="number" placeholder="Max" value={c.max ?? ''} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'max', e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full bg-transparent text-xs font-bold outline-none text-right" />
                </div>
              ) : (
                <div className="flex-[2] flex flex-col gap-1">
                  <input type="text" placeholder="Giới hạn (VD: 10⁴ CFU/g)" value={c.expectedText || ''} onChange={(e) => updateInArray('microbiologicalCriteria', i, 'expectedText', e.target.value)} className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 shadow-sm" />
                  {c.expectedText && calculateRangePreview(c.expectedText) && (
                    <span className="text-[9px] text-emerald-600 font-black pl-1 animate-in fade-in">{calculateRangePreview(c.expectedText)}</span>
                  )}
                </div>
              )}
              <button type="button" onClick={() => removeFromArray('microbiologicalCriteria', i)} className="p-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
            </div>
            <div className="flex items-center gap-2 px-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <CornerDownRight size={12} className="text-slate-300 shrink-0" />
                <input 
                  placeholder="Ghi chú / Điều kiện..."
                  value={(c as any).notes || ''}
                  onChange={(e) => updateInArray('microbiologicalCriteria', i, 'notes', e.target.value)}
                  className="w-full bg-transparent text-[10px] font-medium text-slate-500 placeholder:text-slate-300 outline-none border-b border-transparent focus:border-slate-300 focus:text-slate-700 transition-colors"
                />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-red-600 font-black text-[10px] uppercase tracking-widest"><ShieldCheck size={14}/> 4. Giới hạn về kim loại nặng</div>
          <button type="button" onClick={() => addToArray('heavyMetalCriteria', { name: '', unit: '', max: undefined, type: CriterionType.NUMBER, notes: '' })} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"><Plus size={16}/></button>
        </div>
        {formValues.heavyMetalCriteria.map((c, i) => (
          <div key={i} className="flex flex-col gap-1 animate-in slide-in-from-right-2 duration-200 bg-slate-50/50 p-1.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all group">
            <div className="flex gap-2 items-center">
              <select 
                value={c.type} 
                onChange={(e) => updateInArray('heavyMetalCriteria', i, 'type', e.target.value as any)}
                className="w-16 px-1 py-2 bg-white rounded-lg text-[10px] font-bold outline-none cursor-pointer text-center border border-slate-100 shadow-sm"
              >
                <option value={CriterionType.NUMBER || 'NUMBER'}>Số</option>
                <option value={CriterionType.TEXT || 'TEXT'}>Chữ</option>
              </select>
              <input placeholder="Tên chỉ tiêu (VD: Asen, Chì...)" value={c.name} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 shadow-sm" list="criteria-name-suggestions" />
              <input placeholder="ĐVT" value={c.unit} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none text-center border border-slate-100 shadow-sm" />
              {c.type === CriterionType.NUMBER ? (
                <div className="flex items-center gap-2 bg-white px-3 rounded-lg w-24 border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400">≤</span>
                    <input type="number" placeholder="Max" value={c.max ?? ''} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'max', e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full bg-transparent text-xs font-bold outline-none text-right" />
                </div>
              ) : (
                <div className="flex-[2] flex flex-col gap-1">
                  <input type="text" placeholder="Giới hạn (VD: Không được có)" value={c.expectedText || ''} onChange={(e) => updateInArray('heavyMetalCriteria', i, 'expectedText', e.target.value)} className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 shadow-sm" />
                  {c.expectedText && calculateRangePreview(c.expectedText) && (
                    <span className="text-[9px] text-emerald-600 font-black pl-1 animate-in fade-in">{calculateRangePreview(c.expectedText)}</span>
                  )}
                </div>
              )}
              <button type="button" onClick={() => removeFromArray('heavyMetalCriteria', i)} className="p-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
            </div>
            <div className="flex items-center gap-2 px-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <CornerDownRight size={12} className="text-slate-300 shrink-0" />
                <input 
                  placeholder="Ghi chú / Điều kiện (VD: Nếu > 1.5, kiểm tra Asen vô cơ...)"
                  value={(c as any).notes || ''}
                  onChange={(e) => updateInArray('heavyMetalCriteria', i, 'notes', e.target.value)}
                  className="w-full bg-transparent text-[10px] font-medium text-slate-500 placeholder:text-slate-300 outline-none border-b border-transparent focus:border-slate-300 focus:text-slate-700 transition-colors"
                />
            </div>
          </div>
        ))}
      </div>

      {/* Section 5: Thiết lập điều kiện thay thế */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
            <ArrowRightLeft size={14}/> 5. Thiết lập điều kiện thay thế (Nếu có)
          </div>
          <button type="button" onClick={() => addToArray('alternateRules', { main: '', alt: '' })} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"><Plus size={16}/></button>
        </div>
        
        {formValues.alternateRules.length === 0 && (
          <p className="text-[10px] text-slate-400 italic pl-6">Chưa có quy tắc thay thế nào (Ví dụ: Nếu "Độ ẩm nhanh" rớt thì kiểm tra "Độ ẩm sấy").</p>
        )}

        {formValues.alternateRules.map((rule, i) => (
          <div key={i} className="flex flex-col gap-2 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100 animate-in slide-in-from-left-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Chỉ tiêu chính (TC1):</p>
                <select 
                  value={rule.main} 
                  onChange={(e) => updateInArray('alternateRules', i, 'main', e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-200 shadow-sm"
                >
                  <option value="">-- Chọn TC1 --</option>
                  {getAllCurrentCriteriaNames().map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <ArrowRight size={16} className="text-indigo-400 mt-4" />
              <div className="flex-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Chỉ tiêu liên quan (TC2):</p>
                <select 
                  value={rule.alt} 
                  onChange={(e) => updateInArray('alternateRules', i, 'alt', e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg text-xs font-bold outline-none border border-slate-200 shadow-sm"
                >
                  <option value="">-- Chọn TC2 --</option>
                  {getAllCurrentCriteriaNames().filter(n => n !== rule.main).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => removeFromArray('alternateRules', i)} className="p-2 mt-4 text-slate-300 hover:text-red-500"><X size={16}/></button>
            </div>
            
            <div className="flex items-center gap-2 pl-2 border-l-2 border-indigo-200">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Điều kiện:</span>
              <select 
                value={rule.type || 'FAIL_RETRY'} 
                onChange={(e) => updateInArray('alternateRules', i, 'type', e.target.value as any)}
                className="px-2 py-1.5 bg-white rounded-lg text-[10px] font-bold outline-none border border-slate-200 shadow-sm"
              >
                <option value="FAIL_RETRY">Nếu TC1 RỚT -&gt; Kiểm tra TC2</option>
                <option value="CONDITIONAL_CHECK">Nếu TC1 ĐẠT và &gt; Giá trị -&gt; Kiểm tra TC2</option>
              </select>
              
              {rule.type === 'CONDITIONAL_CHECK' && (
                <input 
                  type="number" 
                  placeholder="Ngưỡng giá trị..." 
                  value={rule.conditionValue || ''}
                  onChange={(e) => updateInArray('alternateRules', i, 'conditionValue', e.target.value)}
                  className="w-24 px-2 py-1.5 bg-white rounded-lg text-[10px] font-bold outline-none border border-slate-200 shadow-sm"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Tiêu chuẩn Cơ sở (TCCS)" 
        subtitle="Quản lý định mức kỹ thuật và chỉ tiêu chất lượng sản phẩm." 
        icon={FileText} 
        action={
          isAdmin && <AddButton onClick={() => { resetForm(true); crud.openAdd(); }} label="Lập hồ sơ mới" />
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
          {Array.from(new Set(state.tccsList.map(t => new Date(t.issueDate).getFullYear()))).sort((a: number, b: number) => b - a).map(y => <option key={y} value={y}>{y}</option>)}
        </DSSelect>

        <DSSelect value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-24">
          <option value="ALL">Tháng</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </DSSelect>

        <DSSelect value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)} className="w-full md:w-48">
          <option value="">Tất cả sản phẩm</option>
          {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
        products={state.products}
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

      {/* Modal Xem chi tiết TCCS */}
      <Modal
        isOpen={!!viewTccs}
        onClose={() => setViewTccs(null)}
        title={`Chi tiết TCCS: ${viewTccs?.code || ''}`}
        icon={FileText}
      >
        {viewTccs ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar text-sm">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
              <p><span className="font-bold text-slate-500">Sản phẩm:</span> <span className="font-bold text-slate-800">{state.products.find(p => p.id === viewTccs.productId)?.name}</span></p>
              <p><span className="font-bold text-slate-500">Ngày ban hành:</span> <span className="font-medium">{new Date(viewTccs.issueDate).toLocaleDateString('en-GB')}</span></p>
            </div>

            {(() => {
              const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
              const safety = ensureArray(viewTccs.safetyCriteria);
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

              return [
                { title: 'Chỉ tiêu Chất lượng', criteria: viewTccs.mainQualityCriteria, color: 'text-indigo-600' },
                { title: 'Giới hạn Vi sinh vật', criteria: micro, color: 'text-emerald-600' },
                { title: 'Giới hạn Kim loại nặng', criteria: metal, color: 'text-red-600' }
              ].map((group) => {
                const list = ensureArray(group.criteria);
                if (list.length === 0) return null;
                return (
                  <div key={group.title}>
                    <h4 className={`text-xs font-black uppercase tracking-widest mb-3 ${group.color} border-b pb-1`}>{group.title}</h4>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="p-2 rounded-l-lg">Tên chỉ tiêu</th>
                          <th className="p-2">Mức yêu cầu</th>
                          <th className="p-2 rounded-r-lg text-center">Đơn vị</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {list.map((c, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-bold text-slate-700">{c.name}</td>
                            <td className="p-2 font-mono text-slate-600">{c.expectedText || (c.min !== undefined || c.max !== undefined ? `${c.min ?? ''} ~ ${c.max ?? ''}` : '')}</td>
                            <td className="p-2 text-center text-slate-500">{c.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              });
            })()}
          </div>
        ) : <p className="text-center text-slate-400 italic p-4">Không có thông tin TCCS để hiển thị.</p>}
      </Modal>

      {/* Modal Lập TCCS Mới */}
      <Modal isOpen={crud.mode === 'ADD'} onClose={crud.close} title="Thiết lập Hồ sơ TCCS Mới" icon={Plus}>
        <form onSubmit={handleAddTCCS}>
          {renderFormContent()}
          <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white pb-2">
            <button type="button" onClick={crud.close} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-[#009639] text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-emerald-100 flex items-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Lưu hồ sơ TCCS
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Cập Nhật TCCS */}
      <Modal isOpen={crud.mode === 'EDIT'} onClose={crud.close} title="Cập nhật Hồ sơ TCCS" icon={Edit2}>
        <form onSubmit={handleUpdateTCCS}>
          {renderFormContent()}
          <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white pb-2">
            <button type="button" onClick={crud.close} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-blue-100 flex items-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Cập nhật TCCS
            </button>
          </div>
        </form>
      </Modal>

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
                             <p className="text-[10px] font-bold text-slate-400 uppercase">Ban hành: {new Date(ver.issueDate).toLocaleDateString('en-GB')}</p>
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
                   <p className="text-[10px] font-bold text-slate-500">{new Date(compareVersions[0].issueDate).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 relative">
                   <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-white rounded-full p-1 border border-blue-100 text-blue-400 z-20"><ArrowRight size={14}/></div>
                   <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Phiên bản mới</p>
                   <h4 className="font-bold text-blue-700 text-sm">{compareVersions[1].code}</h4>
                   <p className="text-[10px] font-bold text-blue-500">{new Date(compareVersions[1].issueDate).toLocaleDateString('en-GB')}</p>
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
