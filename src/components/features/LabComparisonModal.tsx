import React, { useState } from 'react';
import { X, Scale, AlertTriangle, CheckCircle2, FileText, UploadCloud, Sparkles, Loader2, ExternalLink } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl overflow-hidden my-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/40 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
              <Scale size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                AI Cross-Lab Comparison
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                  Đối chiếu Đa phiếu & Lab Bias
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                So sánh kết quả giữa phòng Lab Nội bộ và Lab Ngoại kiểm (Quatest, CASE, Eurofins, CoA NCC).
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-lg text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          {/* Section 1: Selector / Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
            {/* Source 1 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-500" />
                Phiếu Kiểm Nghiệm 1 (Gốc / Nội bộ)
              </label>
              <select
                value={selectedId1}
                onChange={e => { setSelectedId1(e.target.value); setFile1(null); }}
                className="w-full text-xs font-bold p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
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
              <div className="text-center text-[10px] text-slate-400 font-bold uppercase">— hoặc tải file PDF/ảnh —</div>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={e => { setFile1(e.target.files?.[0] || null); setSelectedId1(''); }}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {file1 && <p className="text-[11px] text-emerald-600 font-bold truncate">✓ Đã chọn file: {file1.name}</p>}
            </div>

            {/* Source 2 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-blue-500" />
                Phiếu Kiểm Nghiệm 2 (Đối chiếu / Ngoại kiểm)
              </label>
              <select
                value={selectedId2}
                onChange={e => { setSelectedId2(e.target.value); setFile2(null); }}
                className="w-full text-xs font-bold p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
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
              <div className="text-center text-[10px] text-slate-400 font-bold uppercase">— hoặc tải file PDF/ảnh —</div>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={e => { setFile2(e.target.files?.[0] || null); setSelectedId2(''); }}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {file2 && <p className="text-[11px] text-emerald-600 font-bold truncate">✓ Đã chọn file: {file2.name}</p>}
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-center">
            <button
              onClick={handleRunComparison}
              disabled={isComparing || isUploading}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {(isComparing || isUploading) ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {uploadStep || 'Đang phân tích đối chiếu...'}
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Tiến hành Đối chiếu & Phân tích AI
                </>
              )}
            </button>
          </div>

          {/* Section 2: Results Display */}
          {comparisonResult && (
            <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-700 animate-in fade-in duration-300">
              {/* Metrics Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center">
                  <p className="text-[10px] font-black uppercase text-indigo-500">Tỷ lệ Đồng thuận</p>
                  <p className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                    {comparisonResult.metrics.agreementRatePercent}%
                  </p>
                </div>
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-800 text-center">
                  <p className="text-[10px] font-black uppercase text-blue-500">Độ lệch Trung bình (%RPD)</p>
                  <p className="text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                    {comparisonResult.metrics.avgRpdPercent}%
                  </p>
                </div>
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-800 text-center">
                  <p className="text-[10px] font-black uppercase text-amber-500">Lệch Vừa (12-25%)</p>
                  <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
                    {comparisonResult.metrics.minorDiffCount}
                  </p>
                </div>
                <div className="p-3.5 bg-red-50/70 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-800 text-center">
                  <p className="text-[10px] font-black uppercase text-red-500">Lệch Nghiêm trọng (&gt;25%)</p>
                  <p className="text-xl font-black text-red-700 dark:text-red-300 mt-0.5">
                    {comparisonResult.metrics.criticalDiffCount}
                  </p>
                </div>
              </div>

              {/* Side-by-side Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 uppercase font-black tracking-wider text-[10px]">
                      <th className="p-3">Chỉ tiêu</th>
                      <th className="p-3">{comparisonResult.report1.labName || 'Phiếu 1'}</th>
                      <th className="p-3">{comparisonResult.report2.labName || 'Phiếu 2'}</th>
                      <th className="p-3 text-center">Độ lệch (%RPD)</th>
                      <th className="p-3 text-right">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {comparisonResult.entries.map((entry, idx) => {
                      const isSingle = entry.deviationLevel === 'SINGLE_SOURCE';
                      const isCritical = entry.deviationLevel === 'CRITICAL';
                      const isWarning = entry.deviationLevel === 'WARNING';
                      const isGood = entry.deviationLevel === 'EXCELLENT' || entry.deviationLevel === 'ACCEPTABLE';

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors ${
                            isCritical ? 'bg-red-50/40 dark:bg-red-950/20' : ''
                          }`}
                        >
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                            {entry.criteriaName}
                            {entry.limit && <span className="block text-[10px] text-slate-400 font-normal">YC: {entry.limit}</span>}
                          </td>
                          <td className="p-3 font-medium">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{entry.source1Value}</span>
                            {entry.source1Unit && <span className="text-slate-400 ml-1">{entry.source1Unit}</span>}
                          </td>
                          <td className="p-3 font-medium">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{entry.source2Value}</span>
                            {entry.source2Unit && <span className="text-slate-400 ml-1">{entry.source2Unit}</span>}
                          </td>
                          <td className="p-3 text-center font-bold">
                            {entry.rpd !== undefined ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                isCritical ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                                isWarning ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
                                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                              }`}>
                                {entry.rpd}%
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-black">
                            {isCritical && <span className="text-red-600 text-[11px]">Lệch Lớn 🚨</span>}
                            {isWarning && <span className="text-amber-600 text-[11px]">Lệch Vừa ⚠️</span>}
                            {isGood && <span className="text-emerald-600 text-[11px]">Đồng thuận ✓</span>}
                            {isSingle && <span className="text-slate-400 text-[10px]">Chỉ 1 bên kiểm</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* AI Expert Synthesis Card */}
              <div className="bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-purple-500/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800/60 space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-black text-sm">
                  <Sparkles size={18} />
                  Nhận Định Chuyên Gia AI & Đánh Giá Sai Số Hệ Thống (Lab Bias)
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                  {comparisonResult.aiAnalysis.summary}
                </p>
                <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-indigo-100/80 dark:border-indigo-900/40 text-xs space-y-1.5">
                  <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Scale size={14} className="text-indigo-500" />
                    Đánh giá Lab Bias:
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    {comparisonResult.aiAnalysis.systematicBiasAssessment}
                  </p>
                </div>

                {comparisonResult.aiAnalysis.actionRecommendations.length > 0 && (
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-700 dark:text-slate-300">Đề xuất hành động:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
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
