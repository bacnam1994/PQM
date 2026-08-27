import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Brush
} from 'recharts';
import {
  TrendingUp, Activity, BarChart2, AlertTriangle,
  CheckCircle2, XCircle, Info, Download, Sparkles, Clock, Loader2,
  Search, X, ChevronDown, ChevronUp, Filter, Check, Calendar,
  Package, RefreshCw, CheckCircle, Tag, Layers, ArrowRight
} from 'lucide-react';
import { PageHeader, DSCard } from '../../components';
import { formatDateStandard, parseNumberFromText, resolveDeclaredBasis } from '../../utils';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { normalizeName } from '../../services/criteriaAliasService';
import { isCriteriaMatch } from '../../utils/aiMapping';
import { predictProductStability, generateStabilityForecastWithAI } from '../../services/ai/stabilityPredictionService';
import * as XLSX from 'xlsx';

// ─── Vietnamese Accent Removal & Search Helper ────────────────────────────────

const removeVietnameseTones = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

const highlightMatch = (text: string, query: string) => {
  if (!query.trim()) return text;
  const q = query.trim().toLowerCase();
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(q);
  if (idx === -1) {
    // Thử tìm theo phiên bản bỏ dấu
    const normalizedText = removeVietnameseTones(text);
    const normalizedQuery = removeVietnameseTones(query);
    const normIdx = normalizedText.indexOf(normalizedQuery);
    if (normIdx === -1) return text;
    return (
      <>
        {text.substring(0, normIdx)}
        <mark className="bg-amber-200 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100 px-0.5 rounded font-bold">
          {text.substring(normIdx, normIdx + query.length)}
        </mark>
        {text.substring(normIdx + query.length)}
      </>
    );
  }
  return (
    <>
      {text.substring(0, idx)}
      <mark className="bg-amber-200 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100 px-0.5 rounded font-bold">
        {text.substring(idx, idx + q.length)}
      </mark>
      {text.substring(idx + q.length)}
    </>
  );
};

// ─── SPC Statistical Helpers ──────────────────────────────────────────────────

const calcMean = (vals: number[]) => {
  const valid = vals.filter(v => typeof v === 'number' && !isNaN(v));
  return valid.length === 0 ? 0 : valid.reduce((a, b) => a + b, 0) / valid.length;
};

const calcStdDev = (vals: number[], mean: number) => {
  const valid = vals.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length < 2) return 0;
  return Math.sqrt(valid.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (valid.length - 1));
};

const calcCpk = (mean: number, std: number, usl?: number, lsl?: number) => {
  if (std === 0 || isNaN(std) || isNaN(mean) || (usl === undefined && lsl === undefined)) return null;
  const validUsl = usl !== undefined && !isNaN(usl) ? usl : undefined;
  const validLsl = lsl !== undefined && !isNaN(lsl) ? lsl : undefined;
  if (validUsl === undefined && validLsl === undefined) return null;
  if (validUsl !== undefined && validLsl !== undefined)
    return Math.min((validUsl - mean) / (3 * std), (mean - validLsl) / (3 * std));
  if (validUsl !== undefined) return (validUsl - mean) / (3 * std);
  if (validLsl !== undefined) return (mean - validLsl) / (3 * std);
  return null;
};

