import React, { useState, useMemo, useCallback, memo } from 'react';
import { FlaskConical, Plus, Search, Trash2, Save, X, AlertCircle, Beaker, Eye, Thermometer, BookOpen, Loader2, LayoutGrid, List, Package, Component, FileSearch } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ProductFormula, FormulaIngredient } from '../types';
import { PageHeader, Modal, Pagination, DSFilterBar, DSSearchInput, DSSelect, DSTable, DSFormInput, DSViewToggle, DSCard, AddButton, ActionButtons, DeleteModal, SpecialCharToolbar, DSEmptyState } from '../components';
import { useCrud } from '../hooks';
import { useUIStore } from '../store/useUIStore';
import { generateId, autoFormatInput, parseNumberFromText } from '../utils';

// Helper: Format số sang dạng mũ (VD: 1000 -> 10³)
const formatScientific = (value: string | number) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value).trim();
  
  const match = stringValue.match(/^([<≤>≥~=]+)?\s*(.+)$/);
  const prefix = match && match[1] ? match[1] + ' ' : '';
  const coreValue = match ? match[2] : stringValue;

  let num = Number(coreValue);
  const coreUpper = coreValue.toUpperCase();
  const isSciFormat = coreUpper.includes('E') || coreValue.includes('10') || coreValue.includes('^') || coreUpper.includes('X');
  
  if (isNaN(num) || isSciFormat) {
    num = parseNumberFromText(coreValue);
    if (num === 0 && coreValue !== '0') return stringValue;
  }
  
  if (num === 0) return stringValue;

  if (isSciFormat || Math.abs(num) >= 1000000 || (Math.abs(num) > 0 && Math.abs(num) <= 0.00001)) {
    const exponent = Math.floor(Math.log10(Math.abs(num)));
    const mantissa = num / Math.pow(10, exponent);
    const roundedMantissa = Math.round((mantissa + Number.EPSILON) * 100000) / 100000;

    return (
      <span className="whitespace-nowrap">
        {prefix.trim()}{prefix ? ' ' : ''}
        {roundedMantissa !== 1 && <>{roundedMantissa} × </>}
        10<sup>{exponent}</sup>
      </span>
    );
  }
  return `${prefix.trim()}${prefix ? ' ' : ''}${num.toLocaleString('vi-VN', { maximumFractionDigits: 10 })}`;
};

