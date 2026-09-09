import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import { useDataGraph } from '../../../../hooks/useDataGraph';
import { useUIStore } from '../../../../store/useUIStore';
import { useCrud } from '../../../../hooks';
import { RawMaterial, ProductFormula } from '../../../../types';
import { generateId } from '../../../../utils';
import { 
  analyzeMaterialDuplicates, 
  createMergeExecutionPlan, 
  DuplicateGroup, 
  HarmonizationReport,
  calculateStringSimilarity
} from '../../../../services/ai/materialHarmonizerService';
import { logAuditAction } from '../../../../services/auditService';
import { AggregatedFormulaItem, MaterialCategoryFilter, MaterialTab, MaterialUsageFilter } from '../types';

export const CAS_REGEX = /^\d{2,7}-\d{2}-\d{1}$/;
export const validateCasNumber = (cas: string): boolean => {
  if (!cas || !cas.trim()) return true;
  return CAS_REGEX.test(cas.trim());
};

export const useMaterialListState = () => {
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

  // Tab State
  const [activeTab, setActiveTab] = useState<MaterialTab>('CATALOG');

  // View Mode & Pagination
  const viewMode = useUIStore(s => s.materialViewMode);
  const setViewMode = useUIStore(s => s.setMaterialViewMode);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === 'grid' ? 12 : 15;

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<MaterialCategoryFilter>('ALL');
  const [filterStandard, setFilterStandard] = useState<string>('ALL');
  const [filterUsage, setFilterUsage] = useState<MaterialUsageFilter>('ALL');
  const [filterProductId, setFilterProductId] = useState<string>('');

  // CRUD State for Master Material Modal
  const crud = useCrud<RawMaterial>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'ACTIVE' | 'EXCIPIENT' | 'OTHER'>('ACTIVE');
  const [formStandard, setFormStandard] = useState('');
  const [formCasNumber, setFormCasNumber] = useState('');
  const [formCasError, setFormCasError] = useState('');
  const [formAliases, setFormAliases] = useState<string[]>([]);
  const [formAliasInput, setFormAliasInput] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Duplicate name warning state
  const [duplicateWarnings, setDuplicateWarnings] = useState<RawMaterial[]>([]);
  const duplicateCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI Harmonizer Modal State
  const [isHarmonizerOpen, setIsHarmonizerOpen] = useState(false);
  const [harmonizationReport, setHarmonizationReport] = useState<HarmonizationReport | null>(null);
  const [isAnalyzingHarmonization, setIsAnalyzingHarmonization] = useState(false);
  const [executingMergeGroupId, setExecutingMergeGroupId] = useState<string | null>(null);

  // Map tra cứu nhanh
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const materialMap = useMemo(() => new Map(rawMaterials.map(m => [m.id, m])), [rawMaterials]);
  const hydratedMap = useMemo(() => new Map(hydratedMaterials.map(m => [m.id, m])), [hydratedMaterials]);

  // Reset trang khi đổi filter
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterStandard, filterUsage, filterProductId, activeTab, viewMode]);

  // TAB 1: Danh sách Master Catalog
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

  // TAB 2: Danh sách Tổng hợp từ Công thức (Matrix)
  const aggregatedFormulaItems = useMemo(() => {
    const map = new Map<string, AggregatedFormulaItem>();

    productFormulas.forEach(formula => {
      const product = productMap.get(formula.productId);
      if (!product) return;

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

  // Kiểm tra trùng tên real-time với debounce 400ms
  const checkDuplicateNames = useCallback((name: string, currentId?: string) => {
    if (duplicateCheckTimer.current) clearTimeout(duplicateCheckTimer.current);
    if (!name.trim() || name.trim().length < 3) {
      setDuplicateWarnings([]);
      return;
    }
    duplicateCheckTimer.current = setTimeout(() => {
      const warnings = rawMaterials.filter(m => {
        if (m.id === currentId) return false;
        const score = calculateStringSimilarity(name, m.name);
        if (score >= 0.80) return true;
        return (m.aliases || []).some(a => calculateStringSimilarity(name, a) >= 0.85);
      });
      setDuplicateWarnings(warnings);
    }, 400);
  }, [rawMaterials]);

  const handleOpenAdd = (presetName?: string, presetCategory?: 'ACTIVE' | 'EXCIPIENT') => {
    setFormCode('');
    setFormName(presetName || '');
    setFormCategory(presetCategory || 'ACTIVE');
    setFormStandard('');
    setFormCasNumber('');
    setFormCasError('');
    setFormAliases([]);
    setFormAliasInput('');
    setFormDescription('');
    setDuplicateWarnings([]);
    crud.openAdd();
  };

  const handleOpenEdit = (mat: RawMaterial) => {
    setFormCode(mat.code || '');
    setFormName(mat.name || '');
    setFormCategory(mat.category || 'ACTIVE');
    setFormStandard(mat.standard || '');
    setFormCasNumber(mat.casNumber || '');
    setFormCasError('');
    setFormAliases(mat.aliases || []);
    setFormAliasInput('');
    setFormDescription(mat.description || '');
    setDuplicateWarnings([]);
    crud.openEdit(mat);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return notify({ type: 'WARNING', message: 'Vui lòng nhập Tên nguyên liệu chuẩn!' });

    if (formCasNumber.trim() && !validateCasNumber(formCasNumber)) {
      setFormCasError('Định dạng CAS không hợp lệ. Ví dụ đúng: 90045-36-6');
      return;
    }
    setFormCasError('');

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
        logAuditAction({
          action: 'UPDATE',
          collection: 'SYSTEM',
          documentId: materialData.id,
          details: `Cập nhật nguyên liệu: ${materialData.name}${materialData.code ? ` (${materialData.code})` : ''}`,
          performedBy: user?.email || 'unknown'
        });
      } else {
        await addRawMaterial(materialData);
        notify({ type: 'SUCCESS', message: 'Đã thêm nguyên liệu mới vào Danh mục chuẩn.' });
        logAuditAction({
          action: 'CREATE',
          collection: 'SYSTEM',
          documentId: materialData.id,
          details: `Thêm mới nguyên liệu: ${materialData.name}${materialData.code ? ` (${materialData.code})` : ''}`,
          performedBy: user?.email || 'unknown'
        });

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
      setDuplicateWarnings([]);
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

  // Handlers AI Harmonization
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
      await updateRawMaterial(plan.updatedPrimaryMaterial);

      for (const formula of plan.updatedFormulas) {
        await updateProductFormula(formula);
      }

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

  return {
    rawMaterials,
    products,
    productFormulas,
    isAdmin,
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    currentPage,
    setCurrentPage,
    totalPages,
    searchTerm,
    setSearchTerm,
    filterCategory,
    setFilterCategory,
    filterStandard,
    setFilterStandard,
    filterUsage,
    setFilterUsage,
    filterProductId,
    setFilterProductId,
    hydratedMap,
    materialMap,
    metrics,
    paginatedItems,
    filteredCatalog,
    aggregatedFormulaItems,
    crud,
    isSubmitting,
    formCode,
    setFormCode,
    formName,
    setFormName,
    formCategory,
    setFormCategory,
    formStandard,
    setFormStandard,
    formCasNumber,
    setFormCasNumber,
    formCasError,
    setFormCasError,
    formAliases,
    formAliasInput,
    setFormAliasInput,
    formDescription,
    setFormDescription,
    duplicateWarnings,
    isHarmonizerOpen,
    setIsHarmonizerOpen,
    harmonizationReport,
    isAnalyzingHarmonization,
    executingMergeGroupId,
    handleOpenAdd,
    handleOpenEdit,
    handleSaveMaterial,
    handleDeleteMaterial,
    handleAddAlias,
    removeAlias,
    handleAliasKeyDown,
    handlePasteAlias,
    handleOpenHarmonizer,
    handleExecuteMerge,
    handleAutoLinkFormulaItem,
    checkDuplicateNames
  };
};
