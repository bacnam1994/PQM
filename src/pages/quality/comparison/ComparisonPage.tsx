import React, { useState, useMemo } from 'react';
import {
  ScaleIcon,
  SparklesIcon,
  DocumentArrowUpIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  TagIcon,
  ArrowTopRightOnSquareIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../../store/useAppStore';
import { useDataGraph } from '../../../hooks/useDataGraph';
import { PageHeader, Surface } from '../../../components';
import {
  compareLabReports,
  LabComparisonResult,
  LabReportSource,
} from '../../../services/ai/labComparisonService';
import { geminiService } from '../../../services/ai/geminiService';
import { buildExtractionPrompt } from '../../../services/ai/prompts';
import { formatDateStandard } from '../../../utils/dateUtils';
import { ensureArray } from '../../../utils';
import toast from 'react-hot-toast';

export const ComparisonPage: React.FC = () => {
  const { products, batches, aiLearnedMappings } = useAppStore();
  const { testResults: hydratedResults } = useDataGraph();

  // Mode: 'BATCH_SELECT' (So sánh 2 phiếu của cùng lô trong hệ thống) vs 'FILE_UPLOAD' (Upload 2 file mới)
  const [compareMode, setCompareMode] = useState<'BATCH_SELECT' | 'FILE_UPLOAD'>('BATCH_SELECT');

  // State cho BATCH_SELECT
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedResult1Id, setSelectedResult1Id] = useState<string>('');
  const [selectedResult2Id, setSelectedResult2Id] = useState<string>('');

  // State cho FILE_UPLOAD
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [uploadStep, setUploadStep] = useState<string>('');

  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<LabComparisonResult | null>(null);

  // Lọc danh sách lô theo sản phẩm đã chọn
  const filteredBatches = useMemo(() => {
    if (!selectedProductId) return batches;
    return batches.filter((b) => b.productId === selectedProductId);
  }, [batches, selectedProductId]);

  // Lấy các phiếu kiểm nghiệm của Lô đã chọn
  const batchTestResults = useMemo(() => {
    if (!selectedBatchId) return [];
    return hydratedResults.filter(
      (r) => r.batchId === selectedBatchId || r.batch?.id === selectedBatchId
    );
  }, [hydratedResults, selectedBatchId]);

  // Phân tách phiếu nội bộ vs ngoại kiểm để gợi ý người dùng chọn
  const internalResults = useMemo(() => {
    return batchTestResults.filter(
      (r) =>
        !r.labName ||
        r.labName.toLowerCase().includes('nội bộ') ||
        r.labName.toLowerCase().includes('qc') ||
        r.labName.toLowerCase().includes('v-biotech')
    );
  }, [batchTestResults]);

  const externalResults = useMemo(() => {
    return batchTestResults.filter(
      (r) =>
        r.labName &&
        !r.labName.toLowerCase().includes('nội bộ') &&
        !r.labName.toLowerCase().includes('v-biotech')
    );
  }, [batchTestResults]);

  // Khi chọn lô, tự động điền sẵn 1 phiếu nội bộ và 1 phiếu ngoại kiểm nếu có
  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId);
    setComparisonResult(null);
    const relatedResults = hydratedResults.filter(
      (r) => r.batchId === batchId || r.batch?.id === batchId
    );
    if (relatedResults.length >= 2) {
      setSelectedResult1Id(relatedResults[0].id);
      setSelectedResult2Id(relatedResults[1].id);
    } else if (relatedResults.length === 1) {
      setSelectedResult1Id(relatedResults[0].id);
      setSelectedResult2Id('');
    } else {
      setSelectedResult1Id('');
      setSelectedResult2Id('');
    }
  };

  const handleRunBatchComparison = async () => {
    if (!selectedResult1Id || !selectedResult2Id) {
      toast.error('Vui lòng chọn đầy đủ 2 phiếu kiểm nghiệm cần đối chiếu.');
      return;
    }
    if (selectedResult1Id === selectedResult2Id) {
      toast.error('Vui lòng chọn 2 phiếu kiểm nghiệm khác nhau để đối chiếu.');
      return;
    }

    const r1 = hydratedResults.find((r) => r.id === selectedResult1Id);
    const r2 = hydratedResults.find((r) => r.id === selectedResult2Id);
    if (!r1 || !r2) {
      toast.error('Không tìm thấy dữ liệu phiếu kiểm nghiệm.');
      return;
    }

    const targetBatch = batches.find((b) => b.id === selectedBatchId) || r1.batch || r2.batch;

    setIsComparing(true);
    try {
      const report1: LabReportSource = {
        title: `Phiếu 1 (${r1.labName || 'Nội bộ'})`,
        labName: r1.labName || 'QC Nội bộ',
        testDate: r1.testDate,
        batchNo: targetBatch?.batchNo,
        overallStatus: r1.overallStatus,
        results: ensureArray(r1.results),
      };

      const report2: LabReportSource = {
        title: `Phiếu 2 (${r2.labName || 'Ngoại kiểm'})`,
        labName: r2.labName || 'Đơn vị kiểm nghiệm bên ngoài',
        testDate: r2.testDate,
        batchNo: targetBatch?.batchNo,
        overallStatus: r2.overallStatus,
        results: ensureArray(r2.results),
      };

      const res = await compareLabReports(report1, report2, aiLearnedMappings);
      setComparisonResult(res);
      toast.success('Đã đối chiếu thành công hai phiếu kiểm nghiệm.');
    } catch (err: any) {
      toast.error('Lỗi đối chiếu: ' + (err.message || 'Không thể thực hiện.'));
    } finally {
      setIsComparing(false);
    }
  };

  const handleRunFileComparison = async () => {
    if (!file1 || !file2) {
      toast.error('Vui lòng tải lên cả 2 tệp PDF hoặc ảnh phiếu kiểm nghiệm.');
      return;
    }

    setIsComparing(true);
    try {
      setUploadStep('AI đang trích xuất dữ liệu Phiếu 1...');
      const prompt = buildExtractionPrompt([]);
      const parsed1 = await geminiService.extractDataFromDocument(file1, prompt);

      setUploadStep('AI đang trích xuất dữ liệu Phiếu 2...');
      const parsed2 = await geminiService.extractDataFromDocument(file2, prompt);

      setUploadStep('Đang phân tích sai lệch và tính toán RPD...');
      const report1: LabReportSource = {
        title: file1.name,
        labName: parsed1.labName || 'Tài liệu 1',
        testDate: parsed1.testDate,
        batchNo: parsed1.batchNo,
        overallStatus: parsed1.overallStatus,
        results: parsed1.results || [],
      };

      const report2: LabReportSource = {
        title: file2.name,
        labName: parsed2.labName || 'Tài liệu 2',
        testDate: parsed2.testDate,
        batchNo: parsed2.batchNo,
        overallStatus: parsed2.overallStatus,
        results: parsed2.results || [],
      };

      const res = await compareLabReports(report1, report2, aiLearnedMappings);
      setComparisonResult(res);
      toast.success('Đã trích xuất và đối chiếu thành công hai tài liệu.');
    } catch (err: any) {
      toast.error('Lỗi xử lý file: ' + (err.message || 'Vui lòng kiểm tra lại tài liệu.'));
    } finally {
      setIsComparing(false);
      setUploadStep('');
    }
  };

  const getDeviationBadge = (level: string) => {
    switch (level) {
      case 'EXCELLENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircleIcon className="w-3.5 h-3.5" /> Đồng nhất cao (≤5%)
          </span>
        );
      case 'ACCEPTABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            <CheckCircleIcon className="w-3.5 h-3.5" /> Chấp nhận được (≤12%)
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Cần lưu ý (&gt;12%)
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            <XCircleIcon className="w-3.5 h-3.5" /> Bất thường / Mâu thuẫn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-2 text-ink-muted border border-border">
            Định tính / Khác
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        title="So sánh Đối chiếu Phòng kiểm nghiệm"
        subtitle="Đối chiếu chênh lệch chỉ tiêu giữa Phiếu kiểm nghiệm Nội bộ và Bên ngoài của cùng một Lô sản xuất."
        icon={ScaleIcon}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!comparisonResult}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface hover:bg-surface-2 text-ink text-xs font-medium border border-border transition-colors disabled:opacity-40"
            >
              <PrinterIcon className="w-4 h-4" />
              In Báo cáo Đối chiếu
            </button>
          </div>
        }
      />

      {/* Control Panel: Chọn chế độ & Lựa chọn Phiếu */}
      <Surface variant="flat" padding="lg">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCompareMode('BATCH_SELECT');
                setComparisonResult(null);
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                compareMode === 'BATCH_SELECT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-surface-2 text-ink-soft hover:bg-surface-3'
              }`}
            >
              Chọn Lô & Phiếu trên Hệ thống
            </button>
            <button
              type="button"
              onClick={() => {
                setCompareMode('FILE_UPLOAD');
                setComparisonResult(null);
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                compareMode === 'FILE_UPLOAD'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-surface-2 text-ink-soft hover:bg-surface-3'
              }`}
            >
              Tải lên 2 tài liệu PDF / Ảnh (AI Scan)
            </button>
          </div>

          <span className="text-xs text-ink-muted flex items-center gap-1">
            <InformationCircleIcon className="w-4 h-4 text-emerald-600" />
            Hỗ trợ đánh giá sai lệch RPD &amp; kiểm tra tương đương đơn vị / phương pháp thử.
          </span>
        </div>

        {compareMode === 'BATCH_SELECT' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  1. Chọn Sản phẩm
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedBatchId('');
                    setSelectedResult1Id('');
                    setSelectedResult2Id('');
                    setComparisonResult(null);
                  }}
                  className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Tất cả sản phẩm ({products.length}) --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  2. Chọn Lô sản xuất cần đối chiếu
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => handleBatchChange(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                >
                  <option value="">-- Chọn số lô ({filteredBatches.length} lô khả dụng) --</option>
                  {filteredBatches.map((b) => {
                    const prodName =
                      (b as any).product?.name ||
                      products.find((p) => p.id === b.productId)?.name ||
                      'Sản phẩm';
                    return (
                      <option key={b.id} value={b.id}>
                        {b.batchNo} · {prodName}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {selectedBatchId && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="p-3 bg-surface-2/60 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <BuildingOffice2Icon className="w-4 h-4 text-emerald-600" />
                      Phiếu 1 (Nội bộ QC)
                    </span>
                    <span className="text-[10px] text-ink-muted">
                      {internalResults.length} phiếu nội bộ
                    </span>
                  </div>
                  <select
                    value={selectedResult1Id}
                    onChange={(e) => setSelectedResult1Id(e.target.value)}
                    className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Chọn phiếu 1 --</option>
                    {batchTestResults.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.labName || 'Nội bộ QC'} · Ngày {formatDateStandard(r.testDate)} (
                        {r.overallStatus})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-surface-2/60 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <BuildingOffice2Icon className="w-4 h-4 text-blue-600" />
                      Phiếu 2 (Phòng kiểm nghiệm Ngoại kiểm / Đối chứng)
                    </span>
                    <span className="text-[10px] text-ink-muted">
                      {externalResults.length} phiếu ngoại kiểm
                    </span>
                  </div>
                  <select
                    value={selectedResult2Id}
                    onChange={(e) => setSelectedResult2Id(e.target.value)}
                    className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Chọn phiếu 2 --</option>
                    {batchTestResults.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.labName || 'Lab'} · Ngày {formatDateStandard(r.testDate)} (
                        {r.overallStatus})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleRunBatchComparison}
                disabled={isComparing || !selectedResult1Id || !selectedResult2Id}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-40 cursor-pointer"
              >
                {isComparing ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Đang đối chiếu...
                  </>
                ) : (
                  <>
                    <ScaleIcon className="w-4 h-4" />
                    Thực hiện Đối chiếu 2 Phiếu
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-2/50 border border-dashed border-border rounded-xl text-center space-y-2">
                <DocumentArrowUpIcon className="w-8 h-8 mx-auto text-emerald-600" />
                <p className="text-xs font-bold text-ink">Tài liệu Phiếu 1 (Nội bộ)</p>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setFile1(e.target.files?.[0] || null)}
                  className="text-xs text-ink-muted file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-surface-3 file:text-ink cursor-pointer"
                />
                {file1 && (
                  <p className="text-[11px] text-emerald-600 font-mono truncate">{file1.name}</p>
                )}
              </div>

              <div className="p-4 bg-surface-2/50 border border-dashed border-border rounded-xl text-center space-y-2">
                <DocumentArrowUpIcon className="w-8 h-8 mx-auto text-blue-600" />
                <p className="text-xs font-bold text-ink">
                  Tài liệu Phiếu 2 (Ngoại kiểm / Quatest / CASE...)
                </p>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setFile2(e.target.files?.[0] || null)}
                  className="text-xs text-ink-muted file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-surface-3 file:text-ink cursor-pointer"
                />
                {file2 && (
                  <p className="text-[11px] text-blue-600 font-mono truncate">{file2.name}</p>
                )}
              </div>
            </div>

            {uploadStep && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin text-emerald-600" />
                {uploadStep}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleRunFileComparison}
                disabled={isComparing || !file1 || !file2}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs disabled:opacity-40 cursor-pointer"
              >
                {isComparing ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Đang quét &amp; đối chiếu...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4" />
                    Trích xuất &amp; Đối chiếu AI
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Surface>

      {/* Kết quả so sánh */}
      {comparisonResult && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header KPI Thống kê nhanh */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Surface variant="flat" padding="md" className="border-l-4 border-l-emerald-500">
              <p className="text-xs text-ink-muted font-medium">Chỉ tiêu đối chiếu</p>
              <h3 className="text-2xl font-bold text-ink mt-1">
                {comparisonResult.metrics.totalEvaluated}
              </h3>
              <p className="text-[11px] text-ink-muted mt-0.5">Số chỉ tiêu khớp nối</p>
            </Surface>

            <Surface variant="flat" padding="md" className="border-l-4 border-l-blue-500">
              <p className="text-xs text-ink-muted font-medium">Tỷ lệ đồng thuận</p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {comparisonResult.metrics.agreementRatePercent}%
              </h3>
              <p className="text-[11px] text-ink-muted mt-0.5">
                {comparisonResult.metrics.consistentCount} chỉ tiêu đạt chuẩn
              </p>
            </Surface>

            <Surface variant="flat" padding="md" className="border-l-4 border-l-purple-500">
              <p className="text-xs text-ink-muted font-medium">Sai lệch RPD trung bình</p>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {comparisonResult.metrics.avgRpdPercent}%
              </h3>
              <p className="text-[11px] text-ink-muted mt-0.5">Relative Percent Diff</p>
            </Surface>

            <Surface variant="flat" padding="md" className="border-l-4 border-l-rose-500">
              <p className="text-xs text-ink-muted font-medium">Sai lệch nghiêm trọng</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {comparisonResult.metrics.criticalDiffCount}
              </h3>
              <p className="text-[11px] text-ink-muted mt-0.5">Mâu thuẫn hoặc &gt;25% RPD</p>
            </Surface>
          </div>

          {/* Bảng chi tiết chỉ tiêu so sánh */}
          <Surface variant="flat" padding="lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Bảng Đối chiếu Từng Chỉ tiêu Kỹ thuật
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Đối chiếu giữa <strong>{comparisonResult.report1.labName}</strong> và{' '}
                  <strong>{comparisonResult.report2.labName}</strong>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-2/60 text-ink-muted font-semibold border-b border-border">
                  <tr>
                    <th className="px-3 py-2.5">Chỉ tiêu</th>
                    <th className="px-3 py-2.5 text-center">Tiêu chuẩn / Mức YC</th>
                    <th className="px-3 py-2.5 text-right bg-emerald-500/5">
                      {comparisonResult.report1.labName}
                    </th>
                    <th className="px-3 py-2.5 text-right bg-blue-500/5">
                      {comparisonResult.report2.labName}
                    </th>
                    <th className="px-3 py-2.5 text-center">Chênh lệch (% RPD)</th>
                    <th className="px-3 py-2.5 text-center">Đánh giá sai số</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisonResult.entries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-surface-2/60 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-ink">
                        {entry.criteriaName}
                        {entry.source1Method && (
                          <span className="block text-[10px] text-ink-muted">
                            PP: {entry.source1Method}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-ink-muted font-mono whitespace-nowrap">
                        {entry.limit || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-ink bg-emerald-500/5">
                        <span>{entry.source1Value}</span>{' '}
                        <span className="text-[10px] text-ink-muted">{entry.source1Unit}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-ink bg-blue-500/5">
                        <span>{entry.source2Value}</span>{' '}
                        <span className="text-[10px] text-ink-muted">{entry.source2Unit}</span>
                        {entry.source1Unit &&
                          entry.source2Unit &&
                          entry.source1Unit !== entry.source2Unit && (
                            <span className="block text-[10px] text-amber-600 font-semibold">
                              ⚠️ Khác ĐVT ({entry.source1Unit} vs {entry.source2Unit})
                            </span>
                          )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold">
                        {entry.rpd !== undefined ? `${entry.rpd}%` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {getDeviationBadge(entry.deviationLevel)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>

          {/* Đánh giá Sai số Hệ thống (Lab Bias Assessment) */}
          <Surface variant="flat" padding="lg">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <SparklesIcon className="w-4 h-4 text-purple-600" />
              Đánh giá Sai số Hệ thống Phòng Lab (Lab Bias Analysis)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-surface-2/60 rounded-xl border border-border space-y-1.5">
                <span className="font-semibold text-ink">
                  Chiều hướng sai số (Directional Bias):
                </span>
                <p className="text-ink-soft">{comparisonResult.biasAssessment.assessmentSummary}</p>
                <div className="flex gap-4 pt-1 font-mono text-[11px]">
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {comparisonResult.report1.labName} cao hơn:{' '}
                    {comparisonResult.biasAssessment.source1HigherCount}
                  </span>
                  <span className="text-blue-700 dark:text-blue-400">
                    {comparisonResult.report2.labName} cao hơn:{' '}
                    {comparisonResult.biasAssessment.source2HigherCount}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-surface-2/60 rounded-xl border border-border space-y-1.5">
                <span className="font-semibold text-ink">Khuyến nghị kỹ thuật QA:</span>
                <ul className="list-disc list-inside space-y-0.5 text-ink-muted">
                  {comparisonResult.biasAssessment.actionRecommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
};

export default ComparisonPage;
