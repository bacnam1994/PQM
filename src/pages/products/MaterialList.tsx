import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useDataGraph } from '../../hooks/useDataGraph';
import { useUIStore } from '../../store/useUIStore';
import { 
  FlaskConical, Search, Filter, Layers, Beaker, Component, Package, 
  LayoutGrid, List, ChevronLeft, ChevronRight, Edit2, Plus, Sparkles, 
  BookUser, Link2, Unlink, ShieldCheck, Hash, Trash2, ArrowRight, 
  CheckCircle2, AlertTriangle, RefreshCw, X as XIcon, Save, Loader2, Tag, BookOpen, Layers3
} from 'lucide-react';
import { RawMaterial, ProductFormula, FormulaIngredient } from '../../types';
import { PageHeader, DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable, ActionButtons, Modal, Pagination } from '../../components';
import { useCrud } from '../../hooks';
import { generateId } from '../../utils';
import { COMMON_PHARMA_STANDARDS } from './MaterialFormPage';
import { 
  analyzeMaterialDuplicates, 
  createMergeExecutionPlan, 
  DuplicateGroup, 
  HarmonizationReport 
} from '../../services/ai/materialHarmonizerService';
import { logAuditAction } from '../../services/auditService';

// Sub-interface cho Matrix tổng hợp từ công thức
interface AggregatedFormulaItem {
  id: string;
  name: string;
  type: 'ACTIVE' | 'EXCIPIENT';
  materialId?: string;
  linkedMaterial?: RawMaterial;
  relatedProducts: {
    id: string;
    name: string;
    code?: string;
    content?: string;
    formulaId: string;
  }[];
}

