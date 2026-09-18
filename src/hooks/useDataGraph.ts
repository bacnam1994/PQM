import { useMemo, useCallback } from 'react';
import {
  useProductsQuery,
  useProductFormulasQuery,
  useRawMaterialsQuery,
  useBatchesQuery,
  useTCCSListQuery,
  useCriteriaAliasesQuery,
  useTestResultsQuery,
  useTestingLaboratoriesQuery,
} from './queries';
import {
  Batch,
  Product,
  TCCS,
  TestResult,
  ProductFormula,
  RawMaterial,
  CriteriaAlias,
  FormulaIngredient,
  TestingLaboratory,
} from '../types';
import { calculateOverallStatus } from '../utils/evaluation';
import { useAppStore } from '../store/useAppStore';
import { resolveCanonicalLab, DEFAULT_TESTING_LABORATORIES } from '../services/laboratoryService';

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
  /** Tổng số phiếu kiểm nghiệm của tất cả lô dùng TCCS này */
  testResultsCount: number;
  /** Tỷ lệ đạt (%) của các phiếu KN liên quan (0-100) hoặc null nếu chưa có phiếu nào */
  passRate: number | null;
}

export interface HydratedRawMaterial extends RawMaterial {
  usedInFormulas: ProductFormula[];
  usedInProducts: Product[];
  usageCount: number;
}

export interface HydratedBatch extends Batch {
  product?: Product;
  tccs?: TCCS;
  formula?: ProductFormula;
  testResults?: TestResult[];
  latestTestResult?: TestResult;
  /**
   * isFullyTested: Chuẩn hóa Type/API (Model 1).
   * TODO (Model 6 - Business Rule Engine): Đánh giá điều kiện kiểm nghiệm toàn diện.
   * Tuyệt đối không suy diễn chỉ từ việc 'có ít nhất 1 test PASS'.
   */
  isFullyTested?: boolean;
  /** Số phiếu kiểm nghiệm của lô này */
  testResultsCount?: number;
  /** Tỷ lệ đạt (%) của các phiếu KN trong lô (0-100) hoặc null nếu chưa có phiếu nào */
  passRate?: number | null;
}

export interface HydratedTestResult extends TestResult {
  batch?: HydratedBatch;
  product?: Product;
  tccs?: TCCS;
  laboratory?: TestingLaboratory;
  canonicalLabName?: string;
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
  /** Tỷ lệ đạt (%) chất lượng tổng thể của sản phẩm hoặc null nếu chưa có phiếu nào */
  passRate: number | null;
  latestBatch?: Batch;
}

const EMPTY_ARRAY: any[] = [];

