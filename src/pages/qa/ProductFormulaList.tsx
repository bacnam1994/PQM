import React, { useState, useMemo, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FlaskConical, Plus, Search, Beaker, Eye, Loader2, LayoutGrid, List, Package, Component, FileSearch, FileText, Layers, TrendingUp, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ProductFormula, FormulaIngredient } from '../../types';
import { PageHeader, Modal, Pagination, DSFilterBar, DSSearchInput, DSTable, DSViewToggle, DSCard, AddButton, ActionButtons, DeleteModal, DSEmptyState } from '../../components';
import { useCrud, useDebounce, useDataGraph } from '../../hooks';
import { useUIStore } from '../../store/useUIStore';
import { parseNumberFromText, normalizeSearch, formatDateStandard, getActiveLocale } from '../../utils';

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
  const locale = getActiveLocale();
  return `${prefix.trim()}${prefix ? ' ' : ''}${num.toLocaleString(locale, { maximumFractionDigits: 10 })}`;
};

const ProductFormulaList: React.FC = () => {
  const products = useAppStore(state => state.products);
  const productFormulas = useAppStore(state => state.productFormulas);
  const rawMaterials = useAppStore(state => state.rawMaterials);
  const deleteProductFormula = useAppStore(state => state.deleteProductFormula);
  const notify = useAppStore(state => state.notify);
  const isAdmin = useAppStore(state => state.isAdmin);
  const navigate = useNavigate();
  const { tccsList: hydratedTccs, batches: hydratedBatches, products: hydratedProducts } = useDataGraph();

  // Map HydratedProduct (có activeTCCS, batchesCount, passRate) để hiển thị badge
  const hydratedProductMap = useMemo(() => new Map(hydratedProducts.map(p => [p.id, p])), [hydratedProducts]);
  // Map HydratedTCCS theo productId (lấy TCCS active)
  const activeTccsMap = useMemo(() => {
    const m = new Map<string, typeof hydratedTccs[0]>();
    hydratedTccs.forEach(t => {
      if (t.isActive || !m.has(t.productId)) m.set(t.productId, t);
    });
    return m;
  }, [hydratedTccs]);

  const crud = useCrud<ProductFormula>();
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const viewMode = useUIStore(s => s.formulaViewMode);
  const setViewMode = useUIStore(s => s.setFormulaViewMode);
  const [viewFormula, setViewFormula] = useState<ProductFormula | null>(null);

  // TỐI ƯU 1: Tạo Map để lookup Sản phẩm O(1) thay vì O(N)
  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Filter Data
  const filteredFormulas = useMemo(() => {
    const searchNormalized = normalizeSearch(debouncedSearchTerm);
    return (productFormulas || []).filter(f => {
      const product = productMap.get(f.productId);
      return (
        !searchNormalized ||
        normalizeSearch(product?.name).includes(searchNormalized) ||
        normalizeSearch(product?.code).includes(searchNormalized)
      );
    });
  }, [productFormulas, productMap, debouncedSearchTerm]);

  // Reset page khi gõ tìm kiếm
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const totalPages = Math.ceil(filteredFormulas.length / itemsPerPage);
  const currentItems = filteredFormulas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Handlers
  const handleOpenEdit = (formula: ProductFormula) => {
    navigate(`/product-formulas/edit/${formula.id}`);
  };

  const handleDelete = async () => {
    if (crud.selectedItem) {
      await deleteProductFormula(crud.selectedItem.id);
      notify({ type: 'SUCCESS', message: 'Đã xóa công thức.' });
      crud.close();
    }
  };

  const handleView = (formula: ProductFormula) => {
    setViewFormula(formula);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Công thức Sản phẩm" 
        subtitle="Quản lý hàm lượng công bố để tính toán kết quả kiểm nghiệm." 
        icon={FlaskConical}
        action={isAdmin ? <AddButton onClick={() => navigate('/product-formulas/new')} label="Thêm công thức" /> : undefined}
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
            const product = productMap.get(formula.productId);
            return (
              <DSCard key={formula.id} className="p-5 flex flex-col gap-5 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(244,63,94,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(244,63,94,0.08)] transition-all duration-500 group relative overflow-hidden h-full bg-gradient-to-br from-rose-50/80 via-white to-pink-50/80 dark:from-rose-950/20 dark:via-slate-800 dark:to-pink-950/20 dark:border-slate-700/50">
                {/* Decorative Blob */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-400/10 to-pink-400/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>

                {/* Header: Eyebrow text and Date */}
                <div className="flex items-start justify-between gap-2 relative z-10">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    <Package size={14} className="text-rose-400" />
                    <span className="truncate max-w-[150px]">{product?.group || 'Sản phẩm'}</span>
                  </div>
                  <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-widest">
                    {formatDateStandard(formula.updatedAt)}
                  </span>
                </div>

                {/* Glass Box Highlighting Main Content */}
                <div className="bg-gradient-to-br from-white/60 to-white/30 dark:from-slate-900/60 dark:to-slate-900/30 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-[0_4px_20px_-5px_rgba(244,63,94,0.1)] dark:shadow-[0_4px_20px_-5px_rgba(244,63,94,0.05)] rounded-2xl p-4 flex flex-col gap-4 relative z-10 mt-2 flex-grow">
                  {/* Main Info: Name and Icon - clickable link to product */}
                  <div className="flex items-center gap-4">
                    <div className="bg-rose-50/80 dark:bg-rose-950/50 p-3.5 rounded-xl text-rose-600 dark:text-rose-400 shrink-0 border border-rose-100/50 dark:border-rose-900/30 shadow-inner">
                      <FlaskConical size={24} />
                    </div>
                    <Link to={`/products/${formula.productId}`} className="flex flex-col group/link">
                      <h3 className="font-black text-slate-800 dark:text-slate-200 text-base leading-tight group-hover/link:text-rose-600 dark:group-hover/link:text-rose-400 transition-colors line-clamp-2">{product?.name || 'Sản phẩm đã xóa'}</h3>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{product?.code || '---'}</p>
                    </Link>
                  </div>

                  {/* Meta Info: Ingredients & Excipients */}
                  <div className="space-y-2 mt-auto pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                      <div className="flex items-center gap-2"><Beaker size={14} className="text-rose-500"/> Hoạt chất</div>
                      <span className="font-black text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow-sm border border-slate-100 dark:border-slate-700">{formula.ingredients?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                      <div className="flex items-center gap-2"><Component size={14} className="text-slate-400 dark:text-slate-500"/> Phụ liệu</div>
                      <span className="font-black text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow-sm border border-slate-100 dark:border-slate-700">{formula.excipients?.length || 0}</span>
                    </div>
                  </div>

                  {/* --- BADGES LIÊN KẾT: TCCS, SỐ LÔ, TỶ LỆ ĐẠT --- */}
                  {(() => {
                    const hProd = hydratedProductMap.get(formula.productId);
                    const activeTccs = activeTccsMap.get(formula.productId);
                    if (!hProd && !activeTccs) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100/60 dark:border-slate-700/40">
                        {/* Badge: TCCS active */}
                        {activeTccs && (
                          <Link
                            to={`/tccs/detail/${activeTccs.id}`}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-black border border-blue-100 dark:border-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            <FileText size={10} /> {activeTccs.code}
                          </Link>
                        )}
                        {/* Badge: Số lô */}
                        {hProd && hProd.batchesCount > 0 && (
                          <Link
                            to={`/batches?productId=${formula.productId}`}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black border border-indigo-100 dark:border-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                          >
                            <Layers size={10} /> {hProd.batchesCount} lô
                          </Link>
                        )}
                        {/* Badge: Tỷ lệ đạt */}
                        {hProd && hProd.testResultsCount > 0 && (
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border ${
                            hProd.passRate >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40'
                            : hProd.passRate >= 50 ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/40'
                            : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/40'
                          }`}>
                            <TrendingUp size={10} /> {hProd.passRate}%
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Footer: Actions */}
                <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-200/50 dark:border-slate-700/50 relative z-10">
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <ActionButtons onEdit={() => handleOpenEdit(formula)} onDelete={() => crud.openDelete(formula)} />
                    </div>
                  )}
                  <button onClick={() => handleView(formula)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] bg-slate-50/80 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-700 dark:hover:text-rose-400 transition-all ml-auto border border-slate-200/50 dark:border-slate-700">
                    Xem công thức <Eye size={14} className="opacity-0 group-hover:opacity-100 hidden" />
                  </button>
                </div>
              </DSCard>
            );
          })}
        </div>
      ) : (
        <DSTable>
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
            <tr className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <th className="px-4 py-3">Mã SP</th>
              <th className="px-4 py-3">Tên Sản phẩm</th>
              <th className="px-4 py-3 text-center">Thành phần</th>
              <th className="px-4 py-3">Cập nhật lần cuối</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
            {currentItems.map(formula => {
              const product = productMap.get(formula.productId);
              return (
                <tr key={formula.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-black text-slate-400 dark:text-slate-500 text-xs">{product?.code || '---'}</td>
                  <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 text-sm">{product?.name || 'Sản phẩm đã xóa'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-lg text-xs font-bold mr-1" title="Hoạt chất">
                      {formula.ingredients?.length || 0} HC
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-lg text-xs font-bold" title="Phụ liệu">
                      {formula.excipients?.length || 0} PL
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {formatDateStandard(formula.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionButtons 
                      onView={() => handleView(formula)}
                      onEdit={isAdmin ? () => handleOpenEdit(formula) : undefined} 
                      onDelete={isAdmin ? () => crud.openDelete(formula) : undefined} 
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
