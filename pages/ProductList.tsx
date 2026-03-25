
import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Trash2, Edit2, Upload, Eye, FileSpreadsheet, Package, X, Calendar, Building2, AlertCircle, Info, CheckCircle2, ChevronLeft, ChevronRight, LayoutGrid, List, ArrowUpDown, FileUp, Loader2 } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Product, ProductStatus } from '../types';
import { StatusBadge, PageHeader, Modal, Pagination } from '../components/CommonUI';
import { DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable, DSFormInput } from '../components/DesignSystem';
import { PRODUCT_STATUS } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useDebounce } from '../hooks/useDebounce';
import { useCrud } from '../hooks/useCrud';
import { logAuditAction } from '../services/auditService';
import { ActionButtons, DeleteModal, AddButton } from '../components/CrudControls';
import { generateId } from '../utils/idGenerator';

const SELF_ANNOUNCED_COMPANY = "CÔNG TY CỔ PHẦN CÔNG NGHỆ SINH PHẨM NAM VIỆT";

// --- SUB-COMPONENT: Grid Item (Memoized) ---
const ProductGridItem = memo(({ product, onEdit, onDelete }: { product: Product, onEdit: (p: Product) => void, onDelete: (p: Product) => void }) => {
  const isSelf = product.registrant.trim().toUpperCase() === SELF_ANNOUNCED_COMPANY;
  return (
    <DSCard className="p-4 hover:shadow-xl group relative transition-all duration-300 hover:-translate-y-1">
      <div className={`absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 rounded-full opacity-10 transition-transform group-hover:scale-150 ${product.status === PRODUCT_STATUS.ACTIVE ? 'bg-emerald-500' : 'bg-red-500'}`} />
      
      <div className="flex justify-between items-start mb-3">
          <div className="p-2 bg-slate-50 rounded-xl text-[#009639]"><Package size={20}/></div>
          <StatusBadge type="PRODUCT" status={product.status} />
      </div>

      <Link to={`/products/${product.id}`} className="block group">
        <h3 className="font-black text-slate-800 text-sm leading-tight mb-1 group-hover:text-[#009639] transition-colors line-clamp-2 min-h-[2.5em]">{product.name}</h3>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{product.code}</p>
      </Link>

      <div className="space-y-1.5 border-t border-slate-50 pt-3">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400 uppercase">Số ĐKCB:</span>
            <span className="text-slate-700">{product.registrationNo}</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400 uppercase">Ngày cấp:</span>
            <span className="text-slate-700">{new Date(product.registrationDate).toLocaleDateString('en-GB')}</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400 uppercase">Loại:</span>
            <span className={`${isSelf ? 'text-blue-600' : 'text-slate-500'} truncate max-w-[100px]`}>{isSelf ? 'Tự công bố' : 'Gia công'}</span>
          </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
          <Link to={`/products/${product.id}`} className="text-[10px] font-black text-[#009639] uppercase hover:underline">Chi tiết hồ sơ</Link>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ActionButtons 
              onEdit={() => onEdit(product)}
              onDelete={() => onDelete(product)}
            />
          </div>
      </div>
    </DSCard>
  );
});

