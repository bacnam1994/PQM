/**
 * src/components/features/AIAnalysisCard.tsx
 * Visual component for Evidence-First Structured AI Output (Phase 16)
 *
 * Displays Summary, Risk Level, Findings with verified Evidence citations,
 * Recommendations, and mandatory QA/QC limitations.
 */

import React from 'react';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  DocumentCheckIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import type { AISummaryResult, AIAuditMetadata } from '../../services/ai/aiBackendClient';

interface AIAnalysisCardProps {
  data: AISummaryResult;
  metadata?: AIAuditMetadata;
  className?: string;
}

export const AIAnalysisCard: React.FC<AIAnalysisCardProps> = ({
  data,
  metadata,
  className = '',
}) => {
  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return {
          bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          label: 'RỦI RO THẤP (LOW RISK)',
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
          label: 'RỦI RO TRUNG BÌNH (MEDIUM RISK)',
        };
      case 'HIGH':
        return {
          bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
          label: 'RỦI RO CAO (HIGH RISK)',
        };
      case 'CRITICAL':
        return {
          bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
          label: 'NGHIÊM TRỌNG (CRITICAL RISK)',
        };
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
          label: risk,
        };
    }
  };

  const riskBadge = getRiskBadge(data.riskLevel);

  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4 text-ink ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight">
              Đánh giá Trí tuệ Nhân tạo (AI Decision Support)
            </h4>
            {metadata && (
              <p className="text-[10px] text-ink-muted">
                Mã tra cứu: <span className="font-mono">{metadata.aiAnalysisId}</span> | Model:{' '}
                {metadata.model}
              </p>
            )}
          </div>
        </div>

        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${riskBadge.bg}`}>
          {riskBadge.label}
        </span>
      </div>

      {/* Summary */}
      <div className="space-y-1">
        <h5 className="text-xs font-bold text-ink-muted uppercase tracking-wider">
          Tóm tắt phân tích kỹ thuật
        </h5>
        <p className="text-xs leading-relaxed font-medium bg-surface-2 p-3 rounded-xl border border-border">
          {data.summary}
        </p>
      </div>

      {/* Findings with Evidence (Phase 8 & 16) */}
      {data.findings && data.findings.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
            <DocumentCheckIcon className="w-4 h-4 text-primary" />
            Các phát hiện trọng yếu & Bằng chứng ({data.findings.length})
          </h5>
          <div className="space-y-2.5">
            {data.findings.map((finding, idx) => (
              <div
                key={idx}
                className="p-3 bg-surface-2/60 border border-border rounded-xl space-y-2 text-xs"
              >
                <div className="font-bold text-ink flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  {finding.title}
                </div>
                <p className="text-ink-muted pl-6">{finding.description}</p>

                {/* Evidence Chips */}
                {finding.evidence && finding.evidence.length > 0 && (
                  <div className="pl-6 pt-1 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-ink-muted font-bold">
                      Bằng chứng đối chiếu:
                    </span>
                    {finding.evidence.map((ev, evIdx) => (
                      <span
                        key={evIdx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border font-mono text-[10px] text-primary"
                      >
                        <span className="opacity-70 font-sans">{ev.sourceType}:</span>
                        <strong>{ev.sourceId}</strong>
                        {ev.quoteOrMetric && (
                          <span className="opacity-80">({ev.quoteOrMetric})</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="space-y-1.5">
          <h5 className="text-xs font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardDocumentListIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Khuyến nghị kỹ thuật cho QA/QC
          </h5>
          <ul className="list-disc list-inside space-y-1 text-xs text-ink pl-1">
            {data.recommendations.map((rec, idx) => (
              <li key={idx} className="leading-relaxed">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mandatory Limitations Banner (Phase 11) */}
      {data.limitations && data.limitations.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-0.5">
            <p className="font-bold text-[11px]">LƯU Ý GIỚI HẠN & THẨM QUYỀN:</p>
            {data.limitations.map((lim, idx) => (
              <p key={idx} className="text-[11px] opacity-90 leading-relaxed">
                • {lim}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
