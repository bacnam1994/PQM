import React from 'react';
import { 
  ArrowLeftIcon, 
  ArrowPathIcon, 
  CloudIcon, 
  DocumentDuplicateIcon, 
  ScaleIcon, 
  InformationCircleIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { VoiceInputButton } from '../../../../components/features/VoiceInputButton';
import { ParsedVoiceCriteria } from '../../../../services/ai/voiceParserService';

export interface AIScanInfo {
  documentType?: string;
  pageCount?: number;
  notes?: string;
  fileCount?: number;
}

export interface TestResultHeaderProps {
  isEditMode: boolean;
  onBack: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isAiProcessing: boolean;
  onAiFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyVoiceCriteria: (entries: ParsedVoiceCriteria[]) => void;
  allActiveTccsNames: string[];
  onOpenLabComparison: () => void;
  onOpenGDScan: () => void;
  aiScanInfo: AIScanInfo | null;
  onClearAiScanInfo: () => void;
}

export const TestResultHeader: React.FC<TestResultHeaderProps> = ({
  isEditMode,
  onBack,
  fileInputRef,
  isAiProcessing,
  onAiFileSelect,
  onApplyVoiceCriteria,
  allActiveTccsNames,
  onOpenLabComparison,
  onOpenGDScan,
  aiScanInfo,
  onClearAiScanInfo,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="p-2 bg-surface text-ink-muted hover:text-emerald-600 rounded-xl border border-border shadow-sm transition-all"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            {isEditMode ? 'Chỉnh sửa Phiếu Kiểm Nghiệm' : 'Nhập Phiếu Kiểm Nghiệm Mới'}
          </h1>
        </div>

        <div className="flex-1" />

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,application/pdf"
          multiple
          onChange={onAiFileSelect}
        />

        <VoiceInputButton
          onApplyCriteria={onApplyVoiceCriteria}
          availableCriteriaNames={allActiveTccsNames}
        />

        <button
          type="button"
          onClick={onOpenLabComparison}
          className="flex items-center gap-2 px-3.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 rounded-xl font-semibold text-xs border border-blue-500/20 transition-all shadow-sm"
          title="Đối chiếu kết quả giữa 2 phòng lab hoặc CoA nhà cung cấp"
        >
          <ScaleIcon className="w-4 h-4" />
          Đối chiếu Lab
        </button>

        <button
          type="button"
          disabled={isAiProcessing}
          onClick={onOpenGDScan}
          className="flex items-center gap-2 px-4 py-2 bg-surface text-ink hover:bg-surface-2 rounded-xl font-semibold text-xs tracking-wider border border-border shadow-sm transition-all disabled:opacity-50"
        >
          {isAiProcessing ? <ArrowPathIcon className="w-4 h-4 animate-spin text-emerald-600" /> : <CloudIcon className="w-4 h-4 text-emerald-600" />}
          Quét Google Drive
        </button>

        <button
          type="button"
          disabled={isAiProcessing}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-xs tracking-wider hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
        >
          {isAiProcessing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <DocumentDuplicateIcon className="w-4 h-4" />}
          {isAiProcessing ? 'Đang trích xuất...' : 'Nhập dữ liệu bằng AI'}
        </button>
      </div>

      {aiScanInfo && (
        <div className="flex items-start gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <InformationCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Kết quả AI Scan {aiScanInfo.fileCount && aiScanInfo.fileCount > 1 ? `– Đã đọc ${aiScanInfo.fileCount} file` : ''}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {aiScanInfo.documentType && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  📄 Loại phiếu: <strong>{aiScanInfo.documentType}</strong>
                </span>
              )}
              {aiScanInfo.pageCount != null && aiScanInfo.pageCount > 0 && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  📖 Số trang: <strong>{aiScanInfo.pageCount}</strong>
                </span>
              )}
            </div>
            {aiScanInfo.notes && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5 font-medium">
                ⚠️ Ghi chú từ phiếu: {aiScanInfo.notes}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClearAiScanInfo}
            className="p-1 hover:bg-emerald-500/20 rounded text-emerald-600 dark:text-emerald-400 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
