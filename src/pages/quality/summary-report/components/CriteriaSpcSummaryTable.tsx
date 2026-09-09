import React from 'react';
import { 
  ChartBarIcon, 
  InformationCircleIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';
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
    <DSCard className="overflow-hidden p-0 border border-border">
      <div className="px-5 py-3.5 border-b border-border bg-surface-2 flex items-center justify-between">
        <h4 className="font-bold text-ink text-sm">
          Bảng Năng lực Quy trình theo Chỉ tiêu (SPC KPIs Summary)
        </h4>
        <span className="text-[11px] text-ink-muted">Click vào chỉ tiêu để xem phân bố Histogram</span>
      </div>

      <div className="overflow-x-auto">
        <DSTable>
          <thead className="bg-surface-2">
            <tr className="text-ink-muted text-[11px] font-semibold uppercase tracking-wider">
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
          <tbody className="divide-y divide-border text-xs">
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
                    className={`hover:bg-surface-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-500/5 font-semibold' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-ink">
                      {criterion.name}
                      {criterion.unit && <span className="text-[10px] text-ink-muted ml-1 font-normal">({criterion.unit})</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-muted font-mono text-[11px]">{limitText}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink">{stat.values.length}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {hasData ? stat.mean.toFixed(3) : '---'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink-muted">
                      {hasData ? stat.stdDev.toFixed(3) : '---'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink">
                      {hasData ? `${stat.cv.toFixed(1)}%` : '---'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-ink-muted">
                      {hasData ? `${stat.ucl.toFixed(2)} / ${stat.lcl.toFixed(2)}` : '---'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {stat.cpk !== null ? (
                        <span className={`inline-flex items-center font-bold text-xs px-2.5 py-0.5 rounded-full ${
                          stat.cpk >= 1.33
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            : stat.cpk >= 1.0
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                        }`}>
                          {stat.cpk.toFixed(2)} {stat.cpkType}
                        </span>
                      ) : (
                        <span className="text-ink-muted">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {stat.failBatches.length > 0 ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full text-[11px] border border-rose-500/20">
                          {stat.failBatches.length} lô
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        className="p-1.5 hover:bg-surface-3 rounded-lg text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                        title="Xem biểu đồ phân bố Histogram"
                      >
                        <ChartBarIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {/* Histogram Expandable Row */}
                  {isSelected && (
                    <tr className="bg-surface-2/70">
                      <td colSpan={10} className="p-4 border-y border-border">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <InformationCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="font-bold text-xs text-ink">
                                Đánh giá chuyên sâu: {getInsight(criterion.name)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCriteriaName(null);
                              }}
                              className="text-ink-muted hover:text-ink cursor-pointer p-1 rounded-md hover:bg-surface-3 transition-colors"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>

                          {histogramData.length > 0 && (
                            <div className="h-44 w-full pt-1">
                              <p className="text-[10px] font-bold text-ink-muted mb-1 uppercase tracking-wider">Phân bố tần số (Histogram)</p>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={histogramData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="2 2" stroke={isDark ? '#27272a' : '#e2e8f0'} />
                                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                                  <Tooltip />
                                  <Bar dataKey="count" name="Số lượng mẫu" fill="#10b981" radius={[4, 4, 0, 0]} />
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
