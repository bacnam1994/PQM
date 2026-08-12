import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X, Search, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { generateId, normalizeSearch, autoFormatInput, parseNumberFromText } from '../../utils';
import { ProductFormula, FormulaIngredient } from '../../types';
import { DSFormInput, SpecialCharToolbar } from '../../components';
import { COMMON_CRITERIA_UNITS } from './TCCSFormPage';

const ProductFormulaFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 1. Khởi tạo Hook & State
  const { productFormulas, products, rawMaterials, addProductFormula, updateProductFormula, notify } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formulaToEdit, setFormulaToEdit] = useState<ProductFormula | null>(null);
  const [ingredients, setIngredients] = useState<FormulaIngredient[]>([]);
  const [excipients, setExcipients] = useState<FormulaIngredient[]>([]);

  // State cho Sub-component: Dropdown tìm kiếm Sản phẩm
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
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

  const handleIngredientChange = (index: number, field: keyof FormulaIngredient, value: any) => {
    const newIngredients = [...ingredients];
    // Tự động chuẩn hóa số mũ cho các trường số
    const formatted = (field === 'declaredContent' || field === 'elementalContent') ? autoFormatInput(String(value)) : value;
    (newIngredients[index] as any)[field] = formatted;
    setIngredients(newIngredients);
  };

  const handleExcipientChange = (index: number, field: keyof FormulaIngredient, value: any) => {
    const newExcipients = [...excipients];
    // Tự động chuẩn hóa số mũ cho các trường số
    const formatted = (field === 'declaredContent' || field === 'elementalContent') ? autoFormatInput(String(value)) : value;
    (newExcipients[index] as any)[field] = formatted;
    setExcipients(newExcipients);
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
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          {id ? 'Chỉnh sửa Công thức' : 'Tạo Công thức mới'}
        </h1>
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
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                placeholder="Tìm kiếm sản phẩm..."
                className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none shadow-sm text-sm focus:ring-2 focus:ring-indigo-500"
                disabled={!!id}
              />
              {selectedProductId && <CheckCircle2 className="absolute right-4 top-1/2 text-emerald-600" size={16} />}
              {showProductDropdown && !id && (
                <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
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

            {/* Ingredients */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-black text-slate-600 uppercase tracking-widest">Thành phần Hoạt chất</h4>
                <button type="button" onClick={() => setIngredients([...ingredients, { id: generateId('ing'), name: '', declaredContent: 0, unit: '' }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"><Plus size={16}/></button>
              </div>
              {/* Header labels */}
              {ingredients.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                  <span className="col-span-5 text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Tên hoạt chất</span>
                  <span className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right pr-1">Hàm lượng</span>
                  <span className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">ĐVT</span>
                  <span className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right pr-1">HL Nguyên tố</span>
                </div>
              )}
              <div className="space-y-2">
                {ingredients.map((ing, index) => (
                  <div key={ing.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50/50 p-1.5 rounded-xl border hover:border-slate-200 transition-all">
                    <input placeholder="Tên hoạt chất" value={ing.name} onChange={e => handleIngredientChange(index, 'name', e.target.value)} className="col-span-5 px-3 py-2 bg-white border border-slate-100 shadow-sm rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400" />
                    <input placeholder="0" value={ing.declaredContent} onChange={e => handleIngredientChange(index, 'declaredContent', e.target.value)} className="col-span-2 px-3 py-2 bg-white border border-slate-100 shadow-sm rounded-lg text-xs font-bold outline-none text-right focus:ring-2 focus:ring-indigo-400" />
                    <input placeholder="ĐVT" value={ing.unit} onChange={e => handleIngredientChange(index, 'unit', e.target.value)} className="col-span-2 px-3 py-2 bg-white border border-slate-100 shadow-sm rounded-lg text-xs font-bold outline-none text-center focus:ring-2 focus:ring-indigo-400" list="formula-unit-suggestions" />
                    <input placeholder="(rỗng nếu không có)" value={ing.elementalContent || ''} onChange={e => handleIngredientChange(index, 'elementalContent', e.target.value)} className="col-span-2 px-3 py-2 bg-white border border-slate-100 shadow-sm rounded-lg text-xs font-bold outline-none text-right focus:ring-2 focus:ring-indigo-400" />
                    <button type="button" onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><X size={16}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Excipients */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-black text-slate-600 uppercase tracking-widest">Thành phần Tá dược</h4>
                <button type="button" onClick={() => setExcipients([...excipients, { id: generateId('exc'), name: '', declaredContent: 0, unit: '' }])} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"><Plus size={16}/></button>
              </div>
              {/* Header labels */}
              {excipients.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                  <span className="col-span-8 text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Tên tá dược</span>
                  <span className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right pr-1">Hàm lượng</span>
                  <span className="col-span-1 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">ĐVT</span>
                </div>
              )}
              <div className="space-y-2">
                {excipients.map((exc, index) => (
                  <div key={exc.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50/50 p-1.5 rounded-xl border hover:border-slate-200 transition-all">
                    <input placeholder="Tên tá dược" value={exc.name} onChange={e => handleExcipientChange(index, 'name', e.target.value)} className="col-span-8 px-3 py-2 bg-white border border-slate-100 shadow-sm rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-slate-400" />
                    <input placeholder="0" value={exc.declaredContent} onChange={e => handleExcipientChange(index, 'declaredContent', e.target.value)} className="col-span-2 px-3 py-2 bg-white border border-slate-100 shadow-sm rounded-lg text-xs font-bold outline-none text-right focus:ring-2 focus:ring-slate-400" />
                    <input placeholder="ĐVT" value={exc.unit} onChange={e => handleExcipientChange(index, 'unit', e.target.value)} className="col-span-1 px-3 py-2 bg-white border border-slate-100 shadow-sm rounded-lg text-xs font-bold outline-none text-center focus:ring-2 focus:ring-slate-400" list="formula-unit-suggestions" />
                    <button type="button" onClick={() => setExcipients(excipients.filter((_, i) => i !== index))} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><X size={16}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Sensory & Other Info */}
            <div className="grid grid-cols-2 gap-6 pt-6 border-t">
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
            <div className="flex justify-end gap-3 pt-6 border-t mt-6">
              <button type="button" onClick={() => navigate('/product-formulas')} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl">Hủy</button>
              <button type="submit" disabled={isSubmitting} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs flex items-center gap-2">
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