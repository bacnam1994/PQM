import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Brush
} from 'recharts';
import {
  TrendingUp, Activity, BarChart2, AlertTriangle,
  CheckCircle2, XCircle, Info, Download
} from 'lucide-react';
import { PageHeader, DSCard } from '../../components';
import { formatDateStandard } from '../../utils';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { normalizeName } from '../../services/criteriaAliasService';
import * as XLSX from 'xlsx';

// ─── SPC Statistical Helpers ──────────────────────────────────────────────────

const calcMean = (vals: number[]) =>
  vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;

const calcStdDev = (vals: number[], mean: number) => {
  if (vals.length < 2) return 0;
  return Math.sqrt(vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (vals.length - 1));
};

const calcCpk = (mean: number, std: number, usl?: number, lsl?: number) => {
  if (std === 0 || (usl === undefined && lsl === undefined)) return null;
  if (usl !== undefined && lsl !== undefined)
    return Math.min((usl - mean) / (3 * std), (mean - lsl) / (3 * std));
  if (usl !== undefined) return (usl - mean) / (3 * std);
  if (lsl !== undefined) return (mean - lsl) / (3 * std);
  return null;
};

const parseNum = (v: any): number | null => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const s = String(v).trim().replace(/[–—]/g, '-').replace(/,/g, '');
  const m = s.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const CpkBadge: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null) return <span className="text-zinc-400 text-xs italic">Chưa đủ dữ liệu</span>;
  const cls = value >= 1.33
    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
    : value >= 1.0
    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
  const label = value >= 1.33 ? 'GMP chuẩn ≥1.33' : value >= 1.0 ? 'Tối thiểu ≥1.0' : 'Dưới chuẩn <1.0';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-black ${cls}`}>
      {value.toFixed(3)} <span className="font-medium opacity-70">— {label}</span>
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-lg p-3 text-xs space-y-1 max-w-[220px]">
      <p className="font-black text-slate-700 dark:text-zinc-200 text-[11px] border-b border-slate-100 dark:border-zinc-800 pb-1 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-3">
          <span className="text-slate-500 dark:text-zinc-400 truncate">{p.name}</span>
          <span className="font-bold" style={{ color: p.color }}>{typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const TrendAnalysisPage: React.FC = () => {
  const {
    products, batches, tccsList,
    testResultsRealtime, allTestResults,
    fetchAllTestResultsForDashboard, theme
  } = useAppStore(useShallow(s => ({
    products: s.products,
    batches: s.batches,
    tccsList: s.tccsList,
    testResultsRealtime: s.testResults || [],
    allTestResults: s.allTestResults || [],
    fetchAllTestResultsForDashboard: s.fetchAllTestResultsForDashboard,
    theme: s.theme
  })));

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCriteriaName, setSelectedCriteriaName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => { setLoading(true); await fetchAllTestResultsForDashboard(); setLoading(false); };
    load();
  }, []);

  const testResults = useMemo(() => {
    const map = new Map<string, any>();
    allTestResults.forEach((r: any) => map.set(r.id, r));
    testResultsRealtime.forEach((r: any) => map.set(r.id, r));
    return Array.from(map.values());
  }, [allTestResults, testResultsRealtime]);

  const activeProducts = useMemo(() => products.filter(p => p.status === 'ACTIVE'), [products]);

  const activeTccs = useMemo(() => {
    if (!selectedProductId) return undefined;
    const pTccs = tccsList.filter(t => t.productId === selectedProductId);
    return pTccs.find(t => t.isActive) || [...pTccs].sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0];
  }, [selectedProductId, tccsList]);

  const criteriaList = useMemo(() => activeTccs?.mainQualityCriteria || [], [activeTccs]);

  useEffect(() => {
    if (criteriaList.length > 0 && !selectedCriteriaName) setSelectedCriteriaName(criteriaList[0].name);
  }, [criteriaList]);

  const selectedCriteria = useMemo(() =>
    criteriaList.find((c: any) => c.name === selectedCriteriaName), [criteriaList, selectedCriteriaName]);

  const resolver = useCriteriaResolver(activeTccs);

  const chartData = useMemo(() => {
    if (!selectedProductId || !selectedCriteriaName) return [];
    const filteredBatches = batches
      .filter(b => {
        if (b.productId !== selectedProductId) return false;
        if (dateFrom && b.mfgDate && b.mfgDate < dateFrom) return false;
        if (dateTo && b.mfgDate && b.mfgDate > dateTo) return false;
        return true;
      })
      .sort((a, b) => (a.mfgDate || '').localeCompare(b.mfgDate || ''));

    return filteredBatches
      .map(batch => {
        const batchResults = testResults.filter((r: any) => r.batchId === batch.id);
        const map = new Map<string, any>();
        [...batchResults].sort((a: any, b: any) => a.testDate.localeCompare(b.testDate)).forEach((r: any) => {
          (r.results || []).forEach((entry: any) => {
            if (entry?.criteriaName) {
              const canonicalKey = normalizeName(resolver.resolve(entry.criteriaName));
              map.set(canonicalKey, entry);
              map.set(normalizeName(entry.criteriaName), entry);
            }
          });
        });
        const targetKey = normalizeName(selectedCriteriaName);
        const entry = map.get(targetKey);
        const value = entry ? parseNum(entry.value) : null;
        return value !== null ? { batchNo: batch.batchNo, mfgDate: batch.mfgDate, value } : null;
      })
      .filter(Boolean) as { batchNo: string; mfgDate: string; value: number }[];
  }, [selectedProductId, selectedCriteriaName, batches, testResults, dateFrom, dateTo, resolver]);

  const spcStats = useMemo(() => {
    const vals = chartData.map(d => d.value);
    if (vals.length < 2) return null;
    const mean = calcMean(vals);
    const std = calcStdDev(vals, mean);
    const ucl = mean + 3 * std;
    const lcl = mean - 3 * std;
    const usl = selectedCriteria ? parseNum((selectedCriteria as any).upperLimit) ?? undefined : undefined;
    const lsl = selectedCriteria ? parseNum((selectedCriteria as any).lowerLimit) ?? undefined : undefined;
    const cpk = calcCpk(mean, std, usl, lsl);
    const outOfControl = chartData.filter(d => d.value > ucl || d.value < lcl);
    const outOfSpec = chartData.filter(d =>
      (usl !== undefined && d.value > usl) || (lsl !== undefined && d.value < lsl));
    return { mean, std, ucl, lcl, usl, lsl, cpk, outOfControl, outOfSpec, cv: std / mean * 100 };
  }, [chartData, selectedCriteria]);

  const enrichedData = useMemo(() =>
    chartData.map((d, i) => ({
      ...d,
      isOOC: spcStats ? (d.value > spcStats.ucl || d.value < spcStats.lcl) : false,
      isOOS: spcStats ? (
        (spcStats.usl !== undefined && d.value > spcStats.usl) ||
        (spcStats.lsl !== undefined && d.value < spcStats.lsl)) : false,
      index: i + 1,
    })), [chartData, spcStats]);

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#27272a' : '#f1f5f9';
  const axisColor = isDark ? '#71717a' : '#94a3b8';

  const handleExport = () => {
    if (!chartData.length) return;
    const product = products.find(p => p.id === selectedProductId);
    const rows = enrichedData.map(d => ({
      'STT': d.index, 'Số lô': d.batchNo, 'Ngày SX': d.mfgDate,
      'Chỉ tiêu': selectedCriteriaName, 'Giá trị': d.value,
      'UCL': spcStats?.ucl.toFixed(4), 'LCL': spcStats?.lcl.toFixed(4),
      'Trung bình': spcStats?.mean.toFixed(4),
      'Ngoài kiểm soát': d.isOOC ? 'Có' : 'Không',
      'Ngoài tiêu chuẩn': d.isOOS ? 'Có' : 'Không',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SPC');
    XLSX.writeFile(wb, `SPC_${product?.code || ''}_${selectedCriteriaName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phân tích xu hướng chất lượng"
        subtitle="Statistical Process Control (SPC) — Biểu đồ kiểm soát quá trình sản xuất"
        icon={<Activity className="text-indigo-500" size={24} />}
        action={
          chartData.length > 0 ? (
            <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Download size={15} /> Xuất Excel
            </button>
          ) : undefined
        }
      />

      {/* Filter bar */}
      <DSCard className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Sản phẩm', content: (
                <select value={selectedProductId}
                  onChange={e => { setSelectedProductId(e.target.value); setSelectedCriteriaName(''); }}
                  className="w-full border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">-- Chọn sản phẩm --</option>
                  {activeProducts.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              )
            },
            {
              label: 'Chỉ tiêu', content: (
                <select value={selectedCriteriaName} onChange={e => setSelectedCriteriaName(e.target.value)}
                  disabled={!criteriaList.length}
                  className="w-full border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50">
                  <option value="">-- Chọn chỉ tiêu --</option>
                  {criteriaList.map((c: any) => <option key={c.name} value={c.name}>{c.name}{c.unit ? ` (${c.unit})` : ''}</option>)}
                </select>
              )
            },
            {
              label: 'Từ ngày SX', content: (
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              )
            },
            {
              label: 'Đến ngày SX', content: (
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              )
            },
          ].map(({ label, content }) => (
            <div key={label}>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 block">{label}</label>
              {content}
            </div>
          ))}
        </div>
      </DSCard>

      {/* States */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}
      {!loading && !selectedProductId && (
        <DSCard className="p-12 text-center">
          <BarChart2 size={48} className="text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-zinc-400 font-medium">Chọn sản phẩm và chỉ tiêu để hiển thị biểu đồ SPC</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Hệ thống sẽ tự động tính UCL, LCL, Cpk và phát hiện điểm bất thường</p>
        </DSCard>
      )}
      {!loading && selectedProductId && selectedCriteriaName && chartData.length === 0 && (
        <DSCard className="p-12 text-center">
          <Info size={40} className="text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-zinc-400 font-medium">Chưa có dữ liệu số cho chỉ tiêu này</p>
        </DSCard>
      )}

      {!loading && chartData.length >= 2 && spcStats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Số lô phân tích', value: <span className="text-2xl font-black text-slate-800 dark:text-zinc-100">{chartData.length}</span> },
              { label: 'Trung bình (X̄)', value: <><span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{spcStats.mean.toFixed(3)}</span><p className="text-[11px] text-slate-400 mt-0.5">σ={spcStats.std.toFixed(3)} | CV={spcStats.cv.toFixed(1)}%</p></> },
              { label: 'Năng lực quá trình', value: <div className="mt-1"><CpkBadge value={spcStats.cpk} /></div> },
              { label: 'Ngoài kiểm soát', value: <><span className={`text-2xl font-black ${spcStats.outOfControl.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{spcStats.outOfControl.length}</span><p className="text-[11px] text-slate-400 mt-0.5">{spcStats.outOfSpec.length > 0 ? `${spcStats.outOfSpec.length} ngoài tiêu chuẩn` : 'Không lô nào ngoài spec'}</p></> },
            ].map(({ label, value }) => (
              <DSCard key={label} className="p-4">
                <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                {value}
              </DSCard>
            ))}
          </div>

          {/* SPC Chart */}
          <DSCard className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-black text-slate-800 dark:text-zinc-100 text-base">
                  Biểu đồ kiểm soát — <span className="text-indigo-600 dark:text-indigo-400">{selectedCriteriaName}</span>
                </h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 font-mono">
                  UCL={spcStats.ucl.toFixed(4)} | X̄={spcStats.mean.toFixed(4)} | LCL={spcStats.lcl.toFixed(4)}
                  {spcStats.usl !== undefined ? ` | USL=${spcStats.usl}` : ''}
                  {spcStats.lsl !== undefined ? ` | LSL=${spcStats.lsl}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-indigo-500 inline-block" /> Giá trị đo</span>
                <span className="flex items-center gap-1"><span className="w-4 h-px bg-red-400 inline-block border-t border-dashed border-red-400" /> UCL/LCL</span>
                {(spcStats.usl !== undefined || spcStats.lsl !== undefined) && (
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-orange-400 inline-block" /> USL/LSL</span>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={enrichedData} margin={{ top: 10, right: 24, left: 4, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="batchNo" tick={{ fontSize: 10, fill: axisColor }} interval="preserveStartEnd" angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: axisColor }} width={58} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={spcStats.ucl} stroke="#f87171" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: 'UCL', position: 'insideTopRight', fontSize: 10, fill: '#f87171' }} />
                <ReferenceLine y={spcStats.mean} stroke="#818cf8" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'X̄', position: 'insideTopRight', fontSize: 10, fill: '#818cf8' }} />
                <ReferenceLine y={spcStats.lcl} stroke="#f87171" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: 'LCL', position: 'insideBottomRight', fontSize: 10, fill: '#f87171' }} />
                {spcStats.usl !== undefined && <ReferenceLine y={spcStats.usl} stroke="#fb923c" strokeWidth={1.5} label={{ value: 'USL', position: 'insideTopLeft', fontSize: 10, fill: '#fb923c' }} />}
                {spcStats.lsl !== undefined && <ReferenceLine y={spcStats.lsl} stroke="#fb923c" strokeWidth={1.5} label={{ value: 'LSL', position: 'insideBottomLeft', fontSize: 10, fill: '#fb923c' }} />}
                <Line
                  type="monotone" dataKey="value" name={selectedCriteriaName}
                  stroke="#6366f1" strokeWidth={2}
                  dot={(props: any) => {
                    const d = props.payload;
                    const fill = d.isOOS ? '#ef4444' : d.isOOC ? '#f97316' : '#6366f1';
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
            <DSCard className="p-4 border-l-4 border-orange-400">
              <div className="flex items-center gap-2 mb-2.5">
                <AlertTriangle size={18} className="text-orange-500 flex-shrink-0" />
                <h4 className="font-black text-slate-800 dark:text-zinc-100 text-sm">
                  {spcStats.outOfControl.length} điểm ngoài giới hạn kiểm soát (3σ)
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {spcStats.outOfControl.map(d => (
                  <span key={d.batchNo} className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full text-xs font-bold text-orange-700 dark:text-orange-400">
                    {d.batchNo} <span className="font-normal opacity-70">({d.value.toFixed(3)})</span>
                  </span>
                ))}
              </div>
            </DSCard>
          )}

          {/* Data table */}
          <DSCard className="overflow-hidden p-0">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800">
              <h4 className="font-black text-slate-700 dark:text-zinc-200 text-sm">Dữ liệu chi tiết ({chartData.length} lô)</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-900/50">
                    {['#', 'Số lô', 'Ngày SX', 'Giá trị đo', 'Trạng thái SPC'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 dark:text-zinc-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-zinc-900">
                  {enrichedData.map(d => (
                    <tr key={d.batchNo}
                      className={`hover:bg-slate-50 dark:hover:bg-zinc-900/30 transition-colors ${d.isOOS ? 'bg-red-50/60 dark:bg-red-900/10' : d.isOOC ? 'bg-orange-50/60 dark:bg-orange-900/10' : ''}`}>
                      <td className="px-4 py-2 text-slate-400 dark:text-zinc-600">{d.index}</td>
                      <td className="px-4 py-2 font-bold text-slate-700 dark:text-zinc-200">{d.batchNo}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-zinc-400">{d.mfgDate ? formatDateStandard(d.mfgDate) : '---'}</td>
                      <td className="px-4 py-2 font-mono font-bold text-slate-800 dark:text-zinc-100">{d.value.toFixed(4)}</td>
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
        </>
      )}

      {!loading && chartData.length === 1 && (
        <DSCard className="p-6 text-center">
          <Info size={36} className="text-amber-400 mx-auto mb-2" />
          <p className="text-slate-600 dark:text-zinc-300 font-medium">Cần ít nhất 2 điểm dữ liệu để tính toán SPC</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Hiện có 1 lô: <strong>{chartData[0].batchNo}</strong> = {chartData[0].value}</p>
        </DSCard>
      )}
    </div>
  );
};

export default TrendAnalysisPage;
