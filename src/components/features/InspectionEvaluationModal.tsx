import React, { useState } from 'react';
import {
  ShieldCheckIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { Batch } from '../../types';
import { BatchInspectionCalculationResult } from '../../domain/batch/BatchInspectionProgressService';
import { useAppStore } from '../../store/useAppStore';

interface InspectionEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: Batch;
  calculation: BatchInspectionCalculationResult;
  onSuccess?: () => void;
}

export const InspectionEvaluationModal: React.FC<InspectionEvaluationModalProps> = ({
  isOpen,
  onClose,
  batch,
  calculation,
  onSuccess,
}) => {
  const evaluateInspection = useAppStore((state) => state.evaluateInspection);
  const user = useAppStore((state) => state.user);
  const notify = useAppStore((state) => state.notify);

  const [decision, setDecision] = useState<'PASS' | 'FAIL'>(
    calculation.hasFailures ? 'FAIL' : 'PASS'
  );
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const userRole = (user?.role || '').trim().toUpperCase();
  const isAuthorized = ['QA', 'QC', 'ADMIN'].includes(userRole);
  const canPass = calculation.isComplete && !calculation.hasFailures;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isAuthorized) {
      setErrorMsg('Bạn không có thẩm quyền đánh giá kết luận kiểm nghiệm (Chỉ QA, QC hoặc ADMIN).');
      return;
    }

    if (decision === 'PASS' && !canPass) {
      setErrorMsg('Không thể xác nhận Đạt (PASS) khi chưa hoàn thành 100% hoặc có chỉ tiêu OOS.');
      return;
    }

    if (decision === 'FAIL' && (!reason.trim() || reason.trim().length < 5)) {
      setErrorMsg(
        'Bắt buộc nhập lý do giải trình kỹ thuật (tối thiểu 5 ký tự) khi đánh giá Không đạt.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await evaluateInspection(batch.id, decision, reason.trim() || undefined);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu kết luận đánh giá chất lượng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-surface border border-border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-ink text-base">Đánh giá chất lượng kiểm nghiệm</h3>
              <p className="text-xs text-ink-muted">
                Lô: <span className="font-mono font-medium text-ink">{batch.batchNo}</span> ·{' '}
                {(batch as any).product?.name || 'Sản phẩm'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Summary Criteria Stats */}
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted flex items-center gap-1.5">
                <BeakerIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Tiến độ chỉ tiêu bắt buộc:
              </span>
              <span className="font-bold text-ink">
                {calculation.progress.completedCount} / {calculation.progress.requiredCount} (
                {calculation.progress.percentage}%)
              </span>
            </div>

            {calculation.hasFailures ? (
              <div className="flex items-start gap-2 pt-1 text-rose-600 dark:text-rose-400 font-medium">
                <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Phát hiện chỉ tiêu Không đạt (OOS): {calculation.failedCriteria.join(', ')}
                </span>
              </div>
            ) : calculation.isComplete ? (
              <div className="flex items-center gap-2 pt-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircleIcon className="w-4 h-4 shrink-0" />
                <span>
                  Toàn bộ {calculation.progress.requiredCount} chỉ tiêu bắt buộc đạt tiêu chuẩn.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1 text-amber-600 dark:text-amber-400 font-medium">
                <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                <span>Chưa hoàn thành đủ 100% chỉ tiêu theo TCCS.</span>
              </div>
            )}
          </div>

          {/* Decision Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink uppercase tracking-wider block">
              Kết luận kiểm nghiệm chính thức
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  decision === 'PASS'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                    : 'border-border bg-surface hover:bg-surface-2 text-ink-muted'
                } ${!canPass ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="decision"
                  value="PASS"
                  disabled={!canPass}
                  checked={decision === 'PASS'}
                  onChange={() => setDecision('PASS')}
                  className="sr-only"
                />
                <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold text-ink">ĐẠT (PASS)</div>
                  <div className="text-[11px] text-ink-muted">Đạt toàn bộ tiêu chuẩn</div>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  decision === 'FAIL'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20'
                    : 'border-border bg-surface hover:bg-surface-2 text-ink-muted'
                }`}
              >
                <input
                  type="radio"
                  name="decision"
                  value="FAIL"
                  checked={decision === 'FAIL'}
                  onChange={() => setDecision('FAIL')}
                  className="sr-only"
                />
                <XMarkIcon className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold text-ink">KHÔNG ĐẠT (FAIL)</div>
                  <div className="text-[11px] text-ink-muted">Có lỗi kỹ thuật hoặc OOS</div>
                </div>
              </label>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink flex items-center justify-between">
              <span>
                Lý do / Ghi chú đánh giá{' '}
                {decision === 'FAIL' && <span className="text-rose-600 dark:text-rose-400">*</span>}
              </span>
              <span className="text-[11px] text-ink-muted font-normal">
                {decision === 'FAIL' ? 'Bắt buộc tối thiểu 5 ký tự' : 'Tùy chọn'}
              </span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                decision === 'FAIL'
                  ? 'Nhập lý do chi tiết (OOS, chỉ tiêu không đạt, vi phạm quy trình)...'
                  : 'Ghi chú kiểm tra đánh giá (nếu có)...'
              }
              className="w-full px-3 py-2 text-xs bg-surface-2 border border-border rounded-xl text-ink placeholder:text-ink-faint focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
            />
          </div>

          {/* Audit Notice */}
          <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-start gap-2.5 text-[11px] text-ink-muted">
            <LockClosedIcon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-ink">Dấu vết kiểm toán ALCOA+: </span>
              Đánh giá bởi{' '}
              <span className="font-semibold text-ink">
                {user?.displayName || (user as any)?.name || user?.email}
              </span>{' '}
              ({userRole}). Dữ liệu kết quả sẽ được niêm phong mã băm toàn vẹn SHA-256.
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink-muted transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (decision === 'PASS' && !canPass)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                decision === 'PASS'
                  ? 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                  : 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
              }`}
            >
              {isSubmitting ? (
                <span>Đang ghi nhận...</span>
              ) : (
                <span>Xác nhận kết luận {decision}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
