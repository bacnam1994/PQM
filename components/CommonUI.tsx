
import React from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Tag, ShieldCheck, Clock, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { BATCH_STATUS, PRODUCT_STATUS, TEST_RESULT_STATUS } from '../utils/constants';

// --- BỘ NHẬN DIỆN TRẠNG THÁI DÙNG CHUNG ---
export const StatusBadge: React.FC<{ type: string; status: string }> = ({ type, status }) => {
  const configs: Record<string, any> = {
    PRODUCT: {
      [PRODUCT_STATUS.ACTIVE]: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: Tag, label: 'Đang công bố' },
      [PRODUCT_STATUS.DISCONTINUED]: { bg: 'bg-amber-50', text: 'text-amber-700', icon: AlertCircle, label: 'Ngừng SX' },
      [PRODUCT_STATUS.RECALLED]: { bg: 'bg-red-50', text: 'text-red-700', icon: X, label: 'Thu hồi' },
    },
    BATCH: {
      [BATCH_STATUS.PENDING]: { bg: 'bg-slate-100', text: 'text-slate-600', icon: Clock, label: 'Kế hoạch' },
      [BATCH_STATUS.TESTING]: { bg: 'bg-blue-600', text: 'text-white', icon: Loader2, label: 'Đang kiểm', spin: true },
      [BATCH_STATUS.RELEASED]: { bg: 'bg-[#009639]', text: 'text-white', icon: ShieldCheck, label: 'Phê duyệt' },
      [BATCH_STATUS.REJECTED]: { bg: 'bg-red-500', text: 'text-white', icon: X, label: 'Loại bỏ' },
    },
    RESULT: {
      [TEST_RESULT_STATUS.PASS]: { bg: 'bg-emerald-500', text: 'text-white', label: 'ĐẠT (PASS)' },
      [TEST_RESULT_STATUS.FAIL]: { bg: 'bg-red-500', text: 'text-white', label: 'LỖI (FAIL)' },
    }
  };

  const config = configs[type]?.[status] || { bg: 'bg-slate-100', text: 'text-slate-400', icon: HelpCircle, label: status };
  const Icon = config.icon;

  return (
    <span className={`${config.bg} ${config.text} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit whitespace-nowrap`}>
      {Icon && <Icon size={12} className={config.spin ? 'animate-spin' : ''} />}
      {config.label}
    </span>
  );
};

// --- WRAPPER CHO CÁC MODAL ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; icon: any; color?: string }> = ({ isOpen, onClose, title, children, icon: Icon, color = 'bg-[#009639]' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-auto animate-in zoom-in-95 duration-200 overflow-hidden border-t-8 border-[#009639]">
        <div className="p-5 border-b flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-4">
            <div className={`${color} p-3 rounded-xl text-white shadow-xl`}><Icon size={20} /></div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// --- TIÊU ĐỀ TRANG DÙNG CHUNG ---
export const PageHeader: React.FC<{ title: string; subtitle: string; icon: any; action?: React.ReactNode }> = ({ title, subtitle, icon: Icon, action }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
    <div>
      <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase flex items-center gap-3">
        <Icon className="text-[#009639] w-7 h-7" /> {title}
      </h1>
      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">{subtitle}</p>
    </div>
    {action && <div className="flex gap-3">{action}</div>}
  </div>
);

// --- COMPONENT PHÂN TRANG DÙNG CHUNG ---
export const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-slate-100 no-print">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
        Trang {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

// --- COMPONENT MODAL XÁC NHẬN ---
export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ElementType;
  confirmButtonColor?: string;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  icon: Icon = AlertCircle,
  confirmButtonColor = 'bg-red-600 hover:bg-red-700',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} icon={Icon} color={confirmButtonColor.split(' ')[0]}>
      <div className="space-y-6">
        <p className="text-slate-600 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-3 text-slate-500 font-black uppercase text-xs tracking-widest hover:bg-slate-100 rounded-xl transition-colors">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} className={`px-8 py-3 text-white rounded-xl font-black uppercase text-xs shadow-lg transition-all ${confirmButtonColor}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
