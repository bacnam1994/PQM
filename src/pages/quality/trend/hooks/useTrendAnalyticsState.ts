import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { formatDateStandard, parseNumberFromText, resolveDeclaredBasis } from '../../../../utils';
import { useCriteriaResolver } from '../../../../hooks/useCriteriaResolver';
import { normalizeName } from '../../../../services/criteriaAliasService';
import { isCriteriaMatch } from '../../../../utils/aiMapping';
import { predictProductStability, generateStabilityForecastWithAI } from '../../../../services/ai/stabilityPredictionService';
import * as XLSX from 'xlsx';
import { 
  removeVietnameseTones, 
  calcMean, 
  calcStdDev, 
  calcCpk, 
  parseCriterionBound 
} from '../utils/spcHelpers';

export const useTrendAnalyticsState = () => {
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

  const productGroups = useMemo(() => {
    const groups = new Set<string>();
    activeProducts.forEach(p => {
      if (p.group && p.group.trim()) groups.add(p.group.trim());
    });
    return Array.from(groups).sort();
  }, [activeProducts]);

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

  const filteredProducts = useMemo(() => {
    return activeProducts.filter(p => {
      const pStat = productStats.get(p.id) || { batchCount: 0, resultCount: 0 };
      if (onlyWithData && pStat.batchCount === 0) return false;
      if (selectedGroupFilter !== 'ALL' && p.group !== selectedGroupFilter) return false;

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

  const [manualBasisChoice, setManualBasisChoice] = useState<'AUTO' | 'ELEMENTAL' | 'DECLARED'>('AUTO');

  useEffect(() => {
    setManualBasisChoice('AUTO');
  }, [selectedProductId, selectedCriteriaName]);

  const resolver = useCriteriaResolver(activeTccs);

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

  return {
    selectedProduct,
    selectedProductId,
    selectedCriteria,
    selectedCriteriaName,
    setSelectedCriteriaName,
    activeTccs,
    criteriaList,
    filteredCriteriaList,
    criteriaSearch,
    setCriteriaSearch,
    basisInfo,
    declaredBasis,
    manualBasisChoice,
    setManualBasisChoice,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    activeDatePreset,
    handleApplyDatePreset,
    loading,
    chartData,
    spcStats,
    enrichedData,
    stabilityReport,
    aiStabilitySummary,
    isGeneratingAiStability,
    handleEnrichStabilityWithAI,
    handleExport,
    isDark,
    gridColor,
    axisColor,
    // Dropdown state
    dropdownRef,
    searchInputRef,
    isDropdownOpen,
    setIsDropdownOpen,
    productSearch,
    setProductSearch,
    filteredProducts,
    activeProducts,
    selectedGroupFilter,
    setSelectedGroupFilter,
    productGroups,
    onlyWithData,
    setOnlyWithData,
    topProductsWithData,
    productStats,
    selectedProductStat,
    handleSelectProduct,
    handleClearProduct
  };
};
