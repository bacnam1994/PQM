import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layers, CheckCircle2, XCircle, AlertTriangle, 
  TrendingUp, Calendar, ExternalLink, Activity 
} from 'lucide-react';
import { formatDateStandard } from '../../../../utils';
import { Batch } from '../../../../types';

interface ProductBatchReleaseMatrixProps {
  batches: Batch[];
}

export const ProductBatchReleaseMatrix: React.FC<ProductBatchReleaseMatrixProps> = ({
  batches
}) => {
  // Thống kê phân bổ theo năm sản xuất
  const statsByYear = useMemo(() => {
    const map = new Map<string, { total: number; released: number; rejected: number; pending: number }>();

    batches.forEach(b => {
      const year = b.mfgDate ? b.mfgDate.substring(0, 4) : 'Khác';
      const curr = map.get(year) || { total: 0, released: 0, rejected: 0, pending: 0 };
      curr.total += 1;
      if (b.status === 'RELEASED') curr.released += 1;
      else if (b.status === 'REJECTED') curr.rejected += 1;
      else curr.pending += 1;
      map.set(year, curr);
    });

    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [batches]);

  // Sắp xếp lô mới nhất
  const recentBatches = useMemo(() => {
    return [...batches].sort((a, b) => (b.mfgDate || '').localeCompare(a.mfgDate || '')).slice(0, 10);
  }, [batches]);

  const totalBatches = batches.length;
  const releasedBatches = batches.filter(b => b.status === 'RELEASED').length;
  const rejectedBatches = batches.filter(b => b.status === 'REJECTED').length;
  const releaseRate = totalBatches > 0 ? Math.round((releasedBatches / totalBatches) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Thẻ chỉ số tổng quan sản xuất */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tổng số lô đã sản xuất</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalBatches}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Số lô xuất xưởng thành công</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{releasedBatches}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Số lô bị từ chối (OOS)</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{rejectedBatches}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tỷ lệ xuất xưởng (Release Rate)</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{releaseRate}%</span>
          </div>
        </div>
      </div>

      {/* Ma trận phân bổ theo từng năm */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
              Ma trận Xuất xưởng qua các năm (Yearly Release Matrix)
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {statsByYear.length} năm ghi nhận
          </span>
        </div>

        {statsByYear.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            Chưa có số liệu sản xuất cho sản phẩm này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 uppercase font-semibold">
                <tr>
                  <th className="p-3">Năm sản xuất</th>
                  <th className="p-3">Tổng số lô</th>
                  <th className="p-3">Đã xuất xưởng (Released)</th>
                  <th className="p-3">Bị từ chối (Rejected)</th>
                  <th className="p-3">Đang xử lý / Chờ</th>
                  <th className="p-3">Tỷ lệ đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {statsByYear.map(([year, stat]) => {
                  const rate = stat.total > 0 ? Math.round((stat.released / stat.total) * 100) : 100;
                  return (
                    <tr key={year} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{year}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{stat.total} lô</td>
                      <td className="p-3 text-emerald-600 dark:text-emerald-400 font-medium">{stat.released} lô</td>
                      <td className="p-3 text-rose-600 dark:text-rose-400 font-medium">{stat.rejected} lô</td>
                      <td className="p-3 text-amber-600 dark:text-amber-400 font-medium">{stat.pending} lô</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{rate}%</span>
                          <div className="w-20 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${rate >= 90 ? 'bg-emerald-500' : rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                              style={{ width: `${rate}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danh sách 10 lô sản xuất gần nhất */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
              10 Lô sản xuất gần nhất
            </h3>
          </div>
        </div>

        {recentBatches.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            Chưa có lô sản xuất nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 uppercase font-semibold">
                <tr>
                  <th className="p-3">Số lô</th>
                  <th className="p-3">Ngày sản xuất</th>
                  <th className="p-3">Hạn sử dụng</th>
                  <th className="p-3">Năng suất thực tế</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác 360°</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {recentBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{b.batchNo}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{formatDateStandard(b.mfgDate)}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{formatDateStandard(b.expDate)}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {b.actualYield ? `${b.actualYield} ${b.yieldUnit || ''}` : '—'}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        b.status === 'RELEASED' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' :
                        b.status === 'REJECTED' ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300' :
                        'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to={`/batches/360/${b.id}`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold inline-flex items-center gap-1"
                      >
                        <Activity className="w-3.5 h-3.5" /> Batch 360°
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
