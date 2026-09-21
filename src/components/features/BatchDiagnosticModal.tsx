import React, { useState, useMemo } from 'react';
import {
  XMarkIcon,
  CommandLineIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store/useAppStore';
import {
  BatchDiagnosticService,
  BatchDiagnosticReport,
} from '../../domain/batch/batchDiagnosticService';
import toast from 'react-hot-toast';

interface BatchDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBatchIdentifier?: string;
}

export const BatchDiagnosticModal: React.FC<BatchDiagnosticModalProps> = ({
  isOpen,
  onClose,
  initialBatchIdentifier = '',
}) => {
  const { batches, testResults, tccsList } = useAppStore();
  const [searchTerm, setSearchTerm] = useState(initialBatchIdentifier || '702601');
  const [copied, setCopied] = useState(false);

  const report: BatchDiagnosticReport = useMemo(() => {
    return BatchDiagnosticService.diagnoseBatch(searchTerm, {
      batches,
      testResults,
      tccsList,
    });
  }, [searchTerm, batches, testResults, tccsList]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(report.asciiTree);
    setCopied(true);
    toast.success('Đã sao chép cây chẩn đoán ASCII vào clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const isPass = report.canonicalResult.status === 'PASS';
  const isFail = report.canonicalResult.status === 'FAIL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-border bg-surface flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/50 rounded-xl">
              <CommandLineIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink">
                  Batch Quality & Lifecycle Diagnostic
                </h3>
                <span className="text-[10px] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-sky-200 dark:border-sky-800/40">
                  Audit Trace
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Truy vết cây quyết định, thẩm định chỉ tiêu kỹ thuật & điều kiện xuất xưởng SSoT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-ink rounded-lg text-xs font-semibold transition-all border border-border"
            >
              {copied ? (
                <ClipboardDocumentCheckIcon className="h-4 w-4 text-emerald-600" />
              ) : (
                <ClipboardDocumentIcon className="h-4 w-4" />
              )}
              {copied ? 'Đã chép' : 'Sao chép Cây ASCII'}
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

        {/* Search / Target Selector */}
        <div className="px-6 py-3 bg-surface-2 border-b border-border flex items-center gap-3">
          <label className="text-xs font-semibold text-ink-muted whitespace-nowrap">
            Tra cứu Lô:
          </label>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập số lô (ví dụ 702601) hoặc ID..."
              className="w-full max-w-sm px-3 py-1.5 bg-surface text-ink text-xs rounded-lg border border-border focus:outline-hidden focus:ring-1 focus:ring-primary font-mono"
            />
            <button
              type="button"
              onClick={() => setSearchTerm('702601')}
              className="px-2.5 py-1 bg-surface text-ink-muted hover:text-primary text-[11px] rounded-lg border border-border transition-colors font-medium"
            >
              Lô 702601
            </button>
          </div>
        </div>

        {/* Status Highlights */}
        <div className="px-6 py-3 border-b border-border bg-surface grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-2.5 rounded-xl bg-surface-2 border border-border">
            <p className="text-[10px] font-bold text-ink-muted uppercase">Lô sản xuất</p>
            <p className="text-sm font-bold text-ink font-mono mt-0.5">
              {report.batchInfo.batchNo}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-2 border border-border">
            <p className="text-[10px] font-bold text-ink-muted uppercase">Chất lượng SSoT</p>
            <p
              className={`text-sm font-bold mt-0.5 ${
                isPass ? 'text-emerald-600' : isFail ? 'text-rose-600' : 'text-amber-600'
              }`}
            >
              {report.canonicalResult.status}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-2 border border-border">
            <p className="text-[10px] font-bold text-ink-muted uppercase">Tiến độ kiểm nghiệm</p>
            <p className="text-sm font-bold text-ink mt-0.5">
              {report.completion.completionPercentage}% ({report.completion.testedCriteriaCount}/
              {report.completion.requiredCriteriaCount})
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-2 border border-border">
            <p className="text-[10px] font-bold text-ink-muted uppercase">Release Gate</p>
            <p
              className={`text-sm font-bold mt-0.5 ${
                report.releaseGate.isEligible ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {report.releaseGate.isEligible ? 'Đủ điều kiện' : 'Bị chặn (Blocked)'}
            </p>
          </div>
        </div>

        {/* ASCII Tree Output */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed select-text">
          <pre className="whitespace-pre font-mono">{report.asciiTree}</pre>
        </div>
      </div>
    </div>
  );
};
