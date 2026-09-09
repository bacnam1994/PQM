import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Brush
} from 'recharts';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { DSCard } from '../../../../components';
import { TrendTooltip } from './TrendTooltip';

interface ControlChartSectionProps {
  selectedCriteriaName: string;
  selectedCriteria: any;
  spcStats: any;
  enrichedData: any[];
  gridColor: string;
  axisColor: string;
  isDark: boolean;
}

export const ControlChartSection: React.FC<ControlChartSectionProps> = ({
  selectedCriteriaName,
  selectedCriteria,
  spcStats,
  enrichedData,
  gridColor,
  axisColor,
  isDark
}) => {
  if (!spcStats) return null;

  return (
    <div className="space-y-4">
      <DSCard className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-ink text-base">
              Biểu đồ kiểm soát — <span className="text-emerald-600 dark:text-emerald-400">{selectedCriteriaName}</span>
              {selectedCriteria?.unit ? ` (${selectedCriteria.unit})` : ''}
            </h3>
            <p className="text-xs text-ink-muted mt-0.5 font-mono">
              UCL={spcStats.ucl.toFixed(4)} | X̄={spcStats.mean.toFixed(4)} | LCL={spcStats.lcl.toFixed(4)}
              {spcStats.usl !== undefined ? ` | USL=${spcStats.usl}` : ''}
              {spcStats.lsl !== undefined ? ` | LSL=${spcStats.lsl}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] font-medium text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-1 bg-emerald-500 rounded-full inline-block" /> Giá trị đo</span>
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 bg-rose-400 inline-block border-t border-dashed border-rose-400" /> UCL/LCL</span>
            {(spcStats.usl !== undefined || spcStats.lsl !== undefined) && (
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-1 bg-amber-400 rounded-full inline-block" /> USL/LSL</span>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={enrichedData} margin={{ top: 10, right: 24, left: 4, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="batchNo" tick={{ fontSize: 10, fill: axisColor }} interval="preserveStartEnd" angle={-25} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: axisColor }} width={58} />
            <Tooltip content={<TrendTooltip unit={selectedCriteria?.unit || ''} />} />
            <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
            {!isNaN(spcStats.ucl) && (
              <ReferenceLine y={spcStats.ucl} stroke="#f87171" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: 'UCL', position: 'insideTopRight', fontSize: 10, fill: '#f87171' }} />
            )}
            {!isNaN(spcStats.mean) && (
              <ReferenceLine y={spcStats.mean} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'X̄', position: 'insideTopRight', fontSize: 10, fill: '#10b981' }} />
            )}
            {!isNaN(spcStats.lcl) && (
              <ReferenceLine y={spcStats.lcl} stroke="#f87171" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: 'LCL', position: 'insideBottomRight', fontSize: 10, fill: '#f87171' }} />
            )}
            {spcStats.usl !== undefined && !isNaN(spcStats.usl) && (
              <ReferenceLine y={spcStats.usl} stroke="#fb923c" strokeWidth={1.5} label={{ value: 'USL', position: 'insideTopLeft', fontSize: 10, fill: '#fb923c' }} />
            )}
            {spcStats.lsl !== undefined && !isNaN(spcStats.lsl) && (
              <ReferenceLine y={spcStats.lsl} stroke="#fb923c" strokeWidth={1.5} label={{ value: 'LSL', position: 'insideBottomLeft', fontSize: 10, fill: '#fb923c' }} />
            )}
            <Line
              type="monotone" dataKey="value" name={selectedCriteriaName}
              stroke="#10b981" strokeWidth={2}
              dot={(props: any) => {
                const d = props.payload;
                const fill = d.isOOS ? '#ef4444' : d.isOOC ? '#f97316' : '#10b981';
                return <circle key={`dot-${d.batchNo}`} cx={props.cx} cy={props.cy} r={d.isOOC || d.isOOS ? 6 : 4} fill={fill} stroke="#fff" strokeWidth={1.5} />;
              }}
              activeDot={{ r: 7 }}
            />
            <Brush dataKey="batchNo" height={22} stroke={isDark ? '#3f3f46' : '#e2e8f0'} travellerWidth={8} fill={isDark ? '#18181b' : '#f8fafc'} />
          </LineChart>
        </ResponsiveContainer>
      </DSCard>

      {/* Out-of-control alert */}
      {spcStats.outOfControl.length > 0 && (
        <DSCard className="p-4 border-l-4 border-l-amber-500 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-2.5">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 shrink-0" />
            <h4 className="font-bold text-ink text-sm">
              {spcStats.outOfControl.length} điểm ngoài giới hạn kiểm soát (3σ)
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {spcStats.outOfControl.map((d: any) => (
              <span key={d.batchNo} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-bold text-amber-700 dark:text-amber-400">
                {d.batchNo} <span className="font-normal opacity-70">({d.value.toFixed(3)})</span>
              </span>
            ))}
          </div>
        </DSCard>
      )}
    </div>
  );
};
