
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { GitBranch, AlertTriangle, User, Cpu, Box, Settings, Thermometer, Ruler, FileText, ChevronRight, Hash } from 'lucide-react';
import { TestResult, Batch } from '../types';

const FishboneAnalysis: React.FC = () => {
  const { state } = useAppContext();
  const [searchParams] = useSearchParams();
  const [selectedResultId, setSelectedResultId] = useState<string>('');

  // Tự động chọn lô nếu có ID từ URL
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setSelectedResultId(idFromUrl);
    }
  }, [searchParams]);

  const failResults = useMemo(() => 
    state.testResults.filter(r => r.overallStatus === 'FAIL'), 
    [state.testResults]
  );

  const selectedResult = useMemo(() => 
    state.testResults.find(r => r.id === selectedResultId),
    [state.testResults, selectedResultId]
  );

  const selectedBatch = useMemo(() => 
    state.batches.find(b => b.id === selectedResult?.batchId),
    [state.batches, selectedResult]
  );

  const product = useMemo(() => 
    state.products.find(p => p.id === selectedBatch?.productId),
    [state.products, selectedBatch]
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase flex items-center gap-3">
            <GitBranch className="text-indigo-600 w-7 h-7" /> Truy xuất Xương cá (6M)
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-2">Phân tích nguyên nhân gốc rễ (Root Cause Analysis) dành cho lô không đạt.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
           <AlertTriangle size={18} className="text-amber-500" />
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hiện có {failResults.length} lô cần điều tra</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-50 shadow-sm flex flex-col md:flex-row gap-6 items-center border-b-4 border-b-indigo-50">
        <div className="flex-1 w-full space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4 flex items-center gap-2">
            <Hash size={14} className="text-indigo-300"/> Lô hàng cần phân tích
          </label>
          <select 
            value={selectedResultId}
            onChange={(e) => setSelectedResultId(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-4 focus:ring-indigo-50 outline-none font-black text-slate-700 transition-all appearance-none cursor-pointer shadow-inner text-sm"
          >
            <option value="">-- CHỌN LÔ HÀNG KHÔNG ĐẠT TRONG DANH SÁCH --</option>
            {failResults.map(r => {
              const b = state.batches.find(batch => batch.id === r.batchId);
              const p = state.products.find(prod => prod.id === b?.productId);
              return (
                <option key={r.id} value={r.id}>
                  Lô: {b?.batchNo || '---'} | {p?.name || '---'}
                </option>
              );
            })}
            {selectedResult && selectedResult.overallStatus !== 'FAIL' && (
               <option value={selectedResult.id}>
                 Lô: {selectedBatch?.batchNo || '---'} | {product?.name} (Lô Đạt - Xem lại)
               </option>
            )}
          </select>
        </div>
        
        {selectedResult && (
           <div className="flex gap-4">
              <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ngày kiểm</p>
                 <p className="text-xs font-black text-slate-700">{new Date(selectedResult.testDate).toLocaleDateString('en-GB')}</p>
              </div>
              <div className="bg-indigo-50 px-4 py-3 rounded-xl border border-indigo-100">
                 <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Căn cứ TCCS</p>
                 <p className="text-xs font-black text-indigo-600">{state.tccsList.find(t => t.id === selectedBatch?.tccsId)?.code || 'N/A'}</p>
              </div>
           </div>
        )}
      </div>

      {selectedResult ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-50 shadow-2xl shadow-slate-100 overflow-x-auto hide-scrollbar border-t-8 border-t-red-500">
          <div className="min-w-[1000px] relative py-16 px-6">
            {/* The Spine */}
            <div className="absolute top-1/2 left-0 right-[25%] h-3 bg-slate-800 rounded-full -translate-y-1/2 shadow-lg" />
            
            {/* The Head (Problem) */}
            <div className="absolute top-1/2 right-0 w-[22%] p-6 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-2xl shadow-2xl shadow-red-200 -translate-y-1/2 flex flex-col items-center text-center ring-8 ring-red-50 animate-in zoom-in duration-500">
              <AlertTriangle className="mb-4 w-10 h-10" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Xác nhận sự cố</p>
              <h4 className="font-black text-2xl leading-none mt-2 tracking-tighter">LÔ {selectedBatch?.batchNo || '---'}</h4>
              <p className="text-xs font-bold uppercase mt-2 text-red-100">KHÔNG ĐẠT CHỈ TIÊU</p>
              <div className="mt-6 pt-4 border-t border-white/20 w-full">
                <p className="text-[10px] font-medium leading-relaxed italic opacity-90">"{product?.name}"</p>
              </div>
            </div>

            {/* The Bones (Causes 6M) */}
            <div className="grid grid-cols-3 gap-y-32">
              {/* Upper Bones */}
              <Bone title="CON NGƯỜI (Man)" icon={<User size={18}/>} content={selectedResult.fishbone?.man} position="top" color="text-blue-600" bgColor="bg-blue-50" borderColor="border-blue-100" />
              <Bone title="MÁY MÓC (Machine)" icon={<Cpu size={18}/>} content={selectedResult.fishbone?.machine} position="top" color="text-purple-600" bgColor="bg-purple-50" borderColor="border-purple-100" />
              <Bone title="VẬT TƯ (Material)" icon={<Box size={18}/>} content={selectedResult.fishbone?.material} position="top" color="text-emerald-600" bgColor="bg-emerald-50" borderColor="border-emerald-100" />
              
              {/* Lower Bones */}
              <Bone title="PHƯƠNG PHÁP (Method)" icon={<Settings size={18}/>} content={selectedResult.fishbone?.method} position="bottom" color="text-amber-600" bgColor="bg-amber-50" borderColor="border-amber-100" />
              <Bone title="ĐO LƯỜNG (Measurement)" icon={<Ruler size={18}/>} content={selectedResult.fishbone?.measurement} position="bottom" color="text-rose-600" bgColor="bg-rose-50" borderColor="border-rose-100" />
              <Bone title="MÔI TRƯỜNG (Environment)" icon={<Thermometer size={18}/>} content={selectedResult.fishbone?.environment} position="bottom" color="text-cyan-600" bgColor="bg-cyan-50" borderColor="border-cyan-100" />
            </div>
          </div>
          
          <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4 italic">
             <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600"><FileText size={24}/></div>
             <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú QA/QC</p>
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                   {selectedResult.notes || "Hiện tại chưa có ghi chú bổ sung cho lô hàng này. Việc phân tích nguyên nhân dựa trên dữ liệu hệ thống ghi nhận tại thời điểm phê duyệt FAIL lô hàng."}
                </p>
             </div>
          </div>
        </div>
      ) : (
        <div className="py-24 text-center text-slate-400 bg-white rounded-3xl border-4 border-dashed border-slate-50 flex flex-col items-center">
          <GitBranch size={80} className="mb-6 opacity-5 text-indigo-900" />
          <p className="text-xs font-black uppercase tracking-[0.3em] opacity-30">Chưa chọn lô hàng lỗi để truy xuất nguyên nhân</p>
          <p className="text-[11px] font-bold text-slate-300 mt-2">Vui lòng chọn lô hàng từ danh sách phía trên hoặc từ mục "Kiểm soát Lab"</p>
        </div>
      )}
    </div>
  );
};

