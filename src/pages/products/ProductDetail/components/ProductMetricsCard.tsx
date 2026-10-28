import React from 'react';
import {
  ArchiveBoxIcon,
  CheckBadgeIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { formatDateStandard } from '../../../../utils';

interface ProductMetricsCardProps {
  totalBatches: number;
  totalTestResults: number;
  passRate: number | null;
  activeTccsCode: string;
  lastTestDate: string | null;
}

export const ProductMetricsCard: React.FC<ProductMetricsCardProps> = ({
  totalBatches,
  totalTestResults,
  passRate,
  activeTccsCode,
  lastTestDate,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <div className="p-4 bg-surface rounded-xl border border-border shadow-xs flex items-center gap-3.5">
        <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
          <ArchiveBoxIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-ink-muted font-medium">Lô sản xuất</p>
          <p className="text-lg font-bold text-ink">
            {totalBatches} <span className="text-xs font-normal text-ink-muted">lô</span>
          </p>
        </div>
      </div>

      <div className="p-4 bg-surface rounded-xl border border-border shadow-xs flex items-center gap-3.5">
        <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
          <CheckBadgeIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-ink-muted font-medium">Tỷ lệ Đạt chuẩn</p>
          <p className="text-lg font-bold text-ink">
            {passRate !== null ? `${passRate}%` : 'N/A'}{' '}
            <span className="text-xs font-normal text-ink-muted">({totalTestResults} phiếu)</span>
          </p>
        </div>
      </div>

      <div className="p-4 bg-surface rounded-xl border border-border shadow-xs flex items-center gap-3.5">
        <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
          <DocumentTextIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-ink-muted font-medium">TCCS Hiệu lực</p>
          <p className="text-base font-bold text-ink truncate max-w-[140px]" title={activeTccsCode}>
            {activeTccsCode}
          </p>
        </div>
      </div>

      <div className="p-4 bg-surface rounded-xl border border-border shadow-xs flex items-center gap-3.5">
        <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
          <CalendarDaysIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-ink-muted font-medium">Kiểm tra gần nhất</p>
          <p className="text-base font-bold text-ink">
            {lastTestDate ? formatDateStandard(lastTestDate) : 'Chưa có'}
          </p>
        </div>
      </div>
    </div>
  );
};
