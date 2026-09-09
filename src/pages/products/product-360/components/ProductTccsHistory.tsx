import React from 'react';
import { Link } from 'react-router-dom';
import { DocumentTextIcon, CheckCircleIcon, CalendarIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { formatDateStandard, ensureArray } from '../../../../utils';
import { TCCS } from '../../../../types';

interface ProductTccsHistoryProps {
  tccsList: TCCS[];
  activeTccsId?: string;
}

export const ProductTccsHistory: React.FC<ProductTccsHistoryProps> = ({
  tccsList,
  activeTccsId
}) => {
  const sortedTccs = [...tccsList].sort((a, b) => 
    (b.issueDate || '').localeCompare(a.issueDate || '')
  );

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold text-ink text-sm">
            Lịch sử Tiến hóa Tiêu chuẩn Cơ sở (TCCS History)
          </h3>
        </div>
        <span className="text-xs font-medium text-ink-muted">
          Tổng số {tccsList.length} phiên bản
        </span>
      </div>

      {sortedTccs.length === 0 ? (
        <div className="text-center py-8 text-ink-muted text-sm">
          Sản phẩm chưa có hồ sơ TCCS nào được thiết lập.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTccs.map((tccs, index) => {
            const isActive = tccs.id === activeTccsId || tccs.isActive;
            const mainCount = ensureArray(tccs.mainQualityCriteria).length;
            const safetyCount = ensureArray(tccs.safetyCriteria).length;

            return (
              <div
                key={tccs.id}
                className={`p-4 rounded-xl border transition-all ${
                  isActive
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border hover:border-border/80 bg-surface'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">
                      {tccs.code}
                    </span>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        <CheckCircleIcon className="w-3.5 h-3.5" /> ĐANG HIỆU LỰC
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-3 text-ink-muted border border-border">
                        LỊCH SỬ (V{sortedTccs.length - index})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-ink-muted">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>Ban hành: {formatDateStandard(tccs.issueDate)}</span>
                    </div>
                    <Link
                      to={`/tccs/detail/${tccs.id}`}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      Chi tiết <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-ink-muted block">Chỉ tiêu chất lượng:</span>
                    <span className="font-semibold text-ink-soft">{mainCount} chỉ tiêu</span>
                  </div>
                  <div>
                    <span className="text-ink-muted block">Chỉ tiêu an toàn:</span>
                    <span className="font-semibold text-ink-soft">{safetyCount} chỉ tiêu</span>
                  </div>
                  <div>
                    <span className="text-ink-muted block">Hạn dùng sản phẩm:</span>
                    <span className="font-semibold text-ink-soft">{tccs.shelfLife || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted block">Quy cách đóng gói:</span>
                    <span className="font-semibold text-ink-soft truncate block">{tccs.packaging || 'N/A'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
