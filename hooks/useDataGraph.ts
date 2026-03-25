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

  const batches = useMemo<HydratedBatch[]>(() => {
    const productMap = new Map(state.products.map(p => [p.id, p]));
    const tccsMap = new Map(state.tccsList.map(t => [t.id, t]));

    return state.batches.map(batch => ({
      ...batch,
      product: productMap.get(batch.productId),
      tccs: tccsMap.get(batch.tccsId),
      stock: stockMap.get(batch.id) || { in: 0, out: 0, balance: 0 }
    }));
  }, [state.batches, state.products, state.tccsList, stockMap]);

  const testResults = useMemo<HydratedTestResult[]>(() => {
    const batchMap = new Map<string, HydratedBatch>(batches.map(b => [b.id, b]));

    return rawTestResults.map(res => {
      const batch = batchMap.get(res.batchId);
      return {
        ...res,
        batch: batch,
        product: batch?.product
      };
    });
  }, [rawTestResults, batches]);

  const inventoryIn = useMemo<HydratedInventoryIn[]>(() => {
    const batchMap = new Map<string, Batch>(state.batches.map(b => [b.id, b]));
    const productMap = new Map<string, Product>(state.products.map(p => [p.id, p]));

    return state.inventoryIn.map(inv => {
      const batch = batchMap.get(inv.batchId);
      return {
        ...inv,
        batch: batch,
        product: productMap.get(batch?.productId || '')
      };
    });
  }, [state.inventoryIn, state.batches, state.products]);

  const inventoryOut = useMemo<HydratedInventoryOut[]>(() => {
    const batchMap = new Map<string, Batch>(state.batches.map(b => [b.id, b]));
    const productMap = new Map<string, Product>(state.products.map(p => [p.id, p]));

    return state.inventoryOut.map(inv => {
      const batch = batchMap.get(inv.batchId);
      return {
        ...inv,
        batch: batch,
        product: productMap.get(batch?.productId || '')
      };
    });
  }, [state.inventoryOut, state.batches, state.products]);

  return { batches, testResults, inventoryIn, inventoryOut };
};