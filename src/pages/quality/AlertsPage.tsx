/**
 * AlertsPage.tsx
 * ========================
 * Trang hiển thị các cảnh báo chất lượng tự động được phát hiện bởi hệ thống.
 * Hỗ trợ toàn diện Dark Mode & Responsive Layout.
 */

import React, { useState, useMemo } from 'react';
import { 
  ShieldExclamationIcon, 
  ArrowTrendingUpIcon, 
  ClockIcon, 
  ArchiveBoxXMarkIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  CheckCircleIcon,
  SparklesIcon,
  BoltIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { useQualityAlerts } from '../../hooks/useQualityAlerts';
import { useAppStore } from '../../store/useAppStore';
import { runSmartAlertAnalysis, SmartAlert, getCachedSmartAlerts, saveSmartAlertsCache } from '../../services/ai/smartAlertService';
import type { QualityAnomaly } from '../../services/reportService';

const SEVERITY_CONFIG = {
  HIGH: {
    label: 'Cao',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    badge: 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
    icon: <ExclamationTriangleIcon className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />,
    dot: 'bg-rose-500',
  },
  MEDIUM: {
    label: 'Trung bình',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
    icon: <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
    dot: 'bg-amber-500',
  },
  LOW: {
    label: 'Thấp',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
    icon: <ClockIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />,
    dot: 'bg-blue-400',
  },
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  DRIFT: {
    label: 'Xu hướng trôi (OOT)',
    icon: <ArrowTrendingUpIcon className="w-3.5 h-3.5" />,
    desc: 'Chỉ tiêu có xu hướng thay đổi liên tục qua nhiều lần kiểm.',
  },
  OOT_NEAR_LIMIT: {
    label: 'Cận biên giới hạn (OOT)',
    icon: <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500" />,
    desc: 'Chỉ tiêu tiệm cận sát biên dung sai tối đa/tối thiểu của TCCS.',
  },
  OOT_SIGMA_SHIFT: {
    label: 'Lệch thống kê >2σ (OOT)',
    icon: <ChartBarIcon className="w-3.5 h-3.5 text-purple-500" />,
    desc: 'Giá trị lô lệch đáng kể so với trung bình lịch sử của sản phẩm.',
  },
  EXPIRY: {
    label: 'Sắp hết hạn',
    icon: <ClockIcon className="w-3.5 h-3.5" />,
    desc: 'Lô sản phẩm sẽ hết hạn trong thời gian tới.',
  },
  HIGH_FAIL_RATE: {
    label: 'Tỷ lệ thất bại cao',
    icon: <ArchiveBoxXMarkIcon className="w-3.5 h-3.5" />,
    desc: 'Sản phẩm có nhiều phiếu kiểm không đạt.',
  },
  MISSING_DATA: {
    label: 'Thiếu dữ liệu',
    icon: <ShieldExclamationIcon className="w-3.5 h-3.5" />,
    desc: 'Dữ liệu kiểm nghiệm bị thiếu hoặc không đầy đủ.',
  },
};

const renderMarkdown = (text: string) => {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-ink">$1</strong>');
};

type FilterType = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

const AlertsPage: React.FC = () => {
  const { alerts, highCount, mediumCount, lowCount, totalCount, hasAlerts } = useQualityAlerts(30);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [smartExpanded, setSmartExpanded] = useState(true);

  const { products, batches, testResults, tccsList } = useAppStore();

  const smartReport = useMemo(() => {
    const cached = getCachedSmartAlerts();
    if (cached) return cached;
    const report = runSmartAlertAnalysis({ products, batches, testResults, tccsList });
    saveSmartAlertsCache(report);
    return report;
  }, [products, batches, testResults, tccsList]);

  const filteredAlerts = filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldExclamationIcon className="w-6 h-6" />
            </div>
            Cảnh báo Chất lượng
          </h1>
          <p className="text-ink-muted text-sm mt-1">
            Giám sát rủi ro tự động — phân tích xu hướng trôi, lô cận date và phiếu không đạt theo thời gian thực
          </p>
        </div>
        <span className="text-[11px] font-semibold text-ink-muted flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-xl bg-surface border border-border">
          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-emerald-500" /> Cập nhật tự động
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setFilter(filter === 'HIGH' ? 'ALL' : 'HIGH')}
          className={`rounded-2xl border-2 p-5 text-left transition-all cursor-pointer shadow-xs ${
            filter === 'HIGH' 
              ? 'border-rose-500 bg-rose-500/10' 
              : 'border-border bg-surface hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-xs"></span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Mức Cao</span>
          </div>
          <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{highCount}</p>
          <p className="text-[11px] text-ink-muted mt-1">bất thường nghiêm trọng</p>
        </button>

        <button
          onClick={() => setFilter(filter === 'MEDIUM' ? 'ALL' : 'MEDIUM')}
          className={`rounded-2xl border-2 p-5 text-left transition-all cursor-pointer shadow-xs ${
            filter === 'MEDIUM' 
              ? 'border-amber-500 bg-amber-500/10' 
              : 'border-border bg-surface hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs"></span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Trung bình</span>
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{mediumCount}</p>
          <p className="text-[11px] text-ink-muted mt-1">cần theo dõi &amp; xử lý</p>
        </button>

        <button
          onClick={() => setFilter(filter === 'LOW' ? 'ALL' : 'LOW')}
          className={`rounded-2xl border-2 p-5 text-left transition-all cursor-pointer shadow-xs ${
            filter === 'LOW' 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-border bg-surface hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block shadow-xs"></span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Thấp</span>
          </div>
          <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{lowCount}</p>
          <p className="text-[11px] text-ink-muted mt-1">thông tin cần lưu ý</p>
        </button>
      </div>

      {/* === SMART AI ALERTS === */}
      {smartReport.totalAlerts > 0 && (
        <div className="border border-border rounded-2xl overflow-hidden shadow-sm bg-surface">
          <button
            onClick={() => setSmartExpanded(e => !e)}
            className="w-full flex items-center justify-between px-5 py-4 bg-surface-2 hover:bg-surface-3 transition-colors border-b border-border"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <SparklesIcon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-black text-ink text-sm flex items-center gap-2">
                  AI Proactive Smart Alerts
                  {smartReport.highCount > 0 && (
                    <span className="text-[10px] font-black bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-full">
                      {smartReport.highCount} URGENT
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-muted">{smartReport.summary}</p>
              </div>
            </div>
            {smartExpanded ? <ChevronDownIcon className="w-4 h-4 text-ink-muted" /> : <ChevronRightIcon className="w-4 h-4 text-ink-muted" />}
          </button>
          {smartExpanded && (
            <div className="divide-y divide-border">
              {smartReport.alerts.map((alert) => (
                <SmartAlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alert list */}
      {!hasAlerts ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center shadow-xs">
          <CheckCircleIcon className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
          <p className="font-black text-ink text-lg">Không có cảnh báo nào</p>
          <p className="text-ink-muted text-sm mt-1">
            Hệ thống không phát hiện bất thường hay lô cận date trong dữ liệu hiện tại.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filter !== 'ALL' && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-ink-muted">Đang lọc theo mức:</span>
              <button
                onClick={() => setFilter('ALL')}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Xem tất cả ({totalCount})
              </button>
            </div>
          )}
          {filteredAlerts.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-8 text-center text-ink-muted text-sm shadow-xs">
              Không có cảnh báo nào ở mức này.
            </div>
          ) : (
            filteredAlerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const AlertCard: React.FC<{ alert: QualityAnomaly }> = ({ alert }) => {
  const sev = SEVERITY_CONFIG[alert.severity];
  const type = TYPE_CONFIG[alert.type];

  return (
    <div className={`rounded-2xl border ${sev.border} ${sev.bg} p-4 flex gap-3.5 shadow-xs transition-all animate-in slide-in-from-left-2 duration-200`}>
      {sev.icon}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${sev.badge}`}>
            {sev.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ink bg-surface px-2.5 py-0.5 rounded-full border border-border shadow-2xs">
            {type.icon} {type.label}
          </span>
          {alert.productName && (
            <span className="text-[11px] font-medium text-ink-muted bg-surface-2 px-2 py-0.5 rounded-md truncate max-w-[200px]" title={alert.productName}>
              📦 {alert.productName}
            </span>
          )}
          {alert.batchNo && (
            <span className="text-[11px] font-mono font-medium text-ink-muted bg-surface-2 px-2 py-0.5 rounded-md">
              🏷️ Lô {alert.batchNo}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-ink leading-snug">{alert.title}</p>
        <p
          className="text-xs text-ink-soft mt-1 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(alert.detail) }}
        />
        {alert.recommendation && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-surface border border-border flex items-start gap-2 text-xs">
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">Khuyến nghị AI:</span>
            <span className="text-ink-soft font-medium">{alert.recommendation}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;

const SmartAlertCard: React.FC<{ alert: SmartAlert }> = ({ alert }) => {
  const [expanded, setExpanded] = useState(alert.severity === 'HIGH');
  const sevStyle = {
    HIGH: 'border-rose-500/20 bg-rose-500/5',
    MEDIUM: 'border-amber-500/20 bg-amber-500/5',
    LOW: 'border-blue-500/20 bg-blue-500/5',
  }[alert.severity];
  const sevDot = { HIGH: 'bg-rose-500', MEDIUM: 'bg-amber-500', LOW: 'bg-blue-400' }[alert.severity];

  return (
    <div className={`border-l-4 ${alert.severity === 'HIGH' ? 'border-l-rose-500' : alert.severity === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-blue-400'} ${sevStyle} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full shrink-0 mt-2 ${sevDot}`}></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-bold text-sm text-ink">{alert.title}</p>
            <button onClick={() => setExpanded(e => !e)} className="text-ink-muted hover:text-ink shrink-0">
              {expanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">{alert.description}</p>
          {expanded && (
            <div className="mt-3 space-y-2">
              {/* Evidence */}
              {alert.evidence.length > 0 && (
                <div className="bg-surface rounded-xl p-3 border border-border">
                  <p className="text-[10px] font-black text-ink-muted uppercase mb-1.5">Bằng chứng</p>
                  <ul className="space-y-0.5">
                    {alert.evidence.map((e, i) => (
                      <li key={i} className="text-xs text-ink-muted flex items-start gap-1.5">
                        <span className="text-ink-muted shrink-0">•</span>{e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Recommendation */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-2 border border-border">
                <BoltIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-ink-soft font-medium">{alert.recommendation}</p>
              </div>
              {alert.actionSuggestion && (
                <div className="text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
                  <ExclamationTriangleIcon className="w-4 h-4" /> {alert.actionSuggestion}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

