
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Warehouse, LogIn, ShoppingCart, Search, Hash, ArrowUpRight, ArrowDownLeft, Boxes } from 'lucide-react';
import { InventoryIn, InventoryOut, Batch } from '../types';
import { PageHeader, StatusBadge, Modal } from '../components/CommonUI';

const InventoryManagement: React.FC = () => {
  const { state, stockMap, addInventoryIn, addInventoryOut } = useAppContext();
  const [activeTab, setActiveTab] = useState<'stock' | 'in' | 'out'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalInOpen, setIsModalInOpen] = useState(false);
  const [isModalOutOpen, setIsModalOutOpen] = useState(false);

  const stockSummary = useMemo(() => {
    return state.batches.map(batch => {
      const product = state.products.find(p => p.id === batch.productId);
      const stock = stockMap.get(batch.id) || { totalIn: 0, totalOut: 0, currentStock: 0 };
      return { ...batch, productName: product?.name || 'Unknown', totalIn: stock.totalIn, totalOut: stock.totalOut, currentStock: stock.currentStock };
    }).filter(s => s.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) || s.productName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.currentStock - a.currentStock);
  }, [state.batches, state.products, stockMap, searchTerm]);

  const handleSaveIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addInventoryIn({ 
      id: crypto.randomUUID(), batchId: formData.get('batchId') as string, 
      quantity: parseFloat(formData.get('quantity') as string), 
      inDate: formData.get('inDate') as string, note: formData.get('note') as string, 
      createdAt: new Date().toISOString() 
    });
    setIsModalInOpen(false);
  };

  const handleSaveOut = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addInventoryOut({ 
      id: crypto.randomUUID(), batchId: formData.get('batchId') as string, 
      quantity: parseFloat(formData.get('quantity') as string), 
      outDate: formData.get('outDate') as string, receiver: formData.get('receiver') as string, 
      createdAt: new Date().toISOString() 
    });
    setIsModalOutOpen(false);
  };

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Quản lý Kho thành phẩm" 
        subtitle="Quản lý kho vận V-Biotech." 
        icon={Warehouse}
        action={
          <>
            <button onClick={() => setIsModalInOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-[#009639] text-white rounded-2xl font-black uppercase text-[10px] shadow-lg"> <LogIn size={16} /> Nhập kho </button>
            <button onClick={() => setIsModalOutOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg"> <ShoppingCart size={16} /> Xuất kho </button>
          </>
        }
      />

      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
         <div className="flex p-1.5 bg-emerald-50 rounded-3xl w-fit">
            {[ { id: 'stock', label: 'Tồn kho', icon: Boxes }, { id: 'in', label: 'Lịch sử Nhập', icon: ArrowDownLeft }, { id: 'out', label: 'Lịch sử Xuất', icon: ArrowUpRight } ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-[#009639] shadow-sm' : 'text-slate-400'}`}>
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
         </div>
         <div className="relative w-full md:w-96">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-300" size={18} />
            <input type="text" placeholder="Tìm số lô..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3 bg-white border border-emerald-50 rounded-2xl font-black outline-none" />
         </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-emerald-50 shadow-sm overflow-hidden p-8">
        {activeTab === 'stock' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {stockSummary.map(item => (
              <div key={item.id} className="bg-emerald-50/20 p-6 rounded-[2rem] border border-emerald-50 hover:shadow-xl transition-all">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white rounded-2xl text-[#009639] shadow-sm"><Hash size={20}/></div>
                    <StatusBadge type="BATCH" status={item.status} />
                 </div>
                 <h4 className="font-black text-slate-800 uppercase text-base">Lô: {item.batchNo}</h4>
                 <p className="text-[10px] font-black text-emerald-600/60 uppercase mb-4 truncate">{item.productName}</p>
                 <div className="flex justify-between items-end border-t border-emerald-100 pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Hiện tồn</p>
                    <div className="text-2xl font-black text-[#009639]">{item.currentStock} <span className="text-[10px] text-emerald-300">{item.yieldUnit}</span></div>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isModalInOpen} onClose={() => setIsModalInOpen(false)} title="Nhập kho hệ thống" icon={LogIn}>
        <form onSubmit={handleSaveIn} className="space-y-4">
          <select name="batchId" required className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold">
            <option value="">-- CHỌN LÔ --</option>
            {state.batches.filter(b => b.status !== 'REJECTED').map(b => <option key={b.id} value={b.id}>{b.batchNo}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-4">
            <input type="date" name="inDate" required defaultValue={new Date().toISOString().split('T')[0]} className="px-4 py-3 bg-slate-50 border rounded-xl" />
            <input type="number" name="quantity" required placeholder="Số lượng" className="px-4 py-3 bg-slate-50 border rounded-xl text-[#009639] font-black" />
          </div>
          <button type="submit" className="w-full py-4 bg-[#009639] text-white rounded-xl font-black uppercase text-xs">Xác nhận nhập</button>
        </form>
      </Modal>

      <Modal isOpen={isModalOutOpen} onClose={() => setIsModalOutOpen(false)} title="Lệnh xuất kho" icon={ShoppingCart} color="bg-slate-800">
        <form onSubmit={handleSaveOut} className="space-y-4">
          <select name="batchId" required className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold">
            <option value="">-- CHỌN LÔ --</option>
            {state.batches.filter(b => b.status === 'RELEASED').map(b => <option key={b.id} value={b.id}>{b.batchNo}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-4">
            <input type="date" name="outDate" required defaultValue={new Date().toISOString().split('T')[0]} className="px-4 py-3 bg-slate-50 border rounded-xl" />
            <input type="number" name="quantity" required placeholder="Số lượng" className="px-4 py-3 bg-slate-50 border rounded-xl font-black" />
          </div>
          <input name="receiver" placeholder="Người nhận" className="w-full px-4 py-3 bg-slate-50 border rounded-xl" />
          <button type="submit" className="w-full py-4 bg-slate-800 text-white rounded-xl font-black uppercase text-xs">Xác nhận xuất</button>
        </form>
      </Modal>
    </div>
  );
};

export default InventoryManagement;
