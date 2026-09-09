import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { formatDateStandard, parseNumberFromText, checkRange, resolveDeclaredBasis } from '../../../../utils';
import { Criterion, ProductFormula, TestResult } from '../../../../types';
import { useCriteriaResolver } from '../../../../hooks/useCriteriaResolver';
import { normalizeName } from '../../../../services/criteriaAliasService';
import { isCriteriaMatch } from '../../../../utils/aiMapping';
import { generatePQRRuleBasedNarrative, enrichPQRNarrativeWithAI, PQRExecutiveNarrative } from '../../../../services/ai/pqrNarrativeService';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { 
  formatDate, calcMean, calcStdDev, calcCpk, 
  parseCriterionBound, getCriterionLimitText 
} from '../utils/reportHelpers';
import { CriteriaStat, FailCriteriaSummaryItem, ReportDataRow } from '../types';

export const useQualitySummaryReportState = () => {
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
  const [pqrNarrative, setPqrNarrative] = useState<PQRExecutiveNarrative | null>(null);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (fetchAllTestResultsForDashboard) {
        await fetchAllTestResultsForDashboard();
      }
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

  useEffect(() => {
    if (mainCriteria.length > 0 && !spcCriteriaName) {
      setSpcCriteriaName(mainCriteria[0].name);
    }
  }, [mainCriteria]);

  const reportData = useMemo<ReportDataRow[]>(() => {
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

      const criteriaResults: Record<string, any> = {};

      mainCriteria.forEach(criterion => {
        const normKey = normalizeName(criterion.name);
        let entry = consolidatedMap.get(normKey) || consolidatedMap.get(criterion.name.trim().toLowerCase());

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

        const basisInfo = resolveDeclaredBasis(criterion, activeFormula, resolver);
        const basis = basisInfo.basis;

        const rawMin = parseCriterionBound(criterion.min);
        const rawMax = parseCriterionBound(criterion.max);
        const isBothZero = rawMin === 0 && rawMax === 0;
        const minVal = isBothZero ? undefined : rawMin;
        const maxVal = isBothZero ? undefined : rawMax;

        const actualVal = parseNumberFromText(rawValueText);
        const numericValue = isNaN(actualVal) ? null : actualVal;

        let percent: number | null = null;
        if (numericValue !== null && basis && basis > 0 && numericValue > 0) {
          percent = (numericValue / basis) * 100;
        }

        let isPass: boolean | null = null;
        if (numericValue !== null) {
          if (minVal !== undefined && maxVal !== undefined) {
            isPass = numericValue >= minVal && numericValue <= maxVal;
          } else if (minVal !== undefined && minVal > 0) {
            isPass = numericValue >= minVal;
          } else if (maxVal !== undefined && maxVal > 0) {
            isPass = numericValue <= maxVal;
          } else if (entry?.limit && entry.limit !== '---' && !/^0\s*[-–]\s*0/.test(entry.limit)) {
            isPass = checkRange(entry.limit, rawValueText);
          } else if (entry?.isPass !== undefined && entry.isPass !== null) {
            isPass = entry.isPass;
          } else {
            isPass = true;
          }
        } else if (entry?.isPass !== undefined) {
          isPass = entry.isPass;
        }

        criteriaResults[criterion.name] = {
          value: rawValueText,
          numericValue,
          percent,
          unit,
          isPass,
          entryLimit: entry?.limit
        };
      });

      return { 
        batchId: batch.id, 
        batchNo: batch.batchNo, 
        mfgDate: batch.mfgDate, 
        expDate: batch.expDate, 
        overallStatus, 
        criteriaResults 
      };
    });
  }, [selectedProductId, batches, dateRange, testResults, mainCriteria, activeFormula, resolver]);

  const criteriaStats = useMemo<Record<string, CriteriaStat>>(() => {
    const result: Record<string, CriteriaStat> = {};
    mainCriteria.forEach(criterion => {
      const values: number[] = [];
      const batchNos: string[] = [];
      const failBatches: { batchNo: string; value: number; limit: string }[] = [];

      reportData.forEach(row => {
        const res = row.criteriaResults[criterion.name] as any;
        if (!res || res.numericValue === null) return;
        values.push(res.numericValue);
        batchNos.push(row.batchNo);
        if (res.isPass === false) {
          const limitText = getCriterionLimitText(criterion, res.entryLimit);
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
      const rawMin = parseCriterionBound(criterion.min);
      const rawMax = parseCriterionBound(criterion.max);
      const effectiveMin = rawMin === 0 && rawMax === 0 ? undefined : rawMin;
      const effectiveMax = rawMin === 0 && rawMax === 0 ? undefined : rawMax;
      const { value: cpk, type: cpkType } = calcCpk(mean, stdDev, effectiveMax, effectiveMin);

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

  const stats = useMemo(() => {
    if (reportData.length === 0) return { total: 0, pass: 0, fail: 0, passRate: '0%' };
    const total = reportData.length;
    const pass = reportData.filter(d => d.overallStatus === 'PASS').length;
    const fail = reportData.filter(d => d.overallStatus === 'FAIL').length;
    const passRate = total > 0 ? `${((pass / total) * 100).toFixed(1)}%` : '0%';
    return { total, pass, fail, passRate };
  }, [reportData]);

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

  const failCriteriaSummary = useMemo<FailCriteriaSummaryItem[]>(() => {
    const result: FailCriteriaSummaryItem[] = [];
    mainCriteria.forEach(c => {
      const stat = criteriaStats[c.name];
      if (!stat) return;
      const total = stat.values.length;
      const failCount = stat.failBatches.length;
      const failRate = total > 0 ? (failCount / total) * 100 : 0;
      const criterion = mainCriteria.find(cr => cr.name === c.name);
      const limitText = criterion ? getCriterionLimitText(criterion) : '---';
      const avgFailValue = failCount > 0 ? calcMean(stat.failBatches.map(f => f.value)) : null;
      if (failCount > 0) {
        result.push({ name: c.name, unit: c.unit || '', total, failCount, failRate, avgFailValue, limitText });
      }
    });
    return result.sort((a, b) => b.failRate - a.failRate);
  }, [mainCriteria, criteriaStats]);

  const getInsight = useCallback((criteriaName: string): string => {
    const stat = criteriaStats[criteriaName];
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

    if (stat.values.length >= 3) {
      const last3 = stat.values.slice(-3);
      if (last3[0] < last3[1] && last3[1] < last3[2]) parts.push('Xu hướng tăng dần qua 3 lô gần nhất.');
      else if (last3[0] > last3[1] && last3[1] > last3[2]) parts.push('Xu hướng giảm dần qua 3 lô gần nhất.');
    }

    return parts.join(' ');
  }, [criteriaStats]);

  const handleGeneratePQR = async (useAi: boolean = false) => {
    const product = products.find(p => p.id === selectedProductId);
    const summaryData = {
      periodLabel: `${dateRange.from ? formatDate(dateRange.from) : 'Đầu kỳ'} – ${dateRange.to ? formatDate(dateRange.to) : 'Hiện tại'}`,
      productName: product?.name || 'Sản phẩm',
      totalBatches: stats.total,
      passedBatches: stats.pass,
      failedBatches: stats.fail,
      passRate: stats.total > 0 ? (stats.pass / stats.total) * 100 : 100,
      criteriaCpkList: mainCriteria.map(c => {
        const s = criteriaStats[c.name];
        return {
          name: c.name,
          cpk: s?.cpk,
          mean: s?.mean,
          stdDev: s?.stdDev,
          isCapable: s?.cpk != null && s.cpk >= 1.33
        };
      }),
      totalOOSCount: stats.fail
    };

    if (useAi) {
      setIsGeneratingNarrative(true);
      try {
        const res = await enrichPQRNarrativeWithAI(summaryData);
        setPqrNarrative(res);
        toast.success('Đã hoàn thiện Báo cáo Nhận xét PQR bằng AI Gemini!');
      } catch (e: any) {
        toast.error('Lỗi khi sinh văn bản AI: ' + e.message);
      } finally {
        setIsGeneratingNarrative(false);
      }
    } else {
      const res = generatePQRRuleBasedNarrative(summaryData);
      setPqrNarrative(res);
      toast.success('Đã cập nhật Báo cáo Nhận xét chất lượng PQR!');
    }
  };

  const handleExportExcel = () => {
    if (reportData.length === 0) return;
    const product = products.find(p => p.id === selectedProductId);
    const productName = product?.name || 'Sản phẩm';
    const productCode = product?.code || '';
    const wb = XLSX.utils.book_new();

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
        s.mean.toFixed(3),
        s.stdDev.toFixed(3),
        `${s.cv.toFixed(1)}%`,
        s.min.toFixed(3),
        s.max.toFixed(3),
        s.ucl.toFixed(3),
        s.lcl.toFixed(3),
        s.cpk !== null ? s.cpk.toFixed(2) : '---',
        s.cpkType || '---'
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan & SPC');

    const detailHeaders = ['Số lô', 'Ngày SX', 'Hạn dùng', 'Trạng thái'];
    mainCriteria.forEach(c => {
      detailHeaders.push(`${c.name} (${c.unit || ''})`);
      detailHeaders.push(`${c.name} (% công bố)`);
    });

    const detailRows: any[][] = [detailHeaders];
    reportData.forEach(row => {
      const r: any[] = [
        row.batchNo,
        row.mfgDate ? formatDate(row.mfgDate) : '---',
        row.expDate ? formatDate(row.expDate) : '---',
        row.overallStatus === 'PASS' ? 'Đạt' : row.overallStatus === 'FAIL' ? 'Không đạt' : 'Đang xử lý'
      ];
      mainCriteria.forEach(c => {
        const res = row.criteriaResults[c.name];
        r.push(res?.value || '---');
        r.push(res?.percent !== null && res?.percent !== undefined ? `${res.percent.toFixed(1)}%` : '---');
      });
      detailRows.push(r);
    });

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi tiết các lô');

    const fileName = `PQR_${productCode}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Đã xuất file Excel Báo cáo tổng hợp chất lượng!');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Đã sao chép vào bộ nhớ tạm!');
    setTimeout(() => setCopied(false), 2000);
  };

  const isDark = theme === 'dark';

  return {
    products,
    batches,
    tccsList,
    selectedProductId,
    setSelectedProductId,
    productSearch,
    setProductSearch,
    showProductDropdown,
    setShowProductDropdown,
    filteredProducts,
    handleInputBlur,
    dateRange,
    setDateRange,
    loading,
    activeTab,
    setActiveTab,
    selectedCriteriaName,
    setSelectedCriteriaName,
    spcCriteriaName,
    setSpcCriteriaName,
    pqrNarrative,
    isGeneratingNarrative,
    copied,
    mainCriteria,
    criteriaStats,
    stats,
    reportData,
    trendChartData,
    spcChartData,
    histogramData,
    failCriteriaSummary,
    getInsight,
    handleGeneratePQR,
    handleExportExcel,
    copyToClipboard,
    isDark
  };
};
