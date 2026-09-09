/**
 * PQM V4 Platform - Deviation Workflow Modal
 * Điều phối chuyển trạng thái sai lệch theo State Machine GMP và yêu cầu giải trình / thẩm định
 */

import React, { useState } from 'react';
import { 
  X, ArrowRight, ShieldCheck, AlertOctagon, CheckCircle2, 
  Clock, FileText, UserCheck, AlertTriangle 
} from 'lucide-react';
import { QualityDeviation, DeviationStatus } from '../../../types/deviation';

interface DeviationWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviation: QualityDeviation | null;
  targetStatus: DeviationStatus;
  onConfirm: (status: DeviationStatus, notes: string, investigator?: string) => Promise<void>;
  currentUserRole?: string | null;
}

export const DeviationWorkflowModal: React.FC<DeviationWorkflowModalProps> = ({
  isOpen,
  onClose,
  deviation,
  targetStatus,
  onConfirm,
  currentUserRole
}) => {
  const [notes, setNotes] = useState('');
  const [investigator, setInvestigator] = useState(deviation?.investigator || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !deviation) return null;

  const isClosing = targetStatus === 'CLOSED';
  const isInvestigating = targetStatus === 'UNDER_INVESTIGATION';
  const isCapaPlanned = targetStatus === 'CAPA_PLANNED';

  const statusLabels: Record<DeviationStatus, string> = {
    LOGGED: 'Mới ghi nhận',
    UNDER_INVESTIGATION: 'Đang điều tra nguyên nhân (RCA)',
    CAPA_PLANNED: 'Thực thi Kế hoạch CAPA',
    EFFECTIVENESS_REVIEW: 'Đánh giá Hiệu quả CAPA',
    CLOSED: 'Đóng hồ sơ Sai lệch (QA Sign-off)'
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Kiểm tra thẩm quyền đóng hồ sơ
    if (isClosing) {
      if (currentUserRole !== 'QA' && currentUserRole !== 'ADMIN') {
        setErrorMsg('Chỉ Trưởng phòng QA hoặc Quản trị viên hệ thống mới có quyền phê duyệt ĐÓNG hồ sơ sai lệch.');
        return;
      }
      if (!notes.trim()) {
        setErrorMsg('Bắt buộc phải nhập ý kiến thẩm định và kết luận xuất xưởng trước khi đóng hồ sơ.');
        return;
      }
    }

    if (isInvestigating && !investigator.trim()) {
      setErrorMsg('Vui lòng chỉ định Kỹ thuật viên / QA chịu trách nhiệm điều tra nguyên nhân gốc rễ.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(targetStatus, notes.trim(), investigator.trim() || undefined);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isClosing 
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
            }`}>
              {isClosing ? <ShieldCheck size={20} /> : <ArrowRight size={20} />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                Chuyển trạng thái quy trình GMP
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Mã hồ sơ: <span className="font-bold text-slate-700 dark:text-slate-200">{deviation.deviationNo}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleExecute} className="p-6 space-y-4">
          {/* Trạng thái thay đổi trực quan */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Trạng thái hiện tại</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {statusLabels[deviation.status] || deviation.status}
              </span>
            </div>
            <ArrowRight size={16} className="text-indigo-500" />
            <div className="text-right">
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Trạng thái mới</span>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                {statusLabels[targetStatus] || targetStatus}
              </span>
            </div>
          </div>

          {/* Người điều tra (nếu chuyển sang UNDER_INVESTIGATION) */}
          {isInvestigating && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Người phụ trách điều tra (Lead Investigator) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: nguyen.van.a@pqm.com hoặc Tên KTV"
                value={investigator}
                onChange={(e) => setInvestigator(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
                required
              />
            </div>
          )}

          {/* Cảnh báo CAPA nếu chuyển sang CLOSED */}
          {isClosing && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Xác nhận đóng hồ sơ sai lệch</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                  Đóng hồ sơ đồng nghĩa việc xác nhận tất cả các hành động CAPA đã hoàn tất hiệu quả và lô hàng đủ điều kiện kết luận chất lượng.
                </p>
              </div>
            </div>
          )}

          {/* Ghi chú giải trình / thẩm định */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isClosing ? 'Ý kiến Thẩm định & Kết luận QA (*)' : 'Ghi chú quá trình / Diễn giải'}
            </label>
            <textarea
              rows={3}
              placeholder={isClosing ? 'Nhập kết luận đánh giá rủi ro và xác nhận an toàn chất lượng...' : 'Ghi chú bổ sung cho bước xử lý này...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
              required={isClosing}
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertOctagon size={14} className="shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 font-bold text-xs uppercase rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-md transition-all ${
                isClosing ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSubmitting ? 'Đang xử lý...' : isClosing ? 'Phê duyệt Đóng sai lệch' : 'Xác nhận Chuyển bước'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
