import React, { useState, useMemo, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BeakerIcon, 
  EyeIcon, 
  ArrowPathIcon, 
  Squares2X2Icon, 
  ListBulletIcon, 
  CubeIcon, 
  CpuChipIcon, 
  MagnifyingGlassIcon, 
  DocumentTextIcon, 
  Square3Stack3DIcon, 
  ArrowTrendingUpIcon, 
  ArrowRightIcon 
} from '@heroicons/react/24/outline';
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

  const hydratedProductMap = useMemo(() => new Map(hydratedProducts.map(p => [p.id, p])), [hydratedProducts]);
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

  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

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

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const totalPages = Math.ceil(filteredFormulas.length / itemsPerPage);
  const currentItems = filteredFormulas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
    <div className="space-y-6">
      <PageHeader 
        title="Công thức Sản phẩm" 
        subtitle="Quản lý hàm lượng công bố để tính toán kết quả kiểm nghiệm." 
        icon={BeakerIcon}
        action={isAdmin ? <AddButton onClick={() => navigate('/product-formulas/new')} label="Thêm công thức" /> : undefined}
      />

      <DSFilterBar>
        <DSSearchInput 
          placeholder="Tìm theo tên hoặc mã sản phẩm..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
        />
        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={Squares2X2Icon} listIcon={ListBulletIcon} />
      </DSFilterBar>

      {currentItems.length === 0 ? (
         <DSEmptyState icon={MagnifyingGlassIcon} title="Không có Công thức" message="Chưa có dữ liệu Công thức sản phẩm nào khớp với tìm kiếm của bạn." />
      ) : (
        <>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentItems.map(formula => {
            const product = productMap.get(formula.productId);
            return (
              <DSCard key={formula.id} className="p-5 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group relative overflow-hidden h-full bg-surface border border-border">
                {/* Header: Group and Date */}
                <div className="flex items-start justify-between gap-2 relative z-10">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                    <CubeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[150px]">{product?.group || 'Sản phẩm'}</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink-muted border border-border">
                    {formatDateStandard(formula.updatedAt)}
                  </span>
                </div>

                {/* Main Content Box */}
                <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-3 relative z-10 flex-grow">
                  {/* Main Info */}
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                      <BeakerIcon className="w-6 h-6" />
                    </div>
                    <Link to={`/products/${formula.productId}`} className="flex flex-col min-w-0 group/link">
                      <h3 className="font-semibold text-ink text-base leading-tight group-hover/link:text-emerald-600 dark:group-hover/link:text-emerald-400 transition-colors line-clamp-2">{product?.name || 'Sản phẩm đã xóa'}</h3>
                      <p className="text-xs text-ink-muted mt-1">{product?.code || '---'}</p>
                    </Link>
                  </div>

                  {/* Meta Info: Ingredients & Excipients */}
                  <div className="space-y-1.5 mt-auto pt-2.5 border-t border-border text-xs">
                    <div className="flex items-center justify-between text-ink-soft bg-surface p-2 rounded-lg border border-border">
                      <div className="flex items-center gap-1.5 font-medium"><BeakerIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"/> Hoạt chất</div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formula.ingredients?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-ink-soft bg-surface p-2 rounded-lg border border-border">
                      <div className="flex items-center gap-1.5 font-medium"><CpuChipIcon className="w-3.5 h-3.5 text-ink-muted"/> Phụ liệu</div>
                      <span className="font-semibold text-ink">{formula.excipients?.length || 0}</span>
                    </div>
                  </div>

                  {/* Badges */}
                  {(() => {
                    const hProd = hydratedProductMap.get(formula.productId);
                    const activeTccs = activeTccsMap.get(formula.productId);
                    if (!hProd && !activeTccs) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                        {activeTccs && (
                          <Link
                            to={`/tccs/detail/${activeTccs.id}`}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface text-ink-soft border border-border hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                          >
                            <DocumentTextIcon className="w-3 h-3" /> {activeTccs.code}
                          </Link>
                        )}
                        {hProd && hProd.batchesCount > 0 && (
                          <Link
                            to={`/batches?productId=${formula.productId}`}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface text-ink-soft border border-border hover:border-sky-300 hover:text-sky-600 transition-colors"
                          >
                            <Square3Stack3DIcon className="w-3 h-3" /> {hProd.batchesCount} lô
                          </Link>
                        )}
                        {hProd && hProd.testResultsCount > 0 && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
                            hProd.passRate >= 80 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                            : hProd.passRate >= 50 ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40'
                          }`}>
                            <ArrowTrendingUpIcon className="w-3 h-3" /> {hProd.passRate}%
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Footer: Actions */}
                <div className="flex items-center justify-between pt-3 mt-auto border-t border-border relative z-10">
                  {isAdmin && (
                    <div className="flex gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <ActionButtons onEdit={() => handleOpenEdit(formula)} onDelete={() => crud.openDelete(formula)} />
                    </div>
                  )}
                  <button 
                    onClick={() => handleView(formula)} 
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-2 text-ink-soft hover:bg-surface-3 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all ml-auto border border-border"
                  >
                    <EyeIcon className="w-3.5 h-3.5" /> Xem công thức
                  </button>
                </div>
              </DSCard>
            );
          })}
        </div>
      ) : (
        <DSTable>
          <thead className="bg-surface-2 border-b border-border">
            <tr className="text-ink-muted text-xs font-semibold uppercase tracking-wider">
              <th className="px-4 py-3">Mã SP</th>
              <th className="px-4 py-3">Tên Sản phẩm</th>
              <th className="px-4 py-3 text-center">Thành phần</th>
              <th className="px-4 py-3">Cập nhật lần cuối</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {currentItems.map(formula => {
              const product = productMap.get(formula.productId);
              return (
                <tr key={formula.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink-muted text-xs">{product?.code || '---'}</td>
                  <td className="px-4 py-3 font-semibold text-ink text-sm">{product?.name || 'Sản phẩm đã xóa'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 mr-1" title="Hoạt chất">
                      {formula.ingredients?.length || 0} HC
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-2 text-ink-muted" title="Phụ liệu">
                      {formula.excipients?.length || 0} PL
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {formatDateStandard(formula.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-1.5">
                      <ActionButtons 
                        onView={() => handleView(formula)}
                        onEdit={isAdmin ? () => handleOpenEdit(formula) : undefined} 
                        onDelete={isAdmin ? () => crud.openDelete(formula) : undefined} 
                      />
                    </div>
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
        icon={EyeIcon}
        color="bg-emerald-600"
      >
        {viewFormula && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar text-xs">
             {/* Product Info */}
             <div className="bg-surface-2 p-3.5 rounded-xl border border-border flex items-center gap-3">
                <div className="p-2.5 bg-surface rounded-lg text-emerald-600 dark:text-emerald-400 border border-border"><CubeIcon className="w-6 h-6"/></div>
                <div>
                  <h4 className="text-sm font-semibold text-ink">{products.find(p => p.id === viewFormula.productId)?.name}</h4>
                  <p className="text-xs text-ink-muted">{products.find(p => p.id === viewFormula.productId)?.code}</p>
                </div>
             </div>

             {/* Ingredients */}
             <div>
               <h5 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                 <BeakerIcon className="w-4 h-4"/> Hoạt chất chính
               </h5>
               <div className="border border-border rounded-xl overflow-hidden">
                 <table className="w-full text-left text-xs">
                   <thead className="bg-surface-2 border-b border-border text-ink-muted font-semibold uppercase">
                     <tr>
                       <th className="px-3.5 py-2">Hoạt chất</th>
                       <th className="px-3.5 py-2">Nguyên liệu gốc</th>
                       <th className="px-3.5 py-2 text-right">H.lượng Hợp chất</th>
                       <th className="px-3.5 py-2 text-right">H.lượng Nguyên tố</th>
                       <th className="px-3.5 py-2 text-center">ĐVT</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border">
                    {(viewFormula.ingredients || []).map((ing, idx) => (
                       <tr key={idx} className="hover:bg-surface-2 transition-colors">
                         <td className="px-3.5 py-2 font-medium text-ink">{ing.name}</td>
                         <td className="px-3.5 py-2 text-ink-muted italic">
                           {rawMaterials.find(m => m.id === ing.materialId)?.name || '-'}
                         </td>
                         <td className="px-3.5 py-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                           {formatScientific(ing.declaredContent)}
                         </td>
                         <td className="px-3.5 py-2 text-right font-mono font-semibold text-sky-600 dark:text-sky-400">
                           {ing.elementalContent ? formatScientific(ing.elementalContent) : '-'}
                         </td>
                         <td className="px-3.5 py-2 text-center text-ink-muted">{ing.unit}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>

             {/* Excipients */}
             <div>
               <h5 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                 <CpuChipIcon className="w-4 h-4"/> Phụ liệu / Tá dược
               </h5>
               <div className="border border-border rounded-xl overflow-hidden">
                 <table className="w-full text-left text-xs">
                   <thead className="bg-surface-2 border-b border-border text-ink-muted font-semibold uppercase">
                     <tr>
                       <th className="px-3.5 py-2">Tên phụ liệu</th>
                       <th className="px-3.5 py-2">Nguyên liệu gốc</th>
                       <th className="px-3.5 py-2 text-right">H.lượng Hợp chất</th>
                       <th className="px-3.5 py-2 text-right">H.lượng Nguyên tố</th>
                       <th className="px-3.5 py-2 text-center">ĐVT</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border">
                     {(viewFormula.excipients || []).length > 0 ? (viewFormula.excipients || []).map((exc, idx) => (
                       <tr key={idx} className="hover:bg-surface-2 transition-colors">
                         <td className="px-3.5 py-2 font-medium text-ink">{exc.name}</td>
                         <td className="px-3.5 py-2 text-ink-muted italic">
                           {rawMaterials.find(m => m.id === exc.materialId)?.name || '-'}
                         </td>
                         <td className="px-3.5 py-2 text-right font-mono font-medium text-ink">{formatScientific(exc.declaredContent)}</td>
                         <td className="px-3.5 py-2 text-right font-mono font-semibold text-sky-600 dark:text-sky-400">
                           {exc.elementalContent ? formatScientific(exc.elementalContent) : '-'}
                         </td>
                         <td className="px-3.5 py-2 text-center text-ink-muted">{exc.unit}</td>
                       </tr>
                     )) : (
                       <tr><td colSpan={5} className="px-3.5 py-2 text-center text-ink-muted italic">Không có phụ liệu</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>

             {/* Extra Info */}
             <div className="grid grid-cols-2 gap-3 bg-surface-2 p-3.5 rounded-xl border border-border text-xs">
                <div><p className="font-medium text-ink-muted">Dạng bào chế</p><p className="font-semibold text-ink">{viewFormula.sensory?.dosageForm || '---'}</p></div>
                <div><p className="font-medium text-ink-muted">Quy cách</p><p className="font-semibold text-ink">{viewFormula.packaging || '---'}</p></div>
                <div><p className="font-medium text-ink-muted">Màu sắc</p><p className="font-semibold text-ink">{viewFormula.sensory?.color || '---'}</p></div>
                <div><p className="font-medium text-ink-muted">Mùi vị</p><p className="font-semibold text-ink">{viewFormula.sensory?.smellTaste || '---'}</p></div>
                <div className="col-span-2 pt-2 border-t border-border"><p className="font-medium text-ink-muted">Cảm quan</p><p className="italic text-ink">"{viewFormula.sensory?.appearance || '---'}"</p></div>
                <div><p className="font-medium text-ink-muted">Hạn dùng</p><p className="font-semibold text-ink">{viewFormula.shelfLife || '---'}</p></div>
                <div><p className="font-medium text-ink-muted">Bảo quản</p><p className="font-semibold text-ink">{viewFormula.storage || '---'}</p></div>
             </div>
             
             <div className="flex justify-end pt-2">
                <button onClick={() => setViewFormula(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-ink rounded-lg text-xs font-medium transition-colors border border-border">Đóng</button>
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

