import React from 'react';
import { 
  CalendarIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon, 
  ClipboardDocumentCheckIcon, 
  ShieldCheckIcon, 
  CheckBadgeIcon, 
  ChartBarSquareIcon, 
  Square3Stack3DIcon, 
  DocumentTextIcon 
} from '@heroicons/react/24/outline';
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
        return <ShieldCheckIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'DEVIATION':
        return <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'TEST_RESULT':
        return status === 'FAIL' 
          ? <XCircleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          : <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'STATUS_CHANGE':
        return <ChartBarSquareIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'CREATED':
      default:
        return <Square3Stack3DIcon className="w-4 h-4 text-ink-muted" />;
    }
  };

  const getEventBorderColor = (type: BatchTimelineEvent['type'], status?: string) => {
    if (type === 'E_SIGNATURE') return 'border-purple-500/20 bg-purple-500/5';
    if (type === 'DEVIATION') return 'border-amber-500/20 bg-amber-500/5';
    if (type === 'TEST_RESULT') {
      return status === 'FAIL'
        ? 'border-rose-500/20 bg-rose-500/5'
        : 'border-emerald-500/20 bg-emerald-500/5';
    }
    return 'border-border bg-surface';
  };

  return (
    <div className="space-y-6">
      {/* Thống kê nhanh chữ ký số & hồ sơ tuân thủ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 rounded-xl">
            <ClipboardDocumentCheckIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-ink-muted">Chữ ký điện tử (21 CFR Part 11)</p>
            <p className="text-xl font-bold text-ink">{signatures.length} lượt ký</p>
          </div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-xl">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-ink-muted">Sai lệch phát sinh (Deviations)</p>
            <p className="text-xl font-bold text-ink">{deviations.length} vụ việc</p>
          </div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <CheckBadgeIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-ink-muted">Tổng số mốc sự kiện</p>
            <p className="text-xl font-bold text-ink">{sortedEvents.length} mốc ghi nhận</p>
          </div>
        </div>
      </div>

      {/* Dòng thời gian chi tiết */}
      <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <ClockIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Dòng Thời gian Thẩm định & Hồ sơ Tuân thủ (Audit History Timeline)</span>
          </div>
          <span className="text-xs text-ink-muted">
            Sắp xếp theo thứ tự thời gian mới nhất trước
          </span>
        </div>

        {sortedEvents.length === 0 ? (
          <div className="text-center py-10 text-ink-muted text-sm">
            Chưa có sự kiện nào được ghi nhận cho lô sản xuất này.
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {sortedEvents.map((evt) => (
              <div key={evt.id} className="relative group">
                {/* Icon tròn trên trục thời gian */}
                <div className="absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full bg-surface border-2 border-border flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  {getEventIcon(evt.type, evt.status)}
                </div>

                {/* Khối sự kiện */}
                <div className={`p-4 rounded-xl border transition-all ${getEventBorderColor(evt.type, evt.status)} hover:shadow-sm`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">{evt.title}</span>
                      {evt.badge && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-3 text-ink-soft border border-border">
                          {evt.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>{formatDateStandard(evt.timestamp)}</span>
                    </div>
                  </div>

                  {evt.description && (
                    <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                      {evt.description}
                    </p>
                  )}

                  {evt.actor && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-ink-muted">
                      <span className="font-medium text-ink">Thực hiện bởi:</span>
                      <span>{evt.actor}</span>
                    </div>
                  )}

                  {evt.details && Object.keys(evt.details).length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                      {Object.entries(evt.details).map(([k, v]) => v !== undefined && (
                        <div key={k} className="flex items-center justify-between gap-2 px-2.5 py-1 bg-surface/80 rounded border border-border">
                          <span className="text-ink-muted">{k}:</span>
                          <span className="font-medium text-ink">{String(v)}</span>
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
