import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../../store/useAppStore';
import { fetchTestResultsByProductId } from '../../../../services/testResultService';
import { useCriteriaResolver } from '../../../../hooks/useCriteriaResolver';
import { resolveDeclaredBasis } from '../../../../utils/basisCalculation';
import { parseNumberFromText } from '../../../../utils';

export function useProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const products = useAppStore((state) => state.products);
  const tccsList = useAppStore((state) => state.tccsList);
  const productFormulas = useAppStore((state) => state.productFormulas);
  const isAdmin = useAppStore((state) => state.isAdmin);
  const batches = useAppStore((state) => state.batches);
  const testResults = useAppStore((state) => state.testResults);
  const deleteProductAction = useAppStore((state) => state.deleteProduct);

  const [activeTab, setActiveTab] = useState<'info' | 'formula' | 'tccs' | 'history' | 'analytics'>(
    'info'
  );
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const product = products.find((p) => p.id === id);
  const productTCCSList = useMemo(
    () =>
      tccsList
        .filter((t) => t.productId === id)
        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()),
    [tccsList, id]
  );

  const productFormula = useMemo(
    () => productFormulas.find((f) => f.productId === id),
    [productFormulas, id]
  );

  // Lô thuộc sản phẩm này
  const productBatches = useMemo(() => batches.filter((b) => b.productId === id), [batches, id]);

  // Kết quả từ Store (50 phiếu gần nhất)
  const productResults = useMemo(
    () =>
      testResults
        .filter((r) => {
          const b = batches.find((batch) => batch.id === r.batchId);
          return b?.productId === id;
        })
        .sort(
          (a, b) => new Date(b?.testDate || '').getTime() - new Date(a?.testDate || '').getTime()
        ),
    [testResults, batches, id]
  );

  // Toàn bộ lịch sử kiểm nghiệm (fetch riêng khi vào tab lịch sử / biến động)
  const [allProductResults, setAllProductResults] = useState(productResults);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [hasFetchedAll, setHasFetchedAll] = useState(false);

  const fetchAllResults = useCallback(async () => {
    if (!id || hasFetchedAll || isFetchingAll) return;
    setIsFetchingAll(true);
    try {
      const results = await fetchTestResultsByProductId(id);
      setAllProductResults(results);
      setHasFetchedAll(true);
    } catch (e) {
      console.error('Lỗi tải toàn bộ lịch sử kiểm nghiệm:', e);
    } finally {
      setIsFetchingAll(false);
    }
  }, [id, hasFetchedAll, isFetchingAll]);

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'analytics') {
      fetchAllResults();
    }
  }, [activeTab, fetchAllResults]);

  useEffect(() => {
    if (!hasFetchedAll) {
      setAllProductResults(productResults);
    }
  }, [productResults, hasFetchedAll]);

  // Danh mục chỉ tiêu chất lượng chính từ TCCS
  const allQualityCriteriaNames = useMemo(() => {
    const names = new Set<string>();
    productTCCSList.forEach((t) => {
      (t.mainQualityCriteria || []).forEach((c) => c && c.name && names.add(c.name));
    });
    return Array.from(names).sort();
  }, [productTCCSList]);

  const [selectedCriteria, setSelectedCriteria] = useState<Set<string>>(new Set());

  const toggleCriterion = useCallback((name: string) => {
    setSelectedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const selectAllCriteria = useCallback(() => {
    setSelectedCriteria(new Set(allQualityCriteriaNames));
  }, [allQualityCriteriaNames]);

  const clearAllCriteria = useCallback(() => {
    setSelectedCriteria(new Set());
  }, []);

  const activeTCCS = productTCCSList.find((t) => t.isActive) || productTCCSList[0];
  const resolver = useCriteriaResolver(activeTCCS);

  // Chế độ xem % hoặc giá trị thực tế theo từng chỉ tiêu
  const [criteriaViewModes, setCriteriaViewModes] = useState<Record<string, 'PERCENT' | 'VALUE'>>(
    {}
  );
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  const toggleCriterionViewMode = useCallback((name: string) => {
    setCriteriaViewModes((prev) => ({
      ...prev,
      [name]: (prev[name] || 'PERCENT') === 'PERCENT' ? 'VALUE' : 'PERCENT',
    }));
  }, []);

  const toggleCriterionTable = useCallback((name: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  }, []);

  // Helper tính toán thống kê
  const calcMean = (vals: number[]) =>
    vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;

  const calcStdDev = (vals: number[], mean: number) => {
    if (vals.length < 2) return 0;
    return Math.sqrt(vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (vals.length - 1));
  };

  // Dữ liệu analytics cho từng chỉ tiêu
  const analyticsDataMap = useMemo(() => {
    const result: Record<string, any> = {};

    allQualityCriteriaNames.forEach((criterionName) => {
      const criterionObj = productTCCSList
        .flatMap((t) => [...(t.mainQualityCriteria || []), ...(t.safetyCriteria || [])])
        .find((c) => c && resolver.isMatch(c.name, criterionName));

      let unit = criterionObj?.unit || '';
      const min = criterionObj?.min;
      const max = criterionObj?.max;
      const expectedText = criterionObj?.expectedText;

      const basisInfo = resolveDeclaredBasis(
        criterionObj || { name: criterionName },
        productFormula,
        resolver
      );
      const targetBasis = basisInfo.basis;
      const basisSource: 'FORMULA' | 'TCCS' | 'MIDPOINT' | 'NONE' =
        basisInfo.basisType === 'ELEMENTAL' || basisInfo.basisType === 'DECLARED'
          ? productFormula
            ? 'FORMULA'
            : 'TCCS'
          : basisInfo.basisType === 'MIDPOINT'
            ? 'MIDPOINT'
            : basisInfo.basisType === 'MIN' || basisInfo.basisType === 'MAX'
              ? 'TCCS'
              : 'NONE';
      if (!unit && basisInfo.formulaItem?.unit) unit = basisInfo.formulaItem.unit;

      const batchMap = new Map<string, any>();
      const batchDataList: any[] = [];
      const values: number[] = [];
      const percents: number[] = [];
      const labsFound = new Set<string>();

      const sortedResults = [...allProductResults].sort((a, b) => {
        const batchA = batches.find((batch) => batch.id === a.batchId);
        const batchB = batches.find((batch) => batch.id === b.batchId);
        const dateA = batchA?.mfgDate || a.testDate || a.createdAt || '';
        const dateB = batchB?.mfgDate || b.testDate || b.createdAt || '';
        return dateA.localeCompare(dateB);
      });

      sortedResults.forEach((res) => {
        const batch = batches.find((b) => b.id === res.batchId);
        const match = (res.results || []).find((r) =>
          resolver.isMatch(r.criteriaName, criterionName)
        );
        if (match && batch) {
          const numVal =
            typeof match.value === 'number' ? match.value : parseNumberFromText(match.value);
          if (!isNaN(numVal)) {
            const percent = targetBasis && targetBasis > 0 ? (numVal / targetBasis) * 100 : null;
            let isPass: boolean | null = null;
            if (min !== undefined && max !== undefined) isPass = numVal >= min && numVal <= max;
            else if (min !== undefined) isPass = numVal >= min;
            else if (max !== undefined) isPass = numVal <= max;
            else isPass = match.isPass !== false;

            labsFound.add(res.labName);
            values.push(numVal);
            if (percent !== null) percents.push(percent);

            const itemDetail = {
              batchId: batch.id,
              batchNo: batch.batchNo,
              mfgDate: batch.mfgDate,
              testDate: res.testDate,
              labName: res.labName,
              value: numVal,
              percent,
              isPass,
              testResultId: res.id,
            };
            batchDataList.push(itemDetail);

            const existing = batchMap.get(batch.batchNo) || {
              name: batch.batchNo,
              batchId: batch.id,
              mfgDate: batch.mfgDate,
              testDate: res.testDate,
            };
            existing[res.labName] = numVal;
            existing[`${res.labName}_pct`] = percent ? Math.round(percent * 10) / 10 : null;
            existing[`${res.labName}_val`] = numVal;
            existing[`${res.labName}_isPass`] = isPass;
            batchMap.set(batch.batchNo, existing);
          }
        }
      });

      let stats = null;
      if (values.length > 0) {
        const mean = calcMean(values);
        const stdDev = calcStdDev(values, mean);
        const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;
        const meanPercent =
          targetBasis && targetBasis > 0
            ? (mean / targetBasis) * 100
            : percents.length > 0
              ? calcMean(percents)
              : null;
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const minPercent = percents.length > 0 ? Math.min(...percents) : null;
        const maxPercent = percents.length > 0 ? Math.max(...percents) : null;
        const spreadPercent =
          minPercent !== null && maxPercent !== null ? maxPercent - minPercent : null;
        const passCount = batchDataList.filter((d) => d.isPass === true).length;
        const failCount = batchDataList.filter((d) => d.isPass === false).length;
        const passRate = batchDataList.length > 0 ? (passCount / batchDataList.length) * 100 : null;

        let stabilityLabel = 'Rất ổn định (CV < 3%)';
        let stabilityCls =
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';

        if (cv >= 10) {
          stabilityLabel = `Biến động cao (CV = ${cv.toFixed(1)}%)`;
          stabilityCls =
            'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
        } else if (cv >= 5) {
          stabilityLabel = `Biến động TB (CV = ${cv.toFixed(1)}%)`;
          stabilityCls =
            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
        } else if (cv >= 3) {
          stabilityLabel = `Quy trình ổn định (CV = ${cv.toFixed(1)}%)`;
          stabilityCls =
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
        }

        stats = {
          mean,
          stdDev,
          cv,
          meanPercent,
          minVal,
          maxVal,
          minPercent,
          maxPercent,
          spreadPercent,
          sampleCount: values.length,
          passCount,
          failCount,
          passRate,
          stabilityLabel,
          stabilityCls,
        };
      }

      result[criterionName] = {
        name: criterionName,
        unit,
        min,
        max,
        expectedText,
        targetBasis,
        basisSource,
        hasPercent: targetBasis !== undefined && targetBasis > 0,
        chartData: Array.from(batchMap.values()),
        batchDataList,
        labs: Array.from(labsFound),
        stats,
      };
    });

    return result;
  }, [
    allQualityCriteriaNames,
    productTCCSList,
    productFormula,
    resolver,
    allProductResults,
    batches,
  ]);

  // Thống kê tổng quan KPI
  const metrics = useMemo(() => {
    const totalBatches = productBatches.length;
    const passedResults = productResults.filter((r) => r.overallStatus === 'PASS').length;
    const passRate =
      productResults.length > 0 ? Math.round((passedResults / productResults.length) * 100) : null;
    const activeTccsCode = activeTCCS?.code || 'Chưa có';
    const lastTestDate = productResults[0]?.testDate || null;

    return {
      totalBatches,
      totalTestResults: productResults.length,
      passRate,
      activeTccsCode,
      lastTestDate,
    };
  }, [productBatches, productResults, activeTCCS]);

  const handleDeleteProduct = useCallback(async () => {
    if (!product) return;
    try {
      await deleteProductAction(product.id);
      navigate('/products');
    } catch (err: any) {
      console.error('Lỗi khi xóa sản phẩm:', err);
    }
  }, [product, deleteProductAction, navigate]);

  return {
    id,
    product,
    productTCCSList,
    activeTCCS,
    productFormula,
    batches: productBatches,
    productBatches,
    productResults,
    allProductResults,
    isFetchingAll,
    hasFetchedAll,
    activeTab,
    setActiveTab,
    allQualityCriteriaNames,
    selectedCriteria,
    toggleCriterion,
    selectAllCriteria,
    clearAllCriteria,
    criteriaViewModes,
    toggleCriterionViewMode,
    expandedTables,
    toggleCriterionTable,
    analyticsDataMap,
    metrics,
    isAdmin,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    handleDeleteProduct,
    navigate,
    resolver,
  };
}
