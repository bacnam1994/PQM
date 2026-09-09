import React from 'react';
import { ArrowLeft, Loader2, HardDrive, Files, Scale, Info, X } from 'lucide-react';
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
      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="p-2 bg-white text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl shadow-sm transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          {isEditMode ? 'Chỉnh sửa Phiếu Kiểm Nghiệm' : 'Nhập Phiếu Kiểm Nghiệm Mới'}
        </h1>

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
          className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl font-bold text-xs border border-blue-200 dark:border-blue-800 transition-all shadow-sm"
          title="Đối chiếu kết quả giữa 2 phòng lab hoặc CoA nhà cung cấp"
        >
          <Scale size={14} className="text-blue-600 dark:text-blue-400" />
          Đối chiếu Lab
        </button>

        <button
          type="button"
          disabled={isAiProcessing}
          onClick={onOpenGDScan}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 shadow-lg shadow-slate-100 transition-all disabled:opacity-50 border border-slate-700"
        >
          {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
          Quét từ Google Drive
        </button>

        <button
          type="button"
          disabled={isAiProcessing}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
        >
          {isAiProcessing ? <Loader2 size={14} className="animate-spin" /> : <Files size={14} />}
          {isAiProcessing ? 'Đang trích xuất...' : 'Nhập dữ liệu bằng AI'}
        </button>
      </div>

      {aiScanInfo && (
        <div className="flex items-start gap-3 p-3.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
          <Info size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              Kết quả AI Scan {aiScanInfo.fileCount && aiScanInfo.fileCount > 1 ? `– Đã đọc ${aiScanInfo.fileCount} file` : ''}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {aiScanInfo.documentType && (
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                  📄 Loại phiếu: <strong>{aiScanInfo.documentType}</strong>
                </span>
              )}
              {aiScanInfo.pageCount != null && aiScanInfo.pageCount > 0 && (
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                  📖 Số trang: <strong>{aiScanInfo.pageCount}</strong>
                </span>
              )}
            </div>
            {aiScanInfo.notes && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1.5 font-medium">
                ⚠️ Ghi chú từ phiếu: {aiScanInfo.notes}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClearAiScanInfo}
            className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded text-indigo-400 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};
