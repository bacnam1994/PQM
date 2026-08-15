import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import {
  FileText, Download, Calendar, Activity, CheckCircle2,
  XCircle, AlertCircle, RefreshCcw, ClipboardCheck,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  BarChart2, ShieldAlert, Info, Search, X
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell
} from 'recharts';
import {
  PageHeader, DSFilterBar, DSSelect, DSCard,
  DSEmptyState, StatusBadge
} from '../../components';
import { formatDateStandard, parseNumberFromText, checkRange } from '../../utils';
import { Criterion, ProductFormula, TestResult, Batch } from '../../types';
import { useCriteriaResolver } from '../../hooks/useCriteriaResolver';
import { normalizeName } from '../../services/criteriaAliasService';
import { isCriteriaMatch } from '../../utils/aiMapping';
import * as XLSX from 'xlsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch { return dateStr; }
};

// ─── SPC Statistical Functions ────────────────────────────────────────────────

const calcMean = (vals: number[]): number =>
  vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;

const calcStdDev = (vals: number[], mean: number): number => {
  if (vals.length < 2) return 0;
  const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (vals.length - 1);
  return Math.sqrt(variance);
};

const calcPercentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

/** Tính Cpk. Nếu chỉ có 1 giới hạn → trả về Cpu hoặc Cpl + type. */
const calcCpk = (
  mean: number, stdDev: number, usl?: number, lsl?: number
): { value: number | null; type: 'Cpk' | 'Cpu' | 'Cpl' | null } => {
  if (stdDev === 0 || (usl === undefined && lsl === undefined)) return { value: null, type: null };
  if (usl !== undefined && lsl !== undefined) {
    const cpu = (usl - mean) / (3 * stdDev);
    const cpl = (mean - lsl) / (3 * stdDev);
    return { value: Math.min(cpu, cpl), type: 'Cpk' };
  }
  if (usl !== undefined) return { value: (usl - mean) / (3 * stdDev), type: 'Cpu' };
  if (lsl !== undefined) return { value: (mean - lsl) / (3 * stdDev), type: 'Cpl' };
  return { value: null, type: null };
};

// ─── CpkBadge Component ───────────────────────────────────────────────────────

