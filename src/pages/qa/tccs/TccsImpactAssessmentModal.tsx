/**
 * PQM V4 Platform - TCCS Impact Assessment Modal
 * Đánh giá tác động thay đổi tiêu chuẩn TCCS tới Lô sản xuất và Phiếu kiểm nghiệm
 */

import React from 'react';
import { 
  XMarkIcon, 
  ExclamationCircleIcon, 
  ExclamationTriangleIcon, 
  ShieldCheckIcon, 
  Square3Stack3DIcon, 
  ClipboardDocumentCheckIcon, 
  ArrowRightIcon, 
  CheckCircleIcon, 
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import { TCCSChangeImpactReport } from '../../../services/changeImpactEngine';

interface TccsImpactAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: TCCSChangeImpactReport | null;
  onConfirmApprove?: () => void;
}

export const TccsImpactAssessmentModal: React.FC<TccsImpactAssessmentModalProps> = ({
  isOpen,
  onClose,
  report,
  onConfirmApprove
}) => {
  if (!isOpen || !report) return null;

  const riskConfig = {
    HIGH: {
      bg: 'bg-rose-500/10 border-rose-500/20',
      badge: 'bg-rose-600 text-white',
      text: 'text-rose-700 dark:text-rose-300',
      icon: ExclamationCircleIcon,
      title: 'Mức độ Rủi ro Cao (High Risk)'
    },
    MEDIUM: {
      bg: 'bg-amber-500/10 border-amber-500/20',
      badge: 'bg-amber-600 text-white',
      text: 'text-amber-700 dark:text-amber-300',
      icon: ExclamationTriangleIcon,
      title: 'Mức độ Rủi ro Trung bình (Medium Risk)'
    },
    LOW: {
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      badge: 'bg-emerald-600 text-white',
      text: 'text-emerald-700 dark:text-emerald-300',
      icon: ShieldCheckIcon,
      title: 'Mức độ Rủi ro Thấp (Low Risk)'
    }
  }[report.riskLevel];

  const RiskIcon = riskConfig.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-4xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${riskConfig.bg} ${riskConfig.text}`}>
              <RiskIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-ink uppercase tracking-tight">
                  Báo cáo Đánh giá Tác động Thay đổi TCCS
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${riskConfig.badge}`}>
                  {report.riskLevel}
                </span>
              </div>
              <p className="text-xs text-ink-muted font-medium">
                Sự dịch chuyển từ <span className="font-bold text-ink">{report.oldTccsCode}</span> sang <span className="font-bold text-emerald-600 dark:text-emerald-400">{report.newTccsCode}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-ink-muted hover:text-ink rounded-xl hover:bg-surface-3 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Risk Level Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${riskConfig.bg}`}>
            <RiskIcon className={`shrink-0 mt-0.5 w-5 h-5 ${riskConfig.text}`} />
            <div>
              <h4 className={`font-bold text-sm ${riskConfig.text}`}>{riskConfig.title}</h4>
              <p className="text-xs text-ink-soft mt-1">
                {report.hasCriticalSpecificationChanges 
                  ? 'Có sự siết chặt đáng kể về giới hạn chấp nhận chỉ tiêu kỹ thuật. Cần đánh giá kỹ khả năng đáp ứng của các lô đang sản xuất.'
                  : 'Thay đổi không ảnh hưởng nghiêm trọng đến giới hạn kỹ thuật cốt lõi.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-surface-2 border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                <Square3Stack3DIcon className="w-4 h-4 text-blue-500" />
                Lô sản xuất đang mở bị ảnh hưởng
              </div>
              <p className="text-2xl font-black text-ink">
                {report.affectedActiveBatches.length} <span className="text-xs font-semibold text-ink-muted">lô</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-border">
              <div className="flex items-center gap-2 text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                <ClipboardDocumentCheckIcon className="w-4 h-4 text-rose-500" />
                Phiếu KN có nguy cơ xung đột / FAIL
              </div>
              <p className="text-2xl font-black text-ink">
                {report.potentialTestResultConflicts.length} <span className="text-xs font-semibold text-ink-muted">phiếu</span>
              </p>
            </div>
          </div>

          {/* Danh sách Lô đang mở bị ảnh hưởng */}
          {report.affectedActiveBatches.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-2">
                <Square3Stack3DIcon className="w-4 h-4 text-blue-500" />
                Chi tiết các lô sản xuất đang hoạt động
              </h4>
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                {report.affectedActiveBatches.map(b => (
                  <div key={b.batchId} className="p-3 bg-surface flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-ink">Lô: {b.batchNo}</span>
                      <span className="ml-2 text-ink-muted">({b.status})</span>
                    </div>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">{b.impactNote}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danh sách Phiếu KN xung đột */}
          {report.potentialTestResultConflicts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black text-rose-600 uppercase tracking-wider flex items-center gap-2">
                <ExclamationCircleIcon className="w-4 h-4 text-rose-500" />
                Cảnh báo phiếu kiểm nghiệm xung đột chỉ tiêu mới
              </h4>
              <div className="border border-rose-500/20 rounded-xl overflow-hidden divide-y divide-rose-500/20">
                {report.potentialTestResultConflicts.map(c => (
                  <div key={c.testResultId} className="p-3 bg-rose-500/5 text-xs">
                    <div className="font-bold text-rose-700 dark:text-rose-300 mb-1">
                      Phiếu #{c.testResultId} (Ngày KN: {c.testDate || 'N/A'})
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-ink-soft">
                      {c.conflictDetails.map((det, idx) => (
                        <li key={idx}>{det}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hành động khuyến nghị GMP */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <InformationCircleIcon className="w-4 h-4" />
              Khuyến nghị QA / Kiểm soát Thay đổi (Change Control)
            </h4>
            <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-2">
              {report.recommendedActions.map((act, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-ink-soft">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{act}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-2 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-ink-muted hover:text-ink font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
          >
            Đóng
          </button>
          {onConfirmApprove && (
            <button
              onClick={() => {
                onClose();
                onConfirmApprove();
              }}
              className="px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center gap-2"
            >
              Tiến hành Ký duyệt Phiên bản TCCS
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
