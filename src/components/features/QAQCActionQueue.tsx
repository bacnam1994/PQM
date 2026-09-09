/**
 * PQM V4 Platform - QA/QC Action Workbench Action Queue Widget
 * Hiển thị hàng đợi các tác vụ khẩn cấp cần QA/QC xử lý trực tiếp trong ngày.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Beaker,
  PackageCheck,
  Flame,
  ListFilter
} from 'lucide-react';
import { useQAQCActionQueue, ActionItem } from '../../hooks/useQAQCActionQueue';
import { DSCard } from '../../components';

export const QAQCActionQueue: React.FC = () => {
  const { actionItems, totalUrgentCount, batchClearanceCount, testResultReviewCount, alertCount } = useQAQCActionQueue();
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredItems = actionItems.filter(item => {
    if (filterType === 'ALL') return true;
    return item.type === filterType;
  });

  return (
    <DSCard className="p-6 relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 border border-slate-700/60 shadow-xl rounded-2xl text-slate-100">
      {/* Background Accent Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Flame size={22} className="animate-pulse text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-wide text-white uppercase">
                QA/QC Action Workbench — Hàng Đợi Nhiệm Vụ
              </h2>
              {totalUrgentCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                  {totalUrgentCount} Khẩn cấp
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Các đầu việc tồn đọng cần thẩm định, điều tra OOS và phê duyệt trong ca làm việc.
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              filterType === 'ALL'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            Tất cả ({actionItems.length})
          </button>
          <button
            onClick={() => setFilterType('BATCH_CLEARANCE')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              filterType === 'BATCH_CLEARANCE'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            Lô chờ duyệt ({batchClearanceCount})
          </button>
          <button
            onClick={() => setFilterType('TEST_RESULT_REVIEW')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              filterType === 'TEST_RESULT_REVIEW'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            Phiếu OOS ({testResultReviewCount})
          </button>
        </div>
      </div>

      {/* Action Items List */}
      <div className="mt-4 space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <CheckCircle2 size={36} className="text-emerald-400/70 mb-2" />
            <p className="text-sm font-bold text-slate-300">Không có đầu việc nào cần xử lý khẩn cấp!</p>
            <p className="text-xs text-slate-500 mt-1">Toàn bộ hồ sơ kiểm nghiệm và lô sản xuất đang ở trạng thái an toàn.</p>
          </div>
        ) : (
          filteredItems.slice(0, 5).map(item => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-cyan-500/40 transition-all flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    item.urgency === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {item.type === 'BATCH_CLEARANCE' && <PackageCheck size={18} />}
                  {item.type === 'TEST_RESULT_REVIEW' && <Beaker size={18} />}
                  {item.type === 'QUALITY_ALERT' && <ShieldAlert size={18} />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100 truncate group-hover:text-cyan-300 transition-colors">
                      {item.title}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider shrink-0 ${
                        item.urgency === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {item.tagText}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                </div>
              </div>

              <Link
                to={item.link}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/30 transition-all group-hover:shadow-md group-hover:shadow-cyan-500/20"
              >
                <span>Xử lý ngay</span>
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          ))
        )}
      </div>
    </DSCard>
  );
};