const CpkBadge: React.FC<{ value: number | null; type: string | null }> = ({ value, type }) => {
  if (value === null || type === null) return <span className="text-zinc-400 text-xs">---</span>;
  const color = value >= 1.33 ? 'text-emerald-600 dark:text-emerald-400' : value >= 1.0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  return (
    <span className={`font-black text-sm ${color}`} title={value >= 1.33 ? 'Đạt chuẩn GMP (≥1.33)' : value >= 1.0 ? 'Đạt tối thiểu (≥1.0)' : 'Dưới chuẩn (<1.0)'}>
      {value.toFixed(2)} <span className="text-[9px] font-bold opacity-60">{type}</span>
    </span>
  );
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FailCriteriaSummaryItem {
  name: string; unit: string; total: number;
  failCount: number; failRate: number;
  avgFailValue: number | null; limitText: string;
}

interface CriteriaStat {
  mean: number;
  stdDev: number;
  cv: number;
  cpk: number | null;
  cpkType: 'Cpk' | 'Cpu' | 'Cpl' | null;
  ucl: number;
  lcl: number;
  min: number;
  max: number;
  values: number[];
  batchNos: string[];
  failBatches: { batchNo: string; value: number; limit: string }[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

const QualitySummaryReport: React.FC = () => {
  const {
    products,
    batches,
    tccsList,
    productFormulas,
    testResultsRealtime,
    allTestResults,
    fetchAllTestResultsForDashboard,
    theme
  } = useAppStore(useShallow(state => ({
    products: state.products,
    batches: state.batches,
    tccsList: state.tccsList,
    productFormulas: state.productFormulas || [],
    testResultsRealtime: state.testResults || [],
    allTestResults: state.allTestResults || [],
    fetchAllTestResultsForDashboard: state.fetchAllTestResultsForDashboard,
    theme: state.theme
  })));

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);

  // Synchronize productSearch when selectedProductId changes
  useEffect(() => {
    if (selectedProductId) {
      const p = products.find(prod => prod.id === selectedProductId);
      if (p) {
        setProductSearch(`${p.code} - ${p.name}`);
      } else {
        setProductSearch('');
      }
    } else {
      setProductSearch('');
    }
  }, [selectedProductId, products]);

  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    const activeProducts = products.filter(p => p.status === 'ACTIVE');
    if (!productSearch) return activeProducts;

    const selectedProduct = products.find(p => p.id === selectedProductId);
    const selectedText = selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : '';
    if (productSearch === selectedText) return activeProducts;

    const searchLower = productSearch.toLowerCase();
    return activeProducts.filter(
      p => p.name.toLowerCase().includes(searchLower) || p.code.toLowerCase().includes(searchLower)
    );
  }, [products, productSearch, selectedProductId]);

  const handleInputBlur = () => {
    setTimeout(() => {
      setShowProductDropdown(false);
      if (selectedProductId) {
        const p = products.find(prod => prod.id === selectedProductId);
        if (p) {
          setProductSearch(`${p.code} - ${p.name}`);
        } else {
          setProductSearch('');
        }
      } else {
        setProductSearch('');
      }
    }, 200);
  };
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'trend' | 'spc' | 'fail'>('trend');
  const [selectedCriteriaName, setSelectedCriteriaName] = useState<string | null>(null);
  const [spcCriteriaName, setSpcCriteriaName] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchAllTestResultsForDashboard();
      setLoading(false);
    };
    loadData();
  }, []);

  const testResults = useMemo(() => {
    const map = new Map<string, TestResult>();
    allTestResults.forEach(r => map.set(r.id, r));
    testResultsRealtime.forEach(r => map.set(r.id, r));
    return Array.from(map.values());
  }, [allTestResults, testResultsRealtime]);

  const activeFormula = useMemo(() => {
    if (!selectedProductId) return undefined;
    return productFormulas.find((f: ProductFormula) => f.productId === selectedProductId);
  }, [selectedProductId, productFormulas]);

  const activeTccs = useMemo(() => {
    if (!selectedProductId) return undefined;
    const pTccs = tccsList.filter(t => t.productId === selectedProductId);
    if (pTccs.length === 0) return undefined;
    const active = pTccs.find(t => t.isActive);
    if (active) return active;
    return [...pTccs].sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0];
  }, [selectedProductId, tccsList]);

  const mainCriteria = useMemo<Criterion[]>(() => {
    if (!activeTccs) return [];
    return activeTccs.mainQualityCriteria || [];
  }, [activeTccs]);

  const resolver = useCriteriaResolver(activeTccs);

  // Set default SPC criteria when criteria change
  useEffect(() => {
    if (mainCriteria.length > 0 && !spcCriteriaName) {
      setSpcCriteriaName(mainCriteria[0].name);
    }
  }, [mainCriteria]);

  const reportData = useMemo(() => {
    if (!selectedProductId) return [];

    const filteredBatches = batches.filter(b => {
      if (b.productId !== selectedProductId) return false;
      if (dateRange.from && b.mfgDate && b.mfgDate < dateRange.from) return false;
      if (dateRange.to && b.mfgDate && b.mfgDate > dateRange.to) return false;
      return true;
    });

    const sortedBatches = [...filteredBatches].sort((a, b) => {
      return (a.mfgDate || '').localeCompare(b.mfgDate || '');
    });

    return sortedBatches.map(batch => {
      const batchResults = testResults.filter(r => r.batchId === batch.id);
      const consolidatedMap = new Map<string, any>();
      [...batchResults]
        .sort((a, b) => a.testDate.localeCompare(b.testDate))
        .forEach(r => {
          (r.results || []).forEach(entry => {
            if (entry && entry.criteriaName) {
              const canonicalName = resolver.resolve(entry.criteriaName);
              consolidatedMap.set(normalizeName(canonicalName), entry);
              consolidatedMap.set(normalizeName(entry.criteriaName), entry);
              consolidatedMap.set(entry.criteriaName.trim().toLowerCase(), entry);
            }
          });
        });

      let overallStatus: 'PASS' | 'FAIL' | 'PENDING' = 'PENDING';
      if (batchResults.length > 0) {
        const latestResult = [...batchResults].sort((a, b) => b.testDate.localeCompare(a.testDate))[0];
        overallStatus = latestResult.overallStatus as any;
      }

      const criteriaResults: Record<string, { value: string; numericValue: number | null; percent: number | null; unit: string; isPass: boolean | null }> = {};

      mainCriteria.forEach(criterion => {
        const normKey = normalizeName(criterion.name);
        let entry = consolidatedMap.get(normKey) || consolidatedMap.get(criterion.name.trim().toLowerCase());

        // Fallback tra cứu qua Resolver & Từ điển Dược khoa
        if (!entry) {
          for (const [, e] of consolidatedMap.entries()) {
            if (e?.criteriaName && (resolver.isMatch(e.criteriaName, criterion.name) || isCriteriaMatch(e.criteriaName, criterion.name))) {
              entry = e;
              break;
            }
          }
        }

        if (!entry || entry.value === undefined || entry.value === null || String(entry.value).trim() === '') {
          criteriaResults[criterion.name] = { value: '---', numericValue: null, percent: null, unit: criterion.unit || '', isPass: null };
          return;
        }

        const rawValueText = String(entry.value).trim();
        const unit = entry.unit || criterion.unit || '';

        if (rawValueText === 'Miễn kiểm' || rawValueText.includes('Đạt')) {
          criteriaResults[criterion.name] = { value: rawValueText, numericValue: null, percent: null, unit, isPass: true };
          return;
        }

        let basis: number | undefined = undefined;
        if (criterion.declaredContent != null && criterion.declaredContent !== '') {
          const parsed = typeof criterion.declaredContent === 'string'
            ? parseNumberFromText(criterion.declaredContent)
            : Number(criterion.declaredContent);
          if (!isNaN(parsed) && parsed > 0) basis = parsed;
        } else if (activeFormula) {
          let formulaItem = activeFormula.ingredients?.find(i => resolver.isMatch(i.name, criterion.name)) ||
            activeFormula.excipients?.find(e => resolver.isMatch(e.name, criterion.name));
          if (criterion.formulaIngredientId) {
            const linkedName = criterion.formulaIngredientId;
            const linkedItem = activeFormula.ingredients?.find(i => resolver.isMatch(i.name, linkedName)) ||
              activeFormula.excipients?.find(e => resolver.isMatch(e.name, linkedName));
            if (linkedItem) formulaItem = linkedItem;
          }
          if (formulaItem) {
            const dc = typeof formulaItem.declaredContent === 'string' ? parseNumberFromText(formulaItem.declaredContent) : Number(formulaItem.declaredContent);
            const ec = formulaItem.elementalContent != null
              ? (typeof formulaItem.elementalContent === 'string' ? parseNumberFromText(formulaItem.elementalContent) : Number(formulaItem.elementalContent))
              : undefined;
            if (criterion.calculationBasis === 'ELEMENTAL' && ec != null && !isNaN(ec) && ec > 0) basis = ec;
            else if (!isNaN(dc) && dc > 0) basis = dc;
          }
        }

        const minVal = criterion.min !== undefined && criterion.min !== null
          ? (typeof criterion.min === 'string' ? parseNumberFromText(criterion.min) : Number(criterion.min))
          : undefined;
        const maxVal = criterion.max !== undefined && criterion.max !== null
          ? (typeof criterion.max === 'string' ? parseNumberFromText(criterion.max) : Number(criterion.max))
          : undefined;

        // Fallback sang mức yêu cầu Min / Max của TCCS nếu không có declaredContent (VD: Men vi sinh ≥ 10^9 CFU/g)
        if (basis === undefined) {
          if (minVal !== undefined && !isNaN(minVal) && maxVal !== undefined && !isNaN(maxVal) && minVal > 0 && maxVal > 0) {
            basis = (minVal + maxVal) / 2;
          } else if (minVal !== undefined && !isNaN(minVal) && minVal > 0) {
            basis = minVal;
          } else if (maxVal !== undefined && !isNaN(maxVal) && maxVal > 0) {
            basis = maxVal;
          }
        }

        const actualVal = parseNumberFromText(rawValueText);
        const numericValue = isNaN(actualVal) ? null : actualVal;

        let percent: number | null = null;
        if (numericValue !== null && basis && basis > 0 && numericValue > 0) {
          percent = (numericValue / basis) * 100;
        }

        // Evaluate pass/fail based on criterion limits
        let isPass: boolean | null = null;
        if (numericValue !== null) {
          if (minVal !== undefined && !isNaN(minVal) && maxVal !== undefined && !isNaN(maxVal)) {
            isPass = numericValue >= minVal && numericValue <= maxVal;
          } else if (minVal !== undefined && !isNaN(minVal)) {
            isPass = numericValue >= minVal;
          } else if (maxVal !== undefined && !isNaN(maxVal)) {
            isPass = numericValue <= maxVal;
          } else if (entry.limit) {
            isPass = checkRange(entry.limit, rawValueText);
          } else {
            isPass = entry.isPass !== false;
          }
        } else if (entry.isPass !== undefined) {
          isPass = entry.isPass;
        }

        criteriaResults[criterion.name] = { value: rawValueText, numericValue, percent, unit, isPass };
      });

      return { batchId: batch.id, batchNo: batch.batchNo, mfgDate: batch.mfgDate, expDate: batch.expDate, overallStatus, criteriaResults };
    });
  }, [selectedProductId, batches, dateRange, testResults, mainCriteria, activeFormula, resolver]);

  // ─── SPC Statistics per Criteria ────────────────────────────────────────────
  const criteriaStats = useMemo<Record<string, CriteriaStat>>(() => {
    const result: Record<string, CriteriaStat> = {};
    mainCriteria.forEach(criterion => {
      const values: number[] = [];
      const batchNos: string[] = [];
      const failBatches: { batchNo: string; value: number; limit: string }[] = [];

      reportData.forEach(row => {
        const res = row.criteriaResults[criterion.name];
        if (!res || res.numericValue === null) return;
        values.push(res.numericValue);
        batchNos.push(row.batchNo);
        if (res.isPass === false) {
          const limitText = criterion.min !== undefined && criterion.max !== undefined
            ? `${criterion.min} – ${criterion.max} ${criterion.unit}`
            : criterion.max !== undefined ? `≤ ${criterion.max} ${criterion.unit}`
            : criterion.min !== undefined ? `≥ ${criterion.min} ${criterion.unit}` : '---';
          failBatches.push({ batchNo: row.batchNo, value: res.numericValue, limit: limitText });
        }
      });

      if (values.length === 0) {
        result[criterion.name] = { mean: 0, stdDev: 0, cv: 0, cpk: null, cpkType: null, ucl: 0, lcl: 0, min: 0, max: 0, values: [], batchNos: [], failBatches: [] };
        return;
      }

      const mean = calcMean(values);
      const stdDev = calcStdDev(values, mean);
      const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;
      const ucl = mean + 3 * stdDev;
      const lcl = mean - 3 * stdDev;
      const { value: cpk, type: cpkType } = calcCpk(mean, stdDev, criterion.max, criterion.min);

      result[criterion.name] = {
        mean, stdDev, cv, cpk, cpkType,
        ucl, lcl,
        min: Math.min(...values),
        max: Math.max(...values),
        values, batchNos, failBatches
      };
    });
    return result;
  }, [reportData, mainCriteria]);

  // ─── Overall Stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (reportData.length === 0) return { total: 0, pass: 0, fail: 0, passRate: '0%' };
    const total = reportData.length;
    const pass = reportData.filter(d => d.overallStatus === 'PASS').length;
    const fail = reportData.filter(d => d.overallStatus === 'FAIL').length;
    const passRate = total > 0 ? `${((pass / total) * 100).toFixed(1)}%` : '0%';
    return { total, pass, fail, passRate };
  }, [reportData]);

  // ─── Chart Data ──────────────────────────────────────────────────────────
  const trendChartData = useMemo(() => {
    return reportData.map(d => {
      const entry: any = { name: d.batchNo };
      mainCriteria.forEach(c => {
        const res = d.criteriaResults[c.name];
        if (res?.percent !== null && res?.percent !== undefined) {
          entry[c.name] = Math.round(res.percent * 10) / 10;
        }
      });
      return entry;
    });
  }, [reportData, mainCriteria]);

  const spcChartData = useMemo(() => {
    const stat = criteriaStats[spcCriteriaName];
    if (!stat || stat.values.length === 0) return [];
    return stat.batchNos.map((batchNo, i) => ({
      name: batchNo,
      value: Math.round(stat.values[i] * 1000) / 1000,
      isOutOfControl: stat.values[i] > stat.ucl || stat.values[i] < stat.lcl
    }));
  }, [criteriaStats, spcCriteriaName]);

  // ─── Histogram Data for drill-down ───────────────────────────────────────
  const histogramData = useMemo(() => {
    if (!selectedCriteriaName) return [];
    const stat = criteriaStats[selectedCriteriaName];
    if (!stat || stat.values.length < 2) return [];
    const bins = 6;
    const range = stat.max - stat.min;
    if (range === 0) return [{ label: stat.min.toFixed(2), count: stat.values.length }];
    const binSize = range / bins;
    const counts = Array(bins).fill(0);
    stat.values.forEach(v => {
      const idx = Math.min(Math.floor((v - stat.min) / binSize), bins - 1);
      counts[idx]++;
    });
    return counts.map((count, i) => ({
      label: `${(stat.min + i * binSize).toFixed(2)}`,
      count
    }));
  }, [selectedCriteriaName, criteriaStats]);

