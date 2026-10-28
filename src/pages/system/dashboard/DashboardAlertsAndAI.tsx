import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldExclamationIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { QualityAnomaly } from '../../../types';

interface DashboardAlertsAndAIProps {
  alerts: QualityAnomaly[];
  onTriggerAI: (prompt: string) => void;
}

export const DashboardAlertsAndAI: React.FC<DashboardAlertsAndAIProps> = ({
  alerts,
  onTriggerAI,
}) => {
  const [customPrompt, setCustomPrompt] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      onTriggerAI(customPrompt.trim());
      setCustomPrompt('');
    }
  };

  const samplePrompts = [
    'Tóm tắt tình trạng chất lượng các lô hiện tại',
    'Phân tích nguyên nhân gốc (5 Why) chỉ tiêu OOS',
    'So sánh độ lệch Lab Nội bộ và Ngoại kiểm',
  ];

  return (
    <div className="space-y-5">
      {/* Widget 1: Quality Anomaly Alerts */}
      <section
        aria-label="Cảnh báo chất lượng phát hiện"
        className="p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/85 backdrop-blur-md border border-border/80 space-y-4 shadow-xs"
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ShieldExclamationIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-sm sm:text-base font-display">
                Cảnh báo chất lượng
              </h3>
              <p className="text-xs text-ink-muted">Điểm lệch chuẩn cần kiểm tra</p>
            </div>
          </div>

          <Link
            to="/alerts"
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline tabular-nums shrink-0"
          >
            Tất cả ({alerts.length})
          </Link>
        </div>

        <div className="divide-y divide-border/60">
          {alerts.slice(0, 4).map((anomaly, idx) => {
            const isHigh = anomaly.severity === 'HIGH';
            return (
              <div
                key={idx}
                className="py-3 px-2 -mx-2 rounded-xl hover:bg-surface-2/60 transition-colors duration-150 flex items-start gap-2.5 group"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                    isHigh ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                />

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                    {anomaly.title}
                  </div>
                  <div className="text-[11px] text-ink-muted line-clamp-2 mt-0.5 leading-relaxed">
                    {anomaly.detail}
                  </div>
                  {anomaly.batchNo && (
                    <div className="mt-1.5">
                      <span className="inline-block text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md bg-surface-2 border border-border/80 text-ink-soft">
                        Lô {anomaly.batchNo}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {alerts.length === 0 && (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <CheckCircleIcon className="w-7 h-7 text-emerald-500 mb-1.5" />
              <div className="text-xs font-semibold text-ink">Hệ thống vận hành ổn định</div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                Không có bất thường hoặc chỉ tiêu OOS cần xử lý.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Widget 2: AI Assistant Quick Prompts */}
      <section
        aria-label="Trợ lý AI PQM"
        className="p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/85 backdrop-blur-md relative overflow-hidden space-y-3.5 shadow-xs border border-border/80"
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <SparklesIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-sm sm:text-base font-display">
                Trợ lý AI PQM
              </h3>
              <p className="text-xs text-ink-muted">Tra cứu & phân tích theo yêu cầu</p>
            </div>
          </div>
        </div>

        {/* Ready-to-click prompt chips */}
        <div className="space-y-1.5">
          {samplePrompts.map((p, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onTriggerAI(p)}
              className="w-full text-left px-3 py-2.5 bg-surface-2/60 hover:bg-surface-2 border border-border/80 hover:border-emerald-500/40 rounded-xl text-xs text-ink-soft hover:text-ink transition-[border-color,background-color,color] duration-150 flex items-center gap-2 group cursor-pointer"
            >
              <span className="truncate flex-1">{p}</span>
              <ArrowRightIcon className="w-3.5 h-3.5 text-ink-faint group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-[transform,color] duration-150 shrink-0" />
            </button>
          ))}
        </div>

        {/* Quick prompt input box */}
        <form onSubmit={handleCustomSubmit} className="pt-1">
          <div className="relative flex items-center">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Đặt câu hỏi cho AI..."
              className="w-full text-xs px-3 py-2.5 pr-9 rounded-xl bg-surface-2/80 border border-border/80 text-ink placeholder:text-ink-muted focus:outline-hidden focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!customPrompt.trim()}
              className="absolute right-1.5 p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors cursor-pointer"
              title="Gửi câu hỏi"
              aria-label="Gửi câu hỏi"
            >
              <PaperAirplaneIcon className="w-3.5 h-3.5 -rotate-45" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
