/**
 * PQM V4 Platform - TCCS Impact Assessment Modal
 * Đánh giá tác động thay đổi tiêu chuẩn TCCS tới Lô sản xuất và Phiếu kiểm nghiệm
 */

import React from 'react';
import { 
  X, AlertOctagon, AlertTriangle, ShieldCheck, 
  Layers, ClipboardCheck, ArrowRight, CheckCircle2, Info 
} from 'lucide-react';
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
      bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
      badge: 'bg-rose-600 text-white',
      text: 'text-rose-700 dark:text-rose-300',
      icon: AlertOctagon,
      title: 'Mức độ Rủi ro Cao (High Risk)'
    },
    MEDIUM: {
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      badge: 'bg-amber-600 text-white',
      text: 'text-amber-700 dark:text-amber-300',
      icon: AlertTriangle,
      title: 'Mức độ Rủi ro Trung bình (Medium Risk)'
    },
    LOW: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
      badge: 'bg-emerald-600 text-white',
      text: 'text-emerald-700 dark:text-emerald-300',
      icon: ShieldCheck,
      title: 'Mức độ Rủi ro Thấp (Low Risk)'
    }
  }[report.riskLevel];

  const RiskIcon = riskConfig.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${riskConfig.bg} ${riskConfig.text}`}>
              <RiskIcon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                  Báo cáo Đánh giá Tác động Thay đổi TCCS
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${riskConfig.badge}`}>
                  {report.riskLevel}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Sự dịch chuyển từ <span className="font-bold text-slate-700 dark:text-slate-200">{report.oldTccsCode}</span> sang <span className="font-bold text-indigo-600 dark:text-indigo-400">{report.newTccsCode}</span>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Risk Level Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${riskConfig.bg}`}>
            <RiskIcon className={`shrink-0 mt-0.5 ${riskConfig.text}`} size={20} />
            <div>
              <h4 className={`font-bold text-sm ${riskConfig.text}`}>{riskConfig.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                {report.hasCriticalSpecificationChanges 
                  ? 'Có sự siết chặt đáng kể về giới hạn chấp nhận chỉ tiêu kỹ thuật. Cần đánh giá kỹ khả năng đáp ứng của các lô đang sản xuất.'
                  : 'Thay đổi không ảnh hưởng nghiêm trọng đến giới hạn kỹ thuật cốt lõi.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                <Layers size={14} className="text-blue-500" />
                Lô sản xuất đang mở bị ảnh hưởng
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
                {report.affectedActiveBatches.length} <span className="text-xs font-semibold text-slate-400">lô</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                <ClipboardCheck size={14} className="text-rose-500" />
                Phiếu KN có nguy cơ xung đột / FAIL
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-100">
                {report.potentialTestResultConflicts.length} <span className="text-xs font-semibold text-slate-400">phiếu</span>
              </p>
            </div>
          </div>

          {/* Danh sách Lô đang mở bị ảnh hưởng */}
          {report.affectedActiveBatches.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Layers size={14} className="text-blue-500" />
                Chi tiết các lô sản xuất đang hoạt động
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {report.affectedActiveBatches.map(b => (
                  <div key={b.batchId} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">Lô: {b.batchNo}</span>
                      <span className="ml-2 text-slate-400">({b.status})</span>
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
                <AlertOctagon size={14} className="text-rose-500" />
                Cảnh báo phiếu kiểm nghiệm xung đột chỉ tiêu mới
              </h4>
              <div className="border border-rose-200 dark:border-rose-900/60 rounded-xl overflow-hidden divide-y divide-rose-100 dark:divide-rose-900/40">
                {report.potentialTestResultConflicts.map(c => (
                  <div key={c.testResultId} className="p-3 bg-rose-50/40 dark:bg-rose-950/20 text-xs">
                    <div className="font-bold text-rose-700 dark:text-rose-300 mb-1">
                      Phiếu #{c.testResultId} (Ngày KN: {c.testDate || 'N/A'})
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
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
            <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Info size={14} />
              Khuyến nghị QA / Kiểm soát Thay đổi (Change Control)
            </h4>
            <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800/60 space-y-2">
              {report.recommendedActions.map((act, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <span>{act}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
          >
            Đóng
          </button>
          {onConfirmApprove && (
            <button
              onClick={() => {
                onClose();
                onConfirmApprove();
              }}
              className="px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-colors flex items-center gap-2"
            >
              Tiến hành Ký duyệt Phiên bản TCCS
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
