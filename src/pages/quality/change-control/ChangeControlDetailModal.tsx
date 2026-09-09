/**
 * PQM V4 Platform - Change Control Detail Modal
 * Chi tiết Yêu cầu Thay đổi, Ma trận Đánh giá Rủi ro FMEA & Kế hoạch Triển khai chuẩn GMP
 */

import React, { useState } from 'react';
import { 
  X, AlertTriangle, ShieldCheck, CheckCircle2, Clock, 
  Calendar, User, ArrowRight, Layers, FileText, Plus, CheckSquare, Square,
  Activity, AlertOctagon
} from 'lucide-react';
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
    MINOR: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
    MAJOR: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200',
    CRITICAL: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200',
    EMERGENCY: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200'
  };

  const statusLabels: Record<ChangeStatus, { label: string; bg: string; text: string }> = {
    DRAFT: { label: 'Bản nháp', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
    IMPACT_ASSESSMENT: { label: 'Đánh giá Tác động', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300' },
    QA_REVIEW: { label: 'QA Soát xét', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300' },
    APPROVED: { label: 'Đã phê duyệt', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300' },
    IMPLEMENTATION: { label: 'Đang triển khai', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300' },
    EFFECTIVENESS_VERIFICATION: { label: 'Thẩm định hiệu quả', bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-300' },
    CLOSED: { label: 'Đã đóng (Closed)', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300' },
    REJECTED: { label: 'Từ chối', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300' }
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                {changeRequest.crNo}
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase border ${typeBadges[changeRequest.changeType]}`}>
                {changeRequest.changeType}
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${statusLabels[changeRequest.status]?.bg} ${statusLabels[changeRequest.status]?.text}`}>
                {statusLabels[changeRequest.status]?.label || changeRequest.status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {changeRequest.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Phân loại: <span className="font-bold text-slate-700 dark:text-slate-300">{changeRequest.category}</span>
              {changeRequest.productName && <span> • Sản phẩm: <span className="font-bold text-slate-700 dark:text-slate-300">{changeRequest.productName}</span></span>}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-3 border-b-2 transition-all ${
              activeTab === 'OVERVIEW' 
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Tổng quan Thay đổi
          </button>
          <button
            onClick={() => setActiveTab('FMEA')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'FMEA' 
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Đánh giá Rủi ro FMEA
            {changeRequest.riskAssessment && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                changeRequest.riskAssessment.riskLevel === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
              }`}>
                RPN: {changeRequest.riskAssessment.rpn}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ACTIONS')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'ACTIONS' 
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Kế hoạch Triển khai ({changeRequest.actionItems?.length || 0})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
                  1. Lý do và tính cần thiết của thay đổi (Justification)
                </span>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {changeRequest.justification}
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
                  2. Mô tả chi tiết nội dung thay đổi (Scope & Description)
                </span>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {changeRequest.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Người đề xuất</span>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-700 dark:text-slate-300 font-bold">
                    <User size={13} className="text-slate-400" />
                    <span>{changeRequest.proposedBy}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{formatDateStandard(changeRequest.proposedAt)}</span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hạn dự kiến hoàn thành</span>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-700 dark:text-slate-300 font-bold">
                    <Calendar size={13} className="text-indigo-500" />
                    <span>{formatDateStandard(changeRequest.targetImplementationDate)}</span>
                  </div>
                </div>
              </div>

              {changeRequest.closureNotes && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-600 block mb-1">
                    Kết luận đóng thay đổi & Xác nhận QA
                  </span>
                  <p className="text-emerald-900 dark:text-emerald-200 font-medium">
                    {changeRequest.closureNotes}
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-1">
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
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Mức độ Nghiêm trọng (Severity)
                    </label>
                    <select
                      value={fmeaForm.severity}
                      onChange={(e) => setFmeaForm(f => ({ ...f, severity: Number(e.target.value) }))}
                      className="w-full p-2 bg-white dark:bg-slate-800 border rounded-lg font-bold"
                    >
                      <option value={1}>1 - Nhẹ / Không ảnh hưởng chất lượng</option>
                      <option value={2}>2 - Ít ảnh hưởng / Đạt cận biên</option>
                      <option value={3}>3 - Trung bình / Có nguy cơ trôi dạt</option>
                      <option value={4}>4 - Nghiêm trọng / Nguy cơ OOS</option>
                      <option value={5}>5 - Cực kỳ nghiêm trọng / Thu hồi lô</option>
                    </select>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Khả năng Xảy ra (Probability)
                    </label>
                    <select
                      value={fmeaForm.probability}
                      onChange={(e) => setFmeaForm(f => ({ ...f, probability: Number(e.target.value) }))}
                      className="w-full p-2 bg-white dark:bg-slate-800 border rounded-lg font-bold"
                    >
                      <option value={1}>1 - Rất hiếm khi xảy ra</option>
                      <option value={2}>2 - Ít khi xảy ra</option>
                      <option value={3}>3 - Thỉnh thoảng xảy ra</option>
                      <option value={4}>4 - Thường xuyên xảy ra</option>
                      <option value={5}>5 - Chắc chắn sẽ xảy ra</option>
                    </select>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Khả năng Phát hiện (Detectability)
                    </label>
                    <select
                      value={fmeaForm.detectability}
                      onChange={(e) => setFmeaForm(f => ({ ...f, detectability: Number(e.target.value) }))}
                      className="w-full p-2 bg-white dark:bg-slate-800 border rounded-lg font-bold"
                    >
                      <option value={1}>1 - Dễ phát hiện ngay qua IPC</option>
                      <option value={2}>2 - Phát hiện qua kiểm nghiệm thường quy</option>
                      <option value={3}>3 - Phát hiện qua thẩm định/nghiên cứu</option>
                      <option value={4}>4 - Khó phát hiện trong phòng lab</option>
                      <option value={5}>5 - Không thể phát hiện được</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                      Điểm Ưu tiên Rủi ro FMEA (RPN Score = S × P × D)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ngưỡng an toàn: RPN &lt; 25 (Thấp), 25 - 59 (Trung bình), ≥ 60 (Cao - Cần thẩm định nghiêm ngặt)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {fmeaForm.severity * fmeaForm.probability * fmeaForm.detectability}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Kế hoạch Giảm thiểu Rủi ro (Mitigation Plan)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Mô tả các biện pháp kiểm soát, kế hoạch thẩm định hoặc theo dõi thêm..."
                    value={fmeaForm.mitigationPlan}
                    onChange={(e) => setFmeaForm(f => ({ ...f, mitigationPlan: e.target.value }))}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none font-medium"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
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
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Danh mục Hành động Triển khai
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddAction(!showAddAction)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                >
                  <Plus size={14} /> Thêm hành động
                </button>
              </div>

              {showAddAction && (
                <form onSubmit={handleCreateAction} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-3 text-xs">
                  <input
                    type="text"
                    placeholder="Nội dung hành động cụ thể..."
                    value={newAction.title}
                    onChange={(e) => setNewAction(a => ({ ...a, title: e.target.value }))}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border rounded-lg font-medium outline-none"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Người phụ trách (email hoặc tên)..."
                      value={newAction.responsible}
                      onChange={(e) => setNewAction(a => ({ ...a, responsible: e.target.value }))}
                      className="p-2.5 bg-white dark:bg-slate-800 border rounded-lg font-medium outline-none"
                      required
                    />
                    <input
                      type="date"
                      value={newAction.deadline}
                      onChange={(e) => setNewAction(a => ({ ...a, deadline: e.target.value }))}
                      className="p-2.5 bg-white dark:bg-slate-800 border rounded-lg font-medium outline-none"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAction(false)}
                      className="px-3 py-1.5 text-slate-500 text-xs font-bold"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                    >
                      Lưu hành động
                    </button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                {(!changeRequest.actionItems || changeRequest.actionItems.length === 0) ? (
                  <p className="p-8 text-center text-slate-400 font-medium">
                    Chưa có hành động nào trong kế hoạch triển khai.
                  </p>
                ) : (
                  changeRequest.actionItems.map(act => (
                    <div key={act.id} className="p-3.5 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={act.status === 'COMPLETED'}
                          onClick={() => onCompleteActionItem(changeRequest.id, act.id)}
                          className={`p-1 rounded ${act.status === 'COMPLETED' ? 'text-emerald-500 cursor-default' : 'text-slate-300 hover:text-emerald-600'}`}
                        >
                          {act.status === 'COMPLETED' ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <div>
                          <p className={`font-bold text-slate-800 dark:text-slate-200 ${act.status === 'COMPLETED' ? 'line-through text-slate-400' : ''}`}>
                            {act.title}
                          </p>
                          <span className="text-[11px] text-slate-400">Phụ trách: {act.responsible}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[11px] text-slate-500 block">
                          Hạn: {formatDateStandard(act.deadline)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          act.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
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
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-slate-500 hover:text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2.5">
            {changeRequest.status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(changeRequest.id, 'IMPACT_ASSESSMENT')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-colors flex items-center gap-1.5"
              >
                Chuyển Đánh giá Tác động
                <ArrowRight size={14} />
              </button>
            )}

            {changeRequest.status === 'IMPACT_ASSESSMENT' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(changeRequest.id, 'APPROVED')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-colors flex items-center gap-1.5"
              >
                Phê duyệt Triển khai (QA Approve)
                <ShieldCheck size={14} />
              </button>
            )}

            {changeRequest.status === 'APPROVED' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(changeRequest.id, 'IMPLEMENTATION')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-colors flex items-center gap-1.5"
              >
                Bắt đầu Triển khai Thay đổi
                <ArrowRight size={14} />
              </button>
            )}

            {changeRequest.status === 'IMPLEMENTATION' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(changeRequest.id, 'CLOSED', 'Đã hoàn tất toàn bộ kế hoạch triển khai thay đổi.')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-colors flex items-center gap-1.5"
              >
                Đóng Thay đổi (QA Close)
                <CheckCircle2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
