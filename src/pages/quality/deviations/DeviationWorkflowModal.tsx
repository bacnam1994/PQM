/**
 * PQM V4 Platform - Deviation Workflow Modal
 * Điều phối chuyển trạng thái sai lệch theo State Machine GMP và yêu cầu giải trình / thẩm định
 */

import React, { useState } from 'react';
import { 
  XMarkIcon, 
  ArrowRightIcon, 
  ShieldCheckIcon, 
  ExclamationCircleIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isClosing 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
            }`}>
              {isClosing ? <ShieldCheckIcon className="h-5 w-5" /> : <ArrowRightIcon className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-ink uppercase tracking-tight">
                Chuyển trạng thái quy trình GMP
              </h3>
              <p className="text-xs text-ink-muted font-medium">
                Mã hồ sơ: <span className="font-bold text-ink">{deviation.deviationNo}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-ink-muted hover:text-ink rounded-xl hover:bg-surface transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleExecute} className="p-6 space-y-4">
          {/* Trạng thái thay đổi trực quan */}
          <div className="p-3.5 bg-surface-2 rounded-xl border border-border flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Trạng thái hiện tại</span>
              <span className="text-xs font-bold text-ink">
                {statusLabels[deviation.status] || deviation.status}
              </span>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <div className="text-right">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Trạng thái mới</span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {statusLabels[targetStatus] || targetStatus}
              </span>
            </div>
          </div>

          {/* Người điều tra (nếu chuyển sang UNDER_INVESTIGATION) */}
          {isInvestigating && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink">
                Người phụ trách điều tra (Lead Investigator) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: nguyen.van.a@pqm.com hoặc Tên KTV"
                value={investigator}
                onChange={(e) => setInvestigator(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:border-emerald-500"
                required
              />
            </div>
          )}

          {/* Cảnh báo CAPA nếu chuyển sang CLOSED */}
          {isClosing && (
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
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
            <label className="text-xs font-bold text-ink">
              {isClosing ? 'Ý kiến Thẩm định & Kết luận QA (*)' : 'Ghi chú quá trình / Diễn giải'}
            </label>
            <textarea
              rows={3}
              placeholder={isClosing ? 'Nhập kết luận đánh giá rủi ro và xác nhận an toàn chất lượng...' : 'Ghi chú bổ sung cho bước xử lý này...'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-xl text-xs font-medium text-ink outline-none focus:border-emerald-500"
              required={isClosing}
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0 text-rose-600" />
              {errorMsg}
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-ink-muted hover:text-ink font-bold text-xs uppercase rounded-xl transition-colors hover:bg-surface-2"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-sm transition-all ${
                isClosing ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'
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