const parseCriterionBound = (val: any): number | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  const num = typeof val === 'string' ? parseNumberFromText(val) : Number(val);
  return isNaN(num) ? undefined : num;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const CpkBadge: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null || value === undefined || isNaN(value)) return <span className="text-zinc-400 text-xs italic">Chưa đủ dữ liệu</span>;
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

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-lg p-3 text-xs space-y-1.5 max-w-[240px]">
      <p className="font-black text-slate-700 dark:text-zinc-200 text-[11px] border-b border-slate-100 dark:border-zinc-800 pb-1 mb-1">{label}</p>
      {payload.map((p: any) => {
        const pct = p.payload?.percent;
        return (
          <div key={p.dataKey} className="space-y-0.5">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500 dark:text-zinc-400 truncate">{p.name}</span>
              <span className="font-bold" style={{ color: p.color }}>
                {typeof p.value === 'number' && !isNaN(p.value) ? p.value.toFixed(4) : p.value} {unit}
              </span>
            </div>
            {pct !== null && pct !== undefined && !isNaN(pct) && (
              <div className="flex justify-between gap-3 text-[11px]">
                <span className="text-slate-400">% so với công bố:</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono">{pct.toFixed(1)}%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const TrendAnalysisPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    products, batches, tccsList, productFormulas,
    testResultsRealtime, allTestResults,
    fetchAllTestResultsForDashboard, theme
  } = useAppStore(useShallow(s => ({
    products: s.products,
    batches: s.batches,
    tccsList: s.tccsList,
    productFormulas: s.productFormulas || [],
    testResultsRealtime: s.testResults || [],
    allTestResults: s.allTestResults || [],
    fetchAllTestResultsForDashboard: s.fetchAllTestResultsForDashboard,
    theme: s.theme
  })));

  // State selection
  const [selectedProductId, setSelectedProductId] = useState<string>(() => searchParams.get('productId') || '');
  const [selectedCriteriaName, setSelectedCriteriaName] = useState<string>(() => searchParams.get('criteria') || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeDatePreset, setActiveDatePreset] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Search & Filter state for Product Dropdown
  const [productSearch, setProductSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [onlyWithData, setOnlyWithData] = useState<boolean>(false);
  const [criteriaSearch, setCriteriaSearch] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        if (fetchAllTestResultsForDashboard) {
          await fetchAllTestResultsForDashboard();
        }
      } catch (err) {
        console.error('Error fetching data for trend analysis:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [fetchAllTestResultsForDashboard]);

  // Click outside listener for product dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync state to URL search params
  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (selectedProductId) {
      nextParams.set('productId', selectedProductId);
    } else {
      nextParams.delete('productId');
    }
    if (selectedCriteriaName) {
      nextParams.set('criteria', selectedCriteriaName);
    } else {
      nextParams.delete('criteria');
    }
    setSearchParams(nextParams, { replace: true });
  }, [selectedProductId, selectedCriteriaName]);

  const testResults = useMemo(() => {
    const map = new Map<string, any>();
    allTestResults.forEach((r: any) => map.set(r.id, r));
    testResultsRealtime.forEach((r: any) => map.set(r.id, r));
    return Array.from(map.values());
  }, [allTestResults, testResultsRealtime]);

  const activeProducts = useMemo(() => products.filter(p => p.status === 'ACTIVE'), [products]);

  // Compute batches and test results count per product
  const productStats = useMemo(() => {
    const stats = new Map<string, { batchCount: number; resultCount: number; lastMfgDate?: string }>();
    batches.forEach(b => {
      if (!b.productId) return;
      const cur = stats.get(b.productId) || { batchCount: 0, resultCount: 0 };
      cur.batchCount += 1;
      if (b.mfgDate && (!cur.lastMfgDate || b.mfgDate > cur.lastMfgDate)) {
        cur.lastMfgDate = b.mfgDate;
      }
      stats.set(b.productId, cur);
    });

    testResults.forEach((r: any) => {
      if (!r.batchId) return;
      const b = batches.find(batch => batch.id === r.batchId);
      if (b?.productId) {
        const cur = stats.get(b.productId) || { batchCount: 0, resultCount: 0 };
        cur.resultCount += 1;
        stats.set(b.productId, cur);
      }
    });

    return stats;
  }, [batches, testResults]);

  // Distinct product groups
  const productGroups = useMemo(() => {
    const groups = new Set<string>();
    activeProducts.forEach(p => {
      if (p.group && p.group.trim()) groups.add(p.group.trim());
    });
    return Array.from(groups).sort();
  }, [activeProducts]);

  // Top products with the most test data (Quick Picks)
  const topProductsWithData = useMemo(() => {
    return [...activeProducts]
      .map(p => ({
        product: p,
        stats: productStats.get(p.id) || { batchCount: 0, resultCount: 0 }
      }))
      .filter(item => item.stats.batchCount > 0)
      .sort((a, b) => b.stats.batchCount - a.stats.batchCount)
      .slice(0, 5);
  }, [activeProducts, productStats]);

  // Filtered products for dropdown
  const filteredProducts = useMemo(() => {
    return activeProducts.filter(p => {
      const pStat = productStats.get(p.id) || { batchCount: 0, resultCount: 0 };

      // Filter by onlyWithData toggle
      if (onlyWithData && pStat.batchCount === 0) return false;

      // Filter by group
      if (selectedGroupFilter !== 'ALL' && p.group !== selectedGroupFilter) return false;

      // Filter by search query
      if (productSearch.trim()) {
        const queryNorm = removeVietnameseTones(productSearch.trim());
        const nameNorm = removeVietnameseTones(p.name || '');
        const codeNorm = removeVietnameseTones(p.code || '');
        const regNorm = removeVietnameseTones(p.registrationNo || '');
        const groupNorm = removeVietnameseTones(p.group || '');

        const matches =
          nameNorm.includes(queryNorm) ||
          codeNorm.includes(queryNorm) ||
          regNorm.includes(queryNorm) ||
          groupNorm.includes(queryNorm);

        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      // Prioritize products with batches
      const statA = productStats.get(a.id)?.batchCount || 0;
      const statB = productStats.get(b.id)?.batchCount || 0;
      if (statA !== statB) return statB - statA;
      return (a.code || '').localeCompare(b.code || '');
    });
  }, [activeProducts, productStats, onlyWithData, selectedGroupFilter, productSearch]);

  const selectedProduct = useMemo(() =>
    products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const activeTccs = useMemo(() => {
    if (!selectedProductId) return undefined;
    const pTccs = tccsList.filter(t => t.productId === selectedProductId);
    return pTccs.find(t => t.isActive) || [...pTccs].sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0];
  }, [selectedProductId, tccsList]);

  const activeFormula = useMemo(() => {
    if (!selectedProductId) return undefined;
    return productFormulas.find(f => f.productId === selectedProductId);
  }, [selectedProductId, productFormulas]);

  const criteriaList = useMemo(() => activeTccs?.mainQualityCriteria || [], [activeTccs]);

  const filteredCriteriaList = useMemo(() => {
    if (!criteriaSearch.trim()) return criteriaList;
    const q = removeVietnameseTones(criteriaSearch.trim());
    return criteriaList.filter((c: any) =>
      removeVietnameseTones(c.name || '').includes(q) ||
      removeVietnameseTones(c.unit || '').includes(q)
    );
  }, [criteriaList, criteriaSearch]);

  // Set default criteria when product changes
  useEffect(() => {
    if (criteriaList.length > 0) {
      if (!selectedCriteriaName || !criteriaList.some((c: any) => c.name === selectedCriteriaName)) {
        setSelectedCriteriaName(criteriaList[0].name);
      }
    } else {
      setSelectedCriteriaName('');
    }
  }, [criteriaList, selectedProductId]);

  const selectedCriteria = useMemo(() =>
    criteriaList.find((c: any) => c.name === selectedCriteriaName),
    [criteriaList, selectedCriteriaName]
  );

  // State lựa chọn cơ sở tính % (Tự động / Nguyên tố / Muối)
  const [manualBasisChoice, setManualBasisChoice] = useState<'AUTO' | 'ELEMENTAL' | 'DECLARED'>('AUTO');

  // Reset lựa chọn cơ sở tính % khi đổi chỉ tiêu hoặc sản phẩm
  useEffect(() => {
    setManualBasisChoice('AUTO');
  }, [selectedProductId, selectedCriteriaName]);

  const resolver = useCriteriaResolver(activeTccs);

  // Xác định hàm lượng công bố / chuẩn cơ sở cho chỉ tiêu được chọn (Hỗ trợ chuẩn Nguyên tố vs Muối)
  const basisInfo = useMemo(() => {
    return resolveDeclaredBasis(selectedCriteria, activeFormula, resolver, manualBasisChoice);
  }, [selectedCriteria, activeFormula, resolver, manualBasisChoice]);

  const declaredBasis = basisInfo.basis;

  const [aiStabilitySummary, setAiStabilitySummary] = useState<string | null>(null);
  const [isGeneratingAiStability, setIsGeneratingAiStability] = useState(false);

  const stabilityReport = useMemo(() => {
    if (!selectedProduct) return null;
    return predictProductStability(selectedProduct, batches, testResults, activeTccs, 24);
  }, [selectedProduct, batches, testResults, activeTccs]);

  const handleEnrichStabilityWithAI = async () => {
    if (!stabilityReport) return;
    setIsGeneratingAiStability(true);
    try {
      const enriched = await generateStabilityForecastWithAI(stabilityReport);
      setAiStabilitySummary(enriched.executiveSummary);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAiStability(false);
    }
  };

  // Date Presets Handler
  const handleApplyDatePreset = (preset: 'ALL' | '3M' | '6M' | '1Y' | 'YEAR') => {
    setActiveDatePreset(preset);
    const now = new Date();
    const toStr = now.toISOString().split('T')[0];

    if (preset === 'ALL') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === '3M') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(toStr);
    } else if (preset === '6M') {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(toStr);
    } else if (preset === '1Y') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(toStr);
    } else if (preset === 'YEAR') {
      const firstDay = `${now.getFullYear()}-01-01`;
      setDateFrom(firstDay);
      setDateTo(toStr);
    }
  };

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
              map.set(entry.criteriaName.trim().toLowerCase(), entry);
            }
          });
        });
        const targetKey = normalizeName(selectedCriteriaName);
        let entry = map.get(targetKey) || map.get(selectedCriteriaName.trim().toLowerCase());
        if (!entry) {
          for (const [, e] of map.entries()) {
            if (e?.criteriaName && (resolver.isMatch(e.criteriaName, selectedCriteriaName) || isCriteriaMatch(e.criteriaName, selectedCriteriaName))) {
              entry = e;
              break;
            }
          }
        }
        const val = entry?.value !== undefined && entry?.value !== null ? parseNumberFromText(entry.value) : NaN;
        const value = isNaN(val) ? null : val;
        const percent = (value !== null && declaredBasis && declaredBasis > 0)
          ? (value / declaredBasis) * 100
          : null;
        return value !== null ? { batchNo: batch.batchNo, mfgDate: batch.mfgDate, value, percent } : null;
      })
      .filter(Boolean) as { batchNo: string; mfgDate: string; value: number; percent: number | null }[];
  }, [selectedProductId, selectedCriteriaName, batches, testResults, dateFrom, dateTo, resolver, declaredBasis]);

  const spcStats = useMemo(() => {
    const vals = chartData.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v));
    if (vals.length < 2) return null;
    const mean = calcMean(vals);
    const std = calcStdDev(vals, mean);
    if (isNaN(mean) || isNaN(std)) return null;
    const ucl = mean + 3 * std;
    const lcl = mean - 3 * std;
    const rawUsl = selectedCriteria?.max !== undefined
      ? parseCriterionBound(selectedCriteria.max)
      : (selectedCriteria ? parseCriterionBound((selectedCriteria as any).upperLimit) : undefined);
    const rawLsl = selectedCriteria?.min !== undefined
      ? parseCriterionBound(selectedCriteria.min)
      : (selectedCriteria ? parseCriterionBound((selectedCriteria as any).lowerLimit) : undefined);
    const usl = (rawUsl === 0 && rawLsl === 0) ? undefined : rawUsl;
    const lsl = (rawUsl === 0 && rawLsl === 0) ? undefined : rawLsl;
    const cpk = calcCpk(mean, std, usl, lsl);
    const outOfControl = chartData.filter(d => d.value > ucl || d.value < lcl);
    const outOfSpec = chartData.filter(d =>
      (usl !== undefined && d.value > usl) || (lsl !== undefined && d.value < lsl));
    const meanPercent = (declaredBasis && declaredBasis > 0 && !isNaN(declaredBasis)) ? (mean / declaredBasis) * 100 : null;
    const cv = (mean !== 0 && !isNaN(mean) && !isNaN(std)) ? (std / mean) * 100 : 0;
    return { mean, std, ucl, lcl, usl, lsl, cpk, outOfControl, outOfSpec, cv, meanPercent, declaredBasis };
  }, [chartData, selectedCriteria, declaredBasis]);

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
      'Đơn vị': selectedCriteria?.unit || '',
      'Tỉ lệ % công bố': d.percent !== null ? `${d.percent.toFixed(1)}%` : '---',
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

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedCriteriaName('');
    setIsDropdownOpen(false);
    setProductSearch('');
  };

  const handleClearProduct = () => {
    setSelectedProductId('');
    setSelectedCriteriaName('');
    setProductSearch('');
    setIsDropdownOpen(false);
  };

  const selectedProductStat = selectedProductId ? productStats.get(selectedProductId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phân tích xu hướng chất lượng"
        subtitle="Statistical Process Control (SPC) — Biểu đồ kiểm soát quá trình sản xuất"
        icon={Activity}
        action={
          chartData.length > 0 ? (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-[11px] tracking-wider transition-all shadow-md shadow-emerald-500/20"
            >
              <Download size={15} /> Xuất Excel
            </button>
          ) : undefined
        }
      />

      {/* ─── SMART PRODUCT SELECTOR & FILTER PANEL ──────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-sm p-4 md:p-5 space-y-4">
        
        {/* Selected Product Card Banner */}
        {selectedProduct ? (
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/90 via-slate-50 to-purple-50/50 dark:from-indigo-950/30 dark:via-zinc-900/60 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-3.5">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-xl shadow-md flex-shrink-0">
                <Package size={22} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white shadow-sm">
                    {selectedProduct.code}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    {selectedProduct.name}
                  </h3>
                  {selectedProduct.group && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {selectedProduct.group}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                  {selectedProduct.registrationNo && (
                    <span>SĐK: <strong className="text-slate-700 dark:text-zinc-200">{selectedProduct.registrationNo}</strong></span>
                  )}
                  <span>Tiêu chuẩn: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{activeTccs ? activeTccs.code : 'Chưa có TCCS'}</strong></span>
                  <span>Tổng dữ liệu: <strong className="text-slate-700 dark:text-zinc-200">{selectedProductStat?.batchCount || 0} lô sản xuất</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <Search size={14} /> Thay đổi sản phẩm
              </button>
              <button
                type="button"
                onClick={handleClearProduct}
                className="p-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 rounded-xl transition-all"
                title="Bỏ chọn sản phẩm"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Search & Combobox Container */}
        <div ref={dropdownRef} className="relative">
          {!selectedProduct && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <Search size={14} className="text-indigo-500" /> Chọn sản phẩm cần phân tích xu hướng SPC
              </label>

              <div
                onClick={() => {
                  setIsDropdownOpen(true);
                  searchInputRef.current?.focus();
                }}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all cursor-text ${
                  isDropdownOpen
                    ? 'bg-white dark:bg-zinc-950 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                    : 'bg-slate-50/80 dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <Search size={17} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Gõ mã sản phẩm, tên sản phẩm, số đăng ký hoặc nhóm để tìm nhanh..."
                  className="w-full bg-transparent border-none outline-none text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-medium"
                />
                {productSearch ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProductSearch('');
                      searchInputRef.current?.focus();
                    }}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-full transition-colors"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`}
                  />
                )}
              </div>
            </div>
          )}

          {/* Autocomplete Dropdown Popover */}
          {isDropdownOpen && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              {/* Header Filters inside Dropdown */}
              <div className="p-3 bg-slate-50/90 dark:bg-zinc-900/90 border-b border-slate-100 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                    <Filter size={12} /> Bộ lọc nhanh danh mục
                  </span>

                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyWithData}
                      onChange={e => setOnlyWithData(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span>Chỉ hiện SP có dữ liệu kiểm nghiệm</span>
                  </label>
                </div>

                {/* Group Chips Filter */}
                {productGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedGroupFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedGroupFilter === 'ALL'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                      }`}
                    >
                      Tất cả ({activeProducts.length})
                    </button>
                    {productGroups.map(grp => {
                      const count = activeProducts.filter(p => p.group === grp).length;
                      return (
                        <button
                          key={grp}
                          type="button"
                          onClick={() => setSelectedGroupFilter(grp)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            selectedGroupFilter === grp
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                          }`}
                        >
                          {grp} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Product List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-900">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <Package size={32} className="text-slate-300 dark:text-zinc-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">Không tìm thấy sản phẩm phù hợp</p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">Thử xóa từ khóa tìm kiếm hoặc bỏ chọn lọc dữ liệu</p>
                  </div>
                ) : (
                  filteredProducts.map(p => {
                    const isSelected = selectedProductId === p.id;
                    const pStat = productStats.get(p.id) || { batchCount: 0, resultCount: 0 };
                    const hasData = pStat.batchCount > 0;

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p.id)}
                        className={`p-3 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                          isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                              {highlightMatch(p.code, productSearch)}
                            </span>
                            <span className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">
                              {highlightMatch(p.name, productSearch)}
                            </span>
                            {p.group && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 shrink-0">
                                {p.group}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-zinc-500">
                            {p.registrationNo && <span>SĐK: {p.registrationNo}</span>}
                            {pStat.lastMfgDate && <span>Lô gần nhất: {formatDateStandard(pStat.lastMfgDate)}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {hasData ? (
                            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                              {pStat.batchCount} lô ({pStat.resultCount} KQ)
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500">
                              Chưa có lô
                            </span>
                          )}
                          {isSelected && <Check size={16} className="text-indigo-600 dark:text-indigo-400" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer info */}
              <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-[11px] text-slate-400 dark:text-zinc-500">
                <span>Hiển thị {filteredProducts.length} / {activeProducts.length} sản phẩm</span>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(false)}
                  className="hover:text-slate-700 dark:hover:text-zinc-200 font-bold"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Picks for products with most data when nothing is selected */}
        {!selectedProduct && topProductsWithData.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/60 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-500" /> Sản phẩm có nhiều dữ liệu kiểm nghiệm nhất (Chọn nhanh):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {topProductsWithData.map(({ product: p, stats }) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProduct(p.id)}
                  className="p-2.5 text-left rounded-xl border border-slate-200/90 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 hover:bg-indigo-50/40 dark:bg-zinc-900/40 dark:hover:bg-indigo-950/20 transition-all group space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                      {p.code}
                    </span>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                      {stats.batchCount} lô
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-1">
                    {p.name}
                  </p>
                  {p.group && (
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                      {p.group}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── CRITERIA & DATE FILTERS BAR ────────────────────────────────────── */}
        {selectedProduct && (
          <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
            
            {/* Criteria Selection Header & Chips */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                  <Activity size={14} className="text-indigo-500" /> Chỉ tiêu chất lượng phân tích:
                </label>

                {criteriaList.length > 5 && (
                  <div className="relative w-44">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={criteriaSearch}
                      onChange={e => setCriteriaSearch(e.target.value)}
                      placeholder="Tìm chỉ tiêu..."
                      className="w-full pl-7 pr-2 py-1 text-xs bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {criteriaList.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle size={15} /> Sản phẩm này chưa được thiết lập chỉ tiêu chất lượng trong Tiêu chuẩn cơ sở (TCCS).
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredCriteriaList.map((c: any) => {
                    const isSelected = selectedCriteriaName === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedCriteriaName(c.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800'
                        }`}
                      >
                        {isSelected && <Check size={13} className="stroke-[3]" />}
                        <span>{c.name}</span>
                        {c.unit && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                            isSelected ? 'bg-indigo-700/80 text-indigo-100' : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                          }`}>
                            {c.unit}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected Criteria Summary Bar */}
              {selectedCriteria && (
                <div className="p-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-zinc-900/80 dark:to-indigo-950/20 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="font-bold text-slate-700 dark:text-zinc-200">
                      Chỉ tiêu: <strong className="text-indigo-600 dark:text-indigo-400">{selectedCriteria.name}</strong>
                    </span>
                    {selectedCriteria.unit && (
                      <span className="text-slate-500 dark:text-zinc-400">Đơn vị: <strong>{selectedCriteria.unit}</strong></span>
                    )}
                    {(selectedCriteria.min !== undefined || selectedCriteria.max !== undefined) && (
                      <span className="text-slate-500 dark:text-zinc-400">
                        Giới hạn TCCS: <strong className="font-mono text-slate-700 dark:text-zinc-300">{selectedCriteria.min ?? 0} – {selectedCriteria.max ?? '∞'} {selectedCriteria.unit}</strong>
                      </span>
                    )}
                    {declaredBasis && declaredBasis > 0 ? (
                      <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                        Chuẩn tính %: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-black">{declaredBasis} {selectedCriteria.unit}</strong>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          basisInfo.basisType === 'ELEMENTAL'
                            ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : basisInfo.basisType === 'DECLARED'
                            ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                        }`}>
                          {basisInfo.basisType === 'ELEMENTAL' ? '⚡ Thang Nguyên tố' : basisInfo.basisType === 'DECLARED' ? '🧂 Thang Muối' : 'TCCS'}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  {/* Basis Switcher Toggle when both elemental and salt contents exist */}
                  {basisInfo.isElementalCandidate && basisInfo.elementalContent && basisInfo.saltContent && (
                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-950 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1.5">Gốc tính:</span>
                      <button
                        type="button"
                        onClick={() => setManualBasisChoice('ELEMENTAL')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          basisInfo.basisType === 'ELEMENTAL'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title={`Tính % theo Nguyên tố (${basisInfo.elementalContent} ${selectedCriteria.unit})`}
                      >
                        ⚡ Nguyên tố ({basisInfo.elementalContent})
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualBasisChoice('DECLARED')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          basisInfo.basisType === 'DECLARED'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title={`Tính % theo Muối/Hợp chất (${basisInfo.saltContent} ${selectedCriteria.unit})`}
                      >
                        🧂 Muối ({basisInfo.saltContent})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date Filters & Presets */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1 mr-1">
                  <Calendar size={13} /> Mốc thời gian:
                </span>
                {[
                  { key: 'ALL', label: 'Tất cả' },
                  { key: '3M', label: '3 tháng gần nhất' },
                  { key: '6M', label: '6 tháng' },
                  { key: '1Y', label: '1 năm qua' },
                  { key: 'YEAR', label: 'Năm nay' },
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleApplyDatePreset(p.key as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeDatePreset === p.key
                        ? 'bg-slate-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-sm'
                        : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs w-full lg:w-auto">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <span className="text-slate-400 font-medium">Từ:</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => {
                      setDateFrom(e.target.value);
                      setActiveDatePreset('CUSTOM');
                    }}
                    className="bg-transparent border-none outline-none text-slate-700 dark:text-zinc-200 text-xs font-medium"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <span className="text-slate-400 font-medium">Đến:</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => {
                      setDateTo(e.target.value);
                      setActiveDatePreset('CUSTOM');
                    }}
                    className="bg-transparent border-none outline-none text-slate-700 dark:text-zinc-200 text-xs font-medium"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => handleApplyDatePreset('ALL')}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg transition-colors"
                    title="Đặt lại khoảng ngày"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ─── STATES ───────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && !selectedProductId && (
        <DSCard className="p-12 text-center">
          <BarChart2 size={48} className="text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-zinc-300 font-bold text-base">Chọn một sản phẩm để bắt đầu phân tích xu hướng SPC</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1 max-w-md mx-auto">
            Hệ thống sẽ tự động tổng hợp kết quả kiểm nghiệm, tính toán năng lực quy trình Cpk, giới hạn kiểm soát 3σ (UCL, LCL) và dự báo độ ổn định theo thời gian bảo quản.
          </p>
        </DSCard>
      )}

      {!loading && selectedProductId && selectedCriteriaName && chartData.length === 0 && (
        <DSCard className="p-12 text-center">
          <Info size={40} className="text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-zinc-300 font-bold">Chưa có dữ liệu định lượng cho chỉ tiêu: &quot;{selectedCriteriaName}&quot;</p>
          <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1">Vui lòng chọn chỉ tiêu khác hoặc kiểm tra lại phiếu kiểm nghiệm của sản phẩm này.</p>
        </DSCard>
      )}

      {!loading && chartData.length >= 2 && spcStats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Số lô phân tích', value: <span className="text-2xl font-black text-slate-800 dark:text-zinc-100">{chartData.length}</span> },
              {
                label: 'Trung bình (X̄)',
                value: (
                  <>
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{spcStats.mean.toFixed(3)}</span>
                      {selectedCriteria?.unit && <span className="text-xs text-slate-400 font-bold">{selectedCriteria.unit}</span>}
                    </div>
                    {spcStats.meanPercent !== null && (
                      <p className="text-xs font-black text-indigo-600 dark:text-indigo-300 mt-0.5 font-mono">
                        = {spcStats.meanPercent.toFixed(1)}% <span className="font-normal text-[10px] opacity-75">công bố</span>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">σ={spcStats.std.toFixed(3)} | CV={spcStats.cv.toFixed(1)}%</p>
                  </>
                )
              },
              { label: 'Năng lực quá trình', value: <div className="mt-1"><CpkBadge value={spcStats.cpk} /></div> },
              {
                label: 'Ngoài kiểm soát',
                value: (
                  <>
                    <span className={`text-2xl font-black ${spcStats.outOfControl.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {spcStats.outOfControl.length}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {spcStats.outOfSpec.length > 0 ? `${spcStats.outOfSpec.length} ngoài tiêu chuẩn` : 'Không lô nào ngoài spec'}
                    </p>
                  </>
                )
              },
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
                  {selectedCriteria?.unit ? ` (${selectedCriteria.unit})` : ''}
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
                <Tooltip content={<CustomTooltip unit={selectedCriteria?.unit || ''} />} />
                <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
                {!isNaN(spcStats.ucl) && (
                  <ReferenceLine y={spcStats.ucl} stroke="#f87171" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: 'UCL', position: 'insideTopRight', fontSize: 10, fill: '#f87171' }} />
                )}
                {!isNaN(spcStats.mean) && (
                  <ReferenceLine y={spcStats.mean} stroke="#818cf8" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'X̄', position: 'insideTopRight', fontSize: 10, fill: '#818cf8' }} />
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

          {/* AI Stability & Shelf-Life Forecasting Card */}
          {stabilityReport && stabilityReport.forecasts.length > 0 && (
            <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-cyan-500/10 p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl shadow-md">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 dark:text-zinc-100 text-sm flex items-center gap-2">
                      Dự báo Động học Suy giảm & Độ ổn định (ICH Q1A)
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black px-2 py-0.5 rounded-full uppercase">
                        AI Forecasting
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Ước tính tốc độ suy giảm hoạt chất và thời điểm chạm ngưỡng Min theo thời gian bảo quản.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEnrichStabilityWithAI}
                  disabled={isGeneratingAiStability}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {isGeneratingAiStability ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Phân tích sâu bằng AI
                </button>
              </div>

              {/* Summary text */}
              <div className="p-3.5 bg-white/80 dark:bg-zinc-900/80 rounded-xl border border-indigo-100/80 dark:border-indigo-900/40 text-xs font-medium text-slate-700 dark:text-zinc-200">
                {aiStabilitySummary || stabilityReport.executiveSummary}
              </div>

              {/* Criteria Forecast Badges Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stabilityReport.forecasts.map(f => {
                  const isHighRisk = f.riskLevel === 'HIGH_EXPIRY_RISK';
                  const isModRisk = f.riskLevel === 'MODERATE_RISK';
                  return (
                    <div
                      key={f.criteriaName}
                      className={`p-3 rounded-xl border transition-all ${
                        isHighRisk
                          ? 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                          : isModRisk
                          ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                          : 'bg-white/90 dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-black text-slate-800 dark:text-zinc-100 truncate pr-2">{f.criteriaName}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isHighRisk ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' :
                          isModRisk ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                        }`}>
                          {isHighRisk ? 'Nguy cơ cao 🚨' : isModRisk ? 'Cần lưu ý ⚠️' : 'Ổn định tốt ✓'}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                        <div className="flex justify-between">
                          <span>Tốc độ suy giảm:</span>
                          <span className="font-bold text-slate-800 dark:text-zinc-200">
                            {(f.decayRatePerMonth * 12).toFixed(1)}{f.unit}/năm (R²={f.rSquared})
                          </span>
                        </div>
                        {f.projectedMonthToMinLimit ? (
                          <div className="flex justify-between">
                            <span>Dự kiến chạm Min ({f.minLimit}{f.unit}):</span>
                            <span className="font-black text-indigo-600 dark:text-indigo-400">
                              Sau {f.projectedMonthToMinLimit} tháng
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
