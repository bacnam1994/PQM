import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
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
    <DSCard className="overflow-hidden p-0">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800">
        <h4 className="font-black text-slate-700 dark:text-zinc-200 text-sm">Dữ liệu chi tiết ({chartDataLength} lô)</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-zinc-900/50">
              {['#', 'Số lô', 'Ngày SX', `Giá trị đo (${selectedCriteria?.unit || 'Số'})`, 'Tỉ lệ % công bố', 'Trạng thái SPC'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 dark:text-zinc-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-zinc-900">
            {enrichedData.map(d => (
              <tr key={d.batchNo}
                className={`hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors ${d.isOOS ? 'bg-red-50/60 dark:bg-red-900/10' : d.isOOC ? 'bg-orange-50/60 dark:bg-orange-900/10' : ''}`}>
                <td className="px-4 py-2 text-slate-400 dark:text-zinc-600 font-mono">{d.index}</td>
                <td className="px-4 py-2 font-bold text-slate-700 dark:text-zinc-200">{d.batchNo}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-zinc-400 font-mono">{d.mfgDate ? formatDateStandard(d.mfgDate) : '---'}</td>
                <td className="px-4 py-2 font-mono font-bold text-slate-800 dark:text-zinc-100">{d.value.toFixed(4)}</td>
                <td className="px-4 py-2 font-mono font-black text-indigo-600 dark:text-indigo-400">
                  {d.percent !== null ? `${d.percent.toFixed(1)}%` : '---'}
                </td>
                <td className="px-4 py-2">
                  {d.isOOS
                    ? <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-bold"><XCircle size={12} /> Ngoài spec</span>
                    : d.isOOC
                    ? <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-bold"><AlertTriangle size={12} /> Ngoài KS (3σ)</span>
                    : <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold"><CheckCircle2 size={12} /> Trong tầm kiểm soát</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DSCard>
  );
};
