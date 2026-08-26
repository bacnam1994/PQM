import React, { useState, useMemo } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Sparkles, Activity, Clock, FileWarning, Eye } from 'lucide-react';
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
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    : isGood
    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
    : isWarning
    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';

  const highRiskCount = report.findings.filter(f => f.severity === 'HIGH').length;
  const mediumRiskCount = report.findings.filter(f => f.severity === 'MEDIUM').length;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200/80 dark:border-zinc-800 p-5 shadow-xs transition-all overflow-hidden space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-sm">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase tracking-tight">
                ALCOA+ Data Integrity Watchdog
              </h3>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeBg}`}>
                {isExcellent && 'GRADE A • TUÂN THỦ CAO'}
                {isGood && 'GRADE B • ĐẠT CHUẨN'}
                {isWarning && 'GRADE C • CẦN LƯU Ý'}
                {isCritical && 'GRADE D • NGUY CƠ VI PHẠM'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Giám sát toàn vẹn dữ liệu tự động theo US FDA 21 CFR Part 11 & WHO TRS 996 ({logs.length} bản ghi phân tích)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500">Integrity Score</p>
            <p className={`text-2xl font-black ${scoreColor}`}>{report.overallScore}<span className="text-xs font-bold text-slate-400">/100</span></p>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-colors"
          >
            {isExpanded ? 'Thu gọn' : `Chi tiết (${report.findings.length})`}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Quick Summary Pill Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/50 rounded-xl border border-slate-100 dark:border-zinc-800/80">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Attributable (Rõ người)</span>
          <span className="font-black text-slate-800 dark:text-zinc-200">{report.scoreBreakdown.attributable}/100</span>
        </div>
        <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/50 rounded-xl border border-slate-100 dark:border-zinc-800/80">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Contemporaneous (Kịp thời)</span>
          <span className="font-black text-slate-800 dark:text-zinc-200">{report.scoreBreakdown.contemporaneous}/100</span>
        </div>
        <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/50 rounded-xl border border-slate-100 dark:border-zinc-800/80">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Original (Bản gốc)</span>
          <span className="font-black text-slate-800 dark:text-zinc-200">{report.scoreBreakdown.original}/100</span>
        </div>
        <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/50 rounded-xl border border-slate-100 dark:border-zinc-800/80">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Accurate (Chính xác)</span>
          <span className="font-black text-slate-800 dark:text-zinc-200">{report.scoreBreakdown.accurate}/100</span>
        </div>
      </div>

      {/* Expanded Findings Drawer */}
      {isExpanded && (
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs animate-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-slate-50 dark:bg-zinc-950/60 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
            <p className="font-medium text-slate-700 dark:text-zinc-300 leading-relaxed">
              {report.summary}
            </p>
          </div>

          {report.findings.length === 0 ? (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-2 font-bold">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              Không phát hiện bất kỳ dấu hiệu bất thường nào về toàn vẹn dữ liệu trong các bản ghi kiểm toán gần đây.
            </div>
          ) : (
            <div className="space-y-2">
              <h5 className="font-black text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Danh sách các điểm rà soát ({report.findings.length}):
              </h5>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {report.findings.map(f => {
                  const isHigh = f.severity === 'HIGH';
                  const isMed = f.severity === 'MEDIUM';
                  const itemBg = isHigh
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-200'
                    : isMed
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-200'
                    : 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200';

                  return (
                    <div key={f.id} className={`p-3 rounded-xl border ${itemBg} space-y-1`}>
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold">{f.title}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isHigh ? 'bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200' : isMed ? 'bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'bg-slate-200 text-slate-700'}`}>
                          {f.severity}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90">{f.description}</p>
                      <p className="text-[10px] font-bold opacity-80 pt-0.5">
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
