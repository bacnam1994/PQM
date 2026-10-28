import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowPathIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { TestResult, Batch } from '../../../../types';
import { formatDateStandard } from '../../../../utils';

interface ProductHistoryTabProps {
  allProductResults: TestResult[];
  batches: Batch[];
  isFetchingAll: boolean;
  hasFetchedAll: boolean;
  isAdmin: boolean;
}

export const ProductHistoryTab: React.FC<ProductHistoryTabProps> = ({
  allProductResults,
  batches,
  isFetchingAll,
  hasFetchedAll,
  isAdmin,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      {isFetchingAll && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Đang tải đầy đủ lịch sử kiểm nghiệm từ cơ sở dữ liệu...
        </div>
      )}
      {hasFetchedAll && !isFetchingAll && (
        <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
          ✓ Đã tải đầy đủ {allProductResults.length} phiếu kiểm nghiệm
        </div>
      )}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-2/60 border-b border-border">
            <tr className="text-ink-muted font-semibold text-xs">
              <th className="py-3 px-4">Lô hàng</th>
              <th className="py-3 px-4">Ngày kiểm</th>
              <th className="py-3 px-4">Phòng Lab</th>
              <th className="py-3 px-4 text-center">Kết quả</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allProductResults.map(res => {
              const batch = batches.find(b => b.id === res.batchId);
              return (
                <tr key={res.id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-4 px-4 font-bold text-ink uppercase">
                    {batch ? (
                      <Link to={`/batches/${batch.id}`} className="hover:text-emerald-600 hover:underline">
                        {batch.batchNo}
                      </Link>
                    ) : (
                      <span className="text-ink-muted italic text-xs">{res.batchId?.slice(-6)}</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-ink-soft">{formatDateStandard(res.testDate)}</td>
                  <td className="py-4 px-4 text-ink-soft text-xs">{res.labName}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                      res.overallStatus === 'PASS' 
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                    }`}>
                      {res.overallStatus}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {isAdmin && (
                      <button 
                        onClick={() => navigate(`/test-results/edit/${res.id}`)} 
                        title="Sửa kết quả" 
                        className="text-emerald-600 hover:bg-emerald-500/10 p-2 rounded-xl transition-all cursor-pointer"
                      >
                        <ArrowRightIcon className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isFetchingAll && allProductResults.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-ink-muted italic text-sm">
                  Chưa có phiếu kiểm nghiệm nào cho sản phẩm này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
