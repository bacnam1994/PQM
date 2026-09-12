import React from 'react';
import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ReceiptPercentIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ReferenceLine,
} from 'recharts';
import { getActiveLocale, formatDateStandard } from '../../../../utils';

interface ProductAnalyticsTabProps {
  allQualityCriteriaNames: string[];
  selectedCriteria: Set<string>;
  toggleCriterion: (name: string) => void;
  selectAllCriteria: () => void;
  clearAllCriteria: () => void;
  analyticsDataMap: Record<string, any>;
  criteriaViewModes: Record<string, 'PERCENT' | 'VALUE'>;
  toggleCriterionViewMode: (name: string) => void;
  expandedTables: Record<string, boolean>;
  toggleCriterionTable: (name: string) => void;
}

const labColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

export const ProductAnalyticsTab: React.FC<ProductAnalyticsTabProps> = ({
  allQualityCriteriaNames,
  selectedCriteria,
  toggleCriterion,
  selectAllCriteria,
  clearAllCriteria,
  analyticsDataMap,
  criteriaViewModes,
  toggleCriterionViewMode,
  expandedTables,
  toggleCriterionTable,
}) => {
  return (
    <div className="space-y-6">
      {/* Panel chọn chỉ tiêu */}
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ink flex items-center gap-2">
              <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-600" />
              Chọn chỉ tiêu chất lượng để phân tích biến động:
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              Hệ thống tự động quy đổi tỉ lệ % theo hàm lượng công bố / chuẩn TCCS và đánh giá hệ số biến động (CV%).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAllCriteria}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
            >
              Chọn tất cả
            </button>
            <button
              onClick={clearAllCriteria}
              className="text-xs font-medium text-ink-muted bg-surface hover:bg-surface-2 border border-border px-2.5 py-1 rounded-lg transition-all cursor-pointer"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
        {allQualityCriteriaNames.length === 0 ? (
          <p className="text-xs text-ink-muted italic">Chưa có TCCS nào được khai báo chỉ tiêu chất lượng.</p>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {allQualityCriteriaNames.map(name => {
              const meta = analyticsDataMap[name];
              const count = meta?.batchDataList?.length || 0;
              const isSelected = selectedCriteria.has(name);
              return (
                <button
                  key={name}
                  onClick={() => toggleCriterion(name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-surface text-ink-soft border-border hover:border-emerald-500/50 hover:text-emerald-700'
                  }`}
                >
                  {isSelected && <span className="text-[11px]">✓</span>}
                  <span>{name}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-emerald-700 text-white' : 'bg-surface-3 text-ink-muted'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Biểu đồ & Thống kê cho từng chỉ tiêu đã chọn */}
      {selectedCriteria.size === 0 ? (
        <div className="h-[240px] flex flex-col items-center justify-center text-ink-muted italic text-sm gap-3 bg-surface-2/40 rounded-2xl border border-dashed border-border">
          <ChartBarIcon className="w-10 h-10 text-ink-muted opacity-40" />
          <div className="text-center">
            <p className="font-bold text-ink">Chưa chọn chỉ tiêu nào</p>
            <p className="text-xs text-ink-muted mt-0.5">Chọn một hoặc nhiều chỉ tiêu ở trên để xem biểu đồ và tỉ lệ % biến động.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(selectedCriteria).map(criterionName => {
            const meta = analyticsDataMap[criterionName];
            if (!meta) return null;

            const {
              unit, min, max, expectedText, declaredContent, targetBasis,
              chartData, batchDataList, labs: criterionLabs, stats
            } = meta;

            const currentMode = criteriaViewModes[criterionName] || (targetBasis ? 'PERCENT' : 'VALUE');
            const isPercentMode = currentMode === 'PERCENT';
            const isTableExpanded = expandedTables[criterionName] || false;

            const displayChartData = chartData.map((d: any) => {
              const row: any = { ...d };
              criterionLabs.forEach((lab: string) => {
                row[lab] = isPercentMode ? d[`${lab}_pct`] : d[`${lab}_val`];
              });
              return row;
            });

            return (
              <div key={criterionName} className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4">
                {/* Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-ink uppercase tracking-tight">
                          {criterionName}
                        </h4>
                        {unit && <span className="text-xs font-bold text-ink-muted">({unit})</span>}
                      </div>
                      <p className="text-[11px] text-ink-muted">
                        {declaredContent ? (
                          <>Mức công bố: <span className="font-bold text-ink font-mono">{declaredContent.toLocaleString(getActiveLocale())} {unit}</span> (Chuẩn 100%)</>
                        ) : targetBasis ? (
                          <>Mức chuẩn tham chiếu: <span className="font-bold text-ink font-mono">{targetBasis.toLocaleString(getActiveLocale())} {unit}</span></>
                        ) : (
                          <>Chưa thiết lập hàm lượng công bố</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Mode */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg p-0.5 bg-surface-2 border border-border">
                      <button
                        type="button"
                        onClick={() => toggleCriterionViewMode(criterionName)}
                        disabled={!targetBasis}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          isPercentMode
                            ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-xs'
                            : 'text-ink-muted hover:text-ink disabled:opacity-40'
                        }`}
                        title={!targetBasis ? 'Chưa có mức công bố để tính %' : 'Xem theo tỉ lệ % so với công bố'}
                      >
                        <ReceiptPercentIcon className="w-3.5 h-3.5" /> Tỉ lệ %
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCriterionViewMode(criterionName)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          !isPercentMode
                            ? 'bg-surface text-emerald-600 dark:text-emerald-400 shadow-xs'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" /> Giá trị thực ({unit || 'Số'})
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5 Thẻ KPI Thống kê & Biến động */}
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="bg-surface-2 p-3 rounded-xl border border-border flex flex-col justify-between">
                      <span className="text-[10px] font-black text-ink-muted uppercase tracking-wider">Mức chuẩn / Công bố</span>
                      <div className="mt-1">
                        <span className="text-sm font-black text-ink font-mono">
                          {declaredContent ? `${declaredContent.toLocaleString(getActiveLocale())} ${unit}` : (min !== undefined && max !== undefined ? `${min} ~ ${max} ${unit}` : '---')}
                        </span>
                        <p className="text-[10px] text-ink-muted mt-0.5 font-medium">
                          {min !== undefined && max !== undefined ? `TCCS: ${min} ~ ${max} ${unit}` : expectedText || 'Mức danh định 100%'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 flex flex-col justify-between">
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Trung bình thực tế (X̄)</span>
                      <div className="mt-1">
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                            {stats.mean.toLocaleString(getActiveLocale(), { maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-emerald-500 font-bold">{unit}</span>
                        </div>
                        {stats.meanPercent !== null ? (
                          <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                            = {stats.meanPercent.toFixed(1)}% <span className="font-normal text-[10px] opacity-75">công bố</span>
                          </p>
                        ) : (
                          <p className="text-[10px] text-ink-muted mt-0.5">σ = {stats.stdDev.toFixed(2)}</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-surface-2 p-3 rounded-xl border border-border flex flex-col justify-between">
                      <span className="text-[10px] font-black text-ink-muted uppercase tracking-wider">Hệ số biến động (CV)</span>
                      <div className="mt-1">
                        <div className="text-base font-black text-ink font-mono">
                          {stats.cv.toFixed(1)}%
                        </div>
                        <span className={`inline-block mt-0.5 text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${stats.stabilityCls}`}>
                          {stats.stabilityLabel}
                        </span>
                      </div>
                    </div>

                    <div className="bg-surface-2 p-3 rounded-xl border border-border flex flex-col justify-between">
                      <span className="text-[10px] font-black text-ink-muted uppercase tracking-wider">Khoảng biến động</span>
                      <div className="mt-1">
                        <div className="text-xs font-black text-ink font-mono">
                          {stats.minVal.toLocaleString(getActiveLocale(), { maximumFractionDigits: 2 })} ~ {stats.maxVal.toLocaleString(getActiveLocale(), { maximumFractionDigits: 2 })}
                        </div>
                        {stats.minPercent !== null && stats.maxPercent !== null && (
                          <p className="text-[10px] text-ink-muted mt-0.5 font-mono">
                            {stats.minPercent.toFixed(1)}% ~ {stats.maxPercent.toFixed(1)}% (Δ {stats.spreadPercent?.toFixed(1)}%)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bg-surface-2 p-3 rounded-xl border border-border flex flex-col justify-between">
                      <span className="text-[10px] font-black text-ink-muted uppercase tracking-wider">Tỷ lệ đạt chuẩn</span>
                      <div className="mt-1">
                        <div className="flex items-baseline gap-1 font-mono">
                          <span className={`text-base font-black ${stats.passRate === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {stats.passRate.toFixed(0)}%
                          </span>
                          <span className="text-[10px] text-ink-muted">({stats.passCount}/{stats.sampleCount} lô)</span>
                        </div>
                        {stats.failCount > 0 && (
                          <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                            {stats.failCount} lô không đạt spec
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Biểu đồ Recharts */}
                <div className="h-[280px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayChartData} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" />
                      <XAxis dataKey="name" stroke="currentColor" className="text-ink-muted" tick={{ fontSize: 11 }} />
                      <YAxis
                        stroke="currentColor"
                        className="text-ink-muted"
                        tick={{ fontSize: 11 }}
                        unit={isPercentMode ? '%' : ''}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-surface, #18181b)',
                          borderColor: 'var(--color-border, #27272a)',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                        }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      {isPercentMode && (
                        <ReferenceLine y={100} stroke="#10b981" strokeDasharray="4 4" label={{ value: '100% Chuẩn', fill: '#10b981', fontSize: 10 }} />
                      )}
                      {criterionLabs.map((lab: string, i: number) => (
                        <Line
                          key={lab}
                          type="monotone"
                          dataKey={lab}
                          name={lab}
                          stroke={labColors[i % labColors.length]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Collapsible Detail Table */}
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={() => toggleCriterionTable(criterionName)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {isTableExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    {isTableExpanded ? 'Thu gọn bảng dữ liệu chi tiết' : `Xem bảng dữ liệu chi tiết (${batchDataList.length} kết quả)`}
                  </button>

                  {isTableExpanded && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-2 border-b border-border text-ink-muted font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Lô sản xuất</th>
                            <th className="py-2.5 px-3">Ngày kiểm</th>
                            <th className="py-2.5 px-3">Phòng Lab</th>
                            <th className="py-2.5 px-3 text-right">Giá trị đo</th>
                            <th className="py-2.5 px-3 text-right">Tỉ lệ %</th>
                            <th className="py-2.5 px-3 text-center">Đánh giá</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {batchDataList.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-surface-2 transition-colors">
                              <td className="py-2 px-3 font-semibold text-ink">{item.batchNo}</td>
                              <td className="py-2 px-3 text-ink-muted">{formatDateStandard(item.testDate)}</td>
                              <td className="py-2 px-3 text-ink-muted">{item.labName}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-ink">
                                {item.value} {unit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-ink">
                                {item.percent !== null ? `${item.percent.toFixed(1)}%` : '---'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {item.isPass ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <CheckCircleIcon className="w-3 h-3" /> ĐẠT
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                    <XCircleIcon className="w-3 h-3" /> KHÔNG ĐẠT
                                  </span>
                                )}
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
          })}
        </div>
      )}
    </div>
  );
};
