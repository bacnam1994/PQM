import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useTestResultContext } from '../context/TestResultContext';
import { Batch, Product, TCCS, TestResult, InventoryIn, InventoryOut } from '../types';

export interface HydratedBatch extends Batch {
  product?: Product;
  tccs?: TCCS;
  stock: { in: number; out: number; balance: number };
}

export interface HydratedTestResult extends TestResult {
  batch?: HydratedBatch;
  product?: Product;
}

export interface HydratedInventoryIn extends InventoryIn {
  batch?: Batch;
  product?: Product;
}

export interface HydratedInventoryOut extends InventoryOut {
  batch?: Batch;
  product?: Product;
}

export const useDataGraph = () => {
  const { state, stockMap } = useAppContext();
  const { testResults: rawTestResults } = useTestResultContext();

  // Safe access to arrays with fallbacks to empty arrays - CRITICAL: Always return arrays
  const products = state?.products || [];
  const tccsList = state?.tccsList || [];
  const batches = state?.batches || [];
  const inventoryIn = state?.inventoryIn || [];
  const inventoryOut = state?.inventoryOut || [];

  const batchesMemo = useMemo<HydratedBatch[]>(() => {
    try {
      // Safety check: Ensure arrays are valid before mapping
      if (!Array.isArray(batches)) {
        console.warn('useDataGraph: batches is not an array', batches);
        return [];
      }
      if (!Array.isArray(products)) {
        console.warn('useDataGraph: products is not an array', products);
        return [];
      }
      if (!Array.isArray(tccsList)) {
        console.warn('useDataGraph: tccsList is not an array', tccsList);
        return [];
      }

      const productMap = new Map(products.map(p => [p.id, p]));
      const tccsMap = new Map(tccsList.map(t => [t.id, t]));

      return batches.map(batch => {
        if (!batch || !batch.id) {
          console.warn('useDataGraph: Found invalid batch item', batch);
          return null;
        }
        return {
          ...batch,
          product: productMap.get(batch.productId),
          tccs: tccsMap.get(batch.tccsId),
          stock: stockMap?.get(batch.id) || { in: 0, out: 0, balance: 0 }
        };
      }).filter((b): b is HydratedBatch => b !== null);
    } catch (error) {
      console.error('Error in useDataGraph batches memo:', error);
      return [];
    }
  }, [batches, products, tccsList, stockMap]);

  const testResultsMemo = useMemo<HydratedTestResult[]>(() => {
    try {
      // Safety check
      if (!Array.isArray(rawTestResults)) {
        console.warn('useDataGraph: rawTestResults is not an array', rawTestResults);
        return [];
      }
      if (!Array.isArray(batchesMemo)) {
        console.warn('useDataGraph: batchesMemo is not an array', batchesMemo);
        return [];
      }

      const batchMap = new Map<string, HydratedBatch>(batchesMemo.map(b => [b.id, b]));

      return rawTestResults.map(res => {
        if (!res || !res.id) {
          console.warn('useDataGraph: Found invalid test result', res);
          return null;
        }
        const batch = batchMap.get(res.batchId);
        return {
          ...res,
          batch: batch,
          product: batch?.product
        };
      }).filter((r): r is HydratedTestResult => r !== null);
    } catch (error) {
      console.error('Error in useDataGraph testResults memo:', error);
      return [];
    }
  }, [rawTestResults, batchesMemo]);

  const inventoryInMemo = useMemo<HydratedInventoryIn[]>(() => {
    try {
      // Safety check
      if (!Array.isArray(inventoryIn)) {
        console.warn('useDataGraph: inventoryIn is not an array', inventoryIn);
        return [];
      }
      if (!Array.isArray(batches)) {
        console.warn('useDataGraph: batches is not an array', batches);
        return [];
      }
      if (!Array.isArray(products)) {
        console.warn('useDataGraph: products is not an array', products);
        return [];
      }

      const batchMap = new Map<string, Batch>(batches.map(b => [b.id, b]));
      const productMap = new Map<string, Product>(products.map(p => [p.id, p]));

      return inventoryIn.map(inv => {
        if (!inv || !inv.id) return null;
        const batch = batchMap.get(inv.batchId);
        return {
          ...inv,
          batch: batch,
          product: productMap.get(batch?.productId || '')
        };
      }).filter((r): r is HydratedInventoryIn => r !== null);
    } catch (error) {
      console.error('Error in useDataGraph inventoryIn memo:', error);
      return [];
    }
  }, [inventoryIn, batches, products]);

  const inventoryOutMemo = useMemo<HydratedInventoryOut[]>(() => {
    try {
      // Safety check
      if (!Array.isArray(inventoryOut)) {
        console.warn('useDataGraph: inventoryOut is not an array', inventoryOut);
        return [];
      }
      if (!Array.isArray(batches)) {
        console.warn('useDataGraph: batches is not an array', batches);
        return [];
      }
      if (!Array.isArray(products)) {
        console.warn('useDataGraph: products is not an array', products);
        return [];
      }

      const batchMap = new Map<string, Batch>(batches.map(b => [b.id, b]));
      const productMap = new Map<string, Product>(products.map(p => [p.id, p]));

      return inventoryOut.map(inv => {
        if (!inv || !inv.id) return null;
        const batch = batchMap.get(inv.batchId);
        return {
          ...inv,
          batch: batch,
          product: productMap.get(batch?.productId || '')
        };
      }).filter((r): r is HydratedInventoryOut => r !== null);
    } catch (error) {
      console.error('Error in useDataGraph inventoryOut memo:', error);
      return [];
    }
  }, [inventoryOut, batches, products]);

  return { 
    batches: batchesMemo, 
    testResults: testResultsMemo, 
    inventoryIn: inventoryInMemo, 
    inventoryOut: inventoryOutMemo 
  };
};

