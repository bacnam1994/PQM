import React, { useState, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, ArrowRight, Brain } from 'lucide-react';

export interface AIExtractedItem {
  criteriaName: string;   // Tên gốc từ phiếu
  mappedName: string;     // Tên AI đã map (có thể rỗng)
  confidence: string;     // "high" | "low"
  value: string;
  unit?: string;
  limit?: string;
}

export interface ConfirmedMapping {
  originalName: string;   // Tên gốc từ phiếu
  systemName: string;     // Tên chuẩn trong TCCS
  value: string;
  unit?: string;
  limit?: string;
}

interface MappingConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Các item AI đã map HIGH confidence (điền thẳng, không cần confirm)
  highConfidenceItems: AIExtractedItem[];
  // Các item AI KHÔNG map được hoặc low confidence (cần user ghép)
  lowConfidenceItems: AIExtractedItem[];
  // Danh sách tên chỉ tiêu chuẩn từ TCCS để hiện trong dropdown
  tccsNames: string[];
  // Callback khi user xác nhận xong
  onConfirm: (confirmedMappings: ConfirmedMapping[], rememberMappings: boolean) => void;
}

export const MappingConfirmModal: React.FC<MappingConfirmModalProps> = ({
  isOpen,
  onClose,
  highConfidenceItems,
  lowConfidenceItems,
  tccsNames,
  onConfirm,
}) => {
  // State: user ghép tên cho các item low confidence
  // key = criteriaName gốc, value = tên TCCS đã chọn (hoặc '' nếu bỏ qua)
  const [userMappings, setUserMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    lowConfidenceItems.forEach(item => {
      initial[item.criteriaName] = item.mappedName || '';
    });
    return initial;
  });
  const [rememberMappings, setRememberMappings] = useState(true);

  // Reset state khi danh sách thay đổi
  React.useEffect(() => {
    const initial: Record<string, string> = {};
    lowConfidenceItems.forEach(item => {
      initial[item.criteriaName] = item.mappedName || '';
    });
    setUserMappings(initial);
  }, [lowConfidenceItems]);

  const handleConfirm = () => {
    const confirmed: ConfirmedMapping[] = [];

    // Thêm các item high confidence (AI đã map chắc chắn)
    highConfidenceItems.forEach(item => {
      confirmed.push({
        originalName: item.criteriaName,
        systemName: item.mappedName,
        value: item.value,
        unit: item.unit,
        limit: item.limit,
      });
    });

    // Thêm các item low confidence mà user đã chọn
    lowConfidenceItems.forEach(item => {
      const chosen = userMappings[item.criteriaName];
      if (chosen) {
        confirmed.push({
          originalName: item.criteriaName,
          systemName: chosen,
          value: item.value,
          unit: item.unit,
          limit: item.limit,
        });
      }
    });

    onConfirm(confirmed, rememberMappings);
  };

  const confirmedCount = useMemo(() => {
    return Object.values(userMappings).filter(v => v).length;
  }, [userMappings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Brain size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider">Xác nhận Ánh xạ Chỉ tiêu</h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                AI đọc được <b>{highConfidenceItems.length + lowConfidenceItems.length}</b> chỉ tiêu · 
                <span className="text-emerald-600"> {highConfidenceItems.length} tự động</span> · 
                <span className="text-amber-600"> {lowConfidenceItems.length} cần xác nhận</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* High confidence items — chỉ hiển thị tóm tắt */}
          {highConfidenceItems.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                <CheckCircle2 size={13} /> AI tự động điền ({highConfidenceItems.length} chỉ tiêu)
              </p>
              <div className="grid grid-cols-1 gap-1">
                {highConfidenceItems.map(item => (
                  <div key={item.criteriaName} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 truncate flex-1">"{item.criteriaName}"</span>
                    <ArrowRight size={12} className="text-emerald-400 shrink-0" />
                    <span className="font-bold text-emerald-700 truncate flex-1">{item.mappedName}</span>
                    <span className="font-black text-slate-700 font-mono bg-white px-2 py-0.5 rounded border border-emerald-100 shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low confidence items — cần user xác nhận */}
          {lowConfidenceItems.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                <AlertCircle size={13} /> Cần xác nhận ({lowConfidenceItems.length} chỉ tiêu)
              </p>
              {lowConfidenceItems.map(item => (
                <div key={item.criteriaName} className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI đọc được từ phiếu</p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5 truncate">"{item.criteriaName}"</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Kết quả: <span className="font-black text-slate-700">{item.value} {item.unit}</span></p>
                    </div>
                    <ArrowRight size={16} className="text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ghép với chỉ tiêu TCCS</p>
                      <select
                        value={userMappings[item.criteriaName] || ''}
                        onChange={e => setUserMappings(prev => ({ ...prev, [item.criteriaName]: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="">-- Bỏ qua chỉ tiêu này --</option>
                        {tccsNames.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trường hợp không có gì để xác nhận */}
          {lowConfidenceItems.length === 0 && highConfidenceItems.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold">AI không đọc được chỉ tiêu nào.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={rememberMappings}
              onChange={e => setRememberMappings(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 cursor-pointer"
            />
            <div>
              <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                Nhớ các lựa chọn này cho lần sau
              </p>
              <p className="text-[10px] text-slate-400">AI sẽ tự động map tên tương tự trong tương lai</p>
            </div>
          </label>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-xl transition-colors border border-slate-200"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} />
              Xác nhận &amp; Điền form
              {confirmedCount + highConfidenceItems.length > 0 && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px]">
                  {confirmedCount + highConfidenceItems.length} chỉ tiêu
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MappingConfirmModal;
