import React from 'react';
import { BarChart2, Info, X } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { DSCard, DSTable } from '../../../../components';
import { Criterion } from '../../../../types';
import { CriteriaStat } from '../types';
import { getCriterionLimitText } from '../utils/reportHelpers';

interface CriteriaSpcSummaryTableProps {
  mainCriteria: Criterion[];
  criteriaStats: Record<string, CriteriaStat>;
  selectedCriteriaName: string | null;
  setSelectedCriteriaName: (name: string | null) => void;
  histogramData: any[];
  getInsight: (name: string) => string;
  isDark: boolean;
}

export const CriteriaSpcSummaryTable: React.FC<CriteriaSpcSummaryTableProps> = ({
  mainCriteria,
  criteriaStats,
  selectedCriteriaName,
  setSelectedCriteriaName,
  histogramData,
  getInsight,
  isDark
}) => {
  return (
    <DSCard className="overflow-hidden p-0">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
        <h4 className="font-black text-slate-700 dark:text-zinc-200 text-sm">
          Bảng Năng lực Quy trình theo Chỉ tiêu (SPC KPIs Summary)
        </h4>
        <span className="text-[11px] text-slate-400">Click vào chỉ tiêu để xem phân bố Histogram</span>
      </div>

      <div className="overflow-x-auto">
        <DSTable>
          <thead className="bg-slate-50 dark:bg-zinc-900/50">
            <tr className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-wider">
              <th className="px-4 py-3">Chỉ tiêu</th>
              <th className="px-4 py-3">Giới hạn TCCS</th>
              <th className="px-4 py-3 text-right">Số mẫu</th>
              <th className="px-4 py-3 text-right">Trung bình (X̄)</th>
              <th className="px-4 py-3 text-right">Độ lệch (σ)</th>
              <th className="px-4 py-3 text-right">CV (%)</th>
              <th className="px-4 py-3 text-right">UCL / LCL</th>
              <th className="px-4 py-3 text-center">Năng lực (Cpk)</th>
              <th className="px-4 py-3 text-center">Lô OOS</th>
              <th className="px-4 py-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-xs">
            {mainCriteria.map(criterion => {
              const stat = criteriaStats[criterion.name];
              if (!stat) return null;

              const isSelected = selectedCriteriaName === criterion.name;
              const limitText = getCriterionLimitText(criterion);
              const hasData = stat.values.length > 0;

              return (
                <React.Fragment key={criterion.name}>
                  <tr
                    onClick={() => setSelectedCriteriaName(isSelected ? null : criterion.name)}
                    className={`hover:bg-slate-50 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/30 font-semibold' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-zinc-200">
                      {criterion.name}
                      {criterion.unit && <span className="text-[10px] text-slate-400 ml-1 font-normal">({criterion.unit})</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{limitText}</td>
                    <td className="px-4 py-3 text-right font-mono">{stat.values.length}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {hasData ? stat.mean.toFixed(3) : '---'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                      {hasData ? stat.stdDev.toFixed(3) : '---'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {hasData ? `${stat.cv.toFixed(1)}%` : '---'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">
                      {hasData ? `${stat.ucl.toFixed(2)} / ${stat.lcl.toFixed(2)}` : '---'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {stat.cpk !== null ? (
                        <span className={`font-black text-xs px-2 py-0.5 rounded-md ${
                          stat.cpk >= 1.33
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : stat.cpk >= 1.0
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}>
                          {stat.cpk.toFixed(2)} {stat.cpkType}
                        </span>
                      ) : (
                        <span className="text-slate-300">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {stat.failBatches.length > 0 ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded text-[11px]">
                          {stat.failBatches.length} lô
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-[11px]">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded text-indigo-600 transition-colors cursor-pointer"
                        title="Xem biểu đồ phân bố Histogram"
                      >
                        <BarChart2 size={15} />
                      </button>
                    </td>
                  </tr>

                  {/* Histogram Expandable Row */}
                  {isSelected && (
                    <tr className="bg-slate-50/80 dark:bg-zinc-900/60">
                      <td colSpan={10} className="p-4 border-y border-indigo-100 dark:border-indigo-950">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Info size={14} className="text-indigo-500" />
                              <span className="font-bold text-xs text-slate-700 dark:text-zinc-200">
                                Đánh giá chuyên sâu: {getInsight(criterion.name)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCriteriaName(null);
                              }}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {histogramData.length > 0 && (
                            <div className="h-44 w-full pt-1">
                              <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Phân bố tần số (Histogram)</p>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={histogramData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="2 2" stroke={isDark ? '#27272a' : '#e2e8f0'} />
                                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                                  <Tooltip />
                                  <Bar dataKey="count" name="Số lượng mẫu" fill="#818cf8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </DSTable>
      </div>
    </DSCard>
  );
};