export const useDataGraph = () => {
  const { data: rawProducts = EMPTY_ARRAY } = useProductsQuery();
  const { data: rawBatches = EMPTY_ARRAY } = useBatchesQuery();
  const { data: rawTccsList = EMPTY_ARRAY } = useTCCSListQuery();
  const { data: rawTestResults = EMPTY_ARRAY } = useTestResultsQuery();
  const { data: rawProductFormulas = EMPTY_ARRAY } = useProductFormulasQuery();
  const { data: rawRawMaterials = EMPTY_ARRAY } = useRawMaterialsQuery();
  const { data: rawCriteriaAliases = EMPTY_ARRAY } = useCriteriaAliasesQuery();
  const rawAllTestResults = rawTestResults;
  const { data: testingLaboratories = DEFAULT_TESTING_LABORATORIES } =
    useTestingLaboratoriesQuery();

  // ==========================================
  // 1. PRIMARY MAPS (By ID & Unique Keys) - O(N)
  // ==========================================
  const productsById = useMemo(
    () => new Map<string, Product>(rawProducts.map((p) => [p.id, p])),
    [rawProducts]
  );
  const tccsById = useMemo(
    () => new Map<string, TCCS>(rawTccsList.map((t) => [t.id, t])),
    [rawTccsList]
  );
  const batchesById = useMemo(
    () => new Map<string, Batch>(rawBatches.map((b) => [b.id, b])),
    [rawBatches]
  );
  const batchesByBatchNo = useMemo(
    () =>
      new Map<string, Batch>(
        rawBatches.filter((b) => b.batchNo).map((b) => [b.batchNo.toLowerCase(), b])
      ),
    [rawBatches]
  );
  const testResultsById = useMemo(
    () => new Map<string, TestResult>(rawTestResults.map((r) => [r.id, r])),
    [rawTestResults]
  );
  const formulasByProductId = useMemo(
    () => new Map<string, ProductFormula>(rawProductFormulas.map((f) => [f.productId, f])),
    [rawProductFormulas]
  );
  const materialsById = useMemo(
    () => new Map<string, RawMaterial>(rawRawMaterials.map((m) => [m.id, m])),
    [rawRawMaterials]
  );

  // Tra cứu Lô linh hoạt (ID, BatchNo hoặc suffix) - O(1) lookup
  const getBatchForTestResult = useMemo(
    () =>
      (batchId: string): Batch | undefined => {
        if (!batchId) return undefined;
        if (batchesById.has(batchId)) return batchesById.get(batchId);
        const lower = batchId.toLowerCase();
        if (batchesByBatchNo.has(lower)) return batchesByBatchNo.get(lower);
        return rawBatches.find(
          (b) =>
            (b.id && batchId.endsWith(b.id)) ||
            (batchId && b.id.endsWith(batchId)) ||
            (b.batchNo && b.batchNo.toLowerCase() === lower)
        );
      },
    [batchesById, batchesByBatchNo, rawBatches]
  );

  // ==========================================
  // 2. SECONDARY INDEXES (Grouping Multi-Maps) - O(N)
  // ==========================================

  // Batches by ProductId
  const batchesByProductId = useMemo(() => {
    const map = new Map<string, Batch[]>();
    rawBatches.forEach((b) => {
      if (!b.productId) return;
      const list = map.get(b.productId) || [];
      list.push(b);
      map.set(b.productId, list);
    });
    return map;
  }, [rawBatches]);

  // Batches by TccsId
  const batchesByTccsId = useMemo(() => {
    const map = new Map<string, Batch[]>();
    rawBatches.forEach((b) => {
      if (!b.tccsId) return;
      const list = map.get(b.tccsId) || [];
      list.push(b);
      map.set(b.tccsId, list);
    });
    return map;
  }, [rawBatches]);

  // TCCS by ProductId
  const tccsByProductId = useMemo(() => {
    const map = new Map<string, TCCS[]>();
    rawTccsList.forEach((t) => {
      if (!t.productId) return;
      const list = map.get(t.productId) || [];
      list.push(t);
      map.set(t.productId, list);
    });
    return map;
  }, [rawTccsList]);

  // Aliases by TccsId
  const aliasesByTccsId = useMemo(() => {
    const map = new Map<string, CriteriaAlias[]>();
    rawCriteriaAliases.forEach((a) => {
      if (!a.tccsId) return;
      const list = map.get(a.tccsId) || [];
      list.push(a);
      map.set(a.tccsId, list);
    });
    return map;
  }, [rawCriteriaAliases]);

  // Test Results by BatchId
  const testResultsByBatchId = useMemo(() => {
    const map = new Map<string, TestResult[]>();
    const sourceTests =
      rawTestResults.length >= (rawAllTestResults?.length || 0)
        ? rawTestResults
        : rawAllTestResults;
    sourceTests.forEach((r) => {
      const matchedBatch = getBatchForTestResult(r.batchId);
      const key = matchedBatch ? matchedBatch.id : r.batchId;
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    });
    return map;
  }, [rawTestResults, rawAllTestResults, getBatchForTestResult]);

  // Inverted index: Formulas by MaterialId
  const formulasByMaterialId = useMemo(() => {
    const map = new Map<string, ProductFormula[]>();
    rawProductFormulas.forEach((f) => {
      const matIds = new Set<string>();
      (f.ingredients || []).forEach((i) => i.materialId && matIds.add(i.materialId));
      (f.excipients || []).forEach((e) => e.materialId && matIds.add(e.materialId));
      matIds.forEach((mId) => {
        const list = map.get(mId) || [];
        list.push(f);
        map.set(mId, list);
      });
    });
    return map;
  }, [rawProductFormulas]);

  // ==========================================
  // 3. HYDRATED ENTITIES (Instant Index Lookups)
  // ==========================================

  // Hydrated Batches
  const batches = useMemo<HydratedBatch[]>(() => {
    return rawBatches.map((batch) => {
      const bTests = testResultsByBatchId.get(batch.id) || [];
      const sortedTests = [...bTests].sort((a, b) => b.testDate.localeCompare(a.testDate));
      const passTests = bTests.filter((t) => t.overallStatus === 'PASS');
      return {
        ...batch,
        product: productsById.get(batch.productId),
        tccs: batch.tccsSnapshot || tccsById.get(batch.tccsId),
        formula: batch.formulaSnapshot || formulasByProductId.get(batch.productId),
        testResults: sortedTests,
        latestTestResult: sortedTests[0],
        isFullyTested:
          bTests.length > 0 &&
          bTests.every((t) => t.overallStatus === 'PASS' || t.overallStatus === 'FAIL'),
        testResultsCount: bTests.length,
        passRate: bTests.length > 0 ? Math.round((passTests.length / bTests.length) * 100) : null,
      };
    });
  }, [rawBatches, productsById, tccsById, formulasByProductId, testResultsByBatchId]);

  // Hydrated Test Results
  const testResults = useMemo<HydratedTestResult[]>(() => {
    return rawTestResults.map((res) => {
      const rawBatch = getBatchForTestResult(res.batchId);
      const product = rawBatch ? productsById.get(rawBatch.productId) : undefined;
      const tccs = rawBatch ? rawBatch.tccsSnapshot || tccsById.get(rawBatch.tccsId) : undefined;
      const overallStatus =
        res.results && res.results.length > 0
          ? calculateOverallStatus(res.results, tccs || null)
          : (res.overallStatus ?? 'UNKNOWN');
      const labInfo = resolveCanonicalLab(res.labId || res.labName, testingLaboratories);

      return {
        ...res,
        overallStatus,
        laboratory: labInfo.lab,
        canonicalLabName: labInfo.labName,
        batch: rawBatch
          ? (() => {
              const bTests = testResultsByBatchId.get(rawBatch.id) || [];
              const passCount = bTests.filter((t) => t.overallStatus === 'PASS').length;
              return {
                ...rawBatch,
                product,
                tccs,
                formula: formulasByProductId.get(rawBatch.productId),
                testResults: bTests,
                isFullyTested:
                  bTests.length > 0 &&
                  bTests.every((t) => t.overallStatus === 'PASS' || t.overallStatus === 'FAIL'),
                testResultsCount: bTests.length,
                passRate: bTests.length > 0 ? Math.round((passCount / bTests.length) * 100) : null,
              };
            })()
          : undefined,
        product,
        tccs,
      };
    });
  }, [
    rawTestResults,
    getBatchForTestResult,
    productsById,
    tccsById,
    formulasByProductId,
    testResultsByBatchId,
    testingLaboratories,
  ]);

  const allTestResultsHydrated = useMemo<HydratedTestResult[]>(() => {
    if (!rawAllTestResults || rawAllTestResults.length === 0) return [];
    return rawAllTestResults.map((res) => {
      const rawBatch = getBatchForTestResult(res.batchId);
      const product = rawBatch ? productsById.get(rawBatch.productId) : undefined;
      const tccs = rawBatch ? tccsById.get(rawBatch.tccsId) : undefined;
      const overallStatus =
        res.results && res.results.length > 0
          ? calculateOverallStatus(res.results, tccs || null)
          : (res.overallStatus ?? 'UNKNOWN');

      return {
        ...res,
        overallStatus,
        batch: rawBatch
          ? (() => {
              const bTests = testResultsByBatchId.get(rawBatch.id) || [];
              const passCount = bTests.filter((t) => t.overallStatus === 'PASS').length;
              return {
                ...rawBatch,
                product,
                tccs,
                formula: formulasByProductId.get(rawBatch.productId),
                testResults: bTests,
                isFullyTested:
                  bTests.length > 0 &&
                  bTests.every((t) => t.overallStatus === 'PASS' || t.overallStatus === 'FAIL'),
                testResultsCount: bTests.length,
                passRate: bTests.length > 0 ? Math.round((passCount / bTests.length) * 100) : null,
              };
            })()
          : undefined,
        product,
        tccs,
      };
    });
  }, [
    rawAllTestResults,
    getBatchForTestResult,
    productsById,
    tccsById,
    formulasByProductId,
    testResultsByBatchId,
  ]);

  // Hydrated Formulas
  const productFormulas = useMemo<HydratedProductFormula[]>(() => {
    return rawProductFormulas.map((f) => {
      let unlinked = 0;
      const hydratedIngredients: HydratedFormulaIngredient[] = (f.ingredients || []).map((ing) => {
        const mat = ing.materialId ? materialsById.get(ing.materialId) : undefined;
        if (!mat) unlinked++;
        return {
          ...ing,
          rawMaterial: mat,
          isLinkedToMaterial: !!mat,
        };
      });

      const hydratedExcipients: HydratedFormulaIngredient[] = (f.excipients || []).map((exc) => {
        const mat = exc.materialId ? materialsById.get(exc.materialId) : undefined;
        if (!mat) unlinked++;
        return {
          ...exc,
          rawMaterial: mat,
          isLinkedToMaterial: !!mat,
        };
      });

      return {
        ...f,
        product: productsById.get(f.productId),
        hydratedIngredients,
        hydratedExcipients,
        unlinkedCount: unlinked,
      };
    });
  }, [rawProductFormulas, productsById, materialsById]);

  // Hydrated Raw Materials (Using Inverted Index)
  const rawMaterials = useMemo<HydratedRawMaterial[]>(() => {
    return rawRawMaterials.map((mat) => {
      const usedInFormulas = formulasByMaterialId.get(mat.id) || [];
      const usedInProducts: Product[] = [];
      const seenProductIds = new Set<string>();

      usedInFormulas.forEach((f) => {
        if (!seenProductIds.has(f.productId)) {
          seenProductIds.add(f.productId);
          const p = productsById.get(f.productId);
          if (p) usedInProducts.push(p);
        }
      });

      return {
        ...mat,
        usedInFormulas,
        usedInProducts,
        usageCount: usedInFormulas.length,
      };
    });
  }, [rawRawMaterials, formulasByMaterialId, productsById]);

  // Hydrated TCCS (Using BatchesByTccsId Index)
  const tccsList = useMemo<HydratedTCCS[]>(() => {
    return rawTccsList.map((t) => {
      const batchesUsingThis = batchesByTccsId.get(t.id) || [];
      const batchesCount = batchesUsingThis.length;
      let passCount = 0;
      let testResultsCount = 0;
      batchesUsingThis.forEach((b) => {
        const bTests = testResultsByBatchId.get(b.id) || [];
        testResultsCount += bTests.length;
        passCount += bTests.filter((r) => r.overallStatus === 'PASS').length;
      });
      const passRate =
        testResultsCount > 0 ? Math.round((passCount / testResultsCount) * 100) : null;
      return {
        ...t,
        product: productsById.get(t.productId),
        formula: formulasByProductId.get(t.productId),
        batchesCount,
        aliases: aliasesByTccsId.get(t.id) || [],
        testResultsCount,
        passRate,
      };
    });
  }, [
    rawTccsList,
    productsById,
    formulasByProductId,
    batchesByTccsId,
    aliasesByTccsId,
    testResultsByBatchId,
  ]);

  // Hydrated Products (Using BatchesByProductId & TestResultsByBatchId Indexes)
  const products = useMemo<HydratedProduct[]>(() => {
    return rawProducts.map((prod) => {
      const pTccs = tccsByProductId.get(prod.id) || [];
      const activeTCCS = pTccs.find((t) => t.isActive) || pTccs[0];
      const pBatches = batchesByProductId.get(prod.id) || [];
      const sortedBatches = [...pBatches].sort((a, b) => b.mfgDate.localeCompare(a.mfgDate));

      let pTestsCount = 0;
      let passCount = 0;
      pBatches.forEach((b) => {
        const bTests = testResultsByBatchId.get(b.id) || [];
        pTestsCount += bTests.length;
        passCount += bTests.filter((t) => t.overallStatus === 'PASS').length;
      });

      const passRate = pTestsCount > 0 ? Math.round((passCount / pTestsCount) * 100) : null;

      return {
        ...prod,
        activeTCCS,
        allTCCS: pTccs,
        formula: formulasByProductId.get(prod.id),
        batches: sortedBatches,
        batchesCount: pBatches.length,
        testResultsCount: pTestsCount,
        passRate,
        latestBatch: sortedBatches[0],
      };
    });
  }, [rawProducts, tccsByProductId, formulasByProductId, batchesByProductId, testResultsByBatchId]);

  // Hydrated Criteria Aliases
  const criteriaAliases = useMemo<HydratedCriteriaAlias[]>(() => {
    return rawCriteriaAliases.map((a) => {
      const tccs = tccsById.get(a.tccsId);
      const product = tccs ? productsById.get(tccs.productId) : undefined;
      return {
        ...a,
        tccs,
        product,
      };
    });
  }, [rawCriteriaAliases, tccsById, productsById]);

  // ==========================================
  // 4. FAST LOOKUP HELPERS - O(1)
  // ==========================================
  const getBatchesByProductId = useCallback(
    (productId: string): Batch[] => batchesByProductId.get(productId) || EMPTY_ARRAY,
    [batchesByProductId]
  );

  const getTestResultsByBatchId = useCallback(
    (batchId: string): TestResult[] => testResultsByBatchId.get(batchId) || EMPTY_ARRAY,
    [testResultsByBatchId]
  );

  const getActiveTccsByProductId = useCallback(
    (productId: string): TCCS | undefined => {
      const list = tccsByProductId.get(productId) || EMPTY_ARRAY;
      return list.find((t) => t.isActive) || list[0];
    },
    [tccsByProductId]
  );

  const getFormulaByProductId = useCallback(
    (productId: string): ProductFormula | undefined => formulasByProductId.get(productId),
    [formulasByProductId]
  );

  const getProductById = useCallback(
    (id: string): Product | undefined => productsById.get(id),
    [productsById]
  );
  const getBatchById = useCallback(
    (id: string): Batch | undefined => batchesById.get(id),
    [batchesById]
  );
  const getTccsById = useCallback((id: string): TCCS | undefined => tccsById.get(id), [tccsById]);
  const getTestResultById = useCallback(
    (id: string): TestResult | undefined => testResultsById.get(id),
    [testResultsById]
  );

  const getHydratedBatch = useCallback(
    (batchId: string): HydratedBatch | undefined => {
      const batch = batchesById.get(batchId);
      if (!batch) return undefined;
      const bTests = testResultsByBatchId.get(batch.id) || [];
      const sortedTests = [...bTests].sort((a, b) => b.testDate.localeCompare(a.testDate));
      const passTests = bTests.filter((t) => t.overallStatus === 'PASS');
      return {
        ...batch,
        product: productsById.get(batch.productId),
        tccs: batch.tccsSnapshot || tccsById.get(batch.tccsId),
        formula: batch.formulaSnapshot || formulasByProductId.get(batch.productId),
        testResults: sortedTests,
        latestTestResult: sortedTests[0],
        isFullyTested:
          bTests.length > 0 &&
          bTests.every((t) => t.overallStatus === 'PASS' || t.overallStatus === 'FAIL'),
        testResultsCount: bTests.length,
        passRate: bTests.length > 0 ? Math.round((passTests.length / bTests.length) * 100) : null,
      };
    },
    [batchesById, productsById, tccsById, formulasByProductId, testResultsByBatchId]
  );

  return {
    // Legacy Hydrated Arrays (100% Backward Compatibility)
    batches,
    testResults,
    allTestResultsHydrated,
    products,
    tccsList,
    productFormulas,
    rawMaterials,
    criteriaAliases,
    testingLaboratories,

    // High-Performance Data Graph Index Maps (Phase 5)
    productsById,
    batchesById,
    batchesByProductId,
    batchesByTccsId,
    tccsById,
    tccsByProductId,
    testResultsById,
    testResultsByBatchId,
    formulasByProductId,
    aliasesByTccsId,

    // Fast Lookup Helpers
    getBatchesByProductId,
    getTestResultsByBatchId,
    getActiveTccsByProductId,
    getFormulaByProductId,
    getProductById,
    getBatchById,
    getTccsById,
    getTestResultById,
    getHydratedBatch,
  };
};
