import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
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
  const rawBatches = useAppStore(state => state.batches);
  const rawProducts = useAppStore(state => state.products);
  const rawTccsList = useAppStore(state => state.tccsList);
  const rawInventoryIn = useAppStore(state => state.inventoryIn);
  const rawInventoryOut = useAppStore(state => state.inventoryOut);
  const rawTestResults = useAppStore(state => state.testResults);
  const rawAllTestResults = useAppStore(state => state.allTestResults);
  const stockMap = useAppStore(state => state.stockMap);

  // Tối ưu 1: Khởi tạo các Map tra cứu 1 lần duy nhất để tái sử dụng cho tất cả các Derived State
  // Giảm thiểu vòng lặp O(N) lặp đi lặp lại mỗi khi có state thay đổi
  const productMap = useMemo(() => new Map(rawProducts.map(p => [p.id, p])), [rawProducts]);
  const tccsMap = useMemo(() => new Map(rawTccsList.map(t => [t.id, t])), [rawTccsList]);
  const batchMap = useMemo(() => new Map(rawBatches.map(b => [b.id, b])), [rawBatches]);

  const batches = useMemo<HydratedBatch[]>(() => {
    return rawBatches.map(batch => ({
      ...batch,
      product: productMap.get(batch.productId),
      tccs: tccsMap.get(batch.tccsId),
      stock: stockMap.get(batch.id) || { in: 0, out: 0, balance: 0 }
    }));
  }, [rawBatches, productMap, tccsMap, stockMap]);

  // Tối ưu 2: Cắt đứt chuỗi Dependency (Phụ thuộc)
  // Không dùng lại mảng `batches` ở trên (vì nó phụ thuộc vào stockMap).
  // Nếu dùng, mỗi lần Nhập/Xuất kho (stockMap đổi) sẽ làm toàn bộ danh sách Kết quả kiểm nghiệm re-render!
  const testResults = useMemo<HydratedTestResult[]>(() => {
    return rawTestResults.map(res => {
      const rawBatch = batchMap.get(res.batchId);
      const product = rawBatch ? productMap.get(rawBatch.productId) : undefined;
      const tccs = rawBatch ? tccsMap.get(rawBatch.tccsId) : undefined;

      return {
        ...res,
        batch: rawBatch ? { ...rawBatch, product, tccs, stock: { in: 0, out: 0, balance: 0 } } : undefined,
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

      return {
        ...res,
        batch: rawBatch ? { ...rawBatch, product, tccs, stock: { in: 0, out: 0, balance: 0 } } : undefined,
        product: product
      };
    });
  }, [rawAllTestResults, batchMap, productMap, tccsMap]);

  const inventoryIn = useMemo<HydratedInventoryIn[]>(() => {
    return rawInventoryIn.map(inv => {
      const batch = batchMap.get(inv.batchId);
      return {
        ...inv,
        batch: batch,
        product: batch ? productMap.get(batch.productId) : undefined
      };
    });
  }, [rawInventoryIn, batchMap, productMap]);

  const inventoryOut = useMemo<HydratedInventoryOut[]>(() => {
    return rawInventoryOut.map(inv => {
      const batch = batchMap.get(inv.batchId);
      return {
        ...inv,
        batch: batch,
        product: batch ? productMap.get(batch.productId) : undefined
      };
    });
  }, [rawInventoryOut, batchMap, productMap]);

  return { batches, testResults, allTestResultsHydrated, inventoryIn, inventoryOut };
};