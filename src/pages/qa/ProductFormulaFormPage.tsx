import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PlusIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  LinkIcon,
  CubeIcon,
  CheckIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import { generateId, normalizeSearch, autoFormatInput, parseNumberFromText } from '../../utils';
import { ProductFormula, FormulaIngredient, RawMaterial } from '../../types';
import { DSFormInput, SpecialCharToolbar } from '../../components';
import { COMMON_CRITERIA_UNITS } from './TCCSFormPage';
import { normalizeName } from '../../services/criteriaAliasService';

const ProductFormulaFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 1. Khởi tạo Hook & State
  const { productFormulas, products, rawMaterials, addProductFormula, updateProductFormula, addRawMaterial, notify } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formulaToEdit, setFormulaToEdit] = useState<ProductFormula | null>(null);
  const [ingredients, setIngredients] = useState<FormulaIngredient[]>([]);
  const [excipients, setExcipients] = useState<FormulaIngredient[]>([]);

  // State cho Sub-component: Dropdown tìm kiếm Sản phẩm
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Active Dropdown cho Ingredient/Excipient row
  const [activeMaterialDropdown, setActiveMaterialDropdown] = useState<{ type: 'ingredient' | 'excipient'; index: number } | null>(null);
  
  // 2. Load dữ liệu
  useEffect(() => {
    if (id) {
      const formula = productFormulas.find(f => f.id === id);
      if (formula) {
        setFormulaToEdit(formula);
        setSelectedProductId(formula.productId);
        const p = products.find(prod => prod.id === formula.productId);
        setProductSearch(p ? `${p.code} - ${p.name}` : '');
        setIngredients(formula.ingredients || []);
        setExcipients(formula.excipients || []);
      } else {
        notify({ type: 'ERROR', message: 'Không tìm thấy Công thức!' });
        navigate('/product-formulas');
      }
    }
  }, [id, productFormulas, products, navigate, notify]);

  // Map tra cứu RawMaterial
  const materialMap = useMemo(() => new Map(rawMaterials.map(m => [m.id, m])), [rawMaterials]);

  const handleIngredientChange = (index: number, field: keyof FormulaIngredient, value: any) => {
    const newIngredients = [...ingredients];
    const formatted = (field === 'declaredContent' || field === 'elementalContent') ? autoFormatInput(String(value)) : value;
    (newIngredients[index] as any)[field] = formatted;
    
    // Nếu sửa tên -> Thử tìm kiếm khớp với RawMaterial
    if (field === 'name') {
      const normVal = normalizeName(String(value));
      const matched = rawMaterials.find(m => 
        normalizeName(m.name) === normVal || (Array.isArray(m.aliases) && m.aliases.some(a => normalizeName(a) === normVal))
      );
      if (matched) {
        newIngredients[index].materialId = matched.id;
      }
    }
    
    setIngredients(newIngredients);
  };

  const handleSelectMaterialForIngredient = (index: number, material: RawMaterial) => {
    const newIngredients = [...ingredients];
    newIngredients[index].name = material.name;
    newIngredients[index].materialId = material.id;
    if (!newIngredients[index].unit) {
      newIngredients[index].unit = 'mg/viên';
    }
    setIngredients(newIngredients);
    setActiveMaterialDropdown(null);
  };

  const handleQuickCreateMaterialForIngredient = async (index: number, name: string) => {
    const newId = generateId('rm');
    const newMat: RawMaterial = {
      id: newId,
      name: name.trim(),
      category: 'ACTIVE',
      aliases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addRawMaterial(newMat);
    const newIngredients = [...ingredients];
    newIngredients[index].materialId = newId;
    setIngredients(newIngredients);
    setActiveMaterialDropdown(null);
    notify({ type: 'SUCCESS', message: `Đã thêm "${name}" vào Danh mục Nguyên liệu chuẩn!` });
  };

  const handleExcipientChange = (index: number, field: keyof FormulaIngredient, value: any) => {
    const newExcipients = [...excipients];
    const formatted = (field === 'declaredContent' || field === 'elementalContent') ? autoFormatInput(String(value)) : value;
    (newExcipients[index] as any)[field] = formatted;
    
    // Nếu sửa tên -> Thử tìm kiếm khớp với RawMaterial
    if (field === 'name') {
      const normVal = normalizeName(String(value));
      const matched = rawMaterials.find(m => 
        normalizeName(m.name) === normVal || (Array.isArray(m.aliases) && m.aliases.some(a => normalizeName(a) === normVal))
      );
      if (matched) {
        newExcipients[index].materialId = matched.id;
      }
    }
    
    setExcipients(newExcipients);
  };

  const handleSelectMaterialForExcipient = (index: number, material: RawMaterial) => {
    const newExcipients = [...excipients];
    newExcipients[index].name = material.name;
    newExcipients[index].materialId = material.id;
    if (!newExcipients[index].unit) {
      newExcipients[index].unit = 'mg/viên';
    }
    setExcipients(newExcipients);
    setActiveMaterialDropdown(null);
  };

  const handleQuickCreateMaterialForExcipient = async (index: number, name: string) => {
    const newId = generateId('rm');
    const newMat: RawMaterial = {
      id: newId,
      name: name.trim(),
      category: 'EXCIPIENT',
      aliases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addRawMaterial(newMat);
    const newExcipients = [...excipients];
    newExcipients[index].materialId = newId;
    setExcipients(newExcipients);
    setActiveMaterialDropdown(null);
    notify({ type: 'SUCCESS', message: `Đã thêm "${name}" vào Danh mục Nguyên liệu chuẩn!` });
  };

  // 3. Hàm Save
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProductId) {
      notify({ type: 'WARNING', message: 'Vui lòng chọn một sản phẩm!' });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const sanitizeIngredient = (item: FormulaIngredient) => {
        let dc = item.declaredContent;
        if (typeof dc === 'string') {
          const parsed = parseNumberFromText(dc);
          dc = isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
        } else if (typeof dc !== 'number' || isNaN(dc) || !isFinite(dc)) {
          dc = 0;
        }

        let ec = item.elementalContent;
        if (ec !== undefined && ec !== null && String(ec).trim() !== '') {
          if (typeof ec === 'string') {
            const parsed = parseNumberFromText(ec);
            ec = isNaN(parsed) || !isFinite(parsed) ? undefined : parsed;
          } else if (typeof ec !== 'number' || isNaN(ec) || !isFinite(ec)) {
            ec = undefined;
          }
        } else {
          ec = undefined;
        }

        return {
          ...item,
          declaredContent: dc,
          elementalContent: ec,
        };
      };

      const formulaData = {
        productId: selectedProductId,
        ingredients: ingredients.filter(i => i.name).map(sanitizeIngredient),
        excipients: excipients.filter(e => e.name).map(sanitizeIngredient),
        sensory: {
          dosageForm: formData.get('dosageForm')?.toString() || '',
          appearance: formData.get('appearance')?.toString() || '',
          color: formData.get('color')?.toString() || '',
          smellTaste: formData.get('smellTaste')?.toString() || '',
        },
        packaging: formData.get('packaging')?.toString() || '',
        storage: formData.get('storage')?.toString() || '',
        shelfLife: formData.get('shelfLife')?.toString() || '',
      };

      if (id && formulaToEdit) {
        await updateProductFormula({ ...formulaToEdit, ...formulaData, updatedAt: new Date().toISOString() });
        notify({ type: 'SUCCESS', title: 'Đã cập nhật', message: 'Cập nhật công thức thành công.' });
      } else {
        await addProductFormula({ id: generateId('form'), ...formulaData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã tạo công thức mới.' });
      }
      navigate('/product-formulas');
    } catch (error) {
      console.error("Lỗi khi lưu công thức:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/product-formulas')}
          className="p-2 bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink rounded-lg border border-border transition-colors"
          title="Quay lại danh sách"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <CubeIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            {id ? 'Chỉnh sửa Công thức' : 'Tạo Công thức mới'}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Liên kết trực tiếp với Danh mục Nguyên liệu chuẩn và Tiêu chuẩn cơ sở (TCCS).
          </p>
        </div>
      </div>

      <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
        {(!id || formulaToEdit) && (
          <form onSubmit={handleSave} className="space-y-6">
            <datalist id="formula-unit-suggestions">
              {COMMON_CRITERIA_UNITS.map(unit => <option key={unit} value={unit} />)}
            </datalist>
            <SpecialCharToolbar />
            
            {/* Product Selection */}
            <div className="relative">
              <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5 block">
                Sản phẩm áp dụng *
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted h-4 w-4" />
                <input 
                  type="text" 
                  value={productSearch}
                  onChange={(e) => { 
                    setProductSearch(e.target.value); 
                    setShowProductDropdown(true); 
                    if (!e.target.value) setSelectedProductId(''); 
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 250)}
                  placeholder="Tìm kiếm mã hoặc tên sản phẩm..."
                  className="w-full pl-10 pr-10 py-2.5 bg-surface-2 border border-border rounded-lg font-medium text-sm text-ink outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-inner"
                  disabled={!!id}
                />
                {selectedProductId && (
                  <CheckCircleIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 h-5 w-5" />
                )}
              </div>

              {showProductDropdown && !id && (
                <div className="absolute z-30 w-full mt-1.5 bg-surface rounded-xl shadow-xl border border-border max-h-60 overflow-y-auto">
                  {products.filter(p => !productSearch || normalizeSearch(p.name).includes(normalizeSearch(productSearch)) || normalizeSearch(p.code).includes(normalizeSearch(productSearch))).map(p => (
                    <div 
                      key={p.id} 
                      onMouseDown={(e) => e.preventDefault()} 
                      onClick={() => { 
                        setSelectedProductId(p.id); 
                        setProductSearch(`${p.code} - ${p.name}`); 
                        setShowProductDropdown(false); 
                      }}
                      className={`px-4 py-3 hover:bg-surface-2 cursor-pointer border-b border-border last:border-none transition-colors ${selectedProductId === p.id ? 'bg-surface-2' : ''}`}
                    >
                      <p className="text-sm font-semibold text-ink">{p.name}</p>
                      <p className="text-[10px] font-mono font-medium text-ink-muted uppercase">{p.code}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ingredients (Hoạt chất) */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Thành phần Hoạt chất</h4>
                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-200 dark:border-emerald-800/50">
                    {ingredients.length} hoạt chất
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIngredients([...ingredients, { id: generateId('ing'), name: '', declaredContent: 0, unit: 'mg/viên' }])} 
                  className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors text-xs font-semibold flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800/40"
                >
                  <PlusIcon className="h-4 w-4" /> Thêm hoạt chất
                </button>
              </div>

              {ingredients.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-1 text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                  <span className="col-span-5 pl-1">Tên hoạt chất & Kho nguyên liệu</span>
                  <span className="col-span-2 text-right pr-1">Hàm lượng</span>
                  <span className="col-span-2 text-center">ĐVT</span>
                  <span className="col-span-2 text-right pr-1">HL Nguyên tố</span>
                  <span className="col-span-1"></span>
                </div>
              )}

              <div className="space-y-2">
                {ingredients.map((ing, index) => {
                  const linkedMaterial = ing.materialId ? materialMap.get(ing.materialId) : undefined;
                  const matchingMaterials = rawMaterials.filter(m => 
                    !ing.name || normalizeSearch(m.name).includes(normalizeSearch(ing.name)) || 
                    (Array.isArray(m.aliases) && m.aliases.some(a => normalizeSearch(a).includes(normalizeSearch(ing.name))))
                  );

                  return (
                    <div key={ing.id} className="grid grid-cols-12 gap-2 items-center bg-surface-2 p-2 rounded-xl border border-border hover:border-border transition-all relative">
                      <div className="col-span-5 relative">
                        <div className="relative flex items-center">
                          <input 
                            placeholder="Nhập hoặc chọn tên hoạt chất..." 
                            value={ing.name} 
                            onChange={e => {
                              handleIngredientChange(index, 'name', e.target.value);
                              setActiveMaterialDropdown({ type: 'ingredient', index });
                            }} 
                            onFocus={() => setActiveMaterialDropdown({ type: 'ingredient', index })}
                            onBlur={() => setTimeout(() => setActiveMaterialDropdown(null), 250)}
                            className={`w-full pl-3 pr-8 py-2 bg-surface border rounded-lg text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500 ${linkedMaterial ? 'border-emerald-300 dark:border-emerald-700' : 'border-border'}`} 
                          />
                          {linkedMaterial ? (
                            <span title={`Đã liên kết: ${linkedMaterial.name} (${linkedMaterial.code || 'RM'})`} className="absolute right-2 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <LinkIcon className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span title="Chưa liên kết kho nguyên liệu" className="absolute right-2 text-ink-muted opacity-40">
                              <LinkIcon className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>

                        {/* Dropdown gợi ý từ Kho nguyên liệu */}
                        {activeMaterialDropdown?.type === 'ingredient' && activeMaterialDropdown.index === index && (matchingMaterials.length > 0 || ing.name.trim()) && (
                          <div className="absolute z-40 w-full mt-1 bg-surface rounded-xl shadow-xl border border-border max-h-56 overflow-y-auto">
                            <div className="p-1.5 bg-surface-2 border-b border-border text-[9px] font-semibold text-ink-muted uppercase tracking-wider">
                              Gợi ý từ Danh mục Nguyên liệu ({matchingMaterials.length})
                            </div>
                            {matchingMaterials.map(m => (
                              <div 
                                key={m.id} 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelectMaterialForIngredient(index, m)}
                                className="p-2 hover:bg-surface-2 cursor-pointer border-b border-border last:border-none flex items-center justify-between text-xs transition-colors"
                              >
                                <div>
                                  <span className="font-semibold text-ink">{m.name}</span>
                                  {m.aliases && m.aliases.length > 0 && (
                                    <span className="text-[10px] text-ink-muted ml-1.5">({m.aliases.join(', ')})</span>
                                  )}
                                </div>
                                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${m.category === 'ACTIVE' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-surface-3 text-ink-muted'}`}>
                                  {m.category === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                                </span>
                              </div>
                            ))}
                            {ing.name.trim() && !matchingMaterials.some(m => m.name.toLowerCase() === ing.name.trim().toLowerCase()) && (
                              <div
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleQuickCreateMaterialForIngredient(index, ing.name)}
                                className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-semibold text-xs cursor-pointer flex items-center gap-1.5 border-t border-emerald-200 dark:border-emerald-800/40 transition-colors"
                              >
                                <PlusIcon className="h-3.5 w-3.5" />
                                <span>+ Thêm nhanh "{ing.name}" vào Danh mục chuẩn</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <input 
                        placeholder="0" 
                        value={ing.declaredContent} 
                        onChange={e => handleIngredientChange(index, 'declaredContent', e.target.value)} 
                        className="col-span-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none text-right focus:ring-2 focus:ring-emerald-500" 
                      />
                      <input 
                        placeholder="ĐVT" 
                        value={ing.unit} 
                        onChange={e => handleIngredientChange(index, 'unit', e.target.value)} 
                        className="col-span-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none text-center focus:ring-2 focus:ring-emerald-500" 
                        list="formula-unit-suggestions" 
                      />
                      <input 
                        placeholder="(Tùy chọn)" 
                        value={ing.elementalContent || ''} 
                        onChange={e => handleIngredientChange(index, 'elementalContent', e.target.value)} 
                        className="col-span-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none text-right focus:ring-2 focus:ring-emerald-500" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))} 
                        className="col-span-1 p-2 text-ink-muted hover:text-red-500 transition-colors flex justify-center"
                        title="Xóa hoạt chất"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Excipients (Tá dược) */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Thành phần Tá dược</h4>
                  <span className="text-[10px] bg-surface-2 text-ink-muted px-2 py-0.5 rounded-full font-semibold border border-border">
                    {excipients.length} tá dược
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setExcipients([...excipients, { id: generateId('exc'), name: '', declaredContent: 0, unit: 'mg/viên' }])} 
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-ink rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 border border-border"
                >
                  <PlusIcon className="h-4 w-4" /> Thêm tá dược
                </button>
              </div>

              {excipients.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-1 text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                  <span className="col-span-7 pl-1">Tên tá dược & Kho nguyên liệu</span>
                  <span className="col-span-2 text-right pr-1">Hàm lượng</span>
                  <span className="col-span-2 text-center">ĐVT</span>
                  <span className="col-span-1"></span>
                </div>
              )}

              <div className="space-y-2">
                {excipients.map((exc, index) => {
                  const linkedMaterial = exc.materialId ? materialMap.get(exc.materialId) : undefined;
                  const matchingMaterials = rawMaterials.filter(m => 
                    !exc.name || normalizeSearch(m.name).includes(normalizeSearch(exc.name)) || 
                    (Array.isArray(m.aliases) && m.aliases.some(a => normalizeSearch(a).includes(normalizeSearch(exc.name))))
                  );

                  return (
                    <div key={exc.id} className="grid grid-cols-12 gap-2 items-center bg-surface-2 p-2 rounded-xl border border-border hover:border-border transition-all relative">
                      <div className="col-span-7 relative">
                        <div className="relative flex items-center">
                          <input 
                            placeholder="Nhập hoặc chọn tên tá dược..." 
                            value={exc.name} 
                            onChange={e => {
                              handleExcipientChange(index, 'name', e.target.value);
                              setActiveMaterialDropdown({ type: 'excipient', index });
                            }} 
                            onFocus={() => setActiveMaterialDropdown({ type: 'excipient', index })}
                            onBlur={() => setTimeout(() => setActiveMaterialDropdown(null), 250)}
                            className={`w-full pl-3 pr-8 py-2 bg-surface border rounded-lg text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500 ${linkedMaterial ? 'border-emerald-300 dark:border-emerald-700' : 'border-border'}`} 
                          />
                          {linkedMaterial ? (
                            <span title={`Đã liên kết: ${linkedMaterial.name}`} className="absolute right-2 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <LinkIcon className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span title="Chưa liên kết kho nguyên liệu" className="absolute right-2 text-ink-muted opacity-40">
                              <LinkIcon className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>

                        {/* Dropdown gợi ý từ Kho nguyên liệu */}
                        {activeMaterialDropdown?.type === 'excipient' && activeMaterialDropdown.index === index && (matchingMaterials.length > 0 || exc.name.trim()) && (
                          <div className="absolute z-40 w-full mt-1 bg-surface rounded-xl shadow-xl border border-border max-h-56 overflow-y-auto">
                            <div className="p-1.5 bg-surface-2 border-b border-border text-[9px] font-semibold text-ink-muted uppercase tracking-wider">
                              Gợi ý từ Danh mục Nguyên liệu ({matchingMaterials.length})
                            </div>
                            {matchingMaterials.map(m => (
                              <div 
                                key={m.id} 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelectMaterialForExcipient(index, m)}
                                className="p-2 hover:bg-surface-2 cursor-pointer border-b border-border last:border-none flex items-center justify-between text-xs transition-colors"
                              >
                                <div>
                                  <span className="font-semibold text-ink">{m.name}</span>
                                  {m.aliases && m.aliases.length > 0 && (
                                    <span className="text-[10px] text-ink-muted ml-1.5">({m.aliases.join(', ')})</span>
                                  )}
                                </div>
                                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${m.category === 'ACTIVE' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-surface-3 text-ink-muted'}`}>
                                  {m.category === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                                </span>
                              </div>
                            ))}
                            {exc.name.trim() && !matchingMaterials.some(m => m.name.toLowerCase() === exc.name.trim().toLowerCase()) && (
                              <div
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleQuickCreateMaterialForExcipient(index, exc.name)}
                                className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-semibold text-xs cursor-pointer flex items-center gap-1.5 border-t border-emerald-200 dark:border-emerald-800/40 transition-colors"
                              >
                                <PlusIcon className="h-3.5 w-3.5" />
                                <span>+ Thêm nhanh "{exc.name}" vào Danh mục chuẩn</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <input 
                        placeholder="0" 
                        value={exc.declaredContent} 
                        onChange={e => handleExcipientChange(index, 'declaredContent', e.target.value)} 
                        className="col-span-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none text-right focus:ring-2 focus:ring-emerald-500" 
                      />
                      <input 
                        placeholder="ĐVT" 
                        value={exc.unit} 
                        onChange={e => handleExcipientChange(index, 'unit', e.target.value)} 
                        className="col-span-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-ink outline-none text-center focus:ring-2 focus:ring-emerald-500" 
                        list="formula-unit-suggestions" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setExcipients(excipients.filter((_, i) => i !== index))} 
                        className="col-span-1 p-2 text-ink-muted hover:text-red-500 transition-colors flex justify-center"
                        title="Xóa tá dược"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sensory & Other Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border">
              <div>
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">Thông tin Cảm quan</h4>
                <div className="space-y-3">
                  <DSFormInput label="Dạng bào chế" name="dosageForm" defaultValue={formulaToEdit?.sensory?.dosageForm} placeholder="VD: Viên nang, dung dịch..." />
                  <DSFormInput label="Màu sắc" name="color" defaultValue={formulaToEdit?.sensory?.color} />
                  <DSFormInput label="Mùi vị" name="smellTaste" defaultValue={formulaToEdit?.sensory?.smellTaste} />
                  <DSFormInput label="Trạng thái / Ngoại quan" name="appearance" defaultValue={formulaToEdit?.sensory?.appearance} />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">Thông tin khác</h4>
                <div className="space-y-3">
                  <DSFormInput label="Quy cách đóng gói" name="packaging" defaultValue={formulaToEdit?.packaging} />
                  <DSFormInput label="Điều kiện bảo quản" name="storage" defaultValue={formulaToEdit?.storage} />
                  <DSFormInput label="Hạn dùng" name="shelfLife" defaultValue={formulaToEdit?.shelfLife} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-border">
              <button 
                type="button" 
                onClick={() => navigate('/product-formulas')} 
                className="px-4 py-2 text-ink-muted font-semibold text-xs hover:bg-surface-2 rounded-lg border border-border transition-colors"
              >
                Hủy
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckIcon className="h-4 w-4" />
                )}
                {id ? 'Cập nhật Công thức' : 'Lưu Công thức'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProductFormulaFormPage;