import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { PageHeader, Modal } from '../components/CommonUI';
import { FlaskConical, Search, Filter, Layers, Beaker, Component, Package, LayoutGrid, List, ChevronLeft, ChevronRight, Edit2, Info, Loader2 } from 'lucide-react';
import { ProductFormula, FormulaIngredient } from '../types';
import { DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable, DSFormInput } from '../components/DesignSystem';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCrud } from '../hooks/useCrud';
import { ActionButtons } from '../components/CrudControls';

interface AggregatedMaterial {
  id: string;
  name: string;
  type: 'ACTIVE' | 'EXCIPIENT';
  relatedProducts: {
    id: string;
    name: string;
    content?: string;
  }[];
}

const MaterialGridItem = ({ mat, onEdit }: any) => (
  <DSCard className="p-5 flex flex-col group">
    <div className="flex justify-between items-start mb-3">
      <div className={`p-2 rounded-xl ${mat.type === 'ACTIVE' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
        {mat.type === 'ACTIVE' ? <Beaker size={20}/> : <Component size={20}/>}
      </div>
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${mat.type === 'ACTIVE' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
        {mat.type === 'ACTIVE' ? 'Hoạt chất' : 'Phụ liệu'}
      </span>
    </div>
    <div className="flex-grow">
      <h3 className="font-black text-slate-800 text-sm mb-4 line-clamp-2 min-h-[2.5em]">{mat.name}</h3>
    </div>
    <div className="space-y-2 border-t border-slate-100 pt-3 mt-auto">
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Layers size={12}/> Sử dụng trong ({mat.relatedProducts.length})</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"><ActionButtons onEdit={() => onEdit(mat)} /></div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {mat.relatedProducts.slice(0, 3).map((p: any, idx: number) => (
          <div key={idx} className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[10px] text-slate-600 font-medium truncate max-w-full" title={p.name}>
            {p.name} {mat.type === 'ACTIVE' && p.content ? `(${p.content})` : ''}
          </div>
        ))}
        {mat.relatedProducts.length > 3 && <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[10px] text-slate-400 font-bold">+{mat.relatedProducts.length - 3}</span>}
      </div>
    </div>
  </DSCard>
);

const MaterialListItem = ({ mat, onEdit }: any) => (
  <tr className="hover:bg-slate-50 transition-colors group">
    <td className="px-4 py-3 font-bold text-slate-800 text-sm">{mat.name}</td>
    <td className="px-4 py-3">
      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${mat.type === 'ACTIVE' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
        {mat.type === 'ACTIVE' ? 'Hoạt chất' : 'Phụ liệu'}
      </span>
    </td>
    <td className="px-4 py-3">
      <div className="flex flex-wrap gap-1">
        {mat.relatedProducts.map((p: any, idx: number) => <span key={idx} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-medium text-slate-600">{p.name}</span>)}
      </div>
    </td>
    <td className="px-4 py-3 text-right">
      <div className="flex justify-end items-center gap-2"><ActionButtons onEdit={() => onEdit(mat)} /></div>
    </td>
  </tr>
);

const MaterialDataList = ({ viewMode, data, onEdit }: any) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.map((mat: any) => (
          <MaterialGridItem key={mat.id} mat={mat} onEdit={onEdit} />
        ))}
      </div>
    );
  }
  return (
    <DSTable>
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Tên nguyên liệu</th><th className="px-4 py-3">Phân loại</th><th className="px-4 py-3">Sản phẩm sử dụng</th><th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {data.map((mat: any) => (
          <MaterialListItem key={mat.id} mat={mat} onEdit={onEdit} />
        ))}
      </tbody>
    </DSTable>
  );
};

const MaterialList: React.FC = () => {
  const { state, updateProductFormula, notify } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE' | 'EXCIPIENT'>('ALL');
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('material_view_mode', 'grid');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;
  const crud = useCrud<AggregatedMaterial>();
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterProductId, viewMode]);
  
  // Logic phân tích dữ liệu từ TCCS
  const materials = useMemo(() => {
    const map = new Map<string, AggregatedMaterial>();
    
    state.productFormulas.forEach(formula => {
        const product = state.products.find(p => p.id === formula.productId);
        if (!product) return;

        (formula.ingredients || []).forEach(ing => {
            if (!ing || !ing.name) return;
            const key = `ACTIVE_${ing.name.trim().toLowerCase()}`;
            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    name: ing.name.trim(),
                    type: 'ACTIVE',
                    relatedProducts: []
                });
            }
            const material = map.get(key)!;
            if (!material.relatedProducts.some(p => p.id === product.id)) {
                material.relatedProducts.push({
                    id: product.id,
                    name: product.name,
                    content: `${ing.declaredContent} ${ing.unit}`
                });
            }
        });

        // Xử lý Phụ liệu
        (formula.excipients || []).forEach(exc => {
            if (!exc || !exc.name) return;
            const key = `EXCIPIENT_${exc.name.trim().toLowerCase()}`;
            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    name: exc.name.trim(),
                    type: 'EXCIPIENT',
                    relatedProducts: []
                });
            }
            const material = map.get(key)!;
            if (!material.relatedProducts.some(p => p.id === product.id)) {
                material.relatedProducts.push({
                    id: product.id,
                    name: product.name,
                    content: `${exc.declaredContent} ${exc.unit}`
                });
            }
        });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.productFormulas, state.products]);

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'ALL' || m.type === filterType;
      const matchesProduct = filterProductId ? m.relatedProducts.some(p => p.id === filterProductId) : true;
      return matchesSearch && matchesType && matchesProduct;
    });
  }, [materials, searchTerm, filterType, filterProductId]);

  const paginatedMaterials = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMaterials.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMaterials, currentPage, ITEMS_PER_PAGE]);

  const totalPages = Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE);

  const handleEditClick = (mat: AggregatedMaterial) => {
    crud.openEdit(mat);
    setNewName(mat.name);
  };

  const handleSaveChanges = async () => {
    if (!crud.selectedItem || !newName.trim()) return;
    const oldName = crud.selectedItem.name;
    const newNameTrimmed = newName.trim();

    if (oldName === newNameTrimmed) {
        crud.close();
        return;
    }
    
    setIsSubmitting(true);
    try {
      const updates = state.productFormulas.map(formula => {
          let needsUpdate = false;
          const newIngredients = formula.ingredients.map(ing => {
              if (ing.name === oldName) {
                  needsUpdate = true;
                  return { ...ing, name: newNameTrimmed };
              }
              return ing;
          });
          
          const newExcipients = (formula.excipients || []).map(exc => {
              if (exc.name === oldName) {
                  needsUpdate = true;
                  return { ...exc, name: newNameTrimmed };
              }
              return exc;
          });

          if (needsUpdate) {
              return updateProductFormula({ ...formula, ingredients: newIngredients, excipients: newExcipients, updatedAt: new Date().toISOString() });
          }
          return Promise.resolve();
      });
      
      await Promise.all(updates);
      crud.close();
      notify({ type: 'SUCCESS', message: `Đã đổi tên nguyên liệu thành "${newNameTrimmed}"` });
    } catch (error) {
      console.error("Failed to update materials:", error);
      notify({ type: 'ERROR', message: 'Cập nhật thất bại.' });
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Danh mục Thành phần" 
        subtitle="Tổng hợp từ các công thức sản phẩm đã được thiết lập." 
        icon={FlaskConical}
      />

      <DSFilterBar>
        <DSSearchInput placeholder="Tìm kiếm hoạt chất, phụ liệu..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        
        <DSSelect icon={Filter} value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="w-32">
             <option value="ALL">Tất cả loại</option>
             <option value="ACTIVE">Hoạt chất</option>
             <option value="EXCIPIENT">Phụ liệu</option>
        </DSSelect>

        <DSSelect icon={Package} value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)} className="w-48 truncate">
             <option value="">Tất cả sản phẩm</option>
             {state.products.map(p => (
               <option key={p.id} value={p.id}>{p.name}</option>
             ))}
        </DSSelect>

        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      <MaterialDataList 
        viewMode={viewMode}
        data={paginatedMaterials}
        onEdit={handleEditClick}
      />

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

      <Modal 
        isOpen={crud.mode === 'EDIT'} 
        onClose={crud.close}
        title={`Đổi tên: ${crud.selectedItem?.name}`}
        icon={Edit2}
      >
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Hành động này sẽ tìm và thay thế tên nguyên liệu <strong>"{crud.selectedItem?.name}"</strong> trong tất cả các công thức sản phẩm liên quan.
            </p>
          </div>
          <DSFormInput
            label="Tên mới"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nhập tên nguyên liệu mới..."
          />
        </div>
        <div className="pt-4 mt-4 border-t flex justify-end gap-3">
          <button type="button" onClick={crud.close} className="px-6 py-2.5 text-slate-500 font-bold uppercase text-xs">Hủy</button>
          <button 
            type="button" 
            onClick={handleSaveChanges} 
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold uppercase text-xs shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Lưu thay đổi'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default MaterialList;