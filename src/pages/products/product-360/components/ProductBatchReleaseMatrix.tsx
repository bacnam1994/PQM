import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Square3Stack3DIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarSquareIcon,
} from '@heroicons/react/24/outline';
import { formatDateStandard } from '../../../../utils';
import { Batch } from '../../../../types';

interface ProductBatchReleaseMatrixProps {
  batches: Batch[];
}

export const ProductBatchReleaseMatrix: React.FC<ProductBatchReleaseMatrixProps> = ({
  batches,
}) => {
  // Thống kê phân bổ theo năm sản xuất
  const statsByYear = useMemo(() => {
    const map = new Map<
      string,
      { total: number; released: number; rejected: number; pending: number }
    >();

    batches.forEach((b) => {
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
    return [...batches]
      .sort((a, b) => (b.mfgDate || '').localeCompare(a.mfgDate || ''))
      .slice(0, 10);
  }, [batches]);

  const totalBatches = batches.length;
  const releasedBatches = batches.filter((b) => b.status === 'RELEASED').length;
  const rejectedBatches = batches.filter((b) => b.status === 'REJECTED').length;
  const releaseRate = totalBatches > 0 ? Math.round((releasedBatches / totalBatches) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Thẻ chỉ số tổng quan sản xuất */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm">
          <p className="text-xs text-ink-muted">Tổng số lô đã sản xuất</p>
          <p className="text-2xl font-bold text-ink mt-1">{totalBatches}</p>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm">
          <p className="text-xs text-ink-muted">Số lô xuất xưởng thành công</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {releasedBatches}
          </p>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm">
          <p className="text-xs text-ink-muted">Số lô bị từ chối (OOS)</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {rejectedBatches}
          </p>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm">
          <p className="text-xs text-ink-muted">Tỷ lệ xuất xưởng (Release Rate)</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {releaseRate !== null ? `${releaseRate}%` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Ma trận phân bổ theo từng năm */}
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-ink text-sm">
              Ma trận Xuất xưởng qua các năm (Yearly Release Matrix)
            </h3>
          </div>
          <span className="text-xs font-medium text-ink-muted">
            {statsByYear.length} năm ghi nhận
          </span>
        </div>

        {statsByYear.length === 0 ? (
          <div className="text-center py-6 text-ink-muted text-sm">
            Chưa có số liệu sản xuất cho sản phẩm này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-2 text-ink uppercase font-semibold">
                <tr>
                  <th className="p-3">Năm sản xuất</th>
                  <th className="p-3">Tổng số lô</th>
                  <th className="p-3">Đã xuất xưởng (Released)</th>
                  <th className="p-3">Bị từ chối (Rejected)</th>
                  <th className="p-3">Đang xử lý / Chờ</th>
                  <th className="p-3">Tỷ lệ đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statsByYear.map(([year, stat]) => {
                  const rate =
                    stat.total > 0 ? Math.round((stat.released / stat.total) * 100) : null;
                  return (
                    <tr key={year} className="hover:bg-surface-2 transition-colors">
                      <td className="p-3 font-bold text-ink">{year}</td>
                      <td className="p-3 font-semibold text-ink-soft">{stat.total} lô</td>
                      <td className="p-3 text-emerald-600 dark:text-emerald-400 font-medium">
                        {stat.released} lô
                      </td>
                      <td className="p-3 text-rose-600 dark:text-rose-400 font-medium">
                        {stat.rejected} lô
                      </td>
                      <td className="p-3 text-amber-600 dark:text-amber-400 font-medium">
                        {stat.pending} lô
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">
                            {rate !== null ? `${rate}%` : 'N/A'}
                          </span>
                          {rate !== null && (
                            <div className="w-20 h-2 bg-surface-3 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${rate >= 90 ? 'bg-emerald-500' : rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                          )}
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
      <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Square3Stack3DIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold text-ink text-sm">10 Lô sản xuất gần nhất</h3>
          </div>
        </div>

        {recentBatches.length === 0 ? (
          <div className="text-center py-6 text-ink-muted text-sm">Chưa có lô sản xuất nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-2 text-ink uppercase font-semibold">
                <tr>
                  <th className="p-3">Số lô</th>
                  <th className="p-3">Ngày sản xuất</th>
                  <th className="p-3">Hạn sử dụng</th>
                  <th className="p-3">Năng suất thực tế</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác 360°</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-2 transition-colors">
                    <td className="p-3 font-bold text-ink">{b.batchNo}</td>
                    <td className="p-3 text-ink-soft">{formatDateStandard(b.mfgDate)}</td>
                    <td className="p-3 text-ink-soft">{formatDateStandard(b.expDate)}</td>
                    <td className="p-3 text-ink-soft">
                      {b.actualYield ? `${b.actualYield} ${b.yieldUnit || ''}` : '—'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          b.status === 'RELEASED'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            : b.status === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to={`/batches/360/${b.id}`}
                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 hover:underline"
                      >
                        <ChartBarSquareIcon className="w-3.5 h-3.5" /> Batch 360°
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
