import React from 'react';
import { 
  ClockIcon, 
  SparklesIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';

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
    <div className="bg-gradient-to-br from-emerald-500/10 via-surface to-teal-500/10 p-5 rounded-2xl border border-emerald-500/20 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-xl shadow-md">
            <ClockIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-ink text-sm flex items-center gap-2">
              Dự báo Động học Suy giảm & Độ ổn định (ICH Q1A)
              <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full uppercase border border-emerald-500/20">
                AI Forecasting
              </span>
            </h4>
            <p className="text-xs text-ink-muted">
              Ước tính tốc độ suy giảm hoạt chất và thời điểm chạm ngưỡng Min theo thời gian bảo quản.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleEnrichStabilityWithAI}
          disabled={isGeneratingAiStability}
          className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isGeneratingAiStability ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4 text-amber-300" />}
          Phân tích sâu bằng AI
        </button>
      </div>

      <div className="p-4 bg-surface rounded-xl border border-border text-xs font-medium text-ink leading-relaxed shadow-xs">
        {aiStabilitySummary || stabilityReport.executiveSummary}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {stabilityReport.forecasts.map((f: any) => {
          const isHighRisk = f.riskLevel === 'HIGH_EXPIRY_RISK';
          const isModRisk = f.riskLevel === 'MODERATE_RISK';
          return (
            <div
              key={f.criteriaName}
              className={`p-3.5 rounded-xl border transition-all ${
                isHighRisk
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : isModRisk
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-surface border-border shadow-xs'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-ink truncate pr-2 text-xs">{f.criteriaName}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  isHighRisk ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30' :
                  isModRisk ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30' :
                  'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isHighRisk ? 'Nguy cơ cao 🚨' : isModRisk ? 'Cần lưu ý ⚠️' : 'Ổn định tốt ✓'}
                </span>
              </div>
              <div className="mt-2.5 space-y-1.5 text-[11px] font-medium text-ink-muted">
                <div className="flex justify-between">
                  <span>Tốc độ suy giảm:</span>
                  <span className="font-bold text-ink">
                    {(f.decayRatePerMonth * 12).toFixed(1)}{f.unit}/năm (R²={f.rSquared})
                  </span>
                </div>
                {f.projectedMonthToMinLimit ? (
                  <div className="flex justify-between">
                    <span>Dự kiến chạm Min ({f.minLimit}{f.unit}):</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
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