// Tối ưu 1: Component hỗ trợ render từng dòng nguyên liệu riêng biệt
// Tránh việc React render lại hàng chục ô input khác mỗi khi người dùng gõ 1 ký tự
const FormulaRow = memo(({ item, index, type, rawMaterials, onUpdate, onRemove }: any) => {
  const handleNameBlur = useCallback(() => {
    if (!item.name || item.materialId) return;
    const enteredName = item.name.trim().toLowerCase();
    const matchedMaterial = rawMaterials.find((m: any) =>
      m.name.toLowerCase() === enteredName ||
      (m.aliases || []).some((alias: string) => alias.toLowerCase() === enteredName)
    );
    if (matchedMaterial) {
      onUpdate(index, 'materialId', matchedMaterial.id);
      useAppStore.getState().notify({ type: 'INFO', message: `Đã tự động liên kết "${item.name}" với "${matchedMaterial.name}".` });
    }
  }, [item.name, item.materialId, rawMaterials, index, onUpdate]);

  const isIngredient = type === 'ingredient';
  const namePlaceholder = isIngredient ? "VD: Vitamin C..." : "VD: Lactose, Tinh bột...";
  const catFilter = isIngredient ? ['ACTIVE', 'OTHER'] : ['EXCIPIENT', 'OTHER'];

  return (
    <tr className="group hover:bg-white transition-colors">
      <td className="p-2">
        <input
          type="text"
          placeholder={namePlaceholder}
          value={item.name}
          onChange={(e) => onUpdate(index, 'name', e.target.value)}
          onBlur={handleNameBlur}
          className={`w-full bg-transparent font-bold text-sm outline-none placeholder:font-normal ${isIngredient ? '' : 'text-slate-600'}`}
        />
      </td>
      <td className="p-2">
        <select
          value={item.materialId || ''}
          onChange={(e) => onUpdate(index, 'materialId', e.target.value)}
          className="w-full bg-white border border-slate-200 rounded text-xs py-1 px-2 outline-none focus:border-indigo-500"
        >
          <option value="">-- Chọn --</option>
          {rawMaterials.filter((m: any) => catFilter.includes(m.category)).map((m: any) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <input
          type="text"
          placeholder={isIngredient ? "0" : "-"}
          value={item.declaredContent}
          onChange={(e) => onUpdate(index, 'declaredContent', e.target.value)}
          className={`w-full bg-transparent font-mono font-bold text-sm outline-none text-right ${isIngredient ? 'text-indigo-600' : 'text-slate-600'}`}
        />
      </td>
      <td className="p-2">
        <input
          type="text"
          placeholder="-"
          value={item.elementalContent || ''}
          onChange={(e) => onUpdate(index, 'elementalContent', e.target.value)}
          className="w-full bg-transparent font-mono font-bold text-sm outline-none text-right text-blue-600"
        />
      </td>
      <td className="p-2">
        <input
          type="text"
          placeholder="mg"
          value={item.unit}
          onChange={(e) => onUpdate(index, 'unit', e.target.value)}
          className={`w-full bg-transparent font-bold text-xs outline-none text-center ${isIngredient ? 'text-slate-500' : 'text-slate-400'}`}
        />
      </td>
      <td className="p-2 text-center">
        <button type="button" onClick={() => onRemove(index)} className="text-slate-300 hover:text-red-500 transition-colors">
          <X size={14} />
        </button>
      </td>
    </tr>
  );
});

const ProductFormulaList: React.FC = () => {
  const products = useAppStore(state => state.products);
  const productFormulas = useAppStore(state => state.productFormulas);
  const rawMaterials = useAppStore(state => state.rawMaterials);
  const addProductFormula = useAppStore(state => state.addProductFormula);
  const updateProductFormula = useAppStore(state => state.updateProductFormula);
  const deleteProductFormula = useAppStore(state => state.deleteProductFormula);
  const notify = useAppStore(state => state.notify);

  const crud = useCrud<ProductFormula>();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const viewMode = useUIStore(s => s.formulaViewMode);
  const setViewMode = useUIStore(s => s.setFormulaViewMode);
  const [viewFormula, setViewFormula] = useState<ProductFormula | null>(null);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [ingredients, setIngredients] = useState<(Omit<FormulaIngredient, 'declaredContent' | 'elementalContent'> & { declaredContent: string | number; elementalContent?: string | number; materialId?: string })[]>([]);
  const [excipients, setExcipients] = useState<(Omit<FormulaIngredient, 'declaredContent' | 'elementalContent'> & { declaredContent: string | number; elementalContent?: string | number; materialId?: string })[]>([]);
  const [extraInfo, setExtraInfo] = useState({
    dosageForm: '',
    appearance: '',
    color: '',
    smellTaste: '',
    packaging: '',
    storage: '',
    shelfLife: '',
    standardRefs: ''
  });

  // Filter Data
  const filteredFormulas = useMemo(() => {
    return (productFormulas || []).filter(f => {
      const product = products.find(p => p.id === f.productId);
      const searchLower = searchTerm.toLowerCase();
      return (
        (product?.name || '').toLowerCase().includes(searchLower) ||
        (product?.code || '').toLowerCase().includes(searchLower)
      );
    });
  }, [productFormulas, products, searchTerm]);

  const totalPages = Math.ceil(filteredFormulas.length / itemsPerPage);
  const currentItems = filteredFormulas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handlers
  const handleOpenAdd = () => {
    setSelectedProductId('');
    setIngredients([{ id: generateId('ing'), name: '', declaredContent: '', elementalContent: '', unit: 'mg', materialId: '' }]);
    setExcipients([{ id: generateId('exc'), name: '', declaredContent: '', elementalContent: '', unit: 'mg', materialId: '' }]);
    setExtraInfo({
      dosageForm: '',
      appearance: '',
      color: '',
      smellTaste: '',
      packaging: '',
      storage: '',
      shelfLife: '',
      standardRefs: ''
    });
    crud.openAdd();
  };

  const handleOpenEdit = (formula: ProductFormula) => {
    setSelectedProductId(formula.productId);
    setIngredients(formula.ingredients || []);
    setExcipients(formula.excipients || []);
    setExtraInfo({
      dosageForm: formula.sensory?.dosageForm || '',
      appearance: formula.sensory?.appearance || '',
      color: formula.sensory?.color || '',
      smellTaste: formula.sensory?.smellTaste || '',
      packaging: formula.packaging || '',
      storage: formula.storage || '',
      shelfLife: formula.shelfLife || '',
      standardRefs: formula.standardRefs || ''
    });
    crud.openEdit(formula);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return notify({ type: 'WARNING', message: 'Vui lòng chọn sản phẩm!' });
    
    // Validate ingredients
    const validIngredients = ingredients.filter(i => i.name.trim() !== '');
    const validExcipients = excipients.filter(i => i.name.trim() !== '');
    const hasExtraInfo = Object.values(extraInfo).some(v => v && (v as string).trim() !== '');

    if (validIngredients.length === 0 && validExcipients.length === 0 && !hasExtraInfo) return notify({ type: 'WARNING', message: 'Vui lòng nhập ít nhất một thành phần hoặc thông tin đặc tính!' });

    setIsSubmitting(true);

    const finalIngredients: FormulaIngredient[] = validIngredients.map(ing => {
      // Giữ nguyên giá trị (text hoặc số) để AppContext tự xử lý bằng hàm parseNumberFromText
      return { ...ing, declaredContent: ing.declaredContent as unknown as number, elementalContent: ing.elementalContent as unknown as number, materialId: ing.materialId };
    });

    const finalExcipients: FormulaIngredient[] = validExcipients.map(exc => {
      return { ...exc, declaredContent: exc.declaredContent as unknown as number, elementalContent: exc.elementalContent as unknown as number, materialId: exc.materialId };
    });

    const formulaData: ProductFormula = {
      id: crud.selectedItem?.id || generateId('form'),
      productId: selectedProductId,
      ingredients: finalIngredients,
      excipients: finalExcipients,
      sensory: {
        dosageForm: extraInfo.dosageForm,
        appearance: extraInfo.appearance,
        color: extraInfo.color,
        smellTaste: extraInfo.smellTaste
      },
      ...extraInfo,
      createdAt: crud.selectedItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (crud.mode === 'EDIT') {
        await updateProductFormula(formulaData);
        notify({ type: 'SUCCESS', message: 'Đã cập nhật công thức.' });
      } else {
        // Check if product already has formula
        const exists = productFormulas?.some(f => f.productId === selectedProductId);
        if (exists) return notify({ type: 'ERROR', message: 'Sản phẩm này đã có công thức!' });

        await addProductFormula(formulaData);
        notify({ type: 'SUCCESS', message: 'Đã thêm công thức mới.' });
      }
      crud.close();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (crud.selectedItem) {
      await deleteProductFormula(crud.selectedItem.id);
      notify({ type: 'SUCCESS', message: 'Đã xóa công thức.' });
      crud.close();
    }
  };

  // Tối ưu 2: Dùng useCallback và Functional Updates (prev => ...)
  // Giúp các hàm không bị khởi tạo lại, bảo toàn cờ React.memo cho các dòng Table.
  const addIngredientRow = useCallback(() => {
    setIngredients(prev => [...prev, { id: generateId('ing'), name: '', declaredContent: '', elementalContent: '', unit: 'mg', materialId: '' }]);
  }, []);

  const removeIngredientRow = useCallback((index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateIngredient = useCallback((index: number, field: string, value: any) => {
    setIngredients(prev => {
      const newIngs = [...prev];
      let finalValue = value;
      if ((field === 'declaredContent' || field === 'elementalContent') && typeof value === 'string') {
        finalValue = autoFormatInput(value);
      }
      newIngs[index] = { ...newIngs[index], [field]: finalValue } as any;
      return newIngs;
    });
  }, []);

  const addExcipientRow = useCallback(() => {
    setExcipients(prev => [...prev, { id: generateId('exc'), name: '', declaredContent: '', elementalContent: '', unit: 'mg', materialId: '' }]);
  }, []);

  const removeExcipientRow = useCallback((index: number) => {
    setExcipients(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateExcipient = useCallback((index: number, field: string, value: any) => {
    setExcipients(prev => {
      const newExcs = [...prev];
      let finalValue = value;
      if ((field === 'declaredContent' || field === 'elementalContent') && typeof value === 'string') {
        finalValue = autoFormatInput(value);
      }
      newExcs[index] = { ...newExcs[index], [field]: finalValue } as any;
      return newExcs;
    });
  }, []);

  const handleExtraChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setExtraInfo(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleView = (formula: ProductFormula) => {
    setViewFormula(formula);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Công thức Sản phẩm" 
        subtitle="Quản lý hàm lượng công bố để tính toán kết quả kiểm nghiệm." 
        icon={FlaskConical}
        action={<AddButton onClick={handleOpenAdd} label="Thêm công thức" />}
      />

      <DSFilterBar>
        <DSSearchInput 
          placeholder="Tìm theo tên hoặc mã sản phẩm..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
        />
        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      {currentItems.length === 0 ? (
         <DSEmptyState icon={FileSearch} title="Không có Công thức" message="Chưa có dữ liệu Công thức sản phẩm nào khớp với tìm kiếm của bạn." />
      ) : (
        <>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentItems.map(formula => {
            const product = products.find(p => p.id === formula.productId);
            return (
              <DSCard key={formula.id} className="p-5 flex flex-col group h-full hover:shadow-lg transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <FlaskConical size={20} />
                  </div>
                  <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-lg">
                    {new Date(formula.updatedAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                
                <div className="flex-grow">
                  <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-2 min-h-[2.5em]">{product?.name || 'Sản phẩm đã xóa'}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{product?.code || '---'}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                    <Beaker size={14} className="text-rose-500"/>
                    <span className="font-bold">{formula.ingredients?.length || 0}</span> hoạt chất
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-1">
                    <Component size={14} className="text-slate-400"/>
                    <span className="font-bold">{formula.excipients?.length || 0}</span> phụ liệu
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ActionButtons onView={() => handleView(formula)} onEdit={() => handleOpenEdit(formula)} onDelete={() => crud.openDelete(formula)} />
                </div>
              </DSCard>
            );
          })}
        </div>
      ) : (
        <DSTable>
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <th className="px-4 py-3">Mã SP</th>
              <th className="px-4 py-3">Tên Sản phẩm</th>
              <th className="px-4 py-3 text-center">Thành phần</th>
              <th className="px-4 py-3">Cập nhật lần cuối</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {currentItems.map(formula => {
              const product = products.find(p => p.id === formula.productId);
              return (
                <tr key={formula.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-black text-slate-400 text-xs">{product?.code || '---'}</td>
                  <td className="px-4 py-3 font-bold text-slate-700 text-sm">{product?.name || 'Sản phẩm đã xóa'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg text-xs font-bold mr-1" title="Hoạt chất">
                      {formula.ingredients?.length || 0} HC
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs font-bold" title="Phụ liệu">
                      {formula.excipients?.length || 0} PL
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(formula.updatedAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionButtons 
                      onView={() => handleView(formula)}
                      onEdit={() => handleOpenEdit(formula)} 
                      onDelete={() => crud.openDelete(formula)} 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DSTable>
      )}
        </>
      )}
      
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* ADD / EDIT MODAL */}
      <Modal 
        isOpen={crud.mode === 'ADD' || crud.mode === 'EDIT'} 
        onClose={crud.close} 
        title={crud.mode === 'ADD' ? "Thêm Công thức Mới" : "Cập nhật Công thức"} 
        icon={FlaskConical}
      >
        <form onSubmit={handleSave} className="space-y-6">
          {/* Special Char Toolbar */}
          <SpecialCharToolbar className="-mx-2 px-2" />

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Sản phẩm áp dụng</label>
            <div className="relative">
              <select 
                value={selectedProductId} 
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={crud.mode === 'EDIT'}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm appearance-none disabled:opacity-60"
              >
                <option value="">-- Chọn sản phẩm --</option>
                {products
                  .filter(p => crud.mode === 'EDIT' || !productFormulas?.some(f => f.productId === p.id))
                  .map(p => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
            </div>
            {crud.mode === 'ADD' && (
              <p className="text-[10px] text-slate-400 italic pl-2">* Chỉ hiển thị các sản phẩm chưa có công thức.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest pl-2">Hoạt chất chính</label>
              <button type="button" onClick={addIngredientRow} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors flex items-center gap-1">
                <Plus size={12} /> Thêm dòng
              </button>
            </div>
            
            <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">Tên hoạt chất (Theo TCCS)</th>
                    <th className="px-3 py-2 w-40">Quy đổi Kho (Nhóm)</th>
                    <th className="px-3 py-2 w-24 text-right">H.lượng Hợp chất</th>
                    <th className="px-3 py-2 w-24 text-right">H.lượng Nguyên tố</th>
                    <th className="px-3 py-2 w-20 text-center">ĐVT</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ingredients.map((ing, idx) => (
                    <FormulaRow
                      key={ing.id || idx}
                      item={ing}
                      index={idx}
                      type="ingredient"
                      rawMaterials={rawMaterials}
                      onUpdate={updateIngredient}
                      onRemove={removeIngredientRow}
                    />
                  ))}
                  {ingredients.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-xs text-slate-400 italic">
                        Chưa có thành phần nào. Nhấn "Thêm dòng" để bắt đầu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 flex items-start gap-2">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              Lưu ý: Tên hoạt chất phải trùng khớp với tên chỉ tiêu trong TCCS để tính tỷ lệ %. Nếu chỉ tiêu tính theo Nguyên tố, hãy nhập hàm lượng vào cột "H.lượng Nguyên tố".
            </p>
          </div>

          {/* Excipients Table */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Phụ liệu / Tá dược</label>
              <button type="button" onClick={addExcipientRow} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 transition-colors flex items-center gap-1">
                <Plus size={12} /> Thêm dòng
              </button>
            </div>
            
            <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">Tên phụ liệu</th>
                    <th className="px-3 py-2 w-40">Quy đổi Kho (Nhóm)</th>
                    <th className="px-3 py-2 w-24 text-right">H.lượng Hợp chất</th>
                    <th className="px-3 py-2 w-24 text-right">H.lượng Nguyên tố</th>
                    <th className="px-3 py-2 w-20 text-center">ĐVT</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {excipients.map((exc, idx) => (
                    <FormulaRow
                      key={exc.id || idx}
                      item={exc}
                      index={idx}
                      type="excipient"
                      rawMaterials={rawMaterials}
                      onUpdate={updateExcipient}
                      onRemove={removeExcipientRow}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Đặc tính & Bảo quản */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest"><Eye size={14}/> Đặc tính Cảm quan & Bao bì</div>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Dạng bào chế" name="dosageForm" value={extraInfo.dosageForm} onChange={handleExtraChange} className="px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" />
                <input placeholder="Quy cách đóng gói" name="packaging" value={extraInfo.packaging} onChange={handleExtraChange} className="px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" />
                <input placeholder="Màu sắc" name="color" value={extraInfo.color} onChange={handleExtraChange} className="px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" />
                <input placeholder="Mùi vị" name="smellTaste" value={extraInfo.smellTaste} onChange={handleExtraChange} className="px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" />
              </div>
              <textarea placeholder="Mô tả ngoại quan chi tiết..." name="appearance" value={extraInfo.appearance} onChange={handleExtraChange} rows={2} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-orange-600 font-black text-[10px] uppercase tracking-widest"><Thermometer size={14}/> Bảo quản & Tài liệu tham chiếu</div>
              <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Hạn dùng (VD: 36 tháng)" name="shelfLife" value={extraInfo.shelfLife} onChange={handleExtraChange} className="px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" />
                  <input placeholder="Điều kiện bảo quản (VD: Nơi khô, <30°C)" name="storage" value={extraInfo.storage} onChange={handleExtraChange} className="px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" />
              </div>
              <div className="relative">
                  <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input placeholder="Căn cứ kỹ thuật / Phương pháp thử (VD: DĐVN V, TCVN...)" name="standardRefs" value={extraInfo.standardRefs} onChange={handleExtraChange} className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={crud.close} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-[#009639] text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50">
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSubmitting ? 'Đang lưu...' : 'Lưu công thức'}
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW MODAL */}
      <Modal 
        isOpen={!!viewFormula} 
        onClose={() => setViewFormula(null)} 
        title="Chi tiết Công thức" 
        icon={Eye}
        color="bg-blue-600"
      >
        {viewFormula && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
             {/* Product Info */}
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                <div className="p-3 bg-white rounded-lg text-indigo-600 shadow-sm"><Package size={24}/></div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 uppercase">{products.find(p => p.id === viewFormula.productId)?.name}</h4>
                  <p className="text-xs text-slate-500 font-bold">{products.find(p => p.id === viewFormula.productId)?.code}</p>
                </div>
             </div>

             {/* Ingredients */}
             <div>
               <h5 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-2 flex items-center gap-2"><FlaskConical size={14}/> Hoạt chất chính</h5>
               <div className="border border-slate-100 rounded-xl overflow-hidden">
                 <table className="w-full text-sm">
                   <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                     <tr>
                       <th className="px-4 py-2 text-left">Hoạt chất</th>
                       <th className="px-4 py-2 text-left">Nguyên liệu gốc</th>
                       <th className="px-4 py-2 text-right">H.lượng Hợp chất</th>
                       <th className="px-4 py-2 text-right">H.lượng Nguyên tố</th>
                       <th className="px-4 py-2 text-center">ĐVT</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                  {(viewFormula.ingredients || []).map((ing, idx) => (
                       <tr key={idx}>
                         <td className="px-4 py-2 font-medium text-slate-700">{ing.name}</td>
                         <td className="px-4 py-2 text-xs text-slate-500 italic">
                           {rawMaterials.find(m => m.id === ing.materialId)?.name || '-'}
                         </td>
                         <td className="px-4 py-2 text-right font-mono font-bold text-rose-600">
                           {formatScientific(ing.declaredContent)}
                         </td>
                         <td className="px-4 py-2 text-right font-mono font-bold text-blue-600">
                           {ing.elementalContent ? formatScientific(ing.elementalContent) : '-'}
                         </td>
                         <td className="px-4 py-2 text-center text-slate-500 text-xs">{ing.unit}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>

             {/* Excipients */}
             <div>
               <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Component size={14}/> Phụ liệu / Tá dược</h5>
               <div className="border border-slate-100 rounded-xl overflow-hidden">
                 <table className="w-full text-sm">
                   <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                     <tr>
                       <th className="px-4 py-2 text-left">Tên phụ liệu</th>
                       <th className="px-4 py-2 text-left">Nguyên liệu gốc</th>
                       <th className="px-4 py-2 text-right">H.lượng Hợp chất</th>
                       <th className="px-4 py-2 text-right">H.lượng Nguyên tố</th>
                       <th className="px-4 py-2 text-center">ĐVT</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {(viewFormula.excipients || []).length > 0 ? (viewFormula.excipients || []).map((exc, idx) => (
                       <tr key={idx}>
                         <td className="px-4 py-2 font-medium text-slate-600">{exc.name}</td>
                         <td className="px-4 py-2 text-xs text-slate-500 italic">
                           {rawMaterials.find(m => m.id === exc.materialId)?.name || '-'}
                         </td>
                         <td className="px-4 py-2 text-right font-mono font-bold text-slate-600">{formatScientific(exc.declaredContent)}</td>
                         <td className="px-4 py-2 text-right font-mono font-bold text-blue-600">
                           {exc.elementalContent ? formatScientific(exc.elementalContent) : '-'}
                         </td>
                         <td className="px-4 py-2 text-center text-slate-400 text-xs">{exc.unit}</td>
                       </tr>
                     )) : (
                       <tr><td colSpan={5} className="px-4 py-2 text-center text-xs text-slate-400 italic">Không có phụ liệu</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>

             {/* Extra Info */}
             <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-1"><p className="text-[10px] font-bold text-slate-400 uppercase">Dạng bào chế</p><p className="text-xs font-bold text-slate-700">{viewFormula.sensory?.dosageForm || '---'}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-bold text-slate-400 uppercase">Quy cách</p><p className="text-xs font-bold text-slate-700">{viewFormula.packaging || '---'}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-bold text-slate-400 uppercase">Màu sắc</p><p className="text-xs font-bold text-slate-700">{viewFormula.sensory?.color || '---'}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-bold text-slate-400 uppercase">Mùi vị</p><p className="text-xs font-bold text-slate-700">{viewFormula.sensory?.smellTaste || '---'}</p></div>
                <div className="space-y-1 col-span-2 pt-2 border-t border-slate-200/50"><p className="text-[10px] font-bold text-slate-400 uppercase">Cảm quan</p><p className="text-xs font-medium italic text-slate-600">"{viewFormula.sensory?.appearance || '---'}"</p></div>
                <div className="space-y-1"><p className="text-[10px] font-bold text-slate-400 uppercase">Hạn dùng</p><p className="text-xs font-bold text-slate-700">{viewFormula.shelfLife || '---'}</p></div>
                <div className="space-y-1"><p className="text-[10px] font-bold text-slate-400 uppercase">Bảo quản</p><p className="text-xs font-bold text-slate-700">{viewFormula.storage || '---'}</p></div>
             </div>
             
             <div className="flex justify-end pt-2">
                <button onClick={() => setViewFormula(null)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase transition-colors">Đóng</button>
             </div>
          </div>
        )}
      </Modal>

      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleDelete} 
        itemName={crud.selectedItem ? products.find(p => p.id === crud.selectedItem?.productId)?.name : ''}
        warningMessage="Việc xóa công thức sẽ làm mất khả năng tính toán tỷ lệ % trên các phiếu kiểm nghiệm cũ và mới."
      />
    </div>
  );
};

export default ProductFormulaList;
