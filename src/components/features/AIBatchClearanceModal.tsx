import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, AlertTriangle, ShieldAlert, ShieldCheck, Printer, Check, Loader2, ArrowRight, Activity, FileCheck2, AlertCircle } from 'lucide-react';
import { BatchClearanceDossier, evaluateBatchQualityClearance, enrichBatchClearanceWithAI } from '../../services/ai/batchClearanceService';
import { useAppStore } from '../../store/useAppStore';
import { TestResult, TCCS, ProductFormula } from '../../types';
import toast from 'react-hot-toast';

interface AIBatchClearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: any;
  batchTestResults?: TestResult[];
  onApplyVerdictNote?: (note: string) => void;
}

export const AIBatchClearanceModal: React.FC<AIBatchClearanceModalProps> = ({
  isOpen,
  onClose,
  batch,
  batchTestResults,
  onApplyVerdictNote
}) => {
  const { tccsList, productFormulas, testResults: allTestResults } = useAppStore();

  const [dossier, setDossier] = useState<BatchClearanceDossier | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'CRITERIA' | 'RISKS'>('SUMMARY');

  useEffect(() => {
    if (!isOpen || !batch) return;

    const matchedTccs = batch.tccs || tccsList.find(t => t.id === batch.tccsId || t.productId === batch.productId);
    const matchedFormula = productFormulas.find(f => f.productId === batch.productId);
    const targetResults = batchTestResults || allTestResults.filter(r => r.batchId === batch.id);

    const initialDossier = evaluateBatchQualityClearance(batch, targetResults, matchedTccs, matchedFormula);
    setDossier(initialDossier);
  }, [isOpen, batch, batchTestResults, allTestResults, tccsList, productFormulas]);

  if (!isOpen || !batch || !dossier) return null;

  const handleEnrichWithAI = async () => {
    if (!dossier) return;
    setIsEnriching(true);
    try {
      const enriched = await enrichBatchClearanceWithAI(dossier);
      setDossier(enriched);
      toast.success('Đã cập nhật nhận định chuyên môn từ AI Gemini!');
    } catch (err: any) {
      toast.error('Lỗi khi phân tích AI: ' + err.message);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleApplyNote = () => {
    if (onApplyVerdictNote && dossier) {
      onApplyVerdictNote(dossier.executiveSummary);
      toast.success('Đã áp dụng kết luận vào ghi chú Lô!');
    }
  };

  const isRelease = dossier.verdict === 'READY_FOR_RELEASE';
  const isConditional = dossier.verdict === 'CONDITIONAL_RELEASE';
  const isHold = dossier.verdict === 'HOLD_FOR_INVESTIGATION';

  const verdictCls = isRelease
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    : isConditional
    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/30 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl shadow-md">
              <FileCheck2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800 dark:text-zinc-100 uppercase tracking-tight">
                  AI Batch Quality Clearance Dossier
                </h3>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  GMP Review
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Thẩm định hồ sơ chất lượng lô <strong className="text-slate-800 dark:text-zinc-200">{dossier.batchNo}</strong> — {dossier.productName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnrichWithAI}
              disabled={isEnriching}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              {isEnriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              AI Chuyên Sâu
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Verdict Bar */}
        <div className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 ${verdictCls}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/80 dark:bg-zinc-900/80 shadow-sm shrink-0">
              {isRelease && <ShieldCheck size={28} className="text-emerald-600" />}
              {isConditional && <AlertTriangle size={28} className="text-amber-600" />}
              {isHold && <ShieldAlert size={28} className="text-rose-600" />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider opacity-75">Khuyến nghị của Hệ thống:</p>
              <h4 className="text-lg font-black tracking-tight">
                {isRelease && '🟢 ĐỦ ĐIỀU KIỆN XUẤT XƯỞNG (RELEASE)'}
                {isConditional && '🟡 DUYỆT CÓ ĐIỀU KIỆN / CẦN LƯU Ý (CONDITIONAL)'}
                {isHold && '🔴 TẠM GIỮ LÔ ĐỂ ĐIỀU TRA (HOLD FOR INVESTIGATION)'}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div className="px-3 py-1 bg-white/80 dark:bg-zinc-900/80 rounded-xl shadow-xs border border-inherit">
              <p className="text-[9px] font-black uppercase opacity-70">Điểm Sẵn sàng</p>
              <p className="text-xl font-black">{dossier.readinessScore}/100</p>
            </div>
            <div className="px-3 py-1 bg-white/80 dark:bg-zinc-900/80 rounded-xl shadow-xs border border-inherit">
              <p className="text-[9px] font-black uppercase opacity-70">Tiến độ TCCS</p>
              <p className="text-xl font-black">{dossier.testedCriteriaCount}/{dossier.totalRequiredCriteria}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-zinc-800 px-6 bg-slate-50/50 dark:bg-zinc-900/30 gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('SUMMARY')}
            className={`py-3 border-b-2 transition-colors ${activeTab === 'SUMMARY' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            1. Nhận định & Kết luận
          </button>
          <button
            onClick={() => setActiveTab('CRITERIA')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'CRITERIA' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            2. Bảng Đối chiếu Chỉ tiêu ({dossier.testedCriteriaCount})
            {dossier.nearLimitItems.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center">
                {dossier.nearLimitItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('RISKS')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'RISKS' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            3. Yếu tố Rủi ro & Kiến nghị ({dossier.riskFactors.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs">
          {activeTab === 'SUMMARY' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-zinc-950/60 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-wider">
                  <Sparkles size={14} /> Tóm tắt Kết luận Thẩm định QA:
                </div>
                <p className="text-slate-700 dark:text-zinc-200 leading-relaxed font-medium text-[13px]">
                  {dossier.executiveSummary}
                </p>
              </div>

              {/* Quick Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-emerald-600">Chỉ tiêu Đạt</span>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  </div>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {dossier.passedCount}
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-amber-600">Sát ngưỡng giới hạn</span>
                    <AlertTriangle size={16} className="text-amber-500" />
                  </div>
                  <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
                    {dossier.nearLimitItems.length}
                  </p>
                </div>

                <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/60 dark:border-rose-900/40">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-rose-600">Không đạt / Thiếu</span>
                    <ShieldAlert size={16} className="text-rose-500" />
                  </div>
                  <p className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">
                    {dossier.failedCount + dossier.missingCriteria.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CRITERIA' && (
            <div className="space-y-3">
              {dossier.missingCriteria.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="font-bold text-amber-800 dark:text-amber-300">
                    ⚠️ Chỉ tiêu bắt buộc trong TCCS chưa có kết quả kiểm nghiệm:
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {dossier.missingCriteria.map(m => (
                      <span key={m} className="px-2 py-0.5 bg-white dark:bg-zinc-900 rounded-md font-bold text-amber-700 border border-amber-200 dark:border-amber-800">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500">
                      <th className="p-2.5">Chỉ tiêu</th>
                      <th className="p-2.5">Giới hạn TCCS</th>
                      <th className="p-2.5">Giá trị đo</th>
                      <th className="p-2.5">Trạng thái</th>
                      <th className="p-2.5">Ghi chú AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {dossier.testedItems.map((item, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 ${item.isNearLimit ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}`}>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-zinc-200">{item.criteriaName}</td>
                        <td className="p-2.5 text-slate-500 dark:text-zinc-400 font-mono">{item.expectedLimit}</td>
                        <td className="p-2.5 font-bold font-mono text-slate-800 dark:text-zinc-100">
                          {item.actualValue} {item.unit || ''}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${item.isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {item.isPass ? 'ĐẠT' : 'K.ĐẠT'}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {item.nearLimitWarning && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle size={11} /> {item.nearLimitWarning}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'RISKS' && (
            <div className="space-y-4">
              {/* Risk factors */}
              <div className="space-y-2">
                <h5 className="font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-rose-600">
                  <AlertCircle size={14} /> Các yếu tố rủi ro ghi nhận ({dossier.riskFactors.length}):
                </h5>
                {dossier.riskFactors.length === 0 ? (
                  <p className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 rounded-xl font-medium">
                    ✓ Không ghi nhận rủi ro chất lượng đáng kể nào cho lô này.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {dossier.riskFactors.map((r, i) => (
                      <li key={i} className="p-2.5 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-300 font-medium">
                        • {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <h5 className="font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-indigo-600">
                  <CheckCircle2 size={14} /> Kiến nghị hành động cho Trưởng phòng QA:
                </h5>
                <ul className="space-y-1.5">
                  {dossier.recommendations.map((rec, i) => (
                    <li key={i} className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-indigo-800 dark:text-indigo-300 font-medium">
                      ✓ {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/80 flex flex-wrap justify-between items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Printer size={14} /> In biên bản thẩm định
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200/50 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-xl font-bold text-xs"
            >
              Đóng
            </button>
            {onApplyVerdictNote && (
              <button
                type="button"
                onClick={handleApplyNote}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-1.5 shadow-md shadow-indigo-200 dark:shadow-none"
              >
                <Check size={14} /> Áp dụng vào Ghi chú Lô
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
