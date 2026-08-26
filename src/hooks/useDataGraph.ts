import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { Batch, Product, TCCS, TestResult, ProductFormula, RawMaterial, CriteriaAlias, FormulaIngredient } from '../types';
import { calculateOverallStatus } from '../utils/evaluation';

export interface HydratedFormulaIngredient extends FormulaIngredient {
  rawMaterial?: RawMaterial;
  isLinkedToMaterial: boolean;
}

export interface HydratedProductFormula extends ProductFormula {
  product?: Product;
  hydratedIngredients: HydratedFormulaIngredient[];
  hydratedExcipients: HydratedFormulaIngredient[];
  unlinkedCount: number;
}

export interface HydratedTCCS extends TCCS {
  product?: Product;
  formula?: ProductFormula;
  batchesCount: number;
  aliases: CriteriaAlias[];
}

export interface HydratedRawMaterial extends RawMaterial {
  usedInFormulas: ProductFormula[];
  usedInProducts: Product[];
  usageCount: number;
}

export interface HydratedBatch extends Batch {
  product?: Product;
  tccs?: TCCS;
  testResults?: TestResult[];
  latestTestResult?: TestResult;
  isFullyTested?: boolean;
}

export interface HydratedTestResult extends TestResult {
  batch?: HydratedBatch;
  product?: Product;
  tccs?: TCCS;
}

export interface HydratedCriteriaAlias extends CriteriaAlias {
  tccs?: TCCS;
  product?: Product;
}

export interface HydratedProduct extends Product {
  activeTCCS?: TCCS;
  allTCCS: TCCS[];
  formula?: ProductFormula;
  batches: Batch[];
  batchesCount: number;
  testResultsCount: number;
  passRate: number;
  latestBatch?: Batch;
}

