import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X, Search, CheckCircle2, Link2, Unlink, Sparkles, Box, Check, ChevronDown } from 'lucide-react';
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
        const dc = parseNumberFromText(String(item.declaredContent));
        const ec = item.elementalContent !== undefined && item.elementalContent !== null && String(item.elementalContent).trim() !== ''
          ? parseNumberFromText(String(item.elementalContent))
          : NaN;
        return {
          ...item,
          declaredContent: isNaN(dc) ? 0 : dc,
          elementalContent: isNaN(ec) ? undefined : ec,
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
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/product-formulas')} className="p-2 bg-white text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
            {id ? 'Chỉnh sửa Công thức' : 'Tạo Công thức mới'}
          </h1>
          <p className="text-xs text-slate-400 font-medium">Liên kết trực tiếp với Danh mục Nguyên liệu chuẩn và Tiêu chuẩn cơ sở (TCCS).</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {(!id || formulaToEdit) && (
          <form onSubmit={handleSave} className="space-y-8">
            <datalist id="formula-unit-suggestions">{COMMON_CRITERIA_UNITS.map(unit => <option key={unit} value={unit} />)}</datalist>
            <SpecialCharToolbar />
            
            {/* Product Selection */}
            <div className="relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-1 block">Sản phẩm áp dụng *</label>
              <Search className="absolute left-4 top-1/2 text-slate-400" size={16} />
              <input 
                type="text" value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); if (!e.target.value) setSelectedProductId(''); }}
                onFocus={() => setShowProductDropdown(true)}
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 250)}
                placeholder="Tìm kiếm mã hoặc tên sản phẩm..."
                className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none shadow-sm text-sm focus:ring-2 focus:ring-indigo-500"
                disabled={!!id}
              />
              {selectedProductId && <CheckCircle2 className="absolute right-4 top-1/2 text-emerald-600" size={16} />}
              {showProductDropdown && !id && (
                <div className="absolute z-30 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                  {products.filter(p => !productSearch || normalizeSearch(p.name).includes(normalizeSearch(productSearch)) || normalizeSearch(p.code).includes(normalizeSearch(productSearch))).map(p => (
                    <div key={p.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setSelectedProductId(p.id); setProductSearch(`${p.code} - ${p.name}`); setShowProductDropdown(false); }}
                      className={`px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors ${selectedProductId === p.id ? 'bg-indigo-50' : ''}`}>
                      <p className="text-sm font-bold text-slate-700">{p.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase">{p.code}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ingredients (Hoạt chất) */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Thành phần Hoạt chất</h4>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                    {ingredients.length} hoạt chất
                  </span>
                </div>
                <button type="button" onClick={() => setIngredients([...ingredients, { id: generateId('ing'), name: '', declaredContent: 0, unit: 'mg/viên' }])} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-bold flex items-center gap-1.5">
                  <Plus size={14}/> Thêm hoạt chất
                </button>
              </div>

              {ingredients.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                  <span className="col-span-5 text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Tên hoạt chất & Kho nguyên liệu</span>
                  <span className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right pr-1">Hàm lượng</span>
                  <span className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">ĐVT</span>
                  <span className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right pr-1">HL Nguyên tố</span>
                  <span className="col-span-1"></span>
                </div>
              )}

              <div className="space-y-2.5">
                {ingredients.map((ing, index) => {
                  const linkedMaterial = ing.materialId ? materialMap.get(ing.materialId) : undefined;
                  const matchingMaterials = rawMaterials.filter(m => 
                    !ing.name || normalizeSearch(m.name).includes(normalizeSearch(ing.name)) || 
                    (Array.isArray(m.aliases) && m.aliases.some(a => normalizeSearch(a).includes(normalizeSearch(ing.name))))
                  );

                  return (
                    <div key={ing.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50/70 p-2 rounded-xl border border-slate-200/60 hover:border-indigo-200 transition-all relative">
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
                            className={`w-full pl-3 pr-8 py-2 bg-white border shadow-sm rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 ${linkedMaterial ? 'border-emerald-200 text-slate-800' : 'border-slate-200'}`} 
                          />
                          {linkedMaterial ? (
                            <span title={`Đã liên kết: ${linkedMaterial.name} (${linkedMaterial.code || 'RM'})`} className="absolute right-2 text-emerald-600 flex items-center gap-0.5 text-[10px] font-bold">
                              <Link2 size={13} />
                            </span>
                          ) : (
                            <span title="Chưa liên kết kho nguyên liệu" className="absolute right-2 text-slate-300">
                              <Unlink size={13} />
                            </span>
                          )}
                        </div>

                        {/* Dropdown gợi ý từ Kho nguyên liệu */}
                        {activeMaterialDropdown?.type === 'ingredient' && activeMaterialDropdown.index === index && (matchingMaterials.length > 0 || ing.name.trim()) && (
                          <div className="absolute z-40 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-56 overflow-y-auto">
                            <div className="p-1.5 bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                              Gợi ý từ Danh mục Nguyên liệu ({matchingMaterials.length})
                            </div>
                            {matchingMaterials.map(m => (
                              <div 
                                key={m.id} 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelectMaterialForIngredient(index, m)}
                                className="p-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-none flex items-center justify-between text-xs transition-colors"
                              >
                                <div>
                                  <span className="font-bold text-slate-700">{m.name}</span>
                                  {m.aliases && m.aliases.length > 0 && (
                                    <span className="text-[10px] text-slate-400 ml-1.5">({m.aliases.join(', ')})</span>
                                  )}
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.category === 'ACTIVE' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                  {m.category === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                                </span>
                              </div>
                            ))}
                            {ing.name.trim() && !matchingMaterials.some(m => m.name.toLowerCase() === ing.name.trim().toLowerCase()) && (
                              <div
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleQuickCreateMaterialForIngredient(index, ing.name)}
                                className="p-2.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 font-bold text-xs cursor-pointer flex items-center gap-1.5 border-t border-indigo-100 transition-colors"
                              >
                                <Plus size={13} />
                                <span>+ Thêm nhanh "{ing.name}" vào Danh mục chuẩn</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <input placeholder="0" value={ing.declaredContent} onChange={e => handleIngredientChange(index, 'declaredContent', e.target.value)} className="col-span-2 px-3 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold outline-none text-right focus:ring-2 focus:ring-indigo-400" />
                      <input placeholder="ĐVT" value={ing.unit} onChange={e => handleIngredientChange(index, 'unit', e.target.value)} className="col-span-2 px-3 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold outline-none text-center focus:ring-2 focus:ring-indigo-400" list="formula-unit-suggestions" />
                      <input placeholder="(Tùy chọn)" value={ing.elementalContent || ''} onChange={e => handleIngredientChange(index, 'elementalContent', e.target.value)} className="col-span-2 px-3 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold outline-none text-right focus:ring-2 focus:ring-indigo-400" />
                      <button type="button" onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))} className="col-span-1 p-2 text-slate-300 hover:text-red-500 transition-colors flex justify-center"><X size={16}/></button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Excipients (Tá dược) */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Thành phần Tá dược</h4>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                    {excipients.length} tá dược
                  </span>
                </div>
                <button type="button" onClick={() => setExcipients([...excipients, { id: generateId('exc'), name: '', declaredContent: 0, unit: 'mg/viên' }])} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-xs font-bold flex items-center gap-1.5">
                  <Plus size={14}/> Thêm tá dược
                </button>
              </div>

              {excipients.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                  <span className="col-span-7 text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Tên tá dược & Kho nguyên liệu</span>
                  <span className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right pr-1">Hàm lượng</span>
                  <span className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">ĐVT</span>
                  <span className="col-span-1"></span>
                </div>
              )}

              <div className="space-y-2.5">
                {excipients.map((exc, index) => {
                  const linkedMaterial = exc.materialId ? materialMap.get(exc.materialId) : undefined;
                  const matchingMaterials = rawMaterials.filter(m => 
                    !exc.name || normalizeSearch(m.name).includes(normalizeSearch(exc.name)) || 
                    (Array.isArray(m.aliases) && m.aliases.some(a => normalizeSearch(a).includes(normalizeSearch(exc.name))))
                  );

                  return (
                    <div key={exc.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50/70 p-2 rounded-xl border border-slate-200/60 hover:border-slate-300 transition-all relative">
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
                            className={`w-full pl-3 pr-8 py-2 bg-white border shadow-sm rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-slate-400 ${linkedMaterial ? 'border-emerald-200 text-slate-800' : 'border-slate-200'}`} 
                          />
                          {linkedMaterial ? (
                            <span title={`Đã liên kết: ${linkedMaterial.name}`} className="absolute right-2 text-emerald-600 flex items-center gap-0.5 text-[10px] font-bold">
                              <Link2 size={13} />
                            </span>
                          ) : (
                            <span title="Chưa liên kết kho nguyên liệu" className="absolute right-2 text-slate-300">
                              <Unlink size={13} />
                            </span>
                          )}
                        </div>

                        {/* Dropdown gợi ý từ Kho nguyên liệu */}
                        {activeMaterialDropdown?.type === 'excipient' && activeMaterialDropdown.index === index && (matchingMaterials.length > 0 || exc.name.trim()) && (
                          <div className="absolute z-40 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-56 overflow-y-auto">
                            <div className="p-1.5 bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                              Gợi ý từ Danh mục Nguyên liệu ({matchingMaterials.length})
                            </div>
                            {matchingMaterials.map(m => (
                              <div 
                                key={m.id} 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelectMaterialForExcipient(index, m)}
                                className="p-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-none flex items-center justify-between text-xs transition-colors"
                              >
                                <div>
                                  <span className="font-bold text-slate-700">{m.name}</span>
                                  {m.aliases && m.aliases.length > 0 && (
                                    <span className="text-[10px] text-slate-400 ml-1.5">({m.aliases.join(', ')})</span>
                                  )}
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.category === 'ACTIVE' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                  {m.category === 'ACTIVE' ? 'Hoạt chất' : 'Tá dược'}
                                </span>
                              </div>
                            ))}
                            {exc.name.trim() && !matchingMaterials.some(m => m.name.toLowerCase() === exc.name.trim().toLowerCase()) && (
                              <div
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleQuickCreateMaterialForExcipient(index, exc.name)}
                                className="p-2.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 font-bold text-xs cursor-pointer flex items-center gap-1.5 border-t border-indigo-100 transition-colors"
                              >
                                <Plus size={13} />
                                <span>+ Thêm nhanh "{exc.name}" vào Danh mục chuẩn</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <input placeholder="0" value={exc.declaredContent} onChange={e => handleExcipientChange(index, 'declaredContent', e.target.value)} className="col-span-2 px-3 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold outline-none text-right focus:ring-2 focus:ring-slate-400" />
                      <input placeholder="ĐVT" value={exc.unit} onChange={e => handleExcipientChange(index, 'unit', e.target.value)} className="col-span-2 px-3 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold outline-none text-center focus:ring-2 focus:ring-slate-400" list="formula-unit-suggestions" />
                      <button type="button" onClick={() => setExcipients(excipients.filter((_, i) => i !== index))} className="col-span-1 p-2 text-slate-300 hover:text-red-500 transition-colors flex justify-center"><X size={16}/></button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sensory & Other Info */}
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-600 mb-2">Thông tin Cảm quan</h4>
                <div className="space-y-2">
                  <DSFormInput label="Dạng bào chế" name="dosageForm" defaultValue={formulaToEdit?.sensory?.dosageForm} placeholder="VD: Viên nang, dung dịch..." />
                  <DSFormInput label="Màu sắc" name="color" defaultValue={formulaToEdit?.sensory?.color} />
                  <DSFormInput label="Mùi vị" name="smellTaste" defaultValue={formulaToEdit?.sensory?.smellTaste} />
                  <DSFormInput label="Trạng thái / Ngoại quan" name="appearance" defaultValue={formulaToEdit?.sensory?.appearance} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-600 mb-2">Thông tin khác</h4>
                <div className="space-y-2">
                  <DSFormInput label="Quy cách đóng gói" name="packaging" defaultValue={formulaToEdit?.packaging} />
                  <DSFormInput label="Điều kiện bảo quản" name="storage" defaultValue={formulaToEdit?.storage} />
                  <DSFormInput label="Hạn dùng" name="shelfLife" defaultValue={formulaToEdit?.shelfLife} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
              <button type="button" onClick={() => navigate('/product-formulas')} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl">Hủy</button>
              <button type="submit" disabled={isSubmitting} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
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