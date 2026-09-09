import React, { useState, useMemo } from 'react';
import { 
  XMarkIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  ArrowRightIcon, 
  SparklesIcon 
} from '@heroicons/react/24/outline';

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-ink text-sm uppercase tracking-wider">Xác nhận Ánh xạ Chỉ tiêu</h2>
              <p className="text-[11px] text-ink-muted font-medium mt-0.5">
                AI trích xuất <b>{highConfidenceItems.length + lowConfidenceItems.length}</b> chỉ tiêu · 
                <span className="text-emerald-600 dark:text-emerald-400 font-bold"> {highConfidenceItems.length} tự động</span> · 
                <span className="text-amber-600 dark:text-amber-400 font-bold"> {lowConfidenceItems.length} cần xác nhận</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-ink-muted hover:text-ink hover:bg-surface-3 rounded-xl transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* High confidence items — chỉ hiển thị tóm tắt */}
          {highConfidenceItems.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                <CheckCircleIcon className="w-4 h-4" /> AI tự động điền ({highConfidenceItems.length} chỉ tiêu)
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {highConfidenceItems.map(item => (
                  <div key={item.criteriaName} className="flex items-center gap-2 text-xs">
                    <span className="text-ink-muted truncate flex-1">"{item.criteriaName}"</span>
                    <ArrowRightIcon className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 truncate flex-1">{item.mappedName}</span>
                    <span className="font-black text-ink font-mono bg-surface px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low confidence items — cần user xác nhận */}
          {lowConfidenceItems.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <ExclamationCircleIcon className="w-4 h-4" /> Cần xác nhận ({lowConfidenceItems.length} chỉ tiêu)
              </p>
              {lowConfidenceItems.map(item => (
                <div key={item.criteriaName} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">AI đọc được từ phiếu</p>
                      <p className="text-xs font-bold text-ink mt-0.5 truncate">"{item.criteriaName}"</p>
                      <p className="text-[10px] text-ink-muted mt-0.5">Kết quả: <span className="font-black text-ink">{item.value} {item.unit}</span></p>
                    </div>
                    <ArrowRightIcon className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-1">Ghép với chỉ tiêu TCCS</p>
                      <select
                        value={userMappings[item.criteriaName] || ''}
                        onChange={e => setUserMappings(prev => ({ ...prev, [item.criteriaName]: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-emerald-500"
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
            <div className="text-center py-8 text-ink-muted">
              <ExclamationCircleIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold">AI không đọc được chỉ tiêu nào.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-2 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={rememberMappings}
              onChange={e => setRememberMappings(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 cursor-pointer rounded"
            />
            <div>
              <p className="text-xs font-bold text-ink group-hover:text-emerald-600 transition-colors">
                Nhớ các lựa chọn này cho lần sau
              </p>
              <p className="text-[10px] text-ink-muted">AI sẽ tự động map tên tương tự trong tương lai</p>
            </div>
          </label>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-ink-muted font-black uppercase text-[10px] tracking-widest hover:bg-surface-3 rounded-xl transition-colors border border-border"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="w-4 h-4" />
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
