/**
 * AlertsPage.tsx
 * ========================
 * Trang hiển thị các cảnh báo chất lượng tự động được phát hiện bởi hệ thống.
 * Hỗ trợ toàn diện Dark Mode & Responsive Layout.
 */

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  TrendingUp, 
  Clock, 
  PackageX, 
  AlertTriangle,
  RefreshCw,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { useQualityAlerts } from '../../hooks/useQualityAlerts';
import type { QualityAnomaly } from '../../services/reportService';

const SEVERITY_CONFIG = {
  HIGH: {
    label: 'Cao',
    bg: 'bg-red-50/80 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-900/60',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    icon: <AlertTriangle size={18} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />,
    dot: 'bg-red-500',
  },
  MEDIUM: {
    label: 'Trung bình',
    bg: 'bg-amber-50/80 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-900/60',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    icon: <AlertTriangle size={18} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />,
    dot: 'bg-amber-500',
  },
  LOW: {
    label: 'Thấp',
    bg: 'bg-blue-50/80 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-900/60',
    badge: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300',
    icon: <Clock size={18} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />,
    dot: 'bg-blue-400',
  },
};

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  DRIFT: {
    label: 'Xu hướng trôi (OOT)',
    icon: <TrendingUp size={14} />,
    desc: 'Chỉ tiêu có xu hướng thay đổi liên tục qua nhiều lần kiểm.',
  },
  OOT_NEAR_LIMIT: {
    label: 'Cận biên giới hạn (OOT)',
    icon: <AlertTriangle size={14} className="text-amber-500" />,
    desc: 'Chỉ tiêu tiệm cận sát biên dung sai tối đa/tối thiểu của TCCS.',
  },
  OOT_SIGMA_SHIFT: {
    label: 'Lệch thống kê >2σ (OOT)',
    icon: <Activity size={14} className="text-purple-500" />,
    desc: 'Giá trị lô lệch đáng kể so với trung bình lịch sử của sản phẩm.',
  },
  EXPIRY: {
    label: 'Sắp hết hạn',
    icon: <Clock size={14} />,
    desc: 'Lô sản phẩm sẽ hết hạn trong thời gian tới.',
  },
  HIGH_FAIL_RATE: {
    label: 'Tỷ lệ thất bại cao',
    icon: <PackageX size={14} />,
    desc: 'Sản phẩm có nhiều phiếu kiểm không đạt.',
  },
  MISSING_DATA: {
    label: 'Thiếu dữ liệu',
    icon: <ShieldAlert size={14} />,
    desc: 'Dữ liệu kiểm nghiệm bị thiếu hoặc không đầy đủ.',
  },
};

const renderMarkdown = (text: string) => {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-slate-100">$1</strong>');
};

type FilterType = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

const AlertsPage: React.FC = () => {
  const { alerts, highCount, mediumCount, lowCount, totalCount, hasAlerts } = useQualityAlerts(30);
  const [filter, setFilter] = useState<FilterType>('ALL');

  const filteredAlerts = filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400">
              <ShieldAlert size={24} />
            </div>
            Cảnh báo Chất lượng
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Giám sát rủi ro tự động — phân tích xu hướng trôi, lô cận date và phiếu không đạt theo thời gian thực
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          <RefreshCw size={12} className="animate-spin text-primary-500" /> Cập nhật tự động
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <button
          onClick={() => setFilter(filter === 'HIGH' ? 'ALL' : 'HIGH')}
          className={`rounded-2xl border-2 p-4 text-left transition-all cursor-pointer shadow-xs ${
            filter === 'HIGH' 
              ? 'border-red-500 bg-red-50 dark:bg-red-950/40' 
              : 'border-red-100 dark:border-red-900/40 bg-white dark:bg-slate-900 hover:border-red-300 dark:hover:border-red-700'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-xs"></span>
            <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Mức Cao</span>
          </div>
          <p className="text-3xl font-black text-red-600 dark:text-red-400">{highCount}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">bất thường nghiêm trọng</p>
        </button>

        <button
          onClick={() => setFilter(filter === 'MEDIUM' ? 'ALL' : 'MEDIUM')}
          className={`rounded-2xl border-2 p-4 text-left transition-all cursor-pointer shadow-xs ${
            filter === 'MEDIUM' 
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40' 
              : 'border-amber-100 dark:border-amber-900/40 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-700'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs"></span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Trung bình</span>
          </div>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{mediumCount}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">cần theo dõi & xử lý</p>
        </button>

        <button
          onClick={() => setFilter(filter === 'LOW' ? 'ALL' : 'LOW')}
          className={`rounded-2xl border-2 p-4 text-left transition-all cursor-pointer shadow-xs ${
            filter === 'LOW' 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' 
              : 'border-blue-100 dark:border-blue-900/40 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block shadow-xs"></span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Thấp</span>
          </div>
          <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{lowCount}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">thông tin cần lưu ý</p>
        </button>
      </div>

      {/* Alert list */}
      {!hasAlerts ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500 dark:text-emerald-400 mb-3" />
          <p className="font-black text-slate-800 dark:text-slate-100 text-lg">Không có cảnh báo nào</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            Hệ thống không phát hiện bất thường hay lô cận date trong dữ liệu hiện tại.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filter !== 'ALL' && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Đang lọc theo mức:</span>
              <button
                onClick={() => setFilter('ALL')}
                className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
              >
                Xem tất cả ({totalCount})
              </button>
            </div>
          )}
          {filteredAlerts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 text-sm shadow-xs">
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
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            {type.icon} {type.label}
          </span>
          {alert.productName && (
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md truncate max-w-[200px]" title={alert.productName}>
              📦 {alert.productName}
            </span>
          )}
          {alert.batchNo && (
            <span className="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
              🏷️ Lô {alert.batchNo}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">{alert.title}</p>
        <p
          className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(alert.detail) }}
        />
        {alert.recommendation && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-2 text-xs">
            <span className="text-[10px] font-black uppercase text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5">Khuyến nghị AI:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">{alert.recommendation}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
