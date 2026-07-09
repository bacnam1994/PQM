
import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Plus, Search, Trash2, Edit2, Upload, Eye, FileSpreadsheet, Package, X, Building2, AlertCircle, Info, CheckCircle2, LayoutGrid, List, ArrowUpDown, FileUp, Loader2, PackageSearch } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Product, ProductStatus } from '../../types';
import { logAuditAction } from '../../services/auditService';
import { StatusBadge, PageHeader, Modal, Pagination, DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable, ActionButtons, DeleteModal, AddButton, DSEmptyState } from '../../components';
import { useDebounce, useCrud } from '../../hooks';
import { useUIStore } from '../../store/useUIStore';
import { PRODUCT_STATUS, generateId, formatDateStandard } from '../../utils';
import { useShallow } from 'zustand/react/shallow';

const SELF_ANNOUNCED_COMPANY = "CÔNG TY CỔ PHẦN CÔNG NGHỆ SINH PHẨM NAM VIỆT";

// --- SUB-COMPONENT: Grid Item (Memoized) ---
const ProductGridItem = memo(({ product, onEdit, onDelete, isAdmin }: { product: Product, onEdit: (p: Product) => void, onDelete: (p: Product) => void, isAdmin: boolean }) => {
  const isSelf = product.registrant.trim().toUpperCase() === SELF_ANNOUNCED_COMPANY;
  return (
    <DSCard className="p-5 flex flex-col gap-5 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)] dark:hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.08)] transition-all duration-500 group relative overflow-hidden bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/80 dark:from-emerald-950/20 dark:via-slate-800 dark:to-teal-950/20 dark:border-slate-700/50">
      {/* Decorative Blob */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/10 to-teal-400/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>

      {/* Header: Eyebrow text and Status */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          <Package size={14} className="text-emerald-500" />
          <span className="truncate max-w-[150px]" title={product.group}>{product.group} • {isSelf ? 'Tự công bố' : 'Gia công'}</span>
        </div>
        <StatusBadge type="PRODUCT" status={product.status} />
      </div>

      {/* Glass Box Highlighting Main Content */}
      <div className="bg-gradient-to-br from-white/60 to-white/30 dark:from-slate-900/60 dark:to-slate-900/30 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.1)] dark:shadow-[0_4px_20px_-5px_rgba(16,185,129,0.05)] rounded-2xl p-4 flex flex-col gap-4 relative z-10 mt-2 flex-grow">
        {/* Main Info: Name and Icon */}
        <div className="flex items-center gap-4">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-250 dark:border-slate-700 shadow-sm" />
          ) : (
            <div className="bg-emerald-50/80 dark:bg-emerald-955/50 p-3.5 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100/50 dark:border-emerald-900/30 shadow-inner">
              <Package size={24} />
            </div>
          )}
          <Link to={`/products/${product.id}`} className="flex flex-col group/link">
            <h3 className="font-black text-slate-800 dark:text-slate-200 text-base leading-tight group-hover/link:text-emerald-600 dark:group-hover/link:text-emerald-400 transition-colors line-clamp-2">{product.name}</h3>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{product.code}</p>
          </Link>
        </div>

        {/* Meta Info */}
        <div className="space-y-1.5 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 mt-auto">
            <div className="flex justify-between items-start gap-2 text-[11px] font-bold">
              <span className="text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap shrink-0">Số ĐKCB:</span>
              <span className="text-slate-700 dark:text-slate-300 text-right break-all">{product.registrationNo || '-'}</span>
            </div>
            <div className="flex justify-between items-start gap-2 text-[11px] font-bold">
              <span className="text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap shrink-0">Ngày cấp:</span>
              <span className="text-slate-700 dark:text-slate-300 text-right">{formatDateStandard(product.registrationDate)}</span>
            </div>
        </div>
      </div>

      {/* Footer: Actions */}
      <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-100 dark:border-slate-700 relative z-10">
        {isAdmin && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ActionButtons 
              onEdit={() => onEdit(product)}
              onDelete={() => onDelete(product)}
            />
          </div>
        )}
        <Link to={`/products/${product.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-700 dark:hover:text-indigo-400 transition-all ml-auto">
          Chi tiết hồ sơ <CheckCircle2 size={14} className="opacity-0 group-hover:opacity-100 hidden" />
        </Link>
      </div>
    </DSCard>
  );
});

// --- SUB-COMPONENT: List Item (Memoized) ---
const ProductListItem = memo(({ product, onEdit, onDelete, isAdmin }: { product: Product, onEdit: (p: Product) => void, onDelete: (p: Product) => void, isAdmin: boolean }) => {
  const isSelf = product.registrant.trim().toUpperCase() === SELF_ANNOUNCED_COMPANY;
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200 shadow-sm" />
          ) : (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 ${product.status === PRODUCT_STATUS.ACTIVE ? 'bg-emerald-500' : 'bg-slate-400'}`}>
              <Package size={16} />
            </div>
          )}
          <div>
            <Link to={`/products/${product.id}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block text-sm">{product.name}</Link>
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">{product.code}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 text-xs">
        <div>{product.group}</div>
        <div className={`text-[9px] uppercase mt-1 ${isSelf ? 'text-blue-650 dark:text-blue-400' : 'text-slate-450 dark:text-slate-500'}`}>
          {isSelf ? 'Tự công bố' : 'Gia công'}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{product.registrationNo}</div>
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{formatDateStandard(product.registrationDate)}</div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge type="PRODUCT" status={product.status} />
      </td>
      <td className="px-4 py-3 text-right">
        {isAdmin && (
          <div className="flex justify-end gap-2">
            <ActionButtons 
              onView={() => { /* Navigate handled by Link, but kept for consistency if needed */ }}
              onEdit={() => onEdit(product)}
              onDelete={() => onDelete(product)}
            />
          </div>
        )}
      </td>
    </tr>
  );
});

const ProductDataList = ({ viewMode, data, onEdit, onDelete, isAdmin }: any) => {
  if (data.length === 0) {
     return <DSEmptyState icon={PackageSearch} title="Không tìm thấy Sản phẩm" message="Chưa có sản phẩm nào khớp với từ khóa hoặc bộ lọc." />;
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {data.map((product: Product) => (
          <ProductGridItem key={product.id} product={product} onEdit={onEdit} onDelete={onDelete} isAdmin={isAdmin} />
        ))}
      </div>
    );
  }
  return (
    <DSTable>
      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
        <tr className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Sản phẩm</th>
          <th className="px-4 py-3">Phân loại</th>
          <th className="px-4 py-3">Số ĐKCB</th>
          <th className="px-4 py-3">Trạng thái</th>
          <th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
        {data.map((product: Product) => (
          <ProductListItem key={product.id} product={product} onEdit={onEdit} onDelete={onDelete} isAdmin={isAdmin} />
        ))}
      </tbody>
    </DSTable>
  );
};

const ProductList: React.FC = () => {
  // Zustand Selectors
  // Tối ưu 1: Gom nhóm Zustand Selectors bằng useShallow
  const { products, deleteProduct, bulkAddProducts, notify, user, isAdmin } = useAppStore(useShallow(state => ({
    products: state.products,
    deleteProduct: state.deleteProduct,
    bulkAddProducts: state.bulkAddProducts,
    notify: state.notify,
    user: state.user,
    isAdmin: state.isAdmin
  })));
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const paramSearchTerm = searchParams.get('q') || '';
  const [currentPage, setCurrentPage] = useState(1);
  
  // Local state for immediate input feedback, debounced value for filtering
  const [localSearchTerm, setLocalSearchTerm] = useState(paramSearchTerm);
  const debouncedSearchTerm = useDebounce(localSearchTerm, 300);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const viewMode = useUIStore(s => s.productViewMode);
  const setViewMode = useUIStore(s => s.setProductViewMode);
  // --- FILTER & SORT (persisted via UIStore / localStorage) ---
  const sortConfig = useUIStore(s => s.productSort);
  const setSortConfig = useUIStore(s => s.setProductSort);
  const filterType = useUIStore(s => s.productFilterType);
  const setFilterType = useUIStore(s => s.setProductFilterType);
  const filterStatus = useUIStore(s => s.productFilterStatus);
  const setFilterStatus = useUIStore(s => s.setProductFilterStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const crud = useCrud<Product>();

  
  const itemsPerPage = 12;

  const sortOptions: Record<string, string> = {
    'createdAt-desc': 'Mới tạo nhất',
    'createdAt-asc': 'Cũ nhất',
    'name-asc': 'Tên (A-Z)',
    'name-desc': 'Tên (Z-A)',
  };

  const filteredProducts = useMemo(() => {
    const searchLower = paramSearchTerm.toLowerCase();
    const hasSearch = searchLower.length > 0;

    let result = products.filter(p => {
      // Tối ưu 2: Early return để tránh tính toán chuỗi thừa
      if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
      
      if (filterType !== 'ALL') {
         const isSelf = p.registrant.trim().toUpperCase() === SELF_ANNOUNCED_COMPANY;
         if (filterType === 'SELF' && !isSelf) return false;
         if (filterType === 'OUTSOURCE' && isSelf) return false;
      }

      if (hasSearch) {
         if (!p.name.toLowerCase().includes(searchLower) && 
             !p.code.toLowerCase().includes(searchLower) &&
             !p.registrant.toLowerCase().includes(searchLower)) {
           return false;
         }
      }
      return true;
    });

    // Sorting logic
    result.sort((a, b) => {
      const sortKey = sortConfig.key as keyof Product;
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (sortConfig.key === 'createdAt' || sortConfig.key === 'registrationDate') {
        // Tối ưu 3: So sánh chuỗi ISO trực tiếp thay vì khởi tạo Date object
        const dateA = (aValue as string) || '';
        const dateB = (bValue as string) || '';
        return sortConfig.direction === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }

      const strA = String(aValue || '');
      const strB = String(bValue || '');
      return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return result;
  }, [products, paramSearchTerm, sortConfig, filterType, filterStatus]);

  // Effect to update URL search param when debounced term changes
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (debouncedSearchTerm) {
        next.set('q', debouncedSearchTerm);
      } else {
        next.delete('q');
      }
      return next;
    }, { replace: true }); // Use replace to avoid polluting browser history
    setCurrentPage(1); // Reset to first page on new search
  }, [debouncedSearchTerm, setSearchParams]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setIsSubmitting(true);

    try {
      const lines = importText.trim().split('\n');
      const productsToCreate: Product[] = [];
      const errors: string[] = [];
      
      // Use existing products + products in this batch for duplicate checks
      const existingProductSignatures = new Set(products.map(p => `${p.code?.trim().toUpperCase()}|${p.name?.trim()}`));

      for (const line of lines) {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        const code = parts[0]?.trim().toUpperCase() || '';
        const name = parts[1]?.trim() || '';
        const signature = `${code}|${name}`;

        if (!code && !name) {
          errors.push(`Bỏ qua dòng trống: "${line.substring(0, 50)}..."`);
          continue;
        }

        if (existingProductSignatures.has(signature)) {
          errors.push(`Bỏ qua sản phẩm đã tồn tại: "${code} - ${name}"`);
          continue;
        }

        const newProd: Product = {
          id: generateId('prod'),
          code: code,
          name: name,
          group: parts[2]?.trim() || 'TPBS',
          registrationNo: parts[3]?.trim() || '',
          registrationDate: parts[4]?.trim() || new Date().toISOString().split('T')[0],
          registrant: parts[5]?.trim() || 'V-Biotech',
          status: PRODUCT_STATUS.ACTIVE,
          description: parts[6]?.trim() || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        productsToCreate.push(newProd);
        existingProductSignatures.add(signature); // Add to set to prevent duplicates within the same import
      }

      if (productsToCreate.length > 0) {
        await bulkAddProducts(productsToCreate);
      }

      let alertMessage = `Đã nhập thành công ${productsToCreate.length} sản phẩm.`;
      if (errors.length > 0) {
        notify({ type: 'WARNING', title: 'Nhập liệu có cảnh báo', message: `${alertMessage} Có ${errors.length} dòng bị bỏ qua.` });
      } else {
        notify({ type: 'SUCCESS', title: 'Nhập liệu hoàn tất', message: alertMessage });
      }
      
      setIsImportModalOpen(false); // Chỉ đóng khi thành công
      setImportText('');
    } catch (error) {
      console.error(error);
      // AppContext đã alert lỗi chi tiết, ở đây chỉ cần giữ form mở
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
    // Reset input value to allow selecting the same file again if needed
    e.target.value = '';
  };

  // --- Handlers for Memoized Components ---
  const handleEditClick = useCallback((product: Product) => {
    navigate(`/products/edit/${product.id}`);
  }, [navigate]);

  const handleDeleteClick = useCallback((product: Product) => {
    crud.openDelete(product);
  }, [crud]);

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteProduct(crud.selectedItem.id);
        // Đóng modal ngay khi xóa thành công
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: `Đã xóa sản phẩm ${crud.selectedItem!.name}` });
        
        // Ghi log an toàn
        try {
          logAuditAction({
            action: 'DELETE',
            collection: 'PRODUCTS',
            documentId: crud.selectedItem!.id,
            details: `Xóa sản phẩm: ${crud.selectedItem!.name}`,
            performedBy: user?.email || 'unknown'
          });
        } catch (logErr) {
          console.warn("Ghi log thất bại:", logErr);
        }
      } catch (error) {
        console.error("Failed to delete product:", error);
      }
    } else {
      crud.close();
    }
  }, [crud.selectedItem, deleteProduct, user]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Danh mục Sản phẩm" 
        subtitle="Quản lý sản phẩm V-Biotech." 
        icon={Package}
        action={isAdmin ? (
          <div className="flex gap-3">
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-black uppercase text-[10px] transition-all shadow-sm">
              <Upload size={16} /> Nhập Excel
            </button>
            <AddButton onClick={() => navigate('/products/new')} label="Thêm sản phẩm" />
          </div>
        ) : undefined}
      />

      <DSFilterBar>
        <DSSearchInput placeholder="Tìm theo tên, mã sản phẩm..." value={localSearchTerm} onChange={(e) => setLocalSearchTerm(e.target.value)} onClear={() => setLocalSearchTerm('')} />
        
        <DSSelect icon={Building2} value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="w-32">
           <option value="ALL">Tất cả nguồn</option>
           <option value="SELF">Tự công bố</option>
           <option value="OUTSOURCE">Gia công</option>
        </DSSelect>

        <DSSelect icon={AlertCircle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-32">
           <option value="ALL">Tất cả trạng thái</option>
           <option value={PRODUCT_STATUS.ACTIVE}>Đang lưu hành</option>
           <option value={PRODUCT_STATUS.DISCONTINUED}>Ngừng sản xuất</option>
           <option value={PRODUCT_STATUS.RECALLED}>Đã thu hồi</option>
        </DSSelect>

        <DSSelect icon={ArrowUpDown} value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => {
             const [key, direction] = e.target.value.split('-');
             setSortConfig({ key, direction: direction as 'asc' | 'desc' });
           }} className="w-32">
           <option value="createdAt-desc">Mới tạo nhất</option>
           <option value="createdAt-asc">Cũ nhất</option>
           <option value="name-asc">Tên (A-Z)</option>
           <option value="name-desc">Tên (Z-A)</option>
        </DSSelect>

        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      <div className="flex flex-wrap items-center justify-between gap-4 px-2 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">Tổng: {products.length}</span>
          <span className="text-slate-300">|</span>
          <span className="text-indigo-600">Kết quả: {filteredProducts.length}</span>
          {paramSearchTerm && (
             <span className="text-amber-600 ml-2">• Tìm kiếm: "{paramSearchTerm}"</span>
          )}
        </div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
           <span>Sắp xếp:</span>
           <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{sortOptions[`${sortConfig.key}-${sortConfig.direction}`] || 'Tùy chỉnh'}</span>
        </div>
      </div>

      <ProductDataList 
        viewMode={viewMode}
        data={currentProducts}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        isAdmin={isAdmin}
      />

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleConfirmDelete}
        itemName={crud.selectedItem?.name}
        warningMessage="Tất cả dữ liệu liên quan (TCCS, Lô, Kết quả Lab) cũng sẽ bị xóa vĩnh viễn."
        isDeleting={false}
      />

      {/* Modal Nhập Excel với Hướng dẫn Chi tiết */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Nhập dữ liệu hàng loạt" icon={FileSpreadsheet} color="bg-blue-600">
        <div className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
             <h4 className="flex items-center gap-2 text-blue-700 font-black text-[10px] uppercase tracking-widest mb-4">
                <Info size={16}/> Hướng dẫn xếp cột (Excel/Google Sheets)
             </h4>
             <p className="text-xs text-blue-600 mb-4 leading-relaxed">
                Bạn có thể copy trực tiếp các vùng dữ liệu từ Excel và dán vào ô bên dưới. 
                Hệ thống sẽ tự nhận diện theo thứ tự các cột như sau:
             </p>
             <div className="grid grid-cols-1 gap-2">
                {[
                  "1. Mã Sản phẩm (Bắt buộc)",
                  "2. Tên Sản phẩm (Bắt buộc)",
                  "3. Nhóm hàng (VD: TPBS, Mỹ phẩm...)",
                  "4. Số ĐKCB / Công bố",
                  "5. Ngày cấp (Định dạng: YYYY-MM-DD)",
                  "6. Đơn vị sở hữu",
                  "7. Mô tả tóm tắt"
                ].map((txt, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-blue-800 bg-white/50 px-3 py-1.5 rounded-xl border border-blue-100/50">
                    <CheckCircle2 size={12} className="text-blue-400" /> {txt}
                  </div>
                ))}
             </div>
             <div className="mt-6 pt-4 border-t border-blue-200/50">
                <p className="text-[9px] font-black text-blue-400 uppercase mb-2">Ví dụ dữ liệu chuẩn:</p>
                <code className="block p-3 bg-white rounded-xl text-[10px] text-slate-600 font-mono shadow-inner border border-blue-100">
                  VB-001, Nano Curcumin, TPBS, 123/2024, 2024-05-15, V-Biotech, Chiết xuất nghệ Nano
                </code>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="relative">
                <input 
                  type="file" 
                  accept=".csv,.txt" 
                  onChange={handleFileRead} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                />
                <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors">
                   <FileUp size={16} /> Tải lên file CSV/TXT
                </button>
             </div>
             <p className="text-[10px] text-slate-400 italic">Hỗ trợ file văn bản (.txt, .csv) ngăn cách bởi dấu phẩy hoặc tab.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Dán dữ liệu vào đây</label>
            <textarea 
              value={importText} 
              onChange={(e) => setImportText(e.target.value)} 
              rows={8} 
              className="w-full p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] font-mono text-xs focus:ring-4 focus:ring-blue-50 outline-none transition-all" 
              placeholder="Copy từ Excel và dán tại đây..." 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setIsImportModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-xs">Hủy</button>
            <button 
              onClick={handleBulkImport} 
              disabled={!importText.trim() || isSubmitting}
              className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-100 disabled:opacity-30 disabled:shadow-none flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Tiến hành nhập kho dữ liệu
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProductList;
