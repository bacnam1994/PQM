import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartBarIcon, BuildingOffice2Icon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { MonthlyTestTrend, LabDistributionStat } from './types';
import { useAppStore } from '../../../store/useAppStore';

interface DashboardChartsProps {
  monthlyTrends: MonthlyTestTrend[];
  labDistribution: LabDistributionStat[];
}

// Custom tooltip for Monthly Trend Chart — tabular-nums & high contrast
const CustomTrendTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const pass = payload.find((p: any) => p.dataKey === 'pass')?.value || 0;
    const fail = payload.find((p: any) => p.dataKey === 'fail')?.value || 0;
    const pending = payload.find((p: any) => p.dataKey === 'pending')?.value || 0;
    const total = pass + fail + pending;
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;

    return (
      <div className="p-3 bg-surface/95 backdrop-blur-md border border-border shadow-lg rounded-xl text-xs space-y-1.5 min-w-[168px]">
        <div className="font-semibold text-ink border-b border-border/60 pb-1.5 flex justify-between items-center gap-3">
          <span>Tháng {label}</span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {passRate}% đạt
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Đạt chuẩn
          </span>
          <span className="font-semibold text-ink tabular-nums">{pass}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Chờ kết quả
          </span>
          <span className="font-semibold text-ink tabular-nums">{pending}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Không đạt
          </span>
          <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
            {fail}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/50 font-semibold text-ink">
          <span>Tổng cộng</span>
          <span className="tabular-nums">{total} phiếu</span>
        </div>
      </div>
    );
  }
  return null;
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  monthlyTrends,
  labDistribution,
}) => {
  const theme = useAppStore((state) => state.theme);
  const isDark =
    theme === 'dark' ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)';
  const axisColor = isDark ? '#a1a1aa' : '#64748b';

  return (
    <section
      aria-label="Biểu đồ xu hướng và cơ cấu đơn vị kiểm nghiệm"
      className="grid grid-cols-1 lg:grid-cols-12 gap-5"
    >
      {/* Chart 1: Monthly Testing Volume & Quality Breakdown (8 cols on lg) */}
      <div className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/85 backdrop-blur-md border border-border/80 space-y-4 shadow-xs flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ChartBarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-sm sm:text-base font-display">
                Xu hướng kiểm nghiệm 6 tháng gần nhất
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Phân bổ số lượng phiếu theo kết luận Đạt chuẩn, Chờ kết quả và Không đạt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Inline minimal legend (no chart chrome bloat) */}
            <div className="hidden md:flex items-center gap-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Đạt
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Chờ KQ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                OOS
              </span>
            </div>

            <Link
              to="/reports/trend-analysis"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <span>Phân tích SPC</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Recharts Bar Chart — horizontal grid lines only per ui-craft */}
        <div className="h-64 w-full pt-1">
          {monthlyTrends.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-ink-muted">
              Chưa có dữ liệu kiểm nghiệm theo tháng để hiển thị biểu đồ.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyTrends}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                barSize={24}
              >
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<CustomTrendTooltip />}
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)' }}
                />
                <Bar dataKey="pass" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="pass" />
                <Bar
                  dataKey="pending"
                  stackId="a"
                  fill="#f59e0b"
                  radius={[0, 0, 0, 0]}
                  name="pending"
                />
                <Bar dataKey="fail" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="fail" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 2: Testing Laboratories Breakdown (4 cols on lg) */}
      <div className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-surface/90 dark:bg-surface/85 backdrop-blur-md border border-border/80 space-y-4 flex flex-col justify-between shadow-xs">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-border/70">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-2 text-ink-soft flex items-center justify-center shrink-0">
                <BuildingOffice2Icon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-ink text-sm sm:text-base font-display">
                  Đơn vị kiểm nghiệm
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">Tỷ lệ đạt theo phòng thử nghiệm</p>
              </div>
            </div>

            <Link
              to="/quality/comparison"
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
            >
              Đối chiếu
            </Link>
          </div>

          {/* Horizontal proportion bars per ui-craft Chart Decision Matrix */}
          <div className="mt-4 space-y-3.5">
            {labDistribution.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-muted">
                Chưa có dữ liệu phân bổ đơn vị kiểm nghiệm.
              </div>
            ) : (
              labDistribution.slice(0, 5).map((lab, index) => (
                <div
                  key={index}
                  className="p-2.5 -mx-2.5 rounded-xl hover:bg-surface-2/60 transition-colors duration-150 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-ink truncate" title={lab.labName}>
                      {lab.labName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 tabular-nums">
                      <span className="font-mono font-semibold text-ink">{lab.passRate}%</span>
                      <span className="text-[11px] text-ink-muted">({lab.totalTests} phiếu)</span>
                    </div>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden flex">
                    <div
                      style={{ width: `${lab.passRate}%` }}
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-3.5 border-t border-border/60">
          <Link
            to="/laboratories"
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-surface-2/80 hover:bg-surface-3 text-xs font-medium text-ink-soft hover:text-ink transition-colors duration-150 border border-border/80"
          >
            <BuildingOffice2Icon className="w-3.5 h-3.5 text-ink-muted" />
            <span>Quản lý danh mục Đơn vị kiểm nghiệm</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
