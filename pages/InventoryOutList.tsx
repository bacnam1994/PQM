
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  ShoppingCart, Plus, Search, Calendar, Trash2, CheckCircle2,
  Hash, Scale, X, Filter, Truck, ArrowUpRight, History
} from 'lucide-react';
import { InventoryOut } from '../types';

const InventoryOutList: React.FC = () => {
  const { state, addInventoryOut, deleteInventoryOut } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);

  // Tối ưu hóa: Pre-calculate stock map
  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    state.inventoryIn.forEach(i => map.set(i.batchId, (map.get(i.batchId) || 0) + i.quantity));
    state.inventoryOut.forEach(o => map.set(o.batchId, (map.get(o.batchId) || 0) - o.quantity));
    return map;
  }, [state.inventoryIn, state.inventoryOut]);

  const filteredRecords = useMemo(() => {
    return state.inventoryOut.filter(record => {
      const batch = state.batches.find(b => b.id === record.batchId);
      const product = state.products.find(p => p.id === batch?.productId);
      
      const matchesSearch = batch?.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
             product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             record.receiver?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProduct = filterProductId === '' || batch?.productId === filterProductId;
      
      return matchesSearch && matchesProduct;
    }).sort((a, b) => new Date(b.outDate).getTime() - new Date(a.outDate).getTime());
  }, [state.inventoryOut, state.batches, state.products, searchTerm, filterProductId]);

  const handleSaveOut = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!selectedBatchId) {
      alert('Vui lòng chọn một lô hàng!');
      return;
    }
    const bid = selectedBatchId;
    const qty = parseFloat(formData.get('quantity') as string);
    const date = formData.get('outDate') as string;

    const currentStock = stockMap.get(bid) || 0;
    if (qty > currentStock) {
      alert(`Số lượng xuất (${qty.toLocaleString()}) vượt quá tồn kho thực tế (${currentStock.toLocaleString()})!`);
      return;
    }

    const newRecord: InventoryOut = {
      id: crypto.randomUUID(),
      batchId: bid,
      quantity: qty,
      outDate: date,
      receiver: formData.get('receiver') as string,
      note: formData.get('notes') as string,
      createdAt: new Date().toISOString(),
    };

    addInventoryOut(newRecord);
    setIsModalOpen(false);
    setSelectedBatchId('');
    setBatchSearch('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <ShoppingCart className="text-indigo-600" /> Quản lý Xuất kho
          </h1>
          <p className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mt-1">Lập lệnh xuất hàng và theo dõi lưu thông sản phẩm.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-black shadow-xl transition-all">
          <Plus size={20} /> <span>LẬP LỆNH XUẤT</span>
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Tìm theo số lô, khách hàng hoặc sản phẩm..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-slate-400 shrink-0" />
          <select 
            value={filterProductId}
            onChange={(e) => setFilterProductId(e.target.value)}
            className="w-full md:w-64 px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-all font-medium text-slate-700"
          >
            <option value="">Tất cả sản phẩm</option>
            {state.products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <th className="px-8 py-5">Ngày xuất</th>
                <th className="px-8 py-5">Sản phẩm / Lô</th>
                <th className="px-8 py-5">Người nhận</th>
                <th className="px-8 py-5 text-right">Số lượng</th>
                <th className="px-8 py-5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRecords.map(record => {
                const batch = state.batches.find(b => b.id === record.batchId);
                const product = state.products.find(p => p.id === batch?.productId);
                return (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="font-bold text-slate-700">{new Date(record.outDate).toLocaleDateString('en-GB')}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="font-black text-slate-800 text-sm truncate max-w-[200px]">{product?.name}</div>
                      <div className="flex items-center gap-1 text-[10px] font-black text-indigo-500 uppercase">
                        <Hash size={10} /> Lô: {batch?.batchNo}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 font-bold text-slate-600">
                        <Truck size={14} className="text-slate-400" />
                        {record.receiver || '---'}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="font-black text-indigo-600 text-base flex items-center justify-end gap-1">
                        {record.quantity} <span className="text-[10px] text-slate-400">{batch?.yieldUnit}</span>
                        <ArrowUpRight size={14} className="text-slate-300" />
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <button onClick={() => deleteInventoryOut(record.id)} className="p-2 text-slate-200 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <History size={48} className="mx-auto text-slate-200 mb-4 opacity-20" />
                    <p className="text-slate-300 font-black uppercase text-xs tracking-widest">Chưa có lịch sử xuất kho</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl my-auto animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-8 border-b flex items-center justify-between bg-slate-50">
               <div className="flex items-center gap-4">
                 <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-2xl shadow-indigo-100"><Truck size={28}/></div>
                 <h3 className="text-2xl font-black text-slate-800 tracking-tight">Lập lệnh Xuất kho</h3>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={32}/></button>
            </div>
            <form onSubmit={handleSaveOut} className="p-8 space-y-6">
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Chọn Lô hàng xuất *</label>
                 <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                     type="text"
                     value={batchSearch}
                     onChange={(e) => {
                       setBatchSearch(e.target.value);
                       setShowBatchDropdown(true);
                       if (!e.target.value) setSelectedBatchId('');
                     }}
                     onFocus={() => setShowBatchDropdown(true)}
                     onBlur={() => setTimeout(() => setShowBatchDropdown(false), 200)}
                     placeholder="Tìm kiếm Lô hàng còn tồn kho..."
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-indigo-500"
                   />
                   {selectedBatchId && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600" size={16} />}
                   
                   {showBatchDropdown && (
                     <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                       {state.batches.filter(b => b.status === 'RELEASED' && (stockMap.get(b.id) || 0) > 0 && (!batchSearch || b.batchNo.toLowerCase().includes(batchSearch.toLowerCase()) || state.products.find(p => p.id === b.productId)?.name.toLowerCase().includes(batchSearch.toLowerCase()))).map(b => {
                         const p = state.products.find(prod => prod.id === b.productId);
                         const stock = stockMap.get(b.id) || 0;
                         return (
                           <div 
                             key={b.id}
                             onClick={() => {
                               setSelectedBatchId(b.id);
                               setBatchSearch(`${b.batchNo} - ${p?.name}`);
                               setShowBatchDropdown(false);
                             }}
                             className={`px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors ${selectedBatchId === b.id ? 'bg-indigo-50' : ''}`}
                           >
                             <p className="text-sm font-bold text-slate-700 uppercase">Lô: {b.batchNo} ({p?.name})</p>
                             <p className="text-[10px] font-black text-indigo-500">Tồn kho: {stock.toLocaleString()} {b.yieldUnit}</p>
                           </div>
                         );
                       })}
                     </div>
                   )}
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Ngày xuất kho *</label>
                   <input type="date" name="outDate" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Số lượng xuất *</label>
                   <input type="number" name="quantity" required step="any" placeholder="0.00" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500 text-indigo-600" />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Đơn vị/Người nhận</label>
                 <input name="receiver" placeholder="Khách hàng, Đại lý, Nhà phân phối..." className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500" />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Ghi chú</label>
                 <textarea name="notes" rows={2} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
               </div>
               <div className="pt-6 flex justify-end gap-4">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-2xl">Hủy bỏ</button>
                 <button type="submit" className="px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase text-xs tracking-widest flex items-center gap-2">
                    XÁC NHẬN XUẤT <ArrowUpRight size={18}/>
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryOutList;
