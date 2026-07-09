import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { FlaskConical, Search, Filter, Layers, Beaker, Component, Package, LayoutGrid, List, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { ProductFormula, FormulaIngredient } from '../../types';
import { PageHeader, DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable, ActionButtons } from '../../components';
import { useCrud } from '../../hooks';
import { useUIStore } from '../../store/useUIStore';

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

const MaterialGridItem = ({ mat, onEdit, isAdmin }: any) => (
  <DSCard className="p-5 flex flex-col gap-5 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.08)] transition-all duration-500 group relative overflow-hidden h-full bg-gradient-to-br from-amber-50/80 via-white to-orange-50/80 dark:from-amber-950/20 dark:via-slate-800 dark:to-orange-950/20 dark:border-slate-700/50">
    {/* Decorative Blob */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/10 to-orange-400/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>

    {/* Header: Eyebrow and Status */}
    <div className="flex items-start justify-between gap-2 relative z-10">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        <Layers size={14} className={mat.type === 'ACTIVE' ? 'text-amber-500' : 'text-slate-400'} />
        <span>Nguyên liệu</span>
      </div>
      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${mat.type === 'ACTIVE' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
        {mat.type === 'ACTIVE' ? 'Hoạt chất' : 'Phụ liệu'}
      </span>
    </div>

    {/* Glass Box Highlighting Main Content */}
    <div className="bg-gradient-to-br from-white/60 to-white/30 dark:from-slate-900/60 dark:to-slate-900/30 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-[0_4px_20px_-5px_rgba(245,158,11,0.1)] dark:shadow-[0_4px_20px_-5px_rgba(245,158,11,0.05)] rounded-2xl p-4 flex flex-col gap-4 relative z-10 mt-2 flex-grow">
      {/* Main Info */}
      <div className="flex items-center gap-4">
        <div className={`p-3.5 rounded-xl shrink-0 border shadow-inner ${mat.type === 'ACTIVE' ? 'bg-amber-50/80 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30' : 'bg-slate-50/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700'}`}>
          {mat.type === 'ACTIVE' ? <Beaker size={24}/> : <Component size={24}/>}
        </div>
        <div className="flex flex-col">
          <h3 className={`font-black text-slate-800 dark:text-slate-200 text-base leading-tight group-hover:${mat.type === 'ACTIVE' ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'} transition-colors line-clamp-2`}>{mat.name}</h3>
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Sử dụng trong {mat.relatedProducts.length} SP</p>
        </div>
      </div>

      {/* Meta / Tags */}
      <div className="space-y-2 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 mt-auto">
        <div className="flex flex-wrap gap-1.5">
          {mat.relatedProducts.slice(0, 3).map((p: any, idx: number) => (
            <div key={idx} className="bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-full shadow-sm" title={p.name}>
              {p.name} {mat.type === 'ACTIVE' && p.content ? `(${p.content})` : ''}
            </div>
          ))}
          {mat.relatedProducts.length > 3 && <span className="bg-slate-100/60 dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] text-slate-500 dark:text-slate-400 font-bold border border-slate-200/50 dark:border-slate-700">+{mat.relatedProducts.length - 3}</span>}
        </div>
      </div>
    </div>

    {/* Footer: Actions */}
    <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-100 dark:border-slate-700 relative z-10">
      {isAdmin && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <ActionButtons onEdit={() => onEdit(mat)} />
        </div>
      )}
      {isAdmin ? (
        <button onClick={() => onEdit(mat)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-700 dark:hover:text-rose-400 transition-all ml-auto border border-slate-200/50 dark:border-slate-700">
          Chi tiết <Edit2 size={14} className="opacity-0 group-hover:opacity-100 hidden" />
        </button>
      ) : (
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold ml-auto bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700">Xem từ Công thức</span>
      )}
    </div>
  </DSCard>
);

const MaterialListItem = ({ mat, onEdit, isAdmin }: any) => (
  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200 text-sm">{mat.name}</td>
    <td className="px-4 py-3">
      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${mat.type === 'ACTIVE' ? 'bg-rose-100 dark:bg-rose-955/40 text-rose-700 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
        {mat.type === 'ACTIVE' ? 'Hoạt chất' : 'Phụ liệu'}
      </span>
    </td>
    <td className="px-4 py-3">
      <div className="flex flex-wrap gap-1">
        {mat.relatedProducts.map((p: any, idx: number) => <span key={idx} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 dark:text-slate-400">{p.name}</span>)}
      </div>
    </td>
    <td className="px-4 py-3 text-right">
      {isAdmin && (
        <div className="flex justify-end items-center gap-2"><ActionButtons onEdit={() => onEdit(mat)} /></div>
      )}
    </td>
  </tr>
);

const MaterialDataList = ({ viewMode, data, onEdit, isAdmin }: any) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.map((mat: any) => (
          <MaterialGridItem key={mat.id} mat={mat} onEdit={onEdit} isAdmin={isAdmin} />
        ))}
      </div>
    );
  }
  return (
    <DSTable>
      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
        <tr className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Tên nguyên liệu</th><th className="px-4 py-3">Phân loại</th><th className="px-4 py-3">Sản phẩm sử dụng</th><th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
        {data.map((mat: any) => (
          <MaterialListItem key={mat.id} mat={mat} onEdit={onEdit} isAdmin={isAdmin} />
        ))}
      </tbody>
    </DSTable>
  );
};

const MaterialList: React.FC = () => {
  const products = useAppStore(state => state.products);
  const productFormulas = useAppStore(state => state.productFormulas);
  const updateProductFormula = useAppStore(state => state.updateProductFormula);
  const notify = useAppStore(state => state.notify);
  const isAdmin = useAppStore(state => state.isAdmin);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE' | 'EXCIPIENT'>('ALL');
  const [filterProductId, setFilterProductId] = useState<string>('');
  const viewMode = useUIStore(s => s.materialViewMode);
  const setViewMode = useUIStore(s => s.setMaterialViewMode);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 15;  
  const navigate = useNavigate();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterProductId, viewMode]);
  
  // Logic phân tích dữ liệu từ TCCS
  const materials = useMemo(() => {
    const map = new Map<string, AggregatedMaterial>();
    const productMap = new Map(products.map(p => [p.id, p]));
    
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
  }, [productFormulas, products]);

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
    // Chuyển hướng sang trang form mới, truyền tên nguyên liệu qua URL param để xử lý
    navigate(`/materials/edit/${encodeURIComponent(mat.name)}`);
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
             {products.map(p => (
               <option key={p.id} value={p.id}>{p.name}</option>
             ))}
        </DSSelect>

        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      <MaterialDataList 
        viewMode={viewMode}
        data={paginatedMaterials}
        onEdit={handleEditClick}
        isAdmin={isAdmin}
      />

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 transition-all"
            >
                <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                Trang {currentPage} / {totalPages}
            </span>
            <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed dark:text-slate-300 transition-all"
            >
                <ChevronRight size={20} />
            </button>
        </div>
      )}
    </div>
  );
};

export default MaterialList;