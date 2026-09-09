import React from 'react';
import { TrendingUp, Activity, AlertCircle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell
} from 'recharts';
import { DSCard } from '../../../../components';
import { Criterion } from '../../../../types';
import { CriteriaStat, FailCriteriaSummaryItem } from '../types';

interface ReportTabsSectionProps {
  activeTab: 'trend' | 'spc' | 'fail';
  setActiveTab: (tab: 'trend' | 'spc' | 'fail') => void;
  trendChartData: any[];
  spcChartData: any[];
  failCriteriaSummary: FailCriteriaSummaryItem[];
  mainCriteria: Criterion[];
  criteriaStats: Record<string, CriteriaStat>;
  spcCriteriaName: string;
  setSpcCriteriaName: (name: string) => void;
  isDark: boolean;
}

const LINE_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6'];

export const ReportTabsSection: React.FC<ReportTabsSectionProps> = ({
  activeTab,
  setActiveTab,
  trendChartData,
  spcChartData,
  failCriteriaSummary,
  mainCriteria,
  criteriaStats,
  spcCriteriaName,
  setSpcCriteriaName,
  isDark
}) => {
  const currentSpcStat = criteriaStats[spcCriteriaName];

  return (
    <DSCard className="p-5 space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('trend')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'trend'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <TrendingUp size={14} />
            <span>Xu hướng (% công bố)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('spc')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'spc'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Activity size={14} />
            <span>Kiểm soát SPC (X̄/3σ)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fail')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'fail'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <AlertCircle size={14} />
            <span>Chỉ tiêu không đạt ({failCriteriaSummary.length})</span>
          </button>
        </div>

        {activeTab === 'spc' && mainCriteria.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-bold">Chỉ tiêu SPC:</span>
            <select
              value={spcCriteriaName}
              onChange={e => setSpcCriteriaName(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-zinc-200"
            >
              {mainCriteria.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab 1: Trend Chart */}
      {activeTab === 'trend' && (
        <div className="h-80 w-full pt-2">
          {trendChartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
              Chưa có dữ liệu xu hướng %
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f1f5f9'} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" angle={-25} textAnchor="end" />
                <YAxis unit="%" tick={{ fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" label={{ value: '100% Target', fill: '#10b981', fontSize: 10 }} />
                {mainCriteria.map((c, i) => (
                  <Line
                    key={c.name}
                    type="monotone"
                    dataKey={c.name}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Tab 2: SPC Control Chart */}
      {activeTab === 'spc' && (
        <div className="space-y-2">
          {currentSpcStat && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 pb-1 font-mono">
              <span>X̄ = <strong className="text-indigo-600 dark:text-indigo-400">{currentSpcStat.mean.toFixed(3)}</strong></span>
              <span>σ = <strong>{currentSpcStat.stdDev.toFixed(3)}</strong></span>
              <span>UCL = <strong className="text-rose-500">{currentSpcStat.ucl.toFixed(3)}</strong></span>
              <span>LCL = <strong className="text-rose-500">{currentSpcStat.lcl.toFixed(3)}</strong></span>
              <span>Cpk = <strong className="text-emerald-600">{currentSpcStat.cpk !== null ? currentSpcStat.cpk.toFixed(2) : '---'}</strong></span>
            </div>
          )}
          <div className="h-80 w-full">
            {spcChartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
                Chưa có dữ liệu định lượng cho chỉ tiêu này
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spcChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f1f5f9'} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  {currentSpcStat && (
                    <>
                      <ReferenceLine y={currentSpcStat.ucl} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'UCL', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={currentSpcStat.mean} stroke="#6366f1" strokeDasharray="2 2" label={{ value: 'Mean', fill: '#6366f1', fontSize: 10 }} />
                      <ReferenceLine y={currentSpcStat.lcl} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'LCL', fill: '#ef4444', fontSize: 10 }} />
                    </>
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={spcCriteriaName}
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const d = props.payload;
                      return (
                        <circle
                          key={`dot-${d.name}`}
                          cx={props.cx}
                          cy={props.cy}
                          r={d.isOutOfControl ? 6 : 4}
                          fill={d.isOutOfControl ? '#ef4444' : '#6366f1'}
                          stroke="#fff"
                          strokeWidth={1.5}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Fail criteria BarChart */}
      {activeTab === 'fail' && (
        <div className="h-80 w-full pt-2">
          {failCriteriaSummary.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-emerald-600 text-xs font-bold gap-1">
              <span>✓ Tuyệt vời! Không có chỉ tiêu nào phát sinh lỗi OOS/OOT trong kỳ này.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={failCriteriaSummary} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#f1f5f9'} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis unit="%" tick={{ fontSize: 10 }} />
                <Tooltip formatter={(val: any) => [`${Number(val).toFixed(1)}%`, 'Tỷ lệ không đạt']} />
                <Bar dataKey="failRate" name="Tỷ lệ không đạt (%)" fill="#ef4444" radius={[6, 6, 0, 0]}>
                  {failCriteriaSummary.map((_, index) => (
                    <Cell key={`cell-${index}`} fill="#ef4444" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </DSCard>
  );
};
