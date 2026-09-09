import React from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { DSCard } from '../../../../components';
import { formatDateStandard } from '../../../../utils';

interface BatchHistoryTableProps {
  chartDataLength: number;
  selectedCriteria: any;
  enrichedData: any[];
}

export const BatchHistoryTable: React.FC<BatchHistoryTableProps> = ({
  chartDataLength,
  selectedCriteria,
  enrichedData
}) => {
  return (
    <DSCard className="overflow-hidden p-0 border border-border">
      <div className="px-5 py-3.5 border-b border-border bg-surface-2">
        <h4 className="font-bold text-ink text-sm">Dữ liệu chi tiết ({chartDataLength} lô)</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-2 border-b border-border">
              {['#', 'Số lô', 'Ngày SX', `Giá trị đo (${selectedCriteria?.unit || 'Số'})`, 'Tỉ lệ % công bố', 'Trạng thái SPC'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-ink-muted whitespace-nowrap text-[11px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {enrichedData.map(d => (
              <tr key={d.batchNo}
                className={`hover:bg-surface-2 transition-colors ${d.isOOS ? 'bg-rose-500/10' : d.isOOC ? 'bg-amber-500/10' : ''}`}>
                <td className="px-4 py-2.5 text-ink-muted font-mono">{d.index}</td>
                <td className="px-4 py-2.5 font-bold text-ink">{d.batchNo}</td>
                <td className="px-4 py-2.5 text-ink-muted font-mono">{d.mfgDate ? formatDateStandard(d.mfgDate) : '---'}</td>
                <td className="px-4 py-2.5 font-mono font-bold text-ink">{d.value.toFixed(4)}</td>
                <td className="px-4 py-2.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {d.percent !== null ? `${d.percent.toFixed(1)}%` : '---'}
                </td>
                <td className="px-4 py-2.5">
                  {d.isOOS
                    ? <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold"><XCircleIcon className="w-4 h-4" /> Ngoài spec</span>
                    : d.isOOC
                    ? <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold"><ExclamationTriangleIcon className="w-4 h-4" /> Ngoài KS (3σ)</span>
                    : <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold"><CheckCircleIcon className="w-4 h-4" /> Trong tầm kiểm soát</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DSCard>
  );
};
