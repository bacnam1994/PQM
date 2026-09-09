import React from 'react';
import { 
  Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, 
  FileCheck2, ShieldCheck, UserCheck, Activity, Layers, FileText 
} from 'lucide-react';
import { formatDateStandard } from '../../../../utils';
import { ElectronicSignature } from '../../../../types/signature';
import { QualityDeviation } from '../../../../types/deviation';

export interface BatchTimelineEvent {
  id: string;
  timestamp: string;
  type: 'CREATED' | 'TEST_RESULT' | 'DEVIATION' | 'E_SIGNATURE' | 'STATUS_CHANGE';
  title: string;
  description?: string;
  actor?: string;
  status?: 'PASS' | 'FAIL' | 'WARNING' | 'INFO';
  badge?: string;
  details?: Record<string, string | number | undefined>;
}

interface BatchAuditHistoryTimelineProps {
  events: BatchTimelineEvent[];
  signatures?: ElectronicSignature[];
  deviations?: QualityDeviation[];
}

export const BatchAuditHistoryTimeline: React.FC<BatchAuditHistoryTimelineProps> = ({
  events,
  signatures = [],
  deviations = []
}) => {
  // Sắp xếp các sự kiện theo dòng thời gian giảm dần (mới nhất lên trên)
  const sortedEvents = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const getEventIcon = (type: BatchTimelineEvent['type'], status?: string) => {
    switch (type) {
      case 'E_SIGNATURE':
        return <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'DEVIATION':
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'TEST_RESULT':
        return status === 'FAIL' 
          ? <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          : <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'STATUS_CHANGE':
        return <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'CREATED':
      default:
        return <Layers className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getEventBorderColor = (type: BatchTimelineEvent['type'], status?: string) => {
    if (type === 'E_SIGNATURE') return 'border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20';
    if (type === 'DEVIATION') return 'border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20';
    if (type === 'TEST_RESULT') {
      return status === 'FAIL'
        ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20'
        : 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20';
    }
    return 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80';
  };

  return (
    <div className="space-y-6">
      {/* Thống kê nhanh chữ ký số & hồ sơ tuân thủ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl">
            <FileCheck2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Chữ ký điện tử (21 CFR Part 11)</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{signatures.length} lượt ký</p>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Sai lệch phát sinh (Deviations)</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{deviations.length} vụ việc</p>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
            <UserCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tổng số mốc sự kiện</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{sortedEvents.length} mốc ghi nhận</p>
          </div>
        </div>
      </div>

      {/* Dòng thời gian chi tiết */}
      <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Dòng Thời gian Thẩm định & Hồ sơ Tuân thủ (Audit History Timeline)</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Sắp xếp theo thứ tự thời gian mới nhất trước
          </span>
        </div>

        {sortedEvents.length === 0 ? (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">
            Chưa có sự kiện nào được ghi nhận cho lô sản xuất này.
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
            {sortedEvents.map((evt) => (
              <div key={evt.id} className="relative group">
                {/* Icon tròn trên trục thời gian */}
                <div className="absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  {getEventIcon(evt.type, evt.status)}
                </div>

                {/* Khối sự kiện */}
                <div className={`p-4 rounded-xl border transition-all ${getEventBorderColor(evt.type, evt.status)} hover:shadow-sm`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{evt.title}</span>
                      {evt.badge && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {evt.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDateStandard(evt.timestamp)}</span>
                    </div>
                  </div>

                  {evt.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {evt.description}
                    </p>
                  )}

                  {evt.actor && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Thực hiện bởi:</span>
                      <span>{evt.actor}</span>
                    </div>
                  )}

                  {evt.details && Object.keys(evt.details).length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                      {Object.entries(evt.details).map(([k, v]) => v !== undefined && (
                        <div key={k} className="flex items-center justify-between gap-2 px-2.5 py-1 bg-white/80 dark:bg-slate-900/60 rounded border border-slate-200/50 dark:border-slate-800/50">
                          <span className="text-slate-500 dark:text-slate-400">{k}:</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