const Bone: React.FC<{ 
  title: string; 
  icon: React.ReactNode; 
  content: string | undefined; 
  position: 'top' | 'bottom';
  color: string;
  bgColor: string;
  borderColor: string;
}> = ({ title, icon, content, position, color, bgColor, borderColor }) => (
  <div className={`relative flex flex-col ${position === 'top' ? 'items-start justify-end pb-12' : 'items-start pt-12'}`}>
    {/* Diagonal Line - Enhanced Visual */}
    <div className={`absolute left-0 w-1.5 h-24 bg-slate-200 rounded-full origin-center transition-all group-hover:bg-indigo-200 ${position === 'top' ? 'bottom-0 rotate-[40deg]' : 'top-0 rotate-[-40deg]'}`} />
    
    <div className={`w-full max-w-[240px] p-4 rounded-xl border-2 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 ${bgColor} ${borderColor} relative z-10 group`}>
      <div className={`flex items-center gap-2.5 mb-3 ${color}`}>
        <div className="p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest leading-none">{title}</span>
      </div>
      <p className="text-xs text-slate-700 font-bold leading-relaxed min-h-[60px]">
        {content || <span className="text-slate-300 italic font-medium">Không ghi nhận bất thường</span>}
      </p>
      
      {/* Decorative Arrow */}
      <div className={`absolute left-0 ${position === 'top' ? 'bottom-[-10px]' : 'top-[-10px]'} translate-x-[-15px] opacity-20`}>
         <ChevronRight className={position === 'top' ? 'rotate-[40deg]' : 'rotate-[-40deg]'} size={24} />
      </div>
    </div>
  </div>
);

export default FishboneAnalysis;
