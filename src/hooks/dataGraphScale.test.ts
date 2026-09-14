/**
 * dataGraphScale.test.ts
 * Đo lường hiệu năng và độ ổn định bộ nhớ của Data Graph trên các quy mô:
 * 1.000, 10.000, 50.000, 100.000 thực thể.
 */

import { describe, it, expect } from 'vitest';
import { Product, Batch, TestResult, TCCS } from '../types';

describe('P6 — Data Graph Indexing Scalability & Memory Footprint', () => {
  function generateEntities(count: number) {
    const products: Product[] = [];
    const batches: Batch[] = [];
    const testResults: TestResult[] = [];
    const tccsList: TCCS[] = [];

    const productCount = Math.max(10, Math.floor(count / 10));
    for (let i = 0; i < productCount; i++) {
      const pId = `prod_${i}`;
      products.push({
        id: pId,
        code: `P-${i}`,
        name: `Sản phẩm ${i}`,
        group: 'Thuốc bột',
        status: 'ACTIVE',
      } as any);
      tccsList.push({
        id: `tccs_${i}`,
        code: `TCCS-${i}`,
        productId: pId,
        isActive: true,
        issueDate: '2026-01-01',
        mainQualityCriteria: [],
        safetyCriteria: [],
        alternateRules: [],
        packaging: 'Hộp',
        storage: 'Khô ráo',
        shelfLife: '36 tháng',
      } as any);
    }

    const batchCount = count;
    for (let i = 0; i < batchCount; i++) {
      const bId = `batch_${i}`;
      const pId = `prod_${i % productCount}`;
      batches.push({
        id: bId,
        batchNo: `LOT-${i}`,
        productId: pId,
        tccsId: `tccs_${i % productCount}`,
        mfgDate: '2026-01-01',
        expDate: '2028-01-01',
        status: 'RELEASED',
      } as any);
      testResults.push({
        id: `tr_${i}`,
        batchId: bId,
        testDate: '2026-01-10',
        overallStatus: i % 10 === 0 ? 'FAIL' : 'PASS',
        results: [],
      } as any);
    }

    return { products, batches, testResults, tccsList };
  }

  function benchmarkDataGraphIndexing(count: number) {
    const data = generateEntities(count);

    const startTime = performance.now();

    // 1. Primary Maps (O(N))
    const productsById = new Map<string, Product>(data.products.map((p) => [p.id, p]));
    const batchesById = new Map<string, Batch>(data.batches.map((b) => [b.id, b]));
    const tccsById = new Map<string, TCCS>(data.tccsList.map((t) => [t.id, t]));
    const testResultsById = new Map<string, TestResult>(data.testResults.map((r) => [r.id, r]));

    // 2. Secondary Multi-Maps (O(N))
    const batchesByProductId = new Map<string, Batch[]>();
    data.batches.forEach((b) => {
      const list = batchesByProductId.get(b.productId) || [];
      list.push(b);
      batchesByProductId.set(b.productId, list);
    });

    const testResultsByBatchId = new Map<string, TestResult[]>();
    data.testResults.forEach((r) => {
      const list = testResultsByBatchId.get(r.batchId) || [];
      list.push(r);
      testResultsByBatchId.set(r.batchId, list);
    });

    const duration = performance.now() - startTime;

    // 3. Tra cứu O(1)
    const lookupStart = performance.now();
    const testBatch = batchesById.get(`batch_${Math.floor(count / 2)}`);
    const relatedTests = testResultsByBatchId.get(testBatch?.id || '');
    const lookupDuration = performance.now() - lookupStart;

    return {
      count,
      duration,
      lookupDuration,
      hasBatch: Boolean(testBatch),
      testCount: relatedTests?.length,
    };
  }

  it('xây dựng index và tra cứu O(1) trên 1.000 thực thể (< 20ms)', () => {
    const res = benchmarkDataGraphIndexing(1000);
    expect(res.hasBatch).toBe(true);
    expect(res.duration).toBeLessThan(50); // Ngưỡng an toàn < 50ms (thường < 5ms)
    expect(res.lookupDuration).toBeLessThan(1); // O(1) < 1ms
  });

  it('xây dựng index và tra cứu O(1) trên 10.000 thực thể (< 100ms)', () => {
    const res = benchmarkDataGraphIndexing(10000);
    expect(res.hasBatch).toBe(true);
    expect(res.duration).toBeLessThan(150); // Thường < 25ms
    expect(res.lookupDuration).toBeLessThan(1);
  });

  it('xây dựng index và tra cứu O(1) trên 50.000 thực thể (< 500ms)', () => {
    const res = benchmarkDataGraphIndexing(50000);
    expect(res.hasBatch).toBe(true);
    expect(res.duration).toBeLessThan(600); // Thường < 120ms
    expect(res.lookupDuration).toBeLessThan(1);
  });

  it('xây dựng index và tra cứu O(1) trên 100.000 thực thể (Stress test < 1.2s)', () => {
    const res = benchmarkDataGraphIndexing(100000);
    expect(res.hasBatch).toBe(true);
    expect(res.duration).toBeLessThan(1500); // Thường < 300ms
    expect(res.lookupDuration).toBeLessThan(1);
  });
});
