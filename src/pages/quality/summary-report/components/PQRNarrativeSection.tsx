import React from 'react';
import { 
  SparklesIcon, 
  ClipboardDocumentIcon, 
  CheckIcon, 
  ShieldExclamationIcon, 
  CheckCircleIcon 
} from '@heroicons/react/24/outline';
import { DSCard } from '../../../../components';
import { PQRExecutiveNarrative } from '../../../../services/ai/pqrNarrativeService';

interface PQRNarrativeSectionProps {
  pqrNarrative: PQRExecutiveNarrative | null;
  copied: boolean;
  copyToClipboard: (text: string) => void;
}

export const PQRNarrativeSection: React.FC<PQRNarrativeSectionProps> = ({
  pqrNarrative,
  copied,
  copyToClipboard
}) => {
  if (!pqrNarrative) return null;

  const fullReportText = pqrNarrative.fullNarrative || [
    `BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG SẢN PHẨM ĐỊNH KỲ (PQR/APR)`,
    `Thời gian tạo: ${pqrNarrative.generatedAt}`,
    `--------------------------------------------------`,
    `1. TÓM TẮT CHUNG:`,
    pqrNarrative.overviewSection,
    ``,
    `2. ĐÁNH GIÁ NĂNG LỰC QUY TRÌNH (SPC/Cpk):`,
    pqrNarrative.cpkEvaluationSection,
    ``,
    `3. PHÂN TÍCH SAI LỆCH & OOS:`,
    pqrNarrative.deviationSection,
    ``,
    `4. KẾT LUẬN & ĐỀ XUẤT CẢI TIẾN:`,
    pqrNarrative.conclusionAndPlanSection
  ].join('\n');

  return (
    <DSCard className="p-5 border-l-4 border-l-indigo-500 space-y-4 bg-gradient-to-br from-indigo-500/5 via-surface to-purple-500/5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-ink text-sm">
              Nhận xét Đánh giá Chất lượng Định kỳ (PQR Executive Narrative)
            </h3>
            <p className="text-[11px] text-ink-muted">
              Văn bản được tổng hợp và phân tích tự động theo chuẩn GMP / PIC/S {pqrNarrative.isAiEnriched ? '(AI Enriched)' : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => copyToClipboard(fullReportText)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-surface border border-border rounded-lg text-ink hover:bg-surface-2 transition-colors shadow-xs cursor-pointer"
        >
          {copied ? <CheckIcon className="w-4 h-4 text-emerald-500" /> : <ClipboardDocumentIcon className="w-4 h-4 text-ink-muted" />}
          <span>{copied ? 'Đã sao chép' : 'Sao chép báo cáo'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-surface rounded-xl border border-border space-y-2 shadow-xs">
          <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] block">
            1. Tóm tắt điều hành
          </span>
          <p className="text-ink leading-relaxed whitespace-pre-line text-xs">
            {pqrNarrative.overviewSection}
          </p>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-border space-y-2 shadow-xs">
          <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[11px] block">
            2. Năng lực quy trình & SPC
          </span>
          <p className="text-ink leading-relaxed whitespace-pre-line text-xs">
            {pqrNarrative.cpkEvaluationSection}
          </p>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-border space-y-2 shadow-xs">
          <span className="font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <ShieldExclamationIcon className="w-4 h-4" /> 3. Phân tích OOS & Sai lệch
          </span>
          <p className="text-ink leading-relaxed whitespace-pre-line text-xs">
            {pqrNarrative.deviationSection}
          </p>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-border space-y-2 shadow-xs">
          <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <CheckCircleIcon className="w-4 h-4" /> 4. Khuyến nghị & Kế hoạch
          </span>
          <p className="text-ink leading-relaxed whitespace-pre-line text-xs">
            {pqrNarrative.conclusionAndPlanSection}
          </p>
        </div>
      </div>
    </DSCard>
  );
};
