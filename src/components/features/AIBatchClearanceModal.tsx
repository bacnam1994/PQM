import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ShieldCheckIcon,
  PrinterIcon,
  CheckIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ChartBarSquareIcon,
  DocumentCheckIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import {
  BatchClearanceDossier,
  evaluateBatchQualityClearance,
  enrichBatchClearanceWithAI,
} from '../../services/ai/batchClearanceService';
import { CanonicalStatusResolver } from '../../domain/canonical/canonicalResolver';
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
  onApplyVerdictNote,
}) => {
  const { tccsList, productFormulas, testResults: allTestResults } = useAppStore();

  const [dossier, setDossier] = useState<BatchClearanceDossier | null>(null);
  const [tccsError, setTccsError] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'CRITERIA' | 'RISKS'>('SUMMARY');

  useEffect(() => {
    if (!isOpen || !batch) return;

    // SSoT: Phân giải TCCS theo thứ tự ưu tiên bắt buộc:
    // 1. batch.tccsSnapshot -> 2. batch.tccsId -> 3. exact TCCS version match -> KHÔNG tự động fallback theo productId
    const tccsResolution = CanonicalStatusResolver.resolveTccsForBatch(batch, null, tccsList);
    const matchedTccs = tccsResolution.tccs;

    if (tccsResolution.resolutionStatus === 'TCCS_RESOLUTION_ERROR') {
      setTccsError(tccsResolution.errorReason || 'Không xác định được TCCS chính xác cho Lô.');
    } else {
      setTccsError(null);
    }

    const matchedFormula = productFormulas.find((f) => f.productId === batch.productId);
    const targetResults = batchTestResults || allTestResults.filter((r) => r.batchId === batch.id);

    const initialDossier = evaluateBatchQualityClearance(
      batch,
      targetResults,
      matchedTccs || undefined,
      matchedFormula
    );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border bg-surface flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
              <DocumentCheckIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink">AI Batch Quality Clearance Dossier</h3>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/40">
                  GMP Review
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Thẩm định hồ sơ chất lượng lô{' '}
                <strong className="text-ink">{dossier.batchNo}</strong> — {dossier.productName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnrichWithAI}
              disabled={isEnriching || !!tccsError}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
            >
              {isEnriching ? (
                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="h-3.5 w-3.5" />
              )}
              AI Chuyên Sâu
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* TCCS Resolution Error Banner */}
        {tccsError && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs shadow-xs">
            <ShieldExclamationIcon className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-sm text-rose-900 dark:text-rose-200">
                LỖI PHÂN GIẢI TIÊU CHUẨN (TCCS_RESOLUTION_ERROR)
              </h5>
              <p className="mt-1">{tccsError}</p>
              <p className="mt-1 text-[11px] opacity-85">
                Quy trình thẩm định chất lượng bị khóa để ngăn ngừa rủi ro áp dụng sai phiên bản
                tiêu chuẩn cơ sở. Vui lòng kiểm tra lại liên kết TCCS của Lô hàng.
              </p>
            </div>
          </div>
        )}

        {/* Verdict Bar */}
        <div
          className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 ${verdictCls}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-surface/80 shadow-xs shrink-0">
              {isRelease && <ShieldCheckIcon className="h-7 w-7 text-emerald-600" />}
              {isConditional && <ExclamationTriangleIcon className="h-7 w-7 text-amber-600" />}
              {isHold && <ShieldExclamationIcon className="h-7 w-7 text-rose-600" />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                Khuyến nghị của Hệ thống:
              </p>
              <h4 className="text-base font-bold tracking-tight">
                {isRelease && '🟢 ĐỦ ĐIỀU KIỆN XUẤT XƯỞNG (RELEASE)'}
                {isConditional && '🟡 DUYỆT CÓ ĐIỀU KIỆN / CẦN LƯU Ý (CONDITIONAL)'}
                {isHold && '🔴 TẠM GIỮ LÔ ĐỂ ĐIỀU TRA (HOLD FOR INVESTIGATION)'}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div className="px-3 py-1 bg-surface/80 rounded-lg shadow-xs border border-inherit">
              <p className="text-[9px] font-bold uppercase opacity-70">Điểm Sẵn sàng</p>
              <p className="text-lg font-bold">{dossier.readinessScore}/100</p>
            </div>
            <div className="px-3 py-1 bg-surface/80 rounded-lg shadow-xs border border-inherit">
              <p className="text-[9px] font-bold uppercase opacity-70">Tiến độ TCCS</p>
              <p className="text-lg font-bold">
                {dossier.testedCriteriaCount}/{dossier.totalRequiredCriteria}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border px-6 bg-surface-2 gap-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('SUMMARY')}
            className={`py-3 border-b-2 transition-colors ${activeTab === 'SUMMARY' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            1. Nhận định & Kết luận
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CRITERIA')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'CRITERIA' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            2. Bảng Đối chiếu Chỉ tiêu ({dossier.testedCriteriaCount})
            {dossier.nearLimitItems.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                {dossier.nearLimitItems.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('RISKS')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'RISKS' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            3. Yếu tố Rủi ro & Kiến nghị ({dossier.riskFactors.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs">
          {activeTab === 'SUMMARY' && (
            <div className="space-y-4">
              <div className="p-4 bg-surface-2 rounded-xl border border-border space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <SparklesIcon className="h-4 w-4" /> Tóm tắt Kết luận Thẩm định QA:
                </div>
                <p className="text-ink leading-relaxed font-medium text-xs">
                  {dossier.executiveSummary}
                </p>
              </div>

              {/* Quick Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      Chỉ tiêu Đạt
                    </span>
                    <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {dossier.passedCount}
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                      Sát ngưỡng giới hạn
                    </span>
                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                    {dossier.nearLimitItems.length}
                  </p>
                </div>

                <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/60 dark:border-rose-900/40">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                      Không đạt / Thiếu
                    </span>
                    <ShieldExclamationIcon className="h-4 w-4 text-rose-500" />
                  </div>
                  <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">
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
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    ⚠️ Chỉ tiêu bắt buộc trong TCCS chưa có kết quả kiểm nghiệm:
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {dossier.missingCriteria.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 bg-surface rounded-md font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border text-[11px] font-semibold text-ink-muted">
                      <th className="p-2.5">Chỉ tiêu</th>
                      <th className="p-2.5">Giới hạn TCCS</th>
                      <th className="p-2.5">Giá trị đo</th>
                      <th className="p-2.5">Trạng thái</th>
                      <th className="p-2.5">Ghi chú AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dossier.testedItems.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-surface-2 ${item.isNearLimit ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}`}
                      >
                        <td className="p-2.5 font-semibold text-ink">{item.criteriaName}</td>
                        <td className="p-2.5 text-ink-muted font-mono">{item.expectedLimit}</td>
                        <td className="p-2.5 font-semibold font-mono text-ink">
                          {item.actualValue} {item.unit || ''}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.isPass ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'}`}
                          >
                            {item.isPass ? 'ĐẠT' : 'K.ĐẠT'}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {item.nearLimitWarning && (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <ExclamationTriangleIcon className="h-3.5 w-3.5" />{' '}
                              {item.nearLimitWarning}
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
                <h5 className="font-bold text-ink uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-rose-600">
                  <ExclamationCircleIcon className="h-4 w-4" /> Các yếu tố rủi ro ghi nhận (
                  {dossier.riskFactors.length}):
                </h5>
                {dossier.riskFactors.length === 0 ? (
                  <p className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 rounded-xl font-medium">
                    ✓ Không ghi nhận rủi ro chất lượng đáng kể nào cho lô này.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {dossier.riskFactors.map((r, i) => (
                      <li
                        key={i}
                        className="p-2.5 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-300 font-medium"
                      >
                        • {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <h5 className="font-bold text-ink uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-emerald-600">
                  <CheckCircleIcon className="h-4 w-4" /> Kiến nghị hành động cho Trưởng phòng QA:
                </h5>
                <ul className="space-y-1.5">
                  {dossier.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="p-2.5 bg-surface-2 border border-border rounded-xl text-ink font-medium"
                    >
                      ✓ {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-2 flex flex-wrap justify-between items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 text-ink-muted hover:text-ink hover:bg-surface rounded-lg font-semibold text-xs flex items-center gap-1.5 border border-border transition-colors"
          >
            <PrinterIcon className="h-4 w-4" /> In biên bản thẩm định
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-ink-muted hover:text-ink hover:bg-surface rounded-lg font-semibold text-xs border border-border transition-colors"
            >
              Đóng
            </button>
            {onApplyVerdictNote && (
              <button
                type="button"
                onClick={handleApplyNote}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <CheckIcon className="h-4 w-4" /> Áp dụng vào Ghi chú Lô
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
