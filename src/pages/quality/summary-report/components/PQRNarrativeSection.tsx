import React from 'react';
import { Sparkles, Copy, Check, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
    <DSCard className="p-5 border-l-4 border-indigo-500 space-y-4 bg-gradient-to-br from-indigo-50/20 via-white to-purple-50/10 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-purple-950/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">
              Nhận xét Đánh giá Chất lượng Định kỳ (PQR Executive Narrative)
            </h3>
            <p className="text-[11px] text-slate-400">
              Văn bản được tổng hợp và phân tích tự động theo chuẩn GMP / PIC/S {pqrNarrative.isAiEnriched ? '(AI Enriched)' : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => copyToClipboard(fullReportText)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          <span>{copied ? 'Đã sao chép' : 'Sao chép báo cáo'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-1.5 shadow-2xs">
          <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[10px]">
            1. Tóm tắt điều hành
          </span>
          <p className="text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
            {pqrNarrative.overviewSection}
          </p>
        </div>

        <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-1.5 shadow-2xs">
          <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[10px]">
            2. Năng lực quy trình & SPC
          </span>
          <p className="text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
            {pqrNarrative.cpkEvaluationSection}
          </p>
        </div>

        <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-1.5 shadow-2xs">
          <span className="font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
            <ShieldAlert size={12} /> 3. Phân tích OOS & Sai lệch
          </span>
          <p className="text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
            {pqrNarrative.deviationSection}
          </p>
        </div>

        <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-1.5 shadow-2xs">
          <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
            <CheckCircle2 size={12} /> 4. Khuyến nghị & Kế hoạch
          </span>
          <p className="text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
            {pqrNarrative.conclusionAndPlanSection}
          </p>
        </div>
      </div>
    </DSCard>
  );
};
