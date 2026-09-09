import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, Clock, Calendar, ExternalLink, ShieldCheck } from 'lucide-react';
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
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            Lịch sử Tiến hóa Tiêu chuẩn Cơ sở (TCCS History)
          </h3>
        </div>
        <span className="text-xs font-medium text-slate-500">
          Tổng số {tccsList.length} phiên bản
        </span>
      </div>

      {sortedTccs.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
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
                    ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {tccs.code}
                    </span>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> ĐANG HIỆU LỰC
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        LỊCH SỬ (V{sortedTccs.length - index})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Ban hành: {formatDateStandard(tccs.issueDate)}</span>
                    </div>
                    <Link
                      to={`/tccs/detail/${tccs.id}`}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 font-medium"
                    >
                      Chi tiết <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <div>
                    <span className="text-slate-400 block">Chỉ tiêu chất lượng:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{mainCount} chỉ tiêu</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Chỉ tiêu an toàn:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{safetyCount} chỉ tiêu</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Hạn dùng sản phẩm:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{tccs.shelfLife || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Quy cách đóng gói:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">{tccs.packaging || 'N/A'}</span>
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
