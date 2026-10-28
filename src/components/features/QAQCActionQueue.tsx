/**
 * PQM V4 Platform - QA/QC Action Workbench Action Queue Widget
 * Hiển thị hàng đợi các tác vụ khẩn cấp cần QA/QC xử lý trực tiếp trong ngày.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircleIcon,
  ArrowRightIcon,
  ShieldExclamationIcon,
  BeakerIcon,
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { useQAQCActionQueue } from '../../hooks/useQAQCActionQueue';

export const QAQCActionQueue: React.FC = () => {
  const { actionItems, totalUrgentCount, batchClearanceCount, testResultReviewCount } =
    useQAQCActionQueue();
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredItems = actionItems.filter((item) => {
    if (filterType === 'ALL') return true;
    return item.type === filterType;
  });

  const filters = [
    { key: 'ALL', label: `Tất cả (${actionItems.length})` },
    { key: 'BATCH_CLEARANCE', label: `Lô chờ duyệt (${batchClearanceCount})` },
    { key: 'TEST_RESULT_REVIEW', label: `Phiếu OOS (${testResultReviewCount})` },
  ];

  return (
    <section
      aria-label="Hàng đợi nhiệm vụ QA/QC"
      className="p-5 sm:p-6 relative overflow-hidden bg-surface/90 dark:bg-surface/85 backdrop-blur-md border border-border/80 shadow-xs rounded-2xl text-ink"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ClipboardDocumentListIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-ink font-display">
                Hàng đợi nhiệm vụ QA/QC
              </h2>
              {totalUrgentCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  {totalUrgentCount} khẩn cấp
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Các đầu việc tồn đọng cần thẩm định, điều tra OOS và phê duyệt xuất xưởng
            </p>
          </div>
        </div>

        {/* Ghost Filter Chips per ui-craft */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((f) => {
            const active = filterType === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterType(f.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors duration-150 border tabular-nums cursor-pointer ${
                  active
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 font-semibold'
                    : 'bg-transparent text-ink-muted hover:text-ink border-border/70 hover:bg-surface-2/70'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Items List */}
      <div className="mt-4 space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="py-7 flex flex-col items-center justify-center text-center">
            <CheckCircleIcon className="w-8 h-8 text-emerald-500/80 mb-1.5" />
            <p className="text-xs sm:text-sm font-semibold text-ink">
              Không có đầu việc tồn đọng cần xử lý khẩn cấp
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              Toàn bộ hồ sơ kiểm nghiệm và lô sản xuất đang ở trạng thái ổn định.
            </p>
          </div>
        ) : (
          filteredItems.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-surface-2/45 hover:bg-surface-2/85 border border-border/80 hover:border-emerald-500/35 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    item.urgency === 'HIGH'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {item.type === 'BATCH_CLEARANCE' && <CheckBadgeIcon className="w-4 h-4" />}
                  {item.type === 'TEST_RESULT_REVIEW' && <BeakerIcon className="w-4 h-4" />}
                  {item.type === 'QUALITY_ALERT' && <ShieldExclamationIcon className="w-4 h-4" />}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[13px] text-ink truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {item.title}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        item.urgency === 'HIGH'
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.urgency === 'HIGH' ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                      />
                      {item.tagText}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted truncate mt-0.5">{item.subtitle}</p>
                </div>
              </div>

              <Link
                to={item.link}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface hover:bg-emerald-600 text-ink hover:text-white border border-border/80 hover:border-emerald-600 shadow-2xs transition-[background-color,color,border-color] duration-150 self-end sm:self-center"
              >
                <span>Xử lý</span>
                <ArrowRightIcon className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