// ─── FAIL criteria summary ────────────────────────────────────────────────
  const failCriteriaSummary = useMemo<FailCriteriaSummaryItem[]>(() => {
    const result: FailCriteriaSummaryItem[] = [];
    mainCriteria.forEach(c => {
      const stat = criteriaStats[c.name];
      if (!stat) return;
      const total = stat.values.length;
      const failCount = stat.failBatches.length;
      const failRate = total > 0 ? (failCount / total) * 100 : 0;
      const criterion = mainCriteria.find(cr => cr.name === c.name);
      const limitText = criterion?.min !== undefined && criterion?.max !== undefined
        ? `${criterion.min} – ${criterion.max} ${criterion.unit}`
        : criterion?.max !== undefined ? `\u2264 ${criterion.max} ${criterion.unit}`
        : criterion?.min !== undefined ? `\u2265 ${criterion.min} ${criterion.unit}` : '---';
      const avgFailValue = failCount > 0 ? calcMean(stat.failBatches.map(f => f.value)) : null;
      if (failCount > 0) {
        result.push({ name: c.name, unit: c.unit, total, failCount, failRate, avgFailValue, limitText });
      }
    });
    return result.sort((a, b) => b.failRate - a.failRate);
  }, [mainCriteria, criteriaStats]);

  // ─── Auto insight text ────────────────────────────────────────────────────
  const getInsight = useCallback((criteriaName: string): string => {
    const stat = criteriaStats[criteriaName];
    const criterion = mainCriteria.find(c => c.name === criteriaName);
    if (!stat || stat.values.length < 2) return 'Chưa đủ dữ liệu để phân tích.';

    const parts: string[] = [];
    parts.push(`Có ${stat.values.length} lô được phân tích.`);

    if (stat.cv < 3) parts.push('Quy trình rất ổn định (CV < 3%).');
    else if (stat.cv < 5) parts.push('Quy trình ổn định (CV < 5%).');
    else if (stat.cv < 10) parts.push(`Biến động trung bình (CV = ${stat.cv.toFixed(1)}%), cần theo dõi.`);
    else parts.push(`Biến động cao (CV = ${stat.cv.toFixed(1)}%) — cần điều tra nguyên nhân.`);

    if (stat.cpk !== null && stat.cpkType) {
      if (stat.cpk >= 1.33) parts.push(`${stat.cpkType} = ${stat.cpk.toFixed(2)}: Năng lực quy trình đạt chuẩn GMP.`);
      else if (stat.cpk >= 1.0) parts.push(`${stat.cpkType} = ${stat.cpk.toFixed(2)}: Đạt tối thiểu nhưng cần cải thiện.`);
      else parts.push(`${stat.cpkType} = ${stat.cpk.toFixed(2)}: Dưới chuẩn — nguy cơ sản xuất sản phẩm không đạt.`);
    }

    if (stat.failBatches.length > 0) {
      parts.push(`${stat.failBatches.length}/${stat.values.length} lô vượt giới hạn TCCS.`);
    }

    // Trend check (last 3 values)
    if (stat.values.length >= 3) {
      const last3 = stat.values.slice(-3);
      if (last3[0] < last3[1] && last3[1] < last3[2]) parts.push('Xu hướng tăng dần qua 3 lô gần nhất.');
      else if (last3[0] > last3[1] && last3[1] > last3[2]) parts.push('Xu hướng giảm dần qua 3 lô gần nhất.');
    }

    return parts.join(' ');
  }, [criteriaStats, mainCriteria]);

  // ─── Export Excel ─────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (reportData.length === 0) return;
    const product = products.find(p => p.id === selectedProductId);
    const productName = product?.name || 'Sản phẩm';
    const productCode = product?.code || '';
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tóm tắt + KPI
    const summaryRows: any[][] = [
      ['BÁO CÁO TỔNG HỢP CHẤT LƯỢNG CHUYÊN SÂU'],
      [],
      ['Tên sản phẩm:', productName],
      ['Mã sản phẩm:', productCode],
      ['Tiêu chuẩn cơ sở:', activeTccs?.code || '---'],
      ['Kỳ báo cáo:', `${dateRange.from ? formatDate(dateRange.from) : 'Đầu'} – ${dateRange.to ? formatDate(dateRange.to) : 'Hiện tại'}`],
      ['Ngày xuất báo cáo:', new Date().toLocaleString('vi-VN')],
      [],
      ['THỐNG KÊ TỔNG HỢP'],
      ['Tổng số lô:', stats.total],
      ['Số lô Đạt:', stats.pass],
      ['Số lô Không Đạt:', stats.fail],
      ['Tỷ lệ Đạt:', stats.passRate],
      [],
      ['NĂNG LỰC QUY TRÌNH (SPC KPIs)'],
      ['Chỉ tiêu', 'Trung bình (X̄)', 'Std Dev (σ)', 'CV (%)', 'Min', 'Max', 'UCL', 'LCL', 'Cpk/Cpu/Cpl', 'Loại'],
    ];
    mainCriteria.forEach(c => {
      const s = criteriaStats[c.name];
      if (!s || s.values.length === 0) return;
      summaryRows.push([
        c.name,
        s.mean.toFixed(4), s.stdDev.toFixed(4), s.cv.toFixed(2),
        s.min, s.max, s.ucl.toFixed(4), s.lcl.toFixed(4),
        s.cpk !== null ? s.cpk.toFixed(3) : '---', s.cpkType || '---'
      ]);
    });
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 30 }, ...Array(9).fill({ wch: 16 })];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tóm tắt & KPI');

    // Sheet 2: Chi tiết từng lô
    const detailHeaders = ['STT', 'Số Lô', 'Ngày SX', 'Hạn dùng'];
    mainCriteria.forEach(c => {
      detailHeaders.push(`${c.name} (${c.unit || ''})`);
      detailHeaders.push(`${c.name} (%)`);
    });
    detailHeaders.push('Kết luận');
    const detailRows = reportData.map((d, i) => {
      const row: any[] = [i + 1, d.batchNo, formatDate(d.mfgDate), formatDate(d.expDate)];
      mainCriteria.forEach(c => {
        const res = d.criteriaResults[c.name];
        row.push(res ? res.value : '---');
        row.push(res?.percent !== null && res?.percent !== undefined ? `${res.percent.toFixed(1)}%` : '---');
      });
      row.push(d.overallStatus === 'PASS' ? 'ĐẠT' : d.overallStatus === 'FAIL' ? 'KHÔNG ĐẠT' : 'CHƯA HOÀN THIỆN');
      return row;
    });
    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    wsDetail['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, ...mainCriteria.flatMap(() => [{ wch: 20 }, { wch: 12 }]), { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi tiết lô');

    // Sheet 3: Bảng SPC chi tiết từng lô per criteria
    const spcHeader = ['Số lô', ...mainCriteria.map(c => c.name), ...mainCriteria.map(c => `${c.name} – OOC?`)];
    const spcRows = reportData.map(d => {
      const row: any[] = [d.batchNo];
      mainCriteria.forEach(c => {
        const res = d.criteriaResults[c.name];
        row.push(res?.numericValue !== null && res?.numericValue !== undefined ? res.numericValue : '---');
      });
      mainCriteria.forEach(c => {
        const res = d.criteriaResults[c.name];
        const stat = criteriaStats[c.name];
        if (!stat || res?.numericValue === null || res?.numericValue === undefined) { row.push('---'); return; }
        row.push(res.numericValue > stat.ucl || res.numericValue < stat.lcl ? 'OOC' : 'OK');
      });
      return row;
    });
    const wsSpc = XLSX.utils.aoa_to_sheet([spcHeader, ...spcRows]);
    XLSX.utils.book_append_sheet(wb, wsSpc, 'SPC Control Chart');

    // Sheet 4: Danh sách lô FAIL chi tiết
    if (failCriteriaSummary.length > 0) {
      const failHeader = ['Chỉ tiêu', 'Số lô FAIL', 'Tổng lô', '% FAIL', 'Giá trị TB FAIL', 'Giới hạn TCCS'];
      const failRows = failCriteriaSummary.map((s: any) => [
        s.name, s.failCount, s.total, `${s.failRate.toFixed(1)}%`,
        s.avgFailValue !== null ? s.avgFailValue.toFixed(3) : '---',
        s.limitText
      ]);
      const wsFail = XLSX.utils.aoa_to_sheet([failHeader, ...failRows]);
      wsFail['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, wsFail, 'Phân tích FAIL');
    }

    const filename = `baocao_chuyen_sau_${productCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // ─── Theme ────────────────────────────────────────────────────────────────
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? '#27272a' : '#f4f4f5';
  const tooltipStyle = isDark
    ? { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#f4f4f5', fontSize: '12px' }
    : { borderRadius: '12px', border: '1px solid #f4f4f5', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px' };

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];
  const selectedStat = selectedCriteriaName ? criteriaStats[selectedCriteriaName] : null;
  const selectedCriterion = selectedCriteriaName ? mainCriteria.find(c => c.name === selectedCriteriaName) : null;
  const currentSpcStat = criteriaStats[spcCriteriaName];

  // ─── Custom SPC Dot ───────────────────────────────────────────────────────
  const SpcDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    const color = payload.isOutOfControl ? '#ef4444' : '#6366f1';
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={1.5} />;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Báo cáo Tổng hợp Chuyên sâu"
        subtitle="Thống kê SPC, biểu đồ kiểm soát (Control Chart), phân tích FAIL và năng lực quy trình Cpk."
        icon={FileText}
        action={
          reportData.length > 0 && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all shadow-md shadow-emerald-500/20"
            >
              <Download size={15} /> Xuất Excel (4 sheet)
            </button>
          )
        }
      />

      {/* Filter bar */}
      <DSFilterBar>
        <div className="relative flex-1 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-zinc-100/70 dark:bg-zinc-900/70 rounded-xl px-3 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus-within:border-zinc-300 dark:focus-within:border-zinc-700 focus-within:bg-white dark:focus-within:bg-zinc-950 transition-all w-full">
            <Search size={15} className="text-zinc-400 shrink-0" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setShowProductDropdown(true);
                if (!e.target.value) {
                  setSelectedProductId('');
                  setSelectedCriteriaName(null);
                  setSpcCriteriaName('');
                }
              }}
              onFocus={() => setShowProductDropdown(true)}
              onBlur={handleInputBlur}
              placeholder="Nhập mã hoặc tên sản phẩm..."
              className="py-2.5 bg-transparent border-none font-medium outline-none text-sm text-zinc-750 dark:text-zinc-250 w-full focus:outline-none focus:ring-0"
            />
            {selectedProductId ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedProductId('');
                  setSelectedCriteriaName(null);
                  setSpcCriteriaName('');
                  setProductSearch('');
                }}
                className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300 p-1 transition-colors"
              >
                <X size={14} />
              </button>
            ) : (
              <ChevronDown size={15} className="text-zinc-400 shrink-0 pointer-events-none" />
            )}
          </div>

          {showProductDropdown && (
            <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-zinc-950 rounded-xl shadow-xl border border-zinc-200/60 dark:border-zinc-800/80 max-h-60 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="px-4 py-3 text-xs font-semibold text-zinc-400 dark:text-zinc-550 italic">
                  Không tìm thấy sản phẩm phù hợp
                </div>
              ) : (
                filteredProducts.map(p => (
                  <div
                    key={p.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setSelectedCriteriaName(null);
                      setSpcCriteriaName('');
                      setProductSearch(`${p.code} - ${p.name}`);
                      setShowProductDropdown(false);
                    }}
                    className={`px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer border-b border-zinc-100 dark:border-zinc-900 last:border-none transition-colors flex flex-col justify-center ${
                      selectedProductId === p.id ? 'bg-indigo-50/70 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <p className="text-xs font-bold text-zinc-850 dark:text-zinc-200 leading-snug">
                      {p.name}
                    </p>
                    <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mt-0.5">
                      {p.code}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-zinc-100/70 dark:bg-zinc-900/70 px-3 py-1 border border-transparent rounded-xl">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Từ</span>
            <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="bg-transparent border-none text-xs font-semibold text-zinc-700 dark:text-zinc-300 outline-none p-1 cursor-pointer" />
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-100/70 dark:bg-zinc-900/70 px-3 py-1 border border-transparent rounded-xl">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Đến</span>
            <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="bg-transparent border-none text-xs font-semibold text-zinc-700 dark:text-zinc-300 outline-none p-1 cursor-pointer" />
          </div>
        </div>
        {(selectedProductId || dateRange.from || dateRange.to) && (
          <button onClick={() => { setSelectedProductId(''); setDateRange({ from: '', to: '' }); setSelectedCriteriaName(null); setSpcCriteriaName(''); }} className="px-4 py-2.5 text-xs text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all">Xóa lọc</button>
        )}
      </DSFilterBar>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 px-6 py-3 rounded-2xl shadow-sm border border-zinc-200/50 dark:border-zinc-800/50">
            <RefreshCcw className="animate-spin text-indigo-500" size={18} />
            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Đang tổng hợp dữ liệu kiểm nghiệm...</span>
          </div>
        </div>
      )}

      {!loading && !selectedProductId && (
        <DSEmptyState icon={ClipboardCheck} title="Yêu cầu chọn sản phẩm" message="Vui lòng chọn một sản phẩm đang lưu hành từ danh sách bộ lọc phía trên để bắt đầu lập báo cáo tổng hợp chất lượng." />
      )}

      {!loading && selectedProductId && reportData.length === 0 && (
        <DSEmptyState icon={AlertCircle} title="Không tìm thấy dữ liệu lô hàng" message="Không tìm thấy lô sản xuất nào của sản phẩm này trong khoảng thời gian đã chọn." />
      )}

      {!loading && selectedProductId && reportData.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

          {/* ─── 1. Summary Header Card ────────────────────────────────────────── */}
          <DSCard className="p-6 bg-gradient-to-br from-indigo-50/30 via-white to-emerald-50/10 dark:from-indigo-950/10 dark:via-zinc-950 dark:to-emerald-950/5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Thông tin sản phẩm</h3>
                <p className="text-lg font-black text-zinc-900 dark:text-zinc-50 mt-1">{products.find(p => p.id === selectedProductId)?.name}</p>
                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase mt-1 tracking-wider">Mã: {products.find(p => p.id === selectedProductId)?.code}</p>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Tiêu chuẩn Cơ sở</h3>
                <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1">{activeTccs?.code || 'Chưa công bố'}</p>
                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mt-1">Hiệu lực: {activeTccs?.issueDate ? formatDate(activeTccs.issueDate) : '---'}</p>
              </div>
              <div className="flex gap-3 items-center">
                {[
                  { label: 'Tổng lô', value: stats.total, color: 'text-zinc-800 dark:text-zinc-100' },
                  { label: 'Tỷ lệ Đạt', value: stats.passRate, color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Lô FAIL', value: stats.fail, color: stats.fail > 0 ? 'text-red-500' : 'text-zinc-400' },
                ].map((item, i) => (
                  <div key={i} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 p-3 rounded-2xl text-center shadow-xs">
                    <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">{item.label}</span>
                    <p className={`text-2xl font-black mt-0.5 ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </DSCard>

          {/* ─── 2. KPI Dashboard — Per-Criteria SPC Metrics ──────────────────── */}
          <div>
            <h3 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart2 size={13} /> Năng lực quy trình & Thống kê SPC theo chỉ tiêu
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {mainCriteria.map((criterion, i) => {
                const stat = criteriaStats[criterion.name];
                const isSelected = selectedCriteriaName === criterion.name;
                const hasData = stat && stat.values.length > 0;
                const cpkColor = !hasData || stat.cpk === null ? 'text-zinc-400'
                  : stat.cpk >= 1.33 ? 'text-emerald-600 dark:text-emerald-400'
                  : stat.cpk >= 1.0 ? 'text-amber-500'
                  : 'text-red-500';

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedCriteriaName(isSelected ? null : criterion.name)}
                    className={`text-left p-4 rounded-2xl border transition-all duration-200 ${isSelected
                      ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-500/60 shadow-md shadow-indigo-100 dark:shadow-indigo-950/30'
                      : 'border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{criterion.name}</span>
                      </div>
                      {isSelected ? <ChevronUp size={14} className="text-indigo-500" /> : <ChevronDown size={14} className="text-zinc-400" />}
                    </div>

                    {!hasData ? (
                      <p className="text-xs text-zinc-400 italic">Chưa có dữ liệu số</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'X̄ Mean', value: stat.mean.toFixed(3), sub: criterion.unit },
                          { label: 'σ Std Dev', value: stat.stdDev.toFixed(3), sub: criterion.unit },
                          { label: 'CV', value: `${stat.cv.toFixed(1)}%`, sub: stat.cv < 5 ? '✓ Ổn định' : stat.cv < 10 ? '⚠ TB' : '✗ Cao' },
                          { label: 'Min', value: stat.min.toFixed(3), sub: criterion.unit },
                          { label: 'Max', value: stat.max.toFixed(3), sub: criterion.unit },
                          { label: stat.cpkType || 'Cpk', value: stat.cpk !== null ? stat.cpk.toFixed(2) : '---', sub: stat.cpk !== null ? (stat.cpk >= 1.33 ? '✓ GMP' : stat.cpk >= 1.0 ? '⚠ Min' : '✗ Thấp') : '', isHighlight: true, highlightColor: cpkColor },
                        ].map((kpi, ki) => (
                          <div key={ki} className="bg-zinc-50/80 dark:bg-zinc-900/60 rounded-xl p-2 text-center">
                            <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">{kpi.label}</div>
                            <div className={`text-sm font-black mt-0.5 ${kpi.isHighlight ? kpi.highlightColor : 'text-zinc-800 dark:text-zinc-200'}`}>{kpi.value}</div>
                            <div className="text-[8px] text-zinc-400 mt-0.5">{kpi.sub}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {hasData && stat.failBatches.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center gap-1.5">
                        <AlertCircle size={11} className="text-red-500 shrink-0" />
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400">{stat.failBatches.length} lô vượt giới hạn TCCS</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── 3. Drill-down Panel ─────────────────────────────────────────── */}
          {selectedCriteriaName && selectedStat && selectedStat.values.length > 0 && (
            <DSCard className="p-6 border-indigo-200/60 dark:border-indigo-800/40 bg-gradient-to-r from-indigo-50/40 to-purple-50/20 dark:from-indigo-950/20 dark:to-purple-950/10 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 mb-5">
                <Activity size={15} className="text-indigo-500" />
                <h3 className="text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Chi tiết: {selectedCriteriaName}</h3>
                <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">{selectedStat.values.length} lô</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Box Plot visual */}
                <div>
                  <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Phân bố dữ liệu (Box Plot)</h4>
                  {(() => {
                    const sorted = [...selectedStat.values].sort((a, b) => a - b);
                    const q1 = calcPercentile(sorted, 25);
                    const median = calcPercentile(sorted, 50);
                    const q3 = calcPercentile(sorted, 75);
                    const iqr = q3 - q1;
                    const whiskerLo = Math.max(selectedStat.min, q1 - 1.5 * iqr);
                    const whiskerHi = Math.min(selectedStat.max, q3 + 1.5 * iqr);
                    const range = selectedStat.max - selectedStat.min || 1;
                    const toPercent = (v: number) => ((v - selectedStat.min) / range) * 100;

                    return (
                      <div className="space-y-3">
                        {/* Visual box */}
                        <div className="relative h-10 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg overflow-visible mx-2">
                          {/* whisker lines */}
                          <div className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-zinc-400" style={{ left: `${toPercent(whiskerLo)}%`, width: `${toPercent(whiskerHi) - toPercent(whiskerLo)}%` }} />
                          {/* IQR box */}
                          <div className="absolute top-2 bottom-2 bg-indigo-300 dark:bg-indigo-700 rounded" style={{ left: `${toPercent(q1)}%`, width: `${toPercent(q3) - toPercent(q1)}%` }} />
                          {/* median line */}
                          <div className="absolute top-1 bottom-1 w-0.5 bg-indigo-700 dark:bg-indigo-300" style={{ left: `${toPercent(median)}%` }} />
                          {/* UCL/LCL markers */}
                          {selectedStat.ucl <= selectedStat.max && (
                            <div className="absolute top-0 bottom-0 w-0.5 border-dashed border-l-2 border-red-500/60" style={{ left: `${toPercent(selectedStat.ucl)}%` }} title={`UCL: ${selectedStat.ucl.toFixed(3)}`} />
                          )}
                          {selectedStat.lcl >= selectedStat.min && (
                            <div className="absolute top-0 bottom-0 w-0.5 border-dashed border-l-2 border-red-500/60" style={{ left: `${toPercent(selectedStat.lcl)}%` }} title={`LCL: ${selectedStat.lcl.toFixed(3)}`} />
                          )}
                        </div>

                        {/* Stats table */}
                        <div className="grid grid-cols-5 gap-1 text-center">
                          {[
                            { label: 'Min', val: selectedStat.min.toFixed(3) },
                            { label: 'Q1', val: q1.toFixed(3) },
                            { label: 'Median', val: median.toFixed(3) },
                            { label: 'Q3', val: q3.toFixed(3) },
                            { label: 'Max', val: selectedStat.max.toFixed(3) },
                          ].map((s, i) => (
                            <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-2 border border-zinc-100 dark:border-zinc-800/50">
                              <div className="text-[8px] font-bold text-zinc-400 uppercase">{s.label}</div>
                              <div className="text-xs font-black text-zinc-800 dark:text-zinc-200 mt-0.5 tabular-nums">{s.val}</div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center">
                          {[
                            { label: 'UCL (μ+3σ)', val: selectedStat.ucl.toFixed(3), color: 'text-red-500' },
                            { label: 'μ Mean', val: selectedStat.mean.toFixed(3), color: 'text-indigo-600 dark:text-indigo-400' },
                            { label: 'LCL (μ-3σ)', val: selectedStat.lcl.toFixed(3), color: 'text-red-500' },
                          ].map((s, i) => (
                            <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-2 border border-dashed border-zinc-200 dark:border-zinc-800/50">
                              <div className="text-[8px] font-bold text-zinc-400 uppercase">{s.label}</div>
                              <div className={`text-xs font-black mt-0.5 tabular-nums ${s.color}`}>{s.val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Histogram */}
                <div>
                  <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Phân phối tần suất (Histogram)</h4>
                  {histogramData.length > 0 ? (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={histogramData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: axisColor }} />
                          <YAxis tick={{ fontSize: 9, fill: axisColor }} allowDecimals={false} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="count" name="Số lô" radius={[4, 4, 0, 0]}>
                            {histogramData.map((_, idx) => (
                              <Cell key={idx} fill={colors[idx % colors.length]} fillOpacity={0.8} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic mt-4">Cần ít nhất 2 điểm dữ liệu.</p>
                  )}
                </div>
              </div>

              {/* Auto insight */}
              <div className="mt-4 p-4 bg-white/70 dark:bg-zinc-900/50 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-2">
                <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">{getInsight(selectedCriteriaName)}</p>
              </div>

              {/* Fail batches list */}
              {selectedStat.failBatches.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-[9px] font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1"><XCircle size={11} /> Lô vượt giới hạn</h4>
                  <div className="space-y-1">
                    {selectedStat.failBatches.map((fb, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs bg-red-50/50 dark:bg-red-950/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/30">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 w-20">{fb.batchNo}</span>
                        <span className="font-black text-red-600 dark:text-red-400">{fb.value}</span>
                        <span className="text-zinc-400">vs giới hạn:</span>
                        <span className="text-zinc-600 dark:text-zinc-400">{fb.limit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DSCard>
          )}

          {/* ─── 4. Tab Bar: Trend / Control Chart / FAIL Analysis ───────────── */}
          <div className="flex gap-1 bg-zinc-100/70 dark:bg-zinc-900/60 p-1 rounded-2xl w-fit">
            {([
              { key: 'trend', label: 'Xu hướng hoạt chất', icon: TrendingUp },
              { key: 'spc', label: 'Control Chart (SPC)', icon: Activity },
              { key: 'fail', label: `Phân tích FAIL${failCriteriaSummary.length > 0 ? ` (${failCriteriaSummary.length})` : ''}`, icon: ShieldAlert },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${activeTab === tab.key
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── TAB: Trend Chart ─────────────────────────────────────────────── */}
          {activeTab === 'trend' && (
            <DSCard className="p-6">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <TrendingUp size={15} /> Xu hướng biến động hàm lượng theo lô (%)
              </h3>
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisColor, fontWeight: 600 }} />
                    <YAxis domain={[75, 115]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisColor }}
                      label={{ value: 'Hiệu suất (%)', angle: -90, position: 'insideLeft', style: { fill: axisColor, fontSize: 11, fontWeight: 600 } }} />
                    <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'LSL 90%', fontSize: 9, fill: '#f59e0b' }} />
                    <ReferenceLine y={110} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'USL 110%', fontSize: 9, fill: '#f59e0b' }} />
                    <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600, paddingTop: 10 }} />
                    {mainCriteria.map((c, i) => (
                      <Line key={i} type="monotone" dataKey={c.name} name={`${c.name} (%)`}
                        stroke={colors[i % colors.length]} activeDot={{ r: 6 }} strokeWidth={2.5} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </DSCard>
          )}

          {/* ─── TAB: SPC Control Chart ──────────────────────────────────────── */}
          {activeTab === 'spc' && (
            <DSCard className="p-6">
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-zinc-400" />
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Control Chart (SPC) — Biểu đồ kiểm soát thống kê</h3>
                </div>
                <div className="ml-auto">
                  <DSSelect value={spcCriteriaName} onChange={e => setSpcCriteriaName(e.target.value)} className="text-xs">
                    {mainCriteria.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </DSSelect>
                </div>
              </div>

              {/* SPC legend */}
              <div className="flex flex-wrap gap-4 mb-4 text-[10px] font-bold">
                {[
                  { color: '#6366f1', label: 'Giá trị thực tế' },
                  { color: '#ef4444', label: 'OOC — Ngoài giới hạn kiểm soát' },
                  { color: '#10b981', label: `UCL (μ+3σ)${currentSpcStat ? ` = ${currentSpcStat.ucl.toFixed(3)}` : ''}`, dash: true },
                  { color: '#10b981', label: `LCL (μ-3σ)${currentSpcStat ? ` = ${currentSpcStat.lcl.toFixed(3)}` : ''}`, dash: true },
                  { color: '#f59e0b', label: `Spec Limit TCCS`, dash: true },
                ].map((l, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-6 h-0.5" style={{ backgroundColor: l.color, borderTop: l.dash ? '2px dashed' : '2px solid', borderColor: l.color }} />
                    <span className="text-zinc-500 dark:text-zinc-400">{l.label}</span>
                  </div>
                ))}
              </div>

              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spcChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisColor, fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisColor }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [v, name]} />
                    {/* UCL */}
                    {currentSpcStat && <ReferenceLine y={currentSpcStat.ucl} stroke="#10b981" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `UCL ${currentSpcStat.ucl.toFixed(2)}`, position: 'right', fontSize: 9, fill: '#10b981' }} />}
                    {/* Mean */}
                    {currentSpcStat && <ReferenceLine y={currentSpcStat.mean} stroke="#6366f1" strokeDasharray="3 3" strokeWidth={1} label={{ value: `X̄ ${currentSpcStat.mean.toFixed(2)}`, position: 'right', fontSize: 9, fill: '#6366f1' }} />}
                    {/* LCL */}
                    {currentSpcStat && currentSpcStat.lcl > 0 && <ReferenceLine y={currentSpcStat.lcl} stroke="#10b981" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `LCL ${currentSpcStat.lcl.toFixed(2)}`, position: 'right', fontSize: 9, fill: '#10b981' }} />}
                    {/* Spec USL */}
                    {(() => {
                      const c = mainCriteria.find(cr => cr.name === spcCriteriaName);
                      if (!c) return null;
                      return <>
                        {c.max !== undefined && <ReferenceLine y={c.max} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={2} label={{ value: `USL ${c.max}`, position: 'right', fontSize: 9, fill: '#f59e0b' }} />}
                        {c.min !== undefined && <ReferenceLine y={c.min} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={2} label={{ value: `LSL ${c.min}`, position: 'right', fontSize: 9, fill: '#f59e0b' }} />}
                      </>;
                    })()}
                    <Line type="monotone" dataKey="value" name={spcCriteriaName}
                      stroke="#6366f1" strokeWidth={2.5} connectNulls
                      dot={<SpcDot />} activeDot={{ r: 7, fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {spcChartData.some(d => d.isOutOfControl) && (
                <div className="mt-4 p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-xs font-bold text-red-700 dark:text-red-400">
                    {spcChartData.filter(d => d.isOutOfControl).length} điểm nằm ngoài giới hạn kiểm soát (OOC): {spcChartData.filter(d => d.isOutOfControl).map(d => d.name).join(', ')}
                  </p>
                </div>
              )}
            </DSCard>
          )}

          {/* ─── TAB: FAIL Analysis ──────────────────────────────────────────── */}
          {activeTab === 'fail' && (
            <DSCard className="p-6">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                <ShieldAlert size={15} /> Phân tích chỉ tiêu Không Đạt
              </h3>

              {failCriteriaSummary.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
                  <p className="font-black text-zinc-700 dark:text-zinc-300 text-base">Không có chỉ tiêu nào FAIL</p>
                  <p className="text-zinc-400 text-xs mt-1">Tất cả lô trong kỳ đều nằm trong giới hạn TCCS.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      <tr>
                        <th className="px-4 py-3">Chỉ tiêu</th>
                        <th className="px-4 py-3 text-center">Số lô FAIL</th>
                        <th className="px-4 py-3 text-center">Tổng lô</th>
                        <th className="px-4 py-3 text-center">Tỷ lệ FAIL</th>
                        <th className="px-4 py-3 text-center">TB giá trị FAIL</th>
                        <th className="px-4 py-3">Giới hạn TCCS</th>
                        <th className="px-4 py-3 text-center">Mức độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {failCriteriaSummary.map((s: any, i: number) => {
                        const badgeColor = s.failRate >= 30 ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                          : s.failRate >= 10 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400';
                        const badgeLabel = s.failRate >= 30 ? 'Nghiêm trọng' : s.failRate >= 10 ? 'Cần theo dõi' : 'Thấp';
                        return (
                          <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">{s.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center font-black text-red-600 dark:text-red-400">{s.failCount}</td>
                            <td className="px-4 py-3.5 text-center text-zinc-500 text-xs">{s.total}</td>
                            <td className="px-4 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(s.failRate, 100)}%`, backgroundColor: s.failRate >= 30 ? '#ef4444' : s.failRate >= 10 ? '#f59e0b' : '#fbbf24' }} />
                                </div>
                                <span className="font-bold text-xs text-zinc-700 dark:text-zinc-300">{s.failRate.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono text-xs text-zinc-700 dark:text-zinc-300">
                              {s.avgFailValue !== null ? `${s.avgFailValue.toFixed(3)} ${s.unit}` : '---'}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-zinc-500">{s.limitText}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`text-[9px] font-black px-2 py-1 rounded-full ${badgeColor}`}>{badgeLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </DSCard>
          )}

          {/* ─── 5. Detail Table ──────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-[0_1px_4px_rgba(0,0,0,0.04)] bg-white dark:bg-zinc-950">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200/60 dark:border-zinc-800">
                <tr className="text-zinc-500 dark:text-zinc-400 text-[9px] font-black uppercase tracking-widest">
                  <th className="px-4 py-3.5 w-12 text-center">STT</th>
                  <th className="px-4 py-3.5">Số Lô</th>
                  <th className="px-4 py-3.5">NSX</th>
                  <th className="px-4 py-3.5">HSD</th>
                  {mainCriteria.map((c, idx) => (
                    <th key={idx} className="px-4 py-3.5 text-center">
                      <div>{c.name}</div>
                      <div className="text-[7px] text-zinc-400 font-normal normal-case mt-0.5">{c.expectedText || (c.min != null && c.max != null ? `${c.min}~${c.max} ${c.unit}` : c.max != null ? `≤${c.max} ${c.unit}` : c.min != null ? `≥${c.min} ${c.unit}` : '---')}</div>
                    </th>
                  ))}
                  <th className="px-4 py-3.5 text-center">Kết luận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 font-medium">
                {reportData.map((row, idx) => (
                  <tr key={row.batchId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3.5 text-center text-zinc-400 tabular-nums text-xs">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-bold text-zinc-850 dark:text-zinc-200 text-xs">{row.batchNo}</td>
                    <td className="px-4 py-3.5 text-xs text-zinc-500 tabular-nums">{formatDate(row.mfgDate)}</td>
                    <td className="px-4 py-3.5 text-xs text-zinc-500 tabular-nums">{formatDate(row.expDate)}</td>
                    {mainCriteria.map((c, cIdx) => {
                      const res = row.criteriaResults[c.name];
                      const isOutOfCtrl = res?.numericValue !== null && res?.numericValue !== undefined && criteriaStats[c.name]
                        ? (res.numericValue > criteriaStats[c.name].ucl || (criteriaStats[c.name].lcl > 0 && res.numericValue < criteriaStats[c.name].lcl))
                        : false;
                      return (
                        <td key={cIdx} className="px-4 py-3.5 text-center">
                          {res ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`font-bold text-xs ${res.isPass === false ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-200'}`}>{res.value}</span>
                              {res.percent !== null && res.percent !== undefined && (
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${isOutOfCtrl ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'}`}>
                                  {res.percent.toFixed(1)}%{isOutOfCtrl ? ' ⚠' : ''}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-700">---</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center">
                        <StatusBadge type="RESULT" status={row.overallStatus} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
};

export default QualitySummaryReport;
