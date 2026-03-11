import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Building2, Package, AlertCircle, Loader2, Edit2, Trash2, FileSpreadsheet, Copy, Upload, Info, Filter, ArrowUpDown, LayoutGrid, List } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Modal, ConfirmationModal } from '../components/CommonUI';
import { DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable, DSFormInput } from '../components/DesignSystem';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useDebounce } from '../hooks/useDebounce';
import { logAuditAction } from '../services/auditService';
import { AuditAction } from '../types';
import { generateId } from '../utils/idGenerator';

const ProductList: React.FC = () => {
  const { state, addProduct, updateProduct, deleteProduct, bulkAddProducts, notify, isAdmin } = useAppContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: 'code' | 'name' | 'createdAt'; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc',
  });
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('product_view_mode', 'grid');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [importText, setImportText] = useState('');
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredProducts = useMemo(() => {
    return state.products
      .filter(p => {
        const matchesSearch =
          (p.code || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (p.name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
        
        const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
        const matchesType = filterType === 'ALL' || p.group === filterType;

        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        if (sortConfig.key === 'code') {
          return sortConfig.direction === 'asc'
            ? (a.code || '').localeCompare(b.code || '')
            : (b.code || '').localeCompare(a.code || '');
        } else if (sortConfig.key === 'name') {
          return sortConfig.direction === 'asc'
            ? (a.name || '').localeCompare(b.name || '')
            : (b.name || '').localeCompare(a.name || '');
        } else {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }
      });
  }, [state.products, debouncedSearchTerm, filterStatus, filterType, sortConfig]);

  const availableGroups = useMemo(() => {
    const groups = new Set(state.products.map(p => p.group).filter(Boolean));
    return Array.from(groups).sort();
  }, [state.products]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const productData = {
      code: (formData.get('code') as string).toUpperCase(),
      name: formData.get('name') as string,
      group: formData.get('group') as string,
      registrationNo: formData.get('registrationNo') as string,
      registrationDate: formData.get('registrationDate') as string,
      registrant: formData.get('registrant') as string,
      status: formData.get('status') as any,
      description: formData.get('description') as string,
    };

    if (!productData.code || !productData.name || !productData.group || !productData.registrant) {
      notify({ type: 'WARNING', message: 'Vui lòng điền đầy đủ thông tin bắt buộc!' });
      return;
    }

    const isDuplicate = state.products.some(p => 
      p.code === productData.code && (!selectedProduct || p.id !== selectedProduct.id)
    );
    if (isDuplicate) {
      notify({ type: 'WARNING', message: `Mã sản phẩm "${productData.code}" đã tồn tại!` });
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedProduct) {
        await updateProduct({
          id: selectedProduct.id,
          ...productData,
          createdAt: selectedProduct.createdAt,
          updatedAt: new Date().toISOString(),
        });
        
        logAuditAction({
          action: AuditAction.UPDATE,
          collection: 'PRODUCTS',
          documentId: selectedProduct.id,
          details: `Cập nhật sản phẩm: ${productData.name} (${productData.code})`,
          performedBy: user?.email || 'unknown',
        });
        
        notify({ type: 'SUCCESS', message: 'Cập nhật sản phẩm thành công!' });
      } else {
        await addProduct({
          id: generateId('product'),
          ...productData,
          createdAt: new Date().toISOString(),
        });

        logAuditAction({
          action: AuditAction.CREATE,
          collection: 'PRODUCTS',
          details: `Tạo sản phẩm mới: ${productData.name} (${productData.code})`,
          performedBy: user?.email || 'unknown',
        });

        notify({ type: 'SUCCESS', message: 'Tạo sản phẩm mới thành công!' });
      }

      closeModal();
    } catch (error) {
      console.error("Lỗi khi cập nhật sản phẩm:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    
    setIsSubmitting(true);
    try {
      await deleteProduct(selectedProduct.id);
      
      try {
        logAuditAction({
          action: AuditAction.DELETE,
          collection: 'PRODUCTS',
          documentId: selectedProduct.id,
          details: `Xóa sản phẩm: ${selectedProduct.name} (${selectedProduct.code})`,
          performedBy: user?.email || 'unknown',
        });
      } catch (logErr) {
        console.warn("Ghi log thất bại:", logErr);
      }
      
      notify({ type: 'SUCCESS', message: 'Đã xóa sản phẩm!' });
      setIsDeleteModalOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error("Failed to delete product:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: any) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const openDeleteModal = (product: any) => {
    setSelectedProduct(product);
    setIsDeleteModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    
    const lines = importText.trim().split('\n');
    let count = 0;
    const errors: string[] = [];
    
    setIsSubmitting(true);
    try {
      for (const line of lines) {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        const code = parts[0]?.trim().toUpperCase();
        const name = parts[1]?.trim();
        
        if (!code || !name) continue;

        const isDuplicate = state.products.some(p => p.code === code);
        if (isDuplicate) {
          errors.push(`Mã "${code}" đã tồn tại`);
          continue;
        }

        await addProduct({
          id: generateId('product'),
          code,
          name,
          group: parts[2]?.trim() || 'Khác',
          registrationNo: parts[3]?.trim() || '',
          registrationDate: parts[4]?.trim() || '',
          registrant: parts[5]?.trim() || '',
          status: 'ACTIVE',
          description: '',
          createdAt: new Date().toISOString(),
        });
        count++;
      }

      logAuditAction({
        action: AuditAction.IMPORT,
        collection: 'PRODUCTS',
        details: `Nhập khẩu ${count} sản phẩm`,
        performedBy: user?.email || 'unknown',
      });

      notify({ type: 'SUCCESS', message: `Đã nhập ${count} sản phẩm!` });
      setIsImportModalOpen(false);
      setImportText('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'DISCONTINUED': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'RECALLED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Danh mục Sản phẩm" 
        subtitle="Quản lý thông tin sản phẩm, đăng ký và tiêu chuẩn."
        icon={Package}
        action={
          <div className="flex gap-3">
             <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-black uppercase text-[10px] transition-all shadow-sm"
            >
              <Upload size={16} /> Nhập Excel
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#009639] text-white rounded-xl hover:bg-[#007a2f] font-black uppercase text-[10px] transition-all shadow-lg shadow-green-200"
            >
              <Plus size={16} /> Thêm Sản phẩm
            </button>
          </div>
        }
      />

      <DSFilterBar>
        <DSSearchInput
          placeholder="Tìm kiếm..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <DSSelect icon={Filter} value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-40">
           <option value="ALL">Tất cả nhóm</option>
           {availableGroups.map(g => (
             <option key={g} value={g}>{g}</option>
           ))}
        </DSSelect>
        <DSSelect icon={AlertCircle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-40">
           <option value="ALL">Tất cả trạng thái</option>
           <option value="ACTIVE">Hoạt động</option>
           <option value="DISCONTINUED">Ngừng SX</option>
           <option value="RECALLED">Thu hồi</option>
        </DSSelect>
        <DSSelect icon={ArrowUpDown} value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => {
            const [key, direction] = e.target.value.split('-');
            setSortConfig({ key: key as any, direction: direction as any });
          }} className="w-40">
           <option value="createdAt-desc">Mới nhất</option>
           <option value="createdAt-asc">Cũ nhất</option>
           <option value="code-asc">Mã (A-Z)</option>
           <option value="code-desc">Mã (Z-A)</option>
           <option value="name-asc">Tên (A-Z)</option>
           <option value="name-desc">Tên (Z-A)</option>
        </DSSelect>
        <DSViewToggle viewMode={viewMode} setViewMode={setViewMode} gridIcon={LayoutGrid} listIcon={List} />
      </DSFilterBar>

      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p className="font-bold">Không tìm thấy sản phẩm nào</p>
          <p className="text-sm mt-1">Thử điều chỉnh bộ lọc hoặc thêm sản phẩm mới</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <DSCard key={product.id} className="p-6 relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => openEditModal(product)}
                  className="p-2 bg-white rounded-lg shadow border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Sửa"
                >
                  <Edit2 size={14} />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => openDeleteModal(product)}
                    className="p-2 bg-white rounded-lg shadow border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-red-600 transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              
              <div className="flex items-start gap-3 mb-4">
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                  <Package size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-sm uppercase truncate">{product.code}</p>
                  <p className="font-bold text-slate-600 text-xs truncate">{product.name}</p>
                </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Nhóm:</span>
                  <span className="text-slate-600 font-bold truncate ml-2">{product.group}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">ĐK:</span>
                  <span className="text-slate-600 font-bold truncate ml-2">{product.registrationNo || '---'}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-slate-400 font-medium">Trạng thái:</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(product.status)}`}>
                    {product.status === 'ACTIVE' ? 'Hoạt động' : product.status === 'DISCONTINUED' ? 'Ngừng SX' : 'Thu hồi'}
                  </span>
                </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                <Link
                  to={`/products/${product.id}`}
                  className="flex-1 text-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-lg transition-colors"
                >
                  Chi tiết
                </Link>
                <Link
                  to={`/tccs?productId=${product.id}`}
                  className="flex-1 text-center py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-lg transition-colors"
                >
                  TCCS
                </Link>
              </div>
            </DSCard>
          ))}
        </div>
      ) : (
        <DSTable>
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <th className="px-4 py-3 text-left">Mã SP</th>
              <th className="px-4 py-3 text-left">Tên sản phẩm</th>
              <th className="px-4 py-3 text-left">Nhóm</th>
              <th className="px-4 py-3 text-left">Số ĐK</th>
              <th className="px-4 py-3 text-left">Đơn vị ĐK</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-3">
                  <span className="font-black text-slate-800 text-sm">{product.code}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-700">{product.name}</div>
                  <div className="text-[10px] text-slate-400">{product.group}</div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 font-medium">{product.group}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{product.registrationNo || '---'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{product.registrant}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${getStatusColor(product.status)}`}>
                    {product.status === 'ACTIVE' ? 'Hoạt động' : product.status === 'DISCONTINUED' ? 'Ngừng SX' : 'Thu hồi'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/products/${product.id}`}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Chi tiết"
                    >
                      <Info size={16} />
                    </Link>
                    <button
                      onClick={() => openEditModal(product)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Sửa"
                    >
                      <Edit2 size={16} />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => openDeleteModal(product)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DSTable>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={selectedProduct ? 'Cập nhật Sản phẩm' : 'Thêm Sản phẩm mới'} icon={selectedProduct ? Edit2 : Plus}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <DSFormInput label="Mã sản phẩm" name="code" placeholder="VB-XXX" defaultValue={selectedProduct?.code} required />
            <DSFormInput label="Nhóm hàng" name="group" placeholder="TPBS / Mỹ phẩm..." defaultValue={selectedProduct?.group} required />
          </div>
          
          <DSFormInput label="Tên sản phẩm" name="name" placeholder="Tên thương mại..." defaultValue={selectedProduct?.name} required />
          
          <div className="grid grid-cols-2 gap-4">
            <DSFormInput label="Số đăng ký" name="registrationNo" placeholder="VN-..." defaultValue={selectedProduct?.registrationNo} />
            <DSFormInput label="Ngày đăng ký" name="registrationDate" type="date" defaultValue={selectedProduct?.registrationDate} />
          </div>
          
          <DSFormInput label="Đơn vị đăng ký" name="registrant" placeholder="Công ty..." defaultValue={selectedProduct?.registrant} required />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Trạng thái</label>
              <select name="status" defaultValue={selectedProduct?.status || 'ACTIVE'} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="ACTIVE">Hoạt động</option>
                <option value="DISCONTINUED">Ngừng sản xuất</option>
                <option value="RECALLED">Thu hồi</option>
              </select>
            </div>

          <DSFormInput label="Mô tả" name="description" placeholder="Mô tả chi tiết..." defaultValue={selectedProduct?.description} />

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={closeModal} className="px-6 py-3 text-slate-400 font-black uppercase text-xs">
              Hủy
            </button>
            <button type="submit" disabled={isSubmitting} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs disabled:opacity-70 flex items-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {selectedProduct ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Xác nhận xóa sản phẩm"
        message={
          <div>
            <p>Bạn có chắc chắn muốn xóa sản phẩm <strong className="text-red-600">{selectedProduct?.name}</strong> ({selectedProduct?.code})?</p>
            <p className="text-red-500 text-xs mt-2">Cảnh báo: Tất cả dữ liệu liên quan (TCCS, Lô, Kết quả kiểm nghiệm...) cũng sẽ bị xóa. Hành động này không thể hoàn tác.</p>
          </div>
        }
        confirmText="Xóa"
        icon={Trash2}
      />

      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Nhập dữ liệu hàng loạt" icon={FileSpreadsheet}>
        <div className="space-y-6">
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <h4 className="text-indigo-700 font-bold text-xs mb-2">Hướng dẫn:</h4>
            <p className="text-xs text-indigo-600">Mỗi dòng có format: Mã, Tên, Nhóm, Số ĐK, Ngày ĐK, Đơn vị ĐK</p>
            <p className="text-xs text-indigo-600 mt-1">Ví dụ: VB-001, Paracetamol 500mg, TPBS, VN-12345, 2024-01-01, Công ty A</p>
          </div>
          
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={8}
            className="w-full p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl font-mono text-xs focus:ring-4 focus:ring-indigo-50 outline-none"
            placeholder="Dán dữ liệu Excel vào đây..."
          />

          <div className="flex justify-end gap-3">
            <button onClick={() => setIsImportModalOpen(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-xs">
              Hủy
            </button>
            <button onClick={handleImport} disabled={!importText.trim() || isSubmitting} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs disabled:opacity-50 flex items-center gap-2">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Nhập
            </button>
          </div>
      </Modal>
    </div>
  );
};

export default ProductList;
