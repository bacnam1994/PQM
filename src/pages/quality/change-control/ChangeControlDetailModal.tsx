/**
 * PQM V4 Platform - Change Control Detail Modal
 * Chi tiết Yêu cầu Thay đổi, Ma trận Đánh giá Rủi ro FMEA & Kế hoạch Triển khai chuẩn GMP
 */

import React, { useState } from 'react';
import { 
  XMarkIcon, 
  ShieldCheckIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  CalendarIcon, 
  UserIcon, 
  ArrowRightIcon, 
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';
import { ChangeRequest, ChangeStatus, FMEARiskAssessment } from '../../../types/changeControl';
import { formatDateStandard } from '../../../utils';

interface ChangeControlDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  changeRequest: ChangeRequest | null;
  onUpdateStatus: (id: string, newStatus: ChangeStatus, notes?: string) => Promise<void>;
  onAssessFMEA: (id: string, fmea: Omit<FMEARiskAssessment, 'rpn' | 'riskLevel'>) => Promise<void>;
  onAddActionItem: (id: string, item: { title: string; responsible: string; deadline: string }) => Promise<void>;
  onCompleteActionItem: (id: string, actionId: string) => Promise<void>;
  currentUserRole?: string | null;
}

export const ChangeControlDetailModal: React.FC<ChangeControlDetailModalProps> = ({
  isOpen,
  onClose,
  changeRequest,
  onUpdateStatus,
  onAssessFMEA,
  onAddActionItem,
  onCompleteActionItem,
  currentUserRole
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'FMEA' | 'ACTIONS'>('OVERVIEW');
  
  // FMEA Form State
  const [fmeaForm, setFmeaForm] = useState({
    severity: changeRequest?.riskAssessment?.severity || 3,
    probability: changeRequest?.riskAssessment?.probability || 2,
    detectability: changeRequest?.riskAssessment?.detectability || 2,
    mitigationPlan: changeRequest?.riskAssessment?.mitigationPlan || ''
  });

  // New Action Item Form State
  const [showAddAction, setShowAddAction] = useState(false);
  const [newAction, setNewAction] = useState({
    title: '',
    responsible: '',
    deadline: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  });

  const [closureNotes, setClosureNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !changeRequest) return null;

  const typeBadges = {
    MINOR: 'bg-surface-2 text-ink-soft border-border',
    MAJOR: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    CRITICAL: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    EMERGENCY: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  };

  const statusLabels: Record<ChangeStatus, { label: string; bg: string; text: string }> = {
    DRAFT: { label: 'Bản nháp', bg: 'bg-surface-2', text: 'text-ink-soft' },
    IMPACT_ASSESSMENT: { label: 'Đánh giá Tác động', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
    QA_REVIEW: { label: 'QA Soát xét', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
    APPROVED: { label: 'Đã phê duyệt', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
    IMPLEMENTATION: { label: 'Đang triển khai', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
    EFFECTIVENESS_VERIFICATION: { label: 'Thẩm định hiệu quả', bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400' },
    CLOSED: { label: 'Đã đóng (Closed)', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
    REJECTED: { label: 'Từ chối', bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' }
  };

  const handleSaveFMEA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onAssessFMEA(changeRequest.id, {
        severity: Number(fmeaForm.severity),
        probability: Number(fmeaForm.probability),
        detectability: Number(fmeaForm.detectability),
        mitigationPlan: fmeaForm.mitigationPlan
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction.title.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddActionItem(changeRequest.id, {
        title: newAction.title.trim(),
        responsible: newAction.responsible.trim() || 'QA Staff',
        deadline: newAction.deadline
      });
      setShowAddAction(false);
      setNewAction({
        title: '',
        responsible: '',
        deadline: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-4xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border bg-surface-2 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                {changeRequest.crNo}
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase border ${typeBadges[changeRequest.changeType]}`}>
                {changeRequest.changeType}
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase border border-border ${statusLabels[changeRequest.status]?.bg} ${statusLabels[changeRequest.status]?.text}`}>
                {statusLabels[changeRequest.status]?.label || changeRequest.status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-ink">
              {changeRequest.title}
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Phân loại: <span className="font-bold text-ink">{changeRequest.category}</span>
              {changeRequest.productName && <span> • Sản phẩm: <span className="font-bold text-ink">{changeRequest.productName}</span></span>}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-ink-muted hover:text-ink rounded-xl hover:bg-surface transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4 px-6 border-b border-border bg-surface text-xs font-bold">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-3 border-b-2 transition-all ${
              activeTab === 'OVERVIEW' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            Tổng quan Thay đổi
          </button>
          <button
            onClick={() => setActiveTab('FMEA')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'FMEA' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            Đánh giá Rủi ro FMEA
            {changeRequest.riskAssessment && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                changeRequest.riskAssessment.riskLevel === 'HIGH' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-surface-2 text-ink-muted border border-border'
              }`}>
                RPN: {changeRequest.riskAssessment.rpn}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ACTIONS')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'ACTIONS' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            Kế hoạch Triển khai ({changeRequest.actionItems?.length || 0})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-surface-2 rounded-xl border border-border">
                <span className="font-bold uppercase tracking-wider text-[10px] text-ink-muted block mb-1">
                  1. Lý do và tính cần thiết của thay đổi (Justification)
                </span>
                <p className="text-ink leading-relaxed font-medium">
                  {changeRequest.justification}
                </p>
              </div>

              <div className="p-4 bg-surface-2 rounded-xl border border-border">
                <span className="font-bold uppercase tracking-wider text-[10px] text-ink-muted block mb-1">
                  2. Mô tả chi tiết nội dung thay đổi (Scope & Description)
                </span>
                <p className="text-ink leading-relaxed font-medium">
                  {changeRequest.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-surface-2 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Người đề xuất</span>
                  <div className="flex items-center gap-1.5 mt-1 text-ink font-bold">
                    <UserIcon className="h-3.5 w-3.5 text-ink-muted" />
                    <span>{changeRequest.proposedBy}</span>
                  </div>
                  <span className="text-[10px] text-ink-muted mt-0.5 block">{formatDateStandard(changeRequest.proposedAt)}</span>
                </div>

                <div className="p-3.5 bg-surface-2 rounded-xl border border-border">
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Hạn dự kiến hoàn thành</span>
                  <div className="flex items-center gap-1.5 mt-1 text-ink font-bold">
                    <CalendarIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{formatDateStandard(changeRequest.targetImplementationDate)}</span>
                  </div>
                </div>
              </div>

              {changeRequest.closureNotes && (
                <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-600 dark:text-emerald-400 block mb-1">
                    Kết luận đóng thay đổi & Xác nhận QA
                  </span>
                  <p className="text-emerald-900 dark:text-emerald-200 font-medium">
                    {changeRequest.closureNotes}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                    Người phê duyệt: {changeRequest.closedBy} ({formatDateStandard(changeRequest.closedAt)})
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'FMEA' && (
            <div className="space-y-4">
              <form onSubmit={handleSaveFMEA} className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 bg-surface-2 rounded-xl border border-border">
                    <label className="font-bold text-ink block mb-1">
                      Mức độ Nghiêm trọng (Severity)
                    </label>
                    <select
                      value={fmeaForm.severity}
                      onChange={(e) => setFmeaForm(f => ({ ...f, severity: Number(e.target.value) }))}
                      className="w-full p-2 bg-surface border border-border rounded-lg font-bold text-ink"
                    >
                      <option value={1}>1 - Nhẹ / Không ảnh hưởng chất lượng</option>
                      <option value={2}>2 - Ít ảnh hưởng / Đạt cận biên</option>
                      <option value={3}>3 - Trung bình / Có nguy cơ trôi dạt</option>
                      <option value={4}>4 - Nghiêm trọng / Nguy cơ OOS</option>
                      <option value={5}>5 - Cực kỳ nghiêm trọng / Thu hồi lô</option>
                    </select>
                  </div>

                  <div className="p-3.5 bg-surface-2 rounded-xl border border-border">
                    <label className="font-bold text-ink block mb-1">
                      Khả năng Xảy ra (Probability)
                    </label>
                    <select
                      value={fmeaForm.probability}
                      onChange={(e) => setFmeaForm(f => ({ ...f, probability: Number(e.target.value) }))}
                      className="w-full p-2 bg-surface border border-border rounded-lg font-bold text-ink"
                    >
                      <option value={1}>1 - Rất hiếm khi xảy ra</option>
                      <option value={2}>2 - Ít khi xảy ra</option>
                      <option value={3}>3 - Thỉnh thoảng xảy ra</option>
                      <option value={4}>4 - Thường xuyên xảy ra</option>
                      <option value={5}>5 - Chắc chắn sẽ xảy ra</option>
                    </select>
                  </div>

                  <div className="p-3.5 bg-surface-2 rounded-xl border border-border">
                    <label className="font-bold text-ink block mb-1">
                      Khả năng Phát hiện (Detectability)
                    </label>
                    <select
                      value={fmeaForm.detectability}
                      onChange={(e) => setFmeaForm(f => ({ ...f, detectability: Number(e.target.value) }))}
                      className="w-full p-2 bg-surface border border-border rounded-lg font-bold text-ink"
                    >
                      <option value={1}>1 - Dễ phát hiện ngay qua IPC</option>
                      <option value={2}>2 - Phát hiện qua kiểm nghiệm thường quy</option>
                      <option value={3}>3 - Phát hiện qua thẩm định/nghiên cứu</option>
                      <option value={4}>4 - Khó phát hiện trong phòng lab</option>
                      <option value={5}>5 - Không thể phát hiện được</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                      Điểm Ưu tiên Rủi ro FMEA (RPN Score = S × P × D)
                    </span>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      Ngưỡng an toàn: RPN &lt; 25 (Thấp), 25 - 59 (Trung bình), ≥ 60 (Cao - Cần thẩm định nghiêm ngặt)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {fmeaForm.severity * fmeaForm.probability * fmeaForm.detectability}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-ink">
                    Kế hoạch Giảm thiểu Rủi ro (Mitigation Plan)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Mô tả các biện pháp kiểm soát, kế hoạch thẩm định hoặc theo dõi thêm..."
                    value={fmeaForm.mitigationPlan}
                    onChange={(e) => setFmeaForm(f => ({ ...f, mitigationPlan: e.target.value }))}
                    className="w-full p-3 bg-surface-2 border border-border rounded-xl outline-none font-medium text-ink focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                  >
                    Lưu Đánh giá Rủi ro FMEA
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'ACTIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-ink-muted">
                  Danh mục Hành động Triển khai
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddAction(!showAddAction)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" /> Thêm hành động
                </button>
              </div>

              {showAddAction && (
                <form onSubmit={handleCreateAction} className="p-4 bg-surface-2 rounded-xl border border-border space-y-3 text-xs">
                  <input
                    type="text"
                    placeholder="Nội dung hành động cụ thể..."
                    value={newAction.title}
                    onChange={(e) => setNewAction(a => ({ ...a, title: e.target.value }))}
                    className="w-full p-2.5 bg-surface border border-border rounded-lg font-medium text-ink outline-none focus:border-emerald-500"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Người phụ trách (email hoặc tên)..."
                      value={newAction.responsible}
                      onChange={(e) => setNewAction(a => ({ ...a, responsible: e.target.value }))}
                      className="p-2.5 bg-surface border border-border rounded-lg font-medium text-ink outline-none focus:border-emerald-500"
                      required
                    />
                    <input
                      type="date"
                      value={newAction.deadline}
                      onChange={(e) => setNewAction(a => ({ ...a, deadline: e.target.value }))}
                      className="p-2.5 bg-surface border border-border rounded-lg font-medium text-ink outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAction(false)}
                      className="px-3 py-1.5 text-ink-muted hover:text-ink text-xs font-bold transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                    >
                      Lưu hành động
                    </button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden text-xs">
                {(!changeRequest.actionItems || changeRequest.actionItems.length === 0) ? (
                  <p className="p-8 text-center text-ink-muted font-medium">
                    Chưa có hành động nào trong kế hoạch triển khai.
                  </p>
                ) : (
                  changeRequest.actionItems.map(act => (
                    <div key={act.id} className="p-3.5 bg-surface flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={act.status === 'COMPLETED'}
                          onClick={() => onCompleteActionItem(changeRequest.id, act.id)}
                          className={`h-5 w-5 rounded flex items-center justify-center border transition-colors ${
                            act.status === 'COMPLETED' 
                              ? 'bg-emerald-600 border-emerald-600 text-white cursor-default' 
                              : 'border-border text-transparent hover:border-emerald-600'
                          }`}
                        >
                          <CheckIcon className="h-3.5 w-3.5 stroke-[3]" />
                        </button>
                        <div>
                          <p className={`font-bold text-ink ${act.status === 'COMPLETED' ? 'line-through text-ink-muted' : ''}`}>
                            {act.title}
                          </p>
                          <span className="text-[11px] text-ink-muted">Phụ trách: {act.responsible}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[11px] text-ink-muted block">
                          Hạn: {formatDateStandard(act.deadline)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                          act.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                        }`}>
                          {act.status === 'COMPLETED' ? 'Hoàn tất' : 'Đang làm'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border bg-surface-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-ink-muted hover:text-ink font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-surface transition-colors"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2.5">
            {changeRequest.status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(changeRequest.id, 'IMPACT_ASSESSMENT')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-colors flex items-center gap-1.5"
              >
                Chuyển Đánh giá Tác động
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            )}

            {changeRequest.status === 'IMPACT_ASSESSMENT' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(changeRequest.id, 'APPROVED')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-colors flex items-center gap-1.5"
              >
                Phê duyệt Triển khai (QA Approve)
                <ShieldCheckIcon className="h-4 w-4" />
              </button>
            )}

            {changeRequest.status === 'APPROVED' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(changeRequest.id, 'IMPLEMENTATION')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-colors flex items-center gap-1.5"
              >
                Bắt đầu Triển khai Thay đổi
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            )}

            {changeRequest.status === 'IMPLEMENTATION' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(changeRequest.id, 'CLOSED', 'Đã hoàn tất toàn bộ kế hoạch triển khai thay đổi.')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-colors flex items-center gap-1.5"
              >
                Đóng Thay đổi (QA Close)
                <CheckCircleIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