// --- SUB-COMPONENT: List Item (Memoized) ---
const ProductListItem = memo(({ product, onEdit, onDelete }: { product: Product, onEdit: (p: Product) => void, onDelete: (p: Product) => void }) => {
  const isSelf = product.registrant.trim().toUpperCase() === SELF_ANNOUNCED_COMPANY;
  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${product.status === PRODUCT_STATUS.ACTIVE ? 'bg-emerald-500' : 'bg-slate-400'}`}>
            <Package size={16} />
          </div>
          <div>
            <Link to={`/products/${product.id}`} className="font-bold text-slate-800 hover:text-indigo-600 transition-colors block text-sm">{product.name}</Link>
            <span className="text-[10px] font-black text-slate-400 uppercase">{product.code}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-bold text-slate-600 text-xs">
        <div>{product.group}</div>
        <div className={`text-[9px] uppercase mt-1 ${isSelf ? 'text-blue-600' : 'text-slate-400'}`}>
          {isSelf ? 'Tự công bố' : 'Gia công'}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-xs font-bold text-slate-700">{product.registrationNo}</div>
        <div className="text-[10px] text-slate-400">{new Date(product.registrationDate).toLocaleDateString('en-GB')}</div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge type="PRODUCT" status={product.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <ActionButtons 
            onView={() => { /* Navigate handled by Link, but kept for consistency if needed */ }}
            onEdit={() => onEdit(product)}
            onDelete={() => onDelete(product)}
          />
        </div>
      </td>
    </tr>
  );
});

const ProductDataList = ({ viewMode, data, onEdit, onDelete }: any) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {data.map((product: Product) => (
          <ProductGridItem key={product.id} product={product} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    );
  }
  return (
    <DSTable>
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Sản phẩm</th>
          <th className="px-4 py-3">Phân loại</th>
          <th className="px-4 py-3">Số ĐKCB</th>
          <th className="px-4 py-3">Trạng thái</th>
          <th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {data.map((product: Product) => (
          <ProductListItem key={product.id} product={product} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </tbody>
    </DSTable>
  );
};

const ProductList: React.FC = () => {
  const { state, addProduct, updateProduct, deleteProduct, bulkAddProducts, notify } = useAppContext();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const paramSearchTerm = searchParams.get('q') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  
  // Local state for immediate input feedback, debounced value for filtering
  const [localSearchTerm, setLocalSearchTerm] = useState(paramSearchTerm);
  const debouncedSearchTerm = useDebounce(localSearchTerm, 300);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('product_view_mode', 'grid');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });
  const [filterType, setFilterType] = useState<'ALL' | 'SELF' | 'OUTSOURCE'>('ALL');
  const [filterStatus, setFilterStatus] = useState<ProductStatus | 'ALL'>('ALL');
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
    let result = state.products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(paramSearchTerm.toLowerCase()) || 
      p.code.toLowerCase().includes(paramSearchTerm.toLowerCase()) ||
      p.registrant.toLowerCase().includes(paramSearchTerm.toLowerCase());

      const isSelf = p.registrant.trim().toUpperCase() === SELF_ANNOUNCED_COMPANY;
      const matchesType = filterType === 'ALL' ? true : filterType === 'SELF' ? isSelf : !isSelf;

      const matchesStatus = filterStatus === 'ALL' ? true : p.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });

    // Sorting logic
    result.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (sortConfig.key === 'createdAt' || sortConfig.key === 'registrationDate') {
        const dateA = new Date(aValue as string).getTime();
        const dateB = new Date(bValue as string).getTime();
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

      const strA = String(aValue).toLowerCase();
      const strB = String(bValue).toLowerCase();
      
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [state.products, paramSearchTerm, sortConfig, filterType, filterStatus]);

  // Effect to update URL search param when debounced term changes
  useEffect(() => {
    setSearchParams(prev => {
      if (debouncedSearchTerm) {
        prev.set('q', debouncedSearchTerm);
      } else {
        prev.delete('q');
      }
      prev.set('page', '1'); // Reset to first page on new search
      return prev;
    }, { replace: true }); // Use replace to avoid polluting browser history
  }, [debouncedSearchTerm, setSearchParams]);

  const handlePageChange = (page: number) => {
    setSearchParams(prev => {
      prev.set('page', String(page));
      return prev;
    });
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
    const formData = new FormData(e.currentTarget);
    const data = {
      code: (formData.get('code') as string).trim().toUpperCase(),
      name: (formData.get('name') as string).trim(),
      group: formData.get('group') as string,
      registrationNo: formData.get('registrationNo') as string,
      registrationDate: formData.get('registrationDate') as string,
      registrant: formData.get('registrant') as string,
      status: formData.get('status') as ProductStatus,
      description: formData.get('description') as string,
    };

    // Validate: Tối thiểu 1 trường tồn tại
    if (!data.code && !data.name) {
      notify({ type: 'WARNING', message: 'Vui lòng nhập tối thiểu Mã sản phẩm hoặc Tên sản phẩm!' });
        setIsSubmitting(false);
      return;
    }

    // Validate: Không trùng cả Mã và Tên
    const isDuplicate = state.products.some(p => p.code === data.code && p.name === data.name);

    if (isDuplicate) {
      notify({ type: 'ERROR', title: 'Trùng lặp', message: 'Sản phẩm với cùng Mã và Tên đã tồn tại!' });
        setIsSubmitting(false);
      return;
    }

    await addProduct({ id: generateId('prod'), ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    crud.close();
    notify({ type: 'SUCCESS', title: 'Thành công', message: 'Đã thêm sản phẩm mới.' });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!crud.selectedItem) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        code: (formData.get('code')?.toString() || '').trim().toUpperCase(),
        name: (formData.get('name')?.toString() || '').trim(),
        group: formData.get('group')?.toString() || '',
        registrationNo: formData.get('registrationNo')?.toString() || '',
        registrationDate: formData.get('registrationDate')?.toString() || '',
        registrant: formData.get('registrant')?.toString() || '',
        status: (formData.get('status')?.toString() || PRODUCT_STATUS.ACTIVE) as ProductStatus,
        description: formData.get('description')?.toString() || '',
      };

      if (!data.code && !data.name) {
        notify({ type: 'WARNING', message: 'Vui lòng nhập tối thiểu Mã sản phẩm hoặc Tên sản phẩm!' });
        return;
      }

      const isDuplicate = state.products.some(p => 
        p.id !== crud.selectedItem?.id && p.code === data.code && p.name === data.name
      );

      if (isDuplicate) {
        notify({ type: 'ERROR', title: 'Trùng lặp', message: 'Sản phẩm với cùng Mã và Tên đã tồn tại!' });
        return;
      }

      if (typeof updateProduct !== 'function') {
        throw new Error('Hàm cập nhật (updateProduct) không được hỗ trợ trong Context hiện tại.');
      }

      await updateProduct({ ...crud.selectedItem, ...data, updatedAt: new Date().toISOString() });
      crud.close();
      notify({ type: 'SUCCESS', title: 'Đã cập nhật', message: 'Thông tin sản phẩm đã được lưu.' });
    } catch (error) {
      console.error("Lỗi khi cập nhật sản phẩm:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    setIsSubmitting(true);

    try {
      const lines = importText.trim().split('\n');
      const productsToCreate: Product[] = [];
      const errors: string[] = [];
      
      // Use existing products + products in this batch for duplicate checks
      const existingProductSignatures = new Set(state.products.map(p => `${p.code?.trim().toUpperCase()}|${p.name?.trim()}`));

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
    crud.openEdit(product);
  }, []);

  const handleDeleteClick = useCallback((product: Product) => {
    crud.openDelete(product);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteProduct(crud.selectedItem.id);
        // Đóng modal ngay khi xóa thành công
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: `Đã xóa sản phẩm ${crud.selectedItem.name}` });
        
        // Ghi log an toàn
        try {
          logAuditAction({
            action: 'DELETE',
            collection: 'PRODUCTS',
            documentId: crud.selectedItem.id,
            details: `Xóa sản phẩm: ${crud.selectedItem.name}`,
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
        action={
          <div className="flex gap-3">
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-black uppercase text-[10px] transition-all shadow-sm">
              <Upload size={16} /> Nhập Excel
            </button>
            <AddButton onClick={crud.openAdd} label="Thêm sản phẩm" />
          </div>
        }
      />

      <DSFilterBar>
        <DSSearchInput placeholder="Tìm theo tên, mã sản phẩm..." value={localSearchTerm} onChange={(e) => setLocalSearchTerm(e.target.value)} />
        
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
             setSortConfig({ key: key as keyof Product, direction: direction as 'asc' | 'desc' });
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
          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">Tổng: {state.products.length}</span>
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
      />

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />

      <DeleteModal 
        isOpen={crud.mode === 'DELETE'} 
        onClose={crud.close} 
        onConfirm={handleConfirmDelete}
        itemName={crud.selectedItem?.name}
        warningMessage="Tất cả dữ liệu liên quan (TCCS, Lô, Kết quả Lab) cũng sẽ bị xóa vĩnh viễn."
        isDeleting={false}
      />

      {/* Modal Thêm Mới */}
      <Modal isOpen={crud.mode === 'ADD'} onClose={crud.close} title="Đăng ký Sản phẩm mới" icon={Package}>
        <form onSubmit={handleAddProduct} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <DSFormInput label="Mã sản phẩm" name="code" placeholder="VB-XXX" />
            <DSFormInput label="Nhóm hàng" name="group" placeholder="TPBS / Mỹ phẩm..." />
          </div>
          <DSFormInput label="Tên sản phẩm đầy đủ" name="name" placeholder="Nhập tên sản phẩm..." />
          <div className="grid grid-cols-2 gap-4">
            <DSFormInput label="Số ĐKCB / Công bố" name="registrationNo" placeholder="1234/2024/ATTP-XNCB" />
            <DSFormInput label="Ngày cấp" type="date" name="registrationDate" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <DSFormInput label="Công ty đăng ký / Sở hữu" name="registrant" placeholder="CÔNG TY CỔ PHẦN V-BIOTECH" />
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Mô tả</label>
            <textarea name="description" rows={3} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" placeholder="Mô tả ngắn về sản phẩm..."></textarea>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Trạng thái lưu hành</label>
            <select name="status" defaultValue={PRODUCT_STATUS.ACTIVE} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-black outline-none text-sm">
              <option value={PRODUCT_STATUS.ACTIVE}>Đang công bố & SX</option>
              <option value={PRODUCT_STATUS.DISCONTINUED}>Ngừng sản xuất</option>
              <option value={PRODUCT_STATUS.RECALLED}>Đã thu hồi hồ sơ</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t">
            <button type="button" onClick={crud.close} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-[#009639] text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-emerald-100 flex items-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Lưu dữ liệu
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Cập Nhật */}
      <Modal isOpen={crud.mode === 'EDIT'} onClose={crud.close} title="Cập nhật Sản phẩm" icon={Edit2}>
        {crud.selectedItem && (
          <form onSubmit={handleEditProduct} className="space-y-6" key={crud.selectedItem.id}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Mã sản phẩm</label>
                <input name="code" defaultValue={crud.selectedItem.code} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-black outline-none shadow-inner text-sm" placeholder="VB-XXX" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Nhóm hàng</label>
                <input name="group" defaultValue={crud.selectedItem.group} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm" placeholder="TPBS / Mỹ phẩm..." />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Tên sản phẩm đầy đủ</label>
              <input name="name" defaultValue={crud.selectedItem.name} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm" placeholder="Nhập tên sản phẩm..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Số ĐKCB / Công bố</label>
                <input name="registrationNo" defaultValue={crud.selectedItem.registrationNo} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" placeholder="1234/2024/ATTP-XNCB" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Ngày cấp</label>
                <input type="date" name="registrationDate" defaultValue={crud.selectedItem.registrationDate?.split('T')[0]} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Công ty đăng ký / Sở hữu</label>
              <input name="registrant" defaultValue={crud.selectedItem.registrant} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" placeholder="CÔNG TY CỔ PHẦN V-BIOTECH" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Mô tả</label>
              <textarea name="description" defaultValue={crud.selectedItem.description || ''} rows={3} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none text-sm" placeholder="Mô tả ngắn về sản phẩm..."></textarea>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Trạng thái lưu hành</label>
              <select name="status" defaultValue={crud.selectedItem.status || PRODUCT_STATUS.ACTIVE} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-black outline-none text-sm">
                <option value={PRODUCT_STATUS.ACTIVE}>Đang công bố & SX</option>
                <option value={PRODUCT_STATUS.DISCONTINUED}>Ngừng sản xuất</option>
                <option value={PRODUCT_STATUS.RECALLED}>Đã thu hồi hồ sơ</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t">
              <button type="button" onClick={crud.close} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl">Hủy</button>
              <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-blue-100 flex items-center gap-2">
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Cập nhật
              </button>
            </div>
          </form>
        )}
      </Modal>

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
