/**
 * PQM V4 Platform - QA/QC Action Workbench Action Queue Widget
 * Hiển thị hàng đợi các tác vụ khẩn cấp cần QA/QC xử lý trực tiếp trong ngày.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FireIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  ShieldExclamationIcon,
  BeakerIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';
import { useQAQCActionQueue } from '../../hooks/useQAQCActionQueue';

export const QAQCActionQueue: React.FC = () => {
  const { actionItems, totalUrgentCount, batchClearanceCount, testResultReviewCount } = useQAQCActionQueue();
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredItems = actionItems.filter(item => {
    if (filterType === 'ALL') return true;
    return item.type === filterType;
  });

  return (
    <div className="p-6 relative overflow-hidden bg-surface border border-border shadow-sm rounded-2xl text-ink">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <FireIcon className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-wide text-ink uppercase">
                QA/QC Action Workbench — Hàng Đợi Nhiệm Vụ
              </h2>
              {totalUrgentCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                  {totalUrgentCount} Khẩn cấp
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Các đầu việc tồn đọng cần thẩm định, điều tra OOS và phê duyệt trong ca làm việc.
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all border ${
              filterType === 'ALL'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-surface-2 text-ink-muted hover:text-ink border-border hover:bg-surface-3'
            }`}
          >
            Tất cả ({actionItems.length})
          </button>
          <button
            onClick={() => setFilterType('BATCH_CLEARANCE')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all border ${
              filterType === 'BATCH_CLEARANCE'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-surface-2 text-ink-muted hover:text-ink border-border hover:bg-surface-3'
            }`}
          >
            Lô chờ duyệt ({batchClearanceCount})
          </button>
          <button
            onClick={() => setFilterType('TEST_RESULT_REVIEW')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all border ${
              filterType === 'TEST_RESULT_REVIEW'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-surface-2 text-ink-muted hover:text-ink border-border hover:bg-surface-3'
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
            <CheckCircleIcon className="w-10 h-10 text-emerald-500/80 mb-2" />
            <p className="text-sm font-bold text-ink">Không có đầu việc nào cần xử lý khẩn cấp!</p>
            <p className="text-xs text-ink-muted mt-1">Toàn bộ hồ sơ kiểm nghiệm và lô sản xuất đang ở trạng thái an toàn.</p>
          </div>
        ) : (
          filteredItems.slice(0, 5).map(item => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border hover:border-emerald-500/40 transition-all flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    item.urgency === 'HIGH'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {item.type === 'BATCH_CLEARANCE' && <CheckBadgeIcon className="w-5 h-5" />}
                  {item.type === 'TEST_RESULT_REVIEW' && <BeakerIcon className="w-5 h-5" />}
                  {item.type === 'QUALITY_ALERT' && <ShieldExclamationIcon className="w-5 h-5" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider shrink-0 ${
                        item.urgency === 'HIGH'
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                      }`}
                    >
                      {item.tagText}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted truncate mt-0.5">{item.subtitle}</p>
                </div>
              </div>

              <Link
                to={item.link}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/20 transition-all shadow-sm"
              >
                <span>Xử lý ngay</span>
                <ArrowRightIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