const MaterialList: React.FC = () => {
  const { rawMaterials: hydratedMaterials } = useDataGraph();
  const rawMaterials = useAppStore(state => state.rawMaterials);
  const products = useAppStore(state => state.products);
  const productFormulas = useAppStore(state => state.productFormulas);
  const addRawMaterial = useAppStore(state => state.addRawMaterial);
  const updateRawMaterial = useAppStore(state => state.updateRawMaterial);
  const deleteRawMaterial = useAppStore(state => state.deleteRawMaterial);
  const updateProductFormula = useAppStore(state => state.updateProductFormula);
  const notify = useAppStore(state => state.notify);
  const isAdmin = useAppStore(state => state.isAdmin);
  const user = useAppStore(state => state.user);
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'MATRIX' | 'CONSISTENCY'>('CATALOG');

  // View Mode & Pagination
  const viewMode = useUIStore(s => s.materialViewMode);
  const setViewMode = useUIStore(s => s.setMaterialViewMode);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === 'grid' ? 12 : 15;

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'ACTIVE' | 'EXCIPIENT' | 'OTHER'>('ALL');
  const [filterStandard, setFilterStandard] = useState<string>('ALL');
  const [filterUsage, setFilterUsage] = useState<'ALL' | 'USED' | 'UNUSED'>('ALL');
  const [filterProductId, setFilterProductId] = useState<string>('');

  // CRUD State for Master Material Modal
  const crud = useCrud<RawMaterial>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'ACTIVE' | 'EXCIPIENT' | 'OTHER'>('ACTIVE');
  const [formStandard, setFormStandard] = useState('');
  const [formCasNumber, setFormCasNumber] = useState('');
  const [formAliases, setFormAliases] = useState<string[]>([]);
  const [formAliasInput, setFormAliasInput] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // AI Harmonizer Modal State
  const [isHarmonizerOpen, setIsHarmonizerOpen] = useState(false);
  const [harmonizationReport, setHarmonizationReport] = useState<HarmonizationReport | null>(null);
  const [isAnalyzingHarmonization, setIsAnalyzingHarmonization] = useState(false);
  const [executingMergeGroupId, setExecutingMergeGroupId] = useState<string | null>(null);

  // Map tra cứu nhanh
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const materialMap = useMemo(() => new Map(rawMaterials.map(m => [m.id, m])), [rawMaterials]);
  const hydratedMap = useMemo(() => new Map(hydratedMaterials.map(m => [m.id, m])), [hydratedMaterials]);

  // Reset trang khi thay đổi bộ lọc hoặc tab
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterStandard, filterUsage, filterProductId, activeTab, viewMode]);

  // ==========================================
  // TAB 1: Danh sách Master Catalog
  // ==========================================
  const filteredCatalog = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    return (rawMaterials || []).filter(mat => {
      const matchesSearch = 
        mat.name.toLowerCase().includes(searchLower) ||
        (mat.code && mat.code.toLowerCase().includes(searchLower)) ||
        (mat.standard && mat.standard.toLowerCase().includes(searchLower)) ||
        (mat.casNumber && mat.casNumber.toLowerCase().includes(searchLower)) ||
        (mat.aliases && mat.aliases.some(a => a.toLowerCase().includes(searchLower)));

      const matchesCategory = filterCategory === 'ALL' || mat.category === filterCategory;
      const matchesStandard = filterStandard === 'ALL' || (mat.standard && mat.standard.includes(filterStandard));

      const hydrated = hydratedMap.get(mat.id);
      const isUsed = (hydrated?.usedInProducts?.length || 0) > 0;
      const matchesUsage = filterUsage === 'ALL' || (filterUsage === 'USED' ? isUsed : !isUsed);

      return matchesSearch && matchesCategory && matchesStandard && matchesUsage;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawMaterials, searchTerm, filterCategory, filterStandard, filterUsage, hydratedMap]);

  // ==========================================
  // TAB 2: Danh sách Tổng hợp từ Công thức (Matrix)
  // ==========================================
  const aggregatedFormulaItems = useMemo(() => {
    const map = new Map<string, AggregatedFormulaItem>();

    productFormulas.forEach(formula => {
      const product = productMap.get(formula.productId);
      if (!product) return;

      // Hoạt chất
      (formula.ingredients || []).forEach(ing => {
        if (!ing || !ing.name) return;
        const key = `ACTIVE_${ing.name.trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name: ing.name.trim(),
            type: 'ACTIVE',
            materialId: ing.materialId,
            linkedMaterial: ing.materialId ? materialMap.get(ing.materialId) : undefined,
            relatedProducts: []
          });
        }
        const item = map.get(key)!;
        if (!item.materialId && ing.materialId) {
          item.materialId = ing.materialId;
          item.linkedMaterial = materialMap.get(ing.materialId);
        }
        if (!item.relatedProducts.some(p => p.id === product.id)) {
          item.relatedProducts.push({
            id: product.id,
            name: product.name,
            code: product.code,
            content: `${ing.declaredContent} ${ing.unit || ''}`,
            formulaId: formula.id,
          });
        }
      });

      // Tá dược
      (formula.excipients || []).forEach(exc => {
        if (!exc || !exc.name) return;
        const key = `EXCIPIENT_${exc.name.trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name: exc.name.trim(),
            type: 'EXCIPIENT',
            materialId: exc.materialId,
            linkedMaterial: exc.materialId ? materialMap.get(exc.materialId) : undefined,
            relatedProducts: []
          });
        }
        const item = map.get(key)!;
        if (!item.materialId && exc.materialId) {
          item.materialId = exc.materialId;
          item.linkedMaterial = materialMap.get(exc.materialId);
        }
        if (!item.relatedProducts.some(p => p.id === product.id)) {
          item.relatedProducts.push({
            id: product.id,
            name: product.name,
            code: product.code,
            content: `${exc.declaredContent} ${exc.unit || ''}`,
            formulaId: formula.id,
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [productFormulas, productMap, materialMap]);

  const filteredMatrix = useMemo(() => {
    return aggregatedFormulaItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterCategory === 'ALL' || item.type === filterCategory;
      const matchesProduct = filterProductId ? item.relatedProducts.some(p => p.id === filterProductId) : true;
      const isLinked = !!item.materialId && materialMap.has(item.materialId);
      const matchesUsage = filterUsage === 'ALL' || (filterUsage === 'USED' ? isLinked : !isLinked);
      return matchesSearch && matchesType && matchesProduct && matchesUsage;
    });
  }, [aggregatedFormulaItems, searchTerm, filterCategory, filterProductId, filterUsage, materialMap]);

  // Metrics Bar Data
  const metrics = useMemo(() => {
    const total = rawMaterials.length;
    const activeCount = rawMaterials.filter(m => m.category === 'ACTIVE').length;
    const excipientCount = rawMaterials.filter(m => m.category === 'EXCIPIENT').length;
    const usedCount = hydratedMaterials.filter(m => (m.usedInProducts?.length || 0) > 0).length;
    const unusedCount = total - usedCount;

    const unlinkedIngredients = aggregatedFormulaItems.filter(i => !i.materialId || !materialMap.has(i.materialId)).length;
    return { total, activeCount, excipientCount, usedCount, unusedCount, unlinkedIngredients };
  }, [rawMaterials, hydratedMaterials, aggregatedFormulaItems, materialMap]);

  // Phân trang
  const currentList = activeTab === 'CATALOG' ? filteredCatalog : filteredMatrix;
  const totalPages = Math.ceil(currentList.length / itemsPerPage);
  const paginatedItems = currentList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ==========================================
  // Handlers CRUD Material Modal
  // ==========================================
  const handleOpenAdd = (presetName?: string, presetCategory?: 'ACTIVE' | 'EXCIPIENT') => {
    setFormCode('');
    setFormName(presetName || '');
    setFormCategory(presetCategory || 'ACTIVE');
    setFormStandard('');
    setFormCasNumber('');
    setFormAliases([]);
    setFormAliasInput('');
    setFormDescription('');
    crud.openAdd();
  };

  const handleOpenEdit = (mat: RawMaterial) => {
    setFormCode(mat.code || '');
    setFormName(mat.name || '');
    setFormCategory(mat.category || 'ACTIVE');
    setFormStandard(mat.standard || '');
    setFormCasNumber(mat.casNumber || '');
    setFormAliases(mat.aliases || []);
    setFormAliasInput('');
    setFormDescription(mat.description || '');
    crud.openEdit(mat);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return notify({ type: 'WARNING', message: 'Vui lòng nhập Tên nguyên liệu chuẩn!' });

    setIsSubmitting(true);
    const materialData: RawMaterial = {
      id: crud.selectedItem?.id || generateId('rm'),
      code: formCode.trim() || undefined,
      name: formName.trim(),
      category: formCategory,
      standard: formStandard.trim() || undefined,
      casNumber: formCasNumber.trim() || undefined,
      aliases: formAliases.filter(a => a.trim() !== ''),
      description: formDescription.trim() || undefined,
      createdAt: crud.selectedItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (crud.mode === 'EDIT') {
        await updateRawMaterial(materialData);
        notify({ type: 'SUCCESS', message: 'Đã cập nhật thông tin nguyên liệu.' });
      } else {
        await addRawMaterial(materialData);
        notify({ type: 'SUCCESS', message: 'Đã thêm nguyên liệu mới vào Danh mục chuẩn.' });

        // Tự động kiểm tra và liên kết với các công thức có tên khớp
        const matchingFormulas = productFormulas.filter(f => 
          (f.ingredients || []).some(i => !i.materialId && i.name.trim().toLowerCase() === materialData.name.toLowerCase()) ||
          (f.excipients || []).some(e => !e.materialId && e.name.trim().toLowerCase() === materialData.name.toLowerCase())
        );

        if (matchingFormulas.length > 0) {
          for (const f of matchingFormulas) {
            const updatedIngs = (f.ingredients || []).map(i => 
              (!i.materialId && i.name.trim().toLowerCase() === materialData.name.toLowerCase()) ? { ...i, materialId: materialData.id } : i
            );
            const updatedExcs = (f.excipients || []).map(e => 
              (!e.materialId && e.name.trim().toLowerCase() === materialData.name.toLowerCase()) ? { ...e, materialId: materialData.id } : e
            );
            await updateProductFormula({ ...f, ingredients: updatedIngs, excipients: updatedExcs, updatedAt: new Date().toISOString() });
          }
          notify({ type: 'INFO', message: `Đã tự động liên kết với ${matchingFormulas.length} công thức phù hợp.` });
        }
      }
      crud.close();
    } catch (error: any) {
      console.error(error);
      notify({ type: 'ERROR', message: error.message || 'Lỗi khi lưu nguyên liệu' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (crud.selectedItem) {
      try {
        await deleteRawMaterial(crud.selectedItem.id);
        notify({ type: 'SUCCESS', message: 'Đã xóa nguyên liệu khỏi danh mục.' });
        crud.close();
      } catch (error: any) {
        // Warning already shown
      }
    }
  };

  const handleAddAlias = () => {
    const trimmed = formAliasInput.trim();
    if (trimmed && !formAliases.includes(trimmed)) {
      setFormAliases([...formAliases, trimmed]);
      setFormAliasInput('');
    }
  };

  const removeAlias = (index: number) => {
    setFormAliases(formAliases.filter((_, i) => i !== index));
  };

  const handleAliasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAlias();
    }
  };

  const handlePasteAlias = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    const newAliases = pasteData
      .split(/[,;\n]+/)
      .map(item => item.trim())
      .filter(item => item !== '' && !formAliases.includes(item));

    if (newAliases.length > 0) {
      setFormAliases(prev => [...prev, ...newAliases]);
    }
  };

  // ==========================================
  // Handlers AI Harmonization
  // ==========================================
  const handleOpenHarmonizer = () => {
    setIsAnalyzingHarmonization(true);
    setIsHarmonizerOpen(true);
    setTimeout(() => {
      const report = analyzeMaterialDuplicates(rawMaterials, productFormulas, productMap);
      setHarmonizationReport(report);
      setIsAnalyzingHarmonization(false);
    }, 400);
  };

  const handleExecuteMerge = async (group: DuplicateGroup) => {
    setExecutingMergeGroupId(group.id);
    try {
      const plan = createMergeExecutionPlan(group, productFormulas);
      
      // 1. Cập nhật primary material với aliases mới
      await updateRawMaterial(plan.updatedPrimaryMaterial);

      // 2. Cập nhật các formulas chuyển hướng materialId
      for (const formula of plan.updatedFormulas) {
        await updateProductFormula(formula);
      }

      // 3. Xóa các duplicate materials
      for (const delId of plan.deletedMaterialIds) {
        await deleteRawMaterial(delId);
      }

      notify({ 
        type: 'SUCCESS', 
        message: `Đã gộp thành công ${group.duplicateMaterials.length} nguyên liệu vào "${plan.updatedPrimaryMaterial.name}" và cập nhật ${plan.updatedFormulas.length} công thức.` 
      });

      logAuditAction({
        action: 'UPDATE',
        collection: 'SYSTEM',
        documentId: plan.updatedPrimaryMaterial.id,
        details: `AI Harmonizer: Gộp ${group.duplicateMaterials.map(d => d.name).join(', ')} vào ${plan.updatedPrimaryMaterial.name}`,
        performedBy: user?.email || 'unknown'
      });

      // Tái quét lại báo cáo
      const updatedMaterials = rawMaterials.filter(m => !plan.deletedMaterialIds.includes(m.id));
      const newReport = analyzeMaterialDuplicates(updatedMaterials, productFormulas, productMap);
      setHarmonizationReport(newReport);
    } catch (error: any) {
      console.error(error);
      notify({ type: 'ERROR', message: error.message || 'Lỗi khi gộp nguyên liệu' });
    } finally {
      setExecutingMergeGroupId(null);
    }
  };

  // 1-Click Auto Link cho Consistency Tab
  const handleAutoLinkFormulaItem = async (formulaId: string, ingredientName: string, targetMaterialId: string, isIngredient: boolean) => {
    const formula = productFormulas.find(f => f.id === formulaId);
    if (!formula) return;

    try {
      let updatedIngredients = [...(formula.ingredients || [])];
      let updatedExcipients = [...(formula.excipients || [])];

      if (isIngredient) {
        updatedIngredients = updatedIngredients.map(i => 
          i.name.trim().toLowerCase() === ingredientName.trim().toLowerCase() ? { ...i, materialId: targetMaterialId } : i
        );
      } else {
        updatedExcipients = updatedExcipients.map(e => 
          e.name.trim().toLowerCase() === ingredientName.trim().toLowerCase() ? { ...e, materialId: targetMaterialId } : e
        );
      }

      await updateProductFormula({
        ...formula,
        ingredients: updatedIngredients,
        excipients: updatedExcipients,
        updatedAt: new Date().toISOString(),
      });

      notify({ type: 'SUCCESS', message: `Đã liên kết "${ingredientName}" với Danh mục chuẩn.` });
    } catch (error: any) {
      notify({ type: 'ERROR', message: error.message || 'Lỗi khi liên kết' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-500">
      <datalist id="standards-datalist">
        {COMMON_PHARMA_STANDARDS.map(s => <option key={s} value={s} />)}
      </datalist>

      {/* Page Header */}
      <PageHeader 
        title="Quản lý Nguyên liệu & Thành phần" 
        subtitle="Trung tâm Quản lý Danh mục Nguyên liệu chuẩn (Master Catalog), Tiêu chuẩn Dược điển, Ma trận Công thức và Rà soát AI"
        icon={BookUser}
        action={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenHarmonizer}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
            >
              <Sparkles size={15} className="animate-pulse" />
              <span>AI Rà soát & Chuẩn hóa</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleOpenAdd()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Plus size={16} />
                <span>Thêm Nguyên liệu</span>
              </button>
            )}
          </div>
        }
      />

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <BookUser size={22} />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Tổng Master Catalog</div>
            <div className="text-xl font-black text-slate-800 dark:text-zinc-100">{metrics.total} <span className="text-xs font-medium text-slate-400">nguyên liệu</span></div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <Beaker size={22} />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Hoạt chất (Active)</div>
            <div className="text-xl font-black text-slate-800 dark:text-zinc-100">{metrics.activeCount} <span className="text-xs font-medium text-slate-400">chất</span></div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="p-3 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
            <Component size={22} />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Tá dược / Phụ liệu</div>
            <div className="text-xl font-black text-slate-800 dark:text-zinc-100">{metrics.excipientCount} <span className="text-xs font-medium text-slate-400">chất</span></div>
          </div>
        </div>

        <div className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs ${metrics.unlinkedIngredients > 0 ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/20' : 'border-slate-200/80 dark:border-zinc-800'}`}>
          <div className={`p-3 rounded-xl ${metrics.unlinkedIngredients > 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'}`}>
            {metrics.unlinkedIngredients > 0 ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Chưa gắn mã trong Công thức</div>
            <div className="text-xl font-black text-slate-800 dark:text-zinc-100">
              {metrics.unlinkedIngredients} <span className="text-xs font-medium text-slate-400">thành phần</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('CATALOG')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'CATALOG'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-850'
          }`}
        >
          <BookUser size={15} />
          <span>Danh mục Nguyên liệu Chuẩn ({rawMaterials.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MATRIX')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'MATRIX'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-850'
          }`}
        >
          <FlaskConical size={15} />
          <span>Ma trận Sử dụng trong Công thức ({aggregatedFormulaItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CONSISTENCY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'CONSISTENCY'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-850'
          }`}
        >
          <ShieldCheck size={15} />
          <span>Kiểm soát Toàn vẹn & Auto-Link</span>
          {metrics.unlinkedIngredients > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {metrics.unlinkedIngredients}
            </span>
          )}
        </button>
      </div>

      {/* Filter Bar */}
      <DSFilterBar>
        <DSSearchInput 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          placeholder={activeTab === 'CATALOG' ? "Tìm theo tên chuẩn, mã NL, tiêu chuẩn Dược điển, mã CAS hoặc alias..." : "Tìm thành phần trong công thức sản phẩm..."} 
        />

        <DSSelect 
          icon={Filter} 
          value={filterCategory} 
          onChange={(e) => setFilterCategory(e.target.value as any)} 
          className="w-36"
        >
          <option value="ALL">Tất cả loại</option>
          <option value="ACTIVE">Hoạt chất</option>
          <option value="EXCIPIENT">Tá dược</option>
          {activeTab === 'CATALOG' && <option value="OTHER">Khác</option>}
        </DSSelect>

        {activeTab === 'CATALOG' ? (
          <>
            <DSSelect 
              icon={ShieldCheck} 
              value={filterStandard} 
              onChange={(e) => setFilterStandard(e.target.value)} 
              className="w-44 truncate"
            >
              <option value="ALL">Tất cả Tiêu chuẩn</option>
              <option value="DĐVN">Dược điển VN (DĐVN)</option>
              <option value="USP">USP (Mỹ)</option>
              <option value="Ph.Eur">Ph.Eur (Châu Âu)</option>
              <option value="BP">BP (Anh)</option>
              <option value="TCCS">TCCS - NSX</option>
            </DSSelect>

            <DSSelect 
              icon={Layers} 
              value={filterUsage} 
              onChange={(e) => setFilterUsage(e.target.value as any)} 
              className="w-40"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="USED">Đã dùng trong SP</option>
              <option value="UNUSED">Chưa sử dụng</option>
            </DSSelect>
          </>
        ) : (
          <DSSelect 
            icon={Package} 
            value={filterProductId} 
            onChange={(e) => setFilterProductId(e.target.value)} 
            className="w-48 truncate"
          >
            <option value="">Tất cả sản phẩm</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
            ))}
          </DSSelect>
        )}

        {activeTab !== 'CONSISTENCY' && (
          <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
        )}
      </DSFilterBar>

      {/* ========================================================================= */}
      {/* TAB 1 CONTENT: MASTER CATALOG                                            */}
      {/* ========================================================================= */}
      {activeTab === 'CATALOG' && (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {(paginatedItems as RawMaterial[]).map(material => {
                const hydrated = hydratedMap.get(material.id);
                const usedProducts = hydrated?.usedInProducts || [];

                return (
                  <DSCard key={material.id} className="p-5 flex flex-col justify-between hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 group relative overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                    <div>
                      {/* Top Row: Code & Category Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-500 dark:text-zinc-400">
                          <Hash size={13} className="text-indigo-500" />
                          <span>{material.code || 'MÃ: CHƯA GÁN'}</span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          material.category === 'ACTIVE' 
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50' 
                            : material.category === 'EXCIPIENT' 
                              ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700' 
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50'
                        }`}>
                          {material.category === 'ACTIVE' ? 'Hoạt chất' : material.category === 'EXCIPIENT' ? 'Tá dược' : 'Khác'}
                        </span>
                      </div>

                      {/* Main Title & Description */}
                      <h3 className="font-bold text-base text-slate-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
                        {material.name}
                      </h3>

                      {material.description && (
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                          {material.description}
                        </p>
                      )}

                      {/* Standards & CAS Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {material.standard && (
                          <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            <ShieldCheck size={11} />
                            {material.standard}
                          </span>
                        )}
                        {material.casNumber && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                            CAS: {material.casNumber}
                          </span>
                        )}
                      </div>

                      {/* Aliases List */}
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5 flex items-center gap-1">
                          <Layers3 size={11} />
                          <span>Tên gọi khác ({material.aliases?.length || 0})</span>
                        </div>
                        {material.aliases && material.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {material.aliases.slice(0, 3).map((al, aIdx) => (
                              <span key={aIdx} className="bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40 px-2 py-0.5 rounded text-[10px] font-semibold">
                                {al}
                              </span>
                            ))}
                            {material.aliases.length > 3 && (
                              <span className="bg-slate-100 dark:bg-zinc-800 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                +{material.aliases.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Chưa có alias</span>
                        )}
                      </div>
                    </div>

                    {/* Footer: Used in Products & Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {usedProducts.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2 py-0.5 rounded-lg">
                            <Package size={12} />
                            {usedProducts.length} sản phẩm
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 italic">
                            Chưa dùng
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(material)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => crud.openDelete(material)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            title="Xóa nguyên liệu"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </DSCard>
                );
              })}
            </div>
          ) : (
            <DSTable>
              <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80">
                <tr className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-4 py-3">Mã NL</th>
                  <th className="px-4 py-3">Tên Nguyên liệu Chuẩn</th>
                  <th className="px-4 py-3">Tiêu chuẩn & CAS</th>
                  <th className="px-4 py-3">Các tên gọi khác (Aliases)</th>
                  <th className="px-4 py-3 text-center">Phân loại</th>
                  <th className="px-4 py-3">Sản phẩm đang dùng</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                {(paginatedItems as RawMaterial[]).map(material => {
                  const hydrated = hydratedMap.get(material.id);
                  const usedProducts = hydrated?.usedInProducts || [];

                  return (
                    <tr key={material.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-xs text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                        {material.code || <span className="text-slate-300 font-normal italic">Chưa gán</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{material.name}</div>
                        {material.description && (
                          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{material.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="space-y-1">
                          {material.standard && (
                            <span className="inline-block bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 px-2 py-0.5 rounded text-[10px] font-bold">
                              {material.standard}
                            </span>
                          )}
                          {material.casNumber && (
                            <div className="text-[10px] font-mono text-slate-400">CAS: {material.casNumber}</div>
                          )}
                          {!material.standard && !material.casNumber && (
                            <span className="text-[10px] text-slate-300 italic">---</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {material.aliases && material.aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {material.aliases.map((al, aIdx) => (
                              <span key={aIdx} className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 px-2 py-0.5 rounded text-[11px] font-semibold">
                                {al}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Chưa có alias</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          material.category === 'ACTIVE' ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400' :
                          material.category === 'EXCIPIENT' ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300' :
                          'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}>
                          {material.category === 'ACTIVE' ? 'Hoạt chất' : material.category === 'EXCIPIENT' ? 'Tá dược' : 'Khác'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {usedProducts.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {usedProducts.map(p => (
                              <Link 
                                key={p.id} 
                                to={`/products/${p.id}`}
                                className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold transition-colors"
                              >
                                <Package size={11} />
                                {p.name}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Chưa sử dụng</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <ActionButtons 
                          onEdit={() => handleOpenEdit(material)} 
                          onDelete={() => crud.openDelete(material)} 
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DSTable>
          )}

          {filteredCatalog.length === 0 && (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
              <BookUser size={36} className="mx-auto text-slate-300 dark:text-zinc-600 mb-3" />
              <p className="text-slate-500 dark:text-zinc-400 font-bold text-sm">Không tìm thấy nguyên liệu nào phù hợp.</p>
              <p className="text-xs text-slate-400 mt-1">Hãy thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Thêm Nguyên liệu" để tạo mới.</p>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2 CONTENT: FORMULA USAGE MATRIX                                      */}
      {/* ========================================================================= */}
      {activeTab === 'MATRIX' && (
        <>
          <DSTable>
            <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80">
              <tr className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-4 py-3">Tên thành phần trong Công thức</th>
                <th className="px-4 py-3">Phân loại</th>
                <th className="px-4 py-3">Trạng thái Master Catalog</th>
                <th className="px-4 py-3">Sản phẩm & Hàm lượng áp dụng</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
              {(paginatedItems as AggregatedFormulaItem[]).map(item => {
                const isLinked = !!item.materialId && materialMap.has(item.materialId);
                const master = item.linkedMaterial;

                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-zinc-100 text-sm">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        item.type === 'ACTIVE' 
                          ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {item.type === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isLinked && master ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-1 rounded-lg w-fit">
                          <Link2 size={13} />
                          <span>{master.name}</span>
                          {master.code && <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">({master.code})</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2.5 py-1 rounded-lg w-fit">
                          <Unlink size={13} />
                          <span>Chưa liên kết Master Catalog</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {item.relatedProducts.map(p => (
                          <Link
                            key={p.id}
                            to={`/products/${p.id}`}
                            className="inline-flex items-center gap-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:border-indigo-300 transition-colors shadow-2xs"
                          >
                            <Package size={12} className="text-indigo-500" />
                            <span>{p.name}</span>
                            {p.content && <span className="text-[11px] font-mono text-slate-400">({p.content})</span>}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!isLinked && isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleOpenAdd(item.name, item.type)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-900"
                        >
                          <Plus size={13} />
                          <span>+ Thêm vào Master Catalog</span>
                        </button>
                      ) : isLinked && master && isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(master)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Edit2 size={13} />
                          <span>Sửa Master</span>
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DSTable>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 3 CONTENT: DATA CONSISTENCY & AUTO-LINK                               */}
      {/* ========================================================================= */}
      {activeTab === 'CONSISTENCY' && (
        <div className="space-y-6">
          {/* Consistency Overview Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-6 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-indigo-600" />
                  <span>Trạng thái Toàn vẹn Liên kết Nguyên liệu</span>
                </h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                  Rà soát 100% các thành phần trong công thức sản phẩm để đảm bảo đã được ánh xạ chuẩn vào Master Catalog.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {metrics.unlinkedIngredients === 0 ? '100%' : `${Math.max(0, 100 - metrics.unlinkedIngredients * 10)}%`}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Điểm liên kết (Data Health)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Unlinked Items List */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-700 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Unlink size={16} className="text-amber-500" />
                <span>Thành phần trong Công thức chưa liên kết ({metrics.unlinkedIngredients})</span>
              </h4>
            </div>

            {metrics.unlinkedIngredients === 0 ? (
              <div className="p-8 text-center bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">Tuyệt vời! 100% thành phần công thức đã được liên kết chuẩn xác.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {aggregatedFormulaItems.filter(i => !i.materialId || !materialMap.has(i.materialId)).map(unlinked => {
                  // Thử tìm gợi ý nguyên liệu chuẩn
                  const suggested = rawMaterials.find(m => 
                    m.name.toLowerCase() === unlinked.name.toLowerCase() ||
                    (m.aliases && m.aliases.some(a => a.toLowerCase() === unlinked.name.toLowerCase()))
                  );

                  return (
                    <div key={unlinked.id} className="p-4 bg-slate-50 dark:bg-zinc-850 rounded-xl border border-slate-200/80 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{unlinked.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                            {unlinked.type === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 dark:text-zinc-500 mt-1 flex flex-wrap gap-1">
                          <span>Sử dụng trong:</span>
                          {unlinked.relatedProducts.map(p => (
                            <span key={p.id} className="font-bold text-slate-600 dark:text-zinc-300">{p.name} ({p.content}), </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {suggested ? (
                          <button
                            type="button"
                            onClick={() => {
                              unlinked.relatedProducts.forEach(p => {
                                handleAutoLinkFormulaItem(p.formulaId, unlinked.name, suggested.id, unlinked.type === 'ACTIVE');
                              });
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                          >
                            <Link2 size={13} />
                            <span>Khớp với: "{suggested.name}" (1-Click Link)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenAdd(unlinked.name, unlinked.type)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                          >
                            <Plus size={13} />
                            <span>+ Thêm mới vào Master Catalog</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}

      {/* ========================================================================= */}
      {/* MODAL: THÊM / CẬP NHẬT NGUYÊN LIỆU                                      */}
      {/* ========================================================================= */}
      <Modal 
        isOpen={crud.mode === 'ADD' || crud.mode === 'EDIT'} 
        onClose={crud.close} 
        title={crud.mode === 'ADD' ? "Thêm Nguyên liệu Chuẩn" : "Cập nhật Nguyên liệu"} 
        icon={BookUser}
      >
        <form onSubmit={handleSaveMaterial} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1 flex items-center gap-1">
                <Hash size={11} />
                Mã nguyên liệu
              </label>
              <input
                type="text"
                value={formCode}
                onChange={e => setFormCode(e.target.value)}
                placeholder="VD: NL-GINKGO-01"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">
                Tên nguyên liệu chuẩn *
              </label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="VD: Ginkgo Biloba Extract (Cao khô Bạch quả)"
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Phân loại</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200"
              >
                <option value="ACTIVE">Hoạt chất (Active)</option>
                <option value="EXCIPIENT">Tá dược (Excipient)</option>
                <option value="OTHER">Khác (Bao bì, Dung môi...)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Tiêu chuẩn áp dụng</label>
              <input
                type="text"
                list="standards-datalist"
                value={formStandard}
                onChange={e => setFormStandard(e.target.value)}
                placeholder="VD: DĐVN V, USP..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Mã CAS (Tùy chọn)</label>
              <input
                type="text"
                value={formCasNumber}
                onChange={e => setFormCasNumber(e.target.value)}
                placeholder="VD: 90045-36-6"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Aliases Tag Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1 flex items-center gap-1.5">
              <Layers3 size={12} className="text-indigo-500" />
              Các tên gọi khác & Bí danh (Aliases)
            </label>
            <div className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-wrap gap-1.5 min-h-[44px] items-center focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
              {formAliases.map((alias, i) => (
                <div key={i} className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-lg shadow-2xs">
                  {alias}
                  <button type="button" onClick={() => removeAlias(i)} className="text-indigo-300 hover:text-rose-500">
                    <XIcon size={13} />
                  </button>
                </div>
              ))}
              <div className="flex-1 flex items-center min-w-[120px]">
                <input
                  type="text"
                  value={formAliasInput}
                  onChange={e => setFormAliasInput(e.target.value)}
                  onKeyDown={handleAliasKeyDown}
                  onPaste={handlePasteAlias}
                  placeholder="Gõ tên khác rồi nhấn Enter..."
                  className="flex-1 bg-transparent outline-none text-xs p-1 placeholder:text-slate-400 font-medium text-slate-800 dark:text-zinc-200"
                />
                <button 
                  type="button" 
                  onClick={handleAddAlias}
                  disabled={!formAliasInput.trim()}
                  className="ml-1 p-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-0 disabled:pointer-events-none"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pl-1">Nhấn Enter hoặc dán danh sách phân cách bằng dấu phẩy để thêm nhiều alias.</p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Mô tả / Ghi chú</label>
            <textarea
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Ghi chú về nguồn gốc, nhà sản xuất..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-medium text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-zinc-850">
            <button
              type="button"
              onClick={crud.close}
              className="px-5 py-2 text-slate-500 dark:text-zinc-400 font-bold uppercase text-xs hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {crud.mode === 'ADD' ? "Thêm mới" : "Cập nhật"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: AI HARMONIZER */}
      <Modal
        isOpen={isHarmonizerOpen}
        onClose={() => setIsHarmonizerOpen(false)}
        title="AI Rà soát & Chuẩn hóa Danh mục Nguyên liệu"
        icon={Sparkles}
      >
        <div className="space-y-6">
          {isAnalyzingHarmonization ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">AI đang quét và phân tích độ tương đồng ngữ nghĩa...</p>
              <p className="text-xs text-slate-400">Đang đối chiếu tên chuẩn, bí danh và công thức sản phẩm</p>
            </div>
          ) : harmonizationReport ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-indigo-50/60 dark:bg-indigo-950/40 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                  <div className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Tổng Nguyên liệu</div>
                  <div className="text-lg font-black text-slate-800 dark:text-zinc-100 mt-0.5">{harmonizationReport.totalMaterials}</div>
                </div>

                <div className="bg-purple-50/60 dark:bg-purple-950/40 p-3.5 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <div className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Cặp có nguy cơ trùng</div>
                  <div className="text-lg font-black text-slate-800 dark:text-zinc-100 mt-0.5">{harmonizationReport.duplicateGroups.length} nhóm</div>
                </div>

                <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Điểm sạch dữ liệu</div>
                  <div className="text-lg font-black text-slate-800 dark:text-zinc-100 mt-0.5">{harmonizationReport.healthScore}/100</div>
                </div>
              </div>

              {/* Duplicate Groups List */}
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                  <Layers3 size={13} />
                  <span>Danh sách Nhóm nguyên liệu cần Gộp ({harmonizationReport.duplicateGroups.length})</span>
                </h4>

                {harmonizationReport.duplicateGroups.length === 0 ? (
                  <div className="p-8 text-center bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                    <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">Tuyệt vời! Không phát hiện nguyên liệu nào bị trùng lặp trong danh mục.</p>
                  </div>
                ) : (
                  harmonizationReport.duplicateGroups.map((group) => {
                    const isMerging = executingMergeGroupId === group.id;

                    return (
                      <div key={group.id} className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded text-[10px] font-black">
                              Độ tương đồng: {group.similarityScore}%
                            </span>
                            <span className="text-xs text-slate-400 italic">({group.reason})</span>
                          </div>
                          {group.affectedFormulasCount > 0 && (
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                              {group.affectedFormulasCount} công thức liên quan
                            </span>
                          )}
                        </div>

                        {/* Visual Merge Representation */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                          {/* Primary */}
                          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
                            <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-1">
                              <CheckCircle2 size={12} />
                              <span>Giữ làm Tên Chuẩn (Primary)</span>
                            </div>
                            <div className="font-bold text-sm text-slate-800 dark:text-zinc-100">{group.primaryMaterial.name}</div>
                            {group.primaryMaterial.code && (
                              <div className="text-[10px] font-mono text-slate-400">Mã: {group.primaryMaterial.code}</div>
                            )}
                          </div>

                          {/* Duplicates to merge */}
                          <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl">
                            <div className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400 flex items-center gap-1 mb-1">
                              <ArrowRight size={12} />
                              <span>Gộp & Chuyển thành Aliases</span>
                            </div>
                            <div className="space-y-1">
                              {group.duplicateMaterials.map(d => (
                                <div key={d.id} className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                                  <span>{d.name}</span>
                                  {d.code && <span className="text-[10px] font-mono text-slate-400">({d.code})</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Execute Button */}
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            disabled={isMerging}
                            onClick={() => handleExecuteMerge(group)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
                          >
                            {isMerging ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            <span>Thực hiện Gộp vào "{group.primaryMaterial.name}"</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : null}

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-850">
            <button
              type="button"
              onClick={() => setIsHarmonizerOpen(false)}
              className="px-5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold uppercase text-xs rounded-xl hover:bg-slate-200 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: DELETE CONFIRMATION */}
      {crud.selectedItem && (
        <Modal
          isOpen={crud.mode === 'DELETE'}
          onClose={crud.close}
          title="Xác nhận Xóa Nguyên liệu"
          icon={Trash2}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-zinc-300">
              Bạn có chắc chắn muốn xóa nguyên liệu <strong>"{crud.selectedItem.name}"</strong> khỏi Master Catalog?
            </p>
            {hydratedMap.get(crud.selectedItem.id)?.usedInProducts?.length ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-medium">
                ⚠️ Cảnh báo: Nguyên liệu này đang được sử dụng trong {hydratedMap.get(crud.selectedItem.id)?.usedInProducts.length} sản phẩm. Xóa nguyên liệu sẽ làm mất liên kết trong các công thức sản phẩm đó.
              </div>
            ) : null}

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-zinc-850">
              <button
                type="button"
                onClick={crud.close}
                className="px-4 py-2 text-slate-500 font-bold uppercase text-xs hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteMaterial}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase text-xs shadow-md shadow-rose-600/20"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MaterialList;