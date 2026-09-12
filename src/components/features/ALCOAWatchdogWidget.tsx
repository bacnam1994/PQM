import React, { useState, useMemo } from 'react';
import { 
  ShieldCheckIcon, 
  ChevronDownIcon, 
  ChevronUpIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { auditDataIntegrity, DataIntegrityAuditReport, AuditLogEntry } from '../../services/ai/dataIntegrityService';
import { AuditLogRecord } from '../../services/auditService';
import { useAppStore } from '../../store/useAppStore';

interface ALCOAWatchdogWidgetProps {
  logs: AuditLogRecord[];
}

export const ALCOAWatchdogWidget: React.FC<ALCOAWatchdogWidgetProps> = ({ logs }) => {
  const { testResults } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);

  // Transform AuditLogRecord to AuditLogEntry
  const report = useMemo<DataIntegrityAuditReport>(() => {
    const transformed: AuditLogEntry[] = logs.map(l => ({
      id: l.id,
      userId: l.performedBy,
      userEmail: l.performedBy,
      userName: l.performedBy,
      action: l.action,
      entityType: (l.collection?.toUpperCase() as any) || 'SYSTEM',
      entityId: l.documentId || l.id,
      details: l.details,
      timestamp: String(l.timestamp)
    }));

    return auditDataIntegrity(transformed, testResults || []);
  }, [logs, testResults]);

  const isExcellent = report.grade === 'A_EXCELLENT';
  const isGood = report.grade === 'B_GOOD';
  const isWarning = report.grade === 'C_NEEDS_IMPROVEMENT';
  const isCritical = report.grade === 'D_CRITICAL_NON_COMPLIANCE';

  const scoreColor = isExcellent
    ? 'text-emerald-600 dark:text-emerald-400'
    : isGood
    ? 'text-blue-600 dark:text-blue-400'
    : isWarning
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-rose-600 dark:text-rose-400';

  const badgeBg = isExcellent
    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300'
    : isGood
    ? 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300'
    : isWarning
    ? 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300'
    : 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300';

  return (
    <div className="bg-surface rounded-xl border border-border p-5 shadow-xs transition-all overflow-hidden space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-ink uppercase tracking-tight">
                ALCOA+ Data Integrity Watchdog
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}>
                {isExcellent && 'GRADE A • TUÂN THỦ CAO'}
                {isGood && 'GRADE B • ĐẠT CHUẨN'}
                {isWarning && 'GRADE C • CẦN LƯU Ý'}
                {isCritical && 'GRADE D • NGUY CƠ VI PHẠM'}
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Giám sát toàn vẹn dữ liệu tự động theo US FDA 21 CFR Part 11 & WHO TRS 996 ({logs.length} bản ghi phân tích)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase text-ink-muted">Integrity Score</p>
            <p className={`text-2xl font-black ${scoreColor}`}>{report.overallScore}<span className="text-xs font-bold text-ink-muted">/100</span></p>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-ink text-xs font-semibold rounded-xl transition-colors border border-border cursor-pointer"
          >
            <span>{isExpanded ? 'Thu gọn' : `Chi tiết (${report.findings.length})`}</span>
            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Summary Pill Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 bg-surface-2 rounded-xl border border-border">
          <span className="text-[10px] font-semibold text-ink-muted uppercase block">Attributable (Rõ người)</span>
          <span className="font-bold text-ink text-sm mt-0.5 block">{report.scoreBreakdown.attributable}/100</span>
        </div>
        <div className="p-2.5 bg-surface-2 rounded-xl border border-border">
          <span className="text-[10px] font-semibold text-ink-muted uppercase block">Contemporaneous (Kịp thời)</span>
          <span className="font-bold text-ink text-sm mt-0.5 block">{report.scoreBreakdown.contemporaneous}/100</span>
        </div>
        <div className="p-2.5 bg-surface-2 rounded-xl border border-border">
          <span className="text-[10px] font-semibold text-ink-muted uppercase block">Original (Bản gốc)</span>
          <span className="font-bold text-ink text-sm mt-0.5 block">{report.scoreBreakdown.original}/100</span>
        </div>
        <div className="p-2.5 bg-surface-2 rounded-xl border border-border">
          <span className="text-[10px] font-semibold text-ink-muted uppercase block">Accurate (Chính xác)</span>
          <span className="font-bold text-ink text-sm mt-0.5 block">{report.scoreBreakdown.accurate}/100</span>
        </div>
      </div>

      {/* Expanded Findings Drawer */}
      {isExpanded && (
        <div className="space-y-3 pt-3 border-t border-border text-xs animate-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-surface-2 rounded-2xl border border-border">
            <p className="font-medium text-ink leading-relaxed">
              {report.summary}
            </p>
          </div>

          {report.findings.length === 0 ? (
            <div className="p-4 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 rounded-2xl border border-emerald-500/20 flex items-center gap-2 font-bold">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
              Không phát hiện bất kỳ dấu hiệu bất thường nào về toàn vẹn dữ liệu trong các bản ghi kiểm toán gần đây.
            </div>
          ) : (
            <div className="space-y-2">
              <h5 className="font-bold text-[11px] uppercase tracking-wider text-ink-muted">
                Danh sách các điểm rà soát ({report.findings.length}):
              </h5>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {report.findings.map(f => {
                  const isHigh = f.severity === 'HIGH';
                  const isMed = f.severity === 'MEDIUM';
                  const itemBg = isHigh
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200'
                    : isMed
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200'
                    : 'bg-surface-2 border-border text-ink';

                  return (
                    <div key={f.id} className={`p-3 rounded-xl border ${itemBg} space-y-1`}>
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold">{f.title}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isHigh ? 'bg-rose-500/20 text-rose-800 dark:text-rose-200' : isMed ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200' : 'bg-surface-3 text-ink-muted'}`}>
                          {f.severity}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90">{f.description}</p>
                      <p className="text-[11px] font-bold opacity-80 pt-0.5">
                        💡 Kiến nghị: {f.suggestedAction}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