export const useDataGraph = () => {
  const { 
    rawBatches, rawProducts, rawTccsList, rawTestResults, rawAllTestResults, 
    rawProductFormulas, rawRawMaterials, rawCriteriaAliases 
  } = useAppStore(useShallow(state => ({
    rawBatches: state.batches,
    rawProducts: state.products,
    rawTccsList: state.tccsList,
    rawTestResults: state.testResults,
    rawAllTestResults: state.allTestResults,
    rawProductFormulas: state.productFormulas || [],
    rawRawMaterials: state.rawMaterials || [],
    rawCriteriaAliases: state.criteriaAliases || [],
  })));

  // Khởi tạo các Map tra cứu 1 lần duy nhất để tái sử dụng cho tất cả Derived State
  const productMap = useMemo(() => new Map(rawProducts.map(p => [p.id, p])), [rawProducts]);
  const tccsMap = useMemo(() => new Map(rawTccsList.map(t => [t.id, t])), [rawTccsList]);
  const batchMap = useMemo(() => new Map(rawBatches.map(b => [b.id, b])), [rawBatches]);
  const formulaMap = useMemo(() => new Map(rawProductFormulas.map(f => [f.productId, f])), [rawProductFormulas]);
  const materialMap = useMemo(() => new Map(rawRawMaterials.map(m => [m.id, m])), [rawRawMaterials]);

  // Gom nhóm Test Results theo BatchId
  const testResultsByBatch = useMemo(() => {
    const map = new Map<string, TestResult[]>();
    rawTestResults.forEach(r => {
      const list = map.get(r.batchId) || [];
      list.push(r);
      map.set(r.batchId, list);
    });
    return map;
  }, [rawTestResults]);

  // Gom nhóm Batches theo ProductId
  const batchesByProduct = useMemo(() => {
    const map = new Map<string, Batch[]>();
    rawBatches.forEach(b => {
      const list = map.get(b.productId) || [];
      list.push(b);
      map.set(b.productId, list);
    });
    return map;
  }, [rawBatches]);

  // Gom nhóm TCCS theo ProductId
  const tccsByProduct = useMemo(() => {
    const map = new Map<string, TCCS[]>();
    rawTccsList.forEach(t => {
      const list = map.get(t.productId) || [];
      list.push(t);
      map.set(t.productId, list);
    });
    return map;
  }, [rawTccsList]);

  // Gom nhóm Aliases theo TccsId
  const aliasesByTccs = useMemo(() => {
    const map = new Map<string, CriteriaAlias[]>();
    rawCriteriaAliases.forEach(a => {
      const list = map.get(a.tccsId) || [];
      list.push(a);
      map.set(a.tccsId, list);
    });
    return map;
  }, [rawCriteriaAliases]);

  // Hydrated Batches
  const batches = useMemo<HydratedBatch[]>(() => {
    return rawBatches.map(batch => {
      const bTests = testResultsByBatch.get(batch.id) || [];
      const sortedTests = [...bTests].sort((a, b) => b.testDate.localeCompare(a.testDate));
      return {
        ...batch,
        product: productMap.get(batch.productId),
        tccs: tccsMap.get(batch.tccsId),
        testResults: sortedTests,
        latestTestResult: sortedTests[0],
        isFullyTested: bTests.length > 0 && bTests.some(t => t.overallStatus === 'PASS'),
      };
    });
  }, [rawBatches, productMap, tccsMap, testResultsByBatch]);

  // Hydrated Test Results
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
        batch: rawBatch ? { 
          ...rawBatch, 
          product, 
          tccs, 
          testResults: testResultsByBatch.get(rawBatch.id) || [], 
          isFullyTested: false 
        } : undefined,
        product,
        tccs,
      };
    });
  }, [rawTestResults, batchMap, productMap, tccsMap, testResultsByBatch]);

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
        batch: rawBatch ? { 
          ...rawBatch, 
          product, 
          tccs, 
          testResults: testResultsByBatch.get(rawBatch.id) || [], 
          isFullyTested: false 
        } : undefined,
        product,
        tccs,
      };
    });
  }, [rawAllTestResults, batchMap, productMap, tccsMap, testResultsByBatch]);

  // Hydrated Formulas
  const productFormulas = useMemo<HydratedProductFormula[]>(() => {
    return rawProductFormulas.map(f => {
      let unlinked = 0;
      const hydratedIngredients: HydratedFormulaIngredient[] = (f.ingredients || []).map(ing => {
        const mat = ing.materialId ? materialMap.get(ing.materialId) : undefined;
        if (!mat) unlinked++;
        return {
          ...ing,
          rawMaterial: mat,
          isLinkedToMaterial: !!mat,
        };
      });

      const hydratedExcipients: HydratedFormulaIngredient[] = (f.excipients || []).map(exc => {
        const mat = exc.materialId ? materialMap.get(exc.materialId) : undefined;
        if (!mat) unlinked++;
        return {
          ...exc,
          rawMaterial: mat,
          isLinkedToMaterial: !!mat,
        };
      });

      return {
        ...f,
        product: productMap.get(f.productId),
        hydratedIngredients,
        hydratedExcipients,
        unlinkedCount: unlinked,
      };
    });
  }, [rawProductFormulas, productMap, materialMap]);

  // Hydrated Raw Materials
  const rawMaterials = useMemo<HydratedRawMaterial[]>(() => {
    return rawRawMaterials.map(mat => {
      const usedInFormulas: ProductFormula[] = [];
      const usedInProducts: Product[] = [];

      rawProductFormulas.forEach(f => {
        const hasMat = (f.ingredients || []).some(i => i.materialId === mat.id) ||
                       (f.excipients || []).some(e => e.materialId === mat.id);
        if (hasMat) {
          usedInFormulas.push(f);
          const p = productMap.get(f.productId);
          if (p && !usedInProducts.some(up => up.id === p.id)) {
            usedInProducts.push(p);
          }
        }
      });

      return {
        ...mat,
        usedInFormulas,
        usedInProducts,
        usageCount: usedInFormulas.length,
      };
    });
  }, [rawRawMaterials, rawProductFormulas, productMap]);

  // Hydrated TCCS
  const tccsList = useMemo<HydratedTCCS[]>(() => {
    return rawTccsList.map(t => {
      const batchesUsingThis = rawBatches.filter(b => b.tccsId === t.id).length;
      return {
        ...t,
        product: productMap.get(t.productId),
        formula: formulaMap.get(t.productId),
        batchesCount: batchesUsingThis,
        aliases: aliasesByTccs.get(t.id) || [],
      };
    });
  }, [rawTccsList, productMap, formulaMap, rawBatches, aliasesByTccs]);

  // Hydrated Products
  const products = useMemo<HydratedProduct[]>(() => {
    return rawProducts.map(prod => {
      const pTccs = tccsByProduct.get(prod.id) || [];
      const activeTCCS = pTccs.find(t => t.isActive) || pTccs[0];
      const pBatches = batchesByProduct.get(prod.id) || [];
      const sortedBatches = [...pBatches].sort((a, b) => b.mfgDate.localeCompare(a.mfgDate));
      
      const pBatchIds = new Set(pBatches.map(b => b.id));
      const pTests = rawTestResults.filter(r => pBatchIds.has(r.batchId));
      const passTests = pTests.filter(t => t.overallStatus === 'PASS');
      const passRate = pTests.length > 0 ? Math.round((passTests.length / pTests.length) * 100) : 100;

      return {
        ...prod,
        activeTCCS,
        allTCCS: pTccs,
        formula: formulaMap.get(prod.id),
        batches: sortedBatches,
        batchesCount: pBatches.length,
        testResultsCount: pTests.length,
        passRate,
        latestBatch: sortedBatches[0],
      };
    });
  }, [rawProducts, tccsByProduct, formulaMap, batchesByProduct, rawTestResults]);

  // Hydrated Criteria Aliases
  const criteriaAliases = useMemo<HydratedCriteriaAlias[]>(() => {
    return rawCriteriaAliases.map(a => {
      const tccs = tccsMap.get(a.tccsId);
      const product = tccs ? productMap.get(tccs.productId) : undefined;
      return {
        ...a,
        tccs,
        product,
      };
    });
  }, [rawCriteriaAliases, tccsMap, productMap]);

  return { 
    batches, 
    testResults, 
    allTestResultsHydrated,
    products,
    tccsList,
    productFormulas,
    rawMaterials,
    criteriaAliases,
  };
};