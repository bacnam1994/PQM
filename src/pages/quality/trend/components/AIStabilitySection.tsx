import React from 'react';
import { Clock, Sparkles, Loader2 } from 'lucide-react';

interface AIStabilitySectionProps {
  stabilityReport: any;
  aiStabilitySummary: string | null;
  isGeneratingAiStability: boolean;
  handleEnrichStabilityWithAI: () => Promise<void>;
}

export const AIStabilitySection: React.FC<AIStabilitySectionProps> = ({
  stabilityReport,
  aiStabilitySummary,
  isGeneratingAiStability,
  handleEnrichStabilityWithAI
}) => {
  if (!stabilityReport || stabilityReport.forecasts.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-cyan-500/10 p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl shadow-md">
            <Clock size={18} />
          </div>
          <div>
            <h4 className="font-black text-slate-800 dark:text-zinc-100 text-sm flex items-center gap-2">
              Dự báo Động học Suy giảm & Độ ổn định (ICH Q1A)
              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black px-2 py-0.5 rounded-full uppercase">
                AI Forecasting
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Ước tính tốc độ suy giảm hoạt chất và thời điểm chạm ngưỡng Min theo thời gian bảo quản.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleEnrichStabilityWithAI}
          disabled={isGeneratingAiStability}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
        >
          {isGeneratingAiStability ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Phân tích sâu bằng AI
        </button>
      </div>

      <div className="p-3.5 bg-white/80 dark:bg-zinc-900/80 rounded-xl border border-indigo-100/80 dark:border-indigo-900/40 text-xs font-medium text-slate-700 dark:text-zinc-200">
        {aiStabilitySummary || stabilityReport.executiveSummary}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {stabilityReport.forecasts.map((f: any) => {
          const isHighRisk = f.riskLevel === 'HIGH_EXPIRY_RISK';
          const isModRisk = f.riskLevel === 'MODERATE_RISK';
          return (
            <div
              key={f.criteriaName}
              className={`p-3 rounded-xl border transition-all ${
                isHighRisk
                  ? 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                  : isModRisk
                  ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                  : 'bg-white/90 dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-black text-slate-800 dark:text-zinc-100 truncate pr-2">{f.criteriaName}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isHighRisk ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' :
                  isModRisk ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                }`}>
                  {isHighRisk ? 'Nguy cơ cao 🚨' : isModRisk ? 'Cần lưu ý ⚠️' : 'Ổn định tốt ✓'}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span>Tốc độ suy giảm:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    {(f.decayRatePerMonth * 12).toFixed(1)}{f.unit}/năm (R²={f.rSquared})
                  </span>
                </div>
                {f.projectedMonthToMinLimit ? (
                  <div className="flex justify-between">
                    <span>Dự kiến chạm Min ({f.minLimit}{f.unit}):</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                      Sau {f.projectedMonthToMinLimit} tháng
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
