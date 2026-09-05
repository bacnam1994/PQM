import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, CheckCircle2, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DSFormInput, DSDateInput } from '../../components';
import { BATCH_STATUS, generateId, parseDateToISO, normalizeSearch } from '../../utils';
import { Batch } from '../../types';

const BatchFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 1. Khởi tạo Hook & Bóc tách State
  const { batches, products, tccsList, addBatch, updateBatch, notify } = useAppStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchToEdit, setBatchToEdit] = useState<Batch | null>(null);
  
  // State cho Sub-component: Dropdown tìm kiếm Sản phẩm
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');

  // 2. Nạp dữ liệu khi ở chế độ Edit
  useEffect(() => {
    if (id) {
      const batch = batches.find(b => b.id === id);
      if (batch) {
        setBatchToEdit(batch);
        setSelectedProductId(batch.productId);
        const p = products.find(prod => prod.id === batch.productId);
        setProductSearch(p ? `${p.code} - ${p.name}` : '');
        setMfgDate(batch.mfgDate ? parseDateToISO(batch.mfgDate) : '');
        setExpDate(batch.expDate ? parseDateToISO(batch.expDate) : '');
      } else {
        notify({ type: 'ERROR', message: 'Không tìm thấy Lô hàng!' });
        navigate('/batches');
      }
    }
  }, [id, batches, products, navigate, notify]);

  // 3. Hàm xử lý lưu chung (Gom Add và Edit)
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProductId) {
      notify({ type: 'WARNING', message: 'Vui lòng chọn một sản phẩm!' });
      return;
    }
    
    const pid = selectedProductId;
    const availableTccs = tccsList.filter(t => t.productId === pid).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    if (availableTccs.length === 0) {
      return notify({ type: 'WARNING', title: 'Thiếu TCCS', message: 'Sản phẩm được chọn chưa có TCCS hiệu lực.' });
    }

    const formData = new FormData(e.currentTarget);
    let assignedTccs = availableTccs[0];
    if (mfgDate) {
      const mfgTime = new Date(mfgDate).getTime();
      const match = availableTccs.find(t => new Date(t.issueDate).getTime() <= mfgTime);
      assignedTccs = match || availableTccs[availableTccs.length - 1];
    }

    const batchNo = (formData.get('batchNo') as string).toUpperCase();

    // Kiểm tra trùng lặp
    if (batches.some(b => b.batchNo === batchNo && b.productId === pid && b.id !== id)) {
      return notify({ type: 'WARNING', title: 'Trùng lặp', message: `Số lô "${batchNo}" đã tồn tại cho sản phẩm này.` });
    }

    const theoreticalYield = parseFloat(formData.get('theoreticalYield') as string) || 0;
    const actualYield = parseFloat(formData.get('actualYield') as string) || 0;
    const yieldUnit = (formData.get('yieldUnit') as string) || '';
    const packaging = (formData.get('packaging') as string) || '';

    const batchData = {
        productId: pid, 
        tccsId: assignedTccs.id,
        batchNo: batchNo,
        mfgDate: mfgDate, 
        expDate: expDate,
        theoreticalYield,
        actualYield,
        yieldUnit,
        packaging,
    };

    setIsSubmitting(true);
    try {
      if (id && batchToEdit) {
        // logAuditAction được gọi trong store.updateBatch — không cần gọi lại ở đây
        await updateBatch({ ...batchToEdit, ...batchData, updatedAt: new Date().toISOString() });
        notify({ type: 'SUCCESS', title: 'Đã cập nhật', message: `Cập nhật thành công lô ${batchData.batchNo}` });
      } else {
        const newId = generateId('batch');
        // logAuditAction được gọi trong store.addBatch — không cần gọi lại ở đây
        await addBatch({ id: newId, ...batchData, status: BATCH_STATUS.PENDING, createdAt: new Date().toISOString() });
        notify({ type: 'SUCCESS', title: 'Thành công', message: `Đã tạo lô ${batchData.batchNo}` });
      }
      navigate('/batches');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="p-6 max-w-4xl mx-auto animate-in fade-in duration-500 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/batches')} className="p-2 bg-white text-slate-500 hover:text-indigo-600 rounded-xl shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          {id ? 'Chỉnh sửa Lô hàng' : 'Thêm Lô hàng mới'}
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {/* Đợi Load xong dữ liệu cũ rồi mới Render Form (Giúp defaultValue hoạt động chính xác) */}
        {(!id || batchToEdit) && (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Khối chọn Sản phẩm */}
            {id ? (
              <div className="relative">
                <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-500 flex justify-between items-center">
                   <span>{productSearch}</span>
                   <span className="text-[10px] uppercase bg-slate-200 px-2 py-1 rounded text-slate-500">Không thể đổi SP</span>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductDropdown(true);
                    if (!e.target.value) setSelectedProductId('');
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  placeholder="Tìm kiếm sản phẩm..."
                  className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none shadow-sm text-sm focus:ring-2 focus:ring-indigo-500"
                />
                
                {selectedProductId ? (
                  <button type="button" onClick={() => { setSelectedProductId(''); setProductSearch(''); setShowProductDropdown(true); }} className="absolute right-4 top-1/2 -translate-y-1/2 group transition-colors" title="Hủy chọn">
                    <CheckCircle2 size={16} className="text-emerald-600 group-hover:hidden" />
                    <X size={16} className="text-red-500 hidden group-hover:block" />
                  </button>
                ) : productSearch ? (
                  <button type="button" onClick={() => { setProductSearch(''); setSelectedProductId(''); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" title="Xóa">
                    <X size={16} />
                  </button>
                ) : null}
                
                {showProductDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                    {products.filter(p => !productSearch || normalizeSearch(p.name).includes(normalizeSearch(productSearch)) || normalizeSearch(p.code).includes(normalizeSearch(productSearch))).map(p => (
                      <div 
                        key={p.id}
                        onMouseDown={(e) => e.preventDefault()} // Ngăn sự kiện onBlur chạy trước onClick
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setProductSearch(`${p.code} - ${p.name}`);
                          setShowProductDropdown(false);
                        }}
                        className={`px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors ${selectedProductId === p.id ? 'bg-indigo-50' : ''}`}
                      >
                        <p className="text-sm font-bold text-slate-700">{p.name}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase">{p.code}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Thông tin cơ bản */}
            <DSFormInput label="Số Lô *" name="batchNo" defaultValue={batchToEdit?.batchNo} required className="uppercase" />
            
            <div className="grid grid-cols-2 gap-4">
              <DSDateInput label="Ngày SX *" value={mfgDate} onChange={setMfgDate} required />
              <DSDateInput label="Hạn dùng *" value={expDate} onChange={setExpDate} required />
            </div>

            {/* Sản lượng */}
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Thông tin Sản lượng</p>
              <div className="grid grid-cols-3 gap-4">
                <DSFormInput
                  label="Sản lượng lý thuyết"
                  name="theoreticalYield"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={batchToEdit?.theoreticalYield || ''}
                  placeholder="VD: 10000"
                />
                <DSFormInput
                  label="Sản lượng thực tế"
                  name="actualYield"
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={batchToEdit?.actualYield || ''}
                  placeholder="VD: 9800"
                />
                <DSFormInput
                  label="Đơn vị"
                  name="yieldUnit"
                  defaultValue={batchToEdit?.yieldUnit || ''}
                  placeholder="VD: viên, gói, chai..."
                />
              </div>
            </div>

            {/* Quy cách đóng gói */}
            <DSFormInput
              label="Quy cách đóng gói"
              name="packaging"
              defaultValue={batchToEdit?.packaging || ''}
              placeholder="VD: Hộp 10 vỉ × 10 viên"
            />

            <div className="flex justify-end gap-3 pt-6 border-t mt-6">
              <button type="button" onClick={() => navigate('/batches')} className="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl transition-colors">Hủy & Quay lại</button>
              <button type="submit" disabled={isSubmitting} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {id ? 'Cập nhật Lô hàng' : 'Đăng ký Lô mới'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BatchFormPage;