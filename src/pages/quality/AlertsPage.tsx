/**
 * AlertsPage.tsx
 * Trang hiển thị các cảnh báo chất lượng tự động được phát hiện bởi hệ thống.
 */
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, PackageX, RefreshCw, ShieldAlert } from 'lucide-react';
import { useQualityAlerts } from '../../hooks/useQualityAlerts';
import type { QualityAnomaly } from '../../services/reportService';

const SEVERITY_CONFIG = {
  HIGH: {
    label: 'Cao',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    icon: <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />,
    dot: 'bg-red-500',
  },
  MEDIUM: {
    label: 'Trung bình',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />,
    dot: 'bg-amber-500',
  },
  LOW: {
    label: 'Thấp',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-600',
    icon: <Clock size={16} className="text-blue-500 shrink-0 mt-0.5" />,
    dot: 'bg-blue-400',
  },
};

const TYPE_CONFIG = {
  DRIFT: {
    label: 'Xu hướng trôi',
    icon: <TrendingUp size={14} />,
    desc: 'Chỉ tiêu có xu hướng thay đổi liên tục qua nhiều lần kiểm.',
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
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
};

type FilterType = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

const AlertsPage: React.FC = () => {
  const { alerts, highCount, mediumCount, lowCount, totalCount, hasAlerts } = useQualityAlerts(30);
  const [filter, setFilter] = useState<FilterType>('ALL');

  const filteredAlerts = filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldAlert size={26} className="text-rose-500" />
            Cảnh báo Chất lượng
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Phát hiện bất thường tự động — cập nhật theo thời gian thực từ dữ liệu hệ thống
          </p>
        </div>
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
          <RefreshCw size={12} /> Tự động
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setFilter(filter === 'HIGH' ? 'ALL' : 'HIGH')}
          className={`rounded-xl border-2 p-4 text-left transition-all ${filter === 'HIGH' ? 'border-red-400 bg-red-50' : 'border-red-100 bg-white hover:border-red-200'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Mức Cao</span>
          </div>
          <p className="text-3xl font-black text-red-600">{highCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">bất thường nghiêm trọng</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'MEDIUM' ? 'ALL' : 'MEDIUM')}
          className={`rounded-xl border-2 p-4 text-left transition-all ${filter === 'MEDIUM' ? 'border-amber-400 bg-amber-50' : 'border-amber-100 bg-white hover:border-amber-200'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Trung bình</span>
          </div>
          <p className="text-3xl font-black text-amber-600">{mediumCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">cần theo dõi</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'LOW' ? 'ALL' : 'LOW')}
          className={`rounded-xl border-2 p-4 text-left transition-all ${filter === 'LOW' ? 'border-blue-400 bg-blue-50' : 'border-blue-100 bg-white hover:border-blue-200'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"></span>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Thấp</span>
          </div>
          <p className="text-3xl font-black text-blue-600">{lowCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">thông tin cần xem xét</p>
        </button>
      </div>

      {/* Alert list */}
      {!hasAlerts ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center">
          <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3" />
          <p className="font-black text-slate-700 text-lg">Không có cảnh báo nào</p>
          <p className="text-slate-400 text-sm mt-1">Hệ thống không phát hiện bất thường trong dữ liệu hiện tại.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filter !== 'ALL' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Đang lọc:</span>
              <button
                onClick={() => setFilter('ALL')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
              >
                Xem tất cả ({totalCount})
              </button>
            </div>
          )}
          {filteredAlerts.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-slate-400">
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
    <div className={`rounded-xl border ${sev.border} ${sev.bg} p-4 flex gap-3 animate-in slide-in-from-left-2 duration-200`}>
      {sev.icon}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${sev.badge}`}>
            {sev.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-100">
            {type.icon} {type.label}
          </span>
          {alert.productName && (
            <span className="text-[10px] text-slate-400 truncate">
              📦 {alert.productName}
            </span>
          )}
          {alert.batchNo && (
            <span className="text-[10px] text-slate-400">
              🏷️ Lô {alert.batchNo}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-slate-800 leading-snug">{alert.title}</p>
        <p
          className="text-xs text-slate-600 mt-1 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(alert.detail) }}
        />
      </div>
    </div>
  );
};

export default AlertsPage;
