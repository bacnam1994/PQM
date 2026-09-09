import React, { useState } from 'react';
import { 
  XMarkIcon, 
  ScaleIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  DocumentTextIcon, 
  ArrowUpTrayIcon, 
  SparklesIcon, 
  ArrowPathIcon, 
  ArrowTopRightOnSquareIcon 
} from '@heroicons/react/24/outline';
import { TestResult, Batch } from '../../types';
import { compareLabReports, LabComparisonResult, LabReportSource } from '../../services/ai/labComparisonService';
import { geminiService } from '../../services/ai/geminiService';
import { buildExtractionPrompt } from '../../services/ai/prompts';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';

interface LabComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialResult1?: TestResult;
  initialResult2?: TestResult;
  batch?: Batch;
}

export const LabComparisonModal: React.FC<LabComparisonModalProps> = ({
  isOpen,
  onClose,
  initialResult1,
  initialResult2,
  batch
}) => {
  const { testResults, batches, aiLearnedMappings } = useAppStore();
  const [selectedId1, setSelectedId1] = useState(initialResult1?.id || '');
  const [selectedId2, setSelectedId2] = useState(initialResult2?.id || '');
  
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<LabComparisonResult | null>(null);

  // File upload state for direct upload comparison
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');

  if (!isOpen) return null;

  const availableResults = batch
    ? testResults.filter(r => r.batchId === batch.id)
    : testResults;

  const handleRunComparison = async () => {
    // Trường hợp 1: Chọn từ danh sách phiếu có sẵn
    if (selectedId1 && selectedId2) {
      if (selectedId1 === selectedId2) {
        toast.error('Vui lòng chọn 2 phiếu kiểm nghiệm khác nhau để đối chiếu.');
        return;
      }
      const r1 = testResults.find(r => r.id === selectedId1);
      const r2 = testResults.find(r => r.id === selectedId2);
      if (!r1 || !r2) return;

      setIsComparing(true);
      try {
        const report1: LabReportSource = {
          title: `Phiếu 1 (${r1.labName || 'Nội bộ'})`,
          labName: r1.labName || 'Nội bộ',
          testDate: r1.testDate,
          batchNo: batch?.batchNo,
          overallStatus: r1.overallStatus,
          results: r1.results || []
        };
        const report2: LabReportSource = {
          title: `Phiếu 2 (${r2.labName || 'Ngoại kiểm'})`,
          labName: r2.labName || 'Ngoại kiểm',
          testDate: r2.testDate,
          batchNo: batch?.batchNo,
          overallStatus: r2.overallStatus,
          results: r2.results || []
        };

        const res = await compareLabReports(report1, report2, aiLearnedMappings);
        setComparisonResult(res);
      } catch (err: any) {
        toast.error('Lỗi đối chiếu: ' + err.message);
      } finally {
        setIsComparing(false);
      }
    } 
    // Trường hợp 2: Tải 2 file mới lên để AI quét và đối chiếu
    else if (file1 && file2) {
      setIsUploading(true);
      try {
        setUploadStep('AI đang đọc Phiếu 1...');
        const prompt = buildExtractionPrompt([]);
        const parsed1 = await geminiService.extractDataFromDocument(file1, prompt);

        setUploadStep('AI đang đọc Phiếu 2...');
        const parsed2 = await geminiService.extractDataFromDocument(file2, prompt);

        setUploadStep('Đang đối chiếu dữ liệu giữa 2 phòng lab...');
        const report1: LabReportSource = {
          title: file1.name,
          labName: parsed1.labName || file1.name,
          testDate: parsed1.testDate,
          batchNo: parsed1.batchNo,
          results: parsed1.testResults || []
        };
        const report2: LabReportSource = {
          title: file2.name,
          labName: parsed2.labName || file2.name,
          testDate: parsed2.testDate,
          batchNo: parsed2.batchNo,
          results: parsed2.testResults || []
        };

        const res = await compareLabReports(report1, report2, aiLearnedMappings);
        setComparisonResult(res);
      } catch (err: any) {
        toast.error('Lỗi xử lý file: ' + err.message);
      } finally {
        setIsUploading(false);
        setUploadStep('');
      }
    } else {
      toast.error('Vui lòng chọn 2 phiếu từ danh sách hoặc tải lên 2 file tài liệu.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-4xl overflow-hidden my-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border bg-surface-2 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
              <ScaleIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink uppercase tracking-wide flex items-center gap-2">
                AI Cross-Lab Comparison
                <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Đối chiếu Đa phiếu &amp; Lab Bias
                </span>
              </h3>
              <p className="text-xs text-ink-muted">
                So sánh kết quả giữa phòng Lab Nội bộ và Lab Ngoại kiểm (Quatest, CASE, Eurofins, CoA NCC).
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-surface-3 rounded-xl text-ink-muted hover:text-ink transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 bg-surface text-ink">
          {/* Section 1: Selector / Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-2 p-4 rounded-xl border border-border">
            {/* Source 1 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-1.5">
                <DocumentTextIcon className="w-4 h-4 text-emerald-500" />
                Phiếu Kiểm Nghiệm 1 (Gốc / Nội bộ)
              </label>
              <select
                value={selectedId1}
                onChange={e => { setSelectedId1(e.target.value); setFile1(null); }}
                className="w-full text-xs font-bold p-2.5 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">-- Chọn phiếu có sẵn trong hệ thống --</option>
                {availableResults.map(r => {
                  const b = batches.find(x => x.id === r.batchId);
                  return (
                    <option key={r.id} value={r.id}>
                      {r.labName || 'Nội bộ'} • Lô: {b?.batchNo || 'N/A'} • {r.testDate} ({r.overallStatus})
                    </option>
                  );
                })}
              </select>
              <div className="text-center text-[10px] text-ink-muted font-bold uppercase">— hoặc tải file PDF/ảnh —</div>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={e => { setFile1(e.target.files?.[0] || null); setSelectedId1(''); }}
                className="text-xs text-ink-muted file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-500/10 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-500/20"
              />
              {file1 && <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold truncate">✓ Đã chọn file: {file1.name}</p>}
            </div>

            {/* Source 2 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-ink uppercase tracking-wider flex items-center gap-1.5">
                <DocumentTextIcon className="w-4 h-4 text-blue-500" />
                Phiếu Kiểm Nghiệm 2 (Đối chiếu / Ngoại kiểm)
              </label>
              <select
                value={selectedId2}
                onChange={e => { setSelectedId2(e.target.value); setFile2(null); }}
                className="w-full text-xs font-bold p-2.5 rounded-xl border border-border bg-surface text-ink focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">-- Chọn phiếu có sẵn trong hệ thống --</option>
                {availableResults.map(r => {
                  const b = batches.find(x => x.id === r.batchId);
                  return (
                    <option key={r.id} value={r.id}>
                      {r.labName || 'Ngoại kiểm'} • Lô: {b?.batchNo || 'N/A'} • {r.testDate} ({r.overallStatus})
                    </option>
                  );
                })}
              </select>
              <div className="text-center text-[10px] text-ink-muted font-bold uppercase">— hoặc tải file PDF/ảnh —</div>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={e => { setFile2(e.target.files?.[0] || null); setSelectedId2(''); }}
                className="text-xs text-ink-muted file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-500/10 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-500/20"
              />
              {file2 && <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold truncate">✓ Đã chọn file: {file2.name}</p>}
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-center">
            <button
              onClick={handleRunComparison}
              disabled={isComparing || isUploading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {(isComparing || isUploading) ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  {uploadStep || 'Đang phân tích đối chiếu...'}
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4" />
                  Tiến hành Đối chiếu &amp; Phân tích AI
                </>
              )}
            </button>
          </div>

          {/* Section 2: Results Display */}
          {comparisonResult && (
            <div className="space-y-6 pt-4 border-t border-border animate-in fade-in duration-300">
              {/* Metrics Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-center">
                  <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Tỷ lệ Đồng thuận</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {comparisonResult.metrics.agreementRatePercent}%
                  </p>
                </div>
                <div className="p-3.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center">
                  <p className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400">Độ lệch Trung bình (%RPD)</p>
                  <p className="text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                    {comparisonResult.metrics.avgRpdPercent}%
                  </p>
                </div>
                <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-center">
                  <p className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Lệch Vừa (12-25%)</p>
                  <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
                    {comparisonResult.metrics.minorDiffCount}
                  </p>
                </div>
                <div className="p-3.5 bg-rose-500/10 rounded-xl border border-rose-500/20 text-center">
                  <p className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400">Lệch Nghiêm trọng (&gt;25%)</p>
                  <p className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5">
                    {comparisonResult.metrics.criticalDiffCount}
                  </p>
                </div>
              </div>

              {/* ─── Lab Bias Overview Card (Chi tiết đầy đủ) ─── */}
              {comparisonResult.biasAssessment && (() => {
                const bias = comparisonResult.biasAssessment;
                const totalPairs = bias.source1HigherCount + bias.source2HigherCount + bias.equalCount;
                const lab1Name = comparisonResult.report1.labName || 'Phiếu 1';
                const lab2Name = comparisonResult.report2.labName || 'Phiếu 2';
                const pct1 = totalPairs > 0 ? Math.round((bias.source1HigherCount / totalPairs) * 100) : 0;
                const pct2 = totalPairs > 0 ? Math.round((bias.source2HigherCount / totalPairs) * 100) : 0;
                const pctEq = totalPairs > 0 ? Math.round((bias.equalCount / totalPairs) * 100) : 0;
                const borderColor = bias.isSystematic ? 'border-rose-500/20' : 'border-emerald-500/20';
                const bgColor = bias.isSystematic ? 'bg-rose-500/5' : 'bg-emerald-500/5';
                const iconBg = bias.isSystematic ? 'bg-rose-600' : 'bg-emerald-600';
                const confidenceLabel = bias.confidence === 'HIGH' ? 'Cao' : bias.confidence === 'MEDIUM' ? 'Trung bình' : 'Sơ bộ';
                const confidenceColor = bias.confidence === 'HIGH' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : bias.confidence === 'MEDIUM' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-surface-3 text-ink-muted';
                return (
                  <div className={`rounded-2xl border ${borderColor} ${bgColor} overflow-hidden`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg text-white ${iconBg}`}>
                          <ScaleIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-wide text-ink">
                              {bias.isSystematic ? '⚠️ Sai số Hệ thống Phát hiện (Lab Bias)' : '✅ Cân bằng – Không có Sai số Hệ thống'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${confidenceColor}`}>
                              Độ tin cậy: {confidenceLabel}
                            </span>
                            {comparisonResult.report1.detectedLabOrg && comparisonResult.report1.detectedLabOrg !== 'GENERIC' && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[10px]">
                                {comparisonResult.report1.detectedLabOrg}
                              </span>
                            )}
                            <span className="text-[10px] text-ink-muted font-bold">vs</span>
                            {comparisonResult.report2.detectedLabOrg && comparisonResult.report2.detectedLabOrg !== 'GENERIC' && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono text-[10px]">
                                {comparisonResult.report2.detectedLabOrg}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-ink-soft mt-0.5 font-medium leading-relaxed">
                            {bias.assessmentSummary}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Directional Bias Bar */}
                      {totalPairs >= 2 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-ink-muted flex items-center gap-1">
                            <ScaleIcon className="w-3 h-3" /> Phân bố Hướng Đo ({totalPairs} cặp chỉ tiêu định lượng)
                          </p>
                          {/* Bar */}
                          <div className="relative h-5 rounded-full overflow-hidden bg-surface-3 flex text-[9px] font-black">
                            {pct1 > 0 && (
                              <div
                                className="h-full bg-emerald-600 flex items-center justify-center text-white transition-all duration-700"
                                style={{ width: `${pct1}%` }}
                                title={`${lab1Name} đo cao hơn: ${bias.source1HigherCount} chỉ tiêu (${pct1}%)`}
                              >
                                {pct1 >= 12 && `${pct1}%`}
                              </div>
                            )}
                            {pctEq > 0 && (
                              <div
                                className="h-full bg-slate-400 dark:bg-slate-500 flex items-center justify-center text-white transition-all duration-700"
                                style={{ width: `${pctEq}%` }}
                                title={`Tương đương (≤2%): ${bias.equalCount} chỉ tiêu`}
                              >
                                {pctEq >= 10 && `≈`}
                              </div>
                            )}
                            {pct2 > 0 && (
                              <div
                                className="h-full bg-blue-600 flex items-center justify-center text-white transition-all duration-700"
                                style={{ width: `${pct2}%` }}
                                title={`${lab2Name} đo cao hơn: ${bias.source2HigherCount} chỉ tiêu (${pct2}%)`}
                              >
                                {pct2 >= 12 && `${pct2}%`}
                              </div>
                            )}
                          </div>
                          {/* Legend */}
                          <div className="flex items-center gap-3 text-[10px] flex-wrap">
                            <div className="flex items-center gap-1">
                              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-600"></span>
                              <span className="font-bold text-ink-muted">{lab1Name} cao hơn ({bias.source1HigherCount} CT)</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-400"></span>
                              <span className="font-bold text-ink-muted">Tương đương ({bias.equalCount} CT)</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-600"></span>
                              <span className="font-bold text-ink-muted">{lab2Name} cao hơn ({bias.source2HigherCount} CT)</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1 font-bold text-ink-muted">
                              Độ lệch TB:
                              <span className={`px-1.5 py-0.5 rounded font-mono ${Math.abs(bias.meanBiasPercent) >= 5 ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                                {bias.meanBiasPercent > 0 ? `+${bias.meanBiasPercent}` : bias.meanBiasPercent}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Potential Causes & Action Recommendations side by side */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {bias.potentialCauses && bias.potentialCauses.length > 0 && (
                          <div className="bg-surface rounded-xl p-3 border border-border">
                            <p className="text-[10px] font-black uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1">
                              <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500" /> Nguyên nhân tiềm ẩn
                            </p>
                            <ul className="space-y-1.5">
                              {bias.potentialCauses.map((cause, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[11px] text-ink-soft leading-relaxed">
                                  <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                                  <span>{cause}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {bias.actionRecommendations && bias.actionRecommendations.length > 0 && (
                          <div className="bg-surface rounded-xl p-3 border border-border">
                            <p className="text-[10px] font-black uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1">
                              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" /> Đề xuất Hành động QA
                            </p>
                            <ul className="space-y-1.5">
                              {bias.actionRecommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[11px] text-ink-soft leading-relaxed">
                                  <span className="text-emerald-500 mt-0.5 shrink-0">→</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Side-by-side Table */}
              <div className="border border-border rounded-xl overflow-hidden bg-surface">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-2 text-ink-muted uppercase font-black tracking-wider text-[10px] border-b border-border">
                      <th className="p-3">Chỉ tiêu &amp; Phương pháp</th>
                      <th className="p-3">{comparisonResult.report1.labName || 'Phiếu 1'}</th>
                      <th className="p-3">{comparisonResult.report2.labName || 'Phiếu 2'}</th>
                      <th className="p-3 text-center">Độ lệch (%RPD)</th>
                      <th className="p-3 text-right">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {comparisonResult.entries.map((entry, idx) => {
                      const isSingle = entry.deviationLevel === 'SINGLE_SOURCE';
                      const isCritical = entry.deviationLevel === 'CRITICAL';
                      const isWarning = entry.deviationLevel === 'WARNING';
                      const isGood = entry.deviationLevel === 'EXCELLENT' || entry.deviationLevel === 'ACCEPTABLE';

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-surface-2 transition-colors ${
                            isCritical ? 'bg-rose-500/5' : ''
                          }`}
                        >
                          <td className="p-3 font-bold text-ink">
                            <div>{entry.criteriaName}</div>
                            {entry.limit && <span className="block text-[10px] text-ink-muted font-normal">YC: {entry.limit}</span>}
                            {(entry.source1Method || entry.source2Method) && (
                              <span className="inline-block text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded mt-0.5 font-mono">
                                PP: {entry.source1Method || entry.source2Method}
                              </span>
                            )}
                            {entry.isCensoredDataComparison && (
                              <span className="inline-block ml-1 text-[9px] text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono" title={entry.censoredDetails}>
                                Ngưỡng KPH/LOD
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-medium">
                            <span className="font-bold text-ink">{entry.source1Value}</span>
                            {entry.source1Unit && <span className="text-ink-muted ml-1">{entry.source1Unit}</span>}
                          </td>
                          <td className="p-3 font-medium">
                            <span className="font-bold text-ink">{entry.source2Value}</span>
                            {entry.source2Unit && <span className="text-ink-muted ml-1">{entry.source2Unit}</span>}
                          </td>
                          <td className="p-3 text-center font-bold">
                            {entry.rpd !== undefined ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                isCritical ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' :
                                isWarning ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' :
                                'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {entry.rpd}%
                              </span>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-black">
                            {isCritical && <span className="text-rose-600 text-[11px]">Lệch Lớn 🚨</span>}
                            {isWarning && <span className="text-amber-600 text-[11px]">Lệch Vừa ⚠️</span>}
                            {isGood && <span className="text-emerald-600 text-[11px]">Đồng thuận ✓</span>}
                            {isSingle && <span className="text-ink-muted text-[10px]">Chỉ 1 bên kiểm</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* AI Expert Synthesis Card */}
              <div className="bg-surface-2 p-5 rounded-2xl border border-border space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black text-sm">
                  <SparklesIcon className="w-5 h-5" />
                  Nhận Định Chuyên Gia AI &amp; Đánh Giá Sai Số Hệ Thống (Lab Bias)
                </div>
                <p className="text-xs text-ink-soft leading-relaxed font-medium">
                  {comparisonResult.aiAnalysis.summary}
                </p>
                <div className="p-3.5 bg-surface rounded-xl border border-border text-xs space-y-1.5">
                  <p className="font-bold text-ink flex items-center gap-1.5">
                    <ScaleIcon className="w-4 h-4 text-emerald-500" />
                    Đánh giá Lab Bias:
                  </p>
                  <p className="text-ink-muted">
                    {comparisonResult.aiAnalysis.systematicBiasAssessment}
                  </p>
                </div>

                {comparisonResult.aiAnalysis.actionRecommendations.length > 0 && (
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-ink">Đề xuất hành động QA:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-ink-muted">
                      {comparisonResult.aiAnalysis.actionRecommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
