import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { Batch, Product, TCCS, TestResult } from '../types';
import { calculateOverallStatus } from '../utils/evaluation';

export interface HydratedBatch extends Batch {
  product?: Product;
  tccs?: TCCS;
}

export interface HydratedTestResult extends TestResult {
  batch?: HydratedBatch;
  product?: Product;
}

export const useDataGraph = () => {
  const { rawBatches, rawProducts, rawTccsList, rawTestResults, rawAllTestResults } = useAppStore(useShallow(state => ({
    rawBatches: state.batches,
    rawProducts: state.products,
    rawTccsList: state.tccsList,
    rawTestResults: state.testResults,
    rawAllTestResults: state.allTestResults,
  })));

  // Khởi tạo các Map tra cứu 1 lần duy nhất để tái sử dụng cho tất cả Derived State
  const productMap = useMemo(() => new Map(rawProducts.map(p => [p.id, p])), [rawProducts]);
  const tccsMap = useMemo(() => new Map(rawTccsList.map(t => [t.id, t])), [rawTccsList]);
  const batchMap = useMemo(() => new Map(rawBatches.map(b => [b.id, b])), [rawBatches]);

  const batches = useMemo<HydratedBatch[]>(() => {
    return rawBatches.map(batch => ({
      ...batch,
      product: productMap.get(batch.productId),
      tccs: tccsMap.get(batch.tccsId),
    }));
  }, [rawBatches, productMap, tccsMap]);

  const testResults = useMemo<HydratedTestResult[]>(() => {
    return rawTestResults.map(res => {
      const rawBatch = batchMap.get(res.batchId);
      const product = rawBatch ? productMap.get(rawBatch.productId) : undefined;
      const tccs = rawBatch ? tccsMap.get(rawBatch.tccsId) : undefined;
      const overallStatus = (res.results && res.results.length > 0)
        ? calculateOverallStatus(res.results, tccs || null)
        : (res.overallStatus || 'PASS');

      return {
        ...res,
        overallStatus,
        batch: rawBatch ? { ...rawBatch, product, tccs } : undefined,
        product: product
      };
    });
  }, [rawTestResults, batchMap, productMap, tccsMap]);

  const allTestResultsHydrated = useMemo<HydratedTestResult[]>(() => {
    if (!rawAllTestResults || rawAllTestResults.length === 0) return [];
    return rawAllTestResults.map(res => {
      const rawBatch = batchMap.get(res.batchId);
      const product = rawBatch ? productMap.get(rawBatch.productId) : undefined;
      const tccs = rawBatch ? tccsMap.get(rawBatch.tccsId) : undefined;
      const overallStatus = (res.results && res.results.length > 0)
        ? calculateOverallStatus(res.results, tccs || null)
        : (res.overallStatus || 'PASS');

      return {
        ...res,
        overallStatus,
        batch: rawBatch ? { ...rawBatch, product, tccs } : undefined,
        product: product
      };
    });
  }, [rawAllTestResults, batchMap, productMap, tccsMap]);

  return { batches, testResults, allTestResultsHydrated };
};